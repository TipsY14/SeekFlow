/* SPDX-License-Identifier: Apache-2.0
Copyright 2026 TipsY14 */
import fs from 'node:fs/promises';
const manifest = JSON.parse(await fs.readFile('extension/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3 || manifest.permissions.join(',') !== 'storage') throw new Error('Manifest permission regression');
if (manifest.host_permissions || manifest.background || manifest.web_accessible_resources) throw new Error('Unexpected expanded permissions');
const files = ['content.js','main.js','styles.css','restrained.css','account-settings.css','space.css','ruling.css','theme-states.css','lucky.css','palettes.css','popup.html','popup.js','popup.css','icons/16.png','icons/48.png','icons/128.png'];
for (const file of files) await fs.access(`extension/${file}`);
const css = await fs.readFile('extension/lucky.css', 'utf8') + await fs.readFile('extension/theme-states.css', 'utf8') + await fs.readFile('extension/ruling.css', 'utf8') + await fs.readFile('extension/space.css', 'utf8') + await fs.readFile('extension/account-settings.css', 'utf8') + await fs.readFile('extension/restrained.css', 'utf8') + await fs.readFile('extension/styles.css', 'utf8') + await fs.readFile('extension/palettes.css', 'utf8');
if (/gradient\s*\(/i.test(css)) throw new Error('Unexpected gradient palette');
if (/https?:\/\//.test(css)) throw new Error('External CSS resource');
const js = await fs.readFile('extension/content.js', 'utf8');
if (/eval\(|new Function|document\.cookie|csrf_token|security_token/.test(js) || /\/api\//.test(js.replace('/api/account/getInfo/', ''))) throw new Error('Unsafe code or forum mutation');
const metadata = JSON.parse(await fs.readFile('package.json', 'utf8'));
const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const content = await fs.readFile('extension/content.js', 'utf8');
if (metadata.version !== manifest.version || lock.version !== manifest.version || lock.packages[''].version !== manifest.version || !content.includes(`version: '${manifest.version}'`)) throw new Error('Release version mismatch');
const cssEdition = await fs.readFile('styles/SeekFlow.user.css', 'utf8');
if (!cssEdition.includes(`@version ${manifest.version}`) || !cssEdition.includes('@preprocessor uso')) throw new Error('UserCSS release metadata mismatch');
if (['nsu-reference-preview', 'nsu-user-context', 'setting(\'references\''].some(token => content.includes(token))) throw new Error('Removed comment eye controls returned');
if (metadata.license !== 'Apache-2.0' || lock.packages[''].license !== 'Apache-2.0' || !cssEdition.includes('@license Apache-2.0')) throw new Error('Release license mismatch');
for (const file of ['LICENSE', 'NOTICE']) await fs.access(file);
console.log('Manifest, version consistency, license, packaged assets, scoped CSS, and safety checks passed.');
