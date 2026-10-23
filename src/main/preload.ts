import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge } from './bridge';
const bridge: Bridge = {
  load: () => ipcRenderer.invoke('rain:load'),
  save: settings => ipcRenderer.invoke('rain:save', settings),
  window: (action, displayId) => ipcRenderer.invoke('rain:window', action, displayId),
  refreshForecast: () => ipcRenderer.invoke('rain:forecast'),
  onForecast(fn) { const listener = (_event: Electron.IpcRendererEvent, value: any) => fn(value); ipcRenderer.on('rain:forecast-status', listener); return () => ipcRenderer.removeListener('rain:forecast-status', listener); },
  onWindow(fn) { const listener = (_event: Electron.IpcRendererEvent, value: any) => fn(value); ipcRenderer.on('rain:window-status', listener); return () => ipcRenderer.removeListener('rain:window-status', listener); }
};
contextBridge.exposeInMainWorld('rain', bridge);
