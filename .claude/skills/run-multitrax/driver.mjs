// Driver for the multitrax Electron app.
// Reads commands one-per-line from stdin (works both piped in one shot, and
// interactively in a real terminal) and prints one result line per command.
//
// Usage:
//   node .claude/skills/run-multitrax/driver.mjs <<'EOF'
//   launch
//   open .claude/skills/run-multitrax/fixtures/tone.wav
//   ss 01-loaded
//   quit
//   EOF
//
// See SKILL.md for the full command reference and known gotchas.

import { _electron as electron } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const APP_DIR = path.resolve(import.meta.dirname, '../../..');
const SHOT_DIR = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'multitrax-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const VITE_PORT = 5173;
const VITE_URL = `http://localhost:${VITE_PORT}`;

let app = null;
let page = null;
let viteProc = null;

const electronBin = path.join(
  APP_DIR,
  process.platform === 'win32'
    ? 'node_modules/electron/dist/electron.exe'
    : process.platform === 'darwin'
      ? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
      : 'node_modules/electron/dist/electron',
);

async function isViteUp() {
  try {
    const res = await fetch(VITE_URL, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureViteRunning() {
  if (await isViteUp()) return 'already running';
  const logPath = path.join(SHOT_DIR, 'vite.log');
  const log = fs.openSync(logPath, 'a');
  // A single command string (not an argv array) with shell:true — passing
  // both together makes Node warn (DEP0190) that argv isn't shell-escaped.
  viteProc = spawn(`pnpm exec vite --port ${VITE_PORT}`, {
    cwd: APP_DIR,
    stdio: ['ignore', log, log],
    shell: true,
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isViteUp()) return `started (log: ${logPath})`;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`vite dev server did not come up — see ${logPath}`);
}

function clickTextInPage(text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')];
    const el = els.find((e) => e.textContent?.trim() === t) ?? els.find((e) => e.textContent?.includes(t));
    if (!el) return 'NOT_FOUND';
    el.click();
    return 'OK: ' + el.tagName;
  }, text);
}

const COMMANDS = {
  async launch() {
    if (app) return console.log('already launched');
    console.log('vite:', await ensureViteRunning());
    app = await electron.launch({
      executablePath: electronBin,
      args: [APP_DIR],
      timeout: 30_000,
    });
    // Electron always runs in dev mode here (unpackaged ⇒ app.isPackaged is
    // false ⇒ main.ts's isDev check is true regardless of NODE_ENV), which
    // is why this needs the Vite dev server rather than the built
    // dist/renderer/index.html. It also means DevTools auto-opens as a
    // second "window" — filter it out below.
    await new Promise((r) => setTimeout(r, 3_000));
    page = app.windows().find((w) => !w.url().startsWith('devtools://')) ?? (await app.firstWindow());
    await page.waitForLoadState('domcontentloaded');
    console.log('launched.', app.windows().length, 'windows:');
    for (const w of app.windows()) console.log(' ', w.url());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  // Loads an audio file WITHOUT the native OS file picker (which can't be
  // automated). Patches the main-process `dialog.showOpenDialog` — the same
  // object main.ts's `dialog:openAudioFiles` IPC handler calls — so that
  // handler still runs for real and still populates its `grantedPaths`
  // allowlist. (Stubbing the renderer's `window.electronAPI.openAudioFiles`
  // instead breaks this: `fs:readAudioFile` then rejects every path as
  // "not granted by file dialog" and the track silently fails to load.)
  async open(relOrAbsPath) {
    if (!app || !page) return console.log('ERROR: launch first');
    const abs = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(APP_DIR, relOrAbsPath);
    await app.evaluate(
      async ({ dialog }, filePath) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
      },
      abs,
    );
    console.log('click Open Files ->', await clickTextInPage('Open Files'));
    try {
      await page.waitForSelector('.track-player, .mixer-strip', { timeout: 10_000 });
      console.log('track loaded');
    } catch {
      console.log('TIMEOUT waiting for track to appear');
    }
  },

  // Switches from the default free-form Track view to the Mixer view
  // (View menu → "Switch to Mixer View"). Two clicks, encapsulated because
  // the menu item text differs depending on which view is currently active.
  async mixer() {
    if (!page) return console.log('ERROR: launch first');
    console.log('click View ->', await clickTextInPage('View'));
    await new Promise((r) => setTimeout(r, 200));
    console.log('click Switch to Mixer View ->', await clickTextInPage('Switch to Mixer View'));
    try {
      await page.waitForSelector('.mixer-strip', { timeout: 5_000 });
      console.log('mixer view active');
    } catch {
      console.log('TIMEOUT waiting for .mixer-strip');
    }
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click();
      return 'OK';
    }, sel);
    console.log('click', sel, '->', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    console.log('click-text', JSON.stringify(text), '->', await clickTextInPage(text));
  },

  async type(text) {
    if (page) await page.keyboard.type(text, { delay: 30 });
  },
  async press(key) {
    if (page) await page.keyboard.press(key);
  },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try {
      await page.waitForSelector(sel, { timeout: 10_000 });
      console.log('found:', sel);
    } catch {
      console.log('TIMEOUT:', sel);
    }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try {
      console.log(JSON.stringify(await page.evaluate(expr)));
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(
      await page.evaluate((s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)', sel || null),
    );
  },

  async windows() {
    if (!app) return console.log('ERROR: launch first');
    for (const w of app.windows()) console.log(' ', w.url());
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    if (viteProc) {
      // viteProc.kill() only signals the immediate child. With shell:true
      // on Windows that's cmd.exe, which does NOT propagate the kill to its
      // own child (pnpm.cmd) or grandchild (the actual vite/node process) —
      // the dev server keeps listening on 5173 after quit. /T tree-kills.
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(viteProc.pid), '/f', '/t']);
      else viteProc.kill();
      viteProc = null;
    }
    app = null;
    page = null;
  },

  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '));
  },
};

