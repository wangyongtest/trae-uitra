# Reasonix 架构深度分析

> 开源地址：https://github.com/esengine/DeepSeek-Reasonix
> 协议：MIT
> 语言：Go (v1.0+) / TypeScript (v0.x legacy)
> Stars：19,000+ (2026年6月)

---

## 一、产品定位

Reasonix 是一款 **DeepSeek 原生 AI 编码 Agent（Coding Agent/Harness）**，以极致的 API 缓存命中率优化为核心设计目标，定位为终端/桌面端编程助手。

- **哲学**：放弃通用性，追求对单一后端（DeepSeek）的深度优化
- **核心成就**：435M Token 仅花费 12 美元，缓存命中率高达 **99.82%**
- **形态**：CLI + TUI + 桌面应用（Wails）+ Web Serve

---

## 二、技术栈

| 层级 | 技术选型 |
|------|---------|
| 核心内核 | Go (CGO_ENABLED=0，单静态二进制 ~7MB) |
| 桌面框架 | Wails (Go 后端 + WebView 前端) |
| Web 前端 | TypeScript + CSS + HTML |
| 配置格式 | TOML (BurntSushi/toml，唯一第三方依赖) |
| 前端构建 | esbuild |
| 协议支持 | MCP (Model Context Protocol) - stdio / HTTP / SSE |
| 分发方式 | npm / brew / GitHub Releases / 单二进制 |

---

## 三、整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                               │
├──────────────┬──────────────────┬──────────────────────────────────┤
│  CLI / TUI   │   Web Serve      │     Wails Desktop App            │
│  (bubbletea) │  (HTTP/SSE:8787) │  (WebView + Go bindings)         │
└──────┬───────┴────────┬─────────┴────────────┬─────────────────────┘
       │                │                      │
       └────────────────┼──────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    control.Controller                                │
│            (传输无关的核心控制器 - 所有前端共享)                      │
├─────────────────────────────────────────────────────────────────────┤
│  SessionAPI  │  Approval Gate  │  Rewind/Checkpoint  │  StatsPanel │
└──────┬───────┴────────┬────────┴───────────┬─────────┴─────────────┘
       │                │                    │
       ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Agent Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │   Runner    │  │   Coordinator    │  │   Session (Messages) │   │
│  │  (Run 接口) │  │ (双模型协作)      │  │   []Message           │   │
│  └──────┬──────┘  └────────┬─────────┘  └──────────┬───────────┘   │
│         │                  │                       │               │
│         └──────────────────┼───────────────────────┘               │
│                            ▼                                       │
│              ┌─────────────────────────┐                           │
│              │  Agent Harness Loop     │                           │
│              │  (Cache-First Loop)     │                           │
│              └────────────┬────────────┘                           │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ Tool Registry│  │  Provider Layer  │  │  Permission / Sandbox│
│ (工具注册表)  │  │  (模型提供者)     │  │  (权限/沙箱)          │
├──────────────┤  ├──────────────────┤  ├──────────────────────┤
│ Built-in     │  │ OpenAI-compat    │  │ Policy Engine        │
│ (read/write/ │  │ Registry         │  │ (deny>ask>allow)     │
│  edit/bash/  │  │ Factory Pattern  │  │ Approver (UI)        │
│  ls/glob/grep│  │ DeepSeek Presets │  │ Sandbox (workspace)  │
│ grep/memory) │  │ MiMo Presets     │  │ File Access Control  │
├──────────────┤  └────────┬─────────┘  └──────────────────────┘
│ MCP Plugins  │           │
│ (stdio/HTTP/ │           ▼
│  SSE JSON-RPC)│  ┌──────────────────┐
│ Namespaced    │  │ DeepSeek API      │
│ mcp__<s>__<t> │  │ (Prefix Cache)    │
└──────┬───────┘  └──────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Plugin / MCP Client                              │
├─────────────────────────────────────────────────────────────────────┤
│  Transport Abstraction (call/notify/close)                          │
│  ├─ stdio: subprocess JSON-RPC (1 message/line)                     │
│  ├─ http: streamable-http (POST + SSE, Mcp-Session-Id)              │
│  └─ sse: legacy (deprecated)                                        │
│  Lifecycle: initialize → initialized → tools/list → tools/call      │
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supporting Subsystems                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Compaction   │ │ Memory       │ │ History      │ │ Commands   │ │
│  │ (上下文压缩)  │ │ (持久化记忆)  │ │ (BM25检索)   │ │ (Slash /)  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Skills       │ │ Checkpoints  │ │ Stats/Cost   │ │ Config     │ │
│  │ (Markdown)   │ │ (Rewind)     │ │ (实时监控)    │ │ (TOML)     │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ Codebase     │ │ Hooks        │ │ Auto Research│                │
│  │ Memory Index │ │ (生命周期)    │ │ (心跳任务)    │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 四、核心架构设计

