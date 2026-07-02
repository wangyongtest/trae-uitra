package cache

import "testing"

func TestDiagnostics_DetectDynamicContent(t *testing.T) {
	// 测试目的：验证能够检测工具结果中的时间戳等动态内容
	// 场景：包含ISO格式时间戳的内容，应被检测为timestamp类型
	d := NewDiagnostics()
	content := `Result generated at 2026-06-26T10:30:00. Data: {"value": 42}`
	results := d.DetectDynamicContent(content)
	if len(results) == 0 {
		t.Fatal("期望检测到动态内容，但未检测到")
	}
	found := false
	for _, r := range results {
		if r.Type == "timestamp" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("期望检测到timestamp类型，实际检测到: %v", results)
	}
}

func TestDiagnostics_DetectPrefixChange(t *testing.T) {
	// 测试目的：验证能够检测两个内容前缀的变化
	// 场景：两个前缀部分相同但有差异的字符串，应返回变化位置
	d := NewDiagnostics()
	oldContent := `{"status": "ok", "timestamp": "2026-06-26T10:00:00", "data": [...]}`
	newContent := `{"status": "ok", "timestamp": "2026-06-26T11:00:00", "data": [...]}`
	change := d.DetectPrefixChange(oldContent, newContent, 100)
	if change == nil {
		t.Fatal("期望检测到前缀变化，但未检测到")
	}
	if change.Position <= 0 {
		t.Errorf("期望变化位置大于0，实际为%d", change.Position)
	}
}

func TestDiagnostics_DetectPrefixChange_NoChange(t *testing.T) {
	// 测试目的：验证完全相同的前缀不返回变化
	// 场景：两个前缀完全相同的字符串
	d := NewDiagnostics()
	content := `{"status": "ok", "data": "static"}`
	change := d.DetectPrefixChange(content, content, 100)
	if change != nil {
		t.Error("期望无前缀变化，但检测到变化")
	}
}
