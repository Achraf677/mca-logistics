/**
 * MCA Logistics — Génération + évaluation qualité mot de passe (Mca!XXXX) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1777-1794 (2026-05-16).
 */

function genererMotDePasseFort(prefix) {
  // Format : 1ère lettre majuscule + reste minuscule + '!' + 4 chiffres
  // → satisfait les 4 règles : majuscule, minuscule, chiffre, caractère spécial
  // Avant : 'MCA!8370' (sans minuscule) → user recevait l'erreur 'ajouter une minuscule'
  // Après : 'Mca!8370'
  const baseRaw = String(prefix || 'MCA').replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'MCA';
  const base = baseRaw.charAt(0).toUpperCase() + baseRaw.slice(1).toLowerCase();
  const suffixe = String(Math.floor(1000 + Math.random() * 9000));
  return base + '!' + suffixe;
}

function evaluerQualiteMotDePasse(value) {
  const evaluation = evaluerQualiteMotDePasseFort(value);
  return {
    texte: evaluation.message,
    couleur: evaluation.color
  };
}

if (typeof window !== 'undefined') {
  window.genererMotDePasseFort = genererMotDePasseFort;
  window.evaluerQualiteMotDePasse = evaluerQualiteMotDePasse;
}
