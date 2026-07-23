// scripts/patch-gsettings.mjs
// Patches the org.gnome.desktop.interface GSettings schema to add the
// 'font-antialiasing' key that was removed in GNOME 46 but is still
// referenced by Electron's GTK integration (causing a SIGSEGV).

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path/posix';

const SCHEMA_ID = 'org.gnome.desktop.interface';
const CUSTOM_DIR = join(process.cwd(), '.gsettings-schemas');
const SYS_DIRS = ['/usr/share/glib-2.0/schemas', '/usr/local/share/glib-2.0/schemas'];

function findSysDir() {
  for (const dir of SYS_DIRS) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.xml'));
    for (const f of files) {
      const content = readFileSync(join(dir, f), 'utf8');
      if (content.includes(`id="${SCHEMA_ID}"`)) return { dir, ifaceFile: f };
    }
  }
  return null;
}

mkdirSync(CUSTOM_DIR, { recursive: true });

const found = findSysDir();
if (!found) {
  console.warn('patch-gsettings: schema dir not found, skipping');
  process.exit(0);
}

// Copy every XML file so enum/flag types referenced across files are resolved
const allXml = readdirSync(found.dir).filter((f) => f.endsWith('.xml'));
for (const f of allXml) {
  copyFileSync(join(found.dir, f), join(CUSTOM_DIR, f));
}

// Patch the interface schema file if the key is missing
const ifacePath = join(CUSTOM_DIR, found.ifaceFile);
let xml = readFileSync(ifacePath, 'utf8');

if (!xml.includes('name="font-antialiasing"')) {
  const markerIdx = xml.indexOf(`id="${SCHEMA_ID}"`);
  const closeIdx = markerIdx !== -1 ? xml.indexOf('</schema>', markerIdx) : -1;

  if (closeIdx !== -1) {
    const injected =
      `\n    <key type="s" name="font-antialiasing">` + `<default>'grayscale'</default></key>`;
    xml = xml.slice(0, closeIdx) + injected + '\n  ' + xml.slice(closeIdx);
    writeFileSync(ifacePath, xml);
    console.log('patch-gsettings: injected font-antialiasing key');
  } else {
    console.warn('patch-gsettings: could not locate </schema> tag, skipping');
    process.exit(0);
  }
} else {
  console.log('patch-gsettings: key already present, no patch needed');
}

const result = spawnSync('glib-compile-schemas', [CUSTOM_DIR], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('patch-gsettings: glib-compile-schemas failed');
  process.exit(1);
}

console.log(`patch-gsettings: compiled schemas -> ${CUSTOM_DIR}`);
