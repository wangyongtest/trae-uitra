# TRAE Ultra × Terax 功能融合分析（优胜略汰）

> 基于对 [Terax v0.8.2](https://github.com/crynta/terax-ai) 源码的深度分析，
> 以"优胜略汰"原则评估其功能与 TRAE Ultra 的融合价值。

---

## 一、双方基因对比

| 维度 | TRAE Ultra (我们) | Terax | 优势方 |
|------|-------------------|-------|--------|
| **核心哲学** | Chat-first + 缓存优先 + 费用透明 | Terminal-first + IDE-like + AI侧边面板 | 各有定位 |
| **桌面框架** | Electron + Go Sidecar | Tauri 2 + Rust 原生 | ⚡ Terax（体积7-8MB vs 100MB+）|
| **前端框架** | Vue 3 + 手写Tailwind | React 19 + shadcn/ui + Tailwind v4 | 既定选择（Vue）|
| **后端语言** | Go 1.22（零依赖） | Rust（Tauri原生）| 🤝 各自合适 |
| **AI SDK** | 自研 Provider 层 | Vercel AI SDK v6 | ⚡ Terax（生态成熟）|
| **缓存监控** | ✅ 命中率+三色灯+诊断 | ❌ 无 | ✅ TRAE Ultra |
| **费用透明** | ✅ 实时计算+预算告警 | ❌ 无 | ✅ TRAE Ultra |
| **终端** | ❌ 无 | ✅ WebGL PTY+分屏+WSL | ⚡ Terax |
| **代码编辑** | ❌ 无 | ✅ CodeMirror 6+Vim+Diff | ⚡ Terax |
| **Git集成** | ❌ 无 | ✅ hunk级stage+Graph | ⚡ Terax |
| **文件浏览** | ❌ 无 | ✅ Fuzzy搜索+图标+监听 | ⚡ Terax |
| **密钥存储** | 配置文件（JSON） | OS Keychain | ⚡ Terax |
| **审批门控** | 规划中 | ✅ Bash危险操作审批 | ⚡ Terax |
| **本地模型** | 豆包/DeepSeek云 | ✅ LM Studio/MLX/Ollama | ⚡ Terax |
| **Provider数量** | 4（DeepSeek×2 + 豆包×2） | 10+（OpenAI/Anthropic/Google/Groq/xAI/Cerebras/OpenRouter/DeepSeek/Mistral/本地） | ⚡ Terax |
| **项目记忆** | External Memory层（规划）| TERAX.md文件 | 🤝 可融合 |
| **Plan模式** | 规划中 | ✅ 已实现 | ⚡ Terax |
| **子Agent** | Isolated层（规划）| SDK级别sub-agent | ⚡ TRAE Ultra（进程隔离更安全）|
| **Diff编辑** | 无 | ✅ CodeMirror hunk accept/reject | ⚡ Terax |
| **CLI Agent Hooks** | 无 | ✅ Claude Code/Codex/Gemini OSC集成 | ⚡ Terax |
| **自动更新** | electron-builder | tauri-plugin-updater | 各有方案 |
| **Biome工具链** | ESLint/Prettier | Biome（快10-100x） | ⚡ Terax |
| **MCP协议** | 规划中 | ❌ 无 | ✅ TRAE Ultra（规划更前瞻）|
| **TDD** | ✅ Go+Vitest双测试 | ✅ Rust+Vitest（proptest）| 🤝 相当 |
| **TypeScript版本** | ~5.4 | ~6.0（最新） | ⚡ Terax |

---

## 二、融合策略：三大原则

### 原则1：保留 TRAE Ultra 的核心差异化优势（🏆 我方优胜）

以下是 TRAE Ultra 的"护城河"功能，必须保留并强化：

| 功能 | 理由 | 融合动作 |
|------|------|---------|
| **缓存命中率监控** | Terax 完全没有，是 Reasonix 核心价值 | ✅ 保留并增强，加入 Terax 的终端/编辑器操作的缓存影响分析 |
| **五层上下文架构** | SYSTEM/EPISODIC/SCRATCHPAD/EXTERNAL/SUB-AGENT 比 Terax 扁平对话更先进 | ✅ 保留，TERAX.md 作为 EXTERNAL MEMORY 层的文件实现 |
| **费用透明+预算告警** | Terax 无此功能，是区别于所有AI IDE的核心差异化 | ✅ 保留，扩展支持更多 Provider 的定价 |
| **Go Sidecar 的缓存优化策略** | 12项缓存优化（确定性序列化/前缀锁定/动态隔离）| ✅ 保留Go内核的缓存模块，作为可复用库 |
| **Vue3 技术栈** | 用户已明确选择 | ✅ 保持 Vue3，Terax 的 React 组件思路可借鉴但不照搬 |
| **MCP协议支持** | 开放生态，Terax尚未支持 | ✅ 优先实现MCP，抢占生态位 |
| **进程级子Agent隔离** | Terax 是 SDK 级，我们是进程级更安全 | ✅ 保留架构设计 |

### 原则2：吸收 Terax 的优秀功能（⚡ 对方优胜，"拿来主义"）

以下是 Terax 明显更优秀的功能，需要在 TRAE Ultra 中实现：

#### P0 - 核心必做（直接决定产品可用性）

| Terax功能 | 价值 | 在TRAE Ultra中的实现方案 |
|-----------|------|------------------------|
| **OS Keychain密钥存储** | 安全必备，不写入磁盘 | Go库：`github.com/zalando/go-keyring`（替换JSON配置文件存key）|
| **Bash/Shell工具+审批门控** | Agent 执行命令的基础能力 | Go kernel shell模块 + 前端审批弹窗（accept/reject）|
| **文件系统工具（read/write/edit/grep/glob）** | Agent 操作文件的基础 | Go kernel fs模块（用filepath+标准库实现，参考terax的grep-regex但保持零依赖）|
| **Plan模式** | 多步任务先规划再执行 | Go Agent层实现plan→confirm→execute流程 |
| **CodeMirror 6代码查看器** | diff查看、代码高亮、文件浏览 | 引入CodeMirror 6作为Vue组件（不替换聊天界面，作为工具结果展示）|
| **Diff Hunk编辑** | AI修改文件时逐块accept/reject | CodeMirror merge插件 + Vue组件封装 |
| **Vercel AI SDK思维迁移** | 10+ Provider快速接入 | 在Go端参考其tool calling模式；前端不引入SDK（Vue生态），但Go端扩展Provider注册表 |
| **项目记忆文件** | 简单有效的持久上下文 | EXTERNAL MEMORY层实现为`TRAEULTRA.md`（兼容TERAX.md/CLAUDE.md/.cursorrules自动读取）|

#### P1 - 高价值（显著提升体验）

| Terax功能 | 价值 | 实现方案 |
|-----------|------|---------|
| **终端面板** | 真正的PTY终端是开发者刚需 | ⚠️ 重大决策：**采用Tauri重写桌面端**？或用Node-pty + xterm.js在Electron中实现？（见下方决策）|
| **本地模型支持** | Ollama/LM Studio离线使用 | Go Provider增加OpenAI-compatible endpoint，自动检测localhost:11434 |
| **后台进程管理** | 启动dev server等长时间任务 | Go shell_bg模块 + 前端进程列表面板 |
| **Commit Graph** | 可视化Git历史 | 可后续引入，优先级低于终端 |
| **Web Preview** | 预览本地dev server | Electron webview 实现成本低 |
| **Biome替代ESLint** | 更快的lint/format | pnpm scripts加入biome（但保持ESLint兼容性）|
| **TypeScript 6 + Vite 8** | 更现代的构建链 | 升级前端依赖版本 |

#### P2 - 锦上添花

| Terax功能 | 价值 | 实现方案 |
|-----------|------|---------|
| **Agent Hooks（OSC 777）** | 与Claude Code等CLI工具集成 | 在终端模块实现OSC序列检测 |
| **自定义Agent** | 不同任务用不同system prompt | Settings中预设Agent配置 |
| **Composer语法** | @文件、#片段、/命令 | 输入框增强 |
| **Voice输入** | 语音输入 | Web Speech API（浏览器原生）|
| **模糊文件搜索** | Ctrl+P快速打开 | Nucleo风格fuzzy finder（前端实现）|
| **主题系统** | 自定义主题+背景图 | 完善Tailwind主题配置 |

### 原则3：框架层面的决策——保留 Electron 还是迁移 Tauri？

这是最关键的架构决策，必须**先询问用户**（这是代码改动）。

**但先给出分析**：

| 维度 | Electron + Go Sidecar（当前） | Tauri 2 + Rust（Terax方案）|
|------|-------------------------------|---------------------------|
| 包体积 | ~120-150 MB | ~7-15 MB |
| 内存占用 | 较高（Chromium多进程） | 较低（系统WebView） |
| 启动速度 | 较慢 | 较快 |
| 生态成熟度 | ✅ 非常成熟，插件丰富 | ⚠️ Tauri 2已稳定但生态仍在成长 |
| 系统API | Node.js生态丰富 | Rust crate更安全但学习曲线陡 |
| 现有Go代码 | ✅ 内核已写好 | ❌ 需要用Rust重写（大量工作）|
| 终端PTY | node-pty成熟 | portable-pty Rust crate更优 |
| 自动更新 | electron-builder内置 | tauri-plugin-updater |
| 跨平台一致性 | ✅ Chromium保证一致 | ⚠️ WebView差异（Windows WebView2/macOS WKWebKit/Linux WebKitGTK）|
| 前端集成 | 完全一致 | 完全一致 |
| 开发体验 | 前端开发者熟悉 | 需要Rust知识 |

**建议（待用户确认）**：

> **阶段一（短期，当前里程碑）**：保留 Electron + Go Sidecar 架构不变，先在Electron内引入xterm.js+node-pty实现终端，用Node.js的`keytar`模块替代JSON存key（类似Terax的keyring），用CodeMirror 6做代码diff查看器。
>
> **阶段二（中期，v0.3+评估）**：如果Go kernel的缓存优势验证完毕且团队希望减小包体积，可以评估迁移到Tauri 2，但**Go代码的核心价值（缓存策略、五层上下文、费用计算）编译为CGo或重写为Rust模块**。

---

## 三、融合后的 TRAE Ultra 功能矩阵（Roadmap）

```
TRAE Ultra v0.1 (当前)          TRAE Ultra v0.2 (融合P0)        TRAE Ultra v0.3 (融合P1)
─────────────────────          ────────────────────────         ────────────────────────
✅ Vue3 + Tailwind              ✅ OS Keychain密钥存储           ✅ 终端面板（xterm.js）
✅ Electron + Go Sidecar        ✅ Shell工具+审批门控            ✅ 本地模型(Ollama/LM Studio)
✅ 缓存命中率监控               ✅ 文件系统工具(rw/grep/glob)     ✅ 后台进程管理
✅ 费用计算+预算告警            ✅ Plan模式（先规划后执行）       ✅ 文件浏览器
✅ 4 Provider(DeepSeek/豆包)    ✅ CodeMirror Diff编辑器         ✅ Web Preview
✅ 五层上下文架构               ✅ 项目记忆文件                  ✅ Git基础集成
✅ TDD测试框架                  ✅ 10+ Provider接入              ✅ MCP协议支持
✅ JSON-RPC通信链路             ✅ hunk级accept/reject           ✅ Agent Hooks(OSC 777)
                               ✅ 内存安全(Keychain)            ✅ Biome工具链
```

---

## 四、具体模块融合映射

### 4.1 密钥存储（替换JSON配置）

```
当前方案（JSON文件）:
  ~/.trae-ultra/config.json → {"api_keys": {"deepseek": "sk-xxx"}}
  
融合后方案（OS Keychain）:
  Windows: Credential Manager (via go-keyring or keytar native module)
  macOS:   Keychain.app
  Linux:   Secret Service API (gnome-keyring/kwallet)
  
实现路径：Go kernel增加secrets包，使用keyring crate的Go等价物
  Go库选择: github.com/zalando/go-keyring (纯Go, 跨平台)
```

### 4.2 文件系统工具（Go kernel扩展）

```
参照 Terax Rust fs 模块，在Go kernel/internal/tool/builtin 中实现：
  tool_read_file(path)       → 读取文件内容
  tool_write_file(path,content) → 写入文件
  tool_edit_file(path,edits) → 编辑文件（diff）
  tool_grep(pattern,dir)     → 文件内容搜索（用regexp标准库）
  tool_glob(pattern,dir)     → 文件匹配（用filepath.Glob）
  tool_list_dir(path)        → 目录列表
  tool_shell(command)        → 执行命令（需用户审批）
  
零依赖实现：全部用Go标准库（os, io, filepath, regexp）
```

### 4.3 项目记忆文件（EXTERNAL MEMORY层实现）

```
查找顺序（优先级）:
  1. .trae-ultra/TRAULTRA.md  （我们专属）
  2. TRAEULTRA.md             （项目根）
  3. TERAX.md                 （Terax兼容）
  4. CLAUDE.md                （Claude Code兼容）
  5. .cursorrules             （Cursor兼容）
  6. .github/copilot-instructions.md （Copilot兼容）

读取后注入 EXTERNAL MEMORY 上下文层，实现跨工具项目记忆。
```

### 4.4 Plan模式工作流

```
用户发送消息
    │
    ▼
┌──────────────┐
│ 是否需要Plan │ ← 简单问题直接回答（Flash模型快速响应）
└──────┬───────┘
       │ 复杂任务（多文件/多步/高风险）
       ▼
┌──────────────┐
│ 生成执行计划  │ ← Pro/Reasoning模型生成步骤列表
│ 1. ...       │
│ 2. ...       │
│ 3. ...       │
└──────┬───────┘
       │ 展示给用户
       ▼
┌──────────────┐
│ 用户确认/修改 │ ← 可以删减步骤、调整顺序
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 逐步执行     │ ← 每步工具调用前再次确认（特别是Bash）
│ 展示进度     │
│ 支持中止     │
└──────────────┘
```

---

## 五、不建议吸收的 Terax 功能（淘汰）

| 功能 | 不吸收理由 |
|------|-----------|
| **React 19 替换 Vue3** | 用户已明确选择Vue，切换成本极高且无实质收益 |
| **Tauri 替换 Electron** | Go kernel代码量可观，重写为Rust投入产出比低；阶段二再评估 |
| **shadcn/ui 组件库** | 用户要求纯Tailwind手写，不引入组件库 |
| **Tailwind v4** | v3稳定且生态完善，v4尚在早期；后续升级 |
| **Zustand 替换 Pinia** | Pinia是Vue官方推荐，Zustand是React生态 |
| **直接嵌入终端作为主界面** | TRAE Ultra定位是Chat-first工作台，终端作为工具面板而非主界面 |
| **Biome 完全替代 ESLint** | 可以同时使用，不必强制替换；Biome可作补充 |
| **pnpm overrides 强制版本** | 正常使用pnpm即可 |

---

## 六、融合优先级排序（实施建议）

```
Sprint 1 (v0.2 P0 - 核心Agent能力):
  1. Go keyring 密钥存储（替换JSON明文）
  2. Shell 工具 + 审批门控
  3. 文件系统工具（read/write/grep/glob/list）
  4. Plan 模式
  5. 前端Diff查看（CodeMirror 6）
  6. 扩展Provider（新增OpenAI-compatible支持→自动支持Ollama/LM Studio）
  7. 项目记忆文件（TRAULTRA.md + 兼容读取）

Sprint 2 (v0.3 P1 - 开发者体验):
  8. 终端面板（xterm.js + node-pty in Electron）
  9. 后台进程管理
  10. 文件浏览器（fuzzy search）
  11. Web Preview（Electron webview）
  12. Git基础操作（status/diff/commit）
  13. MCP协议客户端

Sprint 3 (v0.4 P2 - 高级特性):
  14. Commit Graph可视化
  15. Agent Hooks（OSC 777）
  16. 自定义Agent配置
  17. Composer语法增强（@/#/命令）
  18. 主题系统完善
  19. Voice输入

长期评估:
  20. 评估Tauri 2迁移（Go→Rust重写成本 vs 体积/性能收益）
  21. 移动端适配
```

---

## 七、总结：融合后的产品定位

**融合后的 TRAE Ultra** = 

```
TRAE Ultra 灵魂（缓存优先+费用透明+五层上下文）
  + Terax 血肉（终端+文件+Git+Plan+Diff+Keychain+10+Provider）
  + Vue3 骨架（保持用户选择）
  + Electron+Go 体格（阶段一保留）
  + TDD 开发方式（持续坚持）
```

**差异化卖点**（vs Terax / Cursor / Windsurf / Claude Desktop）：
1. **唯一具备缓存命中率监控+费用优化**的AI工作台
2. **五层上下文架构**比扁平对话更适合长周期任务
3. **进程级子Agent隔离**比SDK级更安全
4. **终端+Chat双模**，既可聊天也可命令行操作
5. **MCP开放生态**提前布局
