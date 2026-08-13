import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { load } from 'cheerio';
import { createSemaphore } from './concurrency.js';
import { htmlMayContainTags, pickFirstFromSrcOrSrcset } from './utils/html.js';
import {
  assetSourceToBuffer,
  assetSourceToString,
  findBundleAsset,
  normalizeUrl,
  stripQueryAndHash,
  isAbsoluteLike,
  tryStatFile,
  resolveCandidatePaths,
  type BundleAsset,
  type BundleLike,
} from './utils/path.js';

export interface ImageSizeOptions {
  addLazyLoading?: boolean;
  includeTags?: Array<'img' | 'source'>;
  concurrency?: number;
  enableCache?: boolean;
}

interface ResolveContext {
  mode: 'dev' | 'build';
  htmlDir: string;
  outRoot: string;
  bundle?: BundleLike;
}

type SharpModule = typeof import('sharp').default;
type TestSharp = (input: Buffer) => {
  metadata: () => Promise<{ width?: number; height?: number }>;
};
type Dims = { width: number; height: number };

declare global {
  var __IMAGE_SIZES_TEST_SHARP__: TestSharp | undefined;
  var __IMAGE_SIZES_TEST_FORCE_DIMS__: boolean | undefined;
}

const SKIP_URL_RE = /^(https?|data):/i;
const VITE_PUBLIC_ASSET_MARK = '__VITE_PUBLIC_ASSET__';

let cachedSharp: SharpModule | TestSharp | null = null;

function defaultConcurrency(): number {
  try {
    return Math.max(1, Math.min(8, availableParallelism()));
  } catch {
    return 8;
  }
}

function isClientEnvironment(environment: {
  name: string;
  consumer?: string;
}): boolean {
  return environment.consumer === 'client' || environment.name === 'client';
}

function isSharpModule(value: unknown): value is SharpModule {
  return typeof value === 'function';
}

async function getSharp(): Promise<SharpModule | TestSharp> {
  if (cachedSharp) return cachedSharp;

  const injected = globalThis.__IMAGE_SIZES_TEST_SHARP__;
  if (injected) {
    cachedSharp = injected;
    return cachedSharp;
  }

  const mod: unknown = await import('sharp');
  const candidate =
    typeof mod === 'object' && mod !== null && 'default' in mod
      ? Reflect.get(mod, 'default')
      : mod;

  if (!isSharpModule(candidate)) {
    throw new Error('[vite-plugin-image-sizes] Failed to load sharp');
  }

  cachedSharp = candidate;
  return cachedSharp;
}

function applyDims(
  element: {
    attr: (name: string, value?: string) => string | undefined
    is: (selector: string) => boolean
  },
  width: number,
  height: number,
  addLazyLoading: boolean,
): void {
  if (!element.attr('width')) element.attr('width', String(width));
  if (!element.attr('height')) element.attr('height', String(height));
  if (addLazyLoading && element.is('img') && !element.attr('loading')) {
    element.attr('loading', 'lazy');
  }
}

