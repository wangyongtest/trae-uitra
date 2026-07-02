package stats

import (
	"math"
	"testing"
)

func TestCostCalculator_DeepSeekFlash_HighHitRate(t *testing.T) {
	// 测试目的：验证DeepSeek V4-Flash在95%高命中率下费用计算正确
	// 场景：1M输入token（95%缓存命中）+ 100K输出token
	// 输入成本：50K正常输入 * $0.1/M + 950K缓存命中 * $0.1/M * 0.1
	// 输出成本：100K * $0.3/M
	cc := NewCostCalculator()
	usage := ModelUsage{
		PromptTokens:     1_000_000,
		CompletionTokens: 100_000,
	}
	hitRate := 0.95
	cost := cc.CalculateCost("deepseek-v4-flash", usage, hitRate)
	// 计算期望费用
	normalInput := 50_000.0
	cacheHit := 950_000.0
	expectedInput := (normalInput/1_000_000)*0.1 + (cacheHit/1_000_000)*0.1*0.1
	expectedOutput := (100_000.0 / 1_000_000) * 0.3
	expected := expectedInput + expectedOutput
	if math.Abs(cost-expected) > 0.0001 {
		t.Errorf("DeepSeek Flash高命中率费用计算不正确：期望%f，实际%f", expected, cost)
	}
}

func TestCostCalculator_DeepSeekPro_CalculatesCost(t *testing.T) {
	// 测试目的：验证DeepSeek V4-Pro费用计算正确
	// 场景：500K输入（无缓存命中）+ 50K输出
	cc := NewCostCalculator()
	usage := ModelUsage{
		PromptTokens:     500_000,
		CompletionTokens: 50_000,
	}
	hitRate := 0.0
	cost := cc.CalculateCost("deepseek-v4-pro", usage, hitRate)
	expectedInput := (500_000.0 / 1_000_000) * 2.0
	expectedOutput := (50_000.0 / 1_000_000) * 8.0
	expected := expectedInput + expectedOutput
	if math.Abs(cost-expected) > 0.0001 {
		t.Errorf("DeepSeek Pro费用计算不正确：期望%f，实际%f", expected, cost)
	}
}

func TestCostCalculator_DoubaoFlash_CalculatesCost(t *testing.T) {
	// 测试目的：验证豆包Flash费用计算正确
	// 场景：2M输入（50%缓存命中）+ 200K输出
	cc := NewCostCalculator()
	usage := ModelUsage{
		PromptTokens:     2_000_000,
		CompletionTokens: 200_000,
	}
	hitRate := 0.5
	cost := cc.CalculateCost("doubao-flash", usage, hitRate)
	normalInput := 1_000_000.0
	cacheHit := 1_000_000.0
	expectedInput := (normalInput/1_000_000)*0.08 + (cacheHit/1_000_000)*0.08*0.1
	expectedOutput := (200_000.0 / 1_000_000) * 0.2
	expected := expectedInput + expectedOutput
	if math.Abs(cost-expected) > 0.0001 {
		t.Errorf("豆包Flash费用计算不正确：期望%f，实际%f", expected, cost)
	}
}

func TestCostCalculator_MultipleModels_TracksTotal(t *testing.T) {
	// 测试目的：验证多模型累计费用正确累加
	// 场景：依次调用Flash、Pro、Doubao三个模型，总费用应为三者之和
	cc := NewCostCalculator()
	usage := ModelUsage{
		PromptTokens:     100_000,
		CompletionTokens: 10_000,
	}
	cost1 := cc.CalculateCost("deepseek-v4-flash", usage, 0.0)
	cost2 := cc.CalculateCost("deepseek-v4-pro", usage, 0.0)
	cost3 := cc.CalculateCost("doubao-flash", usage, 0.0)
	expectedTotal := cost1 + cost2 + cost3
	total := cc.TotalCost()
	if math.Abs(total-expectedTotal) > 0.0001 {
		t.Errorf("多模型累计费用不正确：期望%f，实际%f", expectedTotal, total)
	}
}

func TestCostCalculator_BudgetAlert_TriggersAtThreshold(t *testing.T) {
	// 测试目的：验证达到预算阈值时触发告警
	// 场景：设置$1.0预算告警，累计费用超过$1.0时告警应被触发
	cc := NewCostCalculator()
	alert := cc.SetBudgetAlert(1.0)
	if alert.Triggered {
		t.Fatal("告警初始状态不应为触发")
	}
	// 产生约$2.0费用（1M输入+100K输出DeepSeek Pro）
	largeUsage := ModelUsage{
		PromptTokens:     1_000_000,
		CompletionTokens: 100_000,
	}
	cc.CalculateCost("deepseek-v4-pro", largeUsage, 0.0)
	if !alert.Triggered {
		t.Errorf("费用超过阈值后期望告警触发，当前费用: %f, 阈值: %f", alert.Current, alert.Threshold)
	}
}
