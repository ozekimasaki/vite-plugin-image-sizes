import type { ResolvedConfig } from 'vite';
import path from 'path';
import fs from 'fs/promises';

export function normalizeUrl(url: string): string {
  return url.replace(/\\/g, '/');
}

export function stripQueryAndHash(url: string): string {
  const idx = url.search(/[?#]/);
  return idx === -1 ? url : url.slice(0, idx);
}

export function removeBasePrefix(url: string, base: string | undefined): string {
  const b = base ?? '/';
  const normBase = b.endsWith('/') ? b : `${b}/`;
  if (normBase !== '/' && url.startsWith(normBase)) {
    const rest = url.slice(normBase.length);
    return `/${rest}`;
  }
  return url;
}

export function isAbsoluteLike(url: string, base: string | undefined): boolean {
  const b = base ?? '/';
  const normBase = b.endsWith('/') ? b : `${b}/`;
  return url.startsWith('/') || (normBase !== '/' && url.startsWith(normBase));
}

export async function tryReadFile(
  paths: string[]
): Promise<{ buffer: Buffer; path: string } | null> {
  for (const p of paths) {
    try {
      const buffer = await fs.readFile(p);
      return { buffer, path: p };
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function resolveCandidatePaths(params: {
  normalizedUrl: string;
  absoluteLike: boolean;
  config: ResolvedConfig;
  htmlDir: string;
  outRoot: string;
  mode: 'dev' | 'build';
}): string[] {
  const { normalizedUrl, absoluteLike, config, htmlDir, outRoot, mode } = params;
  const candidates: string[] = [];
  const hasPublicDir =
    typeof (config as any).publicDir === 'string' && (config as any).publicDir.length > 0;
  const withoutBase = removeBasePrefix(normalizedUrl, config.base);
  const relFromRoot = withoutBase.startsWith('/') ? withoutBase.slice(1) : withoutBase;

  if (mode === 'dev') {
    if (absoluteLike) {
      if (hasPublicDir) {
        candidates.push(path.resolve((config as any).publicDir, relFromRoot));
      }
      candidates.push(path.resolve(config.root, relFromRoot));
    } else {
      candidates.push(path.resolve(htmlDir, normalizedUrl));
      if (hasPublicDir) candidates.push(path.resolve((config as any).publicDir, normalizedUrl));
      candidates.push(path.resolve(config.root, normalizedUrl));
    }
  } else {
    if (absoluteLike) {
      candidates.push(path.resolve(outRoot, relFromRoot));
    } else {
      candidates.push(path.resolve(htmlDir, normalizedUrl));
      candidates.push(path.resolve(outRoot, normalizedUrl));
    }
  }

  return candidates;
}


