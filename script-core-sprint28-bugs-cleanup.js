/**
 * MCA Logistics — Sprint 28 — Bugs critiques + cleanup (drawer 360 partout + MutationObserver Paramètres + signature BL) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4928-5122 (2026-05-16).
 */

/* ==========================================================================
   Sprint 28 — Bugs critiques & cleanup
   1. Extension drawer 360° à tous les onglets (liv, fact, paie, charges)
   2. MutationObserver pour re-injection instantanée dans Paramètres
   3. Bouton Signature BL sur rows page Livraisons (+ action inline)
   4. Nettoyage encarts légaux pédagogiques (centralisation Conformité)
   5. Amélioration visuelle drawer tabs (scroll fluide)
   ========================================================================== */
(function installS28(){
  if (window.__s28Installed) return;
  window.__s28Installed = true;

  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const loadObj = (k) => { try { return loadSafe(k, {}); } catch(e){ return {}; } };
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };

  /* ---------- 1. Extension drawer 360° à tous les onglets ---------- */
  function findClientByName(nom) {
    if (!nom) return null;
    const k = nom.trim().toLowerCase();
    return load('clients').find(c => (c.nom||'').trim().toLowerCase() === k) || null;
  }
  function findFournByName(nom) {
    if (!nom) return null;
    const k = nom.trim().toLowerCase();
    return load('fournisseurs').find(f => (f.nom||'').trim().toLowerCase() === k) || null;
  }

  // Délégation clic global : tout élément avec data-client-open ou data-fourn-open ouvre drawer
  document.addEventListener('click', function(e) {
    const cel = e.target.closest('[data-s28-client]');
    const fel = e.target.closest('[data-s28-fourn]');
    if (cel && typeof window.ouvrirFiche360Client === 'function') {
      e.preventDefault(); e.stopPropagation();
      const id = cel.dataset.s28Client;
      window.ouvrirFiche360Client(id);
      return;
    }
    if (fel && typeof window.ouvrirFiche360Fournisseur === 'function') {
      e.preventDefault(); e.stopPropagation();
      const id = fel.dataset.s28Fourn;
      window.ouvrirFiche360Fournisseur(id);
      return;
    }
  }, true);

  // Injection attribut data-s28-client sur les cellules nom client dans toutes les tables
  function hookClientCells() {
    // Table Livraisons (colonne client)
    const tbLiv = document.getElementById('tb-livraisons');
    const tbLivR = document.getElementById('tb-livraisons-recentes');
    [tbLiv, tbLivR].forEach(tb => {
      if (!tb) return;
      tb.querySelectorAll('tr').forEach(tr => {
        if (tr.__s28ClientHook) return;
        // Chercher cellule avec un nom client
        const tds = tr.querySelectorAll('td');
        tds.forEach(td => {
          const txt = (td.textContent||'').trim();
          if (!txt || txt === '—' || td.querySelector('select, input, button')) return;
          const c = findClientByName(txt);
          if (c) {
            td.setAttribute('data-s28-client', c.id);
            td.style.cursor = 'pointer';
            td.title = 'Ouvrir fiche client 360°';
            td.classList.add('s28-link-cell');
          }
        });
        tr.__s28ClientHook = true;
      });
    });
    // Table Factures émises
    const tbFact = document.getElementById('tb-factures');
    if (tbFact) {
      tbFact.querySelectorAll('tr').forEach(tr => {
        if (tr.__s28ClientHook) return;
        tr.querySelectorAll('td').forEach(td => {
          const txt = (td.textContent||'').trim();
          if (!txt || txt === '—' || td.querySelector('select, input, button')) return;
          const c = findClientByName(txt);
          if (c) {
            td.setAttribute('data-s28-client', c.id);
            td.style.cursor = 'pointer';
            td.title = 'Ouvrir fiche client 360°';
            td.classList.add('s28-link-cell');
          }
        });
        tr.__s28ClientHook = true;
      });
    }
    // Charges → fournisseur
    const tbCh = document.getElementById('tb-charges');
    if (tbCh) {
      tbCh.querySelectorAll('tr').forEach(tr => {
        if (tr.__s28FournHook) return;
        tr.querySelectorAll('td').forEach(td => {
          const txt = (td.textContent||'').trim();
          if (!txt || txt === '—' || td.querySelector('select, input, button')) return;
          const f = findFournByName(txt);
          if (f) {
            td.setAttribute('data-s28-fourn', f.id);
            td.style.cursor = 'pointer';
            td.title = 'Ouvrir fiche fournisseur 360°';
            td.classList.add('s28-link-cell');
          }
        });
        tr.__s28FournHook = true;
      });
    }
  }

  /* ---------- 2. Bouton Signature BL sur rows livraisons ---------- */
  function signatureActive() {
    const p = loadObj('params_entreprise');
    const o = p.s26 || {};
    return !!o.signature_bl;
  }

  function hookSignatureLivraisons() {
    if (!signatureActive()) return;
    const tbLiv = document.getElementById('tb-livraisons');
    if (!tbLiv) return;
    tbLiv.querySelectorAll('tr').forEach(tr => {
      if (tr.__s28SigHook) return;
      // Cherche l'ID de la livraison dans la ligne
      const editBtn = tr.querySelector('button[onclick*="ouvrirEditLivraison"], button[onclick*="modifierLivraison"]');
      let livId = null;
      if (editBtn) {
        const m = editBtn.getAttribute('onclick').match(/['"]([a-zA-Z0-9_-]+)['"]/);
        if (m) livId = m[1];
      }
      if (!livId) {
        const anyBtn = tr.querySelector('button[onclick*="supprimerLivraison"], button[onclick*="imprimer"]');
        if (anyBtn) {
          const m = anyBtn.getAttribute('onclick').match(/['"]([a-zA-Z0-9_-]+)['"]/);
          if (m) livId = m[1];
        }
      }
      if (!livId) return;
      // Chercher le menu dropdown Actions (S27 pattern .inline-dropdown-menu)
      const menu = tr.querySelector('.inline-dropdown-menu');
      if (!menu) return;
      if (menu.querySelector('.s28-sig-item')) return;
      // Vérifier si déjà signée
      const sigs = load('s26_signatures_bl');
      const hasSig = sigs.some(s => String(s.livraisonId) === String(livId));
      // Créer un item cohérent avec la classe inline-dropdown-item
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'inline-dropdown-item s28-sig-item';
      item.innerHTML = (hasSig ? '✅ ' : '✍️ ') + (hasSig ? 'Voir signature BL' : 'Signer BL');
      item.title = hasSig ? 'Signature déjà archivée — ouvrir' : 'Capturer la signature du destinataire';
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.fermerInlineDropdowns === 'function') window.fermerInlineDropdowns();
        window.ouvrirSignatureBL(livId);
      });
      // Insérer en haut du menu (avant Modifier)
      menu.insertBefore(item, menu.firstChild);
      tr.__s28SigHook = true;
    });
  }

  /* ---------- 3. Garde anti-overlay résiduel (fix écran noir Paramètres) ---------- */
  // Si un modal .s15-modal-info-overlay reste en .open sans contenu visible
  // (peut arriver après écriture storage/re-render), on le ferme proprement.
  function gardeOverlay() {
    const m = document.getElementById('s15-modal-info');
    if (!m) return;
    if (!m.classList.contains('open')) return;
    const box = m.querySelector('.s15-modal-info-box, .s15-modal-info-body');
    const visible = box && box.offsetParent !== null && (box.textContent||'').trim().length > 0;
    if (!visible) m.classList.remove('open');
  }

  /* ---------- 4. Scan permanent ---------- */
  function tick() {
    hookClientCells();
    hookSignatureLivraisons();
    gardeOverlay();
  }

  function init() {
    setTimeout(tick, 1200);
    setInterval(tick, 2000);
    // Re-hook quand on change de page
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-page], .nav-item');
      if (navBtn) setTimeout(tick, 300);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1700);
})();
