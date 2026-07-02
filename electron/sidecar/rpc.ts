/**
 * JSON-RPC 2.0 协议实现
 * 用于与 Go kernel 进程进行 stdio 通信
 */

/** JSON-RPC 错误码 */
export const enum JSONRPCErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  RequestTimeout = -32000,
}

/** JSON-RPC 请求对象 */
export interface JSONRPCRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: T;
}

/** JSON-RPC 响应对象 */
export interface JSONRPCResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: T;
  error?: JSONRPCError;
}

/** JSON-RPC 错误对象 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/** JSON-RPC 推送事件（非请求/响应的通知） */
export interface JSONRPCEvent<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

/** 自增请求ID计数器 */
let requestIdCounter = 0;

/**
 * 生成唯一请求ID
 */
export function generateRequestId(): string {
  requestIdCounter += 1;
  return `req_${Date.now()}_${requestIdCounter}`;
}

/**
 * 判断是否为 JSON-RPC 请求
 */
export function isRequest(obj: unknown): obj is JSONRPCRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as JSONRPCRequest).jsonrpc === '2.0' &&
    typeof (obj as JSONRPCRequest).method === 'string' &&
    'id' in obj
  );
}

/**
 * 判断是否为 JSON-RPC 响应
 */
export function isResponse(obj: unknown): obj is JSONRPCResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as JSONRPCResponse).jsonrpc === '2.0' &&
    'id' in obj &&
    (!('method' in obj))
  );
}

/**
 * 判断是否为 JSON-RPC 事件/通知
 */
export function isEvent(obj: unknown): obj is JSONRPCEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as JSONRPCEvent).jsonrpc === '2.0' &&
    typeof (obj as JSONRPCEvent).method === 'string' &&
    !('id' in obj)
  );
}

/**
 * 解析一行 JSON 字符串为 Request/Response/Event
 * @throws 如果 JSON 解析失败
 */
export function parseLine(line: string): JSONRPCRequest | JSONRPCResponse | JSONRPCEvent {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('Empty line');
  }
  const parsed = JSON.parse(trimmed);

  if (isResponse(parsed)) {
    return parsed;
  }
  if (isEvent(parsed)) {
    return parsed;
  }
  if (isRequest(parsed)) {
    return parsed;
  }

  throw new Error(`Invalid JSON-RPC message: ${trimmed}`);
}

/**
 * 将请求序列化为 JSON 行字符串（带换行符）
 */
export function serializeRequest<T = unknown>(method: string, params?: T): { id: string; data: string } {
  const id = generateRequestId();
  const request: JSONRPCRequest<T> = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
  return {
    id,
    data: `${JSON.stringify(request)}\n`,
  };
}

/**
 * 创建超时错误响应
 */
export function createTimeoutError(id: string | number): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: JSONRPCErrorCode.RequestTimeout,
      message: 'Request timeout',
    },
  };
}
