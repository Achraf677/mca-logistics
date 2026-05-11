// Merge duplicate class="..." class="..." attributes on same element.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

// Match <TAG attr1 class="A" attr2... class="B" ...> on same line.
// Group: tag, intermediate, classes -> merge.
const re = /(<\w+[^>]*?)\sclass="([^"]+)"([^>]*?)\sclass="([^"]+)"/g;

let count = 0;
let prev;
do {
  prev = html;
  html = html.replace(re, (m, head, a, mid, b) => {
    count++;
    return `${head} class="${a} ${b}"${mid}`;
  });
} while (html !== prev);

writeFileSync('admin.html', html, 'utf8');
console.log(`✓ ${count} duplicate class attributes merged`);
