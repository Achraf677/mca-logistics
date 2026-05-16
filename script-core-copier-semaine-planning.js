/**
 * MCA Logistics — Copier planning semaine précédente sur grille rapide (Phase X — extraction script.js)
 *
 * Extracted from script.js L2667-2690 (2026-05-16).
 */

/* ===== COPIER PLANNING SEMAINE PRÉCÉDENTE ===== */
function copierSemainePrecedente() {
  const salId = document.getElementById('plan-salarie').value;
  if (!salId) { afficherToast('⚠️ Choisissez un salarié','error'); return; }
  const plannings = loadSafe('plannings', []);
  const plan = plannings.find(p=>p.salId===salId);
  if (!plan?.semaine?.length) { afficherToast('⚠️ Aucun planning précédent à copier','error'); return; }
  // Pré-remplir la grille avec les données existantes
  JOURS.forEach(jour => {
    const j = plan.semaine.find(s=>s.jour===jour);
    const cb = document.getElementById('plan-travaille-'+jour);
    if (cb && j) {
      cb.checked = j.travaille;
      toggleJourPlanning(jour);
      if (j.travaille) {
        const d=document.getElementById('plan-debut-'+jour); if(d) d.value=j.heureDebut||'';
        const f=document.getElementById('plan-fin-'+jour);   if(f) f.value=j.heureFin||'';
        const z=document.getElementById('plan-zone-'+jour);  if(z) z.value=j.zone||'';
        const n=document.getElementById('plan-note-'+jour);  if(n) n.value=j.note||'';
      }
    }
  });
  afficherToast('✅ Semaine précédente copiée — modifiez si nécessaire');
}

if (typeof window !== 'undefined') {
  window.copierSemainePrecedente = copierSemainePrecedente;
}
