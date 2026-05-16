/* ==========================================================================
   MCA Logistics — Drawer 360 Livraison (Phase 32)

   Click <tr> dans #tb-livraisons → ouvre le drawer slide-from-right avec :
   - Tabs : Détail / Documents / Paiement / Historique
   - Read-only view alignée mockup
   - Footer : Imprimer / Dupliquer / Modifier (ouvre modal edit existant)

   Click overlay / X / Escape → ferme.
   ========================================================================== */

(function () {
  'use strict';

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function fmt0(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Math.round(Number(n)).toLocaleString('fr-FR');
  }

  function fmtEur(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Math.round(Number(n)).toLocaleString('fr-FR') + ' €';
  }

  function fmtEur2(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toFixed(2).replace('.', ',') + ' €';
  }

  function fmtDateFr(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    } catch (_) { return '—'; }
  }

  function getLiv(idOrEl) {
    if (!idOrEl) return null;
    let id = idOrEl;
    if (typeof idOrEl !== 'string') {
      id = idOrEl.dataset && (idOrEl.dataset.id || idOrEl.dataset.livraisonId);
    }
    if (id && typeof window.charger === 'function') {
      const livs = window.charger('livraisons') || [];
      return livs.find(l => l.id === id);
    }
    return null;
  }

  function statutBadge(statut, isPaiement) {
    const s = String(statut || '').toLowerCase();
    if (s === 'livre' || s === 'livré' || s === 'livree') return '<span class="dr-badge ok">Livrée</span>';
    if (s === 'paye' || s === 'payé') return '<span class="dr-badge ok">Payée</span>';
    if (s === 'en-cours' || s === 'en cours') return '<span class="dr-badge info">En cours</span>';
    if (s === 'en-attente' || s === 'en attente') return '<span class="dr-badge warn">' + (isPaiement ? 'À payer' : 'En attente') + '</span>';
    if (s === 'retard') return '<span class="dr-badge alert">Retard</span>';
    if (s === 'brouillon') return '<span class="dr-badge muted">Brouillon</span>';
    if (s === 'litige') return '<span class="dr-badge alert">Litige</span>';
    return '<span class="dr-badge muted">' + escHtml(statut || '—') + '</span>';
  }

  function renderDetailPanel(liv) {
    if (!liv) return '<div class="dr-row"><div class="dr-key">—</div><div class="dr-val">Aucune donnée</div></div>';
    const ca = window.charger ? (window.charger('clients') || []) : [];
    const clientObj = ca.find(c => c.id === liv.clientId);
    const siren = clientObj && (clientObj.siren || clientObj.SIREN) ? clientObj.siren : null;
    const distance = liv.distance || liv.distance_km;
    const ht = Number(liv.ht || liv.prix_ht || liv.prixHT || 0);
    const tva = Number(liv.tva || liv.tva_montant || (ht * 0.2));
    const ttc = Number(liv.ttc || liv.prix_ttc || liv.prixTTC || (ht + tva));
    const marge = Math.round((ht - ht * 0.4) * 100) / 100; // heuristique 60% marge
    return ''
      + row('Client', escHtml(liv.client || '—') + (siren ? ' <span class="muted">· SIREN ' + escHtml(siren) + '</span>' : ''))
      + row('Trajet', escHtml(liv.depart || '—') + ' → ' + escHtml(liv.arrivee || '—'))
      + (distance ? row('Distance', escHtml(distance) + ' km') : '')
      + row('Chauffeur', escHtml(liv.chaufNom || '—'))
      + row('Véhicule', escHtml(liv.vehImmat || liv.vehImmat || '—'))
      + row('Statut', statutBadge(liv.statut))
      + row('Date livraison', fmtDateFr(liv.date || liv.date_livraison || liv.dateLivraison))
      + row('Montant HT', fmtEur2(ht))
      + row('TVA (20%)', fmtEur2(tva))
      + '<div class="dr-row"><div class="dr-key">Total TTC</div><div class="dr-val amount-strong">' + fmtEur2(ttc) + '</div></div>';
      // Phase 91.3 — ligne "Marge brute (est.)" retirée (user feedback : info non pertinente dans le drawer).
  }

  function row(key, valHtml) {
    return '<div class="dr-row"><div class="dr-key">' + escHtml(key) + '</div><div class="dr-val">' + valHtml + '</div></div>';
  }

  // Documents store : localStorage 'documents_livraison_<id>' = array of doc records
  function getLivDocuments(livId) {
    try {
      const raw = localStorage.getItem('documents_livraison_' + livId);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveLivDocument(livId, doc) {
    if (!livId || !doc) {
      console.warn('[saveLivDocument] APPEL INVALIDE — livId:', livId, 'doc:', doc);
      return;
    }
    const key = 'documents_livraison_' + livId;
    try {
      const docs = getLivDocuments(livId);
      const existing = docs.findIndex(d => d.type === doc.type);
      if (existing >= 0) {
        docs[existing] = Object.assign({}, docs[existing], doc, { updatedAt: new Date().toISOString() });
      } else {
        docs.push(Object.assign({ id: 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), createdAt: new Date().toISOString() }, doc));
      }
      const json = JSON.stringify(docs);
      localStorage.setItem(key, json);
      // Phase 91.25 — vérification écriture immédiate (read-after-write) pour détecter QuotaExceeded silencieux
      const verify = localStorage.getItem(key);
      if (verify !== json) {
        console.error('[saveLivDocument] ÉCHEC ÉCRITURE — read-after-write mismatch sur', key);
      } else {
        console.log('[saveLivDocument] ✓', key, '—', docs.length, 'doc(s), ' + Math.round(json.length / 1024) + ' KB');
      }
    } catch (e) {
      // QuotaExceededError = HTML trop gros → on retry SANS html
      if (doc.html) {
        console.warn('[saveLivDocument] retry SANS html (probable quota):', e && e.message);
        const lite = Object.assign({}, doc); delete lite.html;
        try { saveLivDocument(livId, lite); return; } catch (_) {}
      }
      console.error('[saveLivDocument] FAILED', e);
    }
  }
  // Expose globalement pour que les generateurs legacy puissent l'appeler
  window.enregistrerDocumentLivraison = saveLivDocument;

  function renderDocumentsPanel(liv) {
    if (!liv) return '<div class="dr-section-label">Aucun document</div>';
    const numLiv = liv.numLiv || liv.num_liv || '—';
    const ttc = Number(liv.ttc || liv.prix_ttc || liv.prixTTC || 0);
    const docs = getLivDocuments(liv.id);

    // Map type → icon + default name
    const typeMap = {
      facture: { icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>',
                 label: 'Facture', defaultName: numLiv.replace(/^L-/, 'F-') },
      bl:      { icon: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>',
                 label: 'Bon de livraison', defaultName: numLiv.replace(/^L-/, 'BL-') },
      cmr:     { icon: '<svg viewBox="0 0 24 24"><path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
                 label: 'Lettre de voiture CMR', defaultName: 'CMR ' + numLiv },
      autre:   { icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
                 label: 'Document', defaultName: '' },
    };

    let html = '';
    if (docs.length === 0) {
      // Phase 91.12 — empty state simplifié (retire la 2e phrase qui pointait vers toolbar).
      html = '<div class="dr-section-label">Aucun document généré</div>'
        + '<div style="padding:24px 16px;text-align:center;color:var(--ds-text-muted,var(--text-muted));font-size:12.5px;line-height:1.5;border:1px dashed var(--ds-border,var(--border));border-radius:8px;margin-bottom:16px">'
        +   'Aucun document n\'a encore été généré pour cette livraison.'
        + '</div>';
    } else {
      html = '<div class="dr-section-label">Documents générés (' + docs.length + ')</div>';
      // Sort by createdAt desc (most recent first)
      docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      docs.forEach(d => {
        const t = typeMap[d.type] || typeMap.autre;
        const name = d.name || t.defaultName || t.label;
        const subParts = [];
        if (d.createdAt) {
          try {
            subParts.push('Généré le ' + fmtDateFr(d.createdAt));
          } catch {}
        }
        if (d.size) subParts.push(d.size);
        if (d.type === 'facture' && ttc > 0) subParts.push(fmtEur2(ttc) + ' TTC');
        const sub = subParts.join(' · ') || (d.sub || 'Document');
        html += ''
          + '<div class="dr-doc-item">'
          +   '<div class="dr-doc-icon">' + t.icon + '</div>'
          +   '<div class="dr-doc-info">'
          +     '<div class="dr-doc-name">' + escHtml(name) + '</div>'
          +     '<div class="dr-doc-sub">' + escHtml(sub) + '</div>'
          +   '</div>'
          +   '<button class="dr-doc-btn" type="button" onclick="window.voirDocumentLivraison && window.voirDocumentLivraison(\'' + liv.id + '\',\'' + d.id + '\')">Voir</button>'
          + '</div>';
      });
    }

    // Phase 91.13 — dropdown Générer DÉDIÉ au drawer, ouvre EN DESSOUS, icônes SVG stroke (DA site, pas emojis).
    var _itemStyle = 'display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;background:transparent;border:none;border-radius:7px;color:var(--ds-text,var(--text));text-align:left;cursor:pointer;font-family:inherit;font-size:13px';
    var _svgStyle = 'flex-shrink:0;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round';
    var _icFacture = '<svg viewBox="0 0 24 24" width="14" height="14" style="' + _svgStyle + '" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>';
    var _icBL = '<svg viewBox="0 0 24 24" width="14" height="14" style="' + _svgStyle + '" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>';
    var _icCMR = '<svg viewBox="0 0 24 24" width="14" height="14" style="' + _svgStyle + '" aria-hidden="true"><path d="M5 18H3v-6.6c0-.4.1-.7.3-1L7 5h10l3.7 5.4c.2.3.3.6.3 1V18h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
    html += ''
      + '<div class="dr-gen-wrap" style="position:relative;margin-top:14px">'
      +   '<button class="dr-doc-btn" type="button" id="dr-liv-gen-trigger" style="width:100%;padding:10px 14px;justify-content:center" onclick="(function(b){var m=document.getElementById(\'dr-liv-gen-menu\');if(m){var open=m.style.display!==\'block\';m.style.display=open?\'block\':\'none\';b.setAttribute(\'aria-expanded\',String(open));}})(this)" aria-expanded="false" aria-controls="dr-liv-gen-menu">+ Générer un nouveau document</button>'
      +   '<div class="dr-gen-menu" id="dr-liv-gen-menu" role="menu" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);background:var(--ds-bg-card,var(--bg-card));border:1px solid var(--ds-border,var(--border));border-radius:10px;padding:6px;box-shadow:0 16px 40px -8px rgba(0,0,0,0.5);z-index:50">'
      +     '<button type="button" class="dr-gen-item" style="' + _itemStyle + '" onclick="document.getElementById(\'dr-liv-gen-menu\').style.display=\'none\';if(window.actionGenererLivraisonPour)window.actionGenererLivraisonPour(\'facture\',\'' + liv.id + '\');">' + _icFacture + 'Facture</button>'
      +     '<button type="button" class="dr-gen-item" style="' + _itemStyle + '" onclick="document.getElementById(\'dr-liv-gen-menu\').style.display=\'none\';if(window.actionGenererLivraisonPour)window.actionGenererLivraisonPour(\'bl\',\'' + liv.id + '\');">' + _icBL + 'Bon de livraison</button>'
      +     '<button type="button" class="dr-gen-item" style="' + _itemStyle + '" onclick="document.getElementById(\'dr-liv-gen-menu\').style.display=\'none\';if(window.actionGenererLivraisonPour)window.actionGenererLivraisonPour(\'cmr\',\'' + liv.id + '\');">' + _icCMR + 'Lettre de voiture</button>'
      +   '</div>'
      + '</div>';

    return html;
  }

  window.voirDocumentLivraison = function (livId, docId) {
    const docs = getLivDocuments(livId);
    const doc = docs.find(d => d.id === docId);
    if (!doc) { alert('Document introuvable'); return; }
    if (doc.url) { window.open(doc.url, '_blank'); return; }
    if (doc.blob) { window.open(URL.createObjectURL(doc.blob), '_blank'); return; }
    // Phase 91.22 — HTML capturé lors de la 1ère génération → blob URL (no re-trigger du générateur).
    if (doc.html) {
      try {
        const full = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + (doc.name || 'Document') + '</title><style>html,body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif}body{padding:20px}@page{margin:12mm}</style></head><body>' + doc.html + '</body></html>';
        const url = URL.createObjectURL(new Blob([full], { type: 'text/html;charset=utf-8' }));
        window.open(url, '_blank');
        setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, 60000);
        return;
      } catch (e) { console.warn('[voirDocumentLivraison:html]', e); }
    }
    // Fallback : régénère via le générateur (peut throw → toast)
    try {
      if (doc.type === 'facture' && typeof window.genererFactureLivraison === 'function') window.genererFactureLivraison(livId);
      else if (doc.type === 'bl' && (typeof window.genererBonsLivraison === 'function' || typeof window.genererBonLivraison === 'function')) (window.genererBonsLivraison || window.genererBonLivraison)(livId);
      else if (doc.type === 'cmr' && (typeof window.genererLettreDeVoiture === 'function' || typeof window.genererLettreVoiture === 'function')) (window.genererLettreDeVoiture || window.genererLettreVoiture)(livId);
      else alert('Document ' + (doc.name || doc.type) + ' — type non géré.');
    } catch (e) {
      console.warn('[voirDocumentLivraison]', e);
      alert('Erreur lors de la régénération du document.');
    }
  };

  function renderPaiementPanel(liv) {
    if (!liv) return '<div class="dr-row"><div class="dr-key">—</div><div class="dr-val">Aucune donnée</div></div>';
    const paiements = window.charger ? (window.charger('paiements') || []) : [];
    const paie = paiements.find(p => p.livraisonId === liv.id || p.livraison_id === liv.id);
    const statut = paie ? 'paye' : (liv.statutPaiement || liv.statut_paiement || 'en-attente');
    const datePaie = paie ? (paie.date || paie.date_paiement) : (liv.datePaiement || liv.date_paiement);
    return ''
      + row('Statut paiement', statutBadge(statut, true) + (datePaie ? ' · ' + fmtDateFr(datePaie) : ''))
      + row('Mode', escHtml(paie && paie.moyen ? paie.moyen : '—'))
      + row('Référence', paie && paie.reference ? '<span class="mono">' + escHtml(paie.reference) + '</span>' : '<span class="muted">Non rapproché</span>')
      + row('Montant', paie ? fmtEur2(paie.montant) : '<span class="muted">—</span>')
      + row('Rapproché Qonto', paie ? '<span class="dr-badge ok">Auto · score 0.94</span>' : '<span class="muted">Non rapproché</span>');
  }

  function renderHistoriquePanel(liv) {
    if (!liv) return '<div class="muted">Aucun historique</div>';
    const events = [];
    if (liv.creeLe || liv.cree_le) {
      events.push({ dotClass: 'muted', date: fmtDateFr(liv.creeLe || liv.cree_le), label: 'Créée' });
    }
    if (liv.date || liv.date_livraison) {
      events.push({ dotClass: 'info', date: fmtDateFr(liv.date || liv.date_livraison), label: 'Programmée' });
    }
    const s = String(liv.statut || '').toLowerCase();
    if (s === 'en-cours' || s === 'en cours') {
      events.push({ dotClass: 'info', date: fmtDateFr(liv.date || liv.date_livraison), label: 'En cours de livraison' });
    }
    if (s === 'livre' || s === 'livré') {
      events.push({ dotClass: 'ok', date: fmtDateFr(liv.date || liv.date_livraison), label: 'Livraison validée par client' });
    }
    if (s === 'retard') {
      events.push({ dotClass: 'alert', date: fmtDateFr(liv.date || liv.date_livraison), label: 'En retard de livraison' });
    }
    const sp = String(liv.statutPaiement || liv.statut_paiement || '').toLowerCase();
    if (sp === 'paye' || sp === 'payé') {
      const dp = liv.datePaiement || liv.date_paiement;
      events.push({ dotClass: 'ok', date: fmtDateFr(dp), label: 'Paiement reçu' });
    }
    // Sort par date desc (plus recent en premier)
    events.sort((a, b) => {
      const da = a.date.split('/').reverse().join('');
      const db = b.date.split('/').reverse().join('');
      return db.localeCompare(da);
    });
    if (!events.length) return '<div class="muted">Aucun événement enregistré</div>';
    return '<div class="dr-timeline">'
      + events.map(e =>
          '<div class="dr-timeline-item">'
        +   '<div class="dr-timeline-dot ' + e.dotClass + '"></div>'
        +   '<div class="dr-timeline-date">' + escHtml(e.date) + '</div>'
        +   '<div class="dr-timeline-label">' + escHtml(e.label) + '</div>'
        + '</div>'
      ).join('')
      + '</div>';
  }

  // ============ Open / Close drawer ============
  let currentLivId = null;

  window.ouvrirDrawerLivraison = function (livraisonId) {
    const liv = getLiv(livraisonId);
    if (!liv) {
      console.warn('[drawer-livraison] livraison introuvable id=' + livraisonId);
      return;
    }
    currentLivId = liv.id;

    // Title + sub
    const numLiv = liv.numLiv || liv.num_liv || '—';
    const titleEl = document.getElementById('dr-liv-title');
    const subEl = document.getElementById('dr-liv-sub');
    if (titleEl) titleEl.textContent = numLiv + ' · ' + (liv.client || '—');
    if (subEl) {
      const statutTxt = String(liv.statut || '').toLowerCase() === 'livre' ? 'Livrée' : (liv.statut || 'En attente');
      const dateTxt = fmtDateFr(liv.date || liv.date_livraison || liv.dateLivraison);
      const ttc = liv.ttc || liv.prix_ttc || liv.prixTTC || liv.ht || 0;
      subEl.textContent = statutTxt + ' le ' + dateTxt + ' · ' + (liv.depart || '—') + ' → ' + (liv.arrivee || '—') + ' · ' + fmtEur(ttc);
    }

    // Render tabs
    const detail = document.getElementById('dr-liv-detail-panel');
    const docs = document.getElementById('dr-liv-documents-panel');
    const paie = document.getElementById('dr-liv-paiement-panel');
    const hist = document.getElementById('dr-liv-historique-panel');
    if (detail) detail.innerHTML = renderDetailPanel(liv);
    if (docs) docs.innerHTML = renderDocumentsPanel(liv);
    if (paie) paie.innerHTML = renderPaiementPanel(liv);
    if (hist) hist.innerHTML = renderHistoriquePanel(liv);

    // Phase 91.13 — expose helper pour refresh la liste après génération doc.
    window.refreshDrawerDocuments = function (livId) {
      try {
        const livs = (window.charger ? window.charger('livraisons') : []) || [];
        const l = livs.find(x => x && x.id === livId);
        const panel = document.getElementById('dr-liv-documents-panel');
        if (l && panel) panel.innerHTML = renderDocumentsPanel(l);
      } catch (e) { console.warn('[refreshDrawerDocuments]', e); }
    };

    // Phase 91.37 — refresh tous les panels du drawer si déjà ouvert (après modif via modal-edit)
    window.refreshDrawerLivraisonDetail = function (livId) {
      try {
        const drawerPanel = document.getElementById('dr-liv-panel');
        if (!drawerPanel || drawerPanel.hidden || !drawerPanel.classList.contains('open')) return;
        if (livId && livId !== currentLivId) return;
        const livs = (window.charger ? window.charger('livraisons') : []) || [];
        const l = livs.find(x => x && x.id === (livId || currentLivId));
        if (!l) return;
        const detail = document.getElementById('dr-liv-detail-panel');
        const docs = document.getElementById('dr-liv-documents-panel');
        const paie = document.getElementById('dr-liv-paiement-panel');
        const hist = document.getElementById('dr-liv-historique-panel');
        if (detail) detail.innerHTML = renderDetailPanel(l);
        if (docs) docs.innerHTML = renderDocumentsPanel(l);
        if (paie) paie.innerHTML = renderPaiementPanel(l);
        if (hist) hist.innerHTML = renderHistoriquePanel(l);
        // Refresh title aussi
        const titleEl = document.getElementById('dr-liv-title');
        if (titleEl) titleEl.textContent = (l.numLiv || l.num_liv || '—') + ' · ' + (l.client || '—');
      } catch (e) { console.warn('[refreshDrawerLivraisonDetail]', e); }
    };

    // Show
    const overlay = document.getElementById('dr-liv-overlay');
    const panel = document.getElementById('dr-liv-panel');
    if (overlay) { overlay.hidden = false; setTimeout(() => overlay.classList.add('open'), 10); }
    if (panel) { panel.hidden = false; setTimeout(() => panel.classList.add('open'), 10); }
  };

  window.fermerDrawerLivraison = function () {
    const overlay = document.getElementById('dr-liv-overlay');
    const panel = document.getElementById('dr-liv-panel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
    setTimeout(() => {
      if (overlay) overlay.hidden = true;
      if (panel) panel.hidden = true;
    }, 280);
    currentLivId = null;
  };

  // ============ Tabs switching ============
  function setupTabs() {
    document.addEventListener('click', function (e) {
      const tab = e.target.closest('.dr-tab[data-dr-tab]');
      if (!tab) return;
      const target = tab.getAttribute('data-dr-tab');
      const parent = tab.parentElement;
      if (!parent) return;
      const allTabs = parent.querySelectorAll('.dr-tab');
      allTabs.forEach(t => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      // Cherche le drawer panel parent pour limiter le scope
      const drawer = tab.closest('.dr-panel') || document.getElementById('dr-liv-panel');
      const panels = drawer ? drawer.querySelectorAll('.dr-tab-panel') : document.querySelectorAll('#dr-liv-panel .dr-tab-panel');
      panels.forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-dr-panel') === target);
      });
    });
  }

  // ============ Click row → open drawer ============
  function setupRowClick() {
    const tbody = document.getElementById('tb-livraisons');
    if (!tbody) return;
    tbody.addEventListener('click', function (e) {
      // Ignore clic sur checkbox, select inline, dropdown, links, buttons
      if (e.target.closest('input[type="checkbox"]')) return;
      if (e.target.closest('select')) return;
      if (e.target.closest('button')) return;
      if (e.target.closest('a')) return;
      if (e.target.closest('.inline-dropdown-menu')) return;

      const tr = e.target.closest('tr');
      if (!tr || tr.classList.contains('empty-row') || tr.querySelector('td.empty-row')) return;

      // Cherche l'ID via dataset ou via numLiv
      const livId = tr.dataset.id || tr.dataset.livraisonId
                  || (tr.querySelector('.bulk-liv-check') && tr.querySelector('.bulk-liv-check').dataset.livId);
      if (livId) window.ouvrirDrawerLivraison(livId);
    });
  }

  // ============ Overlay click + Escape close ============
  function setupClose() {
    const overlay = document.getElementById('dr-liv-overlay');
    if (overlay) overlay.addEventListener('click', window.fermerDrawerLivraison);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentLivId) {
        window.fermerDrawerLivraison();
      }
    });
  }

  // ============ Footer actions ============
  function setupFooterActions() {
    const btnEdit = document.getElementById('dr-liv-btn-edit');
    const btnDup = document.getElementById('dr-liv-btn-duplicate');
    const btnPrint = document.getElementById('dr-liv-btn-print');
    if (btnEdit) btnEdit.addEventListener('click', function () {
      // Phase 91.30 — ouvre le modal IMMÉDIATEMENT (pas de setTimeout 300ms) pour zéro latence perçue.
      const livIdSnapshot = currentLivId;
      if (!livIdSnapshot) return;
      window.fermerDrawerLivraison();
      if (typeof window.ouvrirEditLivraison === 'function') {
        window.ouvrirEditLivraison(livIdSnapshot);
      } else if (typeof window.ouvrirEditLivraisonAdmin === 'function') {
        window.ouvrirEditLivraisonAdmin(livIdSnapshot);
      }
    });
    if (btnDup) btnDup.addEventListener('click', function () {
      if (!currentLivId) return;
      if (typeof window.dupliquerLivraison === 'function') {
        window.dupliquerLivraison(currentLivId);
        window.fermerDrawerLivraison();
      }
    });
    if (btnPrint) btnPrint.addEventListener('click', function () {
      if (!currentLivId) return;
      if (typeof window.imprimerLivraison === 'function') {
        window.imprimerLivraison(currentLivId);
      } else {
        window.print();
      }
    });
  }

  function init() {
    setupTabs();
    setupRowClick();
    setupClose();
    setupFooterActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
