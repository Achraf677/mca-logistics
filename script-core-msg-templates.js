/**
 * MCA Logistics — MSG_TEMPLATES + insererTemplate (chat admin → chauffeur) (Phase X — extraction script.js)
 *
 * Extracted from script.js L2057-2072 (2026-05-16).
 */

/* ===== MODÈLES DE MESSAGES ===== */
const MSG_TEMPLATES = [
  { label: 'Tournée prête',   texte: 'Bonjour [prénom] 👋 Votre tournée du jour est prête. Vérifiez vos livraisons dans l\'onglet Livraisons. Bonne journée !' },
  { label: 'Relevé km',       texte: 'Rappel : pensez à enregistrer votre relevé kilométrique de retour dans l\'onglet Inspection & Km. Merci !' },
  { label: 'Inspection',      texte: 'Rappel : inspection véhicule obligatoire avant le départ. Prenez les 4 photos demandées. Merci !' },
  { label: '⛽ Plein',           texte: 'Si vous avez fait le plein aujourd\'hui, n\'oubliez pas de le saisir dans l\'onglet Carburant. Merci !' },
  { label: '✅ Bonne journée',   texte: 'Bonjour à tous ! Bonne journée de livraisons. Restez prudents sur la route 🚐' },
];

function insererTemplate(texte, salNom) {
  const input = document.getElementById('msg-admin-input');
  if (!input) return;
  input.value = texte.replace('[prénom]', salNom || '');
  input.focus();
  input.dispatchEvent(new Event('input'));
}

if (typeof window !== 'undefined') {
  window.insererTemplate = insererTemplate;
  window.MSG_TEMPLATES = MSG_TEMPLATES;
}
