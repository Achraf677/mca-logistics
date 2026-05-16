/* Phase 42 refonte HTML — Heures KPI grid counts */
(function () {
  'use strict';

  function lire(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; }
    catch (_) { return []; }
  }

  function parseTime(t) {
    if (!t) return NaN;
    var parts = String(t).split(':');
    if (parts.length < 2) return NaN;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function update() {
    var kpiTotal = document.getElementById('heures-kpi-total');
    var kpiSup = document.getElementById('heures-kpi-sup');
    var kpiKm = document.getElementById('heures-kpi-km');
    var kpiCe561 = document.getElementById('heures-kpi-ce561');

    if (!kpiTotal && !kpiSup && !kpiKm) return;

    // Phase 91.42 — fix clé plannings (était plannings_hebdo inexistant)
    var plannings = lire('plannings');
    var alertes = lire('alertes_admin');
    var livraisons = lire('livraisons');
    // Source d'heures réelles : `heures` (clé principale) avec fallback `heures_pointage` legacy
    var heuresReelles = lire('heures');
    if (!heuresReelles.length) heuresReelles = lire('heures_pointage');

    // Total heures planifiées (toute la semaine en cours)
    var now = new Date();
    var totalMinutes = 0;
    var totalSupMinutes = 0;
    var SEMAINE_HEURES = 35 * 60; // seuil 35h

    plannings.forEach(function (p) {
      if (!p || !p.jours) return;
      var heuresPersonne = 0;
      Object.keys(p.jours).forEach(function (j) {
        var jour = p.jours[j];
        if (!jour || !jour.heureDebut || !jour.heureFin) return;
        var start = parseTime(jour.heureDebut);
        var end = parseTime(jour.heureFin);
        if (!isNaN(start) && !isNaN(end) && end > start) {
          var durMin = end - start;
          totalMinutes += durMin;
          heuresPersonne += durMin;
        }
      });
      if (heuresPersonne > SEMAINE_HEURES) {
        totalSupMinutes += heuresPersonne - SEMAINE_HEURES;
      }
    });

    var totalH = Math.round(totalMinutes / 60);
    var supH = Math.round(totalSupMinutes / 60);
    if (kpiTotal) kpiTotal.textContent = totalH > 0 ? totalH + ' h' : '—';
    if (kpiSup) kpiSup.textContent = supH > 0 ? supH + ' h' : '—';

    // kpi-sub "Heures totales" : comparaison mois précédent (via heures réelles fusionnées)
    var subTotal = document.getElementById('heures-kpi-total-sub');
    if (subTotal && totalH > 0) {
      // Phase 91.42 — Lit la clé unifiée `heures` (fallback heures_pointage)
      try {
        var moisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        var moisPrecFin = new Date(now.getFullYear(), now.getMonth(), 0);
        var totalMoisPrecMin = 0;
        heuresReelles.forEach(function (h) {
          var d = new Date(h.date || h.datePointage || 0);
          if (d >= moisPrec && d <= moisPrecFin) {
            var dur = parseTime(h.heureFin) - parseTime(h.heureDebut);
            if (!isNaN(dur) && dur > 0) totalMoisPrecMin += dur;
          }
        });
        var totalMoisPrecH = Math.round(totalMoisPrecMin / 60);
        if (totalMoisPrecH > 0) {
          var diffH = totalH - totalMoisPrecH;
          var moisPrecLabel = moisPrec.toLocaleDateString('fr-FR', { month: 'long' });
          if (diffH > 0) subTotal.innerHTML = '<span style="color:#9bb1a4;font-weight:700">+' + diffH + 'h</span> vs ' + moisPrecLabel;
          else if (diffH < 0) subTotal.innerHTML = '<span style="color:var(--brand);font-weight:700">' + diffH + 'h</span> vs ' + moisPrecLabel;
          else subTotal.textContent = '= vs ' + moisPrecLabel;
        } else {
          subTotal.textContent = plannings.length + ' plannings actifs';
        }
      } catch (_) {
        subTotal.textContent = plannings.length + ' plannings actifs';
      }
    } else if (subTotal) {
      subTotal.textContent = plannings.length + ' plannings actifs';
    }

    // Km parcourus ce mois (livraisons) + "Sur N véhicules" kpi-sub
    if (kpiKm) {
      var moisStart = new Date(now.getFullYear(), now.getMonth(), 1);
      var livsThisMois = livraisons.filter(function (l) {
        if (!l) return false;
        var d = new Date(l.date || l.dateLivraison || '');
        return !isNaN(d.getTime()) && d >= moisStart;
      });
      var kmTotal = livsThisMois.reduce(function (s, l) { return s + (parseFloat(l.distance) || 0); }, 0);
      kpiKm.textContent = kmTotal > 0 ? Math.round(kmTotal) + ' km' : '—';
      var kpiKmSub = document.getElementById('heures-kpi-km-sub');
      if (kpiKmSub) {
        var vehs = new Set();
        livsThisMois.forEach(function (l) {
          var v = l.vehiculeId || l.vehicule_id || (l.vehicule && (l.vehicule.id || l.vehicule.immatriculation || l.vehicule)) || '';
          if (v) vehs.add(String(v));
        });
        var nbVehs = vehs.size;
        kpiKmSub.textContent = nbVehs > 0 ? 'Sur ' + nbVehs + ' véhicule' + (nbVehs > 1 ? 's' : '') : 'Livraisons ce mois';
      }
    }

    // CE 561 alertes (alertes de type dépassement CE561)
    if (kpiCe561) {
      var ce561Alertes = alertes.filter(function (a) {
        if (!a || a.traitee) return false;
        var t = (a.type || '').toLowerCase();
        return t.includes('ce561') || t.includes('561') || t.includes('depassement') || t.includes('conduite');
      });
      var ce561Count = ce561Alertes.length;
      kpiCe561.textContent = ce561Count > 0 ? ce561Count : '—';
      // kpi-sub : afficher le nom abrégé du premier chauffeur concerné
      var subCe561 = document.getElementById('heures-kpi-ce561-sub');
      if (subCe561) {
        if (ce561Count > 0) {
          var nomChauffeur = ce561Alertes[0].chauffeur || ce561Alertes[0].conducteur || '';
          var parts = String(nomChauffeur).trim().split(/\s+/);
          var abrev = parts.length >= 2 ? parts[0] + ' ' + parts[1][0] + '.' : nomChauffeur;
          subCe561.textContent = abrev ? abrev + ' (×' + ce561Count + ')' : '×' + ce561Count + ' alertes';
          subCe561.style.display = '';
        } else {
          subCe561.textContent = '';
          subCe561.style.display = 'none';
        }
      }
    }

    // Phase 62 — badge cards heures & km
    var cardBadge = document.getElementById('heures-card-badge');
    var kmBadge = document.getElementById('heures-km-badge');
    if (cardBadge && totalH > 0) cardBadge.textContent = totalH + 'h ce mois';
    if (kmBadge) {
      var kmVal = document.getElementById('heures-kpi-km');
      var kmTxt = kmVal ? kmVal.textContent : '—';
      kmBadge.textContent = kmTxt !== '—' ? kmTxt + ' ce mois' : '';
    }

    // Phase 62 — chips chauffeur (Tous + un chip par salarié)
    var chipsContainer = document.getElementById('heures-chauffeur-chips');
    if (chipsContainer && !chipsContainer.dataset.built) {
      var salaries = lire('salaries');
      var nomsBySalId = {};
      salaries.forEach(function(s) {
        if (s && s.id && (s.nom || s.prenom)) {
          nomsBySalId[s.id] = ((s.prenom || '') + ' ' + (s.nom || '')).trim();
        }
      });
      // Collecter IDs chauffeurs ayant des plannings
      var chaufIdsAvecPlannings = [];
      plannings.forEach(function(p) {
        if (p && p.salId && nomsBySalId[p.salId] && chaufIdsAvecPlannings.indexOf(p.salId) === -1) {
          chaufIdsAvecPlannings.push(p.salId);
        }
      });
      var html = '<button class="ds-chip active" role="tab" aria-selected="true" onclick="window.__heuresFiltreChauf=\'\';this.parentNode.querySelectorAll(\'.ds-chip\').forEach(function(b){b.classList.remove(\'active\');b.setAttribute(\'aria-selected\',\'false\')});this.classList.add(\'active\');this.setAttribute(\'aria-selected\',\'true\');var f=document.getElementById(\'filtre-heures-salarie\');if(f){f.value=\'\';var e=new Event(\'input\');f.dispatchEvent(e)}">Tous</button>';
      chaufIdsAvecPlannings.forEach(function(salId) {
        var nom = nomsBySalId[salId] || salId;
        var parts = nom.trim().split(/\s+/);
        var label = parts.length >= 2 ? parts[0] + ' ' + parts[parts.length-1][0] + '.' : nom;
        html += '<button class="ds-chip" role="tab" aria-selected="false" data-sal-id="' + salId + '" onclick="(function(btn,n){window.__heuresFiltreChauf=n;btn.parentNode.querySelectorAll(\'.ds-chip\').forEach(function(b){b.classList.remove(\'active\');b.setAttribute(\'aria-selected\',\'false\')});btn.classList.add(\'active\');btn.setAttribute(\'aria-selected\',\'true\');var f=document.getElementById(\'filtre-heures-salarie\');if(f){f.value=n;var e=new Event(\'input\');f.dispatchEvent(e)}})(this,\'' + nom.replace(/'/g, "\\'") + '\')">' + label + '</button>';
      });
      chipsContainer.innerHTML = html;
      chipsContainer.dataset.built = '1';
    }

    // Phase 59 — sub-meta format mockup (X chauffeurs · Y jours pointés)
    var subChauffeurs = document.getElementById('heures-section-sub-chauffeurs');
    var subJours = document.getElementById('heures-section-sub-jours');
    if (subChauffeurs || subJours) {
      var chauffeursIds = new Set();
      var joursPointes = 0;
      plannings.forEach(function (p) {
        if (!p || !p.jours) return;
        var hasAny = false;
        Object.keys(p.jours).forEach(function (j) {
          var jour = p.jours[j];
          if (jour && jour.heureDebut && jour.heureFin) { joursPointes++; hasAny = true; }
        });
        if (hasAny && p.salId) chauffeursIds.add(p.salId);
      });
      if (subChauffeurs) subChauffeurs.textContent = chauffeursIds.size;
      if (subJours) subJours.textContent = joursPointes;
    }
    // Mirror period label from heures-semaine-label into section sub-meta
    var subPeriode = document.getElementById('heures-section-sub-periode');
    if (subPeriode) {
      var labelEl = document.getElementById('heures-semaine-label');
      var datesEl = document.getElementById('heures-semaine-dates');
      var labelTxt = labelEl && labelEl.textContent ? labelEl.textContent.trim() : '';
      var datesTxt = datesEl && datesEl.textContent ? datesEl.textContent.trim() : '';
      subPeriode.textContent = labelTxt || datesTxt || '—';
    }
  }

  function tryAttach() {
    if (!document.getElementById('heures-kpi-total') && !document.getElementById('heures-kpi-km')) return false;
    update();
    if (!window.__refonteHeuresIv) {
      window.__refonteHeuresIv = setInterval(update, 5000);
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

  window.refonteHeuresUpdateCounts = update;

  // Alias export paie (bouton "Export paie" dans section-head)
  window.exporterHeuresPaie = function() {
    if (typeof window.exporterHeuresExcel === 'function') return window.exporterHeuresExcel();
    if (typeof window.exporterRecapHeures === 'function') return window.exporterRecapHeures();
    console.warn('[heures] exporterHeuresPaie: aucune fonction export disponible');
  };
})();
