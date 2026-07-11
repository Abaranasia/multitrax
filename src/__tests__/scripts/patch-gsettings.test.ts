/// <reference types="vitest" />
/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'path';

const modulePath = '../../../scripts/patch-gsettings.mjs';

// The script builds its output dir via path.join(process.cwd(), '.gsettings-schemas'),
// which uses the platform's separator (backslash on Windows). Mirror that here instead
// of hardcoding forward slashes, so this test passes on any OS.
const CUSTOM_DIR = join('/tmp/workspace', '.gsettings-schemas');

describe('patch-gsettings.mjs', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/workspace');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`EXIT:${code ?? 0}`);
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('skips when the schema directory is not found', async () => {
    const fsMock = {
      mkdirSync: vi.fn(),
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
    };

    vi.doMock('fs', () => fsMock);
    vi.doMock('child_process', () => ({ spawnSync: vi.fn() }));

    await expect(import(modulePath)).rejects.toThrow('EXIT:0');

    expect(fsMock.mkdirSync).toHaveBeenCalledWith(CUSTOM_DIR, { recursive: true });
    expect(warnSpy).toHaveBeenCalledWith('patch-gsettings: schema dir not found, skipping');
  });

  it('injects the font-antialiasing key and compiles schemas when missing', async () => {
    const sysDir = '/usr/share/glib-2.0/schemas';
    const ifaceFile = 'org.gnome.desktop.interface.gschema.xml';
    const schemaContent = '<schema id="org.gnome.desktop.interface"><key type="s" name="some-other-key"></key></schema>';
    const otherContent = '<schema id="some.other.schema"></schema>';

    const fsMock = {
      mkdirSync: vi.fn(),
      existsSync: vi.fn((path: string) => path === sysDir),
      readdirSync: vi.fn((path: string) => {
        if (path === sysDir) return [ifaceFile, 'other.xml'];
        return [];
      }),
      readFileSync: vi.fn((path: string) => {
        if (path.endsWith(ifaceFile)) return schemaContent;
        return otherContent;
      }),
      writeFileSync: vi.fn(),
      copyFileSync: vi.fn(),
    };

    const spawnSyncMock = vi.fn(() => ({ status: 0 }));

    vi.doMock('fs', () => fsMock);
    vi.doMock('child_process', () => ({ spawnSync: spawnSyncMock }));

    await import(modulePath);

    expect(fsMock.mkdirSync).toHaveBeenCalledWith(CUSTOM_DIR, { recursive: true });
    expect(fsMock.copyFileSync).toHaveBeenCalledTimes(2);
    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      join(CUSTOM_DIR, ifaceFile),
      expect.stringContaining('name="font-antialiasing"'),
    );
    expect(spawnSyncMock).toHaveBeenCalledWith('glib-compile-schemas', [CUSTOM_DIR], { stdio: 'inherit' });
    expect(logSpy).toHaveBeenCalledWith(`patch-gsettings: compiled schemas -> ${CUSTOM_DIR}`);
  });
});
