/**
 * MCA Logistics — Modèles messages prédéfinis (Phase X.I — extraction script.js)
 *
 * 5 templates messages chauffeur (Tournée prête, Rappel km, Inspection, etc.) avec
 * substitution {prenom}. Helpers d'affichage (afficherModelesMessages) et insertion
 * (utiliserModele) dans #msg-admin-input. togglePanelModeles ouvre/ferme #panel-modeles.
 *
 * Lit window._msgSalarieActif (set par script-messages.js quand un salarié est sélectionné).
 *
 * Dependencies (globals) : afficherToast, charger.
 *
 * Extracted from script.js L2678-2714 (Phase X.I, 2026-05-16).
 */

const MODELES_MESSAGES = [
  { id: 1, titre: 'Tournée prête',     texte: 'Bonjour {prenom} 👋 Votre tournée du jour est prête. Vérifiez vos livraisons assignées dans l\'onglet Livraisons.' },
  { id: 2, titre: 'Rappel km retour',  texte: 'Bonsoir {prenom}, n\'oubliez pas d\'enregistrer votre km de retour et votre plein si vous en avez fait un. Merci 🙏' },
  { id: 3, titre: 'Rappel inspection', texte: 'Rappel : pensez à faire l\'inspection de votre véhicule avant le départ. Photos obligatoires 📷' },
  { id: 4, titre: 'Livraison urgente', texte: 'Livraison urgente ajoutée à votre tournée. Consultez l\'onglet Livraisons pour les détails.' },
  { id: 5, titre: 'Bonne journée',     texte: 'Bonjour {prenom} ☀️ Bonne journée de livraisons ! N\'hésitez pas à me contacter en cas de problème.' },
];

function afficherModelesMessages() {
  const cont = document.getElementById('modeles-msg-list');
  if (!cont) return;
  cont.innerHTML = MODELES_MESSAGES.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:600">${m.titre}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${m.texte.substring(0, 55)}...</div>
      </div>
      <button class="btn-icon" onclick="utiliserModele(${m.id})" title="Utiliser">→</button>
    </div>`).join('');
}

function utiliserModele(id) {
  const modele = MODELES_MESSAGES.find(m => m.id === id);
  const salId = window._msgSalarieActif;
  if (!modele || !salId) { afficherToast('⚠️ Sélectionnez d\'abord un salarié', 'error'); return; }
  const sal = charger('salaries').find(s => s.id === salId);
  const texte = modele.texte.replace('{prenom}', sal?.nom.split(' ')[0] || '');
  const input = document.getElementById('msg-admin-input');
  if (input) { input.value = texte; input.focus(); }
  document.getElementById('panel-modeles')?.classList.remove('open');
}

function togglePanelModeles() {
  const panel = document.getElementById('panel-modeles');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (isOpen) afficherModelesMessages();
}

if (typeof window !== 'undefined') {
  window.MODELES_MESSAGES = MODELES_MESSAGES;
  window.afficherModelesMessages = afficherModelesMessages;
  window.utiliserModele = utiliserModele;
  window.togglePanelModeles = togglePanelModeles;
}
