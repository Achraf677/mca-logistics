// Replace top-repeated inline styles with utility classes in admin.html.
// Conservative: only safe, EXACT-STRING matches, no regex with side effects.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('admin.html', 'utf8');

// Mappings : inline style (EXACT) → class name
// Note : si l'élément a déjà une class="...", on append au lieu d'écraser.
const REPLACEMENTS = [
  // Patterns DANS attribut class (cas le plus fréquent)
  [' style="font-size:.82rem;color:var(--text-muted)"',                                                     '', 'u-muted-sm'],
  [' style="font-size:.78rem;color:var(--text-muted);margin-top:6px"',                                       '', 'u-muted-xs-mt'],
  [' style="margin-bottom:12px;padding:10px 18px"',                                                          '', 'u-block-pad-md'],
  [' style="margin-bottom:12px;padding:10px 16px"',                                                          '', 'u-block-pad-sm'],
  [' style="font-size:.95rem;font-weight:700"',                                                              '', 'u-title-sm'],
  [' style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"',                                        '', 'u-flex-row'],
  [' style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:.88rem"',                      '', 'u-toolbar-row'],
  [' style="margin-top:18px;margin-bottom:10px"',                                                            '', 'u-section-spacer'],
  [' style="display:flex;gap:8px;align-items:center"',                                                       '', 'u-flex-row-tight'],
  [' style="color:var(--text-muted);font-size:.78rem"',                                                      '', 'u-muted-xs'],
  [' style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px"', '', 'u-check-row'],
  [' style="padding:8px 12px;display:inline-flex;align-items:center;justify-content:center"',                '', 'u-icon-btn-inline'],
  [' style="padding:14px;border-top:1px solid var(--border)"',                                               '', 'u-card-section'],
];

let totalReplaced = 0;

for (const [styleAttr, /* unused */, className] of REPLACEMENTS) {
  // Cas A : élément AVEC class existante : `class="foo"` + ` style="..."` (n'importe quel ordre)
  // Cas A.1 : class avant style
  const regexA = new RegExp(`(class="[^"]*?)("\\s*)` + styleAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^\s/, '\\s'), 'g');
  // Trop dur en regex sans gros risque ; on fait deux passes simples :
  // 1) ` class="..."  style="..."` → ` class="... u-X"`
  // 2) ` style="..." class="..."` → ` class="u-X ..."`
  // 3) `<tag style="..."` (sans class) → `<tag class="u-X"`

  // Pass 1 : class avant style
  const reA = new RegExp(`(class="[^"]+?)"(${styleAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
  const beforeA = (html.match(reA) || []).length;
  if (beforeA > 0) {
    html = html.replace(reA, `$1 ${className}"`);
    totalReplaced += beforeA;
  }
  // Pass 2 : style avant class
  const reB = new RegExp(styleAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `(\\s+class="[^"]+?")`, 'g');
  const beforeB = (html.match(reB) || []).length;
  if (beforeB > 0) {
    html = html.replace(reB, ` class="${className} $1`.replace('$1class="', ''));
    totalReplaced += beforeB;
  }
  // Pass 3 : style seul (pas de class sur l'élément)
  const reC = new RegExp(`${styleAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  const beforeC = (html.match(reC) || []).length;
  if (beforeC > 0) {
    html = html.replace(reC, ` class="${className}"`);
    totalReplaced += beforeC;
  }
}

writeFileSync('admin.html', html, 'utf8');
console.log(`✓ ${totalReplaced} inline styles → utility classes`);
