/**
 * MCA Logistics — Sprint 4 — Dashboard hero ring (score santé 0-100 + SVG ring animé) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4894-5002 (2026-05-16).
 */

/* ================================================================
   SPRINT 4 — DASHBOARD HIÉRARCHISÉ : SCORE DE SANTÉ + HERO RING
   calculerScoreSante() : 0-100 selon CA, bénéfice, impayés, alertes
   afficherHeroSante()  : applique état visuel + ring SVG animé
   ================================================================ */
(function() {
  function lireNombreDepuisDOM(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const txt = (el.textContent || '').replace(/[^0-9,.-]/g, '').replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(txt);
    return isNaN(n) ? 0 : n;
  }

  window.calculerScoreSante = function() {
    const ca       = lireNombreDepuisDOM('kpi-ca-mois');
    const benefice = lireNombreDepuisDOM('kpi-benefice');
    const impayes  = lireNombreDepuisDOM('kpi-solde');
    const alertes  = lireNombreDepuisDOM('kpi-alertes');

    if (ca <= 0 && benefice === 0) {
      return { score: 0, etat: 'vide', raisons: ['Pas encore de données'] };
    }

    let score = 100;
    const raisons = [];

    if (benefice < 0) { score -= 40; raisons.push('Bénéfice négatif'); }
    else if (ca > 0 && benefice / ca < 0.1) { score -= 15; raisons.push('Marge faible (<10%)'); }

    if (impayes > 0 && ca > 0) {
      const malus = Math.min(25, Math.round((impayes / Math.max(ca, 1)) * 100));
      score -= malus;
      raisons.push(malus + ' pts impayés');
    }

    if (alertes > 0) {
      const malus = Math.min(20, alertes * 4);
      score -= malus;
      raisons.push(alertes + ' alerte(s)');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let etat;
    if (score >= 75) etat = 'bon';
    else if (score >= 50) etat = 'moyen';
    else etat = 'mauvais';

    return { score, etat, raisons };
  };

  window.afficherHeroSante = function() {
    const res = window.calculerScoreSante();
    const hero = document.getElementById('kpi-sante-globale');
    const ring = document.getElementById('sante-ring-fg');
    const scoreText = document.getElementById('sante-ring-score');

    if (hero) {
      hero.classList.remove('etat-bon', 'etat-moyen', 'etat-mauvais', 'etat-vide');
      hero.classList.add('etat-' + res.etat);
    }
    if (ring) {
      const C = 2 * Math.PI * 52; // ≈ 326.73
      const dash = (res.score / 100) * C;
      ring.setAttribute('stroke-dasharray', dash.toFixed(2) + ' ' + C.toFixed(2));
    }
    if (scoreText) {
      scoreText.textContent = res.etat === 'vide' ? '—' : String(res.score);
    }
  };

  // Hook : à chaque appel de afficherDashboard, mettre à jour le hero ring
  const afficherDashboardOrig = window.afficherDashboard;
  if (typeof afficherDashboardOrig === 'function') {
    window.afficherDashboard = function() {
      const r = afficherDashboardOrig.apply(this, arguments);
      try { window.afficherHeroSante(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:afficherDashboard-heroSante]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
      return r;
    };
  }

  // Premier rendu au chargement si dashboard déjà actif
  function initHeroSante() {
    setTimeout(function() {
      try { window.afficherHeroSante(); } catch (e) {
        if (window.MCA && window.MCA.shouldLog && window.MCA.shouldLog('errors')) {
          console.warn('[script:initHeroSante]', e);
        }
        if (window.Sentry && window.Sentry.captureException) {
          try { window.Sentry.captureException(e); } catch (_) {}
        }
      }
    }, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroSante);
  } else {
    initHeroSante();
  }

})();
