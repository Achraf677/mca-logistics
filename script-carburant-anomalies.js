/**
 * MCA Logistics — Detection anomalies carburant
 *
 * PR1 (regles 1-3) :
 *   1. Conso L/100 d'un plein > moyenne 6 derniers + 25%      [orange]
 *   2. Conso L/100 d'un plein > moyenne 6 derniers + 50%      [rouge]
 *   3. Litres > capacite reservoir vehicule (si renseigne)    [rouge fraude]
 *
 * Sortie : alertes type "carburant_anomalie" via ajouterAlerteSiAbsente.
 * stageKey unique par plein -> pas de duplicata si re-run.
 */

(function () {
  'use strict';

  // Seuils par defaut (TODO PR2 : page config pour les rendre parametrables)
  var SEUIL_AVERTISSEMENT = 0.25; // +25% conso
  var SEUIL_CRITIQUE      = 0.50; // +50% conso
  var FENETRE_HISTO       = 6;    // derniers pleins pour calculer la moyenne

  // Calcule la conso L/100 d'un plein "courant" via le plein precedent du
  // meme vehicule. Renvoie null si pas calculable (premier plein, km manquant).
  function calculerConsoPlein(plein, pleinsVeh) {
    if (!plein || !plein.vehId) return null;
    var km = parseFloat(plein.km != null ? plein.km : plein.kmCompteur);
    var litres = parseFloat(plein.litres);
    if (!Number.isFinite(km) || km <= 0) return null;
    if (!Number.isFinite(litres) || litres <= 0) return null;
    // Trouver le plein precedent (date < plein.date, vehicule identique)
    var precedents = (pleinsVeh || []).filter(function (p) {
      if (p.id === plein.id) return false;
      var kmP = parseFloat(p.km != null ? p.km : p.kmCompteur);
      if (!Number.isFinite(kmP) || kmP <= 0) return false;
      return new Date(p.date) < new Date(plein.date);
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var prec = precedents[0];
    if (!prec) return null;
    var kmPrec = parseFloat(prec.km != null ? prec.km : prec.kmCompteur);
    var deltaKm = km - kmPrec;
    if (deltaKm <= 0) return null; // gerait par regle "regression km" en PR2
    return (litres / deltaKm) * 100;
  }

  // Moyenne L/100 sur les N derniers pleins precedant celui-ci.
  // Sert de baseline pour detecter une anomalie.
  function calculerMoyenneConso(plein, pleinsVeh) {
    if (!plein) return null;
    var precedents = (pleinsVeh || []).filter(function (p) {
      return p.id !== plein.id && new Date(p.date) < new Date(plein.date);
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, FENETRE_HISTO);
    if (precedents.length < 2) return null; // besoin de min 2 pleins pour une moyenne
    var consos = [];
    var sortedAsc = precedents.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    for (var i = 1; i < sortedAsc.length; i++) {
      var c = calculerConsoPlein(sortedAsc[i], sortedAsc.slice(0, i));
      if (c != null && c > 0) consos.push(c);
    }
    if (!consos.length) return null;
    return consos.reduce(function (s, x) { return s + x; }, 0) / consos.length;
  }

  // Analyse un plein et renvoie la liste d'anomalies detectees.
  // [{type:'conso_haute'|'conso_critique'|'capacite_reservoir', niveau:'orange'|'rouge', message, ...}]
  function detecterAnomaliesPlein(plein, contexte) {
    var anomalies = [];
    if (!plein) return anomalies;
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
        message: 'Plein de ' + litres.toFixed(1) + ' L > capacite reservoir (' + capacite + ' L)',
        litres: litres,
        capacite: capacite
      });
    }

    // Regles 1 & 2 : conso anormale
    var conso = calculerConsoPlein(plein, pleinsVeh);
    var moyenne = calculerMoyenneConso(plein, pleinsVeh);
    if (conso != null && moyenne != null && moyenne > 0) {
      var ecart = (conso - moyenne) / moyenne;
      if (ecart >= SEUIL_CRITIQUE) {
        anomalies.push({
          type: 'conso_critique',
          niveau: 'rouge',
          message: 'Conso ' + conso.toFixed(1) + ' L/100 > moyenne ' + moyenne.toFixed(1) + ' L/100 (+' + Math.round(ecart * 100) + '%)',
          conso: conso, moyenne: moyenne, ecart: ecart
        });
      } else if (ecart >= SEUIL_AVERTISSEMENT) {
        anomalies.push({
          type: 'conso_haute',
          niveau: 'orange',
          message: 'Conso ' + conso.toFixed(1) + ' L/100 > moyenne ' + moyenne.toFixed(1) + ' L/100 (+' + Math.round(ecart * 100) + '%)',
          conso: conso, moyenne: moyenne, ecart: ecart
        });
      }
    }

    return anomalies;
  }

  // Sweep : analyse tous les pleins et genere les alertes manquantes.
  // Idempotent grace a stageKey unique par (plein.id + type anomalie).
  function sweepAnomaliesCarburant() {
    if (typeof charger !== 'function' || typeof ajouterAlerteSiAbsente !== 'function') return;
    var pleins = charger('carburant') || [];
    var vehicules = charger('vehicules') || [];
    // Index pleins par vehicule (perf : evite N×M)
    var pleinsByVeh = {};
    pleins.forEach(function (p) {
      if (!p.vehId) return;
      (pleinsByVeh[p.vehId] = pleinsByVeh[p.vehId] || []).push(p);
    });
    var nbAnomalies = 0;
    pleins.forEach(function (plein) {
      var ctx = { pleinsVeh: pleinsByVeh[plein.vehId] || [], vehicules: vehicules };
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

  // Expose
  window.detecterAnomaliesPlein = detecterAnomaliesPlein;
  window.calculerConsoPlein = calculerConsoPlein;
  window.calculerMoyenneConso = calculerMoyenneConso;
  window.sweepAnomaliesCarburant = sweepAnomaliesCarburant;
})();
