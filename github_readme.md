<div align="center">
  <h1>⚡ TRAE Ultra</h1>
  <p><strong>Chat-first AI-native development workbench with cache optimization & cost transparency.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0--dev-blue" alt="version" />
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="platform" />
    <img src="https://img.shields.io/badge/Node-22%2B-green" alt="node" />
    <img src="https://img.shields.io/badge/pnpm-9%2B-orange" alt="pnpm" />
    <img src="https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go" alt="go" />
    <img src="https://img.shields.io/badge/license-MIT-yellow" alt="license" />
  </p>
  <p>
    <a href="#features">Features</a>
    ·
    <a href="#architecture">Architecture</a>
    ·
    <a href="#install">Install</a>
    ·
    <a href="#build-from-source">Build</a>
    ·
    <a href="#tech-stack">Tech Stack</a>
    ·
    <a href="docs/FUSION_ANALYSIS.md">Fusion Analysis</a>
  </p>
</div>

---

TRAE Ultra is a chat-first open-source AI development workbench built on **Electron + Go Sidecar + Vue 3**. It combines Reasonix's cache-first architecture with Terax's terminal/IDE capabilities into a unified experience. Unique features: real-time prompt cache hit-rate monitoring, transparent cost tracking with budget alerts, five-layer context management, and a high-performance Go kernel with zero external dependencies. API keys are stored in the OS keychain — never on disk or localStorage. No telemetry. No account required.

```
     Cache Hit Rate        Cost Today       Budget
     ━━━━━━━━━━━━━░░ 92%   $0.034 / $5.00   ███░░░░░░ 68% remaining
     🟢 Excellent
```

## Screenshots

> Screenshots coming soon. The UI follows a clean dark-first design inspired by modern AI coding assistants.

## Features

### Chat & AI Agent

- **Chat-first interface** with streaming responses, Markdown rendering, and syntax highlighting
- **Plan mode**: multi-step tasks generate an execution plan for confirmation before running
- **Agentic workflow**: file read/write/edit/grep/glob, shell execution with approval gating, background processes
- **Sub-agent isolation**: process-level isolated sub-agents for complex multi-task scenarios
- **Tool-call repair**: automatic detection and recovery from failed tool calls
- **Project memory**: auto-loads `TRAEULTRA.md`, `TERAX.md`, `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md` as project context
- **Custom agents** with their own system prompt and tool subsets
- **Composer syntax**: reference files via `@path`, snippets via `#handle`, slash commands

### Cache Hit-Rate Monitoring (Reasonix core)

- Real-time prompt cache hit-rate tracking with three-color status indicator (🟢 excellent / 🟡 warning / 🔴 critical)
- Historical trend charts powered by ECharts
- Diagnostic suggestions when hit rate drops below target
- 12 cache optimization strategies: prefix locking, deterministic JSON serialization, dynamic content isolation, and more
- Target: **90%+ cache hit rate** on compatible models (DeepSeek, Doubao)

### Cost Transparency (Unique differentiator)

- Real-time token counting and cost calculation per request, per model, per session
- Daily budget with configurable warning thresholds
- Flash-First automatic routing: simple tasks use low-cost Flash models automatically
- Cost breakdown by input/output/cached tokens — every cent is visible
- Estimated savings display from cache hits

### Five-Layer Context Architecture

```
┌─────────────────────────────────────────┐
│ L5  ISOLATED SUB-AGENTS    (ephemeral)  │  ← Process-isolated task agents
├─────────────────────────────────────────┤
│ L4  EXTERNAL MEMORY        (per-project)│  ← TRAEULTRA.md, MCP servers, files
├─────────────────────────────────────────┤
│ L3  WORKING SCRATCHPAD     (current turn)│  ← Active reasoning, tool results
├─────────────────────────────────────────┤
│ L2  EPISODIC LOG           (per-session)│  ← Conversation history (compacted)
├─────────────────────────────────────────┤
│ L1  SYSTEM FOUNDATION      (immutable)  │  ← System prompt, provider config
└─────────────────────────────────────────┘
```

### Terminal (in development)