### 4.1 四大支柱（Four Pillars）

#### Pillar 1: Cache-First Loop（缓存优先循环）

这是 Reasonix 存在的核心理由——针对 DeepSeek prefix cache 做到极致优化。

**三层上下文分区：**

```
┌─────────────────────────────────────────┐
│ IMMUTABLE PREFIX  (不可变前缀)           │
│ system prompt + tool specs + few-shots  │  ← session 建立时锁定
│ + project memory (REASONIX.md)          │    永不修改，缓存命中核心
├─────────────────────────────────────────┤
│ APPEND-ONLY LOG  (只追加日志)            │
│ [user₁][assistant₁][tool₁][assistant₂]  │  ← 严格按序追加
│ [tool₂]...                               │    不重排、不修改、不压缩
├─────────────────────────────────────────┤
│ VOLATILE SCRATCH  (临时草稿)             │
│ R1 thoughts, plan state                 │  ← 不发送到 API
│ intermediate calculations                │    蒸馏后才能进入 Log
└─────────────────────────────────────────┘
```

**三条不变量（Invariants）：**
1. **Prefix 一次计算**：session 建立时哈希锁定，永不改动
2. **Log 只追加**：按序序列化，不重写任何已有条目
3. **Scratch 蒸馏后入 Log**：临时状态需经处理才能进入永久记录

**缓存命中率监控指标：**
- 每轮请求的 `prompt_tokens` vs `cached_tokens` 实时统计
- Session 级/全局级命中率趋势图
- 缓存失效事件追踪（定位破坏前缀的操作）
- 成本实时计算（缓存 token 按 10% 计价）

#### Pillar 2: Tool-Call Repair（工具调用修复）

针对 DeepSeek R1 系列模型已知缺陷的四道后处理工序：

| 工序 | 问题 | 修复策略 |
|------|------|---------|
| **scavenge** | tool-call JSON 被 `思考块` 吞入 reasoning_content | 正则 + JSON parser 扫描，捞出被遗忘的 tool-call |
| **flatten** | 参数超过 10 字段或嵌套深度 >2 时丢参数 | 自动转 dot-notation 给模型，dispatch 时还原 |
| **storm** | 相同参数重复调用同一工具 | 滑动窗口检测 (tool, args) 组合，抑制重复并注入反思 |
| **truncation** | max_tokens 用尽时 JSON 截断 | 检测不完整 JSON，补全括号或请求续写 |

#### Pillar 3: 成本控制（Flash-First 分级）

| 预设 | 模型 | 成本倍率 | 用途 |
|------|------|---------|------|
| flash | v4-flash | 1× | 默认、辅助调用强制使用 |
| auto | flash → pro 自动升级 | 1-3× | 模型自报 `<<<NEEDS_PRO>>>` 时升级 |
| pro | v4-pro | ~12× | 复杂推理任务 |

**四个成本控制机制：**
1. **flash-first**：所有辅助调用（摘要、子 Agent、截断修复）强制 flash
2. **模型自报告升级**：模型输出 `<<<NEEDS_PRO>>>` 标记触发升级
3. **轮次结束压缩**：tool 结果超 3000 token 自动压缩（后续按需重读）
4. **费用实时显示**：StatsPanel 每轮/每 session 实时费用，按金额着色

