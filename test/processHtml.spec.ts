import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Inject sharp mock via global to avoid dynamic import mocking issues
const sharpMock = (/* _buffer: Buffer */) => ({
  metadata: async () => ({ width: 320, height: 180 }),
});
(globalThis as any).__IMAGE_SIZES_TEST_SHARP__ = sharpMock;
(globalThis as any).__IMAGE_SIZES_TEST_FORCE_DIMS__ = true;

function createResolvedConfig(root: string) {
  // Minimal shape for our tests
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
  } as any;
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
    // wire config
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

    // width/height for imgs (numeric) and loading
    expect(outputHtml).toMatch(/<img id="i1"[^>]*\bwidth="\d+"[^>]*\bheight="\d+"[^>]*\bloading="lazy"/);
    expect(outputHtml).toMatch(/<img id="i2"[^>]*\bwidth="\d+"[^>]*\bheight="\d+"[^>]*\bloading="lazy"/);
    // width/height for source (numeric)
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
    // Should not change existing dims, and because we skip metadata, loading should not be added either
    expect(outputHtml).toMatch(/<img id="pre"[^>]*\bwidth="10"[^>]*\bheight="20"(?![^>]*\bloading="lazy")/);
  });
});


