/**
 * MCA Logistics — Génération grille jours planning rapide (7 lignes Lun-Dim) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1791-1839 (2026-05-16).
 */

function genererGrilleJours() {
  const salId = document.getElementById('plan-salarie').value;
  const grid  = document.getElementById('plan-jours-grid');
  if (!grid) return;

  const plannings = loadSafe('plannings', []);
  const plan = plannings.find(p => p.salId === salId);

  grid.innerHTML = JOURS.map((jour, i) => {
    const existing = plan?.semaine?.find(j => j.jour === jour) || {};
    const typeJour = existing.typeJour || (existing.travaille ? 'travail' : 'repos');
    const classeRow = typeJour==='conge'?'jour-conge':typeJour==='absence'?'jour-absence':typeJour==='maladie'?'jour-maladie':'';
    return `
      <div id="plan-row-${jour}" style="background:var(--bg-dark,#0f1117);border:1px solid var(--border);border-radius:8px;padding:10px 12px" class="${classeRow}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
            <input type="checkbox" id="plan-travaille-${jour}" ${existing.travaille ? 'checked' : ''}
              onchange="toggleJourPlanning('${jour}')"
              style="width:16px;height:16px;accent-color:var(--accent)" />
            <strong style="font-size:.9rem">${JOURS_COURTS[i]} — ${jour.charAt(0).toUpperCase()+jour.slice(1)}</strong>
          </label>
          <select class="planning-type-select" id="plan-type-${jour}" onchange="toggleTypeJour('${jour}')" style="width:110px">
            <option value="travail" ${typeJour==='travail'?'selected':''}>Travail</option>
            <option value="repos"   ${typeJour==='repos'  ?'selected':''}>Repos</option>
            <option value="conge"   ${typeJour==='conge'  ?'selected':''}>Congé</option>
            <option value="absence" ${typeJour==='absence'?'selected':''}>Absence</option>
            <option value="maladie" ${typeJour==='maladie'?'selected':''}>Maladie</option>
          </select>
        </div>
        <div id="plan-horaires-${jour}" style="display:${existing.travaille&&typeJour==='travail' ? 'grid' : 'none'};grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Début</label>
            <input type="time" id="plan-debut-${jour}" value="${existing.heureDebut||''}"
              onchange="mettreAJourTotalHeuresPlanning()"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Fin</label>
            <input type="time" id="plan-fin-${jour}" value="${existing.heureFin||''}"
              onchange="mettreAJourTotalHeuresPlanning()"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Zone</label>
            <input type="text" id="plan-zone-${jour}" value="${existing.zone||''}" placeholder="Ex: Nord"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Note</label>
            <input type="text" id="plan-note-${jour}" value="${existing.note||''}" placeholder="Informations..."
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
        </div>
      </div>`;
  }).join('');
  mettreAJourTotalHeuresPlanning();
}

if (typeof window !== 'undefined') {
  window.genererGrilleJours = genererGrilleJours;
}
