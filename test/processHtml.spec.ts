import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import type { ResolvedConfig } from 'vite';

import { htmlMayContainTags } from '../src/utils/html.js';

const sharpMock = () => ({
  metadata: async () => ({ width: 320, height: 180 }),
});
globalThis.__IMAGE_SIZES_TEST_SHARP__ = sharpMock;
globalThis.__IMAGE_SIZES_TEST_FORCE_DIMS__ = true;

function createResolvedConfig(
  root: string,
  command: 'serve' | 'build' = 'serve',
): ResolvedConfig {
  return {
    root,
    base: '/',
    command,
    build: { outDir: 'dist' },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as ResolvedConfig;
}

describe('htmlMayContainTags', () => {
  it('detects img and source without parsing HTML', () => {
    expect(htmlMayContainTags('<div><img src="a.png"></div>', ['img'])).toBe(true);
    expect(htmlMayContainTags('<div>no images</div>', ['img', 'source'])).toBe(false);
  });
});

describe('vite-plugin-image-sizes', () => {
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds width/height to img and source, and adds loading=lazy to img', async () => {
    const pluginImageSizes = (await import('../src/index.js')).default;
    const plugin = pluginImageSizes({
      addLazyLoading: true,
      includeTags: ['img', 'source'],
    });
    // @ts-expect-error hooking
    plugin.configResolved(createResolvedConfig(projectRoot));

    const inputHtml = `
      <html>
        <body>
          <img id="i1" src="e2e-smoke/images/root.svg">
          <picture>
            <source id="s1" srcset="e2e-smoke/images/root.svg">
            <img id="i2" src="e2e-smoke/images/root.svg">
          </picture>
        </body>
      </html>
    `;
    // @ts-expect-error vite hook call
    const outputHtml = await plugin.transformIndexHtml(inputHtml, { path: '/index.html' });
    expect(outputHtml).toContain('id="i1"');
    expect(outputHtml).toContain('id="i2"');
    expect(outputHtml).toContain('id="s1"');

    expect(outputHtml).toMatch(/<img id="i1"[^>]*\bwidth="\d+"[^>]*\bheight="\d+"[^>]*\bloading="lazy"/);
    expect(outputHtml).toMatch(/<img id="i2"[^>]*\bwidth="\d+"[^>]*\bheight="\d+"[^>]*\bloading="lazy"/);
    expect(outputHtml).toMatch(/<source id="s1"[^>]*\bwidth="\d+"[^>]*\bheight="\d+"/);
  });

  it('skips metadata when both width and height already exist', async () => {
    const pluginImageSizes = (await import('../src/index.js')).default;
    const plugin = pluginImageSizes({
      addLazyLoading: true,
      includeTags: ['img', 'source'],
    });
    // @ts-expect-error hooking
    plugin.configResolved(createResolvedConfig(projectRoot));

    const inputHtml = `
      <html>
        <body>
          <img id="pre" src="e2e-smoke/images/root.svg" width="10" height="20">
        </body>
      </html>
    `;
    // @ts-expect-error vite hook call
    const outputHtml = await plugin.transformIndexHtml(inputHtml, { path: '/index.html' });
    expect(outputHtml).toMatch(/<img id="pre"[^>]*\bwidth="10"[^>]*\bheight="20"(?![^>]*\bloading="lazy")/);
  });

  it('returns HTML unchanged when there are no target tags', async () => {
    const pluginImageSizes = (await import('../src/index.js')).default;
    const plugin = pluginImageSizes({ addLazyLoading: true });
    // @ts-expect-error hooking
    plugin.configResolved(createResolvedConfig(projectRoot));

    const inputHtml = '<html><body><p>no images</p></body></html>';
    // @ts-expect-error vite hook call
    const outputHtml = await plugin.transformIndexHtml(inputHtml, { path: '/index.html' });
    expect(outputHtml).toBe(inputHtml);
  });

  it('applies dimensions in generateBundle for build HTML assets', async () => {
    const pluginImageSizes = (await import('../src/index.js')).default;
    const plugin = pluginImageSizes({ addLazyLoading: true });
    // @ts-expect-error hooking
    plugin.configResolved(createResolvedConfig(projectRoot, 'build'));

    const bundle = {
      'index.html': {
        type: 'asset' as const,
        fileName: 'index.html',
        source: '<img id="b1" src="./e2e-smoke/images/root.svg">',
      },
    } as unknown as Record<string, { type: string; fileName: string; source: string }>;

    // @ts-expect-error hooking
    await plugin.generateBundle({}, bundle);
    const html = String(bundle['index.html']?.source);
    expect(html).toMatch(/<img id="b1"[^>]*\bwidth="320"[^>]*\bheight="180"[^>]*\bloading="lazy"/);
  });

  it('applies only to the client environment', async () => {
    const pluginImageSizes = (await import('../src/index.js')).default;
    const plugin = pluginImageSizes();
    expect(plugin.applyToEnvironment?.({ name: 'client' } as never)).toBe(true);
    expect(plugin.applyToEnvironment?.({ name: 'ssr', consumer: 'server' } as never)).toBe(false);
  });
});
