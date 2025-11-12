import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function createAllFormats(baseOut, name) {
  const width = 64;
  const height = 48;
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 76, g: 175, b: 80 }, // #4CAF50
    },
  });

  const targets = [
    { file: `${name}.png`, format: 'png' },
    { file: `${name}.jpg`, format: 'jpeg' },
    { file: `${name}.webp`, format: 'webp' },
    { file: `${name}.avif`, format: 'avif' },
    // GIF は環境により失敗する可能性があるため生成のみ試行（参照はしない）
    { file: `${name}.gif`, format: 'gif', optional: true },
  ];

  for (const t of targets) {
    try {
      const outPath = path.join(baseOut, t.file);
      let pipeline = image.clone();
      switch (t.format) {
        case 'png':
          pipeline = pipeline.png();
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: 80 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: 80 });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality: 50 });
          break;
        case 'gif':
          pipeline = pipeline.gif();
          break;
      }
      await pipeline.toFile(outPath);
    } catch (e) {
      if (!t.optional) {
        throw e;
      }
    }
  }
}

async function main() {
  const pubDir = path.join(root, 'public', 'images-bin');
  const relDir = path.join(root, 'pages', 'formats', 'images');
  await ensureDir(pubDir);
  await ensureDir(relDir);

  await createAllFormats(pubDir, 'square');
  await createAllFormats(relDir, 'square');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


