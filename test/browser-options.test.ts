import { expect, test } from 'vitest';
import { launchOptions, SOFTWARE_GPU_FLAGS } from '../scripts/browser.ts';

// The launch options of the browser harness (`scripts/browser.ts`). No browser starts here: the
// function is pure, so the three modes are checked on their options alone.

const EXTRA = ['--mute-audio'];

test('the default mode is headless on SwiftShader, with the flags as before', () => {
  for (const env of [{}, { TYPESHADE_GPU: 'swiftshader' }]) {
    expect(launchOptions(env, EXTRA)).toEqual({
      executablePath: undefined,
      headless: true,
      args: [...SOFTWARE_GPU_FLAGS, ...EXTRA],
    });
  }
});

test('the device mode is a window with no software flag, and keeps the caller flags', () => {
  expect(launchOptions({ TYPESHADE_GPU: 'device' }, EXTRA)).toEqual({
    executablePath: undefined,
    headless: false,
    args: [...EXTRA],
  });
});

test('TYPESHADE_CHROMIUM names the binary in both modes, and an empty value is no binary', () => {
  const binary = '/opt/chrome/chrome';
  expect(launchOptions({ TYPESHADE_CHROMIUM: binary }, []).executablePath).toBe(binary);
  expect(
    launchOptions({ TYPESHADE_GPU: 'device', TYPESHADE_CHROMIUM: binary }, []).executablePath,
  ).toBe(binary);
  expect(launchOptions({ TYPESHADE_CHROMIUM: '' }, []).executablePath).toBeUndefined();
});

test('any other TYPESHADE_GPU value throws one error that names the two values', () => {
  expect(() => launchOptions({ TYPESHADE_GPU: 'gpu' }, [])).toThrow(
    /"swiftshader".*"device".*"gpu"/,
  );
});
