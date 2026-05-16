/**
 * MCA Logistics — Templates SMS (Phase X.B — extraction script.js)
 *
 * 4 templates SMS standard (avis passage, livraison, retard, tentative échouée)
 * + helpers afficherTemplatesSMS (render dans #templates-sms-list) et
 * copierTemplateSMS (clipboard avec fallback textarea+execCommand).
 *
 * Extracted from script.js L3224-3256 (Phase X.B, 2026-05-16).
 */

const TEMPLATES_SMS = [
  { id: 1, titre: 'Avis de passage',     texte: "Bonjour, votre livreur [NOM] sera chez vous prochainement. MCA Logistics." },
  { id: 2, titre: 'Livraison effectuée', texte: "Votre commande a été livrée par [NOM]. Merci de votre confiance. MCA Logistics." },
  { id: 3, titre: 'Retard',              texte: "Nous vous informons d’un léger retard sur votre livraison. Merci de votre compréhension. MCA Logistics." },
  { id: 4, titre: 'Tentative échouée',   texte: "Nous avons tenté de vous livrer sans succès. Merci de nous recontacter. MCA Logistics." },
];

function afficherTemplatesSMS() {
  const cont = document.getElementById('templates-sms-list');
  if (!cont) return;
  cont.innerHTML = TEMPLATES_SMS.map(t => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">${t.titre}</div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;font-style:italic">${t.texte}</div>
      <button class="btn-secondary" style="font-size:.75rem;padding:4px 10px"
        onclick="copierTemplateSMS('${t.id}')">Copier</button>
    </div>`).join('');
}

function copierTemplateSMS(id) {
  const t = TEMPLATES_SMS.find(x => x.id === parseInt(id, 10));
  if (!t) return;
  navigator.clipboard?.writeText(t.texte).then(() => {
    afficherToast('Template SMS copié dans le presse-papier');
  }).catch(() => {
    // Fallback si clipboard non disponible (vieux navigateurs ou contexte non sécurisé)
    const ta = document.createElement('textarea');
    ta.value = t.texte; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    afficherToast('Template SMS copié');
  });
}

if (typeof window !== 'undefined') {
  window.TEMPLATES_SMS = TEMPLATES_SMS;
  window.afficherTemplatesSMS = afficherTemplatesSMS;
  window.copierTemplateSMS = copierTemplateSMS;
}
