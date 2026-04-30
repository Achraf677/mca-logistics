/**
 * MCA Logistics — Detection anomalies carburant
 *
 * PR1 (regles 1-3) :
 *   1. Conso L/100 d'un plein > moyenne 6 derniers + X1%        [orange]
 *   2. Conso L/100 d'un plein > moyenne 6 derniers + X2%        [rouge]
 *   3. Litres > capacite reservoir vehicule (si renseigne)      [rouge]
 *
 * PR2 (regles 4-7) :
 *   4. 2 pleins en moins de 24h sans km parcourus               [orange]
 *   5. Km releve < km du plein precedent                        [rouge]
 *   6. Km/jour > seuil configurable depuis le plein precedent   [orange]
 *   7. Plein hors heures ouvrees (week-end ou nuit)             [orange]
 *
 * Sortie : alertes type "carburant_anomalie" via ajouterAlerteSiAbsente.
 * stageKey unique par plein -> pas de duplicata si re-run.
 *
 * Config : localStorage 'config_anomalies_carburant' (cf. getConfig()).
 */

(function () {
  'use strict';

  var DEFAULTS = {
    seuilConsoOrange: 0.25,   // +25%
    seuilConsoRouge: 0.50,    // +50%
    fenetreHisto: 6,          // pleins pour calcul moyenne
    seuilKmParJour: 1000,     // km/jour max raisonnable
    detecterDoublons: true,   // R4
    detecterRegression: true, // R5
    detecterKmExcessif: true, // R6
    detecterHorsHeures: false,// R7 (off par defaut, beaucoup de chauffeurs travaillent week-end)
    heureDebut: 6,            // R7 : heure debut journee normale (incluse)
    heureFin: 22              // R7 : heure fin journee normale (exclue)
  };

  function getConfig() {
    try {
      var raw = localStorage.getItem('config_anomalies_carburant');
      if (!raw) return Object.assign({}, DEFAULTS);
      var c = JSON.parse(raw);
      return Object.assign({}, DEFAULTS, c);
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem('config_anomalies_carburant', JSON.stringify(cfg || {}));
      return true;
    } catch (e) { return false; }
  }

  function getKm(p) {
    var k = parseFloat(p.km != null ? p.km : p.kmCompteur);
    return Number.isFinite(k) && k > 0 ? k : null;
  }

  // Calcule la conso L/100 d'un plein "courant" via le plein precedent du
  // meme vehicule. Renvoie null si pas calculable (premier plein, km manquant).
  function calculerConsoPlein(plein, pleinsVeh) {
    if (!plein || !plein.vehId) return null;
    var km = getKm(plein);
    var litres = parseFloat(plein.litres);
    if (km == null) return null;
    if (!Number.isFinite(litres) || litres <= 0) return null;
    var prec = trouverPleinPrecedent(plein, pleinsVeh);
    if (!prec) return null;
    var kmPrec = getKm(prec);
    if (kmPrec == null) return null;
    var deltaKm = km - kmPrec;
    if (deltaKm <= 0) return null;
    return (litres / deltaKm) * 100;
  }

  // Trouve le plein precedent (date strictement < plein.date) avec km valide.
  function trouverPleinPrecedent(plein, pleinsVeh) {
    var precs = (pleinsVeh || []).filter(function (p) {
      if (p.id === plein.id) return false;
      if (getKm(p) == null) return false;
      return new Date(p.date) < new Date(plein.date);
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return precs[0] || null;
  }

  // Trouve le plein precedent direct (sans contrainte km), pour R4/R5/R6/R7.
  function trouverPleinPrecedentBrut(plein, pleinsVeh) {
    var precs = (pleinsVeh || []).filter(function (p) {
      if (p.id === plein.id) return false;
      return new Date(p.date) <= new Date(plein.date);
    }).sort(function (a, b) {
      var d = new Date(b.date) - new Date(a.date);
      if (d !== 0) return d;
      // Meme date -> on regarde creeLe pour ordre stable
      return new Date(b.creeLe || 0) - new Date(a.creeLe || 0);
    });
    // Premier plein != celui-la qui est avant
    return precs.find(function (p) { return p.id !== plein.id; }) || null;
  }

  function calculerMoyenneConso(plein, pleinsVeh, fenetreHisto) {
    if (!plein) return null;
    var precedents = (pleinsVeh || []).filter(function (p) {
      return p.id !== plein.id && new Date(p.date) < new Date(plein.date);
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, fenetreHisto || 6);
    if (precedents.length < 2) return null;
    var consos = [];
    var sortedAsc = precedents.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    for (var i = 1; i < sortedAsc.length; i++) {
      var c = calculerConsoPlein(sortedAsc[i], sortedAsc.slice(0, i));
      if (c != null && c > 0) consos.push(c);
    }
    if (!consos.length) return null;
    return consos.reduce(function (s, x) { return s + x; }, 0) / consos.length;
  }

  // Heure d'un plein : on tente creeLe (timestamp ISO complet), sinon impossible.
  function getHeurePlein(plein) {
    if (!plein || !plein.creeLe) return null;
    var d = new Date(plein.creeLe);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  // Analyse un plein et renvoie la liste d'anomalies detectees.
  function detecterAnomaliesPlein(plein, contexte) {
    var anomalies = [];
    if (!plein) return anomalies;
    var cfg = (contexte && contexte.config) || getConfig();
    var pleinsVeh = (contexte && contexte.pleinsVeh) ||
      (typeof charger === 'function' ? charger('carburant').filter(function (p) { return p.vehId === plein.vehId; }) : []);
    var vehicules = (contexte && contexte.vehicules) ||
      (typeof charger === 'function' ? charger('vehicules') : []);
    var veh = vehicules.find(function (v) { return v.id === plein.vehId; });

    // Regle 3 : capacite reservoir
    var capacite = veh && parseFloat(veh.capaciteReservoir);
    var litres = parseFloat(plein.litres);
    if (Number.isFinite(capacite) && capacite > 0 && Number.isFinite(litres) && litres > capacite) {
      anomalies.push({
        type: 'capacite_reservoir',
        niveau: 'rouge',
        message: 'Plein de ' + litres.toFixed(1) + ' L > capacité réservoir (' + capacite + ' L)',
        litres: litres,
        capacite: capacite
      });
    }

    // Regles 1 & 2 : conso anormale
    var conso = calculerConsoPlein(plein, pleinsVeh);
    var moyenne = calculerMoyenneConso(plein, pleinsVeh, cfg.fenetreHisto);
    if (conso != null && moyenne != null && moyenne > 0) {
      var ecart = (conso - moyenne) / moyenne;
      if (ecart >= cfg.seuilConsoRouge) {
        anomalies.push({
          type: 'conso_critique',
          niveau: 'rouge',
          message: 'Conso ' + conso.toFixed(1) + ' L/100 > moyenne ' + moyenne.toFixed(1) + ' L/100 (+' + Math.round(ecart * 100) + '%)',
          conso: conso, moyenne: moyenne, ecart: ecart
        });
      } else if (ecart >= cfg.seuilConsoOrange) {
        anomalies.push({
          type: 'conso_haute',
          niveau: 'orange',
          message: 'Conso ' + conso.toFixed(1) + ' L/100 > moyenne ' + moyenne.toFixed(1) + ' L/100 (+' + Math.round(ecart * 100) + '%)',
          conso: conso, moyenne: moyenne, ecart: ecart
        });
      }
    }

    var precBrut = trouverPleinPrecedentBrut(plein, pleinsVeh);
    var km = getKm(plein);
    var kmPrec = precBrut ? getKm(precBrut) : null;

    // Regle 5 : regression km (km < km precedent) — RED
    if (cfg.detecterRegression && precBrut && km != null && kmPrec != null && km < kmPrec) {
      anomalies.push({
        type: 'regression_km',
        niveau: 'rouge',
        message: 'Km saisi (' + km + ') < km plein precedent (' + kmPrec + ', ' + precBrut.date + ')',
        km: km, kmPrecedent: kmPrec
      });
    }

    // Regle 4 : 2 pleins en < 24h sans km parcourus (doublon / fraude)
    if (cfg.detecterDoublons && precBrut) {
      var tCur = plein.creeLe ? new Date(plein.creeLe) : new Date(plein.date + 'T12:00:00');
      var tPrec = precBrut.creeLe ? new Date(precBrut.creeLe) : new Date(precBrut.date + 'T12:00:00');
      var deltaH = Math.abs(tCur - tPrec) / 3600000;
      var deltaKmAbs = (km != null && kmPrec != null) ? Math.abs(km - kmPrec) : null;
      if (deltaH < 24 && deltaKmAbs != null && deltaKmAbs < 5) {
        anomalies.push({
          type: 'doublon_plein',
          niveau: 'orange',
          message: '2e plein en ' + deltaH.toFixed(1) + 'h sans km parcourus (' + deltaKmAbs + ' km)',
          deltaHeures: deltaH, deltaKm: deltaKmAbs
        });
      }
    }

    // Regle 6 : km/jour excessif depuis le plein precedent
    if (cfg.detecterKmExcessif && precBrut && km != null && kmPrec != null && km > kmPrec) {
      var deltaJoursR6 = Math.max(1, (new Date(plein.date) - new Date(precBrut.date)) / 86400000);
      var kmParJour = (km - kmPrec) / deltaJoursR6;
      if (kmParJour > cfg.seuilKmParJour) {
        anomalies.push({
          type: 'km_excessif',
          niveau: 'orange',
          message: kmParJour.toFixed(0) + ' km/jour entre les 2 derniers pleins (seuil ' + cfg.seuilKmParJour + ')',
          kmParJour: kmParJour
        });
      }
    }

    // Regle 7 : plein hors heures (week-end / nuit)
    if (cfg.detecterHorsHeures) {
      var h = getHeurePlein(plein);
      if (h) {
        var jour = h.getDay(); // 0=dim, 6=sam
        var heure = h.getHours();
        var horsHeure = heure < cfg.heureDebut || heure >= cfg.heureFin;
        var weekend = jour === 0 || jour === 6;
        if (weekend || horsHeure) {
          var raison = weekend ? 'week-end' : ('hors heures (' + heure + 'h)');
          anomalies.push({
            type: 'hors_heures',
            niveau: 'orange',
            message: 'Plein effectue ' + raison,
            heure: heure, jour: jour
          });
        }
      }
    }

    return anomalies;
  }

  // Sweep : analyse tous les pleins et genere les alertes manquantes.
  function sweepAnomaliesCarburant() {
    if (typeof charger !== 'function' || typeof ajouterAlerteSiAbsente !== 'function') return;
    var pleins = charger('carburant') || [];
    var vehicules = charger('vehicules') || [];
    var cfg = getConfig();
    var pleinsByVeh = {};
    pleins.forEach(function (p) {
      if (!p.vehId) return;
      (pleinsByVeh[p.vehId] = pleinsByVeh[p.vehId] || []).push(p);
    });
    var nbAnomalies = 0;
    pleins.forEach(function (plein) {
      var ctx = { pleinsVeh: pleinsByVeh[plein.vehId] || [], vehicules: vehicules, config: cfg };
      var anomalies = detecterAnomaliesPlein(plein, ctx);
      anomalies.forEach(function (a) {
        var veh = vehicules.find(function (v) { return v.id === plein.vehId; });
        var libelle = (veh && veh.immat) || plein.vehNom || '?';
        var icone = a.niveau === 'rouge' ? '🔴' : '🟠';
        var msgComplet = icone + ' Anomalie carburant ' + libelle + ' (' + plein.date + ') — ' + a.message;
        var stageKey = 'carb-anom-' + plein.id + '-' + a.type;
        ajouterAlerteSiAbsente('carburant_anomalie', msgComplet, {
          pleinId: plein.id,
          vehId: plein.vehId,
          stageKey: stageKey,
          niveau: a.niveau,
          typeAnomalie: a.type
        });
        nbAnomalies++;
      });
    });
    if (typeof afficherBadgeAlertes === 'function') afficherBadgeAlertes();
    return nbAnomalies;
  }

  // ===== UI Config =====
  function ouvrirConfigAnomaliesCarburant() {
    var cfg = getConfig();
    var setVal = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    var setChk = function (id, v) { var el = document.getElementById(id); if (el) el.checked = !!v; };
    setVal('cfg-carb-seuil-orange', Math.round(cfg.seuilConsoOrange * 100));
    setVal('cfg-carb-seuil-rouge',  Math.round(cfg.seuilConsoRouge * 100));
    setVal('cfg-carb-fenetre',      cfg.fenetreHisto);
    setVal('cfg-carb-km-jour',      cfg.seuilKmParJour);
    setChk('cfg-carb-doublons',     cfg.detecterDoublons);
    setChk('cfg-carb-regression',   cfg.detecterRegression);
    setChk('cfg-carb-km-excessif',  cfg.detecterKmExcessif);
    setChk('cfg-carb-hors-heures',  cfg.detecterHorsHeures);
    setVal('cfg-carb-h-debut',      cfg.heureDebut);
    setVal('cfg-carb-h-fin',        cfg.heureFin);
    if (typeof openModal === 'function') openModal('modal-config-carburant-anomalies');
  }

  function enregistrerConfigAnomaliesCarburant() {
    var getNum = function (id, def) {
      var v = parseFloat(document.getElementById(id)?.value);
      return Number.isFinite(v) ? v : def;
    };
    var getChk = function (id) { return !!document.getElementById(id)?.checked; };
    var newCfg = {
      seuilConsoOrange: Math.max(0, getNum('cfg-carb-seuil-orange', 25)) / 100,
      seuilConsoRouge:  Math.max(0, getNum('cfg-carb-seuil-rouge', 50)) / 100,
      fenetreHisto:     Math.max(2, Math.min(20, Math.round(getNum('cfg-carb-fenetre', 6)))),
      seuilKmParJour:   Math.max(100, getNum('cfg-carb-km-jour', 1000)),
      detecterDoublons: getChk('cfg-carb-doublons'),
      detecterRegression: getChk('cfg-carb-regression'),
      detecterKmExcessif: getChk('cfg-carb-km-excessif'),
      detecterHorsHeures: getChk('cfg-carb-hors-heures'),
      heureDebut: Math.max(0, Math.min(23, getNum('cfg-carb-h-debut', 6))),
      heureFin:   Math.max(1, Math.min(24, getNum('cfg-carb-h-fin', 22)))
    };
    saveConfig(newCfg);
    if (typeof closeModal === 'function') closeModal('modal-config-carburant-anomalies');
    if (typeof afficherToast === 'function') afficherToast('✅ Config anomalies enregistrée');
    // Re-sweep avec les nouveaux seuils
    if (typeof sweepAnomaliesCarburant === 'function') sweepAnomaliesCarburant();
    if (typeof afficherCarburant === 'function') afficherCarburant();
  }

  // Expose
  window.detecterAnomaliesPlein = detecterAnomaliesPlein;
  window.calculerConsoPlein = calculerConsoPlein;
  window.calculerMoyenneConso = calculerMoyenneConso;
  window.sweepAnomaliesCarburant = sweepAnomaliesCarburant;
  window.getConfigAnomaliesCarburant = getConfig;
  window.ouvrirConfigAnomaliesCarburant = ouvrirConfigAnomaliesCarburant;
  window.enregistrerConfigAnomaliesCarburant = enregistrerConfigAnomaliesCarburant;
})();
