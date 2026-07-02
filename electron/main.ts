/**
 * Electron 主进程入口
 * 负责窗口创建、菜单设置、sidecar 管理、IPC 注册和应用生命周期处理
 */

import { app, BrowserWindow, Menu, shell } from 'electron';
import * as path from 'path';
import { sidecarManager } from './sidecar/manager';
import { registerChatIpc } from './ipc/chat';
import { registerSystemIpc } from './ipc/system';
import { registerTitlebarIpc } from './window/titlebar';

/** 开发服务器 URL */
const DEV_SERVER_URL = 'http://localhost:5173';
/** 是否为开发模式 */
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

/** 主窗口实例 */
let mainWindow: BrowserWindow | null = null;

// ==================== 单实例锁 ====================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 第二个实例启动时，聚焦到已有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// ==================== 窗口创建 ====================

/**
 * 创建主 BrowserWindow
 */
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  // 加载页面
  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    // 开发环境自动打开 DevTools
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口准备好后显示
  win.once('ready-to-show', () => {
    win.show();
  });

  // 外部链接使用系统默认浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ==================== 应用菜单 ====================

/**
 * 创建应用菜单
 */
function createApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // File 菜单
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createMainWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('navigate:settings');
            }
          },
        },
        { type: 'separator' },
        isMac
          ? { role: 'close' }
          : {
              label: 'Quit',
              accelerator: 'Alt+F4',
              click: () => {
                app.quit();
              },
            },
      ],
    },
    // Edit 菜单
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    // View 菜单
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window 菜单
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help 菜单
    {
      label: 'Help',
      submenu: [
        {
          label: 'About TRAE Ultra',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('dialog:about');
            }
          },
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://docs.trae-ultra.example.com');
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Cmd+I' : 'F12',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
      ],
    },
  ];

  // macOS 特殊处理：应用菜单
  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  return Menu.buildFromTemplate(template);
}

// ==================== Sidecar 事件转发 ====================

/**
 * 监听 sidecar 事件并转发到渲染进程
 */
function setupSidecarEventForwarding(win: BrowserWindow): void {
  // kernel 就绪事件
  const onKernelReady = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('system:kernelReady');
    }
  };

  // kernel 错误事件
  const onKernelError = (error: Error) => {
    if (!win.isDestroyed()) {
      win.webContents.send('system:kernelError', {
        message: error.message,
        code: (error as any).code,
      });
    }
  };

  // kernel 退出事件
  const onKernelExit = ({ code, signal }: { code: number | null; signal: string | null }) => {
    console.log(`[main] Kernel exited: code=${code}, signal=${signal}`);
  };

  // kernel 重启事件
  const onKernelRestarting = () => {
    console.log('[main] Kernel is restarting...');
  };

  sidecarManager.on('ready', onKernelReady);
  sidecarManager.on('error', onKernelError);
  sidecarManager.on('exit', onKernelExit);
  sidecarManager.on('restarting', onKernelRestarting);

  // 窗口销毁时清理事件监听
  win.on('closed', () => {
    sidecarManager.off('ready', onKernelReady);
    sidecarManager.off('error', onKernelError);
    sidecarManager.off('exit', onKernelExit);
    sidecarManager.off('restarting', onKernelRestarting);
  });
}

// ==================== 应用生命周期 ====================

/**
 * 应用就绪
 */
app.whenReady().then(async () => {
  // 设置应用菜单
  const menu = createApplicationMenu();
  Menu.setApplicationMenu(menu);

  // 创建主窗口
  mainWindow = createMainWindow();

  // 注册 IPC handlers
  registerSystemIpc();
  registerChatIpc(mainWindow.webContents);
  registerTitlebarIpc(mainWindow);

  // 设置 sidecar 事件转发
  setupSidecarEventForwarding(mainWindow);

  // 启动 Go sidecar 进程
  try {
    await sidecarManager.spawnKernel();
    console.log('[main] Sidecar kernel started successfully');
  } catch (err) {
    console.error('[main] Failed to start sidecar kernel:', err);
    // 即使 kernel 启动失败也不阻止应用启动，前端会收到错误事件
  }

  // macOS：点击 dock 图标时如果没有窗口则重新创建
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      registerChatIpc(mainWindow.webContents);
      registerTitlebarIpc(mainWindow);
      setupSidecarEventForwarding(mainWindow);
    }
  });
});

/**
 * 所有窗口关闭
 */
app.on('window-all-closed', () => {
  // Windows/Linux：退出应用
  // macOS：保持应用运行（Cmd+Q 才退出）
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前清理
 */
app.on('before-quit', async (event) => {
  // 阻止默认退出，先清理 sidecar
  if (sidecarManager.getState() !== 'stopped') {
    event.preventDefault();
    try {
      await sidecarManager.killKernel();
    } catch (err) {
      console.error('[main] Error killing kernel:', err);
    }
    // 清理完成后再次退出
    app.quit();
  }
});

/**
 * 应用退出
 */
app.on('will-quit', () => {
  // 最终安全检查，确保 kernel 已被杀死
  if (sidecarManager.getState() !== 'stopped') {
    sidecarManager.killKernel().catch(() => {});
  }
});

// ==================== 全局异常处理 ====================

process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled Rejection:', reason);
});
