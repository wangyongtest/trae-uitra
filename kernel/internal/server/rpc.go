// Package server 实现stdio JSON-RPC服务器。
// 通过stdin读取JSON行请求，stdout写JSON行响应。
// 支持流式事件推送。
package server

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"sync"
	"time"

	"github.com/trae-ultra/kernel/internal/cache"
	"github.com/trae-ultra/kernel/internal/config"
	"github.com/trae-ultra/kernel/internal/model"
	"github.com/trae-ultra/kernel/internal/provider"
	"github.com/trae-ultra/kernel/internal/stats"
)

// JSON-RPC 2.0 标准错误码
const (
	ParseError     = -32700
	InvalidRequest = -32600
	MethodNotFound = -32601
	InvalidParams  = -32602
	InternalError  = -32603
	RequestAborted = -32800
)

// Request 表示一个JSON-RPC请求。
type Request struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id"`
	Method  string           `json:"method"`
	Params  json.RawMessage  `json:"params"`
}

// Response 表示一个JSON-RPC响应。
type Response struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id"`
	Result  interface{}      `json:"result,omitempty"`
	Error   *RPCError        `json:"error,omitempty"`
}

// RPCError 表示JSON-RPC错误。
type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Error 实现error接口。
func (e *RPCError) Error() string {
	return fmt.Sprintf("rpc error %d: %s", e.Code, e.Message)
}

// StreamEvent 表示流式事件推送。
type StreamEvent struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  struct {
		RequestID string          `json:"request_id"`
		Chunk     json.RawMessage `json:"chunk"`
	} `json:"params"`
}

// ChatSendParams chat.send方法参数。
type ChatSendParams struct {
	RequestID  string             `json:"request_id"`
	Model      string             `json:"model"`
	Messages   []provider.Message `json:"messages"`
	Tools      []provider.ToolDef `json:"tools,omitempty"`
	Temperature *float32          `json:"temperature,omitempty"`
	MaxTokens  int                `json:"max_tokens,omitempty"`
}

// ChatAbortParams chat.abort方法参数。
type ChatAbortParams struct {
	RequestID string `json:"request_id"`
}

// ProviderTestParams provider.test_connection方法参数。
type ProviderTestParams struct {
	Provider string `json:"provider"`
	Model    string `json:"model,omitempty"`
}

// Server JSON-RPC服务器实例。
type Server struct {
	config      *config.Config
	cacheMonitor *cache.Monitor
	costCalc    *stats.CostCalculator
	logger      *log.Logger

	mu          sync.Mutex
	out         *json.Encoder
	cancels     map[string]context.CancelFunc
	providers   map[string]provider.Provider
}

// New 创建新的JSON-RPC服务器。
func New(cfg *config.Config, cacheMon *cache.Monitor, costCalc *stats.CostCalculator, logger *log.Logger) *Server {
	if logger == nil {
		logger = log.New(os.Stderr, "[kernel] ", log.LstdFlags)
	}

	s := &Server{
		config:       cfg,
		cacheMonitor: cacheMon,
		costCalc:     costCalc,
		logger:       logger,
		cancels:      make(map[string]context.CancelFunc),
		providers:    make(map[string]provider.Provider),
	}

	s.initProviders()
	return s
}

// initProviders 初始化所有配置的Provider。
func (s *Server) initProviders() {
	// 导入provider包会触发init()注册工厂
	// 这里只创建有API Key的Provider
	for _, providerName := range provider.List() {
		apiKey := s.config.GetAPIKey(providerName)
		if apiKey == "" {
			s.logger.Printf("Provider %s 未配置API Key，跳过", providerName)
			continue
		}

		p, err := provider.Create(providerName, map[string]interface{}{
			"api_key": apiKey,
		})
		if err != nil {
			s.logger.Printf("初始化Provider %s 失败: %v", providerName, err)
			continue
		}
		s.providers[providerName] = p
		s.logger.Printf("Provider %s 初始化成功", providerName)
	}
}

// Run 启动服务器，从r读取请求，写到w。
func (s *Server) Run(r io.Reader, w io.Writer) error {
	s.mu.Lock()
	s.out = json.NewEncoder(w)
	s.mu.Unlock()

	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024*10)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		go s.handleLine(line)
	}

	if err := scanner.Err(); err != nil {
		s.logger.Printf("读取输入错误: %v", err)
		return err
	}

	return nil
}

