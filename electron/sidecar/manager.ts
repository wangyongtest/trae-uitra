/**
 * Go Sidecar 进程管理器
 * 负责 kernel.exe 进程的启动、停止、重启和 JSON-RPC 通信
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import {
  JSONRPCResponse,
  JSONRPCEvent,
  parseLine,
  serializeRequest,
  isResponse,
  isEvent,
} from './rpc';

/** 待处理请求的元数据 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
  method: string;
}

/** Sidecar 管理器配置 */
interface SidecarManagerOptions {
  /** 默认请求超时时间（毫秒），默认 30000 */
  defaultTimeout?: number;
  /** 聊天请求超时时间（毫秒），默认 60000 */
  chatTimeout?: number;
  /** 最大重启重试次数，默认 3 */
  maxRestartRetries?: number;
  /** 重启间隔时间（毫秒），默认 2000 */
  restartInterval?: number;
}

/** Sidecar 管理器状态 */
type SidecarState = 'stopped' | 'starting' | 'running' | 'error' | 'restarting';

/**
 * Go kernel Sidecar 进程管理器
 * 通过 stdio 使用 JSON-RPC 协议与 kernel 通信
 */
export class SidecarManager extends EventEmitter {
  /** kernel 子进程 */
  private kernelProcess: ChildProcess | null = null;
  /** 待处理请求 Map */
  private pendingRequests = new Map<string, PendingRequest>();
  /** stdout 行缓冲 */
  private stdoutBuffer = '';
  /** stderr 行缓冲 */
  private stderrBuffer = '';
  /** stdin 写入队列 */
  private writeQueue: Array<() => void> = [];
  /** 是否正在写入 stdin */
  private isWriting = false;
  /** 当前状态 */
  private state: SidecarState = 'stopped';
  /** 重启重试计数 */
  private restartRetries = 0;
  /** 重启定时器 */
  private restartTimer: NodeJS.Timeout | null = null;
  /** 配置 */
  private options: Required<SidecarManagerOptions>;

  constructor(options: SidecarManagerOptions = {}) {
    super();
    this.options = {
      defaultTimeout: options.defaultTimeout ?? 30000,
      chatTimeout: options.chatTimeout ?? 60000,
      maxRestartRetries: options.maxRestartRetries ?? 3,
      restartInterval: options.restartInterval ?? 2000,
    };
  }

  /**
   * 获取 kernel.exe 路径
   * 开发环境: 项目根目录/resources/kernel.exe
   * 生产环境: process.resourcesPath/kernel.exe
   */
  private getKernelPath(): string {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    if (isDev) {
      return path.join(process.cwd(), 'resources', 'kernel.exe');
    } else {
      return path.join(process.resourcesPath!, 'kernel.exe');
    }
  }

