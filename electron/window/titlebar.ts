/**
 * 自定义标题栏窗口控制
 * 注册窗口控制 IPC handlers，提供 minimize/maximize/close 等功能
 */

import { ipcMain, BrowserWindow } from 'electron';

/** 窗口状态信息 */
interface WindowState {
  isMinimized: boolean;
  isMaximized: boolean;
  isFullScreen: boolean;
}

/**
 * 获取窗口状态
 */
function getWindowState(win: BrowserWindow): WindowState {
  return {
    isMinimized: win.isMinimized(),
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  };
}

/**
 * 注册窗口控制 IPC handlers
 * @param mainWindow 主窗口实例
 */
export function registerTitlebarIpc(mainWindow: BrowserWindow): void {
  /**
   * window:minimize - 最小化窗口
   */
  ipcMain.on('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  /**
   * window:maximize - 最大化/还原窗口切换
   */
  ipcMain.on('window:maximize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  /**
   * window:close - 关闭窗口
   */
  ipcMain.on('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  /**
   * window:getState - 获取当前窗口状态
   */
  ipcMain.handle('window:getState', (): WindowState => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return {
        isMinimized: false,
        isMaximized: false,
        isFullScreen: false,
      };
    }
    return getWindowState(mainWindow);
  });

  /**
   * 监听窗口状态变化，通知渲染进程
   */
  const onMaximize = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:stateChange', getWindowState(mainWindow));
    }
  };

  const onUnmaximize = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:stateChange', getWindowState(mainWindow));
    }
  };

  const onEnterFullScreen = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:stateChange', getWindowState(mainWindow));
    }
  };

  const onLeaveFullScreen = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:stateChange', getWindowState(mainWindow));
    }
  };

  const onMinimize = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:stateChange', getWindowState(mainWindow));
    }
  };

  const onRestore = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:stateChange', getWindowState(mainWindow));
    }
  };

  mainWindow.on('maximize', onMaximize);
  mainWindow.on('unmaximize', onUnmaximize);
  mainWindow.on('enter-full-screen', onEnterFullScreen);
  mainWindow.on('leave-full-screen', onLeaveFullScreen);
  mainWindow.on('minimize', onMinimize);
  mainWindow.on('restore', onRestore);

  // 窗口销毁时移除事件监听
  mainWindow.on('closed', () => {
    mainWindow.removeListener('maximize', onMaximize);
    mainWindow.removeListener('unmaximize', onUnmaximize);
    mainWindow.removeListener('enter-full-screen', onEnterFullScreen);
    mainWindow.removeListener('leave-full-screen', onLeaveFullScreen);
    mainWindow.removeListener('minimize', onMinimize);
    mainWindow.removeListener('restore', onRestore);
  });
}