// readline emits 'line' for every buffered line as soon as it parses them —
// with piped/heredoc input that's all of them nearly at once, well before
// `launch` (or any other async command) resolves. Without an explicit queue,
// every command after the first races "app is still null" and fails with
// "launch first". So: queue lines, run them one at a time.
const queue = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    const line = queue.shift();
    const [cmd, ...rest] = line.trim().split(/\s+/);
    if (!cmd) continue;
    const fn = COMMANDS[cmd];
    if (!fn) {
      console.log('unknown:', cmd, '— try: help');
      continue;
    }
    try {
      await fn(rest.join(' '));
    } catch (e) {
      console.log('ERROR:', e.message);
    }
    if (cmd === 'quit') {
      draining = false;
      process.exit(0);
    }
    // In piped/heredoc mode stdin can hit EOF (closing readline) while this
    // loop is still draining queued commands — prompt() on a closed
    // interface throws ERR_USE_AFTER_CLOSE. Harmless in that mode; ignore.
    try {
      rl.prompt();
    } catch {
      /* readline already closed — fine in piped/batch mode */
    }
  }
  draining = false;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'driver> ' });
rl.on('line', (line) => {
  queue.push(line);
  void drain();
});
// With piped/heredoc stdin, readline fires 'close' as soon as EOF is read —
// which can be well before `drain()` has finished awaiting an in-flight
// command (e.g. `launch` is still mid-flight). Wait for the queue to
// actually finish before quitting, or an in-flight `launch` gets killed by
// process.exit before it ever gets to open a window.
rl.on('close', async () => {
  while (draining || queue.length > 0) await new Promise((r) => setTimeout(r, 100));
  await COMMANDS.quit();
  process.exit(0);
});

console.log('multitrax driver — "help" for commands, "launch" to start');
rl.prompt();
