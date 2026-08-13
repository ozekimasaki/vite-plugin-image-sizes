import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import type { ResolvedConfig } from 'vite';

const sharpMock = () => ({
  metadata: async () => ({ width: 320, height: 180 }),
});
globalThis.__IMAGE_SIZES_TEST_SHARP__ = sharpMock;
globalThis.__IMAGE_SIZES_TEST_FORCE_DIMS__ = true;

function createResolvedConfig(root: string): ResolvedConfig {
  return {
    root,
    base: '/',
    command: 'serve',
    build: { outDir: 'dist' },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as unknown as ResolvedConfig;
}

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
});
