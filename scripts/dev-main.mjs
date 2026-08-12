// scripts/dev-main.mjs
// Launches Electron for local development. The GNOME 46 GTK/gsettings
// workaround (see patch-gsettings.mjs) only applies on Linux, and so does the
// Wayland/no-sandbox flag set it requires — applying `--no-sandbox`
// unconditionally disabled Electron's OS-level sandbox on every platform,
// even though macOS/Windows don't need it. Only Linux gets those flags here.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron',
);

const args = [];
const env = { ...process.env, NODE_ENV: 'development' };

if (process.platform === 'linux') {
  env.GSETTINGS_SCHEMA_DIR = './.gsettings-schemas';
  env.GDK_BACKEND = 'wayland';
  args.push('--no-sandbox', '--enable-features=UseOzonePlatform', '--ozone-platform=wayland');
}

args.push('dist/main/main.js');

const child = spawn(electronBin, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
