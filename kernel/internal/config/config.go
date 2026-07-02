// Package config 提供配置文件加载、保存和管理功能。
// 使用JSON格式配置文件，零第三方依赖。
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// UIConfig 窗口UI配置。
type UIConfig struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// ModelConfig 单个模型的配置项。
type ModelConfig struct {
	ID               string  `json:"id"`
	DisplayName      string  `json:"display_name"`
	Provider         string  `json:"provider"`
	ProviderModelID  string  `json:"provider_model_id"`
	InputPrice       float64 `json:"input_price"`
	OutputPrice      float64 `json:"output_price"`
	CacheHitRatio    float64 `json:"cache_hit_ratio"`
	SupportsCache    bool    `json:"supports_cache"`
	SupportsReasoning bool   `json:"supports_reasoning"`
	SupportsTools    bool    `json:"supports_tools"`
	SupportsVision   bool    `json:"supports_vision"`
}

// Config 全局配置结构。
type Config struct {
	APIKeys       map[string]string `json:"api_keys"`
	DefaultModel  string            `json:"default_model"`
	Models        []ModelConfig     `json:"models"`
	BudgetUSD     float64           `json:"budget_usd"`
	UI            UIConfig          `json:"ui"`
	ConfigPath    string            `json:"-"`
}

// DefaultConfig 返回默认配置。
func DefaultConfig() *Config {
	return &Config{
		APIKeys:      make(map[string]string),
		DefaultModel: "deepseek-v4-flash",
		Models: []ModelConfig{
			{
				ID:               "deepseek-v4-flash",
				DisplayName:      "DeepSeek V4 Flash",
				Provider:         "deepseek",
				ProviderModelID:  "deepseek-chat",
				InputPrice:       0.1,
				OutputPrice:      0.3,
				CacheHitRatio:    0.1,
				SupportsCache:    true,
				SupportsReasoning: true,
				SupportsTools:    true,
				SupportsVision:   false,
			},
			{
				ID:               "deepseek-v4-pro",
				DisplayName:      "DeepSeek V4 Pro",
				Provider:         "deepseek",
				ProviderModelID:  "deepseek-reasoner",
				InputPrice:       2.0,
				OutputPrice:      8.0,
				CacheHitRatio:    0.1,
				SupportsCache:    true,
				SupportsReasoning: true,
				SupportsTools:    true,
				SupportsVision:   false,
			},
			{
				ID:               "doubao-1.6-flash",
				DisplayName:      "豆包 1.6 Flash",
				Provider:         "volcengine",
				ProviderModelID:  "ep-20250219183336-rp54g",
				InputPrice:       0.08,
				OutputPrice:      0.2,
				CacheHitRatio:    0.1,
				SupportsCache:    true,
				SupportsReasoning: true,
				SupportsTools:    true,
				SupportsVision:   true,
			},
			{
				ID:               "doubao-1.6",
				DisplayName:      "豆包 1.6 Pro",
				Provider:         "volcengine",
				ProviderModelID:  "ep-20250219183424-qld28",
				InputPrice:       0.5,
				OutputPrice:      2.0,
				CacheHitRatio:    0.1,
				SupportsCache:    true,
				SupportsReasoning: true,
				SupportsTools:    true,
				SupportsVision:   true,
			},
		},
		BudgetUSD: 5.0,
		UI: UIConfig{
			Width:  1200,
			Height: 800,
		},
	}
}

// DefaultConfigPath 返回默认配置文件路径。
func DefaultConfigPath() string {
	var configDir string
	if runtime.GOOS == "windows" {
		appData := os.Getenv("APPDATA")
		if appData != "" {
			configDir = filepath.Join(appData, "trae-ultra")
		} else {
			home, _ := os.UserHomeDir()
			configDir = filepath.Join(home, ".trae-ultra")
		}
	} else {
		home, _ := os.UserHomeDir()
		configDir = filepath.Join(home, ".trae-ultra")
	}
	return filepath.Join(configDir, "config.json")
}

// Load 加载配置文件。
// 如果configPath为空，则使用默认路径。
// 如果配置文件不存在，创建默认配置并保存。
func Load(configPath string) (*Config, error) {
	if configPath == "" {
		configPath = DefaultConfigPath()
	}

	cfg := DefaultConfig()
	cfg.ConfigPath = configPath

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			if err := cfg.Save(); err != nil {
				return nil, fmt.Errorf("创建默认配置失败: %w", err)
			}
		} else {
			return nil, fmt.Errorf("读取配置文件失败: %w", err)
		}
	} else {
		if err := json.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("解析配置文件失败: %w", err)
		}
	}

	cfg.applyEnvOverrides()
	return cfg, nil
}

// applyEnvOverrides 从环境变量覆盖APIKey配置。
func (c *Config) applyEnvOverrides() {
	envKeys := map[string]string{
		"deepseek":   "DEEPSEEK_API_KEY",
		"volcengine": "VOLCENGINE_API_KEY",
	}

	for provider, envVar := range envKeys {
		if key := os.Getenv(envVar); key != "" {
			if c.APIKeys == nil {
				c.APIKeys = make(map[string]string)
			}
			c.APIKeys[provider] = key
		}
	}
}

// Save 保存配置到文件。
func (c *Config) Save() error {
	if c.ConfigPath == "" {
		c.ConfigPath = DefaultConfigPath()
	}

	dir := filepath.Dir(c.ConfigPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建配置目录失败: %w", err)
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	if err := os.WriteFile(c.ConfigPath, data, 0644); err != nil {
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	return nil
}

// GetAPIKey 获取指定Provider的API Key。
func (c *Config) GetAPIKey(provider string) string {
	if c.APIKeys == nil {
		return ""
	}
	return c.APIKeys[provider]
}

// GetModelConfig 根据模型ID获取模型配置。
func (c *Config) GetModelConfig(modelID string) *ModelConfig {
	for i := range c.Models {
		if c.Models[i].ID == modelID {
			return &c.Models[i]
		}
	}
	return nil
}
