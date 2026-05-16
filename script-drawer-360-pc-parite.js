/**
 * MCA Logistics — Drawer 360° PC : parité avec mobile
 *
 * Sprint H2.4 — Cible : combler les 4 KPIs manquants côté PC pour atteindre
 * parité stricte avec les drawers 360° mobile (M.ouvrirFiche360X) :
 *   - Client     : ajoute "nb livraisons" et "DSO réel"
 *   - Salarié    : ajoute "conformité %" (4ème carte KPI)
 *   - Véhicule   : ajoute "coût/km" et "coût total" (déjà conso + carb 30j)
 *   - Fournisseur: ajoute "nb charges", "dernière facture", "catégories"
 *
 * Stratégie : ne pas réécrire les drawers existants (10 754-12 510 dans
 * script.js, ~1700 LOC). On hooke les fonctions ouvrirFiche360X via wrappers
 * qui injectent post-render les KPIs + boutons Supprimer manquants. Les
 * helpers KPI purs (kpiClient/kpiVehicule/kpiFournisseur) sont exposés
 * pour les tests unitaires (tests/drawer-360-pc.test.js).
 *
 * Pattern : window.X = wrapper(window.X) + helpers exportés via
 * window.MCA_DRAWER360_HELPERS pour Node tests.
 *
 * Voir CLAUDE.md H2.4 (drawer 360 PC + Hub Équipe).
 */
