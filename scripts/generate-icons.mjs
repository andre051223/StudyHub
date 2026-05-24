import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function svgIcon(size) {
  const radius = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#67b31f"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${fontSize}" fill="white">S</text>
</svg>`;
}

for (const size of [192, 512]) {
  const svg = Buffer.from(svgIcon(size));
  await sharp(svg).png().toFile(join(outDir, `icon-${size}.png`));
  console.log(`Created icon-${size}.png`);
}
