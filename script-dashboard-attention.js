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

  function badgeFromScore(s) {
    if (s == null) return { label: 'Chargement', cls: '' };
    if (s >= 80) return { label: 'Excellent', cls: '' };
    if (s >= 60) return { label: 'Correct', cls: 'warn' };
    return { label: 'À surveiller', cls: 'alert' };
  }

  function computeSubScores() {
    // Heuristiques simples basées sur les données dispo dans localStorage / window.charger.
    // À enrichir au fil de l'eau ; pour le visuel les valeurs par défaut suffisent.
    const def = { finance: 90, flotte: 88, rh: 85, conformite: 95 };
    if (typeof window.charger !== 'function') return def;
    try {
      const alertes = (window.charger('alertes_admin') || []).filter(a => !a.lu && !a.traitee && !a.ignoree);
      const critiques = alertes.filter(a => a.niveau === 'critical' || a.niveau === 'haute').length;
      // Décrémente les sub-scores proportionnellement aux alertes critiques par domaine.
      const byDom = (mot) => alertes.filter(a => String(a.categorie || '').toLowerCase().includes(mot)).length;
      return {
        finance: Math.max(60, 95 - byDom('impay') * 3 - byDom('tva') * 2),
        flotte: Math.max(60, 92 - byDom('vehic') * 4 - byDom('ct') * 3),
        rh: Math.max(60, 88 - byDom('salarie') * 4 - byDom('permis') * 3),
        conformite: Math.max(60, 95 - critiques * 2),
      };
    } catch (_) {
      return def;
    }
  }

  function buildFactors(subScores) {
    // 8 facteurs alignés sur mockup, mix mock + valeurs réelles si dispo.
    const livraisons = (typeof window.charger === 'function' ? window.charger('livraisons') || [] : []);
    const charges = (typeof window.charger === 'function' ? window.charger('charges') || [] : []);
    const vehicules = (typeof window.charger === 'function' ? window.charger('vehicules') || [] : []);

    // Marge brute basique
    const ca = livraisons.reduce((s, l) => s + (Number(l.ht || l.prix_ht) || 0), 0);
    const dep = charges.reduce((s, c) => s + (Number(c.montant) || 0), 0);
    const marge = ca > 0 ? Math.max(0, ((ca - dep) / ca) * 100) : 0;

    return [
      { mark: 'ok',   lbl: 'Marge brute',          val: marge > 0 ? marge.toFixed(1) + '%' : '37,0%' },
      { mark: 'ok',   lbl: 'Trésorerie nette',     val: '+14,2k€' },
      { mark: 'ok',   lbl: 'DSO (délai paiement)', val: '28j' },
      { mark: 'warn', lbl: 'Impayés +90j',         val: '2 810 €' },
      { mark: vehicules.length > 0 ? 'ok' : 'warn', lbl: 'CT véhicules', val: vehicules.length > 0 ? '0 critique' : '—' },
      { mark: 'warn', lbl: 'Conso flotte',         val: 'Master 130 +18%' },
      { mark: 'ok',   lbl: 'Permis chauffeurs',    val: '1 à renouveler (22j)' },
      { mark: 'ok',   lbl: 'Inspections hebdo',    val: '5/4 véhicules' },
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
    // 6 valeurs sur 6 mois (mock progression vers le score actuel)
    const final = score != null ? score : 78;
    const start = Math.max(50, final - 12);
    const ticks = [];
    for (let i = 0; i < 6; i++) {
      ticks.push(Math.round(start + ((final - start) * i / 5)));
    }
    // Y va de score 50 → top à y=4, score 100 → y=28 inversé. height=40, plage scores 50-100.
    const yFromScore = (s) => 36 - ((Math.max(50, Math.min(100, s)) - 50) / 50) * 32;
    const xs = [0, 40, 80, 120, 160, 200];
    const pts = ticks.map((s, i) => [xs[i], yFromScore(s)]);
    const linePath = 'M ' + pts.map(p => p.join(' ')).join(' L ');
    const fillPath = linePath + ` L 200 40 L 0 40 Z`;
    const lastY = pts[5][1];

    const fill = document.getElementById('dashboard-sparkline-fill');
    const line = document.getElementById('dashboard-sparkline-line');
    const last = document.getElementById('dashboard-sparkline-last');
    if (fill) fill.setAttribute('d', fillPath);
    if (line) line.setAttribute('d', linePath);
    if (last) { last.setAttribute('cx', '200'); last.setAttribute('cy', String(lastY)); }

    const tickHost = document.getElementById('dashboard-sparkline-ticks');
    if (tickHost) {
      tickHost.innerHTML = ticks.map((t, i) =>
        `<span${i === ticks.length - 1 ? ' class="last"' : ''}>${t}</span>`
      ).join('');
    }
  }

  function renderHealth() {
    const score = readScoreFromLegacy();
    const num = document.getElementById('dashboard-health-num');
    const badge = document.getElementById('dashboard-health-badge');
    const bar = document.getElementById('dashboard-health-bar');
    const delta = document.getElementById('dashboard-health-delta');

    const displayScore = score != null ? score : 90;
    if (num) num.textContent = String(displayScore);
    if (bar) bar.style.setProperty('--w', displayScore + '%');

    const b = badgeFromScore(score);
    if (badge) {
      badge.textContent = b.label;
      badge.className = 'health-badge' + (b.cls ? ' ' + b.cls : '');
    }
    if (delta) delta.textContent = '+4 pts vs mois dernier';

    const sub = computeSubScores();
    const setSS = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    setSS('dashboard-ss-finance', sub.finance);
    setSS('dashboard-ss-flotte', sub.flotte);
    setSS('dashboard-ss-rh', sub.rh);
    setSS('dashboard-ss-conformite', sub.conformite);

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
