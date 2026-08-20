import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const inputPath = 'apps/web/src/app/globals.css';
const outPath = '.design-sync/pkg/dist/tailwind-compiled.css';
const css = readFileSync(inputPath, 'utf8');

const result = await postcss([tailwind({ base: 'apps/web' })]).process(css, {
  from: inputPath,
  to: outPath,
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, result.css);
console.log('wrote', outPath, result.css.length, 'bytes');
