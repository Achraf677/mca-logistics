// Remove leading emojis from <h2> titles in admin.html
// (sidebar already done; this targets section headers + card headers)
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

// Pattern: <h2>EMOJI Title</h2> → <h2>Title</h2>
// Emojis are multi-codepoint (some with variation selectors / ZWJ)
const EMOJI_LEAD = /(<h2[^>]*>)([\u{1F000}-\u{1FFFF}⌀-➿☀-⛿⬀-⯿️‍]+\s*)/gu;
const before = (html.match(EMOJI_LEAD) || []).length;
html = html.replace(EMOJI_LEAD, '$1');

// Same for <h3> common case
const EMOJI_LEAD_H3 = /(<h3[^>]*>)([\u{1F000}-\u{1FFFF}⌀-➿☀-⛿⬀-⯿️‍]+\s*)/gu;
const before3 = (html.match(EMOJI_LEAD_H3) || []).length;
html = html.replace(EMOJI_LEAD_H3, '$1');

writeFileSync('admin.html', html, 'utf8');
console.log(`✓ Removed ${before} h2 emojis + ${before3} h3 emojis`);
