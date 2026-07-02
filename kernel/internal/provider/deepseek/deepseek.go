// Package deepseek 实现DeepSeek API Provider。
// 支持流式响应、工具调用、缓存命中统计。
package deepseek

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
	defaultBaseURL = "https://api.deepseek.com"
	defaultModel   = "deepseek-chat"
)

// Message DeepSeek API消息格式（公开类型用于测试兼容）。
type Message struct {
	Role       string `json:"role"`
	Content    string `json:"content"`
	ToolCallID string `json:"tool_call_id,omitempty"`
}

// ToolCall DeepSeek API工具调用格式（公开类型用于测试兼容）。
type ToolCall struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// StreamChunk 流式响应块（公开类型用于测试兼容）。
type StreamChunk struct {
	Choices []struct {
		Delta struct {
			Content   string     `json:"content"`
			ToolCalls []ToolCall `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage *Usage `json:"usage"`
}

// Usage 用量统计（公开类型用于测试兼容）。
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	CacheHitTokens   int `json:"prompt_cache_hit_tokens"`
}

// ChatCompletionRequest 请求体格式（公开类型用于测试兼容）。
type ChatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream"`
	Tools       []Tool    `json:"tools,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

// Tool 工具定义格式（公开类型用于测试兼容）。
type Tool struct {
	Type     string   `json:"type"`
	Function Function `json:"function"`
}

// Function 函数定义格式（公开类型用于测试兼容）。
type Function struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// Client DeepSeek API客户端，实现provider.Provider接口。
type Client struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

// New 创建新的DeepSeek客户端（Provider工厂函数）。
func New(config map[string]interface{}) (provider.Provider, error) {
	apiKey, _ := config["api_key"].(string)
	if apiKey == "" {
		return nil, fmt.Errorf("deepseek: 缺少api_key配置")
	}
	modelName, _ := config["model"].(string)
	if modelName == "" {
		modelName = defaultModel
	}
	return &Client{
		apiKey:  apiKey,
		baseURL: defaultBaseURL,
		model:   modelName,
		client:  &http.Client{},
	}, nil
}

// NewClient 创建新的DeepSeek客户端（旧API兼容，用于测试）。
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: defaultBaseURL,
		model:   defaultModel,
		client:  &http.Client{},
	}
}

// WithBaseURL 设置自定义base URL（旧API兼容，用于测试）。
func (c *Client) WithBaseURL(url string) *Client {
	c.baseURL = url
	return c
}

// WithModel 设置模型名（旧API兼容，用于测试）。
func (c *Client) WithModel(model string) *Client {
	c.model = model
	return c
}

// Name 返回Provider名称。
func (c *Client) Name() string {
	return "deepseek"
}

// Supports 返回该Provider的能力支持情况。
func (c *Client) Supports() provider.Capability {
	return provider.Capability{
		Reasoning: true,
		Tools:     true,
		Vision:    false,
	}
}

// CacheStrategy 返回该Provider的缓存策略。
// DeepSeek使用精确前缀匹配缓存，缓存命中token享受1折优惠，最小前缀长度2048。
func (c *Client) CacheStrategy() provider.CacheStrategyInfo {
	return provider.CacheStrategyInfo{
		Type:               provider.CacheExactPrefix,
		CacheDiscountRatio: 0.1,
		MinPrefixLength:    2048,
		DynamicIsolation:   false,
	}
}

// BuildRequest 构建HTTP请求（旧API兼容，用于测试）。
func (c *Client) BuildRequest(req *ChatCompletionRequest) (*http.Request, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/chat/completions", c.baseURL)
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	return httpReq, nil
}

// ParseStreamChunk 解析SSE行（旧API兼容，用于测试）。
func (c *Client) ParseStreamChunk(line string) (*StreamChunk, error) {
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "data: ") {
		return nil, nil
	}
	data := strings.TrimPrefix(line, "data: ")
	if data == "[DONE]" {
		return nil, nil
	}
	var chunk StreamChunk
	if err := json.Unmarshal([]byte(data), &chunk); err != nil {
		return nil, err
	}
	return &chunk, nil
}

// ChatStream 发起流式聊天（旧API兼容，用于测试）。
func (c *Client) ChatStream(req *ChatCompletionRequest) (<-chan *StreamChunk, <-chan error, error) {
	req.Stream = true
	httpReq, err := c.BuildRequest(req)
	if err != nil {
		return nil, nil, err
	}
	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, nil, err
	}
	chunks := make(chan *StreamChunk)
	errs := make(chan error, 1)
	go func() {
		defer resp.Body.Close()
		defer close(chunks)
		defer close(errs)
		reader := bufio.NewReader(resp.Body)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					errs <- err
				}
				return
			}
			chunk, err := c.ParseStreamChunk(line)
			if err != nil {
				errs <- err
				return
			}
			if chunk != nil {
				chunks <- chunk
			}
		}
	}()
	return chunks, errs, nil
}

// Stream 发起流式聊天请求（Provider接口方法）。
func (c *Client) Stream(ctx context.Context, req *provider.ChatRequest) (<-chan *provider.Chunk, error) {
	apiReq := c.convertProviderRequest(req)
	body, err := json.Marshal(apiReq)
	if err != nil {
		return nil, fmt.Errorf("deepseek: 序列化请求失败: %w", err)
	}

	url := fmt.Sprintf("%s/chat/completions", c.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("deepseek: 创建请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("deepseek: 请求失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("deepseek: API返回错误 %d: %s", resp.StatusCode, string(respBody))
	}

	chunks := make(chan *provider.Chunk, 64)
	go func() {
		defer resp.Body.Close()
		defer close(chunks)
		c.readStream(ctx, resp.Body, chunks)
	}()

	return chunks, nil
}

// convertProviderRequest 将统一ChatRequest转换为DeepSeek API格式。
func (c *Client) convertProviderRequest(req *provider.ChatRequest) *ChatCompletionRequest {
	messages := make([]Message, len(req.Messages))
	for i, m := range req.Messages {
		messages[i] = Message{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
		}
	}

	var tools []Tool
	if len(req.Tools) > 0 {
		tools = make([]Tool, len(req.Tools))
		for i, t := range req.Tools {
			params, _ := t.Function.Parameters.(map[string]interface{})
			tools[i] = Tool{
				Type: t.Type,
				Function: Function{
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

	return &ChatCompletionRequest{
		Model:    apiModel,
		Messages: messages,
		Stream:   true,
		Tools:    tools,
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

		chunk, err := c.ParseStreamChunk(line)
		if err != nil {
			chunks <- &provider.Chunk{
				Type:  provider.ChunkError,
				Error: fmt.Sprintf("解析响应失败: %v", err),
			}
			return
		}
		if chunk == nil {
			continue
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
				CachedTokens:     chunk.Usage.CacheHitTokens,
			}
		}
	}
}

// init 注册DeepSeek Provider工厂。
func init() {
	provider.Register("deepseek", New)
}
