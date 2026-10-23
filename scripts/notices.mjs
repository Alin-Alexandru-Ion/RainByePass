import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
await mkdir('assets/licenses/dependencies', { recursive: true });
const rows = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const d = path.join(dir, entry.name);
    if (entry.name.startsWith('@')) { await scan(d); continue; }
    try {
      const p = JSON.parse(await readFile(path.join(d, 'package.json'), 'utf8'));
      const file = (await readdir(d)).find(f => /^(license|licence|copying)(\.|$)/i.test(f));
      const output = `${p.name.replaceAll('/', '-')}-${p.version}.txt`;
      if (file) await copyFile(path.join(d, file), path.join('assets/licenses/dependencies', output));
      rows.push({ name: p.name, version: p.version, declaredLicense: p.license ?? 'unknown', notice: file ? `assets/licenses/dependencies/${output}` : null });
    } catch { /* No package at directory root. */ }
    try { await scan(path.join(d, 'node_modules')); } catch { /* No nested dependencies. */ }
  }
}
await scan('node_modules');
await copyFile('node_modules/suncalc/LICENSE', 'assets/licenses/SunCalc-BSD-2-Clause.txt');
await writeFile('DEPENDENCY_NOTICES.md', '# Dependency notices\n\nOriginal RainByePass code and procedural scenery: MIT, copyright 2026 Alin-Alexandru Ion; see [LICENSE](LICENSE). Third-party dependencies retain their own terms.\n\nSunCalc BSD-2-Clause notice is preserved verbatim. Electron and Chromium runtime notices ship with the platform package. The following register includes development tools as well as runtime libraries; it does not relicense them. The offline Windows package contains built app files and notices, but no development `node_modules` tree. A package listed without a copied license file needs an upstream notice check before that npm package itself is redistributed.\n\n' + rows.map(r => `- ${r.name} ${r.version}: ${r.declaredLicense}${r.notice ? `; [notice](${r.notice})` : '; no license file in installed package; upstream notice check needed if redistributing this npm package'}`).join('\n') + '\n');
const manifest = JSON.parse(await readFile('assets/asset-manifest.json', 'utf8'));
await writeFile('THIRD_PARTY_ASSETS.md', '# Imported artwork\n\nOnly the runtime files below are imported. A01 cloud candidates were acquired and inspected but rejected as smoky/diffuse; they are source-only and not part of the app credits. Other catalogue entries remain candidates. No previews or supplier logos are shipped.\n\n' + manifest.assets.map(a => `- ${a.localPath}: ${a.creator}, ${a.license}; [source](${a.sourcePage}), [license evidence](${a.licenseEvidence}). Retrieved ${a.retrievedAt}. ${a.transformations}. Review: ${a.watermarkReview}.`).join('\n') + '\n\nExact raw/derived hashes, dimensions and acquisition URLs are in assets/asset-manifest.json. Original scenery authoring is in src/renderer/scene.ts and src/renderer/regional-landscapes.ts, MIT licensed by Alin-Alexandru Ion. Imported ingredients retain their recorded CC0 status.\n');
console.log('Generated dependency and imported-art notices.');