(function () {
  'use strict';

  // ============================================================
  // 1. Helpers KPI purs (testables sans DOM)
  // ============================================================

  /**
   * KPIs Client : nb livraisons + DSO réel (via calculerDSO).
   * @param {Object} client
   * @param {Array} livraisons - toutes les livraisons (filtrage interne)
   * @param {Function} calculerDSO - injecté pour testabilité
   * @returns {{ nbLivr: number, dso: number|null, impayes: number }}
   */
  function kpiClient(client, livraisons, calculerDSO) {
    const nom = String(client && client.nom || '').trim().toLowerCase();
    const id = client && client.id;
    const livs = (livraisons || []).filter(function (l) {
      if (!l) return false;
      if (l.clientId === id) return true;
      return String(l.client || '').trim().toLowerCase() === nom;
    });
    const dsoRes = typeof calculerDSO === 'function' ? calculerDSO(livs) : { dso: null };
    const impayes = livs.filter(function (l) {
      const sp = String(l.statutPaiement || '').toLowerCase();
      return sp && sp !== 'paye' && sp !== 'payé' && sp !== 'payee' && sp !== 'payée';
    }).length;
    return { nbLivr: livs.length, dso: dsoRes ? dsoRes.dso : null, impayes: impayes };
  }

  /**
   * KPIs Véhicule : km, coût total, coût/km, conso.
   * @param {Object} veh
   * @param {Array} carburants - tous les pleins (filtrage interne)
   * @param {Array} entretiens - tous les entretiens (filtrage interne)
   * @returns {{ km: number, coutTotal: number, coutKm: number|null, conso: number|null }}
   */
  function kpiVehicule(veh, carburants, entretiens) {
    const vehId = veh && veh.id;
    const carbs = (carburants || []).filter(function (c) { return c && c.vehId === vehId; });
    const entrs = (entretiens || []).filter(function (e) { return e && e.vehId === vehId; });
    const totalCarb = carbs.reduce(function (s, c) { return s + (parseFloat(c.total) || 0); }, 0);
    const totalEntr = entrs.reduce(function (s, e) { return s + (parseFloat(e.ttc || e.montant) || 0); }, 0);
    const coutTotal = totalCarb + totalEntr;
    const km = parseFloat(veh && (veh.km || veh.kmActuel)) || 0;
    const kmInit = parseFloat(veh && veh.kmInitial) || 0;
    const kmRoules = Math.max(0, km - kmInit);
    const coutKm = kmRoules > 0 ? coutTotal / kmRoules : null;
    // Conso : moyenne sur tous les pleins avec kmCompteur valide
    const kmVals = carbs.map(function (c) { return parseFloat(c.kmCompteur); }).filter(function (k) { return !isNaN(k) && k > 0; });
    let conso = null;
    if (kmVals.length >= 2) {
      const delta = Math.max.apply(null, kmVals) - Math.min.apply(null, kmVals);
      const totalL = carbs.reduce(function (s, c) { return s + (parseFloat(c.litres) || 0); }, 0);
      if (delta > 100) conso = (totalL / delta) * 100;
    }
    return { km: km, coutTotal: coutTotal, coutKm: coutKm, conso: conso };
  }

  /**
   * KPIs Fournisseur : nb charges, total, dernière facture, catégories.
   * @param {Object} fourn
   * @param {Array} charges
   * @returns {{ nbCharges: number, total: number, derniereFacture: string|null, categories: Array<string> }}
   */
  function kpiFournisseur(fourn, charges) {
    const nom = String(fourn && fourn.nom || '').trim().toLowerCase();
    const id = fourn && fourn.id;
    const cs = (charges || []).filter(function (c) {
      if (!c) return false;
      if (c.fournisseurId === id) return true;
      return String(c.fournisseur || '').trim().toLowerCase() === nom;
    });
    const total = cs.reduce(function (s, c) { return s + (parseFloat(c.montantTTC || c.montant) || 0); }, 0);
    let derniereFacture = null;
    let derniereTs = -Infinity;
    cs.forEach(function (c) {
      const ts = new Date(c.date || 0).getTime();
      if (!isNaN(ts) && ts > derniereTs) { derniereTs = ts; derniereFacture = c.date || null; }
    });
    const cats = {};
    cs.forEach(function (c) { if (c.categorie) cats[c.categorie] = (cats[c.categorie] || 0) + 1; });
    const categories = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
    return { nbCharges: cs.length, total: total, derniereFacture: derniereFacture, categories: categories };
  }

  /**
   * Conformité Salarié : % de pièces (permis / assurance / visite médicale)
   * non expirées et présentes. Renvoie 0..100.
   */
  // Phase 91.44 (Agent Salariés H1) — visiteMedicale est un objet {date,aptitude,dateExpiration}
  // new Date(obj) = Invalid Date → conformité fausse. Extraire dateExpiration explicitement.
  function kpiConformiteSalarie(sal, now) {
    if (!sal) return 0;
    const t = (now && now.getTime ? now.getTime() : (now || Date.now()));
    // Phase 91.89 : support 3 formats visiteMedicale — string ISO (legacy),
    // {date, aptitude, dateExpiration} (Phase 91.44), null/undefined.
    let visiteDate = null;
    if (typeof sal.visiteMedicale === 'string') {
      visiteDate = sal.visiteMedicale;
    } else if (sal.visiteMedicale && typeof sal.visiteMedicale === 'object') {
      visiteDate = sal.visiteMedicale.dateExpiration || sal.visiteMedicale.date;
    }
    const items = [sal.datePermis, sal.dateAssurance, visiteDate].filter(Boolean);
    if (!items.length) return 0;
    const okCount = items.reduce(function (acc, d) {
      const ts = new Date(d).getTime();
      if (isNaN(ts)) return acc;
      return ts >= t ? acc + 1 : acc;
    }, 0);
    return Math.round((okCount / items.length) * 100);
  }

  // Expose pour tests Node + runtime debug
  const HELPERS = {
    kpiClient: kpiClient,
    kpiVehicule: kpiVehicule,
    kpiFournisseur: kpiFournisseur,
    kpiConformiteSalarie: kpiConformiteSalarie,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HELPERS;
  }
  if (typeof window === 'undefined') return;
  window.MCA_DRAWER360_HELPERS = HELPERS;

  // ============================================================
  // 2. Augmentation post-render des drawers existants
  // ============================================================

  const esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  };

  function loadList(key) {
    try { return (typeof window.loadSafe === 'function') ? window.loadSafe(key, []) : JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (e) { return []; }
  }

  /**
   * Augmente le drawer S25 Client en injectant 2 cartes KPI manquantes
   * (nb livraisons + DSO) au début de la rangée KPI, et un bouton Supprimer
   * dans head-actions.
   */
  function augmenterDrawerClient(clientId) {
    setTimeout(function () {
      const drawer = document.getElementById('s25-drawer');
      if (!drawer || drawer.__augmented360 === clientId) return;
      drawer.__augmented360 = clientId;

      const clients = loadList('clients');
      const livraisons = loadList('livraisons');
      const c = clients.find(function (x) { return x.id === clientId; });
      if (!c) return;

      const k = kpiClient(c, livraisons, window.calculerDSO);
      const dsoTxt = k.dso === null ? '—' : (k.dso + ' j');
      const dsoColor = k.dso !== null && k.dso > 45 ? '#ef4444' : (k.dso !== null && k.dso > 30 ? '#f97316' : 'inherit');

      const kpiRow = drawer.querySelector('.s25-kpi-row');
      if (kpiRow && !kpiRow.querySelector('[data-augm="livr"]')) {
        const livKpi = document.createElement('div');
        livKpi.className = 's25-kpi';
        livKpi.setAttribute('data-augm', 'livr');
        livKpi.innerHTML = '<div class="kpi-label">Livraisons</div><div class="kpi-val">' + k.nbLivr + '</div>';
        kpiRow.insertBefore(livKpi, kpiRow.firstChild);

        const dsoKpi = document.createElement('div');
        dsoKpi.className = 's25-kpi';
        dsoKpi.setAttribute('data-augm', 'dso');
        dsoKpi.innerHTML = '<div class="kpi-label">DSO réel</div><div class="kpi-val" style="color:' + dsoColor + '">' + esc(dsoTxt) + '</div>';
        kpiRow.insertBefore(dsoKpi, kpiRow.children[1] || null);
      }

      // Bouton Supprimer dans head-actions
      const headActions = drawer.querySelector('.s25-head-actions');
      if (headActions && !headActions.querySelector('[data-augm-del]')) {
        const btn = document.createElement('button');
        btn.className = 'btn-danger';
        btn.setAttribute('data-augm-del', '1');
        btn.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;margin-left:6px';
        btn.innerHTML = 'Supprimer';
        btn.onclick = function () {
          if (typeof window.supprimerClient === 'function') {
            window.s25FermerDrawer && window.s25FermerDrawer();
            setTimeout(function () { window.supprimerClient(clientId); }, 100);
          }
        };
        headActions.appendChild(btn);
      }
    }, 0);
  }

  /**
   * Augmente le drawer S25 Fournisseur : ajoute nb charges + dernière facture
   * + catégories en début de rangée KPI, ainsi que Supprimer.
   */
  function augmenterDrawerFournisseur(fournId) {
    setTimeout(function () {
      const drawer = document.getElementById('s25-drawer');
      if (!drawer || drawer.__augmented360 === 'F-' + fournId) return;
      drawer.__augmented360 = 'F-' + fournId;

      const fournisseurs = loadList('fournisseurs');
      const charges = loadList('charges');
      const f = fournisseurs.find(function (x) { return x.id === fournId; });
      if (!f) return;
      const k = kpiFournisseur(f, charges);

      const kpiRow = drawer.querySelector('.s25-kpi-row');
      if (kpiRow && !kpiRow.querySelector('[data-augm="nbCh"]')) {
        const nbKpi = document.createElement('div');
        nbKpi.className = 's25-kpi';
        nbKpi.setAttribute('data-augm', 'nbCh');
        nbKpi.innerHTML = '<div class="kpi-label">Nb charges</div><div class="kpi-val">' + k.nbCharges + '</div>';
        kpiRow.insertBefore(nbKpi, kpiRow.firstChild);

        const fmtDate = function (d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
        const lastKpi = document.createElement('div');
        lastKpi.className = 's25-kpi';
        lastKpi.setAttribute('data-augm', 'lastF');
        lastKpi.innerHTML = '<div class="kpi-label">Dernière facture</div><div class="kpi-val" style="font-size:.95rem">' + esc(fmtDate(k.derniereFacture)) + '</div>';
        kpiRow.appendChild(lastKpi);

        const catKpi = document.createElement('div');
        catKpi.className = 's25-kpi';
        catKpi.setAttribute('data-augm', 'cats');
        const catTxt = k.categories.length ? k.categories.slice(0, 2).join(', ') + (k.categories.length > 2 ? ' +' + (k.categories.length - 2) : '') : '—';
        catKpi.innerHTML = '<div class="kpi-label">Catégories</div><div class="kpi-val" style="font-size:.85rem">' + esc(catTxt) + '</div>';
        kpiRow.appendChild(catKpi);
      }

      // Bouton Modifier + Supprimer dans head (header n'en a pas par défaut côté fournisseur)
      const head = drawer.querySelector('.s25-drawer-head');
      if (head && !head.querySelector('[data-augm-actions]')) {
        const wrap = document.createElement('div');
        wrap.className = 's25-head-actions';
        wrap.setAttribute('data-augm-actions', '1');
        wrap.style.cssText = 'display:flex;gap:6px;margin-left:auto';
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-secondary';
        btnEdit.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Modifier';
        btnEdit.onclick = function () {
          if (typeof window.ouvrirEditFournisseur === 'function') {
            window.s25FermerDrawer && window.s25FermerDrawer();
            setTimeout(function () { window.ouvrirEditFournisseur(fournId); }, 100);
          }
        };
        const btnDel = document.createElement('button');
        btnDel.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer';
        btnDel.innerHTML = 'Supprimer';
        btnDel.onclick = function () {
          if (typeof window.supprimerFournisseur === 'function') {
            window.s25FermerDrawer && window.s25FermerDrawer();
            setTimeout(function () { window.supprimerFournisseur(fournId); }, 100);
          }
        };
        wrap.appendChild(btnEdit);
        wrap.appendChild(btnDel);
        head.appendChild(wrap);
      }
    }, 0);
  }

  /**
   * Augmente le drawer S20 Salarié : ajoute KPI conformité (4ème carte),
   * onglet Documents, bouton Supprimer dans actions.
   */
  function augmenterDrawerSalarie(salId) {
    setTimeout(function () {
      const drawer = document.getElementById('s20-drawer');
      if (!drawer || drawer.__augmented360 === 'S-' + salId) return;
      drawer.__augmented360 = 'S-' + salId;

      const sal = loadList('salaries').find(function (s) { return s.id === salId; });
      if (!sal) return;

      const conf = kpiConformiteSalarie(sal, new Date());
      const confColor = conf >= 100 ? '#22c55e' : (conf >= 50 ? '#f59e0b' : '#ef4444');

      const kpiRow = drawer.querySelector('.s20-kpi-row');
      if (kpiRow && !kpiRow.querySelector('[data-augm="conf"]')) {
        const confKpi = document.createElement('div');
        confKpi.className = 's20-kpi';
        confKpi.setAttribute('data-augm', 'conf');
        confKpi.innerHTML = '<div class="s20-kpi-val" style="color:' + confColor + '">' + conf + '%</div><div class="s20-kpi-lbl">Conformité</div>';
        kpiRow.appendChild(confKpi);
      }

      // Onglet Documents
      const tabsBar = drawer.querySelector('.s20-tabs');
      if (tabsBar && !tabsBar.querySelector('[data-tab="docs"]')) {
        const docs = (sal.docs && typeof sal.docs === 'object') ? Object.keys(sal.docs).filter(function (k) { return sal.docs[k]; }) : [];
        const btn = document.createElement('button');
        btn.className = 's20-tab';
        btn.setAttribute('data-tab', 'docs');
        btn.setAttribute('onclick', "window.s20SwitchTab && window.s20SwitchTab('docs')");
        btn.innerHTML = 'Documents (' + docs.length + ')';
        tabsBar.appendChild(btn);

        // Panel
        const panel = document.createElement('div');
        panel.className = 's20-tab-content hidden';
        panel.id = 's20-tab-docs';
        if (!docs.length) {
          panel.innerHTML = '<div class="s20-empty">Aucun document uploadé</div>';
        } else {
          panel.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' + docs.map(function (k) {
            const d = sal.docs[k];
            // Phase 91.44 (Agent Salariés M3) — schéma utilise d.nom, pas d.fileName
            const name = (d && (d.nom || d.fileName)) || k;
            return '<div class="s21-link-card"><div class="s21-link-card-body"><div class="s21-link-card-lbl">' + esc(k) + '</div><div class="s21-link-card-val">' + esc(name) + '</div></div></div>';
          }).join('') + '</div>';
        }
        // Insérer après la dernière s20-tab-content
        const lastContent = drawer.querySelector('.s20-tab-content:last-of-type') || tabsBar.parentNode;
        if (lastContent && lastContent.parentNode) lastContent.parentNode.insertBefore(panel, lastContent.nextSibling);
      }

      // Bouton Supprimer
      const actions = drawer.querySelector('.s20-fiche-actions');
      if (actions && !actions.querySelector('[data-augm-del]')) {
        const btn = document.createElement('button');
        btn.setAttribute('data-augm-del', '1');
        btn.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer';
        btn.innerHTML = 'Supprimer';
        btn.onclick = function () {
          if (typeof window.supprimerSalarie === 'function') {
            window.fermerFiche360 && window.fermerFiche360();
            setTimeout(function () { window.supprimerSalarie(salId); }, 100);
          }
        };
        actions.appendChild(btn);
      }
    }, 0);
  }

  /**
   * Augmente le drawer S20 Véhicule : ajoute coût total + coût/km en cartes
   * KPI, et bouton Supprimer.
   */
  function augmenterDrawerVehicule(vehId) {
    setTimeout(function () {
      const drawer = document.getElementById('s20-drawer');
      if (!drawer || drawer.__augmented360 === 'V-' + vehId) return;
      drawer.__augmented360 = 'V-' + vehId;

      const veh = loadList('vehicules').find(function (v) { return v.id === vehId; });
      if (!veh) return;
      const k = kpiVehicule(veh, loadList('carburant'), loadList('entretiens'));

      const kpiRow = drawer.querySelector('.s20-kpi-row');
      if (kpiRow && !kpiRow.querySelector('[data-augm="cout"]')) {
        const coutKpi = document.createElement('div');
        coutKpi.className = 's20-kpi';
        coutKpi.setAttribute('data-augm', 'cout');
        coutKpi.innerHTML = '<div class="s20-kpi-val">' + Math.round(k.coutTotal) + ' €</div><div class="s20-kpi-lbl">Coût total</div>';
        kpiRow.appendChild(coutKpi);

        const coutKmKpi = document.createElement('div');
        coutKmKpi.className = 's20-kpi';
        coutKmKpi.setAttribute('data-augm', 'coutKm');
        const coutKmTxt = k.coutKm === null ? '—' : (k.coutKm.toFixed(2) + ' €/km');
        coutKmKpi.innerHTML = '<div class="s20-kpi-val" style="font-size:.92rem">' + coutKmTxt + '</div><div class="s20-kpi-lbl">Coût/km</div>';
        kpiRow.appendChild(coutKmKpi);
      }

      // Bouton Supprimer
      const actions = drawer.querySelector('.s20-fiche-actions');
      if (actions && !actions.querySelector('[data-augm-del]')) {
        const btn = document.createElement('button');
        btn.setAttribute('data-augm-del', '1');
        btn.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer';
        btn.innerHTML = 'Supprimer';
        btn.onclick = function () {
          if (typeof window.supprimerVehicule === 'function') {
            window.fermerFiche360 && window.fermerFiche360();
            setTimeout(function () { window.supprimerVehicule(vehId); }, 100);
          }
        };
        actions.appendChild(btn);
      }
    }, 0);
  }

  // ============================================================
  // 3. Hook les fonctions ouvrirFiche360X (wrapper additif)
  // ============================================================

  function installHooks() {
    if (window.__drawer360PariteInstalled) return;
    // Attendre que les fonctions natives soient prêtes
    if (typeof window.ouvrirFiche360Client !== 'function'
      || typeof window.ouvrirFiche360Fournisseur !== 'function'
      || typeof window.ouvrirFiche360Salarie !== 'function'
      || typeof window.ouvrirFiche360Vehicule !== 'function') {
      setTimeout(installHooks, 300);
      return;
    }
    window.__drawer360PariteInstalled = true;

    const oldClient = window.ouvrirFiche360Client;
    window.ouvrirFiche360Client = function (id) { oldClient(id); augmenterDrawerClient(id); };

    const oldFourn = window.ouvrirFiche360Fournisseur;
    window.ouvrirFiche360Fournisseur = function (id) { oldFourn(id); augmenterDrawerFournisseur(id); };

    const oldSal = window.ouvrirFiche360Salarie;
    window.ouvrirFiche360Salarie = function (id) { oldSal(id); augmenterDrawerSalarie(id); };

    const oldVeh = window.ouvrirFiche360Vehicule;
    window.ouvrirFiche360Vehicule = function (id) { oldVeh(id); augmenterDrawerVehicule(id); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(installHooks, 1500); });
  } else {
    setTimeout(installHooks, 1500);
  }
})();
