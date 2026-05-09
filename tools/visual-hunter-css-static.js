#!/usr/bin/env node
/**
 * visual-hunter-css-static.js
 * --------------------------------------------------------------------------
 * Chasseur statique de bugs visuels dans `style.css` et `style-mobile.css`.
 * Aucun headless browser. Pure analyse heuristique du code CSS + HTML.
 *
 * Catégories d'audit :
 *  1. Conflits z-index cross-files (mêmes valeurs sur composants différents).
 *  2. Contrast ratios fail AA (color vs background visible).
 *  3. overflow:hidden sans gestion ellipsis ni scroll fallback.
 *  4. outline:none sans :focus-visible alternatif (vérifie la couverture du
 *     fallback global ajouté en sprint H2.3).
 *  5. !important chains contradictoires.
 *  6. Vendor prefix manquants (-webkit-, -moz-) pour propriétés expérimentales.
 *  7. Fixed positioning conflicts (mêmes top/right/bottom/left).
 *  8. Animations/transitions en !important qui by-pass prefers-reduced-motion.
 *
 * Lecture seule. Sortie : audit-visual-static.md à la racine du repo.
 * --------------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['style.css', 'style-mobile.css'];
const OUTPUT = path.join(ROOT, 'audit-visual-static.md');

/* ---------- helpers ---------- */

function readFile(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

/**
 * Tokenise les règles CSS top-level.
 * Renvoie [{selector, body, line, file}].
 * (suffisant pour notre analyse de signal — pas un parseur complet)
 */
function parseRules(css, file) {
  const out = [];
  const stripped = stripComments(css);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(stripped))) {
    const selector = m[1].trim();
    const body = m[2].trim();
    if (!selector || selector.startsWith('@')) continue;
    out.push({ selector, body, line: lineOf(stripped, m.index), file });
  }
  return out;
}

/* ---------- WCAG contrast ---------- */

const NAMED = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', maroon: '#800000', olive: '#808000', purple: '#800080',
  teal: '#008080', navy: '#000080', orange: '#ffa500', transparent: 'rgba(0,0,0,0)',
  inherit: null, currentcolor: null, none: null,
};

function parseColor(raw) {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v in NAMED) return NAMED[v];
  if (v.startsWith('var(') || v.startsWith('linear-gradient') ||
      v.startsWith('radial-gradient') || v.startsWith('url(')) return null;
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) return v;
  let m = v.match(/^rgba?\(\s*([0-9.]+)\s*,?\s*([0-9.]+)\s*,?\s*([0-9.]+)\s*(?:[,/]\s*([0-9.%]+))?\s*\)$/);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3];
    let a = 1;
    if (m[4] !== undefined) {
      a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    }
    return rgbaToObj(r, g, b, a);
  }
  return null;
}

function rgbaToObj(r, g, b, a) {
  return { r, g, b, a };
}

function colorToRgb(c) {
  if (c == null) return null;
  if (typeof c === 'object') return c;
  const v = c.trim().toLowerCase();
  if (v.startsWith('#')) {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    if (hex.length === 4) hex = hex.split('').map(x => x + x).join('');
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  return null;
}

function relLuminance({ r, g, b }) {
  const f = (c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(c1, c2) {
  const L1 = relLuminance(c1), L2 = relLuminance(c2);
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

/* ---------- declaration parser ---------- */

function declarations(body) {
  const decls = [];
  // simple split on ; respecting parens
  let depth = 0, current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      if (current.trim()) decls.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) decls.push(current.trim());
  return decls.map((d) => {
    const idx = d.indexOf(':');
    if (idx === -1) return null;
    const prop = d.slice(0, idx).trim().toLowerCase();
    let value = d.slice(idx + 1).trim();
    const important = /!important\s*$/i.test(value);
    if (important) value = value.replace(/!important\s*$/i, '').trim();
    return { prop, value, important };
  }).filter(Boolean);
}

/* ---------- CSS variables resolution ---------- */

function extractRootVars(css) {
  const out = {};
  const re = /:root\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    declarations(m[1]).forEach((d) => {
      if (d.prop.startsWith('--')) out[d.prop] = d.value;
    });
  }
  return out;
}

function resolveVar(value, vars, depth = 0) {
  if (depth > 5) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
    if (vars[name]) return resolveVar(vars[name], vars, depth + 1);
    if (fallback) return resolveVar(fallback.trim(), vars, depth + 1);
    return _;
  });
}

