import { cp, copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPackage, extractFile } from '@electron/asar';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('The offline package command is currently verified for Windows x64 only.');
}

const root = path.resolve('.');
const releases = path.join(root, 'releases');
await mkdir(releases, { recursive: true });
const releaseRoot = path.resolve(releases);
if ((await lstat(releaseRoot)).isSymbolicLink()) throw new Error('Releases directory must not be a symlink.');
const app = JSON.parse(await readFile('package.json', 'utf8'));
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const output = path.join(releaseRoot, `RainByePass-win32-x64-v${app.version}-${stamp}-${process.pid}`);
const payload = path.join(releaseRoot, `.RainByePass-${process.pid}.payload`);
const insideRelease = target => {
  const relative = path.relative(releaseRoot, path.resolve(target));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Package path outside releases: ${target}`);
  }
};
for (const target of [output, payload]) insideRelease(target);
const exists = async target => stat(target).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});
const checkedRemove = async target => {
  if (await exists(target)) {
    insideRelease(target);
    if ((await lstat(target)).isSymbolicLink()) throw new Error(`Refusing to remove symlink: ${target}`);
    await rm(target, { recursive: true, force: true });
  }
};
if (await exists(output) || await exists(payload)) {
  throw new Error('A packaging output or work directory already exists; inspect it before retrying.');
}

const electronVersion = (await readFile('node_modules/electron/dist/version', 'utf8')).trim();
if (electronVersion !== app.devDependencies.electron) throw new Error('Installed Electron runtime version differs from package.json.');

try {
  await mkdir(output);
  await writeFile(path.join(output, 'INCOMPLETE_BUILD.txt'), 'Packaging has not finished. Do not run this folder.\n');
  const electronDist = path.join(root, 'node_modules/electron/dist');
  for (const entry of await readdir(electronDist)) {
    await cp(path.join(electronDist, entry), path.join(output, entry), { recursive: true });
  }
  await rename(path.join(output, 'electron.exe'), path.join(output, 'RainByePass.exe'));

  await mkdir(payload);
  await cp('dist', path.join(payload, 'dist'), { recursive: true });
  await mkdir(path.join(payload, 'assets'));
  await cp('assets/licenses', path.join(payload, 'assets/licenses'), { recursive: true });
  await copyFile('assets/asset-manifest.json', path.join(payload, 'assets/asset-manifest.json'));
  for (const file of ['LICENSE', 'LICENSE_DECISION.md', 'README.md', 'THIRD_PARTY_ASSETS.md', 'DEPENDENCY_NOTICES.md']) {
    await copyFile(file, path.join(payload, file));
  }
  await writeFile(path.join(payload, 'package.json'), JSON.stringify({
    name: app.name, version: app.version, private: true, license: app.license,
    description: app.description, main: app.main
  }, null, 2) + '\n');
  await createPackage(payload, path.join(output, 'resources/app.asar'));
  await copyFile('LICENSE', path.join(output, 'RAINBYEPASS_LICENSE.txt'));
  await copyFile('THIRD_PARTY_ASSETS.md', path.join(output, 'THIRD_PARTY_ASSETS.md'));
  await copyFile('DEPENDENCY_NOTICES.md', path.join(output, 'DEPENDENCY_NOTICES.md'));

  const asar = path.join(output, 'resources/app.asar');
  const bundled = JSON.parse(extractFile(asar, 'package.json').toString());
  if (bundled.license !== 'MIT' || !extractFile(asar, 'LICENSE').toString().includes('Alin-Alexandru Ion')) {
    throw new Error('Packaged MIT notice did not match the project license.');
  }
  await checkedRemove(payload);
  await rm(path.join(output, 'INCOMPLETE_BUILD.txt'));
  console.log(`Offline Windows x64 package: ${output}`);
} finally {
  await checkedRemove(payload);
}
