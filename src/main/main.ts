import { app, BrowserWindow, ipcMain, screen, Menu, powerMonitor } from 'electron';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { validateSettings, type Settings } from '../core/settings';
import { atomicJson, loadSettings } from './storage';
import { ForecastService } from './forecast';
import { ViewerWindow } from './viewer-window';
import { smokeApplication } from './smoke';
const smoke = process.argv.includes('--smoke-test');
const viewerExitTest = process.argv.includes('--viewer-exit-test');
const exitTest = process.argv.includes('--exit-test') || viewerExitTest;
const smokeDir = process.env.RAIN_EVIDENCE_DIR || path.join(app.getAppPath(), 'evidence');
if (smoke || exitTest) app.setPath('userData', path.join(smokeDir, `profile-${process.pid}`));
app.setName('RainByePass');
let win: BrowserWindow; let settings: Settings; let recovery = ''; let forecast: ForecastService; let viewer: ViewerWindow;
let saveQueue: Promise<void> = Promise.resolve();
const displays = () => screen.getAllDisplays().map(d => ({ id: d.id, label: d.label || `Display ${d.id} (${d.size.width} × ${d.size.height})`, primary: d.id === screen.getPrimaryDisplay().id }));
function trusted(event: Electron.IpcMainInvokeEvent) {
  if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(path.join(__dirname, 'index.html')).href) throw new Error('Unauthorized IPC sender');
}
async function moveToDisplay(id: number) {
  const d = screen.getAllDisplays().find(x => x.id === id); if (!d) throw new Error('Display unavailable');
  if (viewer.active) await viewer.start(d, viewer.mode);
  // In settings the picker selects the future viewer monitor; it does not launch or move a fullscreen view.
}
const selectedDisplay = () => screen.getAllDisplays().find(d => d.id === settings.ui.displayId) || screen.getAllDisplays().find(d => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay();
const windowState = () => ({ fullscreen: win.isDestroyed() ? false : win.isFullScreen(), minimized: win.isDestroyed() ? false : win.isMinimized(), viewerActive: viewer.active, viewerMode: viewer.active?viewer.mode:settings.ui.viewerMode, displays: displays() });
const publishWindow = () => { if (!win.isDestroyed()) win.webContents.send('rain:window-status', windowState()); };
async function toggleViewer() { if (!viewer.active) return; const mode = viewer.mode === 'borderless' ? 'fullscreen' : 'borderless'; await viewer.start(selectedDisplay(), mode); settings.ui.viewerMode = mode; const next = saveQueue.catch(() => {}).then(() => atomicJson(path.join(app.getPath('userData'), 'settings.json'), settings)); saveQueue = next; await next; }
function updateForecast() { if (viewer.active && !win.isMinimized() && !smoke) void forecast.update(settings); else forecast.stop(); }
async function createWindow() {
  const stored = await loadSettings(path.join(app.getPath('userData'), 'settings.json')); settings = stored.settings; recovery = stored.recovery;
  forecast = new ForecastService(path.join(app.getPath('userData'), 'wind-cache.json'), state => { if (win && !win.isDestroyed()) win.webContents.send('rain:forecast-status', state); });
  await forecast.load();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win = new BrowserWindow({ x: display.workArea.x + 40, y: display.workArea.y + 40, width: Math.min(880, display.workArea.width - 80), height: Math.min(820, display.workArea.height - 80), minWidth: 480, minHeight: 360,
    title: 'RainByePass', frame: false, roundedCorners: false, backgroundColor: '#17262d', show: false, fullscreen: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false } });
  Menu.setApplicationMenu(null);
  viewer = new ViewerWindow(win, publishWindow);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  // The renderer has no network. MET HTTPS runs only in main after explicit opt-in.
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    let allowed = details.url.startsWith('data:') || details.url.startsWith('devtools:');
    if (details.url.startsWith('file:')) { try { const relative = path.relative(__dirname, fileURLToPath(details.url)); allowed = !relative.startsWith('..') && !path.isAbsolute(relative); } catch { allowed = false; } }
    callback({ cancel: !allowed });
  });
  ipcMain.handle('rain:load', async event => { trusted(event); return { settings, recovery, forecast: forecast.state, displays: displays(), fullscreen: win.isFullScreen(), smoke, systemZone: Intl.DateTimeFormat().resolvedOptions().timeZone, credits: JSON.parse(await readFile(path.join(__dirname, 'asset-manifest.json'), 'utf8')) }; });
  ipcMain.handle('rain:save', async (event, value) => {
    trusted(event); if (JSON.stringify(value).length > 65536) throw new Error('Settings too large');
    const valid = validateSettings(value); settings = valid;
    const next = saveQueue.catch(() => {}).then(() => atomicJson(path.join(app.getPath('userData'), 'settings.json'), valid)); saveQueue = next; await next;
    updateForecast(); return valid;
  });
  ipcMain.handle('rain:window', async (event, action: string, id: number) => {
    trusted(event);
    if (action === 'start-viewer') { await viewer.start(selectedDisplay(), settings.ui.viewerMode); updateForecast(); }
    else if (action === 'stop-viewer') { forecast.stop(); await viewer.stop(); }
    else if (action === 'toggle-viewer-mode') await toggleViewer();
    else if (action === 'minimize') win.minimize();
    else if (action === 'close') { await saveQueue.catch(() => {}); win.close(); }
    else if (action === 'move' && Number.isSafeInteger(id)) await moveToDisplay(id);
    else throw new Error('Invalid window action');
    return windowState();
  });
  ipcMain.handle('rain:forecast', async event => { trusted(event); if (viewer.active && !smoke) await forecast.update(settings); return forecast.state; });
  const status = publishWindow;
  win.on('enter-full-screen', status); win.on('leave-full-screen', status);
  win.on('minimize', () => { forecast.stop(); status(); }); win.on('restore', () => { status(); updateForecast(); });
  screen.on('display-added', status); screen.on('display-metrics-changed',status); screen.on('display-removed', () => { if (!win.isDestroyed()) { if (viewer.active) void moveToDisplay(selectedDisplay().id).catch(console.error); status(); } });
  win.webContents.on('before-input-event', (event, input) => { if (input.type !== 'keyDown') return; if (input.meta && input.key.toLowerCase() === 'q') { event.preventDefault(); app.quit(); } if (input.key === 'F11') { event.preventDefault(); if(viewer.active)void toggleViewer().catch(console.error); } });
  powerMonitor.on('resume', updateForecast);
  await win.loadFile(path.join(__dirname, 'index.html')); win.show();
  if (smoke) await runSmoke();
  else if (exitTest) {
    // Exercise the real renderer close handler and beforeunload save, with a separate test profile.
    setTimeout(() => { console.error('Normal close test timed out'); app.exit(1); }, 10000);
    void win.webContents.executeJavaScript(`new Promise(resolve => { const timer = setInterval(() => { if (document.body.dataset.ready === 'true') { clearInterval(timer); resolve(true); } }, 20); }).then(async () => { document.querySelector('input[data-setting="clouds.movementEnabled"]').click(); if (${viewerExitTest}) { document.getElementById('boost-button').click(); await new Promise(resolve=>{const timer=setInterval(()=>{if(document.body.classList.contains('viewing')){clearInterval(timer);resolve(true)}},20)}); await new Promise(r=>setTimeout(r,700)); } document.getElementById(${viewerExitTest ? "'viewer-exit'" : "'close-button'"}).click(); })`).catch(() => { /* The frame may be disposed after the expected close. */ });
  } else { const timer = setInterval(updateForecast, 60000); win.on('closed', () => { clearInterval(timer); forecast.stop(); }); }
}
async function runSmoke() { await smokeApplication(win,viewer,smokeDir); }
app.whenReady().then(createWindow).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => {
  if (!exitTest) { app.quit(); return; }
  void (async () => {
    const saved = JSON.parse(await readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf8'));
    const passed = saved.clouds.movementEnabled === false && saved.schemaVersion === 2;
    await mkdir(smokeDir, { recursive: true }); await writeFile(path.join(smokeDir, viewerExitTest?'viewer-exit-test.json':'exit-test.json'), JSON.stringify({ passed, normalRendererClose: true, fromViewer:viewerExitTest, unsavedCheckboxPersisted: saved.clouds.movementEnabled === false, profile: app.getPath('userData') }, null, 2));
    console.log('Normal close and final settings persistence:', passed ? 'PASS' : 'FAIL'); app.exit(passed ? 0 : 1);
  })().catch(error => { console.error(error); app.exit(1); });
});
app.on('before-quit', () => forecast?.stop());
