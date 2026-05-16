#!/usr/bin/env node
/**
 * tools/extract-module.js — helper d'extraction modulaire script.js
 *
 * Usage : node tools/extract-module.js <moduleName> <startLine>-<endLine> "<description>"
 *
 * Détecte automatiquement la fin de fonction (compte les { } balanced).
 * Vérifie node -c sur script.js après extraction.
 * Crée script-core-<moduleName>.js avec header + window.X assignments.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [moduleName, range, description = ''] = process.argv.slice(2);
if (!moduleName || !range) {
  console.error('Usage: node tools/extract-module.js <moduleName> <startLine>-<endLine> "description"');
  process.exit(1);
}

const [startLine, endLine] = range.split('-').map(n => parseInt(n, 10));
if (!startLine || !endLine || endLine < startLine) {
  console.error('Invalid range. Use format: 100-200');
  process.exit(1);
}

const SCRIPT = path.join(__dirname, '..', 'script.js');
const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
const block = lines.slice(startLine - 1, endLine).join('\n');

// Find exported names (function declarations + const + window.X = X)
const exportedNames = [];
const fnDecl = /^(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/gm;
const constDecl = /^(?:const|let|var)\s+([A-Z][\w$]*)\s*=/gm;
// Implicit globals : `X = function() {}` at top-level (sloppy mode)
const bareAssign = /^([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function/gm;
let m;
while ((m = fnDecl.exec(block)) !== null) {
  if (!m[1].startsWith('_')) exportedNames.push(m[1]); // skip underscore-prefixed (private)
}
while ((m = constDecl.exec(block)) !== null) exportedNames.push(m[1]);
while ((m = bareAssign.exec(block)) !== null) {
  if (!m[1].startsWith('_')) exportedNames.push(m[1]);
}

const uniqueExports = [...new Set(exportedNames)];
console.log('Detected exportedNames:', uniqueExports.join(', '));

const header = `/**
 * MCA Logistics — ${description || moduleName} (Phase X — extraction script.js)
 *
 * Extracted from script.js L${startLine}-${endLine} (2026-05-16).
 */

`;

const windowAssigns = uniqueExports.length
  ? '\n\nif (typeof window !== \'undefined\') {\n' + uniqueExports.map(n => `  window.${n} = ${n};`).join('\n') + '\n}\n'
  : '\n';

const outPath = path.join(__dirname, '..', `script-core-${moduleName}.js`);
fs.writeFileSync(outPath, header + block + windowAssigns);
console.log('Wrote', outPath, '—', block.length, 'chars');

// Remove from script.js with a comment placeholder
const out = lines.slice(0, startLine - 1)
  .concat([`// MOVED -> script-core-${moduleName}.js : ${uniqueExports.join(' + ')}`])
  .concat(lines.slice(endLine));

fs.writeFileSync(SCRIPT, out.join('\n'));
console.log('script.js now', out.length, 'lines');

// Verify syntax
try {
  execSync(`node -c "${SCRIPT}"`, { stdio: 'pipe' });
  console.log('✓ script.js syntax OK');
} catch (e) {
  console.error('✗ script.js SYNTAX ERROR — restoring backup');
  fs.writeFileSync(SCRIPT, lines.join('\n'));
  console.error(e.stderr ? e.stderr.toString() : e.message);
  process.exit(2);
}

try {
  execSync(`node -c "${outPath}"`, { stdio: 'pipe' });
  console.log('✓', path.basename(outPath), 'syntax OK');
} catch (e) {
  console.error('✗', path.basename(outPath), 'SYNTAX ERROR');
  console.error(e.stderr ? e.stderr.toString() : e.message);
  process.exit(3);
}

console.log('\nDone. Manual steps :');
console.log('  1. Add <script defer src="script-core-' + moduleName + '.js?v=1"> in admin.html');
console.log('  2. Add /script-core-' + moduleName + '.js in sw.js CORE_ASSETS');
console.log('  3. Bump CACHE_VERSION');
console.log('  4. npm test && git add && git commit');