async function processHtml(
  html: string,
  config: ResolvedConfig,
  options: Required<Pick<ImageSizeOptions, 'addLazyLoading' | 'includeTags' | 'enableCache'>>,
  ctx: ResolveContext,
  helpers: {
    semaphore: ReturnType<typeof createSemaphore>;
    metadataCache: Map<string, Dims>;
  }
): Promise<string> {
  if (options.includeTags.length === 0 || !htmlMayContainTags(html, options.includeTags)) {
    return html;
  }

  const $ = load(html);
  const selector = options.includeTags.join(', ');
  const imagePromises: Promise<void>[] = [];

  $(selector).each((_, el) => {
    const element = $(el);
    const promise = (async () => {
      const srcAttr = element.is('img') ? 'src' : 'srcset';
      const src = element.attr(srcAttr);

      if (!src) return;

      if (element.attr('width') && element.attr('height')) {
        return;
      }

      if (globalThis.__IMAGE_SIZES_TEST_FORCE_DIMS__) {
        applyDims(element, 320, 180, options.addLazyLoading);
        return;
      }

      const first = pickFirstFromSrcOrSrcset(src);
      const withoutQh = stripQueryAndHash(first);
      const normalized = normalizeUrl(withoutQh);

      if (SKIP_URL_RE.test(normalized) || normalized.includes(VITE_PUBLIC_ASSET_MARK)) {
        return;
      }

      let width: number | undefined;
      let height: number | undefined;
      let cacheKey: string | undefined;
      let buffer: Buffer | undefined;

      const bundled = ctx.bundle
        ? findBundleAsset(ctx.bundle, normalized, config.base)
        : undefined;
      if (bundled) {
        cacheKey = `bundle:${bundled.fileName}`;
        const cached = options.enableCache ? helpers.metadataCache.get(cacheKey) : undefined;
        if (cached) {
          applyDims(element, cached.width, cached.height, options.addLazyLoading);
          return;
        }
        buffer = assetSourceToBuffer(bundled.source);
      } else {
        const absoluteLike = isAbsoluteLike(normalized, config.base);
        const candidates = resolveCandidatePaths({
          normalizedUrl: normalized,
          absoluteLike,
          config,
          htmlDir: ctx.htmlDir,
          outRoot: ctx.outRoot,
          mode: ctx.mode,
        });
        const found = await tryStatFile(candidates);
        if (!found) {
          if (ctx.mode === 'build') {
            config.logger.warn(`[vite-plugin-image-sizes] Image not found: ${normalized}`);
          }
          return;
        }
        cacheKey = `${found.path}:${found.mtimeMs}:${found.size}`;
        const cached = options.enableCache ? helpers.metadataCache.get(cacheKey) : undefined;
        if (cached) {
          applyDims(element, cached.width, cached.height, options.addLazyLoading);
          return;
        }
        buffer = await fs.readFile(found.path);
      }

      try {
        const metadata = await helpers.semaphore.withLimit(async () => {
          const sharp = await getSharp();
          return sharp(buffer).metadata();
        });
        width = metadata.width;
        height = metadata.height;
        if (options.enableCache && cacheKey && width && height) {
          helpers.metadataCache.set(cacheKey, { width, height });
        }

        if (width && height) {
          applyDims(element, width, height, options.addLazyLoading);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        config.logger.warn(
          `[vite-plugin-image-sizes] Failed to get image size: ${message}`
        );
      }
    })();
    imagePromises.push(promise);
  });

  await Promise.all(imagePromises);
  return $.html();
}

export default function imageSizes(options: ImageSizeOptions = {}): Plugin {
  let config: ResolvedConfig;
  const resolved: Required<Pick<ImageSizeOptions, 'addLazyLoading' | 'includeTags' | 'enableCache' | 'concurrency'>> = {
    addLazyLoading: options.addLazyLoading ?? false,
    includeTags: options.includeTags ?? ['img', 'source'],
    concurrency: options.concurrency ?? defaultConcurrency(),
    enableCache: options.enableCache ?? true,
  };
  const semaphore = createSemaphore(resolved.concurrency);
  const metadataCache = new Map<string, Dims>();

  return {
    name: 'vite-plugin-image-sizes',
    // Vite の HTML emit より後に generateBundle を走らせる
    enforce: 'post',

    applyToEnvironment(environment) {
      return isClientEnvironment(environment);
    },

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async transformIndexHtml(html: string, ctx?: IndexHtmlTransformContext) {
      if (config.command !== 'serve') {
        return html;
      }
      const reqPath = ctx?.path ?? '/index.html';
      const reqPathNoLead = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath;
      const htmlDir = path.resolve(config.root, path.dirname(reqPathNoLead));
      return processHtml(html, config, {
        addLazyLoading: resolved.addLazyLoading,
        includeTags: resolved.includeTags,
        enableCache: resolved.enableCache,
      }, {
        mode: 'dev',
        htmlDir,
        outRoot: config.root,
      }, { semaphore, metadataCache });
    },

    async generateBundle(_outputOptions, bundle: BundleLike) {
      if (config.command !== 'build') {
        return;
      }

      const outDir = config.build.outDir || 'dist';
      const resolvedOutDir = path.resolve(config.root, outDir);
      const htmlAssets = Object.values(bundle).filter(
        (item): item is BundleAsset =>
          item.type === 'asset' &&
          typeof item.fileName === 'string' &&
          item.fileName.endsWith('.html') &&
          item.source !== undefined,
      );

      await Promise.all(htmlAssets.map(async (asset) => {
        const htmlContent = assetSourceToString(asset.source);
        const htmlDir = path.resolve(config.root, path.dirname(asset.fileName));
        const processedHtml = await processHtml(htmlContent, config, {
          addLazyLoading: resolved.addLazyLoading,
          includeTags: resolved.includeTags,
          enableCache: resolved.enableCache,
        }, {
          mode: 'build',
          htmlDir,
          outRoot: resolvedOutDir,
          bundle,
        }, { semaphore, metadataCache });
        asset.source = processedHtml;
      }));

      if (htmlAssets.length > 0) {
        config.logger.info(
          `[vite-plugin-image-sizes] Processed ${htmlAssets.length} HTML file(s) in generateBundle.`,
        );
      }
    },
  };
}
