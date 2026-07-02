# TRAE Ultra

> Chat-first AI native development workbench with cache optimization, cost transparency, and terminal/IDE capabilities — Electron + Go Sidecar + Vue 3

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [支持模型](#支持模型)
- [快速开始](#快速开始)
- [项目状态](#项目状态)
- [相关文档](#相关文档)

---

## 项目简介

**TRAE Ultra** 是一款融合了 **Reasonix 缓存优先架构**、**TRAE Work 全场景 Agent 能力**，并吸收了 **Terax 终端/编辑器/Keychain 等优秀设计** 的 AI 原生开发工作台桌面应用。

它以 Chat-first 为核心交互，集成：
- **缓存命中率监控** + **费用透明**（Reasonix 核心差异化）
- **五层上下文管理**（超越三层的高级架构）
- **终端面板、文件系统、Git、Plan 模式、Diff 编辑**（Terax 优秀实践）
- **系统密钥链存储**（替代明文配置文件）
- **10+ Provider + 本地模型支持**（DeepSeek/豆包/OpenAI兼容/Ollama等）
- **MCP 协议原生支持**（开放生态）

TRAE Ultra 将高性能的 Go 语言内核（缓存优化、费用计算）与现代化的 Vue 3 前端通过 Electron 整合，既保证了核心逻辑的执行效率，又提供了流畅的开发者体验。

---

## 核心特性

| 特性 | 说明 |
|------|------|
| 🎯 **缓存命中率监控** | 实时监控 Prompt Cache 命中率，三色状态灯直观展示，历史趋势图追踪优化效果 |
| 💰 **费用透明** | 实时费用计算、按模型统计、Token 消耗明细，日预算告警 |
| 🧠 **五层上下文管理** | System Foundation → Episodic Log → Working Scratchpad → External Memory → Isolated Sub-Agents 五层架构 |
| 📋 **Plan 模式** | 多步任务先规划再执行，每步可确认，支持修改和中止 |
| 💻 **集成终端** | xterm.js + PTY 终端，支持分屏、WSL、后台进程管理（开发中） |
| 📝 **文件操作工具** | 内置 read/write/edit/grep/glob/list 工具，hunk 级 accept/reject |
| 🔀 **Diff 编辑器** | CodeMirror 6 代码查看器，AI 修改逐块确认，Vim 模式支持 |
| 🔐 **系统密钥链** | API Key 存储在 OS Keychain（Windows Credential Manager / macOS Keychain），不落盘 |
| 🔌 **多模型支持** | DeepSeek、豆包（火山引擎）、OpenAI/Anthropic/Groq、Ollama/LM Studio 本地模型 |
| ⚡ **Flash-First 成本控制** | 优先使用 Flash 模型处理简单任务，自动路由，成本节省可达 90% |
| 🔧 **工具调用修复** | 智能检测并修复失败的工具调用，提升 Agent 任务成功率 |
| 🌐 **MCP 协议支持** | 原生支持 Model Context Protocol，可接入任意 MCP 服务扩展能力 |
| 📂 **项目记忆** | 自动读取 TRAEULTRA.md / TERAX.md / CLAUDE.md / .cursorrules 作为项目上下文 |
| 🔀 **Git 集成** | 状态查看、hunk 级 stage/commit、Commit Graph 可视化（开发中） |

---

## 架构概览

TRAE Ultra 采用前后端分离的 Sidecar 架构，通过标准 JSON-RPC 协议通信：

```
┌─────────────────────────────────────────────────────────────┐
│                     Vue 3 前端 (Renderer)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Chat   │  │ Terminal │  │  Editor  │  │ Settings │    │
│  │  界面   │  │  面板    │  │  Diff    │  │  中心    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ 缓存监控  │  │ 费用统计  │  │  Git面板  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC (contextBridge)
┌───────────────────────────▼─────────────────────────────────┐
│                  Electron 主进程 (Main)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Window 管理  │  │  Sidecar 管理 │  │   PTY 终端   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │  自动更新     │  │  密钥链访问   │                          │
│  └──────────────┘  └──────────────┘                          │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdio
                            │ JSON-RPC 2.0
┌───────────────────────────▼─────────────────────────────────┐
│                    Go Sidecar Kernel                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Provider  │  │  Cache   │  │  Agent   │  │  Tools   │    │
│  │   层     │  │ Monitor  │  │  Planner │  │ (fs/sh)  │    │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤    │
│  │  Cost    │  │ Context  │  │  Memory  │  │  MCP     │    │
│  │ Tracker  │  │ 5-Layer  │  │ (EXTERNAL)│  │ Client   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**通信方式：**
- Vue 前端 ↔ Electron 主进程：Electron IPC + contextBridge
- Electron 主进程 ↔ Go Kernel：stdio 管道上的 JSON-RPC 2.0 协议

---

## 技术栈

### 环境要求

- **Node.js >= 22.x**（强制要求，推荐 22 LTS）
- **pnpm >= 9.x**（统一包管理器，不支持 npm/yarn）
- **Go >= 1.22**（编译 Sidecar Kernel）
- **Git >= 2.x**
- Windows 10+ / macOS 12+ / Ubuntu 20.04+

### 前端层

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 31.x | 桌面应用框架 |
| Vue | 3.4.x | UI 框架（Composition API + `<script setup>`） |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Tailwind CSS | 3.x | 原子化 CSS（手写样式，不引入组件库） |
| Pinia | 2.x | 状态管理 |
| Vue Router | 4.x | 路由管理 |
| CodeMirror 6 | - | 代码编辑/Diff查看（开发中）|
| xterm.js | - | 终端面板（开发中）|
| Marked + highlight.js | - | Markdown 渲染与代码高亮 |

### 后端内核 (Go Sidecar)

| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.22 | 内核开发语言 |
| JSON-RPC | 2.0 | 进程间通信协议 |
| go-keyring | - | 系统密钥链访问（开发中）|

**Go 内核零依赖原则**：除 keyring 外，全部使用标准库（os/io/filepath/regexp/net/http/encoding/json）。

### 测试

| 框架 | 用途 |
|------|------|
| Vitest + @vue/test-utils | 前端单元/组件测试 |
| Go testing | 后端内核单元测试 |
| Playwright | E2E 端到端测试（计划中）|

---

## 支持模型

### DeepSeek

| 模型 | 输入价格 | 输出价格 | 缓存命中价格 | 特点 |
|------|---------|---------|-------------|------|
| **DeepSeek V4 Flash** | $0.014/百万tokens（约¥0.1）| $0.028/百万tokens | $0.0014/百万tokens | 极速、低成本，日常首选 |
| **DeepSeek V4 Pro** | $0.14/百万tokens | $0.28/百万tokens | $0.014/百万tokens | 高性能、复杂推理 |

### 豆包（火山引擎）

| 模型 | 输入价格 | 输出价格 | 特点 |
|------|---------|---------|------|
| **Doubao 1.6 Flash** | ¥0.08/百万tokens | ¥0.20/百万tokens | 超低成本、响应迅速 |
| **Doubao 1.6 Pro** | ¥0.80/百万tokens | ¥2.00/百万tokens | 均衡性能、中文优化 |

### OpenAI 兼容（本地/第三方）

| Provider | 说明 |
|----------|------|
| **Ollama** | 本地模型服务，自动检测 localhost:11434 |
| **LM Studio** | 本地模型服务，自动检测 localhost:1234 |
| **OpenRouter** | 聚合多个模型服务商 |
| **Groq / Anthropic / Google / xAI / Mistral / Cerebras** | 计划接入 |

> 定价信息更新于 2025 年 6 月，请以官方最新定价为准。

---

## 快速开始

请参阅 [安装使用手册](docs/INSTALL.md) 获取详细的环境搭建和运行指南。

### 快速预览

```bash
# 前置条件：Node.js >= 22, pnpm >= 9, Go >= 1.22
node --version   # v22.x.x
pnpm --version   # 9.x.x
go version       # go1.22+

# 1. 克隆项目并安装依赖（.npmrc 已配置国内镜像）
pnpm install

# 2. 编译 Go kernel（Windows）
pnpm build:kernel
# macOS: pnpm build:kernel:darwin
# Linux: pnpm build:kernel:linux

# 3. 配置 API Key（首次启动后在设置页面配置，存储在系统密钥链）

# 4. 启动开发模式
pnpm dev
```

### 常用命令

```bash
pnpm dev              # 启动开发模式（Vite + Electron）
pnpm build            # 生产构建（类型检查 + Vite构建 + Electron打包）
pnpm build:kernel     # 编译 Windows Go Kernel
pnpm test             # 运行前端单元测试
pnpm test:kernel      # 运行 Go Kernel 测试
pnpm test:all         # 运行所有测试
pnpm test:coverage    # 前端测试覆盖率
pnpm exec tsc --noEmit # TypeScript 类型检查
```

---

## 项目状态

**当前版本：v0.1.0（开发中）**

### 已完成（v0.1）

- ✅ 基础 Electron + Vue 3 项目框架（pnpm + Node 22）
- ✅ Go Sidecar Kernel 基础架构（零依赖原则）
- ✅ DeepSeek Provider 接入
- ✅ 豆包（火山引擎）Provider 接入
- ✅ 缓存监控核心模块（命中率+三色灯+诊断建议）
- ✅ 费用统计核心模块（实时计算+预算告警+Flash-First路由）
- ✅ 对话系统基础功能
- ✅ JSON-RPC 2.0 IPC 通信链路
- ✅ 基础单元测试覆盖（Go + Vitest）
- ✅ TDD 开发规范与测试金字塔

### 开发中（v0.2 - 融合 Terax P0 功能）

- 🔄 OS Keychain 密钥存储（go-keyring）
- 🔄 Shell 工具 + 审批门控
- 🔄 文件系统工具（read/write/edit/grep/glob/list）
- 🔄 Plan 模式（先规划后执行）
- 🔄 CodeMirror 6 Diff 查看器（hunk accept/reject）
- 🔄 项目记忆文件（TRAULTRA.md + 兼容 TERAX.md/CLAUDE.md）
- 🔄 OpenAI 兼容 Provider（Ollama/LM Studio 本地模型支持）

### 计划中（v0.3+）

- 📋 终端面板（xterm.js + node-pty）
- 📋 后台进程管理
- 📋 文件浏览器（fuzzy search）
- 📋 Web Preview
- 📋 Git 基础操作（status/diff/hunk stage/commit）
- 📋 MCP 协议客户端
- 📋 Commit Graph 可视化
- 📋 Agent Hooks（OSC 777）
- 📋 自定义 Agent 配置
- 📋 Playwright E2E 测试
- 📋 更多模型 Provider（Anthropic/Groq/Google/xAI）
- 📋 生产构建与自动更新

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [安装使用手册](docs/INSTALL.md) | 环境要求、pnpm 搭建步骤、配置说明、故障排查 |
| [功能清单](docs/FEATURES.md) | 按模块分类的完整功能列表与实现状态 |
| [测试文档](docs/TESTING.md) | TDD 方法论、测试框架、测试命令与编写规范 |
| [可扩展性说明](docs/EXTENDING.md) | 添加模型、工具、MCP服务、前端组件的扩展指南 |
| [详细架构文档](docs/ARCHITECTURE.md) | 五层上下文、Go Kernel、IPC协议、缓存优化策略详解 |
| [Terax AI 深度分析](docs/TERAX_ANALYSIS.md) | Terax AI 源码架构分析（技术栈、核心模块、流程图）|
| [TRAE Ultra × Terax 融合分析](docs/FUSION_ANALYSIS.md) | 功能对比、优胜略汰策略、融合 Roadmap |
| [Reasonix 架构参考](Reasonix.md) | Reasonix 缓存优先架构原始设计文档 |
| [TRAE WORK CN 融合方案](TRAE_WORK_CN.md) | TRAE Work CN 能力融合设计文档 |

---

## 设计理念

TRAE Ultra 的设计哲学来自对优秀开源项目的借鉴与融合：

- **来自 [Terax](https://github.com/crynta/terax-ai)**：Terminal-first IDE 体验、Tauri/Rust 性能优化、Agent Hooks、CodeMirror Diff、OS Keychain、Plan 模式
- **来自 Reasonix**：Cache-First Loop、缓存命中率监控、费用透明、三层上下文（演进为五层）
- **来自 TRAE**：Chat-first 交互、MCP 生态、Skills 系统、三端协同

我们以 **"优胜略汰"** 为原则，保留自身核心差异化（缓存监控+费用透明+五层上下文），吸收 Terax 的优秀工程实践（终端/文件/Git/Keychain/Plan/Diff），坚持 Vue3 技术栈和 Electron+Go Sidecar 架构选择，打造一个真正让开发者"看得清花费、控得住上下文、用得趁手"的 AI 工作台。

---

## License

MIT