// handleLine 处理单条JSON行。
func (s *Server) handleLine(line []byte) {
	var req Request
	if err := json.Unmarshal(line, &req); err != nil {
		s.writeError(nil, ParseError, "解析JSON失败: "+err.Error())
		return
	}

	if req.JSONRPC != "2.0" {
		s.writeError(req.ID, InvalidRequest, "仅支持JSON-RPC 2.0")
		return
	}

	s.dispatch(&req)
}

// dispatch 分发请求到对应处理方法。
func (s *Server) dispatch(req *Request) {
	switch req.Method {
	case "chat.send":
		s.handleChatSend(req)
	case "chat.abort":
		s.handleChatAbort(req)
	case "cache.get_stats":
		s.handleCacheGetStats(req)
	case "stats.get_cost":
		s.handleStatsGetCost(req)
	case "config.get_models":
		s.handleConfigGetModels(req)
	case "provider.test_connection":
		s.handleProviderTestConnection(req)
	case "system.ping":
		s.handleSystemPing(req)
	default:
		s.writeError(req.ID, MethodNotFound, "未知方法: "+req.Method)
	}
}

// handleChatSend 处理chat.send请求 - 发送聊天消息并流式返回。
func (s *Server) handleChatSend(req *Request) {
	var params ChatSendParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.writeError(req.ID, InvalidParams, "参数解析失败: "+err.Error())
		return
	}

	if params.RequestID == "" {
		s.writeError(req.ID, InvalidParams, "缺少request_id参数")
		return
	}
	if len(params.Messages) == 0 {
		s.writeError(req.ID, InvalidParams, "messages不能为空")
		return
	}

	modelID := params.Model
	if modelID == "" {
		modelID = s.config.DefaultModel
	}
	m := model.GetModel(modelID)
	if m == nil {
		s.writeError(req.ID, InvalidParams, "未知模型: "+modelID)
		return
	}

	p, ok := s.providers[m.ProviderName]
	if !ok {
		s.writeError(req.ID, InternalError, "Provider未初始化: "+m.ProviderName)
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.cancels[params.RequestID] = cancel
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.cancels, params.RequestID)
		s.mu.Unlock()
		cancel()
	}()

	chatReq := &provider.ChatRequest{
		Model:       m.ProviderModelID,
		Messages:    params.Messages,
		Tools:       params.Tools,
		Stream:      true,
		Temperature: params.Temperature,
		MaxTokens:   params.MaxTokens,
	}

	chunks, err := p.Stream(ctx, chatReq)
	if err != nil {
		s.writeError(req.ID, InternalError, "请求失败: "+err.Error())
		return
	}

	s.writeResult(req.ID, map[string]interface{}{
		"status":     "streaming",
		"request_id": params.RequestID,
		"model":      modelID,
	})

	var (
		promptTokens     int
		completionTokens int
		cachedTokens     int
	)

	for chunk := range chunks {
		chunkJSON, _ := json.Marshal(chunk)
		s.sendStreamEvent(params.RequestID, chunkJSON)

		switch chunk.Type {
		case provider.ChunkUsage:
			promptTokens = chunk.PromptTokens
			completionTokens = chunk.CompletionTokens
			cachedTokens = chunk.CachedTokens
		case provider.ChunkError:
			s.logger.Printf("请求 %s 流错误: %s", params.RequestID, chunk.Error)
		}
	}

	hitRate := s.cacheMonitor.HitRate()
	if promptTokens > 0 {
		s.cacheMonitor.RecordTokens(promptTokens, cachedTokens)
		cost := s.costCalc.CalculateCost(modelID, stats.ModelUsage{
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			CacheHitTokens:   cachedTokens,
		}, hitRate)
		s.logger.Printf("请求 %s 完成: prompt=%d, completion=%d, cached=%d, cost=$%.6f",
			params.RequestID, promptTokens, completionTokens, cachedTokens, cost)
	}
}

// handleChatAbort 处理chat.abort请求 - 中止当前请求。
func (s *Server) handleChatAbort(req *Request) {
	var params ChatAbortParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.writeError(req.ID, InvalidParams, "参数解析失败: "+err.Error())
		return
	}

	s.mu.Lock()
	cancel, ok := s.cancels[params.RequestID]
	s.mu.Unlock()

	if !ok {
		s.writeError(req.ID, InvalidParams, "未找到请求: "+params.RequestID)
		return
	}

	cancel()
	s.writeResult(req.ID, map[string]interface{}{
		"aborted":    true,
		"request_id": params.RequestID,
	})
	s.logger.Printf("请求 %s 已中止", params.RequestID)
}

