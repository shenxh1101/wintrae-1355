import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openAudioFiles: () => ipcRenderer.invoke('dialog:openAudioFiles'),
  saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  readFile: (filePath: string, encoding?: BufferEncoding) =>
    ipcRenderer.invoke('fs:readFile', filePath, encoding),
  writeFile: (filePath: string, data: string) =>
    ipcRenderer.invoke('fs:writeFile', filePath, data),
  writeBinaryFile: (filePath: string, data: number[]) =>
    ipcRenderer.invoke('fs:writeBinaryFile', filePath, data),
  readBinaryFile: (filePath: string) =>
    ipcRenderer.invoke('fs:readBinaryFile', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('fs:fileExists', filePath),
  stat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath')
});

export type ElectronAPI = {
  openAudioFiles: () => Promise<string[]>;
  saveFile: (defaultName: string) => Promise<string | undefined>;
  selectDirectory: () => Promise<string | null>;
  readFile: (filePath: string, encoding?: BufferEncoding) => Promise<string>;
  writeFile: (filePath: string, data: string) => Promise<boolean>;
  writeBinaryFile: (filePath: string, data: number[]) => Promise<boolean>;
  readBinaryFile: (filePath: string) => Promise<number[]>;
  fileExists: (filePath: string) => Promise<boolean>;
  stat: (filePath: string) => Promise<{ size: number; mtime: string; birthtime: string }>;
  getDataPath: () => Promise<string>;
};
