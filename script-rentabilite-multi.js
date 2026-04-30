/**
 * MCA Logistics — Rentabilite multi-axes (analyses reelles)
 *
 * Difference avec script-rentabilite.js :
 *   - script-rentabilite.js   : SIMULATEUR (parametres manuels, projection)
 *   - script-rentabilite-multi : ANALYSES (donnees reelles, marges par axe)
 *
 * 4 axes :
 *   1. Par vehicule  : CA livraisons - couts directs (carburant, charges) - couts amortissement
 *   2. Par client    : marge brute = CA - couts directs imputables (carburant si rattache, prorata salaire)
 *   3. Par chauffeur : marge = CA livraisons effectuees - salaire - heures - carburant vehicules
 *   4. Par tournee   : marge journaliere chauffeur (CA - couts directs du jour)
 *
 * Tournee = chauffeur + date (groupage automatique, pas de stockage).
 *
 * Config (localStorage 'config_rentabilite') :
 *   - tarifHoraireDefaut   : taux horaire par defaut chauffeur (€/h)
 *   - coutKmDefaut         : cout km vehicule (amortissement + entretien)
 *   - methodeRepartition   : 'livraisons' | 'ca' | 'km'
 */

(function () {
  'use strict';

  var DEFAULTS = {
    tarifHoraireDefaut: 12,    // €/h brut chargé estime
    coutKmDefaut: 0.15,        // € par km roule (amortissement + entretien)
    methodeRepartition: 'livraisons'
  };

  function getConfig() {
    try {
      var raw = localStorage.getItem('config_rentabilite');
      if (!raw) return Object.assign({}, DEFAULTS);
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem('config_rentabilite', JSON.stringify(cfg || {}));
      return true;
    } catch (e) { return false; }
  }

  // ID stable d'une "tournee" = chauffeur + date (jour)
  function getTourneeId(liv) {
    if (!liv) return null;
    var chauf = liv.chaufId || 'sans-chauffeur';
    var date = (liv.date || '').slice(0, 10);
    if (!date) return null;
    return chauf + '__' + date;
  }

  function getMontantHTLiv(liv) {
    if (!liv) return 0;
    if (liv.prixHT != null && liv.prixHT !== '') return parseFloat(liv.prixHT) || 0;
    var tva = parseFloat(liv.tauxTVA) || 20;
    var prix = parseFloat(liv.prix) || 0;
    return prix / (1 + tva / 100);
  }

  // ===== Calcul par vehicule =====
  // CA = Σ HT livraisons assignees au vehicule
  // Couts = carburant rattache (vehId) + charges rattachees (vehId, hors TVA/salaires)
  //         + entretiens lies + km × coutKmDefaut (amortissement)
  function calculerRentabiliteParVehicule(range) {
    var livraisons = (typeof charger === 'function' ? charger('livraisons') : []).filter(function (l) {
      return inRange(l.date, range);
    });
    var pleins = (typeof charger === 'function' ? charger('carburant') : []).filter(function (p) {
      return inRange(p.date, range);
    });
    var charges = (typeof charger === 'function' ? charger('charges') : []).filter(function (c) {
      return inRange(c.date, range) && c.categorie !== 'tva' && c.categorie !== 'salaires';
    });
    var entretiens = (typeof charger === 'function' ? charger('entretiens') : []).filter(function (e) {
      return inRange(e.date, range);
    });
    var vehicules = (typeof charger === 'function' ? charger('vehicules') : []);
    var cfg = getConfig();
    var coutKm = parseFloat(cfg.coutKmDefaut) || 0;

    var stats = {};
    function ensure(vehId) {
      if (!stats[vehId]) {
        var v = vehicules.find(function (x) { return x.id === vehId; });
        stats[vehId] = {
          vehId: vehId,
          immat: v ? v.immat : (vehId === 'sans-vehicule' ? '— Sans véhicule —' : '?'),
          modele: v ? v.modele : '',
          ca: 0, nbLivraisons: 0, kmTotal: 0,
          coutCarburant: 0, coutCharges: 0, coutEntretien: 0, coutAmortissement: 0
        };
      }
      return stats[vehId];
    }

    livraisons.forEach(function (l) {
      var s = ensure(l.vehId || 'sans-vehicule');
      s.ca += getMontantHTLiv(l);
      s.nbLivraisons++;
      s.kmTotal += parseFloat(l.distance) || 0;
    });
    pleins.forEach(function (p) {
      var s = ensure(p.vehId || 'sans-vehicule');
      var ttc = parseFloat(p.total) || 0;
      var taux = parseFloat(p.tauxTVA) || 20;
      s.coutCarburant += ttc / (1 + taux / 100);
    });
    charges.forEach(function (c) {
      if (!c.vehId) return; // charges non rattachees au vehicule = exclues du calcul direct
      var s = ensure(c.vehId);
      var ttc = parseFloat(c.montant) || 0;
      var taux = parseFloat(c.tauxTVA) || 20;
      s.coutCharges += ttc / (1 + taux / 100);
    });
    entretiens.forEach(function (e) {
      if (!e.vehId) return;
      var s = ensure(e.vehId);
      s.coutEntretien += parseFloat(e.cout) || 0;
    });

    // Amortissement = km × coutKmDefaut (proxy d'usure)
    Object.keys(stats).forEach(function (k) {
      var s = stats[k];
      s.coutAmortissement = (s.kmTotal || 0) * coutKm;
      s.coutTotal = s.coutCarburant + s.coutCharges + s.coutEntretien + s.coutAmortissement;
      s.marge = s.ca - s.coutTotal;
      s.margePct = s.ca > 0 ? (s.marge / s.ca) * 100 : 0;
    });

    return Object.values(stats).sort(function (a, b) { return b.marge - a.marge; });
  }

  function inRange(date, range) {
    if (!range) return true;
    if (!date) return false;
    return date >= range.debut && date <= range.fin;
  }

  function euros(n) {
    if (typeof window.euros === 'function') return window.euros(n);
    return (Math.round((n || 0) * 100) / 100).toFixed(2) + ' €';
  }

  // ===== UI =====
  function changerSousOngletRentabilite(nom) {
    var ids = ['simulateur', 'vehicule', 'client', 'chauffeur', 'tournee'];
    ids.forEach(function (id) {
      var sec = document.getElementById('rent-tab-' + id);
      if (sec) sec.style.display = (id === nom) ? '' : 'none';
      var btn = document.getElementById('rent-tab-btn-' + id);
      if (btn) {
        btn.classList.toggle('active', id === nom);
      }
    });
    if (nom === 'vehicule') afficherRentabiliteParVehicule();
    if (nom === 'client')   { if (typeof window.afficherRentabiliteParClient === 'function') window.afficherRentabiliteParClient(); }
    if (nom === 'chauffeur'){ if (typeof window.afficherRentabiliteParChauffeur === 'function') window.afficherRentabiliteParChauffeur(); }
    if (nom === 'tournee')  { if (typeof window.afficherRentabiliteParTournee === 'function') window.afficherRentabiliteParTournee(); }
  }

  function getRangeAnalyse() {
    // Reutilise le mois selectionne par le simulateur si dispo, sinon mois courant.
    if (typeof getRentMoisRange === 'function') {
      try { return getRentMoisRange(); } catch (e) { /* fallback */ }
    }
    var d = new Date();
    var debut = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    var fin   = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-31';
    return { debut: debut, fin: fin };
  }

  function afficherRentabiliteParVehicule() {
    var range = getRangeAnalyse();
    var stats = calculerRentabiliteParVehicule(range);
    var tb = document.getElementById('tb-rent-vehicule');
    if (!tb) return;
    if (!stats.length) {
      tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucune donnée sur cette période.</td></tr>';
      majTotauxRentVehicule({ ca: 0, marge: 0, nbLivraisons: 0 });
      return;
    }
    tb.innerHTML = stats.map(function (s) {
      var couleur = s.marge >= 0 ? '#28a745' : '#dc3545';
      return '<tr>' +
        '<td><strong>' + escapeHtml(s.immat) + '</strong>' + (s.modele ? '<div style="font-size:.75rem;color:var(--text-muted)">' + escapeHtml(s.modele) + '</div>' : '') + '</td>' +
        '<td>' + s.nbLivraisons + '</td>' +
        '<td>' + (s.kmTotal ? Math.round(s.kmTotal) + ' km' : '—') + '</td>' +
        '<td>' + euros(s.ca) + '</td>' +
        '<td style="font-size:.85rem">' + euros(s.coutCarburant) + '</td>' +
        '<td style="font-size:.85rem">' + euros(s.coutCharges + s.coutEntretien) + '</td>' +
        '<td style="font-size:.85rem;color:var(--text-muted)">' + euros(s.coutAmortissement) + '</td>' +
        '<td style="color:' + couleur + ';font-weight:700">' + euros(s.marge) + ' <span style="font-size:.74rem;font-weight:400">(' + s.margePct.toFixed(1) + '%)</span></td>' +
      '</tr>';
    }).join('');
    var totaux = stats.reduce(function (acc, s) {
      acc.ca += s.ca;
      acc.marge += s.marge;
      acc.nbLivraisons += s.nbLivraisons;
      return acc;
    }, { ca: 0, marge: 0, nbLivraisons: 0 });
    majTotauxRentVehicule(totaux);
  }

  function majTotauxRentVehicule(totaux) {
    var setTxt = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('rent-veh-total-ca', euros(totaux.ca || 0));
    setTxt('rent-veh-total-marge', euros(totaux.marge || 0));
    setTxt('rent-veh-total-livs', totaux.nbLivraisons || 0);
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== Config UI =====
  function ouvrirConfigRentabilite() {
    var cfg = getConfig();
    var setVal = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    setVal('cfg-rent-tarif-horaire', cfg.tarifHoraireDefaut);
    setVal('cfg-rent-cout-km',       cfg.coutKmDefaut);
    setVal('cfg-rent-methode',       cfg.methodeRepartition);
    if (typeof openModal === 'function') openModal('modal-config-rentabilite');
  }

  function enregistrerConfigRentabilite() {
    var getNum = function (id, def) {
      var v = parseFloat(document.getElementById(id)?.value);
      return Number.isFinite(v) ? v : def;
    };
    var newCfg = {
      tarifHoraireDefaut: Math.max(0, getNum('cfg-rent-tarif-horaire', 12)),
      coutKmDefaut:       Math.max(0, getNum('cfg-rent-cout-km', 0.15)),
      methodeRepartition: document.getElementById('cfg-rent-methode')?.value || 'livraisons'
    };
    saveConfig(newCfg);
    if (typeof closeModal === 'function') closeModal('modal-config-rentabilite');
    if (typeof afficherToast === 'function') afficherToast('✅ Config rentabilité enregistrée');
    afficherRentabiliteParVehicule();
  }

  // Expose
  window.getConfigRentabilite          = getConfig;
  window.getTourneeIdLivraison         = getTourneeId;
  window.calculerRentabiliteParVehicule = calculerRentabiliteParVehicule;
  window.afficherRentabiliteParVehicule = afficherRentabiliteParVehicule;
  window.changerSousOngletRentabilite  = changerSousOngletRentabilite;
  window.ouvrirConfigRentabilite       = ouvrirConfigRentabilite;
  window.enregistrerConfigRentabilite  = enregistrerConfigRentabilite;
  window.getRangeAnalyseRentabilite    = getRangeAnalyse;
})();
