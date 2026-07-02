/**
 * 系统 IPC 处理模块
 * 注册系统相关的 ipcMain handlers：版本信息、缓存统计、费用统计、配置、模型列表、连接测试等
 */

import { ipcMain, app } from 'electron';
import { sidecarManager } from '../sidecar/manager';

/** 版本信息 */
interface VersionInfo {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  kernelVersion?: string;
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

/**
 * 获取应用版本信息
 */
function getVersionInfo(): VersionInfo {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
  };
}

/**
 * 注册系统 IPC handlers
 */
export function registerSystemIpc(): void {
  /**
   * system:ping - 心跳检测
   */
  ipcMain.handle('system:ping', async (): Promise<'pong'> => {
    return 'pong';
  });

  /**
   * system:version - 获取版本信息
   */
  ipcMain.handle('system:version', async (): Promise<VersionInfo> => {
    const baseInfo = getVersionInfo();
    try {
      // 尝试从 kernel 获取版本
      const kernelVersion = await sidecarManager.request<{ version: string }>('system.version');
      return {
        ...baseInfo,
        kernelVersion: kernelVersion.version,
      };
    } catch {
      // kernel 未就绪时返回基础信息
      return baseInfo;
    }
  });

  /**
   * cache:getStats - 获取缓存统计
   */
  ipcMain.handle('cache:getStats', async (): Promise<CacheStats> => {
    try {
      return await sidecarManager.request<CacheStats>('cache.getStats');
    } catch (err) {
      console.error('[ipc:system] cache:getStats failed:', err);
      return {
        totalEntries: 0,
        totalTokens: 0,
        cacheSize: 0,
        hitRate: 0,
      };
    }
  });

  /**
   * stats:getCost - 获取费用统计
   */
  ipcMain.handle('stats:getCost', async (): Promise<CostStats> => {
    try {
      return await sidecarManager.request<CostStats>('stats.getCost');
    } catch (err) {
      console.error('[ipc:system] stats:getCost failed:', err);
      return {
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        costByModel: {},
      };
    }
  });

  /**
   * config:getModels - 获取可用模型列表
   */
  ipcMain.handle('config:getModels', async (): Promise<ModelInfo[]> => {
    try {
      return await sidecarManager.request<ModelInfo[]>('config.getModels');
    } catch (err) {
      console.error('[ipc:system] config:getModels failed:', err);
      return [];
    }
  });

  /**
   * config:saveSettings - 保存设置
   */
  ipcMain.handle('config:saveSettings', async (_event, settings: AppSettings): Promise<void> => {
    try {
      await sidecarManager.request('config.saveSettings', settings);
    } catch (err) {
      console.error('[ipc:system] config:saveSettings failed:', err);
      throw err;
    }
  });

  /**
   * provider:testConnection - 测试 provider 连接
   */
  ipcMain.handle(
    'provider:testConnection',
    async (_event, provider: string, apiKey: string): Promise<TestResult> => {
      try {
        return await sidecarManager.request<TestResult>('provider.testConnection', {
          provider,
          apiKey,
        });
      } catch (err) {
        console.error('[ipc:system] provider:testConnection failed:', err);
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Connection test failed',
        };
      }
    }
  );
}
