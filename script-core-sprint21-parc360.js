/**
 * MCA Logistics — Sprint 21 — Parc 360° fiche unifiée véhicule + auto-alertes Parc (Phase X — extraction script.js)
 *
 * Extracted from script.js L4920-5391 (2026-05-16).
 */

/* ==========================================================================
   Sprint 21 — Parc 360° : Fiche unifiée véhicule + auto-alertes Parc
   Réutilise l'infrastructure drawer #s20-drawer de S20 (ouverture exclusive)
   ========================================================================== */
(function installS21Parc360(){
  if (window.__s21Installed) return;
  window.__s21Installed = true;

  const loadJSON = (k, def='[]') => { try { return JSON.parse(localStorage.getItem(k) || def); } catch(e){ return JSON.parse(def); } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) { /* fail-silent: localStorage quota / mode privé */ } };
  const esc = window.escapeHtml;
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('fr-FR'); } catch(e){ return ''; } };
  const fmtDateTime = (d) => { try { return new Date(d).toLocaleString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); } catch(e){ return ''; } };
  const euro = (n) => (typeof window.euros === 'function') ? window.euros(n) : ((parseFloat(n)||0).toFixed(2) + ' €');

  /* ---------- 1. Auto-alertes Parc (alimentent alertes_admin → S19) ---------- */
  function genererAlertesParc() {
    const vehicules = loadJSON('vehicules');
    const carburants = loadJSON('carburant');
    const alertes = loadJSON('alertes_admin');
    const nowMs = Date.now();
    const causeActive = new Set();
    const nouvelles = [];

    vehicules.forEach(v => {
      // 1. Entretien dû (via helper existant)
      try {
        const pilotage = typeof window.getPilotageEntretienVehicule === 'function'
          ? window.getPilotageEntretienVehicule(v) : null;
        if (pilotage && pilotage.estEnRetard) {
          const key = 'parc_entretien_expire_' + v.id;
          causeActive.add(key);
          if (!alertes.find(a => a.id === key)) {
            const motif = pilotage.prochainKm && pilotage.kmActuel >= pilotage.prochainKm
              ? `km dépassés (${pilotage.kmActuel} / ${pilotage.prochainKm})`
              : `échéance dépassée (${pilotage.dateEcheance || '—'})`;
            nouvelles.push({
              id: key, type: 'parc_entretien_expire',
              message: `${v.immat} — entretien en retard : ${motif}`,
              vehId: v.id, vehImmat: v.immat,
              creeLe: new Date().toISOString(), traitee: false
            });
          }
        } else if (pilotage && pilotage.estProche) {
          const key = 'parc_entretien_proche_' + v.id;
          causeActive.add(key);
          if (!alertes.find(a => a.id === key)) {
            const detail = pilotage.kmRestants !== null && pilotage.kmRestants > 0
              ? ` (reste ${Math.round(pilotage.kmRestants)} km)`
              : pilotage.dateEcheance ? ` (d’ici le ${fmtDate(pilotage.dateEcheance)})` : '';
            nouvelles.push({
              id: key, type: 'parc_entretien_proche',
              message: `${v.immat} — entretien bientôt dû${detail}`,
              vehId: v.id, vehImmat: v.immat,
              creeLe: new Date().toISOString(), traitee: false
            });
          }
        }
      } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:genererAlertesParc-entretien]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }

      // 2. Conso anormale (conso réelle 60j vs théorique)
      if (v.conso && parseFloat(v.conso) > 0) {
        const pleinsVeh = carburants.filter(c => c.vehId === v.id);
        const J60 = 60 * 86400000;
        const recents = pleinsVeh.filter(c => c.date && (nowMs - new Date(c.date).getTime()) < J60);
        if (recents.length >= 3) {
          const kmVals = recents.map(c => parseFloat(c.kmCompteur)).filter(k => !isNaN(k) && k > 0);
          if (kmVals.length >= 2) {
            const deltaKm = Math.max(...kmVals) - Math.min(...kmVals);
            if (deltaKm > 100) {
              const totalL = recents.reduce((s, c) => s + (parseFloat(c.litres) || 0), 0);
              const consoReelle = (totalL / deltaKm) * 100;
              const seuil = parseFloat(v.conso) * 1.3;
              if (consoReelle > seuil) {
                const key = 'parc_conso_excess_' + v.id;
                causeActive.add(key);
                if (!alertes.find(a => a.id === key)) {
                  nouvelles.push({
                    id: key, type: 'parc_conso_excess',
                    message: `⛽ ${v.immat} — conso réelle ${consoReelle.toFixed(1)} L/100 (théo ${v.conso})`,
                    vehId: v.id, vehImmat: v.immat,
                    creeLe: new Date().toISOString(), traitee: false
                  });
                }
              }
            }
          }
        }
      }
    });

    // Auto-clôture : parc_* non-traitées dont cause a disparu
    let modif = false;
    alertes.forEach(a => {
      if (a.type && typeof a.type === 'string' && a.type.startsWith('parc_') && !a.traitee) {
        if (!causeActive.has(a.id)) {
          a.traitee = true;
          a.autoCloseLe = new Date().toISOString();
          modif = true;
        }
      }
    });

    if (nouvelles.length || modif) saveJSON('alertes_admin', [...alertes, ...nouvelles]);
    if (typeof window.renderCentre === 'function') {
      try { window.renderCentre(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:renderCentre]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }
  }

  /* ---------- 2. Fiche 360° Véhicule (réutilise drawer S20) ---------- */
  function ensureDrawer() {
    // Le drawer est créé par S20. Si S20 pas encore initialisé, on le crée ici.
    if (document.getElementById('s20-drawer')) return;
    const overlay = document.createElement('div');
    overlay.className = 's20-drawer-overlay';
    overlay.id = 's20-drawer-overlay';
    overlay.onclick = () => window.fermerFiche360 && window.fermerFiche360();
    const drawer = document.createElement('aside');
    drawer.className = 's20-drawer';
    drawer.id = 's20-drawer';
    drawer.innerHTML = `
      <div class="s20-drawer-header">
        <h3 id="s20-drawer-title">Fiche</h3>
        <button class="s20-drawer-close" onclick="window.fermerFiche360()" aria-label="Fermer">✕</button>
      </div>
      <div class="s20-drawer-content" id="s20-drawer-content"></div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) window.fermerFiche360 && window.fermerFiche360();
    });
    /* WRAPPER S21 — fermerFiche360 fallback. H2.1 : la définition canonique
       vit dans le bloc S20 (`window.fermerFiche360 = function() { ... }`).
       Ce bloc S21 (Fiche 360° Véhicule) réutilise le drawer S20. Le `if`
       garantit qu'on ne ré-écrit JAMAIS la canonique — seulement défini si
       S20 n'a pas encore tourné. Pas de collision. */
    if (typeof window.fermerFiche360 !== 'function') {
      window.fermerFiche360 = function() {
        const d = document.getElementById('s20-drawer');
        const o = document.getElementById('s20-drawer-overlay');
        if (d) d.classList.remove('open');
        if (o) o.classList.remove('open');
      };
    }
  }

  window.ouvrirFiche360Vehicule = function(vehId) {
    const veh = loadJSON('vehicules').find(v => v.id === vehId);
    if (!veh) { if (typeof window.afficherToast === 'function') window.afficherToast('Véhicule introuvable', 'error'); return; }
    ensureDrawer();
    const content = document.getElementById('s20-drawer-content');
    const title = document.getElementById('s20-drawer-title');
    if (title) title.textContent = `${veh.immat}`;
    if (content) content.innerHTML = renderFicheVehicule(veh);
    document.getElementById('s20-drawer').classList.add('open');
    document.getElementById('s20-drawer-overlay').classList.add('open');
    if (window.resolveStorageImages && content) window.resolveStorageImages(content);
  };

  function renderFicheVehicule(veh) {
    const salaries = loadJSON('salaries');
    const sal = veh.salId ? salaries.find(s => s.id === veh.salId) : null;
    const carburants = loadJSON('carburant').filter(c => c.vehId === veh.id);
    const entretiens = loadJSON('entretiens').filter(e => e.vehId === veh.id);
    const inspections = loadJSON('inspections').filter(i => i.vehId === veh.id);
    const livraisons = loadJSON('livraisons').filter(l => l.vehId === veh.id);
    const alertes = loadJSON('alertes_admin').filter(a => a.vehId === veh.id && !a.traitee);

    // KPIs
    const now = Date.now();
    const J30 = 30 * 86400000;
    const carb30 = carburants.filter(c => c.date && (now - new Date(c.date).getTime()) < J30);
    const totalCarb30 = carb30.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const liv30 = livraisons.filter(l => l.date && (now - new Date(l.date).getTime()) < J30);

    let pilotage = null, kmActuel = parseFloat(veh.km) || 0;
    try {
      if (typeof window.getPilotageEntretienVehicule === 'function') {
        pilotage = window.getPilotageEntretienVehicule(veh);
        if (pilotage) kmActuel = pilotage.kmActuel || kmActuel;
      }
    } catch (e) {
      if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
        console.warn('[script:renderFicheVehicule-pilotage]', e);
      }
      if (window.Sentry && window.Sentry.captureException) {
        try { window.Sentry.captureException(e); } catch (_) {}
      }
    }

    // Conso réelle
    let consoReelle = null;
    const kmVals = carb30.map(c => parseFloat(c.kmCompteur)).filter(k => !isNaN(k) && k > 0);
    if (kmVals.length >= 2) {
      const delta = Math.max(...kmVals) - Math.min(...kmVals);
      const totalL = carb30.reduce((s, c) => s + (parseFloat(c.litres) || 0), 0);
      if (delta > 100) consoReelle = (totalL / delta) * 100;
    }

    // CT statut
    let ctStatus = 'ok', ctLabel = 'OK';
    if (veh.dateCT) {
      const jours = Math.floor((new Date(veh.dateCT).getTime() - now) / 86400000);
      if (jours < 0) { ctStatus = 'ko'; ctLabel = `Expiré ${Math.abs(jours)}j`; }
      else if (jours <= 30) { ctStatus = 'warn'; ctLabel = `J-${jours}`; }
      else ctLabel = `J+${jours}`;
    } else { ctStatus = 'warn'; ctLabel = 'Non renseigné'; }

    const initial = (veh.modele || veh.immat || '?').trim().charAt(0).toUpperCase();

    return `
      <div class="s20-fiche-id">
        <div class="s20-fiche-avatar s21-fiche-avatar">${esc(initial)}</div>
        <div>
          <div class="s20-fiche-nom">${esc(veh.immat)} <span style="font-weight:400;color:var(--text-muted);font-size:.88rem">· ${esc(veh.modele || '')}</span></div>
          <div class="s20-fiche-meta">${Math.round(kmActuel).toLocaleString('fr-FR')} km · ${esc(veh.modeAcquisition || 'achat')}${veh.dateAcquisition ? ' depuis ' + fmtDate(veh.dateAcquisition) : ''}</div>
          ${sal
            ? `<div class="s20-fiche-veh">Affecté à <button type="button" class="s20-btn-360" onclick="window.ouvrirFiche360Salarie('${esc(sal.id)}')">${esc(sal.nom)}</button></div>`
            : '<div class="s20-fiche-veh muted">Aucun chauffeur affecté</div>'}
        </div>
        <div class="s20-fiche-badges">
          ${alertes.length ? `<span class="s20-badge-alert">⚠️ ${alertes.length} alerte${alertes.length > 1 ? 's' : ''}</span>` : '<span class="badge badge-dispo">✅ OK</span>'}
        </div>
      </div>

      <div class="s20-kpi-row">
        <div class="s20-kpi ${ctStatus === 'ko' ? 's20-kpi-alert' : ''}"><div class="s20-kpi-val" style="font-size:.95rem">${esc(ctLabel)}</div><div class="s20-kpi-lbl">Contrôle tech.</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${liv30.length}</div><div class="s20-kpi-lbl">Livr. 30j</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${Math.round(totalCarb30)} €</div><div class="s20-kpi-lbl">Carb. 30j</div></div>
        <div class="s20-kpi ${consoReelle && veh.conso && consoReelle > parseFloat(veh.conso) * 1.3 ? 's20-kpi-alert' : ''}">
          <div class="s20-kpi-val">${consoReelle !== null ? consoReelle.toFixed(1) + ' L' : '—'}</div>
          <div class="s20-kpi-lbl">Conso 30j</div>
        </div>
      </div>

      <div class="s20-tabs">
        <button class="s20-tab active" data-tab="specs" onclick="window.s20SwitchTab && window.s20SwitchTab('specs')">Specs</button>
        <button class="s20-tab" data-tab="entretiens" onclick="window.s20SwitchTab && window.s20SwitchTab('entretiens')">Entretiens (${entretiens.length})</button>
        <button class="s20-tab" data-tab="carburant" onclick="window.s20SwitchTab && window.s20SwitchTab('carburant')">⛽ Carburant (${carburants.length})</button>
        <button class="s20-tab" data-tab="inspections" onclick="window.s20SwitchTab && window.s20SwitchTab('inspections')">Inspections (${inspections.length})</button>
        <button class="s20-tab" data-tab="livraisons" onclick="window.s20SwitchTab && window.s20SwitchTab('livraisons')">Livraisons (${livraisons.length})</button>
      </div>

      <div class="s20-tab-content" id="s20-tab-specs">${renderSpecs(veh, pilotage)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-entretiens">${renderEntretiens(entretiens, pilotage)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-carburant">${renderCarburant(carburants, veh, consoReelle)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-inspections">${renderInspections(inspections)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-livraisons">${renderLivraisonsVeh(livraisons)}</div>

      <div class="s20-fiche-actions">
        <button class="btn-secondary" onclick="window.s21GoToCarburant('${esc(veh.id)}')"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 14h14"/><path d="M17 9l4 4v6a2 2 0 0 1-2 2"/></svg>Carburant</button>
        <button class="btn-secondary" onclick="window.s21GoToEntretiens('${esc(veh.id)}')">Entretiens</button>
        <button class="btn-primary" onclick="window.s21GoToEdit('${esc(veh.id)}')"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Modifier</button>
      </div>`;
  }

  function renderSpecs(veh, pilotage) {
    const specs = [
      ['Immatriculation', esc(veh.immat || '—')],
      ['Modèle', esc(veh.modele || '—')],
      ['Kilométrage actuel', (parseFloat((pilotage && pilotage.kmActuel) || veh.km) || 0).toLocaleString('fr-FR') + ' km'],
      ['Km initial', (parseFloat(veh.kmInitial) || 0).toLocaleString('fr-FR') + ' km'],
      ['Conso théorique', veh.conso ? parseFloat(veh.conso).toFixed(1) + ' L/100' : 'Non définie'],
      ['Contrôle technique', veh.dateCT ? fmtDate(veh.dateCT) : 'Non renseigné'],
      ['Mode d’acquisition', esc(veh.modeAcquisition || 'achat')],
      ['Date d’acquisition', veh.dateAcquisition ? fmtDate(veh.dateAcquisition) : '—'],
      ['Intervalle entretien', veh.entretienIntervalKm ? veh.entretienIntervalKm + ' km' : '—'],
      ['TVA carburant déductible', (veh.tvaCarbDeductible || 80) + ' %']
    ];
    const html = specs.map(([l, v]) => `<div class="s21-spec"><div class="s21-spec-lbl">${l}</div><div class="s21-spec-val">${v}</div></div>`).join('');

    let pilotageHtml = '';
    if (pilotage) {
      if (pilotage.estEnRetard) pilotageHtml = `<div class="s20-conf-row s20-conf-ko"><span>Entretien</span><span>❌ En retard</span></div>`;
      else if (pilotage.estProche) {
        const detail = pilotage.kmRestants !== null && pilotage.kmRestants > 0
          ? `reste ${Math.round(pilotage.kmRestants)} km`
          : (pilotage.dateEcheance ? 'échéance ' + fmtDate(pilotage.dateEcheance) : '');
        pilotageHtml = `<div class="s20-conf-row s20-conf-warn"><span>Entretien</span><span>⚠️ ${detail}</span></div>`;
      } else pilotageHtml = `<div class="s20-conf-row s20-conf-ok"><span>Entretien</span><span>✅ À jour</span></div>`;
    }

    return `<div class="s21-spec-grid">${html}</div>${pilotageHtml ? '<div class="s20-conf-list">' + pilotageHtml + '</div>' : ''}`;
  }

  function renderEntretiens(entretiens, pilotage) {
    if (!entretiens.length) return '<div class="s20-empty">Aucun entretien enregistré</div>';
    const sorted = [...entretiens].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const prochain = pilotage && pilotage.prochainKm
      ? `<div class="s21-link-card" style="border-left:3px solid ${pilotage.estEnRetard ? '#ef4444' : (pilotage.estProche ? '#f59e0b' : '#10b981')}">
          <div class="s21-link-card-body">
            <div class="s21-link-card-lbl">Prochain entretien</div>
            <div class="s21-link-card-val">${pilotage.prochainKm.toLocaleString('fr-FR')} km${pilotage.dateEcheance ? ' · ' + fmtDate(pilotage.dateEcheance) : ''}</div>
          </div>
          <div style="font-size:.82rem;color:var(--text-muted)">${pilotage.kmRestants !== null && pilotage.kmRestants > 0 ? 'reste ' + Math.round(pilotage.kmRestants) + ' km' : (pilotage.estEnRetard ? 'En retard' : 'À jour')}</div>
        </div>` : '';
    return prochain + `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Km</th><th style="text-align:right">TTC</th></tr></thead>
      <tbody>${sorted.slice(0, 20).map(e => `<tr>
        <td>${esc(e.date || '')}</td>
        <td>${esc(e.type || '—')}</td>
        <td>${esc((e.description || '').slice(0, 60))}</td>
        <td style="text-align:right">${parseInt(e.km || 0, 10).toLocaleString('fr-FR')}</td>
        <td style="text-align:right">${euro(e.ttc || 0)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderCarburant(carburants, veh, consoReelle) {
    if (!carburants.length) return '<div class="s20-empty">Aucun plein enregistré</div>';
    const sorted = [...carburants].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 25);

    let consoBar = '';
    if (consoReelle !== null && veh.conso && parseFloat(veh.conso) > 0) {
      const ratio = consoReelle / parseFloat(veh.conso);
      const pct = Math.min(ratio * 100 / 1.5, 100);
      const cl = ratio > 1.3 ? 's21-conso-ko' : (ratio > 1.1 ? 's21-conso-warn' : 's21-conso-ok');
      consoBar = `
        <div class="s21-link-card">
          <div class="s21-link-card-body">
            <div class="s21-link-card-lbl">Conso réelle vs théorique (30j)</div>
            <div class="s21-link-card-val">${consoReelle.toFixed(1)} L / 100 <span style="color:var(--text-muted);font-weight:400">(théo ${parseFloat(veh.conso).toFixed(1)})</span></div>
            <div class="s21-conso-bar"><div class="s21-conso-fill ${cl}" style="transform:scaleX(${(pct/100).toFixed(3)})"></div></div>
          </div>
        </div>`;
    }

    return consoBar + `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Type</th><th style="text-align:right">L</th><th style="text-align:right">€/L</th><th style="text-align:right">Total</th><th style="text-align:right">Km</th></tr></thead>
      <tbody>${sorted.map(c => `<tr>
        <td>${esc(c.date || '')}</td>
        <td>${esc(c.typeCarburant || c.type || '—')}</td>
        <td style="text-align:right">${(parseFloat(c.litres) || 0).toFixed(1)}</td>
        <td style="text-align:right">${(parseFloat(c.prixLitre || c.prix) || 0).toFixed(3)}</td>
        <td style="text-align:right">${euro(c.total || 0)}</td>
        <td style="text-align:right">${c.kmCompteur ? parseInt(c.kmCompteur, 10).toLocaleString('fr-FR') : '—'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderInspections(inspections) {
    if (!inspections.length) return '<div class="s20-empty">Aucune inspection</div>';
    const sorted = [...inspections].sort((a, b) => new Date(b.creeLe || b.date || 0) - new Date(a.creeLe || a.date || 0)).slice(0, 8);
    return sorted.map(i => {
      const photos = (typeof window.getInspectionPhotoList === 'function') ? window.getInspectionPhotoList(i) : (i.photos || []);
      // Bucket inspections-photos prive : utiliser data-photo-path puis resolveStorageImages.
      const thumbDescriptor = (p) => {
        if (typeof window.getInspectionPhotoThumbDescriptorAdmin === 'function') {
          return window.getInspectionPhotoThumbDescriptorAdmin(p);
        }
        // Fallback minimal
        if (!p) return { src: '', path: '' };
        if (typeof p === 'string') return /^data:image\//.test(p) ? { src: p, path: '' } : { src: '', path: '' };
        if (p.thumbPath) return { src: '', path: p.thumbPath };
        if (p.path) return { src: '', path: p.path };
        return { src: '', path: '' };
      };
      return `<div class="s21-link-card" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <strong>${esc(i.salNom || '—')}</strong>
          <span style="font-size:.78rem;color:var(--text-muted)">${esc(i.date || '')}${i.km ? ' · ' + parseInt(i.km, 10).toLocaleString('fr-FR') + ' km' : ''}</span>
        </div>
        ${photos.length ? `<div class="s21-photo-grid">${photos.slice(0, 6).map((p, idx) => {
          const d = thumbDescriptor(p);
          const srcAttr = d.src ? `src="${esc(d.src)}"` : 'src="" alt="chargement..."';
          const dataAttrs = d.path ? `data-photo-path="${esc(d.path)}" data-photo-bucket="inspections-photos"` : '';
          return `<img ${srcAttr} ${dataAttrs} style="background:rgba(0,0,0,0.05)" onclick="window.voirPhotoAdmin && window.voirPhotoAdmin('${esc(i.id)}',${idx})" />`;
        }).join('')}</div>` : '<div style="color:var(--text-muted);font-size:.82rem">Aucune photo</div>'}
      </div>`;
    }).join('');
  }

  function renderLivraisonsVeh(livraisons) {
    if (!livraisons.length) return '<div class="s20-empty">Aucune livraison</div>';
    const sorted = [...livraisons].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20);
    return `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Client</th><th>Chauffeur</th><th>Statut</th><th style="text-align:right">HT</th></tr></thead>
      <tbody>${sorted.map(l => `<tr>
        <td>${esc(l.date || '')}</td>
        <td>${esc(l.client || '—')}</td>
        <td>${esc(l.chaufNom || '—')}</td>
        <td>${esc(l.statut || '—')}</td>
        <td style="text-align:right">${euro(l.prixHT || l.prix || 0)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- 3. Navigation raccourcis ---------- */
  window.s21GoToCarburant = function(vehId) {
    if (typeof window.fermerFiche360 === 'function') window.fermerFiche360();
    if (typeof window.naviguerVers === 'function') window.naviguerVers('carburant');
    setTimeout(() => {
      const sel = document.getElementById('filtre-carb-vehicule');
      if (sel) { sel.value = vehId; if (typeof window.afficherCarburant === 'function') window.afficherCarburant(); }
    }, 200);
  };

  window.s21GoToEntretiens = function(vehId) {
    if (typeof window.fermerFiche360 === 'function') window.fermerFiche360();
    if (typeof window.naviguerVers === 'function') window.naviguerVers('entretiens');
    setTimeout(() => {
      const sel = document.getElementById('filtre-entr-vehicule');
      if (sel) { sel.value = vehId; if (typeof window.afficherEntretiens === 'function') window.afficherEntretiens(); }
    }, 200);
  };

  window.s21GoToEdit = function(vehId) {
    if (typeof window.fermerFiche360 === 'function') window.fermerFiche360();
    if (typeof window.ouvrirEditVehicule === 'function') window.ouvrirEditVehicule(vehId);
    else if (typeof window.ouvrirFicheVehiculeDepuisTableau === 'function') window.ouvrirFicheVehiculeDepuisTableau(vehId);
  };

  /* ---------- 4. Hijack du clic immat dans tb-vehicules → 360° ---------- */
  function injecterBoutons360() {
    const tb = document.getElementById('tb-vehicules');
    if (!tb) return;
    tb.querySelectorAll('tr').forEach(tr => {
      if (tr.__s21Hooked) return;
      const btnOld = tr.querySelector('button.table-link-button[onclick*="ouvrirFicheVehiculeDepuisTableau"]');
      if (!btnOld) return;
      const m = btnOld.getAttribute('onclick').match(/ouvrirFicheVehiculeDepuisTableau\('([^']+)'\)/);
      if (!m) return;
      const vehId = m[1];
      btnOld.setAttribute('onclick', `window.ouvrirFiche360Vehicule('${vehId}')`);
      btnOld.setAttribute('title', 'Ouvrir la fiche 360°');
      const oldBtn = tr.querySelector('.s21-btn-360');
      if (oldBtn) oldBtn.remove();
      tr.__s21Hooked = true;
    });
  }

  function setupObservers() {
    const el = document.getElementById('tb-vehicules');
    if (!el || el.__s21Obs) return;
    const obs = new MutationObserver(() => setTimeout(injecterBoutons360, 40));
    obs.observe(el, { childList: true, subtree: true });
    el.__s21Obs = obs;
  }

  /* ---------- Init ---------- */
  function init() {
    try { genererAlertesParc(); } catch(e) { console.warn('S21 alertes parc:', e); }
    setTimeout(() => {
      injecterBoutons360();
      setupObservers();
    }, 700);
    setInterval(() => {
      try { genererAlertesParc(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:genererAlertesParc-cron]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }, 5 * 60 * 1000);
    // PERF: setInterval 3s retiré — setupObservers() via MutationObserver suffit
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1000);
})();
