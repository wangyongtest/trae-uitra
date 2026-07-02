package cache

import (
	"bytes"
	"encoding/json"
	"sort"
)

type ToolSchema struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type Serializer struct{}

func NewSerializer() *Serializer {
	return &Serializer{}
}

func (s *Serializer) MarshalToolSchema(schema *ToolSchema) ([]byte, error) {
	return json.Marshal(schema)
}

func (s *Serializer) MarshalArgs(args map[string]interface{}) ([]byte, error) {
	if args == nil {
		return json.Marshal(nil)
	}
	var buf bytes.Buffer
	buf.WriteByte('{')
	keys := make([]string, 0, len(args))
	for k := range args {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for i, k := range keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		keyBytes, _ := json.Marshal(k)
		buf.Write(keyBytes)
		buf.WriteByte(':')
		valBytes, err := json.Marshal(args[k])
		if err != nil {
			return nil, err
		}
		buf.Write(valBytes)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}
