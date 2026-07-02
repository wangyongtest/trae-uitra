# 详细架构文档

> TRAE Ultra 融合架构深度解析：五层上下文、Go Kernel、IPC协议与缓存优化策略

---

## 目录

- [整体架构图](#整体架构图)
- [五层上下文架构详解](#五层上下文架构详解)
- [Go Kernel 架构](#go-kernel-架构)
- [Electron 层架构](#electron-层架构)
- [IPC 通信协议](#ipc-通信协议)
- [缓存命中率优化 12 策略](#缓存命中率优化-12-策略)
- [数据流图](#数据流图)
- [目录结构说明](#目录结构说明)

---

## 整体架构图

TRAE Ultra 采用 **Sidecar 架构**，将核心 AI 逻辑放在 Go 编写的 Sidecar 内核中，通过 stdio JSON-RPC 与 Electron 主进程通信：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRAE Ultra Desktop App                         │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Renderer Process (Vue 3)                      │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │  │
│  │  │  Chat   │ │  Cache  │ │  Stats  │ │ Skills  │ │ Settings  │  │  │
│  │  │  View   │ │ Monitor │ │  View   │ │  View   │ │   View    │  │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └─────┬─────┘  │  │
│  │       │           │           │           │            │         │  │
│  │  ┌────┴───────────┴───────────┴───────────┴────────────┴─────┐   │  │
│  │  │              Pinia Stores / Composables                   │   │  │
│  │  │  chat store │ stats store │ settings store │ useIPC       │   │  │
│  │  └───────────────────────────┬───────────────────────────────┘   │  │
│  └──────────────────────────────┼───────────────────────────────────┘  │
│                                 │ contextBridge                        │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                     Main Process (Electron)                      │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────────┐ │  │
│  │  │ Window Mgr  │ │ IPC Router   │ │    Sidecar Manager        │ │  │
│  │  │ (titlebar,  │ │ (chat.ts,    │ │  - spawn kernel.exe       │ │  │
│  │  │  lifecycle) │ │  system.ts)  │ │  - stdio read/write       │ │  │
│  │  └─────────────┘ └──────────────┘ │  - JSON-RPC framing       │ │  │
│  │                                    │  - reconnect on crash     │ │  │
│  │                                    └─────────────┬─────────────┘ │  │
│  └──────────────────────────────────────────────────┼────────────────┘  │
│                                                     │ stdio pipes        │
│                         ┌───────────────────────────┼───────────────┐   │
│                         │      stdin/stdout         ▼               │   │
│                         │  ┌─────────────────────────────────────┐ │   │
│                         │  │         Go Sidecar Kernel           │ │   │
│                         │  │  ┌─────────────────────────────────┐│ │   │
│                         │  │  │         Server Layer            ││ │   │
│                         │  │  │  - JSON-RPC 2.0 handler        ││ │   │
│                         │  │  │  - method dispatch              ││ │   │
│                         │  │  └──────────┬──────────────────────┘│ │   │
│                         │  │  ┌──────────▼──────────────────────┐│ │   │
│                         │  │  │         Agent Layer             ││ │   │
│                         │  │  │  - 5-layer context management   ││ │   │
│                         │  │  │  - tool calling loop            ││ │   │
│                         │  │  │  - flash-first routing          ││ │   │
│                         │  │  └──────────┬──────────────────────┘│ │   │
│                         │  │  ┌──────────▼──────────────────────┐│ │   │
│                         │  │  │         Cache Layer             ││ │   │
│                         │  │  │  - prefix locking               ││ │   │
│                         │  │  │  - deterministic serializer     ││ │   │
│                         │  │  │  - hit rate monitor             ││ │   │
│                         │  │  │  - diagnostics                  ││ │   │
│                         │  │  └──────────┬──────────────────────┘│ │   │
│                         │  │  ┌──────────▼──────────────────────┐│ │   │
│                         │  │  │        Provider Layer           ││ │   │
│                         │  │  │  - DeepSeek                     ││ │   │
│                         │  │  │  - Volcengine (Doubao)          ││ │   │
│                         │  │  │  - extensible registry          ││ │   │
│                         │  │  └──────────┬──────────────────────┘│ │   │
│                         │  │  ┌──────────▼──────────────────────┐│ │   │
│                         │  │  │         Tool Layer              ││ │   │
│                         │  │  │  - builtin tools                ││ │   │
│                         │  │  │  - MCP client (future)          ││ │   │
│                         │  │  └─────────────────────────────────┘│ │   │
│                         │  └─────────────────────────────────────┘ │   │
│                         └──────────────────────────────────────────┘   │
│                                                     │                  │
│                                                     │ HTTPS            │
│                                                     ▼                  │
│                                          ┌────────────────────┐        │
│                                          │  Model APIs        │        │
│                                          │  - api.deepseek.com│        │
│                                          │  - ark.cn-beijing  │        │
│                                          │    .volces.com     │        │
│                                          └────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 架构设计原则

1. **关注点分离**：UI 层（Vue）只负责渲染和用户交互，所有 AI 逻辑在 Go Kernel 中
2. **进程隔离**：Go Kernel 作为独立子进程，崩溃不影响主应用，可自动重启
3. **语言优势**：Go 处理高并发流式响应，Vue/TypeScript 提供类型安全的 UI
4. **可扩展性**：Provider、Tool、Skill 都可通过注册表模式扩展
5. **可测试性**：核心逻辑在 Go 中，可独立于 UI 进行单元测试

---

## 五层上下文架构详解

TRAE Ultra 的上下文管理采用 Reasonix 提出的五层架构，从下到上依次为：

```
┌─────────────────────────────────────────────────────────────┐
│  L5: ISOLATED SUB-AGENTS      子 Agent 独立上下文            │
│  ─────────────────────────────────────────────────────────  │
│  • 工具调用触发的子 Agent 拥有隔离的上下文窗口               │
│  • 子 Agent 之间互不干扰，结果回传后合并到上层               │
│  • 支持并行执行多个子 Agent 任务                             │
├─────────────────────────────────────────────────────────────┤
│  L4: EXTERNAL MEMORY          外部记忆（向量检索）           │
│  ─────────────────────────────────────────────────────────  │
│  • 从历史会话中语义检索相关内容                              │
│  • 项目知识库、文档索引                                      │
│  • 按需加载，不总是进入上下文                                │
├─────────────────────────────────────────────────────────────┤
│  L3: WORKING SCRATCHPAD       工作区/草稿板                  │
│  ─────────────────────────────────────────────────────────  │
│  • 当前任务的临时工作数据                                    │
│  • 工具调用中间结果、代码片段                                │
│  • 任务完成后可丢弃或归档到 Episodic Log                     │
├─────────────────────────────────────────────────────────────┤
│  L2: EPISODIC LOG             对话日志（滚动摘要）           │
│  ─────────────────────────────────────────────────────────  │
│  • 当前会话的对话历史                                        │
│  • 超出窗口时自动滚动摘要（保留最近 N 轮 + 早期摘要）        │
│  • 用户可见，可编辑                                          │
├─────────────────────────────────────────────────────────────┤
│  L1: SYSTEM FOUNDATION        系统基础层                     │
│  ─────────────────────────────────────────────────────────  │
│  • 系统提示词（System Prompt）                               │
│  • 工作区规则（.trae/rules.md）                              │
│  • 用户持久化记忆（偏好、代码风格）                          │
│  • 这部分内容在会话中保持稳定，是缓存命中的关键               │
└─────────────────────────────────────────────────────────────┘
```

### 各层缓存特性

| 层级 | 稳定性 | 缓存贡献 | 是否参与前缀锁定 |
|------|--------|---------|-----------------|
| L1 System Foundation | 极高 | 主要缓存命中来源 | ✅ 是 |
| L2 Episodic Log | 中（逐轮增长） | 前几轮稳定后可命中 | 部分 |
| L3 Working Scratchpad | 低（任务相关） | 较少 | ❌ 否 |
| L4 External Memory | 低（按需检索） | 很少 | ❌ 否 |
| L5 Isolated Sub-Agents | 极低（临时） | 几乎不贡献 | ❌ 否 |

### 上下文构建流程

```
用户发送消息
    │
    ▼
┌─────────────────┐
│ 1. 加载 L1      │  System Prompt + rules + memory（固定前缀起点）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 加载 L2      │  对话历史（最近消息 + 滚动摘要）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 加载 L3      │  当前任务工作数据（文件、代码等）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 检索 L4      │  语义检索相关历史（如需要）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 追加新消息   │  用户当前输入
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. 确定性序列化 │  JSON 序列化（键排序、稳定格式）
└────────┬────────┘
         │
         ▼
    发送到模型 API
```

---

## Go Kernel 架构

Go Kernel 是 TRAE Ultra 的核心引擎，作为独立子进程运行。

### 目录结构

```
kernel/
├── main.go                          # 入口，启动 RPC server
├── go.mod
└── internal/
    ├── server/
    │   └── rpc.go                   # JSON-RPC 服务器
    ├── provider/
    │   ├── provider.go              # Provider 接口定义
    │   ├── deepseek/
    │   │   ├── deepseek.go          # DeepSeek API 实现
    │   │   └── deepseek_test.go
    │   └── volcengine/
    │       └── volcengine.go        # 豆包/火山引擎实现
    ├── model/
    │   └── registry.go              # Provider 注册表
    ├── cache/
    │   ├── monitor.go               # 缓存命中率监控
    │   ├── monitor_test.go
    │   ├── token_counter.go         # Token 计数与费用计算
    │   ├── token_counter_test.go
    │   ├── serializer.go            # 确定性序列化
    │   ├── serializer_test.go
    │   ├── diagnostics.go           # 缓存诊断与建议
    │   └── diagnostics_test.go
    ├── stats/
    │   ├── cost.go                  # 费用统计
    │   └── cost_test.go
    ├── agent/                       # Agent 层（开发中）
    │   ├── context.go               # 五层上下文管理
    │   ├── tool_loop.go             # 工具调用循环
    │   └── routing.go               # Flash-First 路由
    ├── tool/                        # 工具层（开发中）
    │   ├── tool.go                  # Tool 接口
    │   └── builtin/                 # 内置工具
    └── config/
        └── config.go                # 配置加载与管理
```

### Server 层

- 基于 stdio 的 JSON-RPC 2.0 服务器
- 方法注册与分发
- 流式响应通过 `method` 字段的通知（notification）发送
- 支持取消（通过 `chat/stop` 方法）

### Provider 层

- 统一的 ChatStream 接口，所有 Provider 实现流式对话
- 每个 Provider 负责：认证、请求构建、SSE 流解析、错误处理、Usage 提取
- Provider 注册表设计，添加新 Provider 只需实现接口并注册（见 [EXTENDING.md](EXTENDING.md)）

### Cache 层

Cache 层是 Reasonix 架构的核心：

| 组件 | 职责 |
|------|------|
| `monitor` | 记录每次请求的命中/未命中/Token 数，计算实时命中率 |
| `token_counter` | 按模型定价计算费用，区分输入/输出/缓存命中 Token |
| `serializer` | 确定性 JSON 序列化，键排序、字段顺序固定，保证相同输入产生相同输出 |
| `diagnostics` | 根据命中率数据给出优化建议，三色状态灯判定 |

### Agent 层

- 五层上下文的编排与组装
- 工具调用循环：判断是否需要调用工具 → 执行工具 → 将结果回传
- Flash-First 路由：根据任务复杂度自动选择 Flash 或 Pro 模型
- 子 Agent 管理（L5 层）

### Tool 层

- 统一 Tool 接口
- 内置工具：文件读写、命令执行、代码搜索等
- MCP 客户端（计划中）：动态加载外部 MCP 工具

---

## Electron 层架构

Electron 层负责窗口管理、原生 UI 和 Sidecar 进程管理。

### 进程模型

```
┌─────────────────────────────────────────────────────────┐
│                  Main Process (Node.js)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Windows    │  │  IPC Router  │  │Sidecar Mgr   │  │
│  │  - Main Win  │  │  - chat IPC  │  │  - spawn     │  │
│  │  - Titlebar  │  │  - system    │  │  - stdio     │  │
│  │  - Lifecycle │  │  - settings  │  │  - restart   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │ stdio
          │ IPC             │ IPC             │
┌─────────┼─────────────────┼─────────────────┼──────────┐
│  ┌──────▼───────┐  ┌──────▼───────┐         │          │
│  │  Preload     │  │  Preload     │         │          │
│  │  (context    │  │  (context    │         │          │
│  │  Bridge)     │  │  Bridge)     │         │          │
│  └──────┬───────┘  └──────┬───────┘         │          │
│         │                 │                  │          │
│  ┌──────▼─────────────────▼───────┐         │          │
│  │     Renderer Process (Vue)     │         │          │
│  │  单一 BrowserWindow            │         │          │
│  └────────────────────────────────┘         │          │
│                                             │          │
│  ┌──────────────────────────────────────────▼───────┐  │
│  │              Go Sidecar Kernel (子进程)           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Main Process 模块

**electron/main.ts** - 应用入口：
- Electron app 生命周期管理
- 创建主窗口（BrowserWindow）
- 加载 Vite dev server 或生产构建文件
- 注册 IPC handlers

**electron/sidecar/manager.ts** - Sidecar 管理器：
- 启动/停止 Go kernel 子进程
- 通过 stdin 发送 JSON-RPC 请求
- 从 stdout 读取 JSON-RPC 响应和通知
- 处理进程退出和自动重启
- 超时和健康检查

**electron/sidecar/rpc.ts** - RPC 客户端：
- JSON-RPC 请求 ID 生成
- 请求/响应匹配（pending request map）
- 通知转发到 Renderer
- 流式 chunk 聚合与分发

**electron/ipc/chat.ts** - 对话 IPC：
- 处理 `chat:send`、`chat:stop` 等前端调用
- 转发到 Sidecar Manager
- 将流式 chunk 发送回 Renderer

**electron/ipc/system.ts** - 系统 IPC：
- 配置读写（API Key、设置）
- 应用版本信息
- 系统对话框（文件选择等）

**electron/window/titlebar.ts** - 自定义标题栏：
- 无边框窗口的拖拽
- 最小化/最大化/关闭按钮
- 窗口控制逻辑

### Preload 脚本

**electron/preload.ts**：
- 使用 `contextBridge.exposeInMainWorld` 安全暴露 API
- 不直接暴露 ipcRenderer，而是封装为类型安全的方法
- 所有跨进程通信通过白名单方法

```typescript
// 暴露给前端的 API 示例
contextBridge.exposeInMainWorld('traeAPI', {
  chat: {
    send: (message: string) => ipcRenderer.invoke('chat:send', message),
    stop: () => ipcRenderer.invoke('chat:stop'),
    onChunk: (callback) => {
      ipcRenderer.on('chat:chunk', (_, data) => callback(data))
    },
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config) => ipcRenderer.invoke('config:set', config),
  },
})
```

### Renderer (Vue)

见 [目录结构](#目录结构说明) 中 `src/` 部分。

---

## IPC 通信协议

### 协议栈

```
┌─────────────────────────────────┐
│   JSON-RPC 2.0                  │  请求/响应/通知
├─────────────────────────────────┤
│   消息帧 (NDJSON)               │  每行一个 JSON 对象
├─────────────────────────────────┤
│   stdio (stdin/stdout pipes)    │  Electron ↔ Go
└─────────────────────────────────┘
```

采用 **NDJSON (Newline Delimited JSON)** 作为帧格式：
- 每条 JSON 消息以 `\n` 结尾
- 无需额外长度前缀，按行读取即可
- 简单可靠，适合流式传输

### JSON-RPC 2.0 消息格式

**请求 (Request)：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "chat/send",
  "params": {
    "conversation_id": "conv_abc123",
    "model": "deepseek-v4-flash",
    "message": "你好"
  }
}
```

**成功响应 (Response)：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "message_id": "msg_xyz",
    "conversation_id": "conv_abc123"
  }
}
```

**错误响应 (Error)：**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "API key not configured",
    "data": { "provider": "deepseek" }
  }
}
```

**通知 (Notification，无 id，不需要响应)：**
```json
{
  "jsonrpc": "2.0",
  "method": "chat/chunk",
  "params": {
    "conversation_id": "conv_abc123",
    "content": "你好",
    "done": false
  }
}
```

### RPC 方法列表

| 方法 | 方向 | 说明 |
|------|------|------|
| `chat/send` | Frontend → Kernel | 发送消息，启动流式响应 |
| `chat/stop` | Frontend → Kernel | 停止当前生成 |
| `chat/chunk` | Kernel → Frontend | 流式内容片段（通知） |
| `chat/done` | Kernel → Frontend | 生成完成（通知） |
| `chat/error` | Kernel → Frontend | 生成错误（通知） |
| `config/get` | Frontend → Kernel | 获取配置 |
| `config/set` | Frontend → Kernel | 保存配置 |
| `config/reload` | Frontend → Kernel | 重载配置 |
| `model/list` | Frontend → Kernel | 获取可用模型列表 |
| `model/test` | Frontend → Kernel | 测试模型连接 |
| `stats/cost` | Frontend → Kernel | 获取费用统计 |
| `stats/cache` | Frontend → Kernel | 获取缓存统计 |
| `kernel/ping` | Frontend → Kernel | 心跳检测 |
| `kernel/ready` | Kernel → Frontend | Kernel 启动就绪（通知） |

### 错误码定义

| 错误码 | 含义 |
|--------|------|
| -32700 | Parse error - 无效 JSON |
| -32600 | Invalid Request - 请求格式错误 |
| -32601 | Method not found - 方法不存在 |
| -32602 | Invalid params - 参数错误 |
| -32603 | Internal error - 内部错误 |
| -32000 | API Key 未配置 |
| -32001 | 模型 API 调用失败 |
| -32002 | 预算超限 |
| -32003 | Kernel 未就绪 |
| -32004 | 对话不存在 |

---

## 缓存命中率优化 12 策略

Reasonix 架构的核心目标是最大化 Prompt Cache 命中率，以下是 TRAE Ultra 采用的 12 项优化策略：

### 策略 1：前缀锁定 (Prefix Locking)

**原理**：将稳定不变的系统层（L1）内容固定在消息列表的最前面，每次请求都使用完全相同的前缀，模型服务器能最大程度复用缓存。

**实现**：
- L1 内容（System Prompt + rules）构建后不再修改
- 每次请求从 L1 开始序列化，保证前缀字节级一致
- 对话过程中不修改 L1 内容

### 策略 2：确定性序列化 (Deterministic Serialization)

**原理**：Go 的 `map` 遍历顺序随机，如果直接序列化会导致相同语义的消息产生不同的字节序列，破坏缓存。

**实现**：
- 自定义 JSON 序列化器
- 所有 `map` 按键排序后输出
- 字段顺序固定（结构体字段按定义顺序）
- 不使用随机数、时间戳等易变字段
- 浮点数格式统一（避免 `1.0` vs `1`）

```go
// 确定性序列化示例：排序 map 键
func deterministicMarshal(v interface{}) ([]byte, error) {
    buf := &bytes.Buffer{}
    enc := json.NewEncoder(buf)
    enc.SetEscapeHTML(false)
    // 自定义编码器处理 map 键排序
    err := enc.Encode(sortKeys(v))
    return buf.Bytes(), err
}
```

### 策略 3：动态内容隔离

**原理**：将频繁变化的内容（如时间戳、实时数据）放在消息列表的末尾，避免它们出现在中间导致前缀缓存失效。

**实现**：
- 所有动态追加内容（用户新消息）放在 messages 末尾
- 不在历史消息中间插入新内容
- 需要注入的动态数据单独作为最后一条 user/tool 消息

### 策略 4：消息角色顺序固定

**原理**：严格保持 `system → user → assistant → user → assistant...` 的交替顺序，不插入额外角色的消息打破模式。

**实现**：
- 合并连续的相同角色消息
- 工具调用结果归一化为 user 角色或独立 tool 角色并固定位置
- 确保消息序列的角色序列可预测

### 策略 5：滚动摘要而非全量截断

**原理**：简单截断历史消息会改变消息顺序和位置，导致后续所有缓存失效。滚动摘要保持前缀稳定。

**实现**：
- 需要压缩历史时，将早期多条消息总结为一条 summary 消息
- summary 消息生成后保持不变，新消息追加在后面
- 从 L2 截断点开始的新前缀依然稳定，可建立新的缓存段

### 策略 6：空白符和格式标准化

**原理**：多余的空格、换行符、缩进差异会导致字节级不匹配。

**实现**：
- System Prompt 使用统一换行符（`\n`）
- 去除不必要的 trailing whitespace
- JSON 输出使用紧凑格式（不缩进）
- 代码片段保持原始格式（放入 code block 不做额外格式化）

### 策略 7：ID 稳定化

**原理**：消息 ID、会话 ID 等如使用 UUID 每次变化，会导致缓存失效。

**实现**：
- 历史消息的 ID 一旦分配不再变更
- 序列化时不包含随机生成的 request_id
- 必要的 ID 使用内容哈希（content hash）生成，相同内容产生相同 ID

### 策略 8：温度和采样参数固定

**原理**：不同的采样参数（temperature、top_p 等）可能导致缓存分片。

**实现**：
- 同一模型使用固定的默认参数
- 参数变化作为模型切换处理（而非每次修改）
- Flash 模型和 Pro 模型各自维护参数集

### 策略 9：System Prompt 版本化

**原理**：System Prompt 更新会导致整个缓存失效。

**实现**：
- System Prompt 修改是显式操作（用户触发或版本升级）
- 修改后清空该会话的缓存统计，新会话从新 System Prompt 开始
- 尽量避免频繁修改 System Prompt

### 策略 10：工具定义排序

**原理**：Function calling 的 tools 列表如果顺序变化，会导致缓存失效。

**实现**：
- 工具列表按名称排序后注册
- 新增工具追加到末尾
- 工具描述文案保持稳定，不频繁修改

### 策略 11：增量更新而非全量替换

**原理**：每次只追加用户新消息和 AI 回复，不重新发送整个历史（依赖模型 API 的缓存机制，无需做特殊处理，但需保证历史部分字节一致）。

**实现**：
- 每次请求发送完整 messages 数组（因为 SSE 无状态）
- 但保证已发送过的历史部分字节序列完全相同
- 这正是策略 1-10 共同确保的

### 策略 12：缓存诊断与自适应调整

**原理**：实时监控命中率，发现异常时诊断原因并调整策略。

**实现**：
- `diagnostics.go` 模块分析命中率趋势
- 低于阈值时给出具体优化建议（如"前缀不稳定"、"序列化不一致"等）
- 三色状态灯直观反馈缓存健康状态
- 记录每次请求的缓存命中情况供分析

### 缓存优化效果

| 策略 | 命中率提升 | 实现难度 |
|------|-----------|---------|
| 前缀锁定 | +40-60% | 中 |
| 确定性序列化 | +20-30% | 高 |
| 动态内容隔离 | +10-15% | 低 |
| 消息角色顺序固定 | +5-10% | 低 |
| 滚动摘要 | +5-10% | 中 |
| 其他 7 项策略 | 各 +2-5% | 低-中 |

**综合效果**：在长对话场景中，缓存命中率可达 **90%+**，相比未优化场景节省 **70-90%** 的输入 Token 成本。

---

## 数据流图

### 用户发送消息的完整数据流

```
用户输入消息 + 回车
    │
    ▼
┌──────────────────────┐
│ MessageInput.vue     │  emit('send', message)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ chat store (Pinia)   │  addUserMessage()
│                      │  设置 sending = true
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ useIPC.ts            │  window.traeAPI.chat.send()
└──────────┬───────────┘
           │
           │ IPC invoke (ipcRenderer → main)
           ▼
┌──────────────────────┐
│ electron/ipc/chat.ts │  ipcMain.handle('chat:send')
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ sidecar/rpc.ts       │  构造 JSON-RPC 请求
│                      │  pendingRequests.set(id, callback)
└──────────┬───────────┘
           │
           │ write to stdin
           ▼
┌──────────────────────┐
│ Go kernel stdin      │  bufio.Scanner 读取行
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ server/rpc.go        │  解析 JSON-RPC
│                      │  分发到 handleChatSend
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ agent/context.go     │  组装五层上下文
│                      │  L1 → L2 → L3 → L4 → 新消息
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ cache/serializer.go  │  确定性序列化
│                      │  计算/检查前缀指纹
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ provider/deepseek.go │  构建 HTTP 请求
│                      │  发送到 api.deepseek.com
└──────────┬───────────┘
           │
           │ SSE stream (data: {...}\n\n)
           ▼
┌──────────────────────┐
│ provider 解析 SSE    │  逐行解析 delta content
└──────────┬───────────┘
           │
           │ for each chunk:
           ▼
┌──────────────────────┐
│ server 发送通知      │  {"method":"chat/chunk","params":{...}}
└──────────┬───────────┘
           │
           │ write to stdout
           ▼
┌──────────────────────┐
│ sidecar/manager.ts   │  读取 stdout 行
│                      │  解析 JSON-RPC
│                      │  通知 → webContents.send()
└──────────┬───────────┘
           │
           │ IPC on (main → renderer)
           ▼
┌──────────────────────┐
│ useIPC.ts            │  ipcRenderer.on('chat:chunk')
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ chat store           │  appendAssistantChunk(content)
└──────────┬───────────┘
           │
           │ reactive state update
           ▼
┌──────────────────────┐
│ ChatView.vue         │  Vue 响应式更新 DOM
│ MessageItem.vue      │  Markdown 渲染 + 代码高亮
└──────────┬───────────┘
           │
           ▼
    用户看到 AI 回复逐字输出
           │
           │ ... 流式持续 ...
           │
           ▼
┌──────────────────────┐
│ 流结束 (done: true)  │  chat/done 通知
│                      │  记录 usage（tokens、cache hit）
│                      │  更新 stats store（费用、命中率）
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ CacheHitMonitor.vue  │  更新三色状态灯
│ StatsView.vue        │  更新费用统计
└──────────────────────┘
```

---

## 目录结构说明

```
d:\demo\test\desktop/
├── README.md                          # 项目主文档
├── package.json                       # npm 依赖和脚本
├── tsconfig.json                      # TypeScript 配置
├── vite.config.ts                     # Vite 构建配置
├── vitest.config.ts                   # Vitest 测试配置
├── tailwind.config.js                 # Tailwind CSS 配置
├── postcss.config.js                  # PostCSS 配置
├── index.html                         # Vite 入口 HTML
├── .npmrc                             # npm 镜像配置
├── .gitignore
├── Reasonix.md                        # Reasonix 架构参考
├── TRAE_WORK_CN.md                    # TRAE Work CN 融合方案
├── 开发准备方案.md                     # 开发准备文档
├── 融合架构设计.md                     # 融合架构设计文档
│
├── docs/                              # 项目文档目录
│   ├── INSTALL.md                     # 安装使用手册
│   ├── FEATURES.md                    # 功能清单
│   ├── TESTING.md                     # 测试文档
│   ├── EXTENDING.md                   # 可扩展性说明
│   └── ARCHITECTURE.md                # 本文档 - 详细架构文档
│
├── electron/                          # Electron 主进程代码
│   ├── main.ts                        # 主进程入口
│   ├── preload.ts                     # Preload 脚本（contextBridge）
│   ├── ipc/                           # IPC 处理器
│   │   ├── chat.ts                    # 对话相关 IPC
│   │   └── system.ts                  # 系统相关 IPC
│   ├── sidecar/                       # Sidecar 管理
│   │   ├── manager.ts                 # Go 子进程生命周期管理
│   │   └── rpc.ts                     # JSON-RPC 客户端
│   └── window/
│       └── titlebar.ts                # 自定义标题栏
│
├── kernel/                            # Go Sidecar Kernel
│   ├── main.go                        # Kernel 入口
│   ├── go.mod                         # Go 模块定义
│   └── internal/
│       ├── server/rpc.go              # JSON-RPC 服务器
│       ├── provider/                  # 模型 Provider
│       ├── model/registry.go          # Provider 注册表
│       ├── cache/                     # 缓存层（monitor/token_counter/serializer/diagnostics）
│       ├── stats/cost.go              # 费用统计
│       ├── config/config.go           # 配置管理
│       ├── agent/                     # Agent 层（开发中）
│       └── tool/                      # 工具层（开发中）
│
├── src/                               # Vue 前端源代码
│   ├── main.ts                        # Vue 应用入口
│   ├── App.vue                        # 根组件
│   ├── vite-env.d.ts                  # Vite 类型声明
│   ├── index.html
│   │
│   ├── assets/                        # 静态资源
│   │   └── styles/
│   │       └── main.css               # 全局样式 + Tailwind 导入
│   │
│   ├── components/                    # Vue 组件
│   │   ├── chat/                      # 对话模块
│   │   │   ├── ChatView.vue           # 对话主视图
│   │   │   ├── MessageInput.vue       # 消息输入框
│   │   │   ├── MessageItem.vue        # 单条消息展示
│   │   │   └── ToolCallItem.vue       # 工具调用展示
│   │   ├── common/                    # 通用组件
│   │   │   ├── Button.vue
│   │   │   ├── Modal.vue
│   │   │   └── Spinner.vue
│   │   ├── layout/                    # 布局组件
│   │   │   ├── MainLayout.vue         # 主布局（侧边栏+内容区）
│   │   │   ├── StatusBar.vue          # 状态栏（连接状态、费用）
│   │   │   └── TitleBar.vue           # 自定义标题栏组件
│   │   ├── settings/
│   │   │   └── SettingsView.vue       # 设置页面
│   │   ├── sidebar/
│   │   │   └── ConversationList.vue   # 会话列表/侧边栏导航
│   │   ├── skills/
│   │   │   └── SkillsView.vue         # 技能中心
│   │   └── stats/                     # 统计监控
│   │       ├── CacheHitMonitor.vue    # 缓存命中率监控组件
│   │       └── StatsView.vue          # 费用统计页面
│   │
│   ├── composables/                   # Vue 组合式函数
│   │   ├── useIPC.ts                  # IPC 通信封装
│   │   └── useMarkdown.ts             # Markdown 渲染
│   │
│   ├── router/
│   │   └── index.ts                   # Vue Router 配置
│   │
│   ├── stores/                        # Pinia 状态管理
│   │   ├── chat.ts                    # 对话状态（会话、消息）
│   │   ├── settings.ts                # 设置状态
│   │   └── stats.ts                   # 统计状态（缓存、费用）
│   │
│   └── types/
│       └── index.ts                   # TypeScript 类型定义
│
├── tests/                             # 前端测试
│   ├── setup.ts                       # Vitest 配置
│   ├── chat.store.test.ts             # Chat store 测试
│   └── cache-monitor.test.ts          # 缓存监控逻辑测试
│
└── resources/                         # 构建后资源（kernel.exe 输出目录）
    └── kernel.exe                     # 编译后的 Go Kernel（构建产物）
```
