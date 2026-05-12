/* Phase 45 refonte HTML — Brouillons IA KPI grid counts */
(function () {
  'use strict';

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function update() {
    var kpiAttente = document.getElementById('brouillons-kpi-attente');
    var kpiValidees = document.getElementById('brouillons-kpi-validees');
    var kpiRejetees = document.getElementById('brouillons-kpi-rejetees');
    var kpiTemps = document.getElementById('brouillons-kpi-temps');
    var kpiValideesSub = document.getElementById('brouillons-kpi-validees-sub');

    if (!kpiAttente && !kpiValidees) return;

    // En attente — lit l'état AIBrouillons si dispo (déjà polled), sinon requête Supabase
    var pending = 0;
    if (window.AIBrouillons && window.AIBrouillons._state) {
      pending = window.AIBrouillons._state.pendingCount || 0;
    } else {
      var client = getClient();
      if (client) {
        try {
          var res = await client.from('ai_pending_actions')
            .select('id', { count: 'exact' })
            .eq('status', 'pending');
          pending = res.count || 0;
        } catch (_) {}
      }
    }

    if (kpiAttente) kpiAttente.textContent = pending > 0 ? pending : '—';

    // Phase 59 — section-head sub-meta count (mockup-aligned)
    var subCount = document.getElementById('brouillons-section-sub-count');
    if (subCount) subCount.textContent = pending;

    // Met à jour le libellé du chip "En attente" avec le count
    var chipAttente = document.querySelector('#brouillons-chips .ds-chip[data-brouillons-statut="pending"]');
    if (chipAttente) {
      chipAttente.textContent = pending > 0 ? 'En attente (' + pending + ')' : 'En attente';
    }

    // Validées / rejetées ce mois via Supabase
    var clientQ = getClient();
    if (!clientQ) return;

    try {
      var moisStart = new Date();
      moisStart.setDate(1);
      moisStart.setHours(0, 0, 0, 0);
      var moisStartIso = moisStart.toISOString();

      var resValidees = await clientQ.from('ai_pending_actions')
        .select('id', { count: 'exact' })
        .eq('status', 'executed')
        .gte('created_at', moisStartIso);
      var validees = resValidees.count || 0;

      var resRejetees = await clientQ.from('ai_pending_actions')
        .select('id', { count: 'exact' })
        .eq('status', 'rejected')
        .gte('created_at', moisStartIso);
      var rejetees = resRejetees.count || 0;

      if (kpiValidees) kpiValidees.textContent = validees > 0 ? validees : '—';
      if (kpiValideesSub) {
        var total = validees + rejetees;
        kpiValideesSub.textContent = total > 0 ? Math.round(validees / total * 100) + '% taux d\'acceptation' : 'Ce mois';
      }

      if (kpiRejetees) kpiRejetees.textContent = rejetees > 0 ? rejetees : '—';

      // Phase 59 — section-head sub-meta "traitées ce mois" (validées + rejetées)
      var subTraitees = document.getElementById('brouillons-section-sub-traitees');
      if (subTraitees) subTraitees.textContent = (validees + rejetees);

      // Économie temps : ~5 min/action validée → heures arrondies
      if (kpiTemps) {
        var mins = validees * 5;
        kpiTemps.textContent = mins >= 60 ? '~' + Math.floor(mins / 60) + 'h' : (mins > 0 ? '~' + mins + ' min' : '—');
      }
    } catch (_) {}
  }

  // Phase 58 polish (BUG-025) : chips filter wire AIBrouillons.setStatusFilter
  window.brouillonsChipFilter = function (btn) {
    document.querySelectorAll('#brouillons-chips .ds-chip').forEach(function (c) {
      c.classList.toggle('active', c === btn);
    });
    var filter = btn.getAttribute('data-brouillons-statut') || 'pending';
    if (window.AIBrouillons && typeof window.AIBrouillons.setStatusFilter === 'function') {
      window.AIBrouillons.setStatusFilter(filter);
    }
  };

  function tryAttach() {
    if (!document.getElementById('brouillons-kpi-attente') && !document.getElementById('brouillons-kpi-validees')) return false;
    update();
    if (!window.__refonteBrouillonsIv) {
      window.__refonteBrouillonsIv = setInterval(update, 10000);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!tryAttach()) { var r = 0, iv = setInterval(function () { if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
    });
  } else {
    if (!tryAttach()) { var r = 0, iv = setInterval(function () { if (tryAttach() || ++r > 20) clearInterval(iv); }, 500); }
  }

  window.refonteBrouillonsUpdateCounts = update;
})();
