/**
 * Electron 预加载脚本
 * 使用 contextBridge 向渲染进程暴露安全的 API
 */

import { contextBridge, ipcRenderer } from 'electron';

// ==================== 类型定义 ====================

/** 聊天发送参数 */
interface ChatSendParams {
  message: string;
  model?: string;
  conversationId?: string;
  options?: Record<string, unknown>;
}

/** 流式 chunk 数据 */
interface ChatChunk {
  requestId: string;
  chunk: string;
  done?: boolean;
  conversationId?: string;
}

/** 缓存统计 */
interface CacheStats {
  totalEntries: number;
  totalTokens: number;
  cacheSize: number;
  hitRate: number;
}

/** 费用统计 */
interface CostStats {
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costByModel: Record<string, number>;
}

/** 模型信息 */
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxTokens?: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
}

/** 应用设置 */
interface AppSettings {
  defaultModel?: string;
  apiKeys?: Record<string, string>;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  [key: string]: unknown;
}

/** 连接测试结果 */
interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

/** 版本信息 */
interface VersionInfo {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  kernelVersion?: string;
}

/** 窗口状态 */
interface WindowState {
  isMinimized: boolean;
  isMaximized: boolean;
  isFullScreen: boolean;
}

/** Chunk 回调类型 */
type ChunkCallback = (chunk: ChatChunk) => void;
/** Kernel 就绪回调 */
type KernelReadyCallback = () => void;
/** Kernel 错误回调 */
type KernelErrorCallback = (error: { message: string; code?: number }) => void;
/** 窗口状态变化回调 */
type WindowStateCallback = (state: WindowState) => void;

// ==================== 事件监听器清理函数存储 ====================

/**
 * 封装 ipcRenderer.on，返回取消监听的函数
 */
function addIpcListener(channel: string, callback: (...args: any[]) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: any[]) => {
    callback(...args);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

// ==================== 暴露给渲染进程的 API ====================

const traeUltra = {
  chat: {
    /**
     * 发起聊天请求
     * @param params 聊天参数
     * @returns requestId 用于后续监听流式响应和中止
     */
    send: (params: ChatSendParams): Promise<string> => {
      return ipcRenderer.invoke('chat:send', params);
    },

    /**
     * 监听流式 chunk
     * @param callback chunk 回调函数
     * @returns 取消监听的函数
     */
    onChunk: (callback: ChunkCallback): (() => void) => {
      return addIpcListener('chat:chunk', callback);
    },

    /**
     * 监听聊天完成
     * @param callback 完成回调
     */
    onDone: (callback: (data: { requestId: string; conversationId?: string }) => void): (() => void) => {
      return addIpcListener('chat:done', callback);
    },

    /**
     * 监听聊天错误
     * @param callback 错误回调
     */
    onError: (callback: (error: { requestId: string; message: string; code?: number }) => void): (() => void) => {
      return addIpcListener('chat:error', callback);
    },

    /**
     * 中止指定请求
     * @param requestId 请求 ID
     */
    abort: (requestId: string): Promise<void> => {
      return ipcRenderer.invoke('chat:abort', requestId);
    },
  },

  cache: {
    /**
     * 获取缓存统计
     */
    getStats: (): Promise<CacheStats> => {
      return ipcRenderer.invoke('cache:getStats');
    },
  },

  stats: {
    /**
     * 获取费用统计
     */
    getCost: (): Promise<CostStats> => {
      return ipcRenderer.invoke('stats:getCost');
    },
  },

  config: {
    /**
     * 获取模型列表
     */
    getModels: (): Promise<ModelInfo[]> => {
      return ipcRenderer.invoke('config:getModels');
    },

    /**
     * 保存设置
     * @param settings 应用设置
     */
    saveSettings: (settings: AppSettings): Promise<void> => {
      return ipcRenderer.invoke('config:saveSettings', settings);
    },
  },

  provider: {
    /**
     * 测试 provider 连接
     * @param provider provider 名称
     * @param apiKey API Key
     */
    testConnection: (provider: string, apiKey: string): Promise<TestResult> => {
      return ipcRenderer.invoke('provider:testConnection', provider, apiKey);
    },
  },

  system: {
    /**
     * 获取版本信息
     */
    getVersion: (): Promise<VersionInfo> => {
      return ipcRenderer.invoke('system:version');
    },

    /**
     * 心跳检测
     */
    ping: (): Promise<'pong'> => {
      return ipcRenderer.invoke('system:ping');
    },

    /**
     * 监听 kernel 就绪事件
     * @param callback 就绪回调
     * @returns 取消监听的函数
     */
    onKernelReady: (callback: KernelReadyCallback): (() => void) => {
      return addIpcListener('system:kernelReady', callback);
    },

    /**
     * 监听 kernel 错误事件
     * @param callback 错误回调
     * @returns 取消监听的函数
     */
    onKernelError: (callback: KernelErrorCallback): (() => void) => {
      return addIpcListener('system:kernelError', callback);
    },
  },

  window: {
    /**
     * 最小化窗口
     */
    minimize: (): void => {
      ipcRenderer.send('window:minimize');
    },

    /**
     * 最大化/还原窗口
     */
    maximize: (): void => {
      ipcRenderer.send('window:maximize');
    },

    /**
     * 关闭窗口
     */
    close: (): void => {
      ipcRenderer.send('window:close');
    },

    /**
     * 获取窗口状态
     */
    getState: (): Promise<WindowState> => {
      return ipcRenderer.invoke('window:getState');
    },

    /**
     * 监听窗口状态变化
     * @param callback 状态变化回调
     * @returns 取消监听的函数
     */
    onStateChange: (callback: WindowStateCallback): (() => void) => {
      return addIpcListener('window:stateChange', callback);
    },
  },
};

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('trae', {
  ultra: traeUltra,
});

// 类型声明，供渲染进程使用
export type TraeUltra = typeof traeUltra;
