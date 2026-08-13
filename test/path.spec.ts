import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResolvedConfig } from 'vite';

import {
  dirnamePosix,
  findBundleAsset,
  normalizeUrl,
  resolveCandidatePaths,
} from '../src/utils/path.js';

function configAt(root: string, publicDir: string): ResolvedConfig {
  return {
    root,
    base: '/',
    publicDir,
    command: 'build',
    build: { outDir: 'dist' },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as ResolvedConfig;
}

describe('path helpers (win / mac / linux)', () => {
  it('normalizeUrl converts Windows separators', () => {
    expect(normalizeUrl('images\\pic.svg')).toBe('images/pic.svg');
    expect(normalizeUrl('C:\\site\\pic.svg')).toBe('C:/site/pic.svg');
  });

  it('dirnamePosix keeps URL paths independent of the host OS', () => {
    expect(dirnamePosix('pages/sub/index.html')).toBe('pages/sub');
    expect(dirnamePosix('pages\\sub\\index.html')).toBe('pages/sub');
    expect(dirnamePosix('index.html')).toBe('.');
  });

  it('findBundleAsset looks up posix file names from mixed separators', () => {
    const bundle = {
      'assets/pic.svg': {
        type: 'asset',
        fileName: 'assets/pic.svg',
        source: '<svg />',
      },
    };
    const found = findBundleAsset(bundle, '\\assets\\pic.svg', '/');
    expect(found?.fileName).toBe('assets/pic.svg');
  });

  it('resolveCandidatePaths joins relative URLs onto htmlDir', () => {
    const htmlDir = path.resolve('/tmp/pages/sub');
    const root = path.resolve('/tmp');
    const candidates = resolveCandidatePaths({
      normalizedUrl: './images/pic.svg',
      absoluteLike: false,
      config: configAt(root, path.resolve(root, 'public')),
      htmlDir,
      outRoot: path.resolve(root, 'dist'),
      mode: 'build',
    });
    expect(candidates[0]).toBe(path.resolve(htmlDir, './images/pic.svg'));
  });
});
