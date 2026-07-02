package cache

import "unicode"

type Message struct {
	Role    string
	Content string
}

type TokenCounter struct{}

func NewTokenCounter() *TokenCounter {
	return &TokenCounter{}
}

func (tc *TokenCounter) CountTextTokens(text string) int {
	if len(text) == 0 {
		return 0
	}
	tokens := 0
	inWord := false
	for _, r := range text {
		if unicode.Is(unicode.Han, r) {
			tokens++
			inWord = false
		} else if unicode.IsSpace(r) {
			inWord = false
		} else {
			if !inWord {
				tokens++
				inWord = true
			}
		}
	}
	return tokens
}

func (tc *TokenCounter) CountChineseTokens(text string) int {
	count := 0
	for _, r := range text {
		if unicode.Is(unicode.Han, r) {
			count++
		}
	}
	return count
}

func (tc *TokenCounter) CountMessages(messages []Message) int {
	total := 0
	for _, msg := range messages {
		total += tc.CountTextTokens(msg.Role)
		total += tc.CountTextTokens(msg.Content)
		total += 4
	}
	return total
}
