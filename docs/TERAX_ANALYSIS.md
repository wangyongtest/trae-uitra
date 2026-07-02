# Terax AI 深度架构分析

> 基于 GitHub 仓库 [crynta/terax-ai](https://github.com/crynta/terax-ai) v0.8.2 源码分析
>
> 分析日期：2026-06-27

---

## 一、项目定位

**Terax** 是一个**轻量级、终端优先、AI 原生的开发工作台**（Agent Development Environment, ADE）。

- **核心定位**：将终端（Terminal）、代码编辑器（Code Editor）、源代码管理（Git）、AI Agent 能力整合为一个约 **7-8 MB** 的桌面应用
- **哲学**：终端优先（Terminal-first）、AI 侧边面板（Side-panel）、本地优先（Local-first）、无遥测（No telemetry）、无需账号（No account）
- **技术标签**：`Tauri 2` + `Rust` + `React 19` + `TypeScript` + `Vite` + `xterm.js` + `CodeMirror 6` + `Vercel AI SDK v6`
- **许可证**：Apache-2.0
- **包管理器**：pnpm@11.5.0，Node >= 22
- **包体积**：Release 约 7-8 MB（得益于 Tauri + Rust + LTO + strip）

---

## 二、整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Terax Application                               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    React 19 Frontend (Renderer)                  │   │
│  │                                                                  │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │   │
│  │  │  Terminal  │ │   Code     │ │  Source    │ │   AI Side    │  │   │
│  │  │  (xterm.js)│ │  Editor    │ │  Control   │ │   Panel      │  │   │
│  │  │  WebGL     │ │(CodeMirror)│ │  (Git)     │ │ (AI SDK v6)  │  │   │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘  │   │
│  │        │              │              │               │          │   │
│  │  ┌─────┴──────────────┴──────────────┴───────────────┴───────┐  │   │
│  │  │              Zustand State Management                     │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │   │
│  │  │  │terminal  │ │ editor   │ │ git      │ │ ai/agent     │  │  │   │
│  │  │  │  store   │ │  store   │ │  store   │ │  store       │  │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                              │                                   │   │
│  │                    Tauri IPC (invoke/emit)                       │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│  ═══════════════════════════════╪════════════════════════════════════  │
│                    Tauri 2 IPC Boundary                                 │
│  ═══════════════════════════════╪════════════════════════════════════  │
│                                 │                                       │
│  ┌──────────────────────────────┴───────────────────────────────────┐   │
│  │                    Rust Backend (Tauri 2)                        │   │
│  │                                                                  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────────┐  │   │
│  │  │  PTY   │ │  FS    │ │  Git   │ │ Shell  │ │  Agent Hooks  │  │   │
│  │  │(port-  │ │(read/  │ │(libgit2│ │(cmd    │ │(Claude/Codex/ │  │   │
│  │  │ able-  │ │ write/ │ │  via   │ │ exec,  │ │ Gemini CLI    │  │   │
│  │  │ pty)   │ │ watch/ │ │ git CLI│ │ bg,    │ │ integration)  │  │   │
│  │  │        │ │ grep/  │ │)       │ │ sess.) │ │               │  │   │
│  │  │        │ │ glob)  │ │        │ │        │ │               │  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └───────────────┘  │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │   │
│  │  │Secrets │ │  Net   │ │History │ │Work-   │                    │   │
│  │  │(keyring│ │(reqwest│ │(command│ │space   │                    │   │
│  │  │ /OS    │ │, HTTP  │ │ sugg.) │ │(WSL,   │                    │   │
│  │  │keychain│ │ proxy/ │ │        │ │ dirs)  │                    │   │
│  │  │)       │ │ stream)│ │        │ │        │                    │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、技术栈详解

### 3.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^19.2.7 | UI 框架 |
| TypeScript | ~6.0.3 | 类型安全 |
| Vite | ^8.0.16 | 构建工具 |
| Tailwind CSS | ^4.3.1 | 样式（v4 版本，零配置） |
| shadcn/ui | ^4.11.0 | UI 组件库（Radix UI 基础） |
| Zustand | ^5.0.14 | 状态管理 |
| xterm.js | ^6.0.0 + addons | 终端渲染（WebGL 加速） |
| CodeMirror 6 | ^6.x | 代码编辑器 |
| Vercel AI SDK | ai@^6.0.207 | AI Provider 抽象层 |
| zod | ^4.4.3 | 运行时类型验证 |
| Biome | ^2.5.0 | Lint + Format（替代 ESLint+Prettier） |
| Vitest | ^4.1.9 | 前端单元测试 |
| sonner | ^2.0.7 | Toast 通知 |
| streamdown | ^2.5.0 | Markdown 流式渲染 |
| cmdk | ^1.1.1 | 命令面板 |
| react-resizable-panels | ^4.11.2 | 可拖拽面板分割 |
| @tanstack/react-virtual | ^3.14.3 | 虚拟滚动 |

### 3.2 Rust 后端依赖

| Crate | 版本 | 用途 |
|-------|------|------|
| tauri | 2 | 桌面框架 |
| portable-pty | 0.9 | 原生 PTY（跨平台终端后端） |
| reqwest | 0.12 (rustls-tls, stream) | HTTP 客户端（含流式支持） |
| serde/serde_json | 1 | 序列化 |
| grep-regex/grep-searcher/grep-matcher | 0.1 | ripgrep 级别的代码搜索 |
| globset | 0.4 | glob 模式匹配 |
| nucleo-matcher | 0.3 | 模糊匹配（fuzzy finder） |
| ignore | 0.4 | .gitignore 解析 |
| notify | 8.2 | 文件系统监听 |
| shared_child | 1 | 跨平台子进程管理 |
| keyring | 3.6 | 系统密钥链（macOS/Windows） |
| dirs | 6 | 系统目录定位 |
| tempfile | 3 | 临时文件 |
| tauri-plugin-* | 2 | 官方插件：opener/log/os/store/process/notification/autostart/updater/window-state |

### 3.3 Tauri 插件生态

Terax 大量使用 Tauri 2 官方插件：

| 插件 | 功能 |
|------|------|
| tauri-plugin-opener | 打开外部链接/文件 |
| tauri-plugin-log | 结构化日志 |
| tauri-plugin-os | 操作系统信息 |
| tauri-plugin-store | 键值持久化 |
| tauri-plugin-process | 进程管理 |
| tauri-plugin-notification | 系统通知 |
| tauri-plugin-autostart | 开机自启 |
| tauri-plugin-updater | 自动更新 |
| tauri-plugin-window-state | 窗口位置/大小记忆 |

---

## 四、核心模块架构

### 4.1 终端模块（PTY）

```
用户输入
   │
   ▼
┌──────────────┐    IPC pty_write    ┌──────────────┐
│  xterm.js    │ ──────────────────► │  Rust PTY    │
│  (Renderer)  │ ◄────────────────── │  (Child Proc)│
└──────────────┘    IPC pty event    └──────┬───────┘
                                           │
                                    portable-pty
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Shell       │
                                    │ (zsh/bash/   │
                                    │  pwsh/fish/  │
                                    │  cmd/WSL)    │
                                    └──────────────┘
```

**关键特性**：
- **WebGL 渲染器**：GPU 加速的块级终端渲染
- **多标签 + 分屏**：水平/垂直分割面板
- **原生 PTY**：通过 `portable-pty` crate 调用系统 PTY（非 pty.js/node-pty）
- **WSL 一等公民**：Windows 上 WSL 不是包装子进程，而是原生工作区环境
- **Shell 自动检测**：Windows: pwsh → powershell → cmd
- **Agent 钩子检测**：OSC 777 序列检测 Claude Code/Codex/Gemini CLI 事件

### 4.2 AI Agent 工作流

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Composer (Frontend)                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ #snippet│  │ @file   │  │ /slash  │  │ voice input  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘  │
│       └────────────┴────────────┴──────────────┘          │
│                         │                                  │
│                    Vercel AI SDK v6                        │
│                  (streamText/generateText)                 │
│                         │                                  │
│              ┌──────────┴──────────┐                       │
│              │  Tool Execution     │                       │
│              │  (approval-gated)   │                       │
│              └──────────┬──────────┘                       │
└─────────────────────────┼───────────────────────────────────┘
                          │ Tauri IPC: net::ai_http_stream
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Rust Backend: net module                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              reqwest (rustls-tls, stream)            │  │
│  │  ┌────────┐ ┌─────────┐ ┌──────┐ ┌──────┐ ┌─────┐  │  │
│  │  │OpenAI  │ │Anthropic│ │Google│ │Groq  │ │xAI  │  │  │
│  │  └────────┘ └─────────┘ └──────┘ └──────┘ └─────┘  │  │
│  │  ┌────────┐ ┌─────────────┐ ┌───────────────────┐   │  │
│  │  │Cerebras│ │OpenRouter   │ │OpenAI-compatible  │   │  │
│  │  └────────┘ └─────────────┘ │(LM Studio/MLX/    │   │  │
│  │  ┌────────┐ ┌─────────┐     │ Ollama local)     │   │  │
│  │  │DeepSeek│ │Mistral  │     └───────────────────┘   │  │
│  │  └────────┘ └─────────┘                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Agent 工具集**（通过 Vercel AI SDK tool calling 实现）：

| 工具 | 功能 | 后端实现 |
|------|------|---------|
| `file.read` | 读取文件 | Rust `fs::file::fs_read_file` |
| `file.write` | 写入文件 | Rust `fs::file::fs_write_file` |
| `file.edit` | 编辑文件（diff） | CodeMirror 6 merge + Rust |
| `file.multi-edit` | 多文件编辑 | 批量操作 |
| `fs.grep` | 内容搜索 | Rust `grep-regex` + `grep-searcher` |
| `fs.glob` | 文件名匹配 | Rust `globset` |
| `shell.run` | 执行命令（需审批） | Rust `shell::shell_run_command` |
| `shell.bg` | 后台进程 | Rust `shell::shell_bg_spawn` |
| `agent.sub` | 子 Agent | 前端 SDK 层面的 sub-agent |
| `memory` | 项目记忆 | `TERAX.md` 文件 |

**Plan 模式流程**：

```
用户输入
   │
   ▼
┌──────────────┐    yes    ┌──────────────┐
│ Plan Mode?   │──────────►│ 生成计划      │
└──────┬───────┘           │ (多步分解)    │
       │ no                └──────┬───────┘
       ▼                         │ 用户确认
┌──────────────┐           ┌──────▼───────┐
│ 直接执行     │◄──────────│ 执行计划      │
│ (auto mode)  │           │ (逐步执行)    │
└──────┬───────┘           └──────┬───────┘
       │                         │
       └──────────┬──────────────┘
                  ▼
         ┌──────────────┐
         │ Tool 调用     │◄──── 审批门控（Bash等危险操作）
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │ 流式响应     │
         │ CodeMirror   │
         │ diff hunk    │◄──── accept/reject hunk by hunk
         └──────────────┘
```

### 4.3 Agent Hooks（CLI Agent 集成）

Terax 的一个独特创新：与外部 CLI Agent（Claude Code、Codex CLI、Gemini CLI）深度集成：

```
┌──────────────────────────────────────────────────────────────┐
│  终端中运行 Claude Code / Codex CLI / Gemini CLI             │
│                                                              │
│  $ claude   ← 用户在 Terax 终端中启动                        │
│                                                              │
│  Agent Hook 配置（自动注入到 ~/.claude/settings.json 等）     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ UserPromptSubmit → OSC 777 "working"  → Terax 显示忙碌  │  │
│  │ PermissionRequest → OSC 777 "attention" → Terax 通知   │  │
│  │ Stop/AfterAgent → OSC 777 "finished" → Terax 通知完成  │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│              OSC 777;notify;Terax;{agent};{event} BEL       │
│                          │                                   │
│                          ▼                                   │
│               ┌─────────────────────┐                        │
│               │ Terax 检测 OSC 序列  │                        │
│               │ → 系统通知           │                        │
│               │ → 任务栏闪烁/标记    │                        │
│               └─────────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

**支持的 CLI Agent**：
- **Claude Code**：通过 `terminalSequence` JSON 字段注入标记
- **Codex CLI**：通过 `/dev/tty` OSC 注入（Unix）或 `__terax_notify` Windows helper
- **Gemini CLI**：通过 matcher `"*"` 全局 hook + OSC 标记

### 4.4 密钥管理（Secrets）

```
┌─────────────────────────────────────────┐
│          前端 Settings → AI             │
│  Provider 选择 + API Key 输入           │
└────────────────┬────────────────────────┘
                 │ Tauri IPC: secrets_set
                 ▼
┌─────────────────────────────────────────┐
│       Rust secrets module               │
│  ┌─────────────────────────────────┐    │
│  │  keyring crate                  │    │
│  │  ┌──────────────┐               │    │
│  │  │ macOS:       │               │    │
│  │  │ Keychain     │               │    │
│  │  │ (apple-      │               │    │
│  │  │  native)     │               │    │
│  │  └──────────────┘               │    │
│  │  ┌──────────────┐               │    │
│  │  │ Windows:     │               │    │
│  │  │ Credential   │               │    │
│  │  │ Manager      │               │    │
│  │  │ (windows-    │               │    │
│  │  │  native)     │               │    │
│  │  └──────────────┘               │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**重要安全特性**：API Key 不写入磁盘、不写入 localStorage，通过 OS 原生密钥链存储。

### 4.5 源代码控制（Git）

```
Rust 后端调用 git CLI（非 libgit2 绑定）
┌──────────────────────────────────────────┐
│  git commands:                           │
│  ├── git_resolve_repo (检测仓库根)        │
│  ├── git_panel_snapshot (面板快照)        │
│  ├── git_status / git_diff               │
│  ├── git_stage / git_unstage (hunk级)    │
│  ├── git_commit / git_fetch              │
│  ├── git_pull_ff_only (仅fast-forward)   │
│  ├── git_push (upstream感知)             │
│  ├── git_log (含commit graph渲染)        │
│  ├── git_show_commit                     │
│  ├── git_list_branches                   │
│  └── git_checkout_branch                 │
└──────────────────────────────────────────┘
```

**特色**：真正的 Commit Graph 渲染（泳道图展示 merge/branch），hunk 级别的 stage/unstage/discard。

---

## 五、数据流图：从用户输入到 AI 响应

```
用户在AI面板输入消息
   │
   ├── @file  → 附加文件内容（从Rust fs读取）
   ├── #snippet → 插入代码片段
   └── /command → slash命令处理
         │
         ▼
┌──────────────────────────────┐
│  Vercel AI SDK streamText    │
│  - messages[] 构建           │
│  - tools[] 注册              │
│  - provider 选择             │
└──────────────┬───────────────┘
               │
               ▼  (通过 Rust net::ai_http_stream 代理)
┌──────────────────────────────┐
│  Rust net 模块 (reqwest)     │
│  - 流式 HTTP 请求            │
│  - rustls-tls (无需系统SSL)  │
│  - 支持 SSE 流式解析         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  AI Provider API             │
│  OpenAI/Anthropic/DeepSeek/  │
│  Ollama/LM Studio/...        │
└──────────────┬───────────────┘
               │ SSE stream
               ▼
┌──────────────────────────────┐
│  前端流式处理                │
│  ├── text delta → Markdown   │
│  │   流式渲染 (streamdown)    │
│  ├── tool_call → 执行工具    │
│  │   ├── Bash: 审批弹窗      │
│  │   ├── file.edit:          │
│  │   │   CodeMirror diff     │
│  │   │   accept/reject hunk  │
│  │   └── file/write:         │
│  │       直接写入 + 通知     │
│  └── usage → token统计       │
└──────────────────────────────┘
```

---

## 六、项目记忆机制（TERAX.md）

Terax 使用项目根目录下的 `TERAX.md` 文件作为项目记忆：

```
项目根目录/
├── TERAX.md          ← AI Agent 读取的项目记忆文件
├── src/
├── package.json
└── ...
```

**工作原理**：
1. 每次 Agent 启动时，自动读取 `TERAX.md` 注入到 system prompt
2. 文件内容由 Agent 和用户共同维护
3. 类似 Cursor 的 `.cursorrules`、Claude Code 的 `CLAUDE.md`
4. 支持项目约定、编码规范、架构说明等上下文持久化

---

## 七、构建与发布优化

```toml
# Cargo.toml release 配置
[profile.release]
codegen-units = 1    # 单代码生成单元（更好的LTO优化）
lto = "fat"          # 全程序链接时优化
opt-level = "s"      # 优化体积
panic = "abort"      # panic 直接 abort（去掉 unwind 表）
strip = true         # 剥离符号表
```

这些 Rust 优化是 Terax 能做到 7-8 MB 体积的关键。

---

## 八、Terax 的设计亮点总结

| 亮点 | 说明 |
|------|------|
| **体积极致优化** | 7-8 MB（对比 Electron 应用通常 100MB+） |
| **终端优先理念** | 真正的原生 PTY 后端，WebGL 前端，WSL 一等公民 |
| **Agent Hooks 创新** | 与 Claude Code/Codex/Gemini CLI 通过 OSC 777 协议集成，无需修改这些工具 |
| **审批门控** | Bash 等危险操作需要用户确认，安全可控 |
| **密钥安全** | 使用 OS 密钥链，不写入磁盘/localStorage |
| **Diff 编辑** | CodeMirror merge 插件实现 hunk 级 accept/reject |
| **Commit Graph** | 真正的 git 泳道图渲染 |
| **本地模型支持** | LM Studio / MLX / Ollama 一等公民支持 |
| **Vercel AI SDK** | 使用成熟 SDK 而非自研 Provider 层，快速接入 10+ Provider |
| **后台进程** | shell_bg_spawn 支持长时间运行的后台进程（dev server等） |
| **文件搜索** | 使用 ripgrep 级别的 grep-searcher，性能卓越 |
| **无遥测无账号** | 隐私优先 |
| **自动更新** | tauri-plugin-updater |
| **Biome 工具链** | 统一 lint + format，比 ESLint+Prettier 快 10-100 倍 |

---

## 九、Terax 的潜在不足

| 不足 | 说明 |
|------|------|
| **无缓存命中率监控** | 没有类似 Reasonix 的 KV 缓存命中追踪和费用优化策略 |
| **无费用透明面板** | 缺少实时 token 费用计算、预算告警、按模型统计 |
| **Provider 层依赖 Vercel SDK** | 虽然接入快，但无法做深层优化（如确定性序列化、前缀锁定） |
| **React 而非 Vue** | 纯技术选型差异，但与 TRAE Ultra 技术栈不同 |
| **Tauri vs Electron** | Tauri 体积小，但生态不如 Electron 成熟；某些系统级操作受限 |
| **AI 面板是侧边栏** | 对话体验不如 Chat-first 应用沉浸 |
| **无 MCP 协议支持** | 目前未见 MCP (Model Context Protocol) 支持 |
| **子 Agent 通过 SDK** | 子 Agent 隔离性不如进程级隔离 |
| **无五层上下文架构** | 缺少专门的上下文管理层 |
| **网络请求通过 Rust 代理** | 所有 AI 请求都经过 Rust 后端，增加了一层复杂度（但也带来了keyring安全优势） |
