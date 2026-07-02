// Package provider 定义模型提供者接口和注册表。
// 所有模型（DeepSeek/豆包/OpenAI等）通过实现Provider接口接入系统。
package provider

import (
	"context"
)

// Message 表示对话中的一条消息。
type Message struct {
	Role       string `json:"role"`
	Content    string `json:"content"`
	ToolCallID string `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

// ToolCall 表示模型发起的工具调用。
type ToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function FunctionCall `json:"function"`
}

// FunctionCall 表示函数调用的名称和参数。
type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// ToolDef 描述一个可供模型调用的工具。
type ToolDef struct {
	Type     string   `json:"type"`
	Function FunctionDef `json:"function"`
}

// FunctionDef 描述工具函数的Schema。
type FunctionDef struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters"`
}

// Chunk 表示流式响应中的一个数据块。
type Chunk struct {
	Type           ChunkType `json:"type"`
	Content        string    `json:"content,omitempty"`
	ToolCallIndex  int       `json:"tool_call_index,omitempty"`
	ToolCallID     string    `json:"tool_call_id,omitempty"`
	ToolCallName   string    `json:"tool_call_name,omitempty"`
	ToolCallArgs   string    `json:"tool_call_args,omitempty"`
	FinishReason   string    `json:"finish_reason,omitempty"`
	PromptTokens   int       `json:"prompt_tokens,omitempty"`
	CompletionTokens int     `json:"completion_tokens,omitempty"`
	CachedTokens   int       `json:"cached_tokens,omitempty"`
	Error          string    `json:"error,omitempty"`
}

// ChunkType 流式数据块类型。
type ChunkType string

const (
	ChunkContent    ChunkType = "content"
	ChunkToolCall   ChunkType = "tool_call"
	ChunkUsage      ChunkType = "usage"
	ChunkFinish     ChunkType = "finish"
	ChunkError      ChunkType = "error"
)

// ChatRequest 统一的聊天请求格式。
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Tools       []ToolDef `json:"tools,omitempty"`
	Stream      bool      `json:"stream"`
	Temperature *float32  `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Extra       map[string]interface{} `json:"extra,omitempty"`
}

// CacheStrategyInfo 描述Provider的缓存策略。
type CacheStrategyInfo struct {
	Type               CacheType `json:"type"`
	CacheDiscountRatio float64   `json:"cache_discount_ratio"`
	MinPrefixLength    int       `json:"min_prefix_length"`
	DynamicIsolation   bool      `json:"dynamic_isolation"`
}

// CacheType 缓存类型。
type CacheType string

const (
	CacheExactPrefix   CacheType = "exact_prefix"
	CacheTransparent   CacheType = "transparent"
	CacheHierarchical  CacheType = "hierarchical"
	CacheMultiBreak    CacheType = "multi_breakpoint"
	CacheNone          CacheType = "none"
)

// Capability 描述模型能力支持情况。
type Capability struct {
	Reasoning bool `json:"reasoning"`
	Tools     bool `json:"tools"`
	Vision    bool `json:"vision"`
}

// Provider 是所有模型提供者必须实现的接口。
type Provider interface {
	// Name 返回Provider名称（如"deepseek"、"volcengine"）。
	Name() string
	// Stream 发起流式聊天请求，通过channel返回数据块。
	Stream(ctx context.Context, req *ChatRequest) (<-chan *Chunk, error)
	// CacheStrategy 返回该Provider的缓存策略信息。
	CacheStrategy() CacheStrategyInfo
	// Supports 返回该Provider的能力支持情况。
	Supports() Capability
}

// Factory 是Provider工厂函数类型。
type Factory func(config map[string]interface{}) (Provider, error)

var registry = make(map[string]Factory)

// Register 注册一个Provider工厂。
func Register(name string, factory Factory) {
	registry[name] = factory
}

// Create 根据名称和配置创建Provider实例。
func Create(name string, config map[string]interface{}) (Provider, error) {
	factory, ok := registry[name]
	if !ok {
		return nil, &ProviderNotFoundError{Name: name}
	}
	return factory(config)
}

// List 返回所有已注册的Provider名称。
func List() []string {
	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	return names
}

// ProviderNotFoundError 表示请求的Provider未注册。
type ProviderNotFoundError struct {
	Name string
}

func (e *ProviderNotFoundError) Error() string {
	return "provider not found: " + e.Name
}
