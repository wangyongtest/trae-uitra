package stats

import "sync"

type ModelPricing struct {
	InputPricePerMillion  float64
	OutputPricePerMillion float64
	CacheHitPriceRatio    float64
}

type ModelUsage struct {
	PromptTokens     int
	CompletionTokens int
	CacheHitTokens   int
}

type BudgetAlert struct {
	Threshold float64
	Current   float64
	Triggered bool
}

type CostCalculator struct {
	mu           sync.Mutex
	pricing      map[string]ModelPricing
	totalCost    float64
	budgetAlerts []*BudgetAlert
}

func NewCostCalculator() *CostCalculator {
	return &CostCalculator{
		pricing: map[string]ModelPricing{
			"deepseek-v4-flash": {
				InputPricePerMillion:  0.1,
				OutputPricePerMillion: 0.3,
				CacheHitPriceRatio:    0.1,
			},
			"deepseek-v4-pro": {
				InputPricePerMillion:  2.0,
				OutputPricePerMillion: 8.0,
				CacheHitPriceRatio:    0.1,
			},
			"doubao-flash": {
				InputPricePerMillion:  0.08,
				OutputPricePerMillion: 0.2,
				CacheHitPriceRatio:    0.1,
			},
			"doubao-1.6-flash": {
				InputPricePerMillion:  0.08,
				OutputPricePerMillion: 0.2,
				CacheHitPriceRatio:    0.1,
			},
			"doubao-1.6": {
				InputPricePerMillion:  0.5,
				OutputPricePerMillion: 2.0,
				CacheHitPriceRatio:    0.1,
			},
		},
		budgetAlerts: make([]*BudgetAlert, 0),
	}
}

func (cc *CostCalculator) CalculateCost(model string, usage ModelUsage, hitRate float64) float64 {
	pricing, ok := cc.pricing[model]
	if !ok {
		return 0
	}
	cacheHitTokens := float64(usage.PromptTokens) * hitRate
	normalInputTokens := float64(usage.PromptTokens) - cacheHitTokens
	inputCost := (normalInputTokens/1_000_000)*pricing.InputPricePerMillion +
		(cacheHitTokens/1_000_000)*pricing.InputPricePerMillion*pricing.CacheHitPriceRatio
	outputCost := (float64(usage.CompletionTokens) / 1_000_000) * pricing.OutputPricePerMillion
	total := inputCost + outputCost
	cc.mu.Lock()
	cc.totalCost += total
	cc.checkBudgetAlertsLocked()
	cc.mu.Unlock()
	return total
}

func (cc *CostCalculator) TotalCost() float64 {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	return cc.totalCost
}

func (cc *CostCalculator) SetBudgetAlert(threshold float64) *BudgetAlert {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	alert := &BudgetAlert{
		Threshold: threshold,
		Current:   cc.totalCost,
	}
	cc.budgetAlerts = append(cc.budgetAlerts, alert)
	return alert
}

func (cc *CostCalculator) checkBudgetAlertsLocked() {
	for _, alert := range cc.budgetAlerts {
		alert.Current = cc.totalCost
		if cc.totalCost >= alert.Threshold && !alert.Triggered {
			alert.Triggered = true
		}
	}
}

func (cc *CostCalculator) Reset() {
	cc.mu.Lock()
	defer cc.mu.Unlock()
	cc.totalCost = 0
	cc.budgetAlerts = make([]*BudgetAlert, 0)
}
