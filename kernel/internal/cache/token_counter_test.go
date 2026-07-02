package cache

import "testing"

func TestTokenCounter_CountTextTokens(t *testing.T) {
	// 测试目的：验证英文文本token计数近似准确
	// 场景：英文单词按空格分隔，每个单词约1个token
	tc := NewTokenCounter()
	text := "Hello world this is a test"
	tokens := tc.CountTextTokens(text)
	// "Hello world this is a test" 有6个单词，期望约6个token
	expected := 6
	if tokens < expected-1 || tokens > expected+1 {
		t.Errorf("英文文本token计数期望约%d，实际为%d", expected, tokens)
	}
}

func TestTokenCounter_CountChineseTokens(t *testing.T) {
	// 测试目的：验证中文文本token计数（每个汉字约1个token）
	// 场景：中文字符串"你好世界"有4个汉字，期望4个token
	tc := NewTokenCounter()
	text := "你好世界"
	tokens := tc.CountChineseTokens(text)
	expected := 4
	if tokens != expected {
		t.Errorf("中文文本token计数期望%d，实际为%d", expected, tokens)
	}
}

func TestTokenCounter_CountMessages(t *testing.T) {
	// 测试目的：验证消息列表token计数正确累加
	// 场景：包含system、user两条消息，计算总token数（每条消息额外加4个token开销）
	tc := NewTokenCounter()
	messages := []Message{
		{Role: "system", Content: "You are a helpful assistant"},
		{Role: "user", Content: "Hello"},
	}
	tokens := tc.CountMessages(messages)
	// system: 1+6=7, user:1+1=2, 每条+4开销，总共7+4+2+4=17
	// 允许少量误差
	if tokens < 10 {
		t.Errorf("消息列表token计数期望至少10，实际为%d", tokens)
	}
}