- xterm.js with WebGL renderer, multi-tab support
- Native PTY backend (zsh, bash, pwsh, fish, cmd)
- Split panels (horizontal and vertical)
- WSL as first-class workspace environment on Windows
- Background process management for dev servers
- Agent Hooks (OSC 777) for CLI agent integration (Claude Code, Codex, Gemini CLI)

### Code Editor (in development)

- CodeMirror 6 editor with language support for TS/JS, Rust, Python, Go, C/C++, Java, HTML/CSS, JSON, Markdown, etc.
- AI edit diffs with hunk-by-hunk accept/reject
- Vim mode
- Built-in editor themes matching the app theme

### Source Control (planned)

- Stage/unstage hunks, commit with upstream awareness
- Branch display including detached HEAD state
- Commit history with graph rendering for merges and branches
- Commit search and filter

### File Explorer (planned)

- Icon theme with file type detection
- Fuzzy search (Ctrl+P) with keyboard navigation
- Context actions and inline rename
- Attach files directly to AI context

### Web Preview (planned)

- Auto-detect local dev servers and open in preview tab
- External URL preview via Electron webview

### Security

- API keys stored in OS native keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service)
- Shell command execution requires explicit user approval (accept/reject per command)
- No telemetry, no account, no data leaving your machine except LLM API calls
- Go kernel sandboxed from renderer process via stdio JSON-RPC

### AI Providers

- **Cloud BYOK:** DeepSeek (V4 Flash/Pro), Doubao/Volcengine (1.6 Flash/Pro), OpenAI, Anthropic, Google (Gemini), Groq, xAI (Grok), Cerebras, OpenRouter, Mistral
- **Local/offline:** Ollama, LM Studio, any OpenAI-compatible endpoint
- Models are routed automatically (Flash-First) or selectable manually

## Architecture

TRAE Ultra uses a Sidecar pattern with three layers communicating via JSON-RPC 2.0:

```
┌─────────────────────────────────────────────────────────────┐
│                     Vue 3 Frontend (Renderer)               │
│  Chat │ Cache Monitor │ Cost Stats │ Terminal │ Editor      │
└───────────────────────────┬─────────────────────────────────┘
                            │ Electron IPC (contextBridge)
┌───────────────────────────▼─────────────────────────────────┐
│                  Electron Main Process                      │
│  Window Mgmt │ Sidecar Lifecycle │ PTY │ Keychain │ Updater │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdio JSON-RPC 2.0
┌───────────────────────────▼─────────────────────────────────┐
│                   Go Sidecar Kernel                         │
│  Provider │ Cache Monitor │ Agent Planner │ Tools (fs/sh)   │
│  Cost Tracker │ 5-Layer Context │ Memory │ MCP Client       │
└─────────────────────────────────────────────────────────────┘
```

**Design principles:**
- **Go kernel zero-dependency**: core logic uses only Go standard library (os, io, net/http, encoding/json, regexp)
- **Process isolation**: Go kernel runs as a separate child process; crashes don't bring down the UI
- **Testable by design**: all core logic is unit-testable without UI or network
- **TDD development**: Red-Green-Refactor cycle with 70/20/10 test pyramid

## Install

Latest installers will be available on the [Releases](../../releases) page once v0.1.0 is released.

### Windows notes

- On first launch Windows may show "Windows protected your PC" because the app isn't code-signed yet. Click **More info** then **Run anyway**.
- Default shell: `pwsh.exe` (PowerShell 7+) → `powershell.exe` → `cmd.exe`.
- WSL distros are supported as workspace environments.

### macOS notes

- App is notarized in future releases. For development builds, right-click → Open to bypass Gatekeeper.

### Linux notes

- AppImage builds require FUSE. Without it: `./trae-ultra-*.AppImage --appimage-extract-and-run`.
- `.deb` / `.rpm` packages link against system libraries for smoother integration.

## Configure AI

1. Open **Settings → Models**.
2. Pick a provider and paste your API key. For local inference, point TRAE Ultra at your Ollama / LM Studio endpoint (auto-detected on default ports).
3. Keys are written to the OS keychain. They never touch disk or localStorage.
4. Optionally set a daily budget limit and cache hit-rate target.

## Build from source

### Prerequisites

