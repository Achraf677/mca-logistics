// Injects modals CSS/JS link + modals HTML into all preview pages,
// and wires up the buttons to open the right modals.
// Run: node tools/inject-modals.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'previews';
const modalsHTML = readFileSync(join(dir, 'modals-content.html'), 'utf8');

const files = readdirSync(dir).filter(f => f.endsWith('.html') && !['index.html','modals-content.html'].includes(f));

// Mapping : button text → modal ID
const WIRES = [
  // [regex of button HTML, modal ID]
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Nouvelle livraison<\/button>/g, 'modal-new-livraison'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Nouveau client<\/button>/g, 'modal-new-client'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Nouveau fournisseur<\/button>/g, 'modal-new-fournisseur'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Nouvelle charge<\/button>/g, 'modal-new-charge'],
  [/<button class="btn btn-primary"[^>]*style="white-space:nowrap"><svg[^<]*<\/svg>Ajouter un véhicule<\/button>/g, 'modal-new-vehicule'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Plein<\/button>/g, 'modal-new-plein'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Pointer<\/button>/g, 'modal-pointer'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Déclarer incident<\/button>/g, 'modal-new-incident'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Nouvelle inspection<\/button>/g, 'modal-new-inspection'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Enregistrer paiement<\/button>/g, 'modal-payment'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Ajouter<\/button>/g, 'modal-new-salarie'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?Planifier<\/button>/g, 'modal-plan-entretien'],
  [/<button class="btn btn-primary"[^>]*>([^<]*<svg[^<]*<\/svg>)?\+ Gérer les horaires<\/button>/g, 'modal-horaires'],
  [/<button class="btn btn-secondary"[^>]*>📷? Scanner carte grise<\/button>/g, 'modal-config-anomalies'],
  // Specific named buttons
  [/(<button class="btn btn-secondary"[^>]*>)Programmer CT(<\/button>)/g, 'modal-program-ct'],
  [/(<button class="btn btn-primary"[^>]*[^>]*>)Programmer CT(<\/button>)/g, 'modal-program-ct'],
  [/(<button class="btn btn-secondary"[^>]*>)Configurer anomalies(<\/button>)/g, 'modal-config-anomalies'],
  [/(<button class="btn btn-secondary"[^>]*>)Changer le régime(<\/button>)/g, 'modal-tva-regime'],
  [/(<button class="btn btn-secondary"[^>]*>)📤? ?Envoyer relances(<\/button>)/g, 'modal-relances'],
];

for (const f of files) {
  const fp = join(dir, f);
  let html = readFileSync(fp, 'utf8');
  let changed = false;

  // Inject CSS link in <head>
  if (!html.includes('modals-shared.css')) {
    html = html.replace(/<link rel="stylesheet" href="tokens\.css">/, `<link rel="stylesheet" href="tokens.css">\n<link rel="stylesheet" href="modals-shared.css">`);
    changed = true;
  }

  // Inject modals HTML before </body>
  if (!html.includes('modal-new-livraison')) {
    html = html.replace(/<\/body>/, `\n<!-- Modals -->\n${modalsHTML}\n<script src="modals-shared.js" defer></script>\n</body>`);
    changed = true;
  }

  // Wire up buttons : add data-modal-open attribute to matching buttons
  for (const [re, modalId] of WIRES) {
    html = html.replace(re, (match) => {
      // Add data-modal-open to the button tag
      if (match.includes('data-modal-open')) return match; // already wired
      changed = true;
      return match.replace(/<button class="btn btn-(primary|secondary)"/, `<button class="btn btn-$1" data-modal-open="${modalId}"`);
    });
  }

  if (changed) {
    writeFileSync(fp, html, 'utf8');
    console.log(`  ✓ ${f}`);
  }
}
console.log('\nDone.');
