// Development-only acquisition. Never called by the app or a normal build.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'assets/source/acquired'; await mkdir(directory, { recursive: true });
const results = [];
async function get(url, max = 2_000_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) }); if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  if (+response.headers.get('content-length') > max) throw new Error('Size limit exceeded');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > max) throw new Error('Size limit exceeded'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
for (const item of [
  { id: 'A01', creator: 'WickedInsignia', page: 'https://opengameart.org/content/clouds-with-transparency', pattern: /href="([^"]*fx_cloudalphas\.zip[^"]*)"/i, name: 'clouds.zip', evidence: 'https://opengameart.org/content/clouds-with-transparency' },
  { id: 'A02', creator: 'Kenney', page: 'https://kenney.nl/assets/foliage-sprites', pattern: /href=['"]([^'"]+\.zip[^'"]*)['"]/i, name: 'foliage.zip', evidence: 'https://kenney.nl/support' },
  { id: 'A06', creator: 'Dimitrios Savva / Poly Haven', page: 'https://polyhaven.com/a/wood_table', name: 'wood_table_diffuse.jpg', evidence: 'https://polyhaven.com/license' },
  { id: 'A11', creator: 'Kenney Vleugels / Kenney', page: 'https://kenney.nl/assets/foliage-pack', pattern: /href=['"]([^'"]+\.zip[^'"]*)['"]/i, name: 'foliage-pack.zip', evidence: 'https://kenney.nl/support' }
]) {
  const record = { ...item, pattern: undefined, retrieved: new Date().toISOString(), license: 'CC0-1.0', imported: false };
  try {
    let url;
    if (item.id === 'A06') { const metadata = JSON.parse((await get('https://api.polyhaven.com/files/wood_table')).toString()); await writeFile(`${directory}/wood_table-files.json`, JSON.stringify(metadata, null, 2)); url = Object.values(metadata.blend['1k'].blend.include).find(x => x.url.endsWith('wood_table_diff_1k.jpg')).url; }
    else { const html = (await get(item.page)).toString(); const match = item.pattern.exec(html); if (!match) throw new Error('No raw download link found on authoritative page'); url = new URL(match[1].replaceAll('&amp;', '&'), item.page).href; }
    record.downloadUrl = url; const data = await get(url, 50_000_000); await writeFile(`${directory}/${item.name}`, data); record.sha256 = createHash('sha256').update(data).digest('hex'); record.bytes = data.length; record.status = 'downloaded_uninspected';
    console.log(item.id, record.status, data.length);
  } catch (error) { record.status = 'blocked'; record.error = error.message; console.log(item.id, 'blocked:', error.message); }
  results.push(record);
}
await writeFile(`${directory}/acquisition.json`, JSON.stringify(results, null, 2));