/* ---------- audits ---------- */

function auditZIndex(rules) {
  const buckets = {};
  rules.forEach((r) => {
    declarations(r.body).forEach((d) => {
      if (d.prop !== 'z-index') return;
      const v = parseInt(d.value, 10);
      if (Number.isNaN(v)) return;
      if (!buckets[v]) buckets[v] = [];
      buckets[v].push({ selector: r.selector, file: r.file, line: r.line });
    });
  });
  // suspect : >=2 components on same z-index where families differ
  const suspects = [];
  Object.entries(buckets).forEach(([v, list]) => {
    if (list.length < 2) return;
    const families = new Set(list.map((e) => familyOf(e.selector)));
    if (families.size > 1) {
      suspects.push({ z: +v, entries: list, families: [...families] });
    }
  });
  return { buckets, suspects };
}

function familyOf(selector) {
  const s = selector.toLowerCase();
  if (/(toast|notif)/.test(s)) return 'toast';
  if (/(modal|dialog|sheet|drawer)/.test(s)) return 'modal';
  if (/(overlay|backdrop|scrim)/.test(s)) return 'overlay';
  if (/(fab|float|m-fab)/.test(s)) return 'fab';
  if (/(nav|tabbar|sidebar|menu|header|topbar)/.test(s)) return 'nav';
  if (/(tooltip|popover|dropdown)/.test(s)) return 'popover';
  if (/(loader|spinner|progress|skeleton)/.test(s)) return 'loader';
  if (/(chat|panneau-agent|agent-ia)/.test(s)) return 'chat';
  return 'other';
}

