# 安装使用手册

> TRAE Ultra 开发环境搭建、配置与生产构建指南

---

## 目录

- [环境要求](#环境要求)
- [开发环境搭建](#开发环境搭建)
- [生产构建](#生产构建)
- [API Key 配置](#api-key-配置)
- [配置文件说明](#配置文件说明)
- [常见问题排查](#常见问题排查)

---

## 环境要求

在开始之前，请确保您的系统已安装以下软件：

| 软件 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| Node.js | **22.x** | **22.x LTS** | JavaScript 运行时（**必须 22+**） |
| pnpm | **9.x** | **11.x** | 包管理器（**统一使用 pnpm，不支持 npm/yarn**） |
| Go | 1.22 | 1.22+ | Go Sidecar Kernel 编译 |
| Git | 2.x | 最新版 | 版本控制（可选） |
| 操作系统 | Windows 10+ / macOS 12+ / Ubuntu 20.04+ | Windows 11 / macOS 14 | 当前主要在 Windows 下开发测试 |

### 验证环境

打开终端（PowerShell / Terminal）执行以下命令验证环境：

```bash
node --version    # 应显示 v22.x.x
pnpm --version    # 应显示 9.x.x 或更高
go version        # 应显示 go1.22 或更高
```

### 安装 pnpm

如果尚未安装 pnpm：

```bash
# 使用 corepack（Node.js 22 内置）
corepack enable
corepack prepare pnpm@latest --activate

# 或使用 npm 全局安装
npm install -g pnpm
```

---

## 开发环境搭建

如果您已经在 `d:\demo\test\desktop` 目录下，可以跳过第 1 步。

### 步骤 1：获取代码

```bash
# 方式一：Git 克隆（如适用）
git clone <repository-url> trae-ultra
cd trae-ultra

# 方式二：直接在已有的 desktop 目录下工作
cd d:\demo\test\desktop
```

### 步骤 2：安装前端依赖

**重要**：项目统一使用 **pnpm** 作为包管理器，请勿使用 npm 或 yarn。

由于 Electron 包较大，国内用户请先设置镜像源以加速下载（`.npmrc` 文件已预配置）。

#### Windows (PowerShell)

```powershell
# 设置 Electron 国内镜像（.npmrc 已配置，如遇问题可手动设置）
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# 使用 pnpm 安装依赖
pnpm install
```

#### macOS / Linux

```bash
# 设置 Electron 国内镜像
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

pnpm install
```

> `.npmrc` 文件中已预配置了国内镜像和 `strict-ssl=false`，如遇下载问题可手动设置上述环境变量。

### 步骤 3：编译 Go Sidecar Kernel

Go Kernel 需要编译为可执行文件，放置在 `resources/` 目录下。

项目 package.json 中已配置了便捷脚本：

```bash
# Windows
pnpm build:kernel

# macOS
pnpm build:kernel:darwin

# Linux
pnpm build:kernel:linux
```

或手动编译：

#### Windows (PowerShell)

```powershell
cd kernel
go build -o ../resources/kernel.exe .
cd ..
```

#### macOS / Linux

```bash
cd kernel
go build -o ../resources/kernel .
cd ..
```

**验证编译结果**：检查 `resources/` 目录下是否存在 `kernel.exe`（Windows）或 `kernel`（macOS/Linux）文件。

```powershell
# Windows PowerShell
ls resources\
```

### 步骤 4：配置 API Key

您可以通过两种方式配置 API Key：

**方式 A：应用内设置（推荐）**
1. 启动应用后，点击左下角设置图标
2. 进入「模型设置」页面
3. 填入对应服务商的 API Key
4. 点击「测试连接」验证
5. 保存配置

**方式 B：手动创建配置文件**

在用户主目录下创建 `.trae-ultra` 文件夹，并创建 `config.json` 文件：

```powershell
# Windows PowerShell
$configDir = "$env:USERPROFILE\.trae-ultra"
New-Item -ItemType Directory -Path $configDir -Force
# 然后手动创建 config.json 文件
```

```bash
# macOS / Linux
mkdir -p ~/.trae-ultra
# 然后手动创建 config.json 文件
```

配置文件格式详见 [配置文件说明](#配置文件说明) 章节。

### 步骤 5：启动开发模式

```bash
pnpm dev
```

启动成功后，您将看到：
1. Vite 开发服务器启动（通常在 http://localhost:5173）
2. Electron 窗口自动打开
3. Go Sidecar Kernel 自动启动并连接
4. 状态栏显示 Kernel 连接状态为「已连接」

> **注意**：如果没有编译 kernel.exe，应用会自动进入 Mock 模式，前端 UI 可正常预览但无法真正调用 AI API。

---

## 测试

```bash
# 运行前端单元测试
pnpm test

# 运行前端测试（watch模式）
pnpm test:watch

# 运行前端测试覆盖率
pnpm test:coverage

# 运行 Go Kernel 测试
pnpm test:kernel

# 运行 Go Kernel 测试覆盖率
pnpm test:kernel:cover

# 运行所有测试
pnpm test:all
```

---

## 生产构建

使用 electron-builder 进行生产环境打包：

```bash
# 构建前端并打包 Electron 应用
pnpm build
```

构建前会自动执行：
1. `vue-tsc --noEmit` - TypeScript 类型检查
2. `vite build` - 前端构建
3. `electron-builder` - Electron 打包

构建产物将输出到 `release/` 目录：
- Windows: `release/Trae Ultra Setup x.x.x.exe`（NSIS 安装包）
- macOS: `release/Trae Ultra-x.x.x.dmg`
- Linux: `release/Trae Ultra-x.x.x.AppImage` 或 `.deb` / `.rpm`

### 构建前检查清单

- [ ] 已执行 `pnpm install` 安装所有依赖
- [ ] 已编译 Go Kernel 到 `resources/` 目录（`pnpm build:kernel`）
- [ ] `package.json` 中版本号已更新
- [ ] 所有单元测试通过（`pnpm test:all`）
- [ ] TypeScript 类型检查通过（`pnpm exec tsc --noEmit`）

---

## API Key 配置

TRAE Ultra 需要至少配置一个模型服务商的 API Key 才能正常使用。

### DeepSeek API Key

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 [API Keys 页面](https://platform.deepseek.com/api_keys)
4. 点击「创建 API Key」
5. 复制生成的 Key（格式：`sk-xxxxxxxxxxxxxxxxxxxxxxxx`）
6. 在 TRAE Ultra 设置中粘贴保存

> 新用户通常有免费额度，充值后可继续使用。

### 豆包（火山引擎）API Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 注册/登录账号并完成实名认证
3. 开通「方舟」（Ark）服务
4. 进入 [模型推理](https://console.volcengine.com/ark/region:ark+cn-beijing/model) 页面
5. 创建接入点（Endpoint），获取模型 ID
6. 在 [API Key 管理](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey) 创建 API Key
7. 在 TRAE Ultra 设置中填入 API Key 和 Endpoint ID

### 本地模型（Ollama / LM Studio）

1. 安装并启动 [Ollama](https://ollama.ai) 或 [LM Studio](https://lmstudio.ai)
2. 拉取/加载模型（如 `ollama pull qwen2.5-coder`）
3. 在 TRAE Ultra 设置中选择「OpenAI 兼容」Provider
4. 填入本地端点地址（默认 `http://localhost:11434/v1` for Ollama）
5. API Key 可填入任意值（如 `ollama`）

---

## 配置文件说明

配置文件位于 `~/.trae-ultra/config.json`（Windows 为 `C:\Users\<用户名>\.trae-ultra\config.json`）。

> **注意**：API Key 在 v0.2 版本后将存储在系统密钥链（Keychain/Credential Manager），不再明文存储在配置文件中。

### 完整配置示例

```json
{
  "api_keys": {
    "deepseek": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "volcengine": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  "default_model": "deepseek-v4-flash",
  "models": {
    "deepseek-v4-flash": {
      "provider": "deepseek",
      "model_id": "deepseek-chat",
      "display_name": "DeepSeek V4 Flash",
      "enabled": true,
      "flash": true
    },
    "deepseek-v4-pro": {
      "provider": "deepseek",
      "model_id": "deepseek-reasoner",
      "display_name": "DeepSeek V4 Pro",
      "enabled": true,
      "flash": false
    },
    "doubao-1.6-flash": {
      "provider": "volcengine",
      "model_id": "ep-xxxxxxxxxxxxxxxx",
      "display_name": "豆包 1.6 Flash",
      "enabled": true,
      "flash": true
    },
    "doubao-1.6-pro": {
      "provider": "volcengine",
      "model_id": "ep-xxxxxxxxxxxxxxxx",
      "display_name": "豆包 1.6 Pro",
      "enabled": false,
      "flash": false
    }
  },
  "budget": {
    "daily_limit": 5.0,
    "warning_threshold": 0.8,
    "flash_first_routing": true
  },
  "cache": {
    "enabled": true,
    "target_hit_rate": 0.9,
    "prefix_locking": true
  },
  "appearance": {
    "theme": "dark",
    "font_size": 14,
    "language": "zh-CN"
  },
  "mcp": {
    "servers": []
  }
}
```

### 配置字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `api_keys` | `object` | `{}` | 各服务商 API Key，key 为 provider 名称 |
| `default_model` | `string` | `"deepseek-v4-flash"` | 默认使用的模型标识 |
| `models` | `object` | - | 模型配置映射 |
| `models.*.provider` | `string` | - | 服务商 ID（`deepseek`/`volcengine`/`openai-compatible`） |
| `models.*.model_id` | `string` | - | 服务商侧模型 ID/Endpoint ID |
| `models.*.display_name` | `string` | - | UI 显示名称 |
| `models.*.enabled` | `boolean` | `true` | 是否启用该模型 |
| `models.*.flash` | `boolean` | - | 是否为 Flash（低成本）模型 |
| `budget.daily_limit` | `number` | `5.0` | 日费用上限（美元） |
| `budget.warning_threshold` | `number` | `0.8` | 预算告警阈值（0-1） |
| `budget.flash_first_routing` | `boolean` | `true` | 是否启用 Flash-First 自动路由 |
| `cache.enabled` | `boolean` | `true` | 是否启用缓存优化 |
| `cache.target_hit_rate` | `number` | `0.9` | 目标缓存命中率（0-1） |
| `cache.prefix_locking` | `boolean` | `true` | 是否启用前缀锁定策略 |
| `appearance.theme` | `string` | `"dark"` | 主题：`dark`/`light`/`system` |
| `appearance.font_size` | `number` | `14` | 聊天区域字号 |
| `appearance.language` | `string` | `"zh-CN"` | 界面语言 |
| `mcp.servers` | `array` | `[]` | MCP 服务配置列表 |

> 配置文件修改后需要重启应用生效。应用内设置修改会自动保存并即时生效。

---

## 可用 pnpm 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发模式（Vite + Electron） |
| `pnpm build` | 生产构建（类型检查 + Vite构建 + Electron打包） |
| `pnpm build:kernel` | 编译 Windows Go Kernel |
| `pnpm build:kernel:darwin` | 编译 macOS Go Kernel |
| `pnpm build:kernel:linux` | 编译 Linux Go Kernel |
| `pnpm preview` | 预览生产构建 |
| `pnpm test` | 运行前端单元测试（Vitest） |
| `pnpm test:watch` | 前端测试 watch 模式 |
| `pnpm test:coverage` | 前端测试覆盖率报告 |
| `pnpm test:kernel` | 运行 Go Kernel 测试 |
| `pnpm test:kernel:cover` | Go Kernel 测试覆盖率（HTML报告） |
| `pnpm test:all` | 运行所有测试 |
| `pnpm exec tsc --noEmit` | TypeScript 类型检查 |

---

## 常见问题排查

### Q1: Go Kernel 启动失败 / Kernel 连接状态显示「未连接」

**症状**：应用启动后状态栏显示 Kernel 未连接，对话功能无法使用。

**排查步骤**：

1. **检查 Kernel 文件是否存在**：
   ```powershell
   ls resources\kernel.exe
   ```
   如果不存在，请重新执行 [步骤 3：编译 Go Sidecar Kernel](#步骤-3编译-go-sidecar-kernel)。

2. **手动启动 Kernel 查看错误**：
   ```powershell
   .\resources\kernel.exe
   ```
   观察是否有 panic 或错误输出。

3. **检查 Go 版本**：
   ```powershell
   go version
   ```
   确保版本 ≥ 1.22。

4. **检查端口/文件占用**：
   Kernel 使用 stdio 通信，不占用网络端口。如有杀毒软件拦截，请添加信任。

5. **查看应用日志**：
   - Windows: `%APPDATA%\Trae Ultra\logs\`
   - macOS: `~/Library/Application Support/Trae Ultra/logs/`

### Q2: pnpm install 失败 / Electron 下载超时

**症状**：`pnpm install` 过程中报错或卡住不动。

**解决方案**：

1. **确认 Node 版本 >= 22**：
   ```powershell
   node --version
   ```
   如果版本低于 22，请升级 Node.js。

2. **清除缓存并重新安装**：
   ```powershell
   pnpm store prune
   Remove-Item -Recurse -Force node_modules
   $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
   pnpm install
   ```

3. **检查 .npmrc 配置**：
   确保项目根目录 `.npmrc` 文件存在且包含正确的镜像配置。

4. **检查网络连接**：
   如在公司网络环境，请配置 pnpm 代理：
   ```powershell
   pnpm config set proxy http://your-proxy:port
   pnpm config set https-proxy http://your-proxy:port
   ```

5. **使用官方 npm 源**：
   ```powershell
   pnpm config set registry https://registry.npmjs.org
   ```

### Q3: 模型连接失败 / API 调用报错

**症状**：发送消息后报错，提示模型连接失败或 401/403 错误。

**排查步骤**：

1. **验证 API Key 是否正确**：
   - 确认 Key 没有多余空格或换行符
   - 在服务商控制台确认 Key 状态正常、未被禁用

2. **测试 API Key 有效性**（以 DeepSeek 为例）：
   ```powershell
   $headers = @{ "Authorization" = "Bearer sk-xxx"; "Content-Type" = "application/json" }
   $body = '{"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
   Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method Post -Headers $headers -Body $body
   ```

3. **检查账户余额**：
   - DeepSeek: https://platform.deepseek.com/usage
   - 火山引擎: https://console.volcengine.com/finance/

4. **检查模型 ID/Endpoint ID**：
   豆包（火山引擎）需要使用方舟平台创建的 Endpoint ID，而非模型名称。

### Q4: 缓存命中率低 / 显示为 0%

**症状**：缓存监控页面命中率持续低于 50% 或显示 0%。

**说明**：
- 新会话开始时命中率为 0% 是正常的，随着对话进行命中率会逐步提升
- DeepSeek Flash 模型缓存命中率目标为 90%+
- 如持续偏低，请检查设置中是否启用了「前缀锁定」和「缓存优化」

### Q5: 开发模式热更新不生效

**症状**：修改代码后界面没有自动刷新。

**解决方案**：
1. 确认 `pnpm dev` 终端没有报错
2. 尝试手动刷新：`Ctrl+R`（Windows）/ `Cmd+R`（macOS）
3. 重启开发服务器：`Ctrl+C` 停止后重新 `pnpm dev`
4. 清除 Vite 缓存：`Remove-Item -Recurse -Force node_modules\.vite` 后重启

---

## 获取帮助

如果以上方案无法解决您的问题：
1. 检查应用日志文件中的详细错误信息
2. 确认所有版本符合 [环境要求](#环境要求)
3. 尝试重新克隆/解压项目并从头搭建
