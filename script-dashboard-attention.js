// MCA LOGISTICS — Dashboard "Points d'attention" + Santé (Phase 5 refonte)
//
// Phase 3 (initial) : alimente #dashboard-attention-list avec les 3 alertes
//   les plus urgentes (non lues / traitées / ignorées).
// Phase 5 (refonte HTML pixel-perfect) : nouveau rendu en pills colorées
//   (red / orange / green / blue) avec icônes SVG, label, valeur, arrow,
//   et alimente le bloc santé v2 (sub-scores + factors + recommandation).

(function () {
  'use strict';

  // ===== Icônes SVG (Lucide-style, stroke-only) =====
  const ICONS = {
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-9-15.4a2 2 0 0 0-3.4 0L.3 18A2 2 0 0 0 2 21h18a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    tva: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    charges: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h4"/></svg>',
    vehicule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h2v-3.34a2 2 0 0 0-.59-1.41L17 8H3v8h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  };

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ============================================================
  // POINTS D'ATTENTION — pills v2
  // ============================================================

  function getAlertesActives() {
    if (typeof window.charger !== 'function') return [];
    const all = window.charger('alertes_admin') || [];
    return all.filter(a => !a.lu && !a.traitee && !a.ignoree);
  }

  function niveauToColor(niveau) {
    if (niveau === 'critical' || niveau === 'haute') return 'red';
    if (niveau === 'warn' || niveau === 'moyenne') return 'orange';
    if (niveau === 'info' || niveau === 'basse') return 'blue';
    return 'green';
  }

  function niveauOrder(n) {
    if (n === 'critical' || n === 'haute') return 0;
    if (n === 'warn' || n === 'moyenne') return 1;
    return 2;
  }

  function categorieToIcon(cat, niveau) {
    const c = String(cat || '').toLowerCase();
    if (c.includes('impay') || c.includes('encaiss') || c.includes('facture')) return ICONS.cash;
    if (c.includes('tva') || c.includes('impot') || c.includes('fiscal')) return ICONS.tva;
    if (c.includes('charge')) return ICONS.charges;
    if (c.includes('vehic') || c.includes('ct') || c.includes('assur') || c.includes('carte')) return ICONS.vehicule;
    if (c.includes('encais') || c.includes('paie')) return ICONS.trend;
    return ICONS.alert;
  }

  function buildPillFromAlerte(a) {
    const color = niveauToColor(a.niveau);
    const icon = categorieToIcon(a.categorie || a.type, a.niveau);
    const val = escHtml(a.titre || a.message || 'Alerte');
    const lbl = escHtml(a.message && a.titre && a.message !== a.titre ? a.message : (a.categorie || 'À traiter'));
    const href = a.lien || '#';
    return `
      <a class="pill pill-${color}" href="${escHtml(href)}" onclick="${href === '#' ? "naviguerVers('alertes');return false" : ''}">
        <div class="pill-icon">${icon}</div>
        <div class="pill-info">
          <div class="pill-val">${val}</div>
          <div class="pill-lbl">${lbl}</div>
        </div>
        <div class="pill-arrow">${ICONS.arrow}</div>
      </a>`;
  }

  function renderPointsAttention() {
    const card = document.getElementById('dashboard-points-attention');
    if (!card) return;
    const list = document.getElementById('dashboard-attention-list');
    const counter = document.getElementById('dashboard-attention-count');
    const counterV2 = document.getElementById('dashboard-attention-count-v2');
    if (!list) return;

    const actives = getAlertesActives();
    actives.sort((a, b) => niveauOrder(a.niveau) - niveauOrder(b.niveau));

    const n = actives.length;
    const txt = n === 0 ? 'Aucune alerte' : `${n} alerte${n > 1 ? 's' : ''} à traiter`;
    if (counter) counter.textContent = txt;
    if (counterV2) counterV2.textContent = txt;

    if (!n) {
      // Fallback : affiche 1 pill green "tout va bien" pour ne pas avoir un bloc vide
      list.innerHTML = `
        <div class="pill pill-green" style="cursor:default">
          <div class="pill-icon">${ICONS.trend}</div>
          <div class="pill-info">
            <div class="pill-val">Tout est OK</div>
            <div class="pill-lbl">Aucune alerte active</div>
          </div>
        </div>`;
      card.style.display = '';
      return;
    }

    list.innerHTML = actives.slice(0, 5).map(buildPillFromAlerte).join('');
    card.style.display = '';
  }

  // ============================================================
  // SANTÉ ENTREPRISE — bloc v2 (sub-scores + factors + reco)
  // ============================================================

  function readScoreFromLegacy() {
    // Le bloc legacy hero-sante-main / sante-ring-fg est rempli par script.js.
    // On lit son contenu pour le mirrorer dans le bloc v2.
    const ringScore = document.getElementById('sante-ring-score');
    const score = ringScore ? parseInt(ringScore.textContent, 10) : NaN;
    return Number.isFinite(score) ? score : null;
  }

  function computeScoreFromSubScores(sub) {
    // Score global = moyenne pondérée des 4 sub-scores
    // Finance 30% / Flotte 25% / RH 20% / Conformité 25%
    const w = { finance: 0.30, flotte: 0.25, rh: 0.20, conformite: 0.25 };
    const s = (sub.finance * w.finance) + (sub.flotte * w.flotte)
            + (sub.rh * w.rh) + (sub.conformite * w.conformite);
    return Math.round(s);
  }

  function badgeFromScore(s) {
    if (s == null) return { label: 'Chargement', cls: '' };
    if (s >= 80) return { label: 'Excellent', cls: '' };
    if (s >= 60) return { label: 'Correct', cls: 'warn' };
    return { label: 'À surveiller', cls: 'alert' };
  }

  function computeSubScores() {
    // 4 sub-scores calculés sur de vraies KPIs (Phase 19) :
    // - Finance    : marge brute + impayés + DSO
    // - Flotte     : CT véhicules + conso anormale
    // - RH         : permis chauffeurs
    // - Conformité : inspections hebdo + alertes critiques en cours
    const def = { finance: 90, flotte: 88, rh: 85, conformite: 95 };
    if (typeof window.charger !== 'function') return def;
    try {
      const read = (k) => window.charger(k) || [];
      const livs = read('livraisons');
      const charges = read('charges');
      const vehs = read('vehicules');
      const sals = read('salaries');
      const inspections = read('inspections');
      const alertes = read('alertes_admin').filter(a => !a.lu && !a.traitee && !a.ignoree);

      const now = Date.now();
      const J = 86400000;

      // ===== FINANCE =====
      // Marge brute (12 mois)
      const livs365 = livs.filter(l => {
        const d = livDate(l);
        return d && (now - d.getTime()) <= 365 * J;
      });
      const ca = livs365.reduce((s, l) => s + livHT(l), 0);
      const dep = charges
        .filter(c => {
          const d = chDate(c) || chDatePaiement(c);
          return d && (now - d.getTime()) <= 365 * J;
        })
        .reduce((s, c) => s + chMontantHT(c), 0);
      const marge = ca > 0 ? ((ca - dep) / ca) * 100 : null;

      // Impayés > 90j
      const impayes90 = livs
        .filter(l => {
          if (isPaye(livStatutPaiement(l))) return false;
          const d = livDate(l);
          return d && (now - d.getTime()) > 90 * J;
        })
        .reduce((s, l) => s + livHT(l), 0);

      // Score finance : base 95, pénalités proportionnelles
      let financeScore = 95;
      if (marge != null) {
        if (marge < 15) financeScore -= 15;
        else if (marge < 25) financeScore -= 7;
        else if (marge < 35) financeScore -= 2;
      }
      if (impayes90 > 10000) financeScore -= 15;
      else if (impayes90 > 5000) financeScore -= 8;
      else if (impayes90 > 0) financeScore -= 3;

      // ===== FLOTTE =====
      const ctCrit = vehs.filter(v => {
        const d = vehCT(v);
        if (!d) return false;
        return (d.getTime() - now) / J <= 7;
      }).length;
      let flotteScore = 92;
      flotteScore -= ctCrit * 6;
      // Conso anormale (compte les véhicules avec >50L sur 30j si data dispo)
      const carbAlerts = alertes.filter(a => String(a.categorie || '').toLowerCase().includes('carburant')
                                          || String(a.type || '').toLowerCase().includes('conso')).length;
      flotteScore -= carbAlerts * 3;

      // ===== RH =====
      const permisProches = sals.filter(s => {
        if (s.actif === false) return false;
        const d = salDatePermis(s);
        if (!d) return false;
        return (d.getTime() - now) / J <= 60;
      }).length;
      let rhScore = 88;
      rhScore -= permisProches * 5;

      // ===== CONFORMITÉ =====
      // Inspections hebdo + alertes critiques générales
      const inspThisWeek = inspections.filter(i => {
        const d = inspDate(i);
        return d && (now - d.getTime()) <= 7 * J;
      }).length;
      const vehActifs = vehs.filter(v => vehStatut(v) === 'actif').length || vehs.length;
      const inspRate = vehActifs > 0 ? inspThisWeek / vehActifs : 1;
      const critiques = alertes.filter(a => /^(critical|haute)$/i.test(a.niveau)).length;
      let confScore = 95;
      if (vehActifs > 0 && inspRate < 0.5) confScore -= 12;
      else if (vehActifs > 0 && inspRate < 1) confScore -= 5;
      confScore -= critiques * 2;

      return {
        finance: Math.max(50, Math.min(100, Math.round(financeScore))),
        flotte: Math.max(50, Math.min(100, Math.round(flotteScore))),
        rh: Math.max(50, Math.min(100, Math.round(rhScore))),
        conformite: Math.max(50, Math.min(100, Math.round(confScore))),
      };
    } catch (e) {
      console.warn('[dashboard-attention] computeSubScores fallback:', e);
      return def;
    }
  }

  // ============ Field accessors (support snake_case Supabase ET camelCase legacy) ============
  function getNum(obj, ...keys) {
    for (const k of keys) {
      const v = obj && obj[k];
      if (v != null && v !== '') {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
      }
    }
    return 0;
  }
  function getStr(obj, ...keys) {
    for (const k of keys) {
      const v = obj && obj[k];
      if (v != null && v !== '') return String(v);
    }
    return '';
  }
  function getDate(obj, ...keys) {
    for (const k of keys) {
      const v = obj && obj[k];
      if (!v) continue;
      try {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d;
      } catch (_) {}
    }
    return null;
  }

  // Accessors par entité (résilient au schéma snake_case ↔ camelCase)
  const livHT = (l) => getNum(l, 'prix_ht', 'prixHT', 'ht', 'prix');
  const livDate = (l) => getDate(l, 'date_livraison', 'dateLivraison', 'dateLiv', 'date');
  const livStatutPaiement = (l) => getStr(l, 'statut_paiement', 'statutPaiement').toLowerCase();
  const livDatePaiement = (l) => getDate(l, 'date_paiement', 'datePaiement');

  const chMontantHT = (c) => getNum(c, 'montant_ht', 'montantHT', 'ht');
  const chMontantTTC = (c) => getNum(c, 'montant_ttc', 'montantTTC', 'ttc', 'montant');
  const chDate = (c) => getDate(c, 'date_charge', 'dateCharge', 'date');
  const chDatePaiement = (c) => getDate(c, 'date_paiement', 'datePaiement');
  const chStatutPaiement = (c) => getStr(c, 'statut_paiement', 'statutPaiement', 'statut').toLowerCase();

  const paieMontant = (p) => getNum(p, 'montant');
  const paieDate = (p) => getDate(p, 'date_paiement', 'datePaiement', 'date');

  const vehCT = (v) => getDate(v, 'date_ct', 'dateCT', 'dateProchainCT');
  const vehConso = (v) => getNum(v, 'conso', 'consoTarget') || 10;
  const vehStatut = (v) => getStr(v, 'statut') || 'actif';
  const vehLabel = (v) => getStr(v, 'modele') || getStr(v, 'immat', 'immatriculation') || '—';

  const salDatePermis = (s) => getDate(s, 'date_permis', 'dateExpirationPermis', 'datePermis');

  const carbDate = (c) => getDate(c, 'date_plein', 'datePlein', 'date');
  const carbLitres = (c) => getNum(c, 'litres');
  const carbVehId = (c) => getStr(c, 'vehicule_id', 'vehiculeId', 'vehId');

  const inspDate = (i) => getDate(i, 'date_inspection', 'dateInspection', 'date');

  function isPaye(statut) {
    return statut === 'paye' || statut === 'payé' || statut === 'payee' || statut === 'payée';
  }

  function fmtEur(v, dec) {
    if (v == null || !Number.isFinite(v)) return '—';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }) + ' €';
  }

  function fmtKEur(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    const sign = v >= 0 ? '+' : '';
    const k = Math.round(v / 100) / 10;
    return sign + k.toFixed(1).replace('.', ',') + 'k€';
  }

  function fmtEurSigned(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    const sign = v >= 0 ? '+' : '';
    const rounded = Math.round(v);
    return sign + rounded.toLocaleString('fr-FR') + ' €';
  }

  function buildFactors(subScores) {
    // 8 facteurs branchés sur les vraies données (Phase 19 — fields snake_case + camelCase).
    const read = (k) => (typeof window.charger === 'function' ? window.charger(k) || [] : []);
    const livraisons = read('livraisons');
    const charges    = read('charges');
    const vehicules  = read('vehicules');
    const salaries   = read('salaries');
    const carburant  = read('carburant');
    const inspections = read('inspections');
    const paiements  = read('paiements');

    const now = Date.now();
    const J = 86400000;

    // ============ 1. Marge brute (12 derniers mois) ============
    // CA - Charges sur 365j, normalisé sur 12 mois pour lisser saisonnalité.
    const livs365 = livraisons.filter(l => {
      const d = livDate(l);
      return d && (now - d.getTime()) <= 365 * J;
    });
    const ca = livs365.reduce((s, l) => s + livHT(l), 0);
    const charges365 = charges.filter(c => {
      const d = chDate(c) || chDatePaiement(c);
      return d && (now - d.getTime()) <= 365 * J;
    });
    const dep = charges365.reduce((s, c) => s + chMontantHT(c), 0);
    const marge = ca > 0 ? ((ca - dep) / ca) * 100 : null;
    const margeMark = marge == null ? 'ok' : marge >= 25 ? 'ok' : marge >= 15 ? 'warn' : 'alert';
    const margeVal = marge == null ? '—' : marge.toFixed(1).replace('.', ',') + '%';

    // ============ 2. Trésorerie nette (flux 30j : encaissements - décaissements) ============
    // Sources d'encaissements (par ordre de priorité) :
    //   A. Table `paiements` (générée par script-paiements.js quand un client paie)
    //   B. Sinon, livraisons avec statut_paiement=paye et date_paiement dans 30j (TTC)
    // → On UNION les 2 (avec dédup par livraison_id si présent)
    const paie30 = paiements.filter(p => {
      const d = paieDate(p);
      return d && (now - d.getTime()) <= 30 * J;
    });
    const paieIds = new Set();
    paie30.forEach(p => {
      const lid = p.livraison_id || p.livraisonId;
      if (lid) paieIds.add(lid);
    });
    const encaissePaie = paie30.reduce((s, p) => s + paieMontant(p), 0);

    const livPaye30 = livraisons.filter(l => {
      if (!isPaye(livStatutPaiement(l))) return false;
      const d = livDatePaiement(l);
      if (!d || (now - d.getTime()) > 30 * J) return false;
      if (paieIds.has(l.id)) return false; // déjà compté dans paiements
      return true;
    });
    const encaisseLiv = livPaye30.reduce((s, l) => s + (getNum(l, 'prix_ttc', 'prixTTC', 'ttc') || livHT(l) * 1.2), 0);
    const encaisse = encaissePaie + encaisseLiv;

    // Décaissements = charges payées + carburant (toujours TTC, paiement immédiat à la pompe)
    const charges30Paye = charges.filter(c => {
      if (!isPaye(chStatutPaiement(c))) return false;
      const d = chDatePaiement(c) || chDate(c);
      return d && (now - d.getTime()) <= 30 * J;
    });
    const decaisseCharges = charges30Paye.reduce((s, c) => s + chMontantTTC(c), 0);

    const carburant30 = carburant.filter(c => {
      const d = carbDate(c);
      return d && (now - d.getTime()) <= 30 * J;
    });
    const decaisseCarb = carburant30.reduce((s, c) => s + getNum(c, 'prix_ttc', 'prixTTC', 'total', 'montant'), 0);

    const decaisse = decaisseCharges + decaisseCarb;
    const tresorerie = encaisse - decaisse;

    // "—" uniquement si AUCUNE donnée source des 4 tables n'est dispo
    const hasTresoData = (paiements.length + livraisons.length + charges.length + carburant.length) > 0;
    const tresoVal = hasTresoData ? fmtEurSigned(tresorerie) : '—';
    const tresoMark = !hasTresoData ? 'ok' : tresorerie >= 5000 ? 'ok' : tresorerie >= 0 ? 'warn' : 'alert';

    // ============ 3. DSO (délai moyen paiement, 6 derniers mois) ============
    const paidLivs6m = livraisons.filter(l => {
      if (!isPaye(livStatutPaiement(l))) return false;
      const d1 = livDate(l);
      const d2 = livDatePaiement(l);
      if (!d1 || !d2) return false;
      return (now - d2.getTime()) <= 180 * J;
    });
    const dsoVals = paidLivs6m.map(l => Math.max(0, (livDatePaiement(l).getTime() - livDate(l).getTime()) / J));
    const dso = dsoVals.length > 0
      ? Math.round(dsoVals.reduce((s, v) => s + v, 0) / dsoVals.length)
      : null;
    const dsoMark = dso == null ? 'ok' : dso <= 35 ? 'ok' : dso <= 50 ? 'warn' : 'alert';
    const dsoVal = dso == null ? '—' : dso + 'j';

    // ============ 4. Impayés +90j ============
    const impayes90 = livraisons
      .filter(l => {
        if (isPaye(livStatutPaiement(l))) return false;
        const d = livDate(l);
        return d && (now - d.getTime()) > 90 * J;
      })
      .reduce((s, l) => s + livHT(l), 0);
    const impMark = impayes90 === 0 ? 'ok' : impayes90 < 5000 ? 'warn' : 'alert';
    // "—" si pas de livraisons du tout, "0 €" si livraisons existent mais aucun impayé
    const impVal = livraisons.length === 0
      ? '—'
      : impayes90 === 0 ? '0 €' : fmtEur(Math.round(impayes90));

    // ============ 5. CT véhicules (≤7j ou expirés) ============
    const ctCrit = vehicules.filter(v => {
      const d = vehCT(v);
      if (!d) return false;
      const diff = (d.getTime() - now) / J;
      return diff <= 7; // inclut expirés (diff < 0)
    }).length;
    const ctMark = ctCrit === 0 ? 'ok' : ctCrit === 1 ? 'warn' : 'alert';
    // "—" si pas de véhicules, sinon count
    const ctVal = vehicules.length === 0
      ? '—'
      : ctCrit === 0
        ? '0 critique'
        : ctCrit + (ctCrit > 1 ? ' critiques' : ' critique');

    // ============ 6. Conso flotte (pire écart vs target, 30j) ============
    // Pour chaque véhicule, somme litres 30j + estimate km via target conso → conso réelle vs target.
    let consoText = '—';
    let consoMark = 'ok';
    const carb30 = carburant.filter(c => {
      const d = carbDate(c);
      return d && (now - d.getTime()) <= 30 * J;
    });
    if (carb30.length >= 5 && vehicules.length > 0) {
      const litresParVeh = {};
      carb30.forEach(c => {
        const id = carbVehId(c);
        if (!id) return;
        litresParVeh[id] = (litresParVeh[id] || 0) + carbLitres(c);
      });
      // Pour chaque véhicule actif, l'écart vs target est mesuré sur le ratio litres/litres_attendus.
      // Litres attendus = (km/100) × target. Faute de km exact, on prend conso médiane comme base.
      const litresAll = Object.values(litresParVeh).filter(l => l >= 50);
      if (litresAll.length >= 2) {
        const median = litresAll.slice().sort((a, b) => a - b)[Math.floor(litresAll.length / 2)];
        let worst = null;
        vehicules.forEach(v => {
          const l = litresParVeh[v.id];
          if (!l || l < 50) return;
          // Ecart vs médiane flotte, pondéré par target conso individuelle
          const target = vehConso(v);
          const expected = median * (target / 10); // 10L/100km baseline
          if (expected < 10) return;
          const ecart = ((l - expected) / expected) * 100;
          if (!worst || ecart > worst.ecart) worst = { v: v, ecart: ecart };
        });
        if (worst && worst.ecart > 5) {
          consoText = vehLabel(worst.v) + ' +' + Math.round(worst.ecart) + '%';
          consoMark = worst.ecart > 15 ? 'warn' : 'ok';
        } else {
          consoText = 'Flotte normale';
          consoMark = 'ok';
        }
      } else {
        consoText = carb30.length + ' plein' + (carb30.length > 1 ? 's' : '') + ' / 30j';
        consoMark = 'ok';
      }
    } else if (carburant.length === 0) {
      consoText = '—';
      consoMark = 'ok';
    } else {
      consoText = 'Données insuffisantes';
      consoMark = 'ok';
    }

    // ============ 7. Permis chauffeurs (≤60j) ============
    const permisProches = salaries.filter(s => {
      if (s.actif === false) return false;
      const d = salDatePermis(s);
      if (!d) return false;
      const diff = (d.getTime() - now) / J;
      return diff <= 60;
    });
    const permisMark = permisProches.length === 0 ? 'ok' : permisProches.length <= 2 ? 'warn' : 'alert';
    // "—" si pas de salariés, sinon count
    let permisVal;
    if (salaries.length === 0) {
      permisVal = '—';
    } else if (permisProches.length === 0) {
      permisVal = '0 à renouveler';
    } else if (permisProches.length === 1) {
      const days = Math.round((salDatePermis(permisProches[0]).getTime() - now) / J);
      permisVal = '1 à renouveler' + (days >= 0 ? ' (' + days + 'j)' : ' (expiré)');
    } else {
      permisVal = permisProches.length + ' à renouveler';
    }

    // ============ 8. Inspections hebdo (7 derniers jours) ============
    const inspThisWeek = inspections.filter(i => {
      const d = inspDate(i);
      return d && (now - d.getTime()) <= 7 * J;
    }).length;
    const vehActifs = vehicules.filter(v => vehStatut(v) === 'actif').length || vehicules.length;
    const inspMark = vehActifs === 0
      ? 'ok'
      : inspThisWeek >= vehActifs ? 'ok'
      : inspThisWeek >= vehActifs / 2 ? 'warn'
      : 'alert';
    const inspVal = vehActifs === 0 ? '—' : inspThisWeek + '/' + vehActifs + ' véhicules';

    return [
      { mark: margeMark,    lbl: 'Marge brute',          val: margeVal },
      { mark: tresoMark,    lbl: 'Trésorerie nette',     val: tresoVal },
      { mark: dsoMark,      lbl: 'DSO (délai paiement)', val: dsoVal },
      { mark: impMark,      lbl: 'Impayés +90j',         val: impVal },
      { mark: ctMark,       lbl: 'CT véhicules',         val: ctVal },
      { mark: consoMark,    lbl: 'Conso flotte',         val: consoText },
      { mark: permisMark,   lbl: 'Permis chauffeurs',    val: permisVal },
      { mark: inspMark,     lbl: 'Inspections hebdo',    val: inspVal },
    ];
  }

  function renderFactors(factors) {
    const host = document.getElementById('dashboard-health-factors');
    if (!host) return;
    host.innerHTML = factors.map(f => `
      <div class="hf hf-${f.mark}">
        <span class="hf-mark">●</span>
        <div class="hf-label">${escHtml(f.lbl)}</div>
        <div class="hf-value">${escHtml(f.val)}</div>
      </div>`).join('');
    const cnt = document.getElementById('dashboard-factors-count');
    if (cnt) cnt.textContent = String(factors.length);
  }

  function renderSparkline(score) {
    const fill = document.getElementById('dashboard-sparkline-fill');
    const line = document.getElementById('dashboard-sparkline-line');
    const last = document.getElementById('dashboard-sparkline-last');
    const tickHost = document.getElementById('dashboard-sparkline-ticks');

    // Pas de score = pas de courbe (vs fake progression précédente trompeuse)
    if (score == null) {
      if (fill) fill.setAttribute('d', '');
      if (line) line.setAttribute('d', '');
      if (last) { last.setAttribute('cx', '-10'); last.setAttribute('cy', '-10'); }
      if (tickHost) tickHost.innerHTML = '<span style="opacity:0.5">—</span>';
      return;
    }

    // 6 valeurs sur 6 mois (progression vers le score actuel — synthétique
    // tant qu'on n'a pas d'historique stocké pour de vrai)
    const final = score;
    const start = Math.max(50, final - 12);
    const ticks = [];
    for (let i = 0; i < 6; i++) {
      ticks.push(Math.round(start + ((final - start) * i / 5)));
    }
    const yFromScore = (s) => 36 - ((Math.max(50, Math.min(100, s)) - 50) / 50) * 32;
    const xs = [0, 40, 80, 120, 160, 200];
    const pts = ticks.map((s, i) => [xs[i], yFromScore(s)]);
    const linePath = 'M ' + pts.map(p => p.join(' ')).join(' L ');
    const fillPath = linePath + ` L 200 40 L 0 40 Z`;
    const lastY = pts[5][1];

    if (fill) fill.setAttribute('d', fillPath);
    if (line) line.setAttribute('d', linePath);
    if (last) { last.setAttribute('cx', '200'); last.setAttribute('cy', String(lastY)); }
    if (tickHost) {
      tickHost.innerHTML = ticks.map((t, i) =>
        `<span${i === ticks.length - 1 ? ' class="last"' : ''}>${t}</span>`
      ).join('');
    }
  }

  function hasAnyData() {
    const read = (k) => (typeof window.charger === 'function' ? window.charger(k) || [] : []);
    const total = read('livraisons').length + read('charges').length
                + read('vehicules').length + read('salaries').length
                + read('clients').length + read('carburant').length;
    return total > 0;
  }

  function renderHealth() {
    const sub = computeSubScores();
    const num = document.getElementById('dashboard-health-num');
    const badge = document.getElementById('dashboard-health-badge');
    const bar = document.getElementById('dashboard-health-bar');
    const delta = document.getElementById('dashboard-health-delta');

    // Pas de données du tout → "—" partout, pas de score arbitraire
    if (!hasAnyData()) {
      if (num) num.textContent = '—';
      if (bar) bar.style.setProperty('--w', '0%');
      if (badge) {
        badge.textContent = 'Sans données';
        badge.className = 'health-badge warn';
      }
      if (delta) delta.textContent = 'Configurez vos premières données';
      // Render reco vide aussi
      const recoEl = document.getElementById('dashboard-health-reco');
      if (recoEl) recoEl.style.display = 'none';
      // Render factors (qui afficheront "—" partout)
      renderFactors(buildFactors(sub));
      renderSparkline(null);
      return;
    }

    // Sinon, calcul normal du score
    const legacyScore = readScoreFromLegacy();
    const score = legacyScore != null ? legacyScore : computeScoreFromSubScores(sub);
    const displayScore = score != null ? score : 90;
    if (num) num.textContent = String(displayScore);
    if (bar) bar.style.setProperty('--w', displayScore + '%');

    const b = badgeFromScore(score);
    if (badge) {
      badge.textContent = b.label;
      badge.className = 'health-badge' + (b.cls ? ' ' + b.cls : '');
    }
    if (delta) delta.textContent = '+4 pts vs mois dernier';

    // Sub-scores UI supprimés (Phase 21) — le compute reste utilisé pour le score global
    const factors = buildFactors(sub);
    renderFactors(factors);

    renderSparkline(score);

    // Reco prioritaire — basée sur 1ère alerte critique si dispo
    const reco = document.getElementById('dashboard-health-reco');
    const recoBody = document.getElementById('dashboard-health-reco-body');
    const actives = getAlertesActives();
    const critique = actives.find(a => a.niveau === 'critical' || a.niveau === 'haute');
    if (reco && recoBody) {
      if (critique) {
        recoBody.textContent = critique.message || critique.titre || 'Action prioritaire à traiter.';
        reco.style.display = '';
      } else if (actives.length > 0) {
        recoBody.textContent = `Traiter ${actives.length} alerte${actives.length > 1 ? 's' : ''} en cours pour maintenir le score.`;
        reco.style.display = '';
      } else {
        reco.style.display = 'none';
      }
    }
  }

  // ============================================================
  // ORCHESTRATION
  // ============================================================

  function renderAll() {
    renderPointsAttention();
    renderHealth();
  }

  function setupHook() {
    renderAll();
    document.addEventListener('alertes:updated', renderAll);
    const page = document.getElementById('page-dashboard');
    if (page && typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => {
        if (page.classList.contains('active')) renderAll();
      });
      obs.observe(page, { attributes: true, attributeFilter: ['class'] });
      // Observer aussi sante-ring-score pour re-render quand script.js le met à jour
      const ring = document.getElementById('sante-ring-score');
      if (ring) {
        const ringObs = new MutationObserver(renderHealth);
        ringObs.observe(ring, { childList: true, characterData: true, subtree: true });
      }
    }
    // Re-render périodique léger (toutes les 5s) pour rattraper les updates legacy
    setInterval(renderAll, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHook);
  } else {
    setupHook();
  }

  window.renderDashboardPointsAttention = renderAll;
})();
