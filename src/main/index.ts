import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: '播客工作室 - Podcast Studio'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:openAudioFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'MP3 音频', extensions: ['mp3'] },
      { name: 'WAV 音频', extensions: ['wav'] }
    ]
  });
  return result.filePath;
});

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string, encoding: BufferEncoding = 'utf-8') => {
  return fs.readFileSync(filePath, encoding);
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string) => {
  fs.writeFileSync(filePath, data, 'utf-8');
  return true;
});

ipcMain.handle('fs:writeBinaryFile', async (_event, filePath: string, data: number[]) => {
  const buf = Buffer.from(data);
  fs.writeFileSync(filePath, buf);
  return true;
});

ipcMain.handle('fs:readBinaryFile', async (_event, filePath: string) => {
  const buf = fs.readFileSync(filePath);
  return Array.from(buf);
});

ipcMain.handle('fs:fileExists', async (_event, filePath: string) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  const stat = fs.statSync(filePath);
  return {
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    birthtime: stat.birthtime.toISOString()
  };
});

ipcMain.handle('app:getDataPath', () => {
  return app.getPath('userData');
});