  /**
   * 启动 kernel 进程
   */
  async spawnKernel(): Promise<void> {
    if (this.state === 'running' || this.state === 'starting') {
      return;
    }

    this.state = 'starting';
    this.emit('state:change', this.state);

    const kernelPath = this.getKernelPath();

    // 检查 kernel 文件是否存在
    if (!fs.existsSync(kernelPath)) {
      const error = new Error(`Kernel not found at: ${kernelPath}`);
      this.state = 'error';
      this.emit('error', error);
      this.emit('state:change', this.state);
      throw error;
    }

    return new Promise((resolve, reject) => {
      try {
        this.kernelProcess = spawn(kernelPath, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            KERNEL_MODE: 'stdio',
          },
        });

        // 监听进程启动（spawn 是同步的，error 事件才是真正的错误）
        this.kernelProcess.on('spawn', () => {
          this.state = 'running';
          this.restartRetries = 0;
          this.emit('ready');
          this.emit('state:change', this.state);
          resolve();
        });

        // 监听 stdout 数据
        this.kernelProcess.stdout!.on('data', (data: Buffer) => {
          this.handleStdoutData(data);
        });

        // 监听 stderr 数据（记录日志）
        this.kernelProcess.stderr!.on('data', (data: Buffer) => {
          this.handleStderrData(data);
        });

        // 监听进程错误
        this.kernelProcess.on('error', (err) => {
          this.handleProcessError(err);
          if (this.state === 'starting') {
            reject(err);
          }
        });

        // 监听进程退出
        this.kernelProcess.on('exit', (code, signal) => {
          this.handleProcessExit(code, signal);
        });
      } catch (err) {
        this.state = 'error';
        this.emit('error', err);
        this.emit('state:change', this.state);
        reject(err);
      }
    });
  }

  /**
   * 停止 kernel 进程
   */
  async killKernel(): Promise<void> {
    // 清除重启定时器
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // 拒绝所有待处理请求
    this.rejectAllPendingRequests(new Error('Kernel process killed'));

    if (!this.kernelProcess) {
      this.state = 'stopped';
      this.emit('state:change', this.state);
      return;
    }

    return new Promise((resolve) => {
      const proc = this.kernelProcess!;

      const cleanup = () => {
        this.kernelProcess = null;
        this.stdoutBuffer = '';
        this.stderrBuffer = '';
        this.state = 'stopped';
        this.emit('state:change', this.state);
        this.emit('exit');
        resolve();
      };

      // 给进程一点时间优雅退出
      proc.once('exit', () => {
        cleanup();
      });

      // 尝试正常终止
      proc.kill();

      // 3秒后强制杀死
      setTimeout(() => {
        if (this.kernelProcess === proc && !proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 3000);

      // 5秒后强制清理
      setTimeout(() => {
        if (this.kernelProcess === proc) {
          cleanup();
        }
      }, 5000);
    });
  }

  /**
   * 重启 kernel 进程
   */
  async restartKernel(): Promise<void> {
    if (this.state === 'restarting') {
      return;
    }

    this.state = 'restarting';
    this.emit('state:change', this.state);
    this.emit('restarting');

    await this.killKernel();

    this.restartRetries += 1;
    if (this.restartRetries > this.options.maxRestartRetries) {
      const error = new Error(`Max restart retries (${this.options.maxRestartRetries}) exceeded`);
      this.state = 'error';
      this.emit('error', error);
      this.emit('state:change', this.state);
      throw error;
    }

    // 延迟重启
    await new Promise<void>((res) => {
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        res();
      }, this.options.restartInterval);
    });

    return this.spawnKernel();
  }

  /**
   * 发送 JSON-RPC 请求并等待响应
   */
  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.state !== 'running' || !this.kernelProcess) {
      throw new Error('Kernel is not running');
    }

    const { id, data } = serializeRequest(method, params);

    // 确定超时时间
    const timeout = method.startsWith('chat.')
      ? this.options.chatTimeout
      : this.options.defaultTimeout;

    return new Promise<T>((resolve, reject) => {
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          const timeoutError = new Error(`Request ${method} timeout after ${timeout}ms`);
          (timeoutError as any).code = -32000;
          reject(timeoutError);
        }
      }, timeout);

      // 注册待处理请求
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
        method,
      });

      // 写入 stdin（串行化）
      this.enqueueWrite(data);
    });
  }

  /**
   * 获取当前状态
   */
  getState(): SidecarState {
    return this.state;
  }

  /**
   * 处理 stdout 数据
   */
  private handleStdoutData(data: Buffer): void {
    this.stdoutBuffer += data.toString('utf-8');

    // 按行处理
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessageLine(line);
      }
    }
  }

  /**
   * 处理 stderr 数据（记录日志）
   */
  private handleStderrData(data: Buffer): void {
    this.stderrBuffer += data.toString('utf-8');

    const lines = this.stderrBuffer.split('\n');
    this.stderrBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim()) {
        console.error(`[kernel:stderr] ${line}`);
        this.emit('log:stderr', line);
      }
    }
  }

  /**
   * 处理单行消息
   */
  private handleMessageLine(line: string): void {
    try {
      const message = parseLine(line);

      if (isResponse(message)) {
        this.handleResponse(message);
      } else if (isEvent(message)) {
        this.handleEvent(message);
      }
    } catch (err) {
      console.error('[rpc] Failed to parse message:', line, err);
      this.emit('parse:error', { line, error: err });
    }
  }

  /**
   * 处理 JSON-RPC 响应
   */
  private handleResponse(response: JSONRPCResponse): void {
    const id = String(response.id);
    const pending = this.pendingRequests.get(id);

    if (!pending) {
      console.warn('[rpc] Received response for unknown request:', id);
      return;
    }

    // 清除超时和待处理记录
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (response.error) {
      const error = new Error(response.error.message);
      (error as any).code = response.error.code;
      (error as any).data = response.error.data;
      pending.reject(error);
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * 处理 JSON-RPC 推送事件
   */
  private handleEvent(event: JSONRPCEvent): void {
    // 转发事件，使用 event.method 作为事件名
    this.emit('event', event);
    this.emit(event.method, event.params);

    // 特殊的流式事件前缀
    if (event.method.startsWith('stream.')) {
      this.emit('stream:event', {
        method: event.method,
        params: event.params,
      });
    }
  }

  /**
   * 处理进程错误
   */
  private handleProcessError(err: Error): void {
    console.error('[kernel] Process error:', err);
    this.emit('error', err);

    // 如果不是正在停止，尝试重启
    if (this.state !== 'stopped') {
      this.scheduleRestart();
    }
  }

  /**
   * 处理进程退出
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    console.log(`[kernel] Process exited with code ${code}, signal ${signal}`);
    this.emit('exit', { code, signal });

    // 拒绝所有待处理请求
    this.rejectAllPendingRequests(
      new Error(`Kernel process exited with code ${code}, signal ${signal}`)
    );

    this.kernelProcess = null;

    // 如果不是主动停止，尝试重启
    if (this.state !== 'stopped') {
      this.scheduleRestart();
    }
  }

  /**
   * 调度重启
   */
  private scheduleRestart(): void {
    if (this.restartTimer) {
      return;
    }

    this.state = 'restarting';
    this.emit('state:change', this.state);
    this.emit('restarting');

    this.restartRetries += 1;
    if (this.restartRetries > this.options.maxRestartRetries) {
      const error = new Error(`Max restart retries (${this.options.maxRestartRetries}) exceeded`);
      this.state = 'error';
      this.emit('error', error);
      this.emit('state:change', this.state);
      return;
    }

    console.log(`[kernel] Scheduling restart in ${this.options.restartInterval}ms (attempt ${this.restartRetries})`);

    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null;
      try {
        await this.spawnKernel();
      } catch (err) {
        console.error('[kernel] Restart failed:', err);
      }
    }, this.options.restartInterval);
  }

  /**
   * 排队写入 stdin（确保串行化）
   */
  private enqueueWrite(data: string): void {
    this.writeQueue.push(() => {
      this.doWrite(data);
    });

    if (!this.isWriting) {
      this.processWriteQueue();
    }
  }

  /**
   * 处理写入队列
   */
  private processWriteQueue(): void {
    if (this.writeQueue.length === 0) {
      this.isWriting = false;
      return;
    }

    this.isWriting = true;
    const writeFn = this.writeQueue.shift()!;
    writeFn();
  }

  /**
   * 执行实际写入
   */
  private doWrite(data: string): void {
    if (!this.kernelProcess || !this.kernelProcess.stdin || this.kernelProcess.stdin.destroyed) {
      this.processWriteQueue();
      return;
    }

    try {
      this.kernelProcess.stdin.write(data, (err) => {
        if (err) {
          console.error('[kernel] Failed to write to stdin:', err);
        }
        this.processWriteQueue();
      });
    } catch (err) {
      console.error('[kernel] Write error:', err);
      this.processWriteQueue();
    }
  }

  /**
   * 拒绝所有待处理请求
   */
  private rejectAllPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}

// 导出单例
export const sidecarManager = new SidecarManager();
