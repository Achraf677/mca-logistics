/**
 * MCA Logistics — Sprint 25 — Drawer 360° Client/Fournisseur + règles alertes perso (Phase X — extraction script.js)
 *
 * Extracted from script.js L4924-5474 (2026-05-16).
 */

/* ==========================================================================
   Sprint 25 — Drawer 360° Client & Fournisseur + Règles d'alertes perso
   - ouvrirFiche360Client(id) / ouvrirFiche360Fournisseur(id)
   - Hijack clic sur nom dans tables → drawer 360°
   - 5 onglets : Vue, Factures/Commandes, Livraisons/Charges, Paiements, Historique
   - Règles alertes perso : UI Paramètres + évaluation dans cron S24
   ========================================================================== */
(function installS25(){
  if (window.__s25Installed) return;
  window.__s25Installed = true;

  const LS = {
    clients: 'clients', fournisseurs: 'fournisseurs', livraisons: 'livraisons',
    factures: 'factures_emises', avoirs: 'avoirs_emis', paiements: 'paiements',
    relances: 'relances_log', charges: 'charges', alertes: 'alertes_admin',
    rules: 's25_alert_rules',
  };
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
  const genId = () => 's25_' + (typeof window.genId === 'function' ? window.genId() : Date.now()+'_'+Math.random().toString(36).slice(2,8));
  const toast = (m,t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };

  function initials(nom) {
    return (nom||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('') || '?';
  }

  /* ---------- Drawer infrastructure ---------- */
  function ensureDrawer() {
    if (document.getElementById('s25-drawer')) return;
    const d = document.createElement('div');
    d.id = 's25-drawer-overlay'; d.className = 's25-drawer-overlay';
    d.innerHTML = '<div id="s25-drawer" class="s25-drawer"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) fermerDrawer(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && d.classList.contains('open')) fermerDrawer(); });
  }
  // Audit 2026-05-17 : tracker l'id ouvert pour rafraîchir le drawer après mutations
  // (facture émise, livraison ajoutée/modifiée, paiement, etc.).
  let _currentClientId = null;
  let _currentFournisseurId = null;
  function fermerDrawer() {
    const o = document.getElementById('s25-drawer-overlay'); if (o) o.classList.remove('open');
    _currentClientId = null;
    _currentFournisseurId = null;
  }
  window.s25FermerDrawer = fermerDrawer;
  // Refresh exposé pour callers externes (script-livraisons.js, assurerArchiveFactureLivraison...).
  window.refreshDrawerClient = function () {
    if (_currentClientId && typeof window.ouvrirFiche360Client === 'function') {
      try { window.ouvrirFiche360Client(_currentClientId); } catch (_) {}
    }
  };
  window.refreshDrawerFournisseur = function () {
    if (_currentFournisseurId && typeof window.ouvrirFiche360Fournisseur === 'function') {
      try { window.ouvrirFiche360Fournisseur(_currentFournisseurId); } catch (_) {}
    }
  };

  function renderDrawer(html) {
    ensureDrawer();
    const o = document.getElementById('s25-drawer-overlay');
    const d = document.getElementById('s25-drawer');
    d.innerHTML = html;
    o.classList.add('open');
  }

  /* ---------- Calculs Client ---------- */
  function factClient(c) {
    const livs = load(LS.livraisons);
    return load(LS.factures).filter(f => {
      if (f.statut === 'annulée') return false;
      if (f.clientId === c.id) return true;
      const liv = livs.find(l => l.id === f.livId);
      if (liv?.clientId === c.id) return true;
      const nom = (c.nom||'').trim().toLowerCase();
      return (f.client||'').trim().toLowerCase() === nom || (liv?.client||'').trim().toLowerCase() === nom;
    });
  }
  function livsClient(c) {
    return load(LS.livraisons).filter(l => {
      if (l.clientId === c.id) return true;
      return (l.client||'').trim().toLowerCase() === (c.nom||'').trim().toLowerCase();
    });
  }
  function paiementsClient(c) {
    const fs = factClient(c).map(f => f.id);
    return load(LS.paiements).filter(p => fs.includes(p.factureId));
  }
  function relancesClient(c) {
    const fs = factClient(c).map(f => f.id);
    return load(LS.relances).filter(r => fs.includes(r.factureId));
  }
  function soldeFact(f) {
    if (f.statut === 'annulée') return 0;
    const pays = load(LS.paiements).filter(p => p.factureId === f.id && (p.sens==='in'||!p.sens)).reduce((s,p)=>s+(parseFloat(p.montant)||0),0);
    const avs = load(LS.avoirs).filter(a => a.factureId === f.id).reduce((s,a)=>s+(parseFloat(a.montantTTC)||0),0);
    return Math.max(0, (parseFloat(f.montantTTC||f.totalTTC||0)||0) - pays - avs);
  }

  /* ---------- Fiche 360° Client ---------- */
  window.ouvrirFiche360Client = function(clientId) {
    const c = load(LS.clients).find(x => x.id === clientId);
    if (!c) { toast('Client introuvable', 'error'); return; }
    _currentClientId = clientId;
    _currentFournisseurId = null;
    const factures = factClient(c);
    const livs = livsClient(c);
    const paiements = paiementsClient(c);
    const relances = relancesClient(c);
    const totalFact = factures.reduce((s,f) => s + (parseFloat(f.montantTTC||f.totalTTC)||0), 0);
    const totalPaye = paiements.reduce((s,p) => s + (parseFloat(p.montant)||0), 0);
    const solde = factures.reduce((s,f) => s + soldeFact(f), 0);
    const ca12 = (() => {
      const il = new Date(); il.setMonth(il.getMonth()-12);
      return factures.filter(f => new Date(f.dateFacture||f.date||0) >= il).reduce((s,f) => s + (parseFloat(f.montantTTC||f.totalTTC)||0), 0);
    })();
    const retardJ = factures.filter(f => {
      if (soldeFact(f) <= 0.01) return false;
      const base = f.dateEcheance || f.dateLivraison || f.dateFacture;
      if (!base) return false;
      return new Date(base) < new Date();
    }).length;

    const tabs = [
      { k: 'vue', label: 'Vue d\'ensemble' },
      { k: 'fact', label: 'Factures ('+factures.length+')' },
      { k: 'livs', label: 'Livraisons ('+livs.length+')' },
      { k: 'pay', label: 'Paiements ('+paiements.length+')' },
      { k: 'com', label: 'Communications ('+relances.length+')' },
    ];

    const html = `
      <div class="s25-drawer-head">
        <button class="s25-close" onclick="window.s25FermerDrawer()" aria-label="Fermer">✕</button>
        <div class="s25-avatar">${esc(initials(c.nom))}</div>
        <div class="s25-head-body">
          <div class="s25-head-title">${esc(c.nom||'—')}</div>
          <div class="s25-head-meta">
            ${c.categorie ? '<span class="s25-badge">'+esc(c.categorie)+'</span>' : ''}
            ${c.email ? '<span>✉️ <a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a></span>' : ''}
            ${c.tel ? '<span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> '+esc(c.tel)+'</span>' : ''}
            ${c.siren ? '<span>SIREN '+esc(c.siren)+'</span>' : ''}
          </div>
        </div>
        <div class="s25-head-actions">
          <button class="btn-secondary" onclick="ouvrirEditClient('${c.id}');setTimeout(()=>window.s25FermerDrawer(),100)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Modifier</button>
        </div>
      </div>
      <div class="s25-kpi-row">
        <div class="s25-kpi"><div class="kpi-label">CA total</div><div class="kpi-val">${fmtEur(totalFact)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">CA 12 mois</div><div class="kpi-val">${fmtEur(ca12)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Encaissé</div><div class="kpi-val" style="color:#22c55e">${fmtEur(totalPaye)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Solde dû</div><div class="kpi-val" style="color:${solde>0?'#ef4444':'inherit'}">${fmtEur(solde)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Fact. en retard</div><div class="kpi-val" style="color:${retardJ>0?'#f97316':'inherit'}">${retardJ}</div></div>
      </div>
      <div class="s25-tabs">
        ${tabs.map(t => '<button class="s25-tab" data-tab="'+t.k+'">'+t.label+'</button>').join('')}
      </div>
      <div class="s25-tab-content">
        ${renderVueClient(c, factures, livs, paiements, relances)}
        ${renderFactTab(factures)}
        ${renderLivsTab(livs)}
        ${renderPayTab(paiements)}
        ${renderComTab(relances, c)}
      </div>`;
    renderDrawer(html);
    wireTabs();
  };

  function renderVueClient(c, factures, livs, paiements, relances) {
    const lastLiv = livs.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))[0];
    const lastFact = factures.sort((a,b) => new Date(b.dateFacture||0) - new Date(a.dateFacture||0))[0];
    const lastPay = paiements.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))[0];
    const lastRel = relances.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))[0];
    const delai = parseInt(c.delaiPaiementJours, 10) || 30;
    // Phase 91.28 — SVG stroke (DA site) inline-flex pour alignement vertical propre.
    const ICO_SVG_ATTR = 'viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7;vertical-align:middle" aria-hidden="true"';
    const icoLiv  = '<svg ' + ICO_SVG_ATTR + '><path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
    const icoFact = '<svg ' + ICO_SVG_ATTR + '><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>';
    const icoPay  = '<svg ' + ICO_SVG_ATTR + '><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/></svg>';
    const icoRel  = '<svg ' + ICO_SVG_ATTR + '><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    const icoInfo = '<svg ' + ICO_SVG_ATTR + '><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    // Items timeline en flex pour alignement vertical icône + texte
    const TL_ITEM_STYLE = 'display:flex;align-items:center;gap:8px';
    return `
      <div class="s25-tab-panel active" data-panel="vue">
        <div class="s25-section">
          <h4>Dernières interactions</h4>
          <div class="s25-timeline">
            ${lastLiv ? '<div class="s25-tl-item" style="'+TL_ITEM_STYLE+'">'+icoLiv+'<span><strong>Livraison</strong> '+esc(lastLiv.numero||'—')+' · '+fmtDate(lastLiv.date)+' · '+fmtEur(lastLiv.montant||lastLiv.totalHT||0)+'</span></div>' : ''}
            ${lastFact ? '<div class="s25-tl-item" style="'+TL_ITEM_STYLE+'">'+icoFact+'<span><strong>Facture</strong> '+esc(lastFact.numero||'—')+' · '+fmtDate(lastFact.dateFacture)+' · '+fmtEur(lastFact.montantTTC||lastFact.totalTTC||0)+'</span></div>' : ''}
            ${lastPay ? '<div class="s25-tl-item" style="'+TL_ITEM_STYLE+'">'+icoPay+'<span><strong>Paiement</strong> '+fmtDate(lastPay.date)+' · '+fmtEur(lastPay.montant||0)+' · '+esc(lastPay.mode||'—')+'</span></div>' : ''}
            ${lastRel ? '<div class="s25-tl-item" style="'+TL_ITEM_STYLE+'">'+icoRel+'<span><strong>Relance niv '+(lastRel.niveau||0)+'</strong> '+fmtDate(lastRel.date)+'</span></div>' : ''}
            ${!lastLiv && !lastFact && !lastPay && !lastRel ? '<div style="color:var(--text-muted);padding:12px;text-align:center">Aucune interaction</div>' : ''}
          </div>
        </div>
        ${(function(){
          // Phase 91.39 — Bug 14 : fallback adresse vers livraisons[0].destinataire si c.adresse vide
          const livRef = (livs && livs.length) ? livs.find(l => l && (l.destAdresse || (l.destinataire && l.destinataire.adresse))) : null;
          const dest = livRef ? (livRef.destinataire || {}) : {};
          const adrFallback = c.adresse || dest.adresse || livRef?.destAdresse || '';
          const cpFallback = c.codePostal || c.cp || dest.cp || livRef?.destCp || '';
          const villeFallback = c.ville || dest.ville || livRef?.destVille || '';
          return `
        <div class="s25-section">
          <h4 style="display:flex;align-items:center;gap:6px">${icoInfo}<span>Infos clés</span></h4>
          <div class="s25-infos">
            <div><span>Délai paiement</span><strong>${delai} jours</strong></div>
            <div><span>Adresse</span><strong>${esc(adrFallback||'—')}${(!c.adresse && adrFallback) ? ' <span style="opacity:.5;font-size:.72rem">(via livraison)</span>' : ''}</strong></div>
            <div><span>Code postal</span><strong>${esc(cpFallback||'—')} ${esc(villeFallback||'')}</strong></div>
            <div><span>Créé le</span><strong>${fmtDate(c.dateCreation)}</strong></div>`;
        })()}
          </div>
        </div>
      </div>`;
  }

  function renderFactTab(factures) {
    if (!factures.length) return '<div class="s25-tab-panel" data-panel="fact"><div class="s25-empty">Aucune facture</div></div>';
    const rows = factures.sort((a,b) => new Date(b.dateFacture||0) - new Date(a.dateFacture||0))
      .map(f => {
        const s = soldeFact(f);
        const pillCls = f.statut === 'payée' || s <= 0.01 ? 'pill-ok' : (s > 0 ? 'pill-due' : 'pill-neutral');
        return '<tr><td>'+fmtDate(f.dateFacture)+'</td><td><strong>'+esc(f.numero||'—')+'</strong></td><td>'+fmtEur(f.montantTTC||f.totalTTC||0)+'</td><td style="color:'+(s>0?'#ef4444':'inherit')+'">'+fmtEur(s)+'</td><td><span class="s25-pill '+pillCls+'">'+esc(f.statut||'—')+'</span></td></tr>';
      }).join('');
    return '<div class="s25-tab-panel" data-panel="fact"><table class="s25-table"><thead><tr><th>Date</th><th>N°</th><th>Total TTC</th><th>Solde dû</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderLivsTab(livs) {
    if (!livs.length) return '<div class="s25-tab-panel" data-panel="livs"><div class="s25-empty">Aucune livraison</div></div>';
    const rows = livs.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(l => '<tr><td>'+fmtDate(l.date)+'</td><td><strong>'+esc(l.numero||'—')+'</strong></td><td>'+fmtEur(l.montant||l.totalHT||0)+'</td><td>'+esc(l.statut||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="livs"><table class="s25-table"><thead><tr><th>Date</th><th>N°</th><th>Montant</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderPayTab(paiements) {
    if (!paiements.length) return '<div class="s25-tab-panel" data-panel="pay"><div class="s25-empty">Aucun paiement</div></div>';
    const rows = paiements.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(p => '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.factureNumero||p.factureId||'—')+'</td><td>'+fmtEur(p.montant||0)+'</td><td>'+esc(p.mode||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="pay"><table class="s25-table"><thead><tr><th>Date</th><th>Facture</th><th>Montant</th><th>Mode</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderComTab(relances, c) {
    if (!relances.length) return '<div class="s25-tab-panel" data-panel="com"><div class="s25-empty">Aucune relance envoyée</div></div>';
    const rows = relances.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(r => '<div class="s25-tl-item">📨 <strong>Niv '+(r.niveau||0)+'</strong> '+fmtDate(r.date)+(r.statut === 'envoyee' ? ' · ✉️ envoyée' : ' · 📝 brouillon')+(r.email ? '<div style="font-size:.82rem;color:var(--text-muted)">→ '+esc(r.email)+'</div>' : '')+'</div>').join('');
    return '<div class="s25-tab-panel" data-panel="com"><div class="s25-timeline">'+rows+'</div></div>';
  }

  /* ---------- Calculs Fournisseur ---------- */
  function chargesFourn(f) {
    return load(LS.charges).filter(c => c.fournisseurId === f.id || (c.fournisseur||'').trim().toLowerCase() === (f.nom||'').trim().toLowerCase());
  }
  function paiementsFourn(f) {
    const cs = chargesFourn(f).map(c => c.id);
    return load(LS.paiements).filter(p => cs.includes(p.chargeId) || (p.beneficiaire||'').trim().toLowerCase() === (f.nom||'').trim().toLowerCase() || p.sens === 'out');
  }

  /* ---------- Fiche 360° Fournisseur ---------- */
  window.ouvrirFiche360Fournisseur = function(fournId) {
    const f = load(LS.fournisseurs).find(x => x.id === fournId);
    if (!f) { toast('Fournisseur introuvable', 'error'); return; }
    _currentFournisseurId = fournId;
    _currentClientId = null;
    const charges = chargesFourn(f);
    const paiements = paiementsFourn(f).filter(p => {
      const cs = charges.map(c => c.id);
      return cs.includes(p.chargeId);
    });
    const totalDep = charges.reduce((s,c) => s + (parseFloat(c.montantTTC||c.montant)||0), 0);
    const totalPaye = paiements.reduce((s,p) => s + (parseFloat(p.montant)||0), 0);
    const solde = Math.max(0, totalDep - totalPaye);
    const dep12 = (() => {
      const il = new Date(); il.setMonth(il.getMonth()-12);
      return charges.filter(c => new Date(c.date||0) >= il).reduce((s,c) => s + (parseFloat(c.montantTTC||c.montant)||0), 0);
    })();

    const tabs = [
      { k: 'vue', label: 'Vue d\'ensemble' },
      { k: 'charges', label: 'Charges ('+charges.length+')' },
      { k: 'pay', label: 'Paiements ('+paiements.length+')' },
      { k: 'docs', label: 'Documents' },
    ];

    const html = `
      <div class="s25-drawer-head">
        <button class="s25-close" onclick="window.s25FermerDrawer()" aria-label="Fermer">✕</button>
        <div class="s25-avatar" style="background:rgba(230,57,70,0.18);color:#e63946">${esc(initials(f.nom))}</div>
        <div class="s25-head-body">
          <div class="s25-head-title">${esc(f.nom||'—')}</div>
          <div class="s25-head-meta">
            ${f.categorie ? '<span class="s25-badge">'+esc(f.categorie)+'</span>' : ''}
            ${f.email ? '<span>✉️ <a href="mailto:'+esc(f.email)+'">'+esc(f.email)+'</a></span>' : ''}
            ${f.tel ? '<span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> '+esc(f.tel)+'</span>' : ''}
            ${f.siren ? '<span>SIREN '+esc(f.siren)+'</span>' : ''}
          </div>
        </div>
      </div>
      <div class="s25-kpi-row">
        <div class="s25-kpi"><div class="kpi-label">Dépense totale</div><div class="kpi-val">${fmtEur(totalDep)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">12 derniers mois</div><div class="kpi-val">${fmtEur(dep12)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Payé</div><div class="kpi-val" style="color:#22c55e">${fmtEur(totalPaye)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Solde dû</div><div class="kpi-val" style="color:${solde>0?'#ef4444':'inherit'}">${fmtEur(solde)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Délai accordé</div><div class="kpi-val">${parseInt(f.delaiPaiementJours, 10)||30} j</div></div>
      </div>
      <div class="s25-tabs">
        ${tabs.map(t => '<button class="s25-tab" data-tab="'+t.k+'">'+t.label+'</button>').join('')}
      </div>
      <div class="s25-tab-content">
        <div class="s25-tab-panel active" data-panel="vue">
          <div class="s25-section"><h4>Dernières charges</h4>
            ${charges.slice(0,5).map(c => '<div class="s25-tl-item"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:.7"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h4"/></svg>'+fmtDate(c.date)+' · '+esc(c.description||c.categorie||'—')+' · '+fmtEur(c.montantTTC||c.montant||0)+'</div>').join('') || '<div class="s25-empty">Aucune charge enregistrée</div>'}
          </div>
          <div class="s25-section"><h4>ℹ️ Infos clés</h4>
            <div class="s25-infos">
              <div><span>Adresse</span><strong>${esc(f.adresse||'—')}</strong></div>
              <div><span>IBAN</span><strong>${esc(f.iban||'—')}</strong></div>
              <div><span>Créé le</span><strong>${fmtDate(f.dateCreation)}</strong></div>
            </div>
          </div>
        </div>
        ${renderChargesTab(charges)}
        ${renderPayTabF(paiements)}
        <div class="s25-tab-panel" data-panel="docs"><div class="s25-empty">Documents à venir (contrats, factures scannées)</div></div>
      </div>`;
    renderDrawer(html);
    wireTabs();
  };
  function renderChargesTab(charges) {
    if (!charges.length) return '<div class="s25-tab-panel" data-panel="charges"><div class="s25-empty">Aucune charge</div></div>';
    const rows = charges.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(c => '<tr><td>'+fmtDate(c.date)+'</td><td>'+esc(c.description||c.categorie||'—')+'</td><td>'+fmtEur(c.montantTTC||c.montant||0)+'</td><td>'+esc(c.statut||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="charges"><table class="s25-table"><thead><tr><th>Date</th><th>Libellé</th><th>Montant</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderPayTabF(paiements) {
    if (!paiements.length) return '<div class="s25-tab-panel" data-panel="pay"><div class="s25-empty">Aucun paiement</div></div>';
    const rows = paiements.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(p => '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.reference||p.chargeId||'—')+'</td><td>'+fmtEur(p.montant||0)+'</td><td>'+esc(p.mode||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="pay"><table class="s25-table"><thead><tr><th>Date</th><th>Réf</th><th>Montant</th><th>Mode</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }

  function wireTabs() {
    const drawer = document.getElementById('s25-drawer');
    if (!drawer) return;
    const tabs = drawer.querySelectorAll('.s25-tab');
    const panels = drawer.querySelectorAll('.s25-tab-panel');
    if (!tabs.length) return;
    tabs[0].classList.add('active');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        t.classList.add('active');
        const p = drawer.querySelector('.s25-tab-panel[data-panel="'+t.dataset.tab+'"]');
        if (p) p.classList.add('active');
      });
    });
  }

  /* ---------- Hijack tables : clic nom → drawer 360° ---------- */
  function injecterHijack() {
    const tbCli = document.getElementById('tb-clients');
    if (tbCli) {
      tbCli.querySelectorAll('tr').forEach(tr => {
        if (tr.__s25Hooked) return;
        const btn = tr.querySelector('button.btn-link-inline[onclick*="ouvrirHistoriqueClient"]');
        if (!btn) return;
        const m = btn.getAttribute('onclick').match(/ouvrirHistoriqueClient\('([^']+)'\)/);
        if (!m) return;
        btn.setAttribute('onclick', "window.ouvrirFiche360Client('"+m[1]+"')");
        btn.setAttribute('title', 'Ouvrir la fiche 360°');
        tr.__s25Hooked = true;
      });
    }
    const tbF = document.getElementById('tb-fournisseurs');
    if (tbF) {
      tbF.querySelectorAll('tr').forEach(tr => {
        if (tr.__s25Hooked) return;
        const btn = tr.querySelector('button.btn-link-inline[onclick*="ouvrirHistoriqueFournisseur"]');
        if (!btn) return;
        const m = btn.getAttribute('onclick').match(/ouvrirHistoriqueFournisseur\('([^']+)'\)/);
        if (!m) return;
        btn.setAttribute('onclick', "window.ouvrirFiche360Fournisseur('"+m[1]+"')");
        btn.setAttribute('title', 'Ouvrir la fiche 360°');
        tr.__s25Hooked = true;
      });
    }
  }

  /* ==========================================================================
     Règles d'alertes perso (S25 — volet B)
     Stockées dans localStorage 's25_alert_rules'
     Structure : { id, nom, actif, trigger:'facture|livraison|vehicule|salarie', condition:{field, op, value}, action:'alerte|toast', graviteOutput }
     Évaluées par s24CronTick toutes les 5 min
     ========================================================================== */
  const RULE_SCOPES = {
    facture: { key: LS.factures, label: 'Facture', fields: ['montantTTC','statut','dateFacture','dateEcheance','client'] },
    livraison: { key: LS.livraisons, label: 'Livraison', fields: ['montant','statut','date','client'] },
    charge: { key: LS.charges, label: 'Charge', fields: ['montantTTC','statut','date','fournisseur'] },
  };
  const OPS = {
    '>': (a,b) => parseFloat(a) > parseFloat(b),
    '>=': (a,b) => parseFloat(a) >= parseFloat(b),
    '<': (a,b) => parseFloat(a) < parseFloat(b),
    '<=': (a,b) => parseFloat(a) <= parseFloat(b),
    '==': (a,b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase(),
    '!=': (a,b) => String(a).trim().toLowerCase() !== String(b).trim().toLowerCase(),
    'contains': (a,b) => String(a||'').toLowerCase().includes(String(b||'').toLowerCase()),
    'jours_depuis': (a,b) => { if (!a) return false; return Math.floor((new Date() - new Date(a))/86400000) >= parseInt(b, 10); },
  };

  function evaluerRegles() {
    const rules = load(LS.rules).filter(r => r.actif);
    if (!rules.length) return;
    const alertes = load(LS.alertes);
    let modif = false;
    rules.forEach(rule => {
      const scope = RULE_SCOPES[rule.trigger];
      if (!scope) return;
      const items = load(scope.key);
      items.forEach(it => {
        const fn = OPS[rule.condition.op];
        if (!fn) return;
        const val = it[rule.condition.field];
        if (!fn(val, rule.condition.value)) return;
        const itemId = it.id || it.numero || JSON.stringify(it).slice(0,40);
        const exist = alertes.find(a => a.type === 'rule_'+rule.id && a.refId === itemId && !a.traitee);
        if (exist) return;
        alertes.push({
          id: 's25_rule_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
          type: 'rule_'+rule.id, refId: itemId,
          titre: '🔔 '+rule.nom,
          message: scope.label+' · '+(it.numero||it.nom||'—')+' · '+rule.condition.field+' '+rule.condition.op+' '+rule.condition.value+' (val: '+(val||'—')+')',
          gravite: rule.graviteOutput||'medium',
          traitee: false, dateCreation: new Date().toISOString(), auto: true, regleSource: rule.id
        });
        modif = true;
      });
    });
    if (modif) save(LS.alertes, alertes);
  }
  window.s25EvaluerRegles = evaluerRegles;

  /* ---------- UI Règles dans Paramètres ---------- */
  function injectRulesUI() {
    const pageParams = document.getElementById('page-parametres');
    if (!pageParams) return;
    if (pageParams.querySelector('#s25-rules-section')) return;
    const container = pageParams.querySelector('.settings-content') || pageParams;
    const section = document.createElement('div');
    section.id = 's25-rules-section'; section.className = 'settings-section';
    section.innerHTML = `
      <h2 style="margin-top:32px">Règles d'alertes personnalisées</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">Créez vos propres règles : quand une condition est vraie, une alerte est ajoutée au Centre d'alertes.</p>
      <div id="s25-rules-list"></div>
      <button class="btn-primary" onclick="window.s25NewRule()" style="margin-top:12px">+ Nouvelle règle</button>
    `;
    container.appendChild(section);
    renderRulesList();
  }
  function renderRulesList() {
    const list = document.getElementById('s25-rules-list');
    if (!list) return;
    const rules = load(LS.rules);
    if (!rules.length) { list.innerHTML = '<div style="padding:16px;color:var(--text-muted);text-align:center;border:1px dashed var(--border);border-radius:10px">Aucune règle pour le moment. Cliquez + Nouvelle règle</div>'; return; }
    list.innerHTML = rules.map(r => {
      const scope = RULE_SCOPES[r.trigger]?.label || r.trigger;
      return `<div class="s25-rule-card ${r.actif?'on':''}">
        <div class="s25-rule-head">
          <div><strong>${esc(r.nom)}</strong><div class="s25-rule-meta">${scope} · ${esc(r.condition.field)} ${esc(r.condition.op)} ${esc(r.condition.value)}</div></div>
          <div class="s25-rule-actions">
            <label class="s25-rule-toggle"><input type="checkbox" ${r.actif?'checked':''} onchange="window.s25ToggleRule('${r.id}',this.checked)"/><span class="s24-toggle-switch"></span></label>
            <button class="btn-icon" onclick="window.s25DelRule('${r.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  window.s25ToggleRule = function(id, val) {
    const rules = load(LS.rules);
    const r = rules.find(x => x.id === id); if (!r) return;
    r.actif = val; save(LS.rules, rules);
    toast(val ? '✅ Règle activée' : '⏸️ Règle désactivée', 'success');
    renderRulesList();
  };
  window.s25DelRule = async function(id) {
    const ok = await confirmDialog('Supprimer cette règle ?', { titre:'Supprimer la règle', icone:'🧩', btnLabel:'Supprimer' });
    if (!ok) return;
    save(LS.rules, load(LS.rules).filter(r => r.id !== id));
    toast('Règle supprimée', 'success');
    renderRulesList();
  };
  window.s25NewRule = function() {
    const scopes = Object.keys(RULE_SCOPES);
    const html = `<div>
      <h3 style="margin:0 0 14px">Nouvelle règle d'alerte</h3>
      <div class="form-group"><label>Nom de la règle</label><input type="text" id="s25-rule-nom" placeholder="ex. Facture > 5000€ en retard"/></div>
      <div class="form-group"><label>Déclencheur</label><select id="s25-rule-trigger">${scopes.map(k => '<option value="'+k+'">'+RULE_SCOPES[k].label+'</option>').join('')}</select></div>
      <div class="form-group"><label>Champ</label><select id="s25-rule-field"></select></div>
      <div class="form-group"><label>Opérateur</label><select id="s25-rule-op">${Object.keys(OPS).map(o => '<option value="'+o+'">'+o+'</option>').join('')}</select></div>
      <div class="form-group"><label>Valeur</label><input type="text" id="s25-rule-value" placeholder="ex. 5000 ou payée"/></div>
      <div class="form-group"><label>Gravité de l'alerte</label><select id="s25-rule-grav"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option></select></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button class="btn-secondary" onclick="window.closeModal && window.closeModal('modal-info');document.getElementById('s15-modal-info')?.classList.remove('open')">Annuler</button>
        <button class="btn-primary" onclick="window.s25SaveRule()">Créer</button>
      </div>
    </div>`;
    if (typeof window.modalInfo === 'function') {
      const m = window.modalInfo(html);
      const b = m?.querySelector?.('.s15-modal-info-box'); if (b) b.classList.add('narrow');
      setTimeout(() => {
        const trig = document.getElementById('s25-rule-trigger');
        const fld = document.getElementById('s25-rule-field');
        function refreshFields() {
          const sc = RULE_SCOPES[trig.value];
          fld.innerHTML = sc.fields.map(f => '<option value="'+f+'">'+f+'</option>').join('');
        }
        trig.addEventListener('change', refreshFields);
        refreshFields();
      }, 40);
    }
  };
  window.s25SaveRule = function() {
    const nom = document.getElementById('s25-rule-nom').value.trim();
    const trigger = document.getElementById('s25-rule-trigger').value;
    const field = document.getElementById('s25-rule-field').value;
    const op = document.getElementById('s25-rule-op').value;
    const value = document.getElementById('s25-rule-value').value.trim();
    const grav = document.getElementById('s25-rule-grav').value;
    if (!nom || !value) { toast('Nom et valeur requis', 'warning'); return; }
    const rules = load(LS.rules);
    rules.push({ id: genId(), nom, trigger, condition: { field, op, value }, graviteOutput: grav, actif: true, dateCreation: new Date().toISOString() });
    save(LS.rules, rules);
    document.getElementById('s15-modal-info')?.classList.remove('open');
    toast('✅ Règle créée et activée', 'success');
    renderRulesList();
  };

  /* ---------- Init ---------- */
  function init() {
    setTimeout(injecterHijack, 800);
    setInterval(injecterHijack, 3000);
    setTimeout(injectRulesUI, 900);
    setInterval(injectRulesUI, 4000);
    // Hook cron S24
    const origTick = window.s24CronTick;
    if (typeof origTick === 'function' && !origTick.__s25Hooked) {
      const wrapped = function() {
        try { origTick(); } catch (e) {
          if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
            console.warn('[script:s25-cronTick]', e);
          }
          if (window.Sentry && window.Sentry.captureException) {
            try { window.Sentry.captureException(e); } catch (_) {}
          }
        }
        try { evaluerRegles(); } catch (e) {
          if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
            console.warn('[script:s25-evaluerRegles]', e);
          }
          if (window.Sentry && window.Sentry.captureException) {
            try { window.Sentry.captureException(e); } catch (_) {}
          }
        }
      };
      wrapped.__s25Hooked = true;
      window.s24CronTick = wrapped;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1400);
})();
