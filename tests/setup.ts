import { vi } from 'vitest'

// Mock window.trae.ultra API (Electron preload bridge)
const mockTraeUltra = {
  chat: {
    send: vi.fn().mockResolvedValue('mock-request-id'),
    abort: vi.fn().mockResolvedValue(undefined),
    onChunk: vi.fn().mockReturnValue(() => {}),
    onDone: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {})
  },
  cache: {
    getStats: vi.fn().mockResolvedValue({
      hitRate: 0.95,
      status: 'green',
      totalPrompt: 10000,
      totalHit: 9500,
      history: []
    })
  },
  stats: {
    getCost: vi.fn().mockResolvedValue({
      totalCost: 0.05,
      todayCost: 0.02,
      costByModel: { 'deepseek-v4-flash': 0.02 },
      budgetAlert: { threshold: 1.0, current: 0.02, triggered: false }
    })
  },
  config: {
    getModels: vi.fn().mockResolvedValue([
      { id: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', provider: 'deepseek', supportsCache: true },
      { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', provider: 'deepseek', supportsCache: true },
      { id: 'doubao-1.6-flash', displayName: '豆包1.6 Flash', provider: 'volcengine', supportsCache: true },
      { id: 'doubao-1.6', displayName: '豆包1.6', provider: 'volcengine', supportsCache: true }
    ]),
    saveSettings: vi.fn().mockResolvedValue(undefined)
  },
  provider: {
    testConnection: vi.fn().mockResolvedValue({ success: true, latency: 120 })
  },
  system: {
    getVersion: vi.fn().mockResolvedValue({
      app: '0.1.0',
      kernel: '0.1.0',
      electron: process.versions.electron || '31.0.0',
      node: process.versions.node
    }),
    ping: vi.fn().mockResolvedValue('pong'),
    onKernelReady: vi.fn().mockReturnValue(() => {}),
    onKernelError: vi.fn().mockReturnValue(() => {})
  },
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    getState: vi.fn().mockResolvedValue({ isMaximized: false, isMinimized: false }),
    onStateChange: vi.fn().mockReturnValue(() => {})
  }
}

vi.stubGlobal('window', {
  ...window,
  trae: { ultra: mockTraeUltra }
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

// Mock matchMedia for Tailwind dark mode
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

export { mockTraeUltra }