// handleCacheGetStats 处理cache.get_stats请求 - 获取缓存命中统计。
func (s *Server) handleCacheGetStats(req *Request) {
	snapshot := s.cacheMonitor.Snapshot()
	s.writeResult(req.ID, map[string]interface{}{
		"hit_rate":     s.cacheMonitor.HitRate(),
		"status":       s.cacheMonitor.Status(),
		"history":      snapshot.History,
		"session_size": len(snapshot.History),
	})
}

// handleStatsGetCost 处理stats.get_cost请求 - 获取费用统计。
func (s *Server) handleStatsGetCost(req *Request) {
	s.writeResult(req.ID, map[string]interface{}{
		"total_cost":  s.costCalc.TotalCost(),
		"budget_usd":  s.config.BudgetUSD,
		"remaining":   s.config.BudgetUSD - s.costCalc.TotalCost(),
	})
}

// handleConfigGetModels 处理config.get_models请求 - 获取可用模型列表。
func (s *Server) handleConfigGetModels(req *Request) {
	models := model.ListModels()
	result := make([]map[string]interface{}, 0, len(models))
	for _, m := range models {
		p, hasProvider := s.providers[m.ProviderName]
		capabilities := m.Capabilities
		if hasProvider {
			capabilities = p.Supports()
		}
		result = append(result, map[string]interface{}{
			"id":             m.ID,
			"display_name":   m.DisplayName,
			"provider":       m.ProviderName,
			"pricing":        m.Pricing,
			"capabilities":   capabilities,
			"supports_cache": m.SupportsCache,
			"available":      hasProvider,
		})
	}
	s.writeResult(req.ID, map[string]interface{}{
		"models":       result,
		"default":      s.config.DefaultModel,
	})
}

// handleProviderTestConnection 处理provider.test_connection请求 - 测试模型连接。
func (s *Server) handleProviderTestConnection(req *Request) {
	var params ProviderTestParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		s.writeError(req.ID, InvalidParams, "参数解析失败: "+err.Error())
		return
	}

	if params.Provider == "" {
		s.writeError(req.ID, InvalidParams, "缺少provider参数")
		return
	}

	p, ok := s.providers[params.Provider]
	if !ok {
		s.writeResult(req.ID, map[string]interface{}{
			"success": false,
			"error":   "Provider未配置或未初始化",
			"provider": params.Provider,
		})
		return
	}

	testModel := params.Model
	if testModel == "" {
		for _, m := range model.ListModels() {
			if m.ProviderName == params.Provider {
				testModel = m.ProviderModelID
				break
			}
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	chunks, err := p.Stream(ctx, &provider.ChatRequest{
		Model: testModel,
		Messages: []provider.Message{
			{Role: "user", Content: "ping"},
		},
		Stream: true,
	})

	success := err == nil
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	} else {
		go func() {
			for range chunks {
			}
		}()
	}

	s.writeResult(req.ID, map[string]interface{}{
		"success":  success,
		"error":    errMsg,
		"provider": params.Provider,
		"model":    testModel,
	})
}

// handleSystemPing 处理system.ping请求 - 心跳检测。
func (s *Server) handleSystemPing(req *Request) {
	s.writeResult(req.ID, map[string]interface{}{
		"pong": true,
		"time": time.Now().UnixMilli(),
	})
}

// writeResult 写入成功响应。
func (s *Server) writeResult(id *json.RawMessage, result interface{}) {
	s.writeResponse(&Response{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	})
}

// writeError 写入错误响应。
func (s *Server) writeError(id *json.RawMessage, code int, message string) {
	s.writeResponse(&Response{
		JSONRPC: "2.0",
		ID:      id,
		Error: &RPCError{
			Code:    code,
			Message: message,
		},
	})
}

// sendStreamEvent 发送流式事件。
func (s *Server) sendStreamEvent(requestID string, chunk json.RawMessage) {
	event := &StreamEvent{
		JSONRPC: "2.0",
		Method:  "stream.event",
	}
	event.Params.RequestID = requestID
	event.Params.Chunk = chunk

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.out != nil {
		if err := s.out.Encode(event); err != nil {
			s.logger.Printf("写入流事件失败: %v", err)
		}
	}
}

// writeResponse 线程安全地写入响应。
func (s *Server) writeResponse(resp *Response) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.out != nil {
		if err := s.out.Encode(resp); err != nil {
			s.logger.Printf("写入响应失败: %v", err)
		}
	}
}
