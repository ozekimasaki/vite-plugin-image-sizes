// This file will contain the plugin logic. 

import type { Plugin, ResolvedConfig } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { load } from 'cheerio';
import { glob } from 'glob';

export interface ImageSizeOptions {
  addLazyLoading?: boolean;
}

async function processHtml(html: string, config: ResolvedConfig, options: ImageSizeOptions): Promise<string> {
  const $ = load(html);
  const elements = $('img, source');
  const imagePromises: Promise<void>[] = [];

  elements.each((_, el) => {
    const element = $(el);
    const promise = (async () => {
      const srcAttr = element.is('img') ? 'src' : 'srcset';
      const src = element.attr(srcAttr);

      if (!src) return;

      const imageUrl = src.split(',')[0].trim().split(' ')[0];
      
      if (/^(https?|data):/.test(imageUrl) || imageUrl.includes('__VITE_PUBLIC_ASSET__')) {
        return;
      }
      
      // All paths in the final HTML are root-relative
      const imagePath = path.join(config.publicDir, imageUrl);

      try {
        const buffer = await fs.readFile(imagePath);
        const metadata = await sharp(buffer).metadata();
        if (metadata.width && metadata.height) {
          if (!element.attr('width')) element.attr('width', metadata.width.toString());
          if (!element.attr('height')) element.attr('height', metadata.height.toString());

          // Add lazy loading only if image size is successfully obtained
          if (options.addLazyLoading && element.is('img') && !element.attr('loading')) {
            element.attr('loading', 'lazy');
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          config.logger.warn(`[vite-plugin-image-sizes] Failed to get size for ${imagePath}: ${(error as Error).message}`);
        }
      }
    })();
    imagePromises.push(promise);
  });

  await Promise.all(imagePromises);
  return $.html();
}

export default function imageSizes(options: ImageSizeOptions = {}): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'vite-plugin-image-sizes',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async transformIndexHtml(html: string) {
      if (config.command !== 'serve') {
        return html;
      }
      return processHtml(html, config, options);
    },

    async closeBundle() {
      if (config.command !== 'build') {
        return;
      }
      
      const outDir = config.build.outDir || 'dist';
      const htmlFiles = await glob(`${outDir}/**/*.html`);

      for (const file of htmlFiles) {
        const htmlContent = await fs.readFile(file, 'utf-8');
        const processedHtml = await processHtml(htmlContent, config, options);
        await fs.writeFile(file, processedHtml, 'utf-8');
      }
      config.logger.info('[vite-plugin-image-sizes] Processed HTML files after bundle.');
    },
  };
} 