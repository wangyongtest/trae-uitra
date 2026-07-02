# 测试文档

> TRAE Ultra 测试策略、框架、命令与编写规范

---

## 目录

- [TDD 开发方法论](#tdd-开发方法论)
- [测试金字塔](#测试金字塔)
- [测试框架](#测试框架)
- [测试命令](#测试命令)
- [现有测试用例](#现有测试用例)
- [测试编写规范](#测试编写规范)
- [覆盖率目标](#覆盖率目标)

---

## TDD 开发方法论

TRAE Ultra 采用 **测试驱动开发（Test-Driven Development）** 作为核心开发方法论，遵循经典的 **Red-Green-Refactor** 循环：

```
    ┌─────────────┐
    │   写一个    │
    │  失败的测试  │  ← Red
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   编写最    │
    │  少量代码   │  ← Green
    │  让测试通过  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   重构代码   │  ← Refactor
    │  保持测试通过 │
    └──────┬──────┘
           │
           └──────→ 重复循环
```

### TDD 三原则

1. **除非是为了让一个失败的单元测试通过，否则不允许编写产品代码**
2. **只允许编写刚好能够导致失败的单元测试（编译失败也算失败）**
3. **只允许编写刚好能够使一个失败的单元测试通过的产品代码**

### TDD 的收益

- ✅ 代码自然具备可测试性
- ✅ 测试即文档，清晰描述代码行为
- ✅ 重构时有安全保障
- ✅ 缺陷发现成本最低化
- ✅ 接口设计更合理

---

## 测试金字塔

TRAE Ultra 遵循测试金字塔策略，合理分配不同层级测试的比例：

```
            /\
           /  \
          / E2E \         10% - Playwright 端到端测试
         /--------\
        / 集成测试  \       20% - 模块间/前后端集成测试
       /--------------\
      /   单元测试       \    70% - Go + Vitest 单元测试
     /--------------------\
```

| 测试层级 | 占比 | 工具 | 目标 | 执行速度 |
|---------|------|------|------|---------|
| 单元测试 | 70% | Go testing / Vitest | 单个函数/组件的正确性 | 极快（毫秒级） |
| 集成测试 | 20% | Go testing / Vitest | 模块间协作正确性 | 快（秒级） |
| E2E 测试 | 10% | Playwright | 用户完整流程验证 | 慢（十秒级） |

### 各层级测试原则

- **单元测试**：不依赖外部服务，不依赖数据库，不依赖网络，所有依赖都使用 Mock/Stub
- **集成测试**：测试多个模块协作，可启动真实 Kernel 进程测试 IPC 通信
- **E2E 测试**：模拟真实用户操作，测试完整应用流程，在打包后的应用上运行

---

## 测试框架

### Go 内核测试

| 工具 | 用途 | 说明 |
|------|------|------|
| `testing`（标准库） | 单元测试框架 | Go 标准库，不引入第三方断言库 |
| `net/http/httptest` | HTTP 测试 | Provider API 请求测试 |
| `encoding/json` | JSON 处理 | 序列化/反序列化测试 |

> **重要**：Go 测试**不使用 testify、gomock 等第三方库**，坚持使用标准库，保持依赖最小化。

### 前端测试

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | ^1.x | 单元测试运行器，兼容 Jest API |
| @vue/test-utils | ^2.x | Vue 组件测试工具 |
| @vue/test-utils | ^2.x | Vue 组件挂载和交互 |
| jsdom | ^24.x | DOM 环境模拟 |
| @pinia/testing | ^0.x | Pinia Store 测试辅助 |

### E2E 测试（计划中）

| 工具 | 用途 |
|------|------|
| Playwright | Electron 应用端到端测试，支持多浏览器 |

---

## 测试命令

所有测试命令统一通过 **pnpm** 执行，需在项目根目录下运行（不支持 npm/yarn）。

### 常用命令

```bash
# 运行前端 Vitest 测试（单次运行）
pnpm test

# 运行前端 Vitest 测试（watch 监听模式）
pnpm test:watch

# 运行 Go 内核测试
pnpm test:kernel

# 运行所有测试（前端 + Go 内核）
pnpm test:all

# 运行前端测试并生成覆盖率报告
pnpm test:coverage

# 运行 Go 内核测试并生成 HTML 覆盖率报告
pnpm test:kernel:cover
```

### package.json 脚本说明

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:kernel": "cd kernel && go test ./... -v",
    "test:all": "pnpm test && pnpm test:kernel",
    "test:coverage": "vitest run --coverage",
    "test:kernel:cover": "cd kernel && go test ./... -coverprofile=cover.out && go tool cover -html=cover.out"
  }
}
```

### 运行单个测试

**前端：**
```bash
# 运行指定测试文件
pnpm test:watch chat.store.test.ts

# 运行匹配名称的测试
pnpm test:watch -t "cache hit rate"
```

**Go：**
```bash
# 运行指定包的测试
cd kernel
go test ./internal/cache/...

# 运行指定测试函数
go test ./internal/cache -v -run TestMonitor_RecordHit

# 详细输出
go test ./... -v
```

---

## 现有测试用例

### Go 内核测试（共 25 个测试用例）

| 包 | 测试文件 | 用例数 | 覆盖内容 |
|----|---------|--------|---------|
| `cache/monitor` | `monitor_test.go` | 8 | 缓存命中率记录、计算、统计、重置 |
| `cache/token_counter` | `token_counter_test.go` | 3 | Token 计数、按模型计费、费用计算 |
| `cache/serializer` | `serializer_test.go` | 2 | 确定性序列化、消息排序 |
| `cache/diagnostics` | `diagnostics_test.go` | 2 | 缓存诊断、优化建议生成 |
| `stats/cost` | `cost_test.go` | 5 | 费用统计、预算告警、按模型汇总 |
| `provider/deepseek` | `deepseek_test.go` | 5 | API 请求构建、流式响应解析、错误处理 |

### Go 测试示例

```go
package cache

import (
    "testing"
)

func TestMonitor_RecordHit(t *testing.T) {
    m := NewMonitor()
    m.RecordHit(100)
    m.RecordMiss(50)

    stats := m.Stats()
    if stats.HitRate != 2.0/3.0 {
        t.Errorf("expected hit rate %.2f, got %.2f", 2.0/3.0, stats.HitRate)
    }
    if stats.TotalTokens != 150 {
        t.Errorf("expected 150 tokens, got %d", stats.TotalTokens)
    }
}
```

### 前端测试（共 22+ 个测试用例）

| 模块 | 测试文件 | 用例数 | 覆盖内容 |
|------|---------|--------|---------|
| Chat Store | `tests/chat.store.test.ts` | 10+ | 会话管理、消息发送、流式响应、停止生成 |
| Cache Monitor | `tests/cache-monitor.test.ts` | 12+ | 命中率计算、状态灯颜色、诊断建议、历史记录 |

### 前端测试示例

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../src/stores/chat'
import { createPinia, setActivePinia } from 'pinia'

describe('Chat Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should create a new conversation', () => {
    const store = useChatStore()
    expect(store.conversations).toHaveLength(0)

    store.createConversation()
    expect(store.conversations).toHaveLength(1)
    expect(store.currentConversation).not.toBeNull()
  })
})
```

---

## 测试编写规范

### Go 测试规范

1. **文件命名**：测试文件与源文件同目录，命名为 `*_test.go`
2. **函数命名**：测试函数命名为 `TestXxx(t *testing.T)`，子测试使用 `t.Run()`
3. **不使用第三方库**：仅使用标准库 `testing`，不使用 testify 等断言库
4. **表驱动测试**：优先使用表驱动测试模式
5. **错误信息清晰**：`t.Errorf()` 输出期望值和实际值，便于定位问题
6. **测试隔离**：每个测试独立，不依赖执行顺序，不共享状态
7. **并行测试**：可安全并行的测试使用 `t.Parallel()`

#### Go 表驱动测试示例

```go
func TestTokenCounter_Cost(t *testing.T) {
    tests := []struct {
        name       string
        model      string
        inputTok   int
        outputTok  int
        cachedTok  int
        wantCost   float64
    }{
        {
            name:      "deepseek flash no cache",
            model:     "deepseek-v4-flash",
            inputTok:  1000000,
            outputTok: 1000000,
            cachedTok: 0,
            wantCost:  0.42,
        },
        {
            name:      "deepseek flash full cache",
            model:     "deepseek-v4-flash",
            inputTok:  0,
            outputTok: 0,
            cachedTok: 1000000,
            wantCost:  0.014,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            tc := NewTokenCounter()
            cost := tc.Calculate(tt.model, tt.inputTok, tt.outputTok, tt.cachedTok)
            if math.Abs(cost-tt.wantCost) > 0.001 {
                t.Errorf("cost = %v, want %v", cost, tt.wantCost)
            }
        })
    }
}
```

### 前端测试规范

1. **文件命名**：测试文件放在 `tests/` 目录，命名为 `*.test.ts`
2. **使用 describe/it**：使用 `describe()` 组织测试套件，`it()` 编写测试用例
3. **组件测试**：使用 `@vue/test-utils` 的 `mount()`/`shallowMount()` 挂载组件
4. **Store 测试**：每个测试前创建新的 Pinia 实例，避免状态污染
5. **Mock 外部依赖**：IPC 调用、API 请求必须 Mock，不做真实网络请求
6. **行为验证**：测试行为而非实现细节，优先从用户视角断言
7. **可访问性**：尽量使用用户可感知的查询方式（如文本、角色），而非 CSS 选择器

#### Vue 组件测试示例

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Button from '../src/components/common/Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Click me' }
    })
    expect(wrapper.text()).toContain('Click me')
  })

  it('emits click event when clicked', async () => {
    const wrapper = mount(Button)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
```

### 通用规范

1. **测试速度**：单元测试应该极快，单个包测试不超过 1 秒
2. **确定性**：测试结果应确定可重复，不依赖时间、网络、随机数
3. **一个测试一个断言概念**：每个 test 函数验证一个行为概念
4. **测试数据简洁**：测试数据保持最小化，仅包含必要字段
5. **AAA 模式**：Arrange（准备）→ Act（执行）→ Assert（断言）
6. **避免测试私有实现**：测试公开 API，私有实现可重构

---

## 覆盖率目标

| 模块类型 | 目标覆盖率 | 说明 |
|---------|-----------|------|
| 核心模块 | **> 80%** | cache/、provider/、stats/ 等核心逻辑 |
| 工具函数 | **> 90%** | 纯工具函数应接近 100% 覆盖 |
| UI 组件 | **> 60%** | 复杂组件测试关键交互逻辑 |
| Store | **> 70%** | 状态管理核心逻辑 |

### 查看覆盖率

**前端：**
```bash
pnpm test:coverage
```
覆盖率报告将生成在 `coverage/` 目录，打开 `coverage/index.html` 查看详情。

**Go：**
```bash
cd kernel
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```
浏览器打开 `coverage.html` 查看逐行覆盖情况。

### CI 集成（未来）

在 CI/CD 流水线中：
1. 所有单元测试必须通过
2. 核心模块覆盖率不低于目标值
3. 新代码覆盖率不降低（增量覆盖率检查）
4. E2E 测试在构建产物上执行

---

## 测试 Checklist

提交代码前，请确认：

- [ ] 新功能有对应的测试覆盖
- [ ] Bug 修复有对应的回归测试
- [ ] 所有现有测试通过（`pnpm test:all`）
- [ ] 测试不依赖外部服务或网络
- [ ] 测试命名清晰，描述被测试的行为
- [ ] Go 测试未引入第三方测试库
- [ ] 前端测试正确 Mock 了 IPC/API 调用
