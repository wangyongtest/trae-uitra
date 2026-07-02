/**
 * 聊天 IPC 处理模块
 * 注册聊天相关的 ipcMain handlers，将请求转发给 sidecar，流式事件转发到渲染进程
 */

import { ipcMain, WebContents } from 'electron';
import { sidecarManager } from '../sidecar/manager';

/** 聊天发送参数 */
interface ChatSendParams {
  message: string;
  model?: string;
  conversationId?: string;
  options?: Record<string, unknown>;
}

/** 流式 chunk 事件 */
interface ChatChunkEvent {
  requestId: string;
  chunk: string;
  done?: boolean;
  conversationId?: string;
}

/**
 * 注册聊天 IPC handlers
 * @param mainWindow 主窗口 WebContents，用于推送流式事件
 */
export function registerChatIpc(mainWindow: WebContents): void {
  /**
   * chat:send - 发起聊天请求
   * 返回 requestId 用于后续监听流式响应和中止
   */
  ipcMain.handle('chat:send', async (_event, params: ChatSendParams): Promise<string> => {
    try {
      const result = await sidecarManager.request<{ requestId: string }>('chat.send', params);
      return result.requestId;
    } catch (err) {
      console.error('[ipc:chat] chat:send failed:', err);
      throw err;
    }
  });

  /**
   * chat:abort - 中止指定请求
   */
  ipcMain.handle('chat:abort', async (_event, requestId: string): Promise<void> => {
    try {
      await sidecarManager.request('chat.abort', { requestId });
    } catch (err) {
      console.error('[ipc:chat] chat:abort failed:', err);
      throw err;
    }
  });

  /**
   * 监听 sidecar 的 stream:event 事件，转发到渲染进程
   */
  const onStreamEvent = (event: { method: string; params: unknown }) => {
    if (event.method === 'stream.chunk' && event.params) {
      mainWindow.send('chat:chunk', event.params as ChatChunkEvent);
    } else if (event.method === 'stream.done' && event.params) {
      mainWindow.send('chat:done', event.params);
    } else if (event.method === 'stream.error' && event.params) {
      mainWindow.send('chat:error', event.params);
    }
  };

  sidecarManager.on('stream:event', onStreamEvent);

  // 监听 WebContents 销毁时清理事件监听
  mainWindow.on('destroyed', () => {
    sidecarManager.off('stream:event', onStreamEvent);
  });
}
