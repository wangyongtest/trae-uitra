// Package volcengine 实现火山引擎（豆包）API Provider。
// 支持流式响应、工具调用、视觉能力、层级缓存。
package volcengine

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/trae-ultra/kernel/internal/provider"
)

const (
	baseURL = "https://ark.cn-beijing.volces.com/api/v3"
)

// message 豆包API消息格式。
type message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolCalls  []toolCall `json:"tool_calls,omitempty"`
}

// toolCall 豆包API工具调用格式。
type toolCall struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// tool 工具定义格式。
type tool struct {
	Type     string   `json:"type"`
	Function function `json:"function"`
}

// function 函数定义格式。
type function struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// streamChunk 豆包流式响应块。
type streamChunk struct {
	Choices []struct {
		Delta struct {
			Content   string     `json:"content"`
			ToolCalls []toolCall `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage *usage `json:"usage"`
}

// usage 用量统计。
type usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// chatCompletionRequest 请求体格式。
type chatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	Stream      bool      `json:"stream"`
	Tools       []tool    `json:"tools,omitempty"`
	Temperature *float32  `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
}

// Client 豆包API客户端，实现provider.Provider接口。
type Client struct {
	apiKey string
	model  string
	client *http.Client
}

// New 创建新的豆包客户端。
func New(config map[string]interface{}) (provider.Provider, error) {
	apiKey, _ := config["api_key"].(string)
	if apiKey == "" {
		return nil, fmt.Errorf("volcengine: 缺少api_key配置")
	}
	endpointID, _ := config["endpoint_id"].(string)
	if endpointID == "" {
		endpointID, _ = config["model"].(string)
	}
	if endpointID == "" {
		return nil, fmt.Errorf("volcengine: 缺少endpoint_id或model配置")
	}
	return &Client{
		apiKey: apiKey,
		model:  endpointID,
		client: &http.Client{},
	}, nil
}

// Name 返回Provider名称。
func (c *Client) Name() string {
	return "volcengine"
}

// Supports 返回该Provider的能力支持情况。
// 豆包1.6支持推理、工具调用、视觉。
func (c *Client) Supports() provider.Capability {
	return provider.Capability{
		Reasoning: true,
		Tools:     true,
		Vision:    true,
	}
}

// CacheStrategy 返回该Provider的缓存策略。
// 豆包使用层级缓存，缓存命中token享受1折优惠。
func (c *Client) CacheStrategy() provider.CacheStrategyInfo {
	return provider.CacheStrategyInfo{
		Type:               provider.CacheHierarchical,
		CacheDiscountRatio: 0.1,
		MinPrefixLength:    0,
		DynamicIsolation:   true,
	}
}

// Stream 发起流式聊天请求。
func (c *Client) Stream(ctx context.Context, req *provider.ChatRequest) (<-chan *provider.Chunk, error) {
	apiReq := c.convertRequest(req)
	body, err := json.Marshal(apiReq)
	if err != nil {
		return nil, fmt.Errorf("volcengine: 序列化请求失败: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("volcengine: 创建请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("volcengine: 请求失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("volcengine: API返回错误 %d: %s", resp.StatusCode, string(respBody))
	}

	chunks := make(chan *provider.Chunk, 64)
	go func() {
		defer resp.Body.Close()
		defer close(chunks)
		c.readStream(ctx, resp.Body, chunks)
	}()

	return chunks, nil
}

// convertRequest 将统一ChatRequest转换为豆包API格式。
func (c *Client) convertRequest(req *provider.ChatRequest) *chatCompletionRequest {
	messages := make([]message, len(req.Messages))
	for i, m := range req.Messages {
		messages[i] = message{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
		}
		if len(m.ToolCalls) > 0 {
			messages[i].ToolCalls = make([]toolCall, len(m.ToolCalls))
			for j, tc := range m.ToolCalls {
				messages[i].ToolCalls[j] = toolCall{
					ID:   tc.ID,
					Type: tc.Type,
				}
				messages[i].ToolCalls[j].Function.Name = tc.Function.Name
				messages[i].ToolCalls[j].Function.Arguments = tc.Function.Arguments
			}
		}
	}

	var tools []tool
	if len(req.Tools) > 0 {
		tools = make([]tool, len(req.Tools))
		for i, t := range req.Tools {
			params, _ := t.Function.Parameters.(map[string]interface{})
			tools[i] = tool{
				Type: t.Type,
				Function: function{
					Name:        t.Function.Name,
					Description: t.Function.Description,
					Parameters:  params,
				},
			}
		}
	}

	apiModel := c.model
	if req.Model != "" {
		apiModel = req.Model
	}

	return &chatCompletionRequest{
		Model:       apiModel,
		Messages:    messages,
		Stream:      true,
		Tools:       tools,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}
}

// readStream 读取SSE流并解析为Chunk。
func (c *Client) readStream(ctx context.Context, body io.Reader, chunks chan<- *provider.Chunk) {
	reader := bufio.NewReader(body)
	for {
		select {
		case <-ctx.Done():
			chunks <- &provider.Chunk{
				Type:  provider.ChunkError,
				Error: ctx.Err().Error(),
			}
			return
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err != io.EOF {
				chunks <- &provider.Chunk{
					Type:  provider.ChunkError,
					Error: fmt.Sprintf("读取流失败: %v", err),
				}
			}
			return
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			chunks <- &provider.Chunk{
				Type: provider.ChunkFinish,
			}
			return
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			chunks <- &provider.Chunk{
				Type:  provider.ChunkError,
				Error: fmt.Sprintf("解析响应失败: %v", err),
			}
			return
		}

		if len(chunk.Choices) > 0 {
			delta := chunk.Choices[0].Delta
			if delta.Content != "" {
				chunks <- &provider.Chunk{
					Type:    provider.ChunkContent,
					Content: delta.Content,
				}
			}

			for _, tc := range delta.ToolCalls {
				chunks <- &provider.Chunk{
					Type:          provider.ChunkToolCall,
					ToolCallIndex: tc.Index,
					ToolCallID:    tc.ID,
					ToolCallName:  tc.Function.Name,
					ToolCallArgs:  tc.Function.Arguments,
				}
			}

			if chunk.Choices[0].FinishReason != "" {
				chunks <- &provider.Chunk{
					Type:         provider.ChunkFinish,
					FinishReason: chunk.Choices[0].FinishReason,
				}
			}
		}

		if chunk.Usage != nil {
			chunks <- &provider.Chunk{
				Type:             provider.ChunkUsage,
				PromptTokens:     chunk.Usage.PromptTokens,
				CompletionTokens: chunk.Usage.CompletionTokens,
				CachedTokens:     0,
			}
		}
	}
}

// init 注册火山引擎 Provider工厂。
func init() {
	provider.Register("volcengine", New)
}
