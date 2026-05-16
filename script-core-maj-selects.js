/**
 * MCA Logistics — Mise à jour des selects (chauffeur, véhicule, salarié) cross-forms (Phase X — extraction script.js)
 *
 * Extracted from script.js L1009-1098 (2026-05-16).
 */

function mettreAJourSelects() {
  const chauffeurs = charger('chauffeurs');
  const vehicules  = charger('vehicules');
  const salaries   = charger('salaries');

  // Véhicule dans charges et entretiens
  ['charge-veh','entr-veh'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const v = sel.value;
    sel.innerHTML = id==='charge-veh' ? '<option value="">— Général —</option>' : '<option value="">— Choisir —</option>';
    vehicules.forEach(vh => sel.innerHTML += `<option value="${vh.id}">${vh.immat}${vh.modele?' — '+vh.modele:''}</option>`);
    sel.value = v;
  });

  // Livraisons récentes dans incident (30 derniers jours)
  const incSel = document.getElementById('inc-livraison');
  if (incSel) {
    const v = incSel.value;
    const dateMin = new Date(Date.now()-30*24*60*60*1000).toLocalISODate();
    incSel.innerHTML = '<option value="">— Aucune livraison spécifique —</option>';
    charger('livraisons').filter(l=>l.date>=dateMin).sort((a,b)=>new Date(b.date)-new Date(a.date))
      .forEach(l => incSel.innerHTML += `<option value="${l.id}">${l.numLiv||''} — ${l.client} (${l.date})</option>`);
    incSel.value = v;
  }

  // Sélect salarié dans modal incident
  peupleIncSalarie();

  // Phase 91.44 (Agent Salariés M2 + Véhicules M5) — exclure salariés/véhicules inactifs des selects
  const salariesActifs = salaries.filter(s => s && s.actif !== false);
  const vehiculesActifs = vehicules.filter(v => {
    if (!v) return false;
    const st = String(v.statut || 'actif').toLowerCase();
    return st !== 'inactif' && st !== 'vendu' && st !== 'hors_service';
  });

  // Sélect salarié dans modal planning
  const sp = document.getElementById('plan-salarie');
  if (sp) {
    const v = sp.value;
    sp.innerHTML = '<option value="">-- Choisir un salarié --</option>';
    salariesActifs.forEach(s => { sp.innerHTML += `<option value="${s.id}">${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    sp.value = v;
  }

  const sc = document.getElementById('liv-chauffeur');
  if (sc) {
    const v = sc.value; sc.innerHTML = '<option value="">-- Choisir un salarié / chauffeur --</option>';
    // Salariés d'abord (avec badge), puis chauffeurs non-salariés
    salariesActifs.forEach(s => { sc.innerHTML += `<option value="${s.id}">${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    chauffeurs.filter(c => !salaries.find(s => s.id === c.id))
      .forEach(c => { sc.innerHTML += `<option value="${c.id}">${c.nom}</option>`; });
    sc.value = v;
  }

  const sec = document.getElementById('edit-liv-chauffeur');
  if (sec) {
    const v = sec.value; sec.innerHTML = '<option value="">-- Choisir un salarié / chauffeur --</option>';
    salariesActifs.forEach(s => { sec.innerHTML += `<option value="${s.id}">${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    chauffeurs.filter(c => !salaries.find(s => s.id === c.id))
      .forEach(c => { sec.innerHTML += `<option value="${c.id}">${c.nom}</option>`; });
    sec.value = v;
  }

  ['liv-vehicule','edit-liv-vehicule','carb-vehicule','entr-vehicule'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const v = sel.value; sel.innerHTML = '<option value="">-- Choisir un véhicule --</option>';
    vehiculesActifs.forEach(veh => { sel.innerHTML += `<option value="${veh.id}">${veh.immat} — ${veh.modele}${veh.salNom ? ' ('+veh.salNom+')' : ''}</option>`; });
    sel.value = v;
  });

  // Sélect véhicule dans création salarié
  const sv = document.getElementById('nsal-vehicule');
  if (sv) {
    const v = sv.value; sv.innerHTML = '<option value="">-- Aucun pour l\'instant --</option>';
    vehicules.filter(veh => !veh.salId).forEach(veh => { sv.innerHTML += `<option value="${veh.id}">${veh.immat} — ${veh.modele}</option>`; });
    sv.value = v;
  }

  // Sélect véhicule dans modal edit salarié
  const sve = document.getElementById('edit-sal-vehicule');
  if (sve) {
    const v = sve.value; sve.innerHTML = '<option value="">-- Retirer l\'affectation --</option>';
    vehicules.forEach(veh => {
      const dejaPris = veh.salId && veh.salId !== (window._editSalarieId || '');
      if (!dejaPris) sve.innerHTML += `<option value="${veh.id}">${veh.immat} — ${veh.modele}</option>`;
    });
    sve.value = v;
  }
}

if (typeof window !== 'undefined') {
  window.mettreAJourSelects = mettreAJourSelects;
}
