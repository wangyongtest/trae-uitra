package cache

import (
	"math"
	"testing"
)

func TestMonitor_NewSession_HitRateReturnsOne(t *testing.T) {
	// 测试目的：验证新创建的会话在没有任何token记录时，命中率返回1.0
	// 场景：新会话初始化后，无任何调用
	m := NewMonitor()
	m.NewSession()
	rate := m.HitRate()
	if rate != 1.0 {
		t.Errorf("期望新会话命中率为1.0，实际为%f", rate)
	}
}

func TestMonitor_RecordTokens_CalculatesHitRate(t *testing.T) {
	// 测试目的：验证记录token后命中率计算正确
	// 场景：100个prompt token中有90个命中，期望命中率0.9
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(100, 90)
	rate := m.HitRate()
	expected := 0.9
	if math.Abs(rate-expected) > 0.001 {
		t.Errorf("期望命中率为%f，实际为%f", expected, rate)
	}
}

func TestMonitor_RecordTokens_TracksMultipleRounds(t *testing.T) {
	// 测试目的：验证多轮对话累计统计正确
	// 场景：第一轮100 token命中95，第二轮200 token命中180，总命中率应为(95+180)/(100+200)=275/300≈0.9167
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(100, 95)
	m.RecordTokens(200, 180)
	rate := m.HitRate()
	expected := 275.0 / 300.0
	if math.Abs(rate-expected) > 0.001 {
		t.Errorf("期望累计命中率为%f，实际为%f", expected, rate)
	}
}

func TestMonitor_RecordTokens_HighHitRateShowsGreen(t *testing.T) {
	// 测试目的：验证95%以上命中率状态为green
	// 场景：100 token命中96，命中率96%，应为green状态
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(100, 96)
	status := m.Status()
	if status != StatusGreen {
		t.Errorf("期望高命中率状态为green，实际为%s", status)
	}
}

func TestMonitor_RecordTokens_MediumHitRateShowsYellow(t *testing.T) {
	// 测试目的：验证80-95%命中率状态为yellow
	// 场景：100 token命中85，命中率85%，应为yellow状态
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(100, 85)
	status := m.Status()
	if status != StatusYellow {
		t.Errorf("期望中等命中率状态为yellow，实际为%s", status)
	}
}

func TestMonitor_RecordTokens_LowHitRateShowsRed(t *testing.T) {
	// 测试目的：验证低于80%命中率状态为red
	// 场景：100 token命中70，命中率70%，应为red状态
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(100, 70)
	status := m.Status()
	if status != StatusRed {
		t.Errorf("期望低命中率状态为red，实际为%s", status)
	}
}

func TestMonitor_HitRate_NoPromptTokensReturnsOne(t *testing.T) {
	// 测试目的：验证零prompt token时返回1.0（避免除零错误）
	// 场景：记录0个prompt token，即使命中也为0，应返回1.0
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(0, 0)
	rate := m.HitRate()
	if rate != 1.0 {
		t.Errorf("期望零prompt时命中率为1.0，实际为%f", rate)
	}
}

func TestMonitor_Snapshot_StoresHistory(t *testing.T) {
	// 测试目的：验证快照功能正确记录历史数据
	// 场景：记录两轮数据后，快照应包含两轮记录且数据准确
	m := NewMonitor()
	m.NewSession()
	m.RecordTokens(100, 95)
	m.RecordTokens(200, 180)
	snapshot := m.Snapshot()
	if len(snapshot.History) != 2 {
		t.Fatalf("期望历史记录有2条，实际有%d条", len(snapshot.History))
	}
	if snapshot.History[0].PromptTokens != 100 || snapshot.History[0].HitTokens != 95 {
		t.Errorf("第一条记录不正确：prompt=%d, hit=%d", snapshot.History[0].PromptTokens, snapshot.History[0].HitTokens)
	}
	if snapshot.History[1].PromptTokens != 200 || snapshot.History[1].HitTokens != 180 {
		t.Errorf("第二条记录不正确：prompt=%d, hit=%d", snapshot.History[1].PromptTokens, snapshot.History[1].HitTokens)
	}
}
