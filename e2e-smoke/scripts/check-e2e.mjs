import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distRoot = path.resolve(__dirname, '..', 'dist');

async function read(file) {
  return fs.readFile(file, 'utf-8');
}

function expectMatch(content, re, message) {
  if (!re.test(content)) {
    console.error(`E2E assertion failed: ${message}`);
    process.exit(1);
  }
}

async function checkRoot() {
  const html = await read(path.join(distRoot, 'index.html'));
  expectMatch(html, /<img[^>]*\bwidth="40"[^>]*\bheight="30"[^>]*\bloading="lazy"/i, 'root img should have width=40 height=30 and loading=lazy');
}

async function checkNested() {
  const html = await read(path.join(distRoot, 'pages', 'sub', 'index.html'));
  expectMatch(html, /<img[^>]*\bwidth="100"[^>]*\bheight="50"[^>]*\bloading="lazy"/i, 'nested img should have width=100 height=50 and loading=lazy');
}

async function checkPicture() {
  const html = await read(path.join(distRoot, 'pages', 'picture', 'index.html'));
  expectMatch(html, /<source[^>]*\bid="src-avif"[^>]*\bwidth="64"[^>]*\bheight="48"/i, 'picture source avif should have dims');
  expectMatch(html, /<source[^>]*\bid="src-webp"[^>]*\bwidth="64"[^>]*\bheight="48"/i, 'picture source webp should have dims');
  expectMatch(html, /<img[^>]*\bid="pic-fallback"[^>]*\bwidth="64"[^>]*\bheight="48"[^>]*\bloading="lazy"/i, 'picture fallback img should have dims and loading');
  expectMatch(html, /<img[^>]*\bwidth="100"[^>]*\bheight="50"[^>]*\bloading="lazy"/i, 'extra relative img should have width=100 height=50 and loading');
}

async function checkMixed() {
  const html = await read(path.join(distRoot, 'pages', 'mixed', 'index.html'));
  expectMatch(html, /<img[^>]*\bsrc="\/images\/pub\.svg"[^>]*\bwidth="64"[^>]*\bheight="48"[^>]*\bloading="lazy"/i, 'mixed absolute public svg dims');
  expectMatch(html, /<img[^>]*\bwidth="100"[^>]*\bheight="50"[^>]*\bloading="lazy"/i, 'mixed relative pic.svg dims');
  expectMatch(html, /<img[^>]*\bwidth="40"[^>]*\bheight="30"[^>]*\bloading="lazy"/i, 'mixed root.svg dims');
}

async function checkFormats() {
  const html = await read(path.join(distRoot, 'pages', 'formats', 'index.html'));
  const ids = ['abs-png', 'abs-jpg', 'abs-webp', 'abs-avif', 'rel-png', 'rel-jpg', 'rel-webp', 'rel-avif'];
  for (const id of ids) {
    expectMatch(html, new RegExp(`<img[^>]*\\bid="${id}"[^>]*\\bwidth="64"[^>]*\\bheight="48"[^>]*\\bloading="lazy"`, 'i'), `formats ${id} img dims + loading`);
  }
  expectMatch(html, /<source[^>]*\bid="src-avif"[^>]*\bwidth="64"[^>]*\bheight="48"/i, 'formats source avif dims');
  expectMatch(html, /<source[^>]*\bid="src-webp"[^>]*\bwidth="64"[^>]*\bheight="48"/i, 'formats source webp dims');
  expectMatch(html, /<img[^>]*\bid="pic-fallback"[^>]*\bwidth="64"[^>]*\bheight="48"[^>]*\bloading="lazy"/i, 'formats picture fallback dims + loading');
}

async function main() {
  await checkRoot();
  await checkNested();
  await checkPicture();
  await checkMixed();
  await checkFormats();
  console.log('E2E checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


