# 可扩展性说明

> TRAE Ultra 扩展开发指南：添加模型、工具、MCP服务与前端组件

---

## 目录

- [添加新的模型 Provider](#添加新的模型-provider)
- [添加新的内置工具](#添加新的内置工具)
- [MCP 服务接入](#mcp-服务接入)
- [技能(Skills)系统扩展](#技能skills-系统扩展)
- [前端组件扩展](#前端组件扩展)
- [IPC/JSON-RPC 方法扩展](#ipcjson-rpc-方法扩展)
- [插件系统（未来规划）](#插件系统未来规划)
- [五层上下文扩展点](#五层上下文扩展点)
- [配置项扩展](#配置项扩展)

---

## 添加新的模型 Provider

TRAE Ultra 的模型层采用 Provider 抽象设计，添加新的模型服务商只需实现 `Provider` 接口并注册即可。

### Provider 接口定义

接口位于 `kernel/internal/provider/provider.go`：

```go
package provider

import (
    "context"
    "kernel/internal/cache"
)

// Message 表示一条对话消息
type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

// StreamChunk 流式响应片段
type StreamChunk struct {
    Content      string `json:"content"`
    FinishReason string `json:"finish_reason,omitempty"`
    Usage        *Usage `json:"usage,omitempty"`
}

// Usage Token 使用统计
type Usage struct {
    PromptTokens     int `json:"prompt_tokens"`
    CompletionTokens int `json:"completion_tokens"`
    CachedTokens     int `json:"cached_tokens,omitempty"`
}

// Provider 模型服务提供者接口
type Provider interface {
    // Name 返回 Provider 唯一标识
    Name() string

    // DisplayName 返回显示名称
    DisplayName() string

    // ChatStream 流式对话
    ChatStream(ctx context.Context, req *ChatRequest) (<-chan StreamChunk, error)

    // TestConnection 测试连接是否正常
    TestConnection(ctx context.Context, apiKey string) error

    // SupportsCache 该模型是否支持 Prompt Cache
    SupportsCache(modelID string) bool

    // ListModels 返回该 Provider 支持的模型列表
    ListModels() []ModelInfo
}

// ChatRequest 对话请求
type ChatRequest struct {
    Model       string
    Messages    []Message
    Temperature float32
    MaxTokens   int
    Stream      bool
    APIKey      string
}

// ModelInfo 模型信息
type ModelInfo struct {
    ID          string  `json:"id"`
    Name        string  `json:"name"`
    Flash       bool    `json:"flash"`
    MaxContext  int     `json:"max_context"`
    InputPrice  float64 `json:"input_price"`  // 每百万tokens价格
    OutputPrice float64 `json:"output_price"`
    CachePrice  float64 `json:"cache_price,omitempty"`
}
```

### 实现步骤

1. **在 `kernel/internal/provider/` 下创建新包**，例如 `openai/`

2. **实现 Provider 接口**：

```go
package openai

import (
    "bufio"
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "kernel/internal/provider"
    "net/http"
    "strings"
)

type OpenAIProvider struct{}

func New() provider.Provider {
    return &OpenAIProvider{}
}

func (p *OpenAIProvider) Name() string {
    return "openai"
}

func (p *OpenAIProvider) DisplayName() string {
    return "OpenAI"
}

func (p *OpenAIProvider) ChatStream(ctx context.Context, req *provider.ChatRequest) (<-chan provider.StreamChunk, error) {
    ch := make(chan provider.StreamChunk, 100)

    go func() {
        defer close(ch)

        // 1. 构建 HTTP 请求
        // 2. 发送请求
        // 3. 解析 SSE 流
        // 4. 逐块发送到 channel
    }()

    return ch, nil
}

func (p *OpenAIProvider) TestConnection(ctx context.Context, apiKey string) error {
    // 发送一个最小请求测试连通性
    return nil
}

func (p *OpenAIProvider) SupportsCache(modelID string) bool {
    return false // OpenAI 暂不支持与 DeepSeek 兼容的缓存
}

func (p *OpenAIProvider) ListModels() []provider.ModelInfo {
    return []provider.ModelInfo{
        {ID: "gpt-4o", Name: "GPT-4o", Flash: false, MaxContext: 128000, InputPrice: 35.0, OutputPrice: 105.0},
        {ID: "gpt-4o-mini", Name: "GPT-4o Mini", Flash: true, MaxContext: 128000, InputPrice: 1.05, OutputPrice: 4.2},
    }
}
```

3. **在 Provider 注册表中注册**：

修改 `kernel/internal/model/registry.go`：

```go
package model

import (
    "kernel/internal/provider"
    "kernel/internal/provider/deepseek"
    "kernel/internal/provider/openai"
    "kernel/internal/provider/volcengine"
)

var registry = map[string]provider.Provider{}

func init() {
    Register(deepseek.New())
    Register(volcengine.New())
    Register(openai.New()) // 新添加的 Provider
}

func Register(p provider.Provider) {
    registry[p.Name()] = p
}

func Get(name string) (provider.Provider, bool) {
    p, ok := registry[name]
    return p, ok
}

func List() []provider.Provider {
    // ...
}
```

4. **添加配置支持**：
   - 在前端 `src/types/index.ts` 的 `ApiKeys` 类型中添加对应字段
   - 在设置页面添加 API Key 输入框
   - 在配置文件加载逻辑中添加对应字段

5. **编写单元测试**：
   - 参考 `kernel/internal/provider/deepseek/deepseek_test.go` 编写测试
   - 使用 `httptest.Server` Mock API 响应

---

## 添加新的内置工具

Agent 工具系统允许 AI 调用外部能力（文件读写、命令执行、代码搜索等）。

### Tool 接口定义

```go
package tool

import "context"

// Tool 工具接口
type Tool interface {
    // Name 工具唯一名称
    Name() string

    // Description 给模型看的工具描述（用于 function calling）
    Description() string

    // Parameters JSON Schema 格式的参数定义
    Parameters() map[string]interface{}

    // Execute 执行工具
    Execute(ctx context.Context, args json.RawMessage) (string, error)
}
```

### 实现步骤

1. **在 `kernel/internal/tool/builtin/` 下创建新工具**，例如 `file_read.go`：

```go
package builtin

import (
    "context"
    "encoding/json"
    "os"
    "path/filepath"
)

type FileReadTool struct {
    workspaceRoot string
}

func NewFileReadTool(workspaceRoot string) *FileReadTool {
    return &FileReadTool{workspaceRoot: workspaceRoot}
}

func (t *FileReadTool) Name() string {
    return "file_read"
}

func (t *FileReadTool) Description() string {
    return "Read the contents of a file in the workspace"
}

func (t *FileReadTool) Parameters() map[string]interface{} {
    return map[string]interface{}{
        "type": "object",
        "properties": map[string]interface{}{
            "path": map[string]interface{}{
                "type":        "string",
                "description": "Relative path to the file",
            },
        },
        "required": []string{"path"},
    }
}

type fileReadArgs struct {
    Path string `json:"path"`
}

func (t *FileReadTool) Execute(ctx context.Context, argsJSON json.RawMessage) (string, error) {
    var args fileReadArgs
    if err := json.Unmarshal(argsJSON, &args); err != nil {
        return "", err
    }

    fullPath := filepath.Join(t.workspaceRoot, args.Path)

    // 安全检查：防止路径遍历
    absRoot, _ := filepath.Abs(t.workspaceRoot)
    absTarget, _ := filepath.Abs(fullPath)
    if !strings.HasPrefix(absTarget, absRoot) {
        return "", fmt.Errorf("access denied: path outside workspace")
    }

    content, err := os.ReadFile(fullPath)
    if err != nil {
        return "", err
    }

    return string(content), nil
}
```

2. **在工具注册表中注册**：

在 Agent 初始化时注册所有工具：

```go
tools := []tool.Tool{
    builtin.NewFileReadTool(workspaceRoot),
    builtin.NewFileWriteTool(workspaceRoot),
    builtin.NewExecTool(workspaceRoot),
    // ...
}
```

3. **更新前端工具调用展示组件**（如需要特殊渲染）：
   - 修改 `src/components/chat/ToolCallItem.vue` 添加新工具的展示样式

---

## MCP 服务接入

TRAE Ultra 原生支持 **Model Context Protocol (MCP)**，无需编写代码即可接入外部工具服务。

### MCP 配置格式

在配置文件 `config.json` 中添加 MCP 服务：

```json
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "d:\\demo"],
        "type": "stdio"
      },
      {
        "name": "remote-service",
        "url": "http://localhost:3000/sse",
        "type": "sse"
      }
    ]
  }
}
```

### 支持的传输类型

| 类型 | 说明 |
|------|------|
| `stdio` | 通过子进程 stdio 通信，本地命令行工具 |
| `sse` | 通过 Server-Sent Events 连接远程服务 |

### MCP 接入的工具自动可用

MCP 服务提供的工具会自动注册到工具系统，AI 可以直接调用，无需额外代码。

### 开发自定义 MCP 服务

可以使用任意语言开发 MCP 服务，推荐使用官方 SDK：

- TypeScript: `@modelcontextprotocol/sdk`
- Python: `mcp` Python SDK
- Go: 社区 Go SDK

---

## 技能(Skills)系统扩展

技能是预定义的专业化 Prompt + 工具组合，为特定场景优化。

### 技能定义结构

技能定义文件位于 `resources/skills/` 目录下，每个技能一个 `.json` 文件：

```json
{
  "id": "code-review",
  "name": "代码审查",
  "description": "审查代码质量、发现潜在问题、提出改进建议",
  "icon": "🔍",
  "system_prompt": "你是一位资深代码审查专家。请审查用户提供的代码，从以下维度进行分析：\n1. 代码正确性与潜在Bug\n2. 性能问题\n3. 安全漏洞\n4. 代码风格与可维护性\n5. 最佳实践建议\n\n请用中文回复，问题按严重程度排序。",
  "tools": ["file_read"],
  "trigger_keywords": ["审查", "review", "代码检查"],
  "models": ["deepseek-v4-pro"],
  "temperature": 0.3
}
```

### 技能加载机制

1. 启动时扫描 `resources/skills/` 目录
2. 加载所有 `.json` 技能定义
3. 在技能中心页面展示
4. 用户选择技能时，自动注入对应的 System Prompt 和工具配置

---

## 前端组件扩展

### 组件目录结构

```
src/
├── components/
│   ├── chat/           # 对话相关组件
│   ├── common/         # 通用组件（Button、Modal等）
│   ├── layout/         # 布局组件
│   ├── settings/       # 设置页面组件
│   ├── sidebar/        # 侧边栏组件
│   ├── skills/         # 技能中心组件
│   └── stats/          # 统计/监控组件
├── composables/        # 组合式函数
├── stores/             # Pinia 状态管理
├── types/              # TypeScript 类型定义
└── router/             # 路由配置
```

### 添加新页面/视图

1. **在 `src/views/` 或对应目录创建 Vue 组件**：

```vue
<template>
  <div class="p-6">
    <h1 class="text-xl font-bold mb-4">新页面</h1>
    <div>页面内容</div>
  </div>
</template>

<script setup lang="ts">
// 页面逻辑
</script>
```

2. **在 `src/router/index.ts` 添加路由**：

```typescript
const routes = [
  // ...现有路由
  {
    path: '/new-feature',
    name: 'new-feature',
    component: () => import('../views/NewFeature.vue'),
  },
]
```

3. **在侧边栏添加导航项**：修改 `src/components/sidebar/ConversationList.vue` 或对应导航组件。

### 添加新的 Pinia Store

在 `src/stores/` 下创建新 Store：

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useNewFeatureStore = defineStore('newFeature', () => {
  const data = ref<string[]>([])
  const count = computed(() => data.value.length)

  function add(item: string) {
    data.value.push(item)
  }

  return { data, count, add }
})
```

### 使用 IPC 通信

通过 `src/composables/useIPC.ts` 调用后端方法：

```typescript
import { useIPC } from '../composables/useIPC'

const ipc = useIPC()

// 调用 Go Kernel 方法
const result = await ipc.invoke('method_name', { param: 'value' })

// 监听 Kernel 事件
ipc.on('event_name', (data) => {
  console.log('event received', data)
})
```

### 组件开发规范

- 使用 `<script setup lang="ts">` 语法
- 使用 Composition API
- 使用 Tailwind CSS 进行样式
- Props 和 Emits 使用 TypeScript 类型定义
- 通用组件放在 `common/` 目录，业务组件放在对应模块目录
- 参考现有组件的代码风格

---

## IPC/JSON-RPC 方法扩展

### 消息格式

Electron 主进程与 Go Kernel 通过 stdio 上的 JSON-RPC 2.0 协议通信：

**请求：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "chat/send",
  "params": {
    "conversation_id": "abc123",
    "message": "你好"
  }
}
```

**响应：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { "ok": true }
}
```

**流式事件：**
```json
{
  "jsonrpc": "2.0",
  "method": "chat/chunk",
  "params": {
    "conversation_id": "abc123",
    "content": "你",
    "done": false
  }
}
```

### 添加新的 RPC 方法

1. **在 Go Kernel 的 server 层注册方法**：

修改 `kernel/internal/server/rpc.go`：

```go
func (s *Server) registerMethods() {
    s.methods["chat/send"] = s.handleChatSend
    s.methods["chat/stop"] = s.handleChatStop
    s.methods["new_method"] = s.handleNewMethod // 新方法
}

func (s *Server) handleNewMethod(ctx context.Context, params json.RawMessage) (interface{}, error) {
    var req NewMethodRequest
    if err := json.Unmarshal(params, &req); err != nil {
        return nil, err
    }

    // 处理逻辑...

    return result, nil
}
```

2. **在 Electron 主进程转发（如需要）**：

修改 `electron/ipc/` 下的对应文件，添加 IPC handler。

3. **在前端 preload 暴露 API**：

修改 `electron/preload.ts`，通过 contextBridge 暴露新方法：

```typescript
contextBridge.exposeInMainWorld('traeAPI', {
  // ...现有方法
  newMethod: (params: any) => ipcRenderer.invoke('new-method', params),
})
```

4. **在前端 composable 中添加封装**：

修改 `src/composables/useIPC.ts`，添加类型安全的调用方法。

---

## 插件系统（未来规划）

插件系统为未来版本规划，设计思路如下：

### 插件能力范围

- 注册新的 Provider
- 注册新的 Tool
- 注册新的 Skill
- 添加新的 UI 页面/面板
- 添加新的设置项
- 注册 IPC 方法

### 插件格式

初步设想为目录格式：

```
plugins/
└── my-plugin/
    ├── plugin.json      # 插件元数据
    ├── index.js         # 前端入口（可选）
    └── kernel.so        # Go 插件（可选，Go plugin 包）
```

或者采用更简单的 **MCP 即插件** 方案：MCP 服务本身就是插件，无需额外插件系统。

> 插件系统方案尚未最终确定，欢迎贡献想法。

---

## 五层上下文扩展点

可以在各层注入自定义内容：

### L1: System Foundation 扩展

- 自定义 System Prompt
- 工作区 `.trae/rules.md` 文件自动加载
- 持久化记忆（用户偏好、代码风格）

### L2: Episodic Log 扩展

- 自定义对话摘要策略
- 重要消息标记/置顶
- 外部事件注入（如 Git 提交记录）

### L3: Working Scratchpad 扩展

- 任务级临时数据注入
- 文件树、代码索引等动态内容

### L4: External Memory 扩展

- 向量数据库集成
- 历史会话语义检索
- 项目知识库接入

### L5: Isolated Sub-Agents 扩展

- 自定义子 Agent 角色
- 子 Agent 工具集限制
- 子 Agent 结果回调处理

---

## 配置项扩展

### 添加新的配置项

1. **修改 Go 配置结构**：

`kernel/internal/config/config.go`：

```go
type Config struct {
    APIKeys   map[string]string `json:"api_keys"`
    DefaultModel string        `json:"default_model"`
    NewFeature NewFeatureConfig `json:"new_feature"` // 新增
}

type NewFeatureConfig struct {
    Enabled bool   `json:"enabled"`
    Option  string `json:"option"`
}
```

2. **修改前端类型定义**：

`src/types/index.ts`：

```typescript
export interface AppConfig {
  api_keys: Record<string, string>
  default_model: string
  new_feature: {
    enabled: boolean
    option: string
  }
}
```

3. **在设置页面添加 UI 控件**：

修改 `src/components/settings/SettingsView.vue`，添加对应表单控件。

4. **添加默认值处理**：确保旧版配置文件升级时新字段有合理默认值。

### 配置文件位置

- Windows: `%USERPROFILE%\.trae-ultra\config.json`
- macOS: `~/.trae-ultra/config.json`
- Linux: `~/.trae-ultra/config.json`

配置修改后通过 `config/reload` RPC 方法热重载，或重启应用生效。