#### Pillar 4: 成本透明（Cost Transparency）

- 每轮 token 消耗（prompt / completion / cached）
- 按模型计算实际费用
- Session 累计费用与时间趋势
- 缓存命中率实时面板
- 可导出账单明细

---

### 4.2 依赖方向（Acyclic）

```
cli → {agent, plugin, config} → {tool, provider}
```

- 子包通过 `init()` 自注册，父包不导入子包
- `internal/cli`：子命令路由、flags、组装、退出码
- `internal/config`：TOML 加载（flag > project > user > defaults）
- `internal/provider`：Provider 接口 + kind→factory 注册表
- `internal/tool`：Tool 接口 + Registry
- `internal/permission`：per-call Policy: allow/ask/deny
- `internal/command`：自定义 slash commands (.reasonix/commands/*.md)
- `internal/plugin`：stdio JSON-RPC (MCP) 客户端
- `internal/agent`：Session + harness loop

---

### 4.3 核心接口定义

#### Provider 接口

```go
type Provider interface {
    Name() string
    Stream(ctx context.Context, req Request) (<-chan Chunk, error)
}

type Factory func(cfg Config) (Provider, error)

type Config struct {
    Name       string
    BaseURL    string
    Model      string
    APIKey     string
    Extra      map[string]any
}
```

#### Tool 接口

```go
type Tool interface {
    Name() string
    Description() string
    Schema() json.RawMessage      // JSON Schema for parameters
    Execute(ctx context.Context, args json.RawMessage) (string, error)
    ReadOnly() bool               // parallel dispatch hint
}
```

#### Permission Policy

```go
type Decision int
const (Allow Decision = iota; Ask; Deny)

type Policy struct {
    Mode       Decision
    Allow, Ask, Deny []Rule
}

func (p Policy) Decide(toolName string, readOnly bool, args json.RawMessage) Decision
```

**优先级**：`deny > ask > allow > fallback`
- Read-only 工具 fallback = Allow
- Writer 工具 fallback = Mode (默认 Ask)

---

### 4.4 双模型协作（Coordinator）

当 `agent.planner_model` 指定不同于 executor 的模型时：

```
┌─────────────────────────────────────────────────────────────┐
│                    Coordinator                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │  Planner Session     │    │  Executor Session        │   │
│  │  (低频规划器)         │    │  (高频执行器)             │   │
│  │  - 只读工具集         │───▶│  - 完整工具集             │   │
│  │  - 独立缓存前缀       │plan│  - 独立缓存前缀           │   │
│  │  - 研究+制定计划      │    │  - 执行计划               │   │
│  └──────────────────────┘    └──────────────────────────┘   │
│                                                             │
│  两个 Session 完全隔离 → 各自前缀保持稳定 → 缓存命中率最大化   │
└─────────────────────────────────────────────────────────────┘
```

关键：两个模型在**独立 session** 中运行，避免模型切换破坏 prefix cache。

---

### 4.5 上下文压缩（Compaction）

**触发条件**：prompt_tokens 达到 context_window × compactRatio（默认 0.8）

**压缩策略**：
- **保留**：所有 user turn（足够短的）、所有 prior digest（摘要）
- **折叠**：assistant/tool 工作内容 → 使用 executor 自身模型摘要（无工具调用）
- **边界对齐**：从最近的 tool result 后对齐，避免孤儿 tool message
- **归档**：原始消息保存到 `reasonix/archive/<timestamp>.jsonl`

**缓存影响**：压缩是唯一的"缓存重置点"，但刻意保持低频。两次压缩间 session prepend-only，缓存友好。

---

### 4.6 内存与历史检索

| 工具 | 作用 | 检索方式 |
|------|------|---------|
| `history` | 会话历史检索 | BM25 over session JSONL files |
| `memory` | 持久化记忆检索 | BM25 over auto-memory files |
| `remember` | 保存事实到记忆 | 需要人工审批（即使 YOLO 模式） |
| `forget` | 归档并移除记忆 | 需要人工审批 |

---

### 4.7 检查点与回滚（Checkpoints & Rewind）

- 触发：`Esc-Esc` (CLI) 或 `/rewind` 命令
- 快照式编辑安全网
- 支持 fork（分支会话）
- 支持 summarize（摘要压缩后继续）
- 多种回滚粒度：both / conversation / code

---

### 4.8 内置工具集

| 类别 | 工具 | 说明 |
|------|------|------|
| **文件读取** | read_file, ls, glob, grep | 只读，默认无需审批 |
| **文件修改** | write_file, edit_file, move_file, multi_edit | 写操作，需权限审批 |
| **执行** | bash | 命令执行，超时保护（默认120s） |
| **记忆** | memory, remember, forget | 持久化记忆管理 |
| **历史** | history | BM25 历史会话检索 |
| **任务** | todo_write | Todo 列表管理（前端实时面板） |
| **工作流** | task, run_as | 子任务/子 Agent 委派 |

---

### 4.9 配置系统

**配置优先级**：flag > `./reasonix.toml` > user config > built-in defaults

**配置路径**：
- macOS/Linux：`~/.reasonix/config.toml`
- Windows：`%AppData%\reasonix\config.toml`

**密钥管理**：通过 `api_key_env` 引用环境变量，密钥存入 `<Reasonix home>/.env`，永不写入配置文件。

**多 Provider 配置示例**：
```toml
default_model = "deepseek-flash"

[[providers]]
name = "deepseek-flash"
kind = "openai"
base_url = "https://api.deepseek.com"
model = "deepseek-v4-flash"
api_key_env = "DEEPSEEK_API_KEY"

[[providers]]
name = "deepseek-pro"
kind = "openai"
base_url = "https://api.deepseek.com"
model = "deepseek-v4-pro"
api_key_env = "DEEPSEEK_API_KEY"

[agent]
planner_model = "deepseek-pro"    # 双模型模式
max_steps = 0                     # 0 = 无限制
compact_ratio = 0.8               # 压缩阈值

[permissions]
mode = "ask"
deny = ["Bash(rm -rf*)", "Bash(git push*)"]
allow = ["Bash(go test:*)"]
```

---

## 五、桌面架构（Wails Desktop v1.11.0）

### 5.1 技术选型

- **框架**：Wails v2 (Go + WebView)
- **前端**：TypeScript + 原生 Web 组件（无重型框架依赖）
- **构建**：esbuild 打包前端资源
- **自动更新**：canary 更新通道支持
- **代码签名**：Windows 使用 SignPath Foundation 免费证书

### 5.2 架构变化（v1.11.0）

- **SessionAPI 拆分**：将会话管理从 UI 层独立为 API 层
- **codebase-memory MCP 自动索引**：代码库记忆 MCP 服务器支持自动建索引
- **MCP lazy 启动移除**：所有配置的 MCP 服务器启动时初始化（不再懒加载）
- **Graphite 主题**：默认外观改为自动 Graphite 主题
- **自动主题同步**：原生背景色随系统主题自动切换

### 5.3 桌面功能

- 多项目标签页（tabs 持久化到 desktop-tabs.json）
- 设置面板（快捷键自定义、主题、MCP 管理）
- 命令面板（Cmd+K / Ctrl+K）
- 工具审批卡片 UI
- Plan 模式审批 UI
- IM Bot 集成（飞书、微信、QQ）
- 实时 Stats 面板（费用、缓存命中率）
- 模型切换器（flash/auto/pro）
- Goal 目标追踪
- Todo 面板实时联动

---

## 六、命中率监测系统设计

### 6.1 核心指标

| 指标 | 计算方式 | 展示位置 |
|------|---------|---------|
| 单轮缓存命中率 | `cached_tokens / prompt_tokens × 100%` | 每轮气泡旁 |
| Session 命中率 | `Σcached_tokens / Σprompt_tokens × 100%` | StatsPanel 顶部 |
| 累计费用 | `Σ(prompt_tokens - cached_tokens) × price + Σcompletion × price` | 实时更新 |
| 缓存命中金额节省 | `Σcached_tokens × price × 0.9` | 对比显示 |
| Token/秒吞吐量 | `tokens / duration` | 性能面板 |
| 工具调用成功率 | `successful_calls / total_calls` | 调试面板 |

### 6.2 缓存失效诊断

当命中率异常下降时，系统自动诊断可能原因：
- System prompt 是否被动态修改（注入时间戳/状态）
- 消息顺序是否被重排
- 是否有上下文压缩发生（可接受的重置点）
- 工具结果是否有动态内容（时间戳/随机数）
- Provider 端缓存是否过期

### 6.3 可视化面板

- 命中率趋势折线图（时间维度）
- Token 消耗堆叠柱状图（prompt/cached/completion）
- 费用累积曲线
- 模型使用分布饼图
- 工具调用频率排行

---

## 七、性能指标（基准）

| 指标 | v0.x (TypeScript) | v1.0 (Go) |
|------|-------------------|-----------|
| 冷启动时间 | 1.2s | 0.3s |
| 内存占用 | 42MB | 18MB |
| 二进制大小 | 依赖 Node.js | ~7MB 单文件 |
| 缓存命中率 | ~85% (目标) | 99.82% (实测) |
| 并发工具调度 | 受限 | parallel-safe 批量并行 |

---

## 八、关键设计决策总结

| 决策 | Reasonix 选择 | 理由 |
|------|--------------|------|
| 多模型支持 | DeepSeek 优先，OpenAI-compat 可配置 | 深度优化 prefix cache |
| 前端框架 | Wails + 原生 TS | 轻量、单二进制分发 |
| 配置格式 | TOML | 简单、唯一依赖 |
| 上下文管理 | 三层分区 + 低频压缩 | 最大化缓存命中 |
| 工具执行 | 后处理 pipeline 兜底 | 不信任模型输出 |
| 模型升级 | 模型自报 NEEDS_PRO | 无外部分类器开销 |
| 权限系统 | 规则匹配 + 交互审批 | 安全与效率平衡 |
| 插件协议 | MCP (stdio/HTTP) | 标准生态兼容 |
| 内存检索 | BM25 | 无向量数据库依赖 |
| 分发方式 | npm/brew/单二进制 | 零依赖安装 |

---

## 九、优势与局限

### 优势
1. **极致成本优化**：99.82% 缓存命中率，长会话成本降至约 2 折
2. **轻量高效**：Go 单二进制，冷启动 0.3s，内存 18MB
3. **开源可控**：MIT 协议，代码完全透明
4. **MCP 生态**：兼容标准工具协议
5. **深度工程化**：tool-call 修复四道工序、自动模型升级
6. **多前端形态**：CLI/TUI/Desktop/Web Serve 共享内核

### 局限
1. **DeepSeek 绑定**：对 DeepSeek 的深度优化意味着换后端需大幅适配
2. **IDE 功能弱**：没有代码编辑器、调试器、Git GUI（相比 Cursor/TRAE IDE）
3. **企业功能缺失**：无 SSO、团队管理、审计日志等企业级能力
4. **移动端缺失**：无移动 App（TRAE Work 有）
5. **非开发者场景弱**：Work 模式（文档/PPT/数据分析）支持有限
6. **语音/多模态**：不支持语音输入、图片理解等

---

## 十、适用场景

| 场景 | 适用度 | 说明 |
|------|-------|------|
| 个人开发者日常编码 | ⭐⭐⭐⭐⭐ | 成本极低，终端工作流流畅 |
| 长会话深度编程 | ⭐⭐⭐⭐⭐ | 缓存优化让长会话成本可控 |
| 成本敏感型用户 | ⭐⭐⭐⭐⭐ | 2折成本优势显著 |
| 多模型切换需求 | ⭐⭐ | 虽支持 OpenAI-compat，但非优化重点 |
| GUI IDE 工作流 | ⭐⭐ | 桌面版有限，不如完整 IDE |
| 企业团队协作 | ⭐ | 缺乏企业管理功能 |
| 非开发办公场景 | ⭐ | Work 模式能力薄弱 |
| 移动端使用 | ❌ | 无移动 App |
