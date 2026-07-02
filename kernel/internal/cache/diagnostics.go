package cache

import (
	"regexp"
)

type DynamicContent struct {
	Type    string
	Content string
}

type PrefixChange struct {
	Position     int
	OldPrefix    string
	NewPrefix    string
}

type Diagnostics struct{}

func NewDiagnostics() *Diagnostics {
	return &Diagnostics{}
}

var timestampPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`),
	regexp.MustCompile(`\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}`),
	regexp.MustCompile(`\d{10,13}`),
	regexp.MustCompile(`\d{2}:\d{2}:\d{2}`),
}

func (d *Diagnostics) DetectDynamicContent(content string) []DynamicContent {
	var results []DynamicContent
	for _, pattern := range timestampPatterns {
		matches := pattern.FindAllString(content, -1)
		for _, match := range matches {
			results = append(results, DynamicContent{
				Type:    "timestamp",
				Content: match,
			})
		}
	}
	return results
}

func (d *Diagnostics) DetectPrefixChange(old, new string, prefixLen int) *PrefixChange {
	if prefixLen <= 0 {
		prefixLen = 50
	}
	oldPrefix := old
	newPrefix := new
	if len(old) > prefixLen {
		oldPrefix = old[:prefixLen]
	}
	if len(new) > prefixLen {
		newPrefix = new[:prefixLen]
	}
	if oldPrefix == newPrefix {
		return nil
	}
	pos := 0
	for i := 0; i < len(oldPrefix) && i < len(newPrefix); i++ {
		if oldPrefix[i] != newPrefix[i] {
			pos = i
			break
		}
	}
	return &PrefixChange{
		Position:  pos,
		OldPrefix: oldPrefix,
		NewPrefix: newPrefix,
	}
}

func (d *Diagnostics) HasDynamicContent(content string) bool {
	return len(d.DetectDynamicContent(content)) > 0
}

func (d *Diagnostics) LongestCommonPrefix(a, b string) int {
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}
	for i := 0; i < minLen; i++ {
		if a[i] != b[i] {
			return i
		}
	}
	return minLen
}

func (d *Diagnostics) NormalizeContent(content string) string {
	result := content
	for _, pattern := range timestampPatterns {
		result = pattern.ReplaceAllString(result, "<TIMESTAMP>")
	}
	return result
}

func (d *Diagnostics) IsSimilar(a, b string, threshold float64) bool {
	prefix := d.LongestCommonPrefix(a, b)
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	if maxLen == 0 {
		return true
	}
	return float64(prefix)/float64(maxLen) >= threshold
}
