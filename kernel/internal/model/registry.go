// Package model 提供模型注册表管理。
// 预注册所有支持的模型，提供查询和列表功能。
package model

import (
	"github.com/trae-ultra/kernel/internal/provider"
)

// Pricing 模型定价信息（单位：美元/百万token）。
type Pricing struct {
	InputPerMillion  float64 `json:"input_per_million"`
	OutputPerMillion float64 `json:"output_per_million"`
	CacheHitRatio    float64 `json:"cache_hit_ratio"`
}

// Model 描述一个可用模型的完整信息。
type Model struct {
	ID               string             `json:"id"`
	DisplayName      string             `json:"display_name"`
	ProviderName     string             `json:"provider_name"`
	ProviderModelID  string             `json:"provider_model_id"`
	Pricing          Pricing            `json:"pricing"`
	Capabilities     provider.Capability `json:"capabilities"`
	SupportsCache    bool               `json:"supports_cache"`
}

var (
	registry map[string]*Model
)

func init() {
	registry = make(map[string]*Model)
	registerDefaultModels()
}

// registerDefaultModels 注册所有预定义模型。
func registerDefaultModels() {
	Register(&Model{
		ID:              "deepseek-v4-flash",
		DisplayName:     "DeepSeek V4 Flash",
		ProviderName:    "deepseek",
		ProviderModelID: "deepseek-chat",
		Pricing: Pricing{
			InputPerMillion:  0.1,
			OutputPerMillion: 0.3,
			CacheHitRatio:    0.1,
		},
		Capabilities: provider.Capability{
			Reasoning: true,
			Tools:     true,
			Vision:    false,
		},
		SupportsCache: true,
	})

	Register(&Model{
		ID:              "deepseek-v4-pro",
		DisplayName:     "DeepSeek V4 Pro",
		ProviderName:    "deepseek",
		ProviderModelID: "deepseek-reasoner",
		Pricing: Pricing{
			InputPerMillion:  2.0,
			OutputPerMillion: 8.0,
			CacheHitRatio:    0.1,
		},
		Capabilities: provider.Capability{
			Reasoning: true,
			Tools:     true,
			Vision:    false,
		},
		SupportsCache: true,
	})

	Register(&Model{
		ID:              "doubao-1.6-flash",
		DisplayName:     "豆包 1.6 Flash",
		ProviderName:    "volcengine",
		ProviderModelID: "ep-20250219183336-rp54g",
		Pricing: Pricing{
			InputPerMillion:  0.08,
			OutputPerMillion: 0.2,
			CacheHitRatio:    0.1,
		},
		Capabilities: provider.Capability{
			Reasoning: true,
			Tools:     true,
			Vision:    true,
		},
		SupportsCache: true,
	})

	Register(&Model{
		ID:              "doubao-1.6",
		DisplayName:     "豆包 1.6 Pro",
		ProviderName:    "volcengine",
		ProviderModelID: "ep-20250219183424-qld28",
		Pricing: Pricing{
			InputPerMillion:  0.5,
			OutputPerMillion: 2.0,
			CacheHitRatio:    0.1,
		},
		Capabilities: provider.Capability{
			Reasoning: true,
			Tools:     true,
			Vision:    true,
		},
		SupportsCache: true,
	})
}

// Register 注册一个模型到注册表。
func Register(m *Model) {
	registry[m.ID] = m
}

// GetModel 根据ID获取模型。
func GetModel(id string) *Model {
	return registry[id]
}

// ListModels 返回所有已注册模型的列表。
func ListModels() []*Model {
	models := make([]*Model, 0, len(registry))
	for _, m := range registry {
		models = append(models, m)
	}
	return models
}
