/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildUserscript } from './build-userscript.mjs';
import { buildStyles } from './build-styles.mjs';
const manifest = JSON.parse(await fs.readFile('extension/manifest.json', 'utf8'));
const { version } = manifest;
const release = `dist/SeekFlow-${version}-release`;
const extensionDir = 'dist/SeekFlow';
const extensionZip = `SeekFlow-${version}.zip`;
function zip(source, output) {
  if (process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${source}/*' -DestinationPath '${output}' -Force`], { stdio: 'inherit' });
  else execFileSync('zip', ['-qr', output, '.'], { cwd: source, stdio: 'inherit' });
}
await fs.mkdir('dist', { recursive: true });
await fs.rm(extensionDir, { recursive: true, force: true });
await fs.rm(release, { recursive: true, force: true });
await fs.mkdir(release, { recursive: true });
await fs.mkdir(extensionDir, { recursive: true });
// Explicit allowlist: never recursively copy source workspaces, debug captures, or user data.
const files = [...new Set(['manifest.json', ...manifest.content_scripts.flatMap(s => [...s.js, ...(s.css || [])]), 'popup.html', 'popup.js', 'popup.css', ...Object.values(manifest.icons)])];
for (const file of files) {
  const dest = `${extensionDir}/${file}`;
  await fs.mkdir(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
  await fs.copyFile(`extension/${file}`, dest);
}
for (const file of ['LICENSE', 'NOTICE']) await fs.copyFile(file, `${extensionDir}/${file}`);
await fs.rm(`dist/${extensionZip}`, { force: true });
// zip(1) resolves relative paths from cwd, unlike PowerShell.
zip(extensionDir, process.platform === 'win32' ? `dist/${extensionZip}` : `../${extensionZip}`);
await fs.copyFile(`dist/${extensionZip}`, `${release}/${extensionZip}`);
const userscript = await buildUserscript(manifest);
await fs.writeFile(`${release}/SeekFlow-${version}.user.js`, userscript);
const styles = await buildStyles(version);
await fs.writeFile('styles/SeekFlow.user.css', styles.usercss);
await fs.writeFile(`${release}/SeekFlow-${version}.user.css`, styles.usercss);
await fs.writeFile(`${release}/SeekFlow-${version}.css`, styles.render('waterlilies', 'native'));
for (const file of ['LICENSE', 'NOTICE']) await fs.copyFile(file, `${release}/${file}`);
const hashes = [];
for (const file of (await fs.readdir(release)).sort()) {
  const data = await fs.readFile(`${release}/${file}`);
  hashes.push(`${createHash('sha256').update(data).digest('hex')}  ${file}`);
}
await fs.writeFile(`${release}/SHA256SUMS.txt`, hashes.join('\n') + '\n');
const releaseZip = `${release}.zip`;
await fs.rm(releaseZip, { force: true });
zip(release, process.platform === 'win32' ? releaseZip : `../SeekFlow-${version}-release.zip`);
console.log(`Ready: ${extensionDir}/\nRelease files: ${release}/\nAll editions: ${releaseZip}`);
