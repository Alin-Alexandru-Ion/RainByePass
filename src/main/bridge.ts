import type { Settings } from '../core/settings';
import type { ForecastStatus } from './forecast';
export interface DisplayInfo { id: number; label: string; primary: boolean; }
export interface WindowState { fullscreen: boolean; minimized: boolean; viewerActive: boolean; viewerMode: Settings['ui']['viewerMode']; displays: DisplayInfo[]; }
export interface InitialState { settings: Settings; recovery: string; forecast: ForecastStatus; displays: DisplayInfo[]; fullscreen: boolean; smoke: boolean; systemZone: string; credits: unknown; }
export interface Bridge {
  load(): Promise<InitialState>;
  save(settings: Settings): Promise<Settings>;
  window(action: 'start-viewer' | 'stop-viewer' | 'toggle-viewer-mode' | 'minimize' | 'close' | 'move', displayId?: number): Promise<WindowState>;
  refreshForecast(): Promise<ForecastStatus>;
  onForecast(fn: (s: ForecastStatus) => void): () => void;
  onWindow(fn: (s: WindowState) => void): () => void;
}
declare global { interface Window { rain: Bridge; rainTest?: any; } }
