import type { ResolvedConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';

export function normalizeUrl(url: string): string {
  return url.replace(/\\/g, '/');
}

/** Vite の URL / bundle fileName は POSIX。path.dirname は Windows で区切りを変える */
export function dirnamePosix(filePath: string): string {
  const normalized = normalizeUrl(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx <= 0 ? (idx === 0 ? '/' : '.') : normalized.slice(0, idx);
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

export type BundleAsset = {
  type: 'asset';
  fileName: string;
  source: string | Uint8Array;
};

export type BundleLike = Record<
  string,
  { type: string; fileName?: string; source?: string | Uint8Array }
>;

export function assetSourceToBuffer(source: string | Uint8Array): Buffer {
  return typeof source === 'string' ? Buffer.from(source) : Buffer.from(source);
}

export function assetSourceToString(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : new TextDecoder().decode(source);
}

/** generateBundle 内の hashed / コピー済みアセットを URL から探す */
export function findBundleAsset(
  bundle: BundleLike,
  url: string,
  base: string | undefined,
): BundleAsset | undefined {
  const normalized = normalizeUrl(stripQueryAndHash(url));
  const withoutBase = removeBasePrefix(normalized, base);
  const fileName = withoutBase.replace(/^\//, '');
  const item = bundle[fileName];
  if (item && item.type === 'asset' && item.source !== undefined) {
    return {
      type: 'asset',
      fileName: item.fileName ?? fileName,
      source: item.source,
    };
  }
  return undefined;
}

export async function tryStatFile(
  paths: string[],
): Promise<{ path: string; mtimeMs: number; size: number } | null> {
  for (const p of paths) {
    try {
      const st = await fs.stat(p);
      if (st.isFile()) {
        return { path: p, mtimeMs: st.mtimeMs, size: st.size };
      }
    } catch {
      // 次の候補へ
    }
  }
  return null;
}

export async function tryReadFile(
  paths: string[]
): Promise<{ buffer: Buffer; path: string } | null> {
  const found = await tryStatFile(paths);
  if (!found) return null;
  const buffer = await fs.readFile(found.path);
  return { buffer, path: found.path };
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
  const publicDir = config.publicDir;
  const hasPublicDir = typeof publicDir === 'string' && publicDir.length > 0;
  const withoutBase = removeBasePrefix(normalizedUrl, config.base);
  const relFromRoot = withoutBase.startsWith('/') ? withoutBase.slice(1) : withoutBase;

  if (mode === 'dev') {
    if (absoluteLike) {
      if (hasPublicDir) {
        candidates.push(path.resolve(publicDir, relFromRoot));
      }
      candidates.push(path.resolve(config.root, relFromRoot));
    } else {
      candidates.push(path.resolve(htmlDir, normalizedUrl));
      if (hasPublicDir) candidates.push(path.resolve(publicDir, normalizedUrl));
      candidates.push(path.resolve(config.root, normalizedUrl));
    }
  } else if (absoluteLike) {
    candidates.push(path.resolve(outRoot, relFromRoot));
    if (hasPublicDir) {
      candidates.push(path.resolve(publicDir, relFromRoot));
    }
    candidates.push(path.resolve(config.root, relFromRoot));
  } else {
    candidates.push(path.resolve(htmlDir, normalizedUrl));
    candidates.push(path.resolve(outRoot, normalizedUrl));
    if (hasPublicDir) candidates.push(path.resolve(publicDir, normalizedUrl));
    candidates.push(path.resolve(config.root, normalizedUrl));
  }

  return candidates;
}
