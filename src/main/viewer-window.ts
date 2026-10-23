import type { BrowserWindow, Display, Rectangle } from 'electron';
import type { EventEmitter } from 'node:events';
export type ViewerMode = 'borderless' | 'fullscreen';
/** Serializes native transitions; the settings window never auto-starts the viewer. */
export class ViewerWindow {
  active = false; mode: ViewerMode = 'borderless'; private settingsBounds: Rectangle | null = null;
  private queue: Promise<void> = Promise.resolve();
  constructor(private win: BrowserWindow, private notify: () => void) {}
  private serial(fn: () => Promise<void>) { const next = this.queue.catch(() => {}).then(fn); this.queue = next; return next; }
  private native(full: boolean): Promise<void> {
    if (this.win.isFullScreen() === full) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const event = full ? 'enter-full-screen' : 'leave-full-screen';
      const emitter=this.win as unknown as EventEmitter;
      const finish = () => { clearTimeout(timeout); emitter.removeListener(event, finish); resolve(); };
      const timeout = setTimeout(() => { emitter.removeListener(event, finish); this.win.isFullScreen() === full ? resolve() : reject(new Error('Fullscreen transition did not complete')); }, 3000);
      emitter.once(event, finish); this.win.setFullScreen(full);
    });
  }
  start(display: Display, mode: ViewerMode) {
    return this.serial(async () => {
      if (!this.active) this.settingsBounds = this.win.getBounds();
      this.mode = mode; this.active = true;
      // Windows can retain the fixed-size tracking bounds when a non-resizable window moves to a smaller display.
      await this.native(false); this.win.setResizable(true); this.win.setMovable(true); this.win.unmaximize();
      this.win.setBounds(display.bounds);
      this.win.setResizable(false); this.win.setMovable(false);
      if (mode === 'fullscreen') await this.native(true);
      this.notify();
    });
  }
  stop() {
    return this.serial(async () => {
      await this.native(false); this.active = false; this.win.setResizable(true); this.win.setMovable(true);
      if (this.settingsBounds) this.win.setBounds(this.settingsBounds);
      this.notify();
    });
  }
}
