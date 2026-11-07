/**
 * Guards log-button layout rules in css/base.css.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = fs.readFileSync(path.join(root, 'css/base.css'), 'utf8');

const mustInclude = [
  'grid-template-columns:minmax(0,1fr) minmax(0,1fr)',
];

const mustNotInclude = [
  '(min-resolution:2dppx) and (max-width:375px) { .btn-row',
];

for (const needle of mustInclude) {
  if (!css.includes(needle)) {
    throw new Error(`responsive-layout: expected css/base.css to include: ${needle}`);
  }
}

for (const needle of mustNotInclude) {
  if (css.includes(needle)) {
    throw new Error(`responsive-layout: removed rule should stay gone: ${needle}`);
  }
}

console.log('responsive-layout: ok');
