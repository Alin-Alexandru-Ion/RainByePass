import { readFile, mkdir, rename, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { validateSettings, type Settings } from '../core/settings';
export async function atomicJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600, flush: true });
  await rename(temp, file);
}
export async function readJson(file: string, maxBytes = 2_000_000): Promise<unknown> {
  if ((await stat(file)).size > maxBytes) throw new Error('Stored file exceeds size limit');
  return JSON.parse(await readFile(file, 'utf8'));
}
export async function loadSettings(file: string): Promise<{ settings: Settings; recovery: string }> {
  try { return { settings: validateSettings(await readJson(file, 65536)), recovery: '' }; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { settings: validateSettings(null), recovery: '' };
    try { await rename(file, `${file}.corrupt-${Date.now()}`); } catch { /* Keep original if backup is unavailable. */ }
    return { settings: validateSettings(null), recovery: 'Unreadable settings recovered to defaults. Original file retained as a corruption backup where possible.' };
  }
}
