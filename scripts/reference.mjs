import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('assets/source/reference', { recursive: true });
const source = 'https://data.iana.org/time-zones/tzdb/zone1970.tab';
const response = await fetch(source, { signal: AbortSignal.timeout(20000) }); if (!response.ok) throw new Error('IANA download failed');
const text = await response.text(); await writeFile('assets/source/reference/zone1970.tab', text);
function coordinate(value) { const sign = value[0] === '-' ? -1 : 1; const n = value.slice(1), digits = n.length === 4 || n.length === 6 ? 2 : 3; return sign * (+n.slice(0, digits) + +n.slice(digits, digits + 2) / 60 + +(n.slice(digits + 2) || 0) / 3600); }
const records = text.split('\n').filter(l => l && !l.startsWith('#')).map(l => { const [,coords,zone] = l.split('\t'); const matches = coords.match(/[+-]\d+/g); return { zone, latitude: coordinate(matches[0]), longitude: coordinate(matches[1]) }; });
await writeFile('src/core/zone-reference.ts', `// Generated from public-domain IANA zone1970.tab on 2026-10-14. Representative coordinates, not geolocation.\nexport const zoneReference = ${JSON.stringify(records, null, 2)};\n`);
const cc0 = await fetch('https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt', { signal: AbortSignal.timeout(20000) }); if (cc0.ok) await writeFile('assets/licenses/CC0-1.0.txt', await cc0.text());
console.log('Bundled', records.length, 'public-domain zone references; CC0 license status:', cc0.status);