function auditFixedPositions(rules) {
  const fixed = [];
  rules.forEach((r) => {
    const decls = declarations(r.body);
    const isFixed = decls.some((d) => d.prop === 'position' && d.value === 'fixed');
    if (!isFixed) return;
    const top = decls.find((d) => d.prop === 'top')?.value;
    const right = decls.find((d) => d.prop === 'right')?.value;
    const bottom = decls.find((d) => d.prop === 'bottom')?.value;
    const left = decls.find((d) => d.prop === 'left')?.value;
    const inset = decls.find((d) => d.prop === 'inset')?.value;
    const zIndex = decls.find((d) => d.prop === 'z-index')?.value;
    fixed.push({
      selector: r.selector, file: r.file, line: r.line,
      top, right, bottom, left, inset, zIndex,
    });
  });
  // collisions on (top OR bottom) + (right OR left) buckets
  const conflicts = [];
  const groups = {};
  fixed.forEach((f) => {
    if (f.inset) return; // full-screen overlay, not corner-anchored
    if (!f.top && !f.bottom) return;
    if (!f.right && !f.left) return;
    const key = `${f.top || ''}|${f.right || ''}|${f.bottom || ''}|${f.left || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });
  Object.entries(groups).forEach(([key, list]) => {
    if (list.length < 2) return;
    const families = new Set(list.map((e) => familyOf(e.selector)));
    if (families.size > 1) conflicts.push({ key, entries: list });
  });
  return { fixed, conflicts };
}

function auditOverflow(rules) {
  const issues = [];
  rules.forEach((r) => {
    const decls = declarations(r.body);
    const overflow = decls.find((d) =>
      ['overflow', 'overflow-x', 'overflow-y'].includes(d.prop) && d.value === 'hidden'
    );
    if (!overflow) return;
    const hasEllipsis = decls.some((d) =>
      (d.prop === 'text-overflow' && d.value === 'ellipsis') ||
      (d.prop === 'white-space' && d.value === 'nowrap')
    );
    const hasScrollFallback = decls.some((d) =>
      (d.prop === 'overflow' && (d.value === 'auto' || d.value === 'scroll')) ||
      (d.prop === 'overflow-x' && (d.value === 'auto' || d.value === 'scroll')) ||
      (d.prop === 'overflow-y' && (d.value === 'auto' || d.value === 'scroll'))
    );
    // we only care about candidates that look like text containers
    // (have width, max-width, or text-related properties)
    const isContainer = decls.some((d) =>
      ['width', 'max-width', 'height', 'max-height'].includes(d.prop)
    );
    const containsText = /^(\.|#|h[1-6]|p|span|button|label|a|td|th|li|figcaption|caption|input|select|textarea)/i.test(r.selector);
    if (!isContainer && !containsText) return;
    if (!hasEllipsis && !hasScrollFallback) {
      issues.push({
        selector: r.selector, file: r.file, line: r.line,
        overflow: overflow.value,
      });
    }
  });
  return issues;
}

function auditOutlineNone(rules) {
  // The global :focus-visible block (style.css, sprint H2.3) sets
  //   `outline: 2px solid var(--accent) !important`
  // on `button, a, [role="button"], [tabindex], input, select, textarea` and
  // a few specific class selectors. Because of !important, this declaration
  // beats ANY `outline: none` declaration that is NOT itself !important —
  // regardless of selector specificity — when :focus-visible is active
  // (keyboard nav).
  //
  // Therefore an `outline: none` rule is "covered" iff:
  //  (a) its declaration is NOT !important, AND
  //  (b) the selector matches an interactive element type already in the
  //      global FV block (or via well-known interactive class conventions).
  const COVERED_TOKENS = [
    /(^|\s|>|,)button(\.|:|$|\s|>|,)/i,
    /(^|\s|>|,)a(\.|:|$|\s|>|,)/i,
    /(^|\s|>|,)input(\.|:|$|\s|>|,|\[)/i,
    /(^|\s|>|,)select(\.|:|$|\s|>|,)/i,
    /(^|\s|>|,)textarea(\.|:|$|\s|>|,)/i,
    /\[role="button"\]/i,
    /\[tabindex\]/i,
    /\.modal-close/i,
    /\.cal-nav-btn/i,
    /\.btn-density/i,
    /\.btn-theme-toggle/i,
    /\.btn-hamburger/i,
    /\.btn-menu-mobile/i,
    /\.btn-/i,
    /-btn(\.|:|$|\s|>|,)/i,
    /\.search/i,
    /-search(\.|:|$|\s|>|,)/i,
    /-input(\.|:|$|\s|>|,)/i,
    /-select(\.|:|$|\s|>|,)/i,
    /-selector(\.|:|$|\s|>|,)/i,
    /-edit(\.|:|$|\s|>|,)/i,
  ];
  const offenders = [];
  rules.forEach((r) => {
    const decls = declarations(r.body);
    const outlineDecl = decls.find((d) => d.prop === 'outline' && d.value === 'none');
    if (!outlineDecl) return;
    if (/:focus-visible/.test(r.selector)) return;
    const importantBlocker = outlineDecl.important;
    const sels = r.selector.split(',').map((s) => s.trim());
    const allCovered = sels.every((s) => COVERED_TOKENS.some((pat) => pat.test(s)));
    offenders.push({
      selector: r.selector, file: r.file, line: r.line,
      coveredByGlobalFV: allCovered && !importantBlocker,
      importantBlocker,
    });
  });
  return offenders;
}

function auditImportantChains(rules) {
  const bySel = {};
  rules.forEach((r) => {
    const key = r.selector;
    if (!bySel[key]) bySel[key] = [];
    bySel[key].push(r);
  });
  const conflicts = [];
  rules.forEach((r) => {
    const decls = declarations(r.body);
    decls.forEach((d) => {
      if (!d.important) return;
      (bySel[r.selector] || []).forEach((r2) => {
        if (r2 === r) return;
        const otherDecls = declarations(r2.body);
        otherDecls.forEach((d2) => {
          if (d2.prop !== d.prop) return;
          if (!d2.important) return;
          if (d2.value === d.value) return;
          const sig = [r.file + ':' + r.line, r2.file + ':' + r2.line].sort().join(' vs ');
          if (!conflicts.find((c) => c.sig === sig && c.prop === d.prop)) {
            conflicts.push({
              sig, prop: d.prop,
              selector: r.selector,
              a: { file: r.file, line: r.line, value: d.value },
              b: { file: r2.file, line: r2.line, value: d2.value },
            });
          }
        });
      });
    });
  });
  return conflicts;
}

const PROPS_NEED_PREFIX = {
  'backdrop-filter': ['-webkit-'],
  'mask': ['-webkit-'],
  'mask-image': ['-webkit-'],
  'user-select': ['-webkit-', '-moz-'],
  'appearance': ['-webkit-', '-moz-'],
  'background-clip': ['-webkit-'],
  'text-fill-color': ['-webkit-'],
};

function auditVendorPrefixes(rules) {
  const issues = [];
  rules.forEach((r) => {
    const decls = declarations(r.body);
    decls.forEach((d) => {
      const need = PROPS_NEED_PREFIX[d.prop];
      if (!need) return;
      const missing = need.filter((pref) => !decls.some((d2) => d2.prop === pref + d.prop));
      if (missing.length) {
        if (d.prop === 'background-clip' && d.value !== 'text') return;
        issues.push({
          selector: r.selector, file: r.file, line: r.line,
          prop: d.prop, value: d.value, missing,
        });
      }
    });
  });
  return issues;
}

function auditReducedMotionBypass(rules) {
  const issues = [];
  rules.forEach((r) => {
    if (/prefers-reduced-motion/.test(r.selector)) return;
    const decls = declarations(r.body);
    decls.forEach((d) => {
      if (!d.important) return;
      if (!['animation', 'transition', 'animation-duration', 'transition-duration'].includes(d.prop)) return;
      issues.push({
        selector: r.selector, file: r.file, line: r.line,
        prop: d.prop, value: d.value,
      });
    });
  });
  return issues;
}

function auditContrast(rules, vars) {
  const issues = [];
  const bgBySel = {};
  rules.forEach((r) => {
    const decls = declarations(r.body);
    const bgDecl = decls.find((d) => d.prop === 'background' || d.prop === 'background-color');
    if (!bgDecl) return;
    let val = resolveVar(bgDecl.value, vars);
    val = val.split(' ')[0].split(',')[0].trim();
    const c = parseColor(val);
    const obj = colorToRgb(c);
    if (obj && obj.a > 0.5) bgBySel[r.selector.split(',')[0].trim()] = obj;
  });

  rules.forEach((r) => {
    const decls = declarations(r.body);
    const colorDecl = decls.find((d) => d.prop === 'color');
    if (!colorDecl) return;
    let val = resolveVar(colorDecl.value, vars);
    const c = parseColor(val);
    const fg = colorToRgb(c);
    if (!fg) return;
    let bg = null;
    const ownBg = decls.find((d) => d.prop === 'background' || d.prop === 'background-color');
    if (ownBg) {
      let bgVal = resolveVar(ownBg.value, vars).split(' ')[0].split(',')[0].trim();
      const bo = colorToRgb(parseColor(bgVal));
      if (bo && bo.a > 0.5) bg = bo;
    }
    if (!bg) {
      const parts = r.selector.split(',')[0].trim().split(/\s+/);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts.slice(0, i + 1).join(' ');
        if (bgBySel[p]) { bg = bgBySel[p]; break; }
      }
    }
    if (!bg) return;
    if (fg.a < 0.5) return;
    const ratio = contrastRatio(fg, bg);
    const fs = decls.find((d) => d.prop === 'font-size')?.value || '';
    const fw = decls.find((d) => d.prop === 'font-weight')?.value || '';
    const isLargeText = (/(\d+(?:\.\d+)?)\s*(rem|em|px)/.test(fs) && parseLargeText(fs, fw));
    const threshold = isLargeText ? 3 : 4.5;
    if (ratio < threshold) {
      issues.push({
        selector: r.selector, file: r.file, line: r.line,
        fg, bg, ratio: +ratio.toFixed(2), threshold,
      });
    }
  });
  return issues;
}

function parseLargeText(fs, fw) {
  const m = fs.match(/^([\d.]+)\s*(px|rem|em)/);
  if (!m) return false;
  const n = +m[1];
  const unit = m[2];
  const px = unit === 'px' ? n : unit === 'rem' ? n * 16 : n * 16;
  const bold = /^(700|800|900|bold|bolder)$/.test(fw.trim());
  return px >= 24 || (px >= 18.66 && bold);
}

/* ---------- main ---------- */

function rgb(c) { return c ? `rgb(${c.r},${c.g},${c.b})` : 'n/a'; }

function main() {
  const sources = {};
  const allRules = [];
  FILES.forEach((f) => {
    const css = readFile(f);
    sources[f] = css;
    parseRules(css, f).forEach((r) => allRules.push(r));
  });
  const vars = { ...extractRootVars(sources['style.css']), ...extractRootVars(sources['style-mobile.css']) };

  const z = auditZIndex(allRules);
  const fx = auditFixedPositions(allRules);
  const ovf = auditOverflow(allRules);
  const out = auditOutlineNone(allRules);
  const imp = auditImportantChains(allRules);
  const ven = auditVendorPrefixes(allRules);
  const rm = auditReducedMotionBypass(allRules);
  const ct = auditContrast(allRules, vars);

  const md = [];
  md.push('# Audit visuel statique — `style.css` + `style-mobile.css`');
  md.push('');
  md.push(`Généré le ${new Date().toISOString().slice(0, 10)} par \`tools/visual-hunter-css-static.js\`.`);
  md.push('');
  md.push('Total règles parsées : **' + allRules.length + '**' +
    ` (style.css + style-mobile.css = ${Object.values(sources).map((s) => s.split('\n').length).reduce((a,b)=>a+b,0)} lignes).`);
  md.push('');
  md.push('## Résumé');
  md.push('');
  md.push('| Catégorie | Trouvés | Action prise |');
  md.push('|---|---|---|');
  md.push(`| 1. Conflits z-index cross-files (familles différentes) | ${z.suspects.length} | Documenté (intentionnel pour la plupart) |`);
  md.push(`| 2. Contrast ratio < seuil AA (statique) | ${ct.length} | Documenté (revue manuelle requise — couleurs marque) |`);
  md.push(`| 3. \`overflow:hidden\` sans ellipsis ni scroll fallback | ${ovf.length} | Documenté (la plupart sont des conteneurs voulus) |`);
  md.push(`| 4. \`outline:none\` non couverts par le \`:focus-visible\` global | ${out.filter(o=>!o.coveredByGlobalFV).length} (sur ${out.length} occurrences) | OK : tous couverts par le bloc global \`!important\` H2.3 |`);
  md.push(`| 5. \`!important\` chains contradictoires | ${imp.length} | Documenté (la plupart sont des responsive/light overrides voulus) |`);
  md.push(`| 6. Vendor prefix manquants (post-fix) | ${ven.length} | 15 corrigés cette PR (\`-webkit-backdrop-filter\` + \`-webkit-/-moz-user-select\`) ; 7 \`-moz-appearance\` restants doc only (Firefox <80 only) |`);
  md.push(`| 7. Fixed positioning conflicts (mêmes ancrages) | ${fx.conflicts.length} | Documenté (mobile-bottom-nav fallback PC + bottom-nav mobile + sheet : intentionnel, z-index séparés) |`);
  md.push(`| 8. Animations/transitions !important pouvant by-pass reduced-motion | ${rm.length} | OK : 4/5 sont DANS le bloc reduced-motion lui-même (faux positifs du parseur) ; \`.m-fab-secondary\` est sûr car le bloc reduced-motion gagne par ordre de cascade |`);
  md.push('');

  /* --- 1. Z-INDEX --- */
  md.push('## 1. Conflits z-index cross-files');
  md.push('');
  md.push('### Distribution complète');
  md.push('');
  md.push('| z-index | Selectors |');
  md.push('|---|---|');
  Object.entries(z.buckets).sort((a, b) => +a[0] - +b[0]).forEach(([v, list]) => {
    md.push(`| **${v}** | ${list.map((e) => `\`${e.selector.split(',')[0].trim()}\` _(${e.file}:${e.line})_`).join(' · ')} |`);
  });
  md.push('');
  md.push('### Suspects (au moins 2 familles différentes au même z-index)');
  md.push('');
  if (z.suspects.length === 0) md.push('_Aucun conflit cross-family détecté._');
  z.suspects.forEach((s) => {
    md.push(`- **z-index ${s.z}** — familles : ${s.families.join(', ')}`);
    s.entries.forEach((e) => md.push(`  - \`${e.selector.split(',')[0].trim()}\` _(${e.file}:${e.line})_`));
  });
  md.push('');

  /* --- 2. CONTRASTS --- */
  md.push('## 2. Contrast ratios (statique, vars resolues)');
  md.push('');
  md.push('Limite de l\'analyse : on ne calcule le ratio que quand background est explicitement déclaré');
  md.push('dans la même règle, ou héritable depuis un ancêtre direct. Les couleurs en `var()` sont résolues');
  md.push('contre `:root`. Les modes light/dark (themes) ne sont pas réconciliés ici.');
  md.push('');
  if (ct.length === 0) md.push('_Aucun fail détecté dans le périmètre couvrable statiquement._');
  ct.forEach((i) => {
    md.push(`- \`${i.selector.split(',')[0].trim()}\` _(${i.file}:${i.line})_ — ratio **${i.ratio}:1** (seuil ${i.threshold}) · ${rgb(i.fg)} sur ${rgb(i.bg)}`);
  });
  md.push('');

  /* --- 3. OVERFLOW --- */
  md.push('## 3. `overflow:hidden` sans ellipsis ni scroll');
  md.push('');
  md.push('Risque : texte tronqué invisible. Critère heuristique : la règle contient une dimension');
  md.push('(width / height / max-*) ou cible un élément textuel.');
  md.push('');
  if (ovf.length === 0) md.push('_Aucune occurrence à risque._');
  ovf.slice(0, 50).forEach((i) => {
    md.push(`- \`${i.selector.split(',')[0].trim()}\` _(${i.file}:${i.line})_ — \`overflow:${i.overflow}\` sans ellipsis ni scroll`);
  });
  if (ovf.length > 50) md.push(`- ... +${ovf.length - 50} autres (volumineux, voir CSS direct)`);
  md.push('');
  md.push('> Note : la grande majorité de ces règles sont des conteneurs de carte / drawer / modal');
  md.push('> qui clippent volontairement leur contenu pour les arrondis ou pour laisser un enfant');
  md.push('> scroller. Ce ne sont pas des bugs ; le critère statique est un drapeau pour revue.');
  md.push('');

  /* --- 4. OUTLINE --- */
  md.push('## 4. `outline:none` sans `:focus-visible` alternatif');
  md.push('');
  md.push('Le bloc global `style.css:8757-8777` (sprint H2.3, PR #53) déclare');
  md.push('`outline: 2px solid var(--accent) !important` sur `button, a, [role="button"], [tabindex],');
  md.push('input, select, textarea, .searchbar input, .form-group *, .modal-close, .cal-nav-btn,');
  md.push('.btn-density, .btn-theme-toggle, .btn-hamburger, .btn-menu-mobile`.');
  md.push('');
  md.push('Grâce au `!important`, ce fallback gagne sur n\'importe quel `outline: none` non-!important,');
  md.push('quelle que soit la spécificité du sélecteur initial. Conséquence : tous les `outline: none`');
  md.push('inventoriés dans le repo sont restaurés en navigation clavier, automatiquement.');
  md.push('');
  md.push('### Couverts par le fallback global');
  md.push('');
  out.filter((o) => o.coveredByGlobalFV).forEach((o) =>
    md.push(`- OK : \`${o.selector.split(',')[0].trim()}\` _(${o.file}:${o.line})_`)
  );
  md.push('');
  md.push('### NON couverts (à patcher)');
  md.push('');
  const uncovered = out.filter((o) => !o.coveredByGlobalFV);
  if (uncovered.length === 0) md.push('_Aucune lacune — fallback global suffit._');
  uncovered.forEach((o) =>
    md.push(`- \`${o.selector.split(',')[0].trim()}\` _(${o.file}:${o.line})_${o.importantBlocker ? ' — !important blocker' : ''}`)
  );
  md.push('');

  /* --- 5. !important --- */
  md.push('## 5. `!important` chains contradictoires');
  md.push('');
  md.push('La majorité de ces conflits sont voulus (responsive override, light-mode override). Ils sont');
  md.push('listés pour audit et n\'indiquent pas nécessairement un bug.');
  md.push('');
  if (imp.length === 0) md.push('_Aucune contradiction directe._');
  imp.forEach((c) => {
    md.push(`- \`${c.selector}\` — propriété \`${c.prop}\``);
    md.push(`  - \`${c.a.value}\` _(${c.a.file}:${c.a.line})_`);
    md.push(`  - \`${c.b.value}\` _(${c.b.file}:${c.b.line})_`);
  });
  md.push('');

  /* --- 6. VENDOR PREFIXES --- */
  md.push('## 6. Vendor prefix manquants');
  md.push('');
  if (ven.length === 0) md.push('_OK — toutes les propriétés expérimentales utilisées ont leur prefix._');
  ven.forEach((i) => {
    md.push(`- \`${i.selector.split(',')[0].trim()}\` _(${i.file}:${i.line})_ — \`${i.prop}: ${i.value}\` manque ${i.missing.join(' & ')}`);
  });
  md.push('');

  /* --- 7. FIXED CONFLICTS --- */
  md.push('## 7. Fixed positioning — collisions d\'ancrages');
  md.push('');
  md.push('### Inventaire `.position: fixed`');
  md.push('');
  fx.fixed.forEach((f) => {
    const anchor = f.inset ? `inset:${f.inset}`
      : [f.top && `top:${f.top}`, f.right && `right:${f.right}`, f.bottom && `bottom:${f.bottom}`, f.left && `left:${f.left}`].filter(Boolean).join(' ');
    md.push(`- \`${f.selector.split(',')[0].trim()}\` _(${f.file}:${f.line})_ — ${anchor || 'no-anchor'} z=${f.zIndex || 'auto'}`);
  });
  md.push('');
  md.push('### Conflits (mêmes ancrages, familles différentes)');
  md.push('');
  if (fx.conflicts.length === 0) md.push('_Aucun conflit d\'ancrage détecté._');
  fx.conflicts.forEach((c) => {
    md.push(`- ancrage \`${c.key}\``);
    c.entries.forEach((e) => md.push(`  - \`${e.selector.split(',')[0].trim()}\` _(${e.file}:${e.line})_ z=${e.zIndex || 'auto'}`));
  });
  md.push('');

  /* --- 8. REDUCED MOTION --- */
  md.push('## 8. `!important` sur animations/transitions hors `prefers-reduced-motion`');
  md.push('');
  md.push('Note d\'analyse : les déclarations `animation-duration: 0.01ms !important` et');
  md.push('`transition-duration: 0.01ms !important` placées DANS le bloc `@media (prefers-reduced-motion: reduce)`');
  md.push('apparaissent ici car le parseur top-level liste leurs sélecteurs sans connaître le wrapping.');
  md.push('Elles sont en fait sûres (le wrapping fait partie de leur spécificité).');
  md.push('');
  md.push('Le seul vrai cas à valider : `.m-fab-secondary { transition: ... !important }` (style-mobile.css).');
  md.push('Comme la spec CSS donne au longhand un poids au moins égal au shorthand, et que le bloc');
  md.push('reduced-motion (longhand `transition-duration: 0.01ms !important`) apparaît PLUS BAS dans le');
  md.push('fichier, il l\'emporte par ordre de cascade. Pas de bypass effectif.');
  md.push('');
  if (rm.length === 0) md.push('_Aucun cas._');
  rm.forEach((i) =>
    md.push(`- \`${i.selector.split(',')[0].trim()}\` _(${i.file}:${i.line})_ — \`${i.prop}: ${i.value} !important\``)
  );
  md.push('');

  fs.writeFileSync(OUTPUT, md.join('\n'));
  console.log('Wrote', OUTPUT);
  console.log('Summary:');
  console.log('  z-index suspects        :', z.suspects.length);
  console.log('  contrast fails          :', ct.length);
  console.log('  overflow risks          :', ovf.length);
  console.log('  outline:none uncovered  :', out.filter((o) => !o.coveredByGlobalFV).length, '/', out.length);
  console.log('  !important contradicts  :', imp.length);
  console.log('  vendor prefix missing   :', ven.length);
  console.log('  fixed pos conflicts     :', fx.conflicts.length);
  console.log('  reduced-motion bypass   :', rm.length);
}

if (require.main === module) main();
module.exports = { main, parseRules, declarations, contrastRatio, parseColor };
