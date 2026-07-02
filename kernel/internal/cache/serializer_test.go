package cache

import "testing"

func TestSerializer_MarshalToolSchema_Deterministic(t *testing.T) {
	// 测试目的：验证相同输入两次序列化产生完全一致的字节序列（确定性序列化）
	// 场景：同一个ToolSchema对象连续序列化两次，结果字节必须完全相同
	s := NewSerializer()
	schema := &ToolSchema{
		Name:        "get_weather",
		Description: "Get weather information",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"city": map[string]interface{}{
					"type":        "string",
					"description": "City name",
				},
			},
		},
	}
	result1, err1 := s.MarshalToolSchema(schema)
	if err1 != nil {
		t.Fatalf("第一次序列化失败: %v", err1)
	}
	result2, err2 := s.MarshalToolSchema(schema)
	if err2 != nil {
		t.Fatalf("第二次序列化失败: %v", err2)
	}
	if string(result1) != string(result2) {
		t.Errorf("两次序列化结果不一致:\n第一次: %s\n第二次: %s", string(result1), string(result2))
	}
}

func TestSerializer_MarshalArgs_SortedKeys(t *testing.T) {
	// 测试目的：验证map参数序列化时key按字母序排列
	// 场景：传入无序key的map，序列化后key应按a-z顺序排列
	s := NewSerializer()
	args := map[string]interface{}{
		"zebra":  1,
		"apple":  2,
		"monkey": 3,
		"banana": 4,
	}
	result, err := s.MarshalArgs(args)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}
	str := string(result)
	// 检查"apple"出现在"banana"之前
	applePos := indexOf(str, "\"apple\"")
	bananaPos := indexOf(str, "\"banana\"")
	monkeyPos := indexOf(str, "\"monkey\"")
	zebraPos := indexOf(str, "\"zebra\"")
	if applePos == -1 || bananaPos == -1 || monkeyPos == -1 || zebraPos == -1 {
		t.Fatalf("序列化结果缺少key: %s", str)
	}
	if !(applePos < bananaPos && bananaPos < monkeyPos && monkeyPos < zebraPos) {
		t.Errorf("key未按字母序排列，结果: %s", str)
	}
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
