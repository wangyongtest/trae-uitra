package deepseek

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeepSeek_BuildRequest_CorrectEndpoint(t *testing.T) {
	// 测试目的：验证构建的HTTP请求使用正确的API endpoint
	// 场景：创建client后构建请求，URL应为baseURL + /chat/completions
	client := NewClient("test-api-key")
	req := &ChatCompletionRequest{
		Model: "deepseek-chat",
		Messages: []Message{
			{Role: "user", Content: "Hello"},
		},
		Stream: false,
	}
	httpReq, err := client.BuildRequest(req)
	if err != nil {
		t.Fatalf("构建请求失败: %v", err)
	}
	expectedURL := "https://api.deepseek.com/chat/completions"
	if httpReq.URL.String() != expectedURL {
		t.Errorf("期望endpoint为%s，实际为%s", expectedURL, httpReq.URL.String())
	}
	if httpReq.Method != "POST" {
		t.Errorf("期望请求方法为POST，实际为%s", httpReq.Method)
	}
}

func TestDeepSeek_BuildRequest_IncludesAPIKey(t *testing.T) {
	// 测试目的：验证请求正确设置Authorization header包含API Key
	// 场景：构建的请求Header中应包含Bearer token格式的API Key
	apiKey := "sk-test-12345"
	client := NewClient(apiKey)
	req := &ChatCompletionRequest{
		Model:    "deepseek-chat",
		Messages: []Message{{Role: "user", Content: "Hi"}},
	}
	httpReq, err := client.BuildRequest(req)
	if err != nil {
		t.Fatalf("构建请求失败: %v", err)
	}
	authHeader := httpReq.Header.Get("Authorization")
	expectedAuth := "Bearer " + apiKey
	if authHeader != expectedAuth {
		t.Errorf("期望Authorization header为%s，实际为%s", expectedAuth, authHeader)
	}
	contentType := httpReq.Header.Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("期望Content-Type为application/json，实际为%s", contentType)
	}
}

func TestDeepSeek_ParseStreamChunk_ToolCall(t *testing.T) {
	// 测试目的：验证能够正确解析流式响应中的tool_call chunk
	// 场景：包含tool_calls字段的SSE数据行，应正确解析出函数名称和参数
	client := NewClient("test-key")
	chunkJSON := `{
		"choices": [{
			"delta": {
				"tool_calls": [{
					"index": 0,
					"id": "call_abc123",
					"type": "function",
					"function": {
						"name": "get_weather",
						"arguments": "{\"city\":\"Beijing\"}"
					}
				}]
			}
		}]
	}`
	line := "data: " + chunkJSON
	chunk, err := client.ParseStreamChunk(line)
	if err != nil {
		t.Fatalf("解析chunk失败: %v", err)
	}
	if chunk == nil {
		t.Fatal("期望解析出chunk，实际为nil")
	}
	if len(chunk.Choices) == 0 {
		t.Fatal("期望至少有一个choice")
	}
	if len(chunk.Choices[0].Delta.ToolCalls) == 0 {
		t.Fatal("期望有tool_call")
	}
	toolCall := chunk.Choices[0].Delta.ToolCalls[0]
	if toolCall.Function.Name != "get_weather" {
		t.Errorf("期望函数名为get_weather，实际为%s", toolCall.Function.Name)
	}
	var args map[string]string
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		t.Errorf("函数参数解析失败: %v", err)
	}
	if args["city"] != "Beijing" {
		t.Errorf("期望参数city为Beijing，实际为%s", args["city"])
	}
}

func TestDeepSeek_ParseStreamChunk_Usage(t *testing.T) {
	// 测试目的：验证能够正确解析usage中的cache_hit_tokens字段
	// 场景：最后一个chunk包含usage信息，其中prompt_cache_hit_tokens应正确解析
	client := NewClient("test-key")
	chunkJSON := `{
		"choices": [{"delta": {}}],
		"usage": {
			"prompt_tokens": 1000,
			"completion_tokens": 100,
			"total_tokens": 1100,
			"prompt_cache_hit_tokens": 950
		}
	}`
	line := "data: " + chunkJSON
	chunk, err := client.ParseStreamChunk(line)
	if err != nil {
		t.Fatalf("解析chunk失败: %v", err)
	}
	if chunk == nil {
		t.Fatal("期望解析出chunk，实际为nil")
	}
	if chunk.Usage == nil {
		t.Fatal("期望有usage信息，实际为nil")
	}
	if chunk.Usage.CacheHitTokens != 950 {
		t.Errorf("期望cache_hit_tokens为950，实际为%d", chunk.Usage.CacheHitTokens)
	}
	if chunk.Usage.PromptTokens != 1000 {
		t.Errorf("期望prompt_tokens为1000，实际为%d", chunk.Usage.PromptTokens)
	}
}

func TestDeepSeek_WithHTTPServer(t *testing.T) {
	// 测试目的：验证使用httptest.Server模拟API时请求能正确发送
	// 场景：启动一个测试服务器，验证client能正确发送POST请求
	received := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = true
		if r.Method != "POST" {
			t.Errorf("测试服务器收到非POST请求: %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("Authorization header不正确")
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`data: {"choices":[{"delta":{"content":"Hi"}}]}` + "\n\n"))
	}))
	defer server.Close()
	client := NewClient("test-key").WithBaseURL(server.URL)
	req := &ChatCompletionRequest{
		Model:    "deepseek-chat",
		Messages: []Message{{Role: "user", Content: "Hello"}},
	}
	httpReq, err := client.BuildRequest(req)
	if err != nil {
		t.Fatalf("构建请求失败: %v", err)
	}
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		t.Fatalf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()
	if !received {
		t.Error("测试服务器未收到请求")
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("期望状态码200，实际为%d", resp.StatusCode)
	}
}