- **[Go](https://go.dev/dl/)** 1.22 or later (for the kernel)
- **[Node.js](https://nodejs.org/)** 22.x LTS or later
- **[pnpm](https://pnpm.io/)** 9.x or later (unified package manager; npm/yarn not supported)
- **[Git](https://git-scm.com/)** 2.x
- Platform-specific build tools for Electron (Windows: Visual Studio Build Tools; macOS: Xcode CLT; Linux: build-essential, libgtk-3-dev)

### Install pnpm

```bash
# Using corepack (built into Node.js 22+)
corepack enable
corepack prepare pnpm@latest --activate
```

### Run (development)

```bash
# 1. Install dependencies
pnpm install

# 2. Build the Go kernel (Windows)
pnpm build:kernel
# macOS:   pnpm build:kernel:darwin
# Linux:   pnpm build:kernel:linux

# 3. Start development mode (Vite + Electron)
pnpm dev
```

### Build (production)

```bash
# Type-check + Vite build + Electron packaging
pnpm build
```

Build outputs are placed in `release/`:
- Windows: `release/Trae Ultra Setup x.x.x.exe` (NSIS installer)
- macOS: `release/Trae Ultra-x.x.x.dmg`
- Linux: `release/Trae Ultra-x.x.x.AppImage` / `.deb` / `.rpm`

### Checks & Tests

```bash
# Frontend type-check
pnpm exec tsc --noEmit

# Frontend unit tests (Vitest)
pnpm test
pnpm test:watch      # watch mode
pnpm test:coverage   # coverage report

# Go kernel tests
pnpm test:kernel
pnpm test:kernel:cover   # HTML coverage report

# All tests
pnpm test:all
```

### Available pnpm scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev mode (Vite + Electron) |
| `pnpm build` | Production build (type-check + Vite + electron-builder) |
| `pnpm build:kernel` | Build Windows Go kernel |
| `pnpm build:kernel:darwin` | Build macOS Go kernel |
| `pnpm build:kernel:linux` | Build Linux Go kernel |
| `pnpm test` | Run frontend tests (single run) |
| `pnpm test:watch` | Run frontend tests (watch mode) |
| `pnpm test:coverage` | Frontend test coverage report |
| `pnpm test:kernel` | Run Go kernel tests |
| `pnpm test:kernel:cover` | Go kernel HTML coverage |
| `pnpm test:all` | Run all tests |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Desktop** | Electron 31, electron-builder, node-pty (planned) |
| **Frontend** | Vue 3 (Composition API, `<script setup>`), TypeScript 5, Vite 5, Tailwind CSS 3, Pinia, Vue Router 4 |
| **Editor/Terminal** | CodeMirror 6, xterm.js (planned) |
| **Charts** | ECharts 5, vue-echarts |
| **Markdown** | markdown-it, highlight.js |
| **Kernel** | Go 1.22 (zero external dependencies except go-keyring), JSON-RPC 2.0 over stdio |
| **Testing** | Vitest, @vue/test-utils, Go testing (standard library), Playwright (planned) |
| **Package manager** | pnpm 9+ (unified) |

## Project Structure

```
desktop/
├── electron/           # Electron main process
│   ├── main.ts         # Main entry, window creation
│   ├── preload.ts      # contextBridge API exposure
│   └── sidecar/        # Go sidecar lifecycle + JSON-RPC
├── kernel/             # Go Sidecar Kernel
│   ├── main.go         # Entry point
│   ├── internal/
│   │   ├── cache/      # Cache hit-rate monitor, token counter
│   │   ├── provider/   # LLM provider registry (DeepSeek, Doubao, etc.)
│   │   ├── stats/      # Cost tracking, budget alerts
│   │   ├── server/     # JSON-RPC server over stdio
│   │   ├── agent/      # Agent planner, context management
│   │   ├── tool/       # Built-in tools (fs, shell)
│   │   ├── memory/     # External memory (project files)
│   │   └── secrets/    # OS keychain wrapper
│   └── go.mod
├── src/                # Vue 3 renderer
│   ├── components/     # UI components (chat, monitors, panels)
│   ├── composables/    # Vue composables (useIPC, useChat, etc.)
│   ├── stores/         # Pinia stores (chat, cache, cost, settings)
│   ├── views/          # Page views (Chat, Settings, Stats)
│   ├── types/          # TypeScript type definitions
│   └── assets/         # Static assets (icons, styles)
├── resources/          # Binary resources (kernel.exe, icons)
├── tests/              # Frontend unit tests (Vitest)
├── docs/               # Documentation
│   ├── ARCHITECTURE.md # Detailed architecture
│   ├── INSTALL.md      # Installation guide
│   ├── FEATURES.md     # Feature list
│   ├── TESTING.md      # TDD guide
│   ├── TERAX_ANALYSIS.md  # Terax source analysis
│   └── FUSION_ANALYSIS.md # TRAE × Terax fusion strategy
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── .npmrc
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Five-layer context, Go kernel, IPC protocol, cache optimization strategies |
| [Installation Guide](docs/INSTALL.md) | Environment setup, pnpm install steps, configuration, troubleshooting |
| [Feature List](docs/FEATURES.md) | Complete feature matrix with implementation status |
| [Testing Guide](docs/TESTING.md) | TDD methodology, test pyramid, commands, writing conventions |
| [Extensibility](docs/EXTENDING.md) | Adding models, tools, MCP servers, frontend components |
| [Terax Analysis](docs/TERAX_ANALYSIS.md) | Deep analysis of [Terax](https://github.com/crynta/terax-ai) architecture and design highlights |
| [Fusion Analysis](docs/FUSION_ANALYSIS.md) | TRAE Ultra × Terax feature comparison and integration roadmap |

## Design Philosophy

TRAE Ultra draws inspiration from several excellent open-source projects:

- **From [Terax](https://github.com/crynta/terax-ai)**: terminal-first IDE experience, Tauri/Rust performance lessons, CodeMirror diff workflow, OS keychain storage, Plan mode, agent hooks, multi-provider support
- **From Reasonix**: Cache-First Loop, hit-rate monitoring, cost transparency, three-layer context (evolved to five layers)
- **From TRAE**: Chat-first interaction, MCP ecosystem, Skills system

We follow a **"survival of the fittest"** integration principle:
- **Keep** our core differentiators: cache monitoring, cost transparency, five-layer context, process-level sub-agent isolation, Go kernel zero-dep philosophy
- **Absorb** Terax's proven engineering: terminal, file tools, Git, CodeMirror diff, keychain, Plan mode, 10+ providers, local model support
- **Stay committed** to Vue 3 and Electron + Go Sidecar as the chosen stack (Node.js 22+ and pnpm 9+ unified across the project)

## Roadmap

- **v0.1 (current)**: Core chat, cache monitor, cost tracker, DeepSeek/Doubao providers, Electron+Go Sidecar skeleton, TDD foundation
- **v0.2**: OS Keychain, shell+approval gating, file tools, Plan mode, CodeMirror diff viewer, project memory files, OpenAI-compatible (Ollama/LM Studio)
- **v0.3**: Terminal panel, background processes, file explorer, web preview, Git basics, MCP client
- **v0.4**: Commit graph, Agent Hooks (OSC 777), custom agents, composer syntax, more providers
- **Future**: Tauri 2 migration evaluation, mobile companion, plugin system

## Contributing

Issues and PRs are welcome! Feel free to open issues, suggest features, or submit pull requests.

When contributing:
1. Follow the existing code style (Vue 3 Composition API, Go standard library conventions)
2. Write tests first (TDD) — see [Testing Guide](docs/TESTING.md)
3. Ensure all existing tests pass (`pnpm test:all`)
4. Do not introduce heavy dependencies; Go kernel stays dependency-free (except keyring)
5. Use pnpm exclusively — no npm/yarn lock files

## License

TRAE Ultra is licensed under the **MIT License**.

## Acknowledgments

- [Terax](https://github.com/crynta/terax-ai) — terminal/IDE design inspiration and feature reference
- [Reasonix](https://github.com/) — cache-first architecture and cost transparency concepts
- [TRAE](https://trae.ai) — chat-first interaction model and MCP ecosystem
- [Electron](https://www.electronjs.org/), [Vue 3](https://vuejs.org/), [Go](https://go.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Vitest](https://vitest.dev/), [CodeMirror](https://codemirror.net/), [xterm.js](https://xtermjs.org/)
