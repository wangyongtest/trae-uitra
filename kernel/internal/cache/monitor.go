package cache

import "sync"

type HitRateStatus string

const (
	StatusGreen  HitRateStatus = "green"
	StatusYellow HitRateStatus = "yellow"
	StatusRed    HitRateStatus = "red"
)

type RoundStats struct {
	PromptTokens int
	HitTokens    int
}

type Snapshot struct {
	History []RoundStats
}

type Monitor struct {
	mu            sync.Mutex
	totalPrompt   int
	totalHit      int
	history       []RoundStats
}

func NewMonitor() *Monitor {
	return &Monitor{
		history: make([]RoundStats, 0),
	}
}

func (m *Monitor) NewSession() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.totalPrompt = 0
	m.totalHit = 0
	m.history = make([]RoundStats, 0)
}

func (m *Monitor) RecordTokens(promptTokens, hitTokens int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.totalPrompt += promptTokens
	m.totalHit += hitTokens
	m.history = append(m.history, RoundStats{
		PromptTokens: promptTokens,
		HitTokens:    hitTokens,
	})
}

func (m *Monitor) HitRate() float64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.totalPrompt == 0 {
		return 1.0
	}
	return float64(m.totalHit) / float64(m.totalPrompt)
}

func (m *Monitor) Status() HitRateStatus {
	rate := m.HitRate()
	switch {
	case rate >= 0.95:
		return StatusGreen
	case rate >= 0.80:
		return StatusYellow
	default:
		return StatusRed
	}
}

func (m *Monitor) Snapshot() Snapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	historyCopy := make([]RoundStats, len(m.history))
	copy(historyCopy, m.history)
	return Snapshot{History: historyCopy}
}
