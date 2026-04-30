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
 *   - methodeRepartition   : 'livraisons' | 'ca' | 'km'
 *
 * Note : seuls les couts decaissables sont comptes (carburant, salaires,
 * entretiens reels, charges payees). L'amortissement comptable n'est pas
 * une sortie de cash, donc exclu.
 */

(function () {
  'use strict';

  var DEFAULTS = {
    tarifHoraireDefaut: 12,    // €/h brut chargé estime
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
          coutCarburant: 0, coutCharges: 0, coutEntretien: 0
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

    Object.keys(stats).forEach(function (k) {
      var s = stats[k];
      s.coutTotal = s.coutCarburant + s.coutCharges + s.coutEntretien;
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
      methodeRepartition: document.getElementById('cfg-rent-methode')?.value || 'livraisons'
    };
    saveConfig(newCfg);
    if (typeof closeModal === 'function') closeModal('modal-config-rentabilite');
    if (typeof afficherToast === 'function') afficherToast('✅ Config rentabilité enregistrée');
    afficherRentabiliteParVehicule();
    if (typeof afficherRentabiliteParClient === 'function') afficherRentabiliteParClient();
    if (typeof afficherRentabiliteParChauffeur === 'function') afficherRentabiliteParChauffeur();
  }

  // ===== Par client =====
  // CA   = Σ HT livraisons du client
  // Couts repartis (carburant + autres charges + entretiens + salaires) selon methode :
  //   - 'livraisons' : prorata nb livraisons
  //   - 'ca'         : prorata CA HT
  //   - 'km'         : prorata km parcourus
  function calculerRentabiliteParClient(range) {
    var livraisons = (typeof charger === 'function' ? charger('livraisons') : []).filter(function (l) {
      return inRange(l.date, range);
    });
    var pleins = (typeof charger === 'function' ? charger('carburant') : []).filter(function (p) {
      return inRange(p.date, range);
    });
    var charges = (typeof charger === 'function' ? charger('charges') : []).filter(function (c) {
      return inRange(c.date, range) && c.categorie !== 'tva';
    });
    var entretiens = (typeof charger === 'function' ? charger('entretiens') : []).filter(function (e) {
      return inRange(e.date, range);
    });
    var clients = (typeof charger === 'function' ? charger('clients') : []);
    var livraisonsById = {};
    livraisons.forEach(function (l) { livraisonsById[l.id] = l; });
    var cfg = getConfig();

    // Charges directement imputees a une livraison (champ livraisonId) :
    // on les attribue directement au client de cette livraison, pas a la
    // repartition globale. Permet a l'utilisateur d'avoir une attribution
    // precise pour les charges qui le meritent (ex : carburant rattache).
    var coutsImputesParClient = {};
    var chargesNonImputees = charges.filter(function (c) {
      if (!c.livraisonId) return true;
      var liv = livraisonsById[c.livraisonId];
      if (!liv) return true; // livraison hors range -> reparti
      var clientKey = liv.clientId || liv.client || 'sans-client';
      var ttc = parseFloat(c.montant) || 0;
      var taux = parseFloat(c.tauxTVA) || 20;
      coutsImputesParClient[clientKey] = (coutsImputesParClient[clientKey] || 0) + ttc / (1 + taux / 100);
      return false;
    });

    // Couts globaux a repartir (apres deduction des charges imputees)
    var coutCarburantTotal = pleins.reduce(function (s, p) {
      var ttc = parseFloat(p.total) || 0;
      var taux = parseFloat(p.tauxTVA) || 20;
      return s + ttc / (1 + taux / 100);
    }, 0);
    var coutChargesTotal = chargesNonImputees.reduce(function (s, c) {
      var ttc = parseFloat(c.montant) || 0;
      var taux = parseFloat(c.tauxTVA) || 20;
      return s + ttc / (1 + taux / 100);
    }, 0);
    var coutEntretienTotal = entretiens.reduce(function (s, e) { return s + (parseFloat(e.cout) || 0); }, 0);
    var coutGlobalAReparti = coutCarburantTotal + coutChargesTotal + coutEntretienTotal;

    // Agregation par client
    var stats = {};
    function ensure(clientKey, clientNom) {
      if (!stats[clientKey]) {
        stats[clientKey] = {
          clientKey: clientKey,
          clientNom: clientNom || '— Sans client —',
          ca: 0, nbLivraisons: 0, kmTotal: 0,
          coutRepartis: 0
        };
      }
      return stats[clientKey];
    }
    livraisons.forEach(function (l) {
      var key = l.clientId || l.client || 'sans-client';
      var c = clients.find(function (x) { return x.id === l.clientId; });
      var nom = c ? c.nom : (l.client || '');
      var s = ensure(key, nom);
      s.ca += getMontantHTLiv(l);
      s.nbLivraisons++;
      s.kmTotal += parseFloat(l.distance) || 0;
    });

    // Totaux pour repartition
    var totalLivs = Object.values(stats).reduce(function (s, x) { return s + x.nbLivraisons; }, 0);
    var totalCA   = Object.values(stats).reduce(function (s, x) { return s + x.ca; }, 0);
    var totalKm   = Object.values(stats).reduce(function (s, x) { return s + x.kmTotal; }, 0);

    Object.keys(stats).forEach(function (k) {
      var s = stats[k];
      var part = 0;
      if (cfg.methodeRepartition === 'ca' && totalCA > 0) part = s.ca / totalCA;
      else if (cfg.methodeRepartition === 'km' && totalKm > 0) part = s.kmTotal / totalKm;
      else if (totalLivs > 0) part = s.nbLivraisons / totalLivs;
      s.coutRepartis = coutGlobalAReparti * part;
      s.coutImpute = coutsImputesParClient[k] || 0;
      s.coutTotal = s.coutRepartis + s.coutImpute;
      s.marge = s.ca - s.coutTotal;
      s.margePct = s.ca > 0 ? (s.marge / s.ca) * 100 : 0;
    });

    return Object.values(stats).sort(function (a, b) { return b.marge - a.marge; });
  }

  function afficherRentabiliteParClient() {
    var range = getRangeAnalyse();
    var stats = calculerRentabiliteParClient(range);
    var tb = document.getElementById('tb-rent-client');
    if (!tb) return;
    if (!stats.length) {
      tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucune donnée sur cette période.</td></tr>';
      majTotauxRent('client', { ca: 0, marge: 0, nbLivraisons: 0 });
      return;
    }
    tb.innerHTML = stats.map(function (s) {
      var couleur = s.marge >= 0 ? '#28a745' : '#dc3545';
      return '<tr>' +
        '<td><strong>' + escapeHtml(s.clientNom) + '</strong></td>' +
        '<td>' + s.nbLivraisons + '</td>' +
        '<td>' + (s.kmTotal ? Math.round(s.kmTotal) + ' km' : '—') + '</td>' +
        '<td>' + euros(s.ca) + '</td>' +
        '<td style="font-size:.85rem">' + euros(s.coutTotal) + '</td>' +
        '<td style="color:' + couleur + ';font-weight:700">' + euros(s.marge) + ' <span style="font-size:.74rem;font-weight:400">(' + s.margePct.toFixed(1) + '%)</span></td>' +
      '</tr>';
    }).join('');
    var totaux = stats.reduce(function (acc, s) {
      acc.ca += s.ca; acc.marge += s.marge; acc.nbLivraisons += s.nbLivraisons;
      return acc;
    }, { ca: 0, marge: 0, nbLivraisons: 0 });
    majTotauxRent('client', totaux);
  }

  // ===== Par chauffeur =====
  // CA           = Σ HT livraisons effectuees (chaufId)
  // Cout salaire = Σ charges cat='salaires' avec salId=chaufId (sinon 0 + warning)
  // Cout carburant reparti : pour chaque vehicule conduit, on prend le carburant
  //   du vehicule sur la periode et on repartit selon nb livraisons du chauffeur
  //   sur ce vehicule / total livraisons sur ce vehicule
  function calculerRentabiliteParChauffeur(range) {
    var livraisons = (typeof charger === 'function' ? charger('livraisons') : []).filter(function (l) {
      return inRange(l.date, range);
    });
    var pleins = (typeof charger === 'function' ? charger('carburant') : []).filter(function (p) {
      return inRange(p.date, range);
    });
    var charges = (typeof charger === 'function' ? charger('charges') : []).filter(function (c) {
      return inRange(c.date, range);
    });
    var salaries = (typeof charger === 'function' ? charger('salaries') : []);

    // Index : carburant total HT par vehicule sur la periode
    var carburantParVeh = {};
    pleins.forEach(function (p) {
      if (!p.vehId) return;
      var ttc = parseFloat(p.total) || 0;
      var taux = parseFloat(p.tauxTVA) || 20;
      carburantParVeh[p.vehId] = (carburantParVeh[p.vehId] || 0) + ttc / (1 + taux / 100);
    });
    // Index : nb livraisons par (vehicule, chauffeur)
    var livsParVehChauf = {}; // { vehId: { chaufId: count } }
    var livsTotalParVeh = {}; // { vehId: count }
    livraisons.forEach(function (l) {
      if (!l.vehId) return;
      var v = l.vehId;
      var ch = l.chaufId || 'sans-chauffeur';
      livsParVehChauf[v] = livsParVehChauf[v] || {};
      livsParVehChauf[v][ch] = (livsParVehChauf[v][ch] || 0) + 1;
      livsTotalParVeh[v] = (livsTotalParVeh[v] || 0) + 1;
    });

    // Agregation par chauffeur
    var stats = {};
    function ensure(chaufKey, chaufNom) {
      if (!stats[chaufKey]) {
        stats[chaufKey] = {
          chaufKey: chaufKey,
          chaufNom: chaufNom || '— Sans chauffeur —',
          ca: 0, nbLivraisons: 0, kmTotal: 0,
          coutSalaire: 0, coutCarburant: 0,
          salairManquant: false
        };
      }
      return stats[chaufKey];
    }
    livraisons.forEach(function (l) {
      var key = l.chaufId || 'sans-chauffeur';
      var sal = salaries.find(function (x) { return x.id === l.chaufId; });
      var nom = sal ? sal.nom : (l.chaufNom || '');
      var s = ensure(key, nom);
      s.ca += getMontantHTLiv(l);
      s.nbLivraisons++;
      s.kmTotal += parseFloat(l.distance) || 0;
    });

    // Cout salaire = charges salaires avec salId == chaufId
    Object.keys(stats).forEach(function (chaufId) {
      if (chaufId === 'sans-chauffeur') return;
      var totalSal = charges.filter(function (c) {
        return c.categorie === 'salaires' && c.salId === chaufId;
      }).reduce(function (s, c) {
        var ttc = parseFloat(c.montant) || 0;
        var taux = parseFloat(c.tauxTVA) || 20;
        return s + ttc / (1 + taux / 100);
      }, 0);
      stats[chaufId].coutSalaire = totalSal;
      stats[chaufId].salairManquant = totalSal === 0;
    });

    // Cout carburant reparti : pour chaque vehicule conduit par le chauffeur,
    // on prend le carburant du vehicule × (livs chauffeur / livs totales vehicule)
    Object.keys(stats).forEach(function (chaufId) {
      var coutC = 0;
      Object.keys(livsParVehChauf).forEach(function (vehId) {
        var nbChauf = livsParVehChauf[vehId][chaufId] || 0;
        var nbTotal = livsTotalParVeh[vehId] || 0;
        if (nbChauf > 0 && nbTotal > 0) {
          coutC += (carburantParVeh[vehId] || 0) * (nbChauf / nbTotal);
        }
      });
      stats[chaufId].coutCarburant = coutC;
    });

    Object.keys(stats).forEach(function (k) {
      var s = stats[k];
      s.coutTotal = s.coutSalaire + s.coutCarburant;
      s.marge = s.ca - s.coutTotal;
      s.margePct = s.ca > 0 ? (s.marge / s.ca) * 100 : 0;
      s.caParH = s.nbLivraisons > 0 ? s.ca / s.nbLivraisons : 0; // proxy productivite
    });

    return Object.values(stats).sort(function (a, b) { return b.marge - a.marge; });
  }

  function afficherRentabiliteParChauffeur() {
    var range = getRangeAnalyse();
    var stats = calculerRentabiliteParChauffeur(range);
    var tb = document.getElementById('tb-rent-chauffeur');
    if (!tb) return;
    if (!stats.length) {
      tb.innerHTML = '<tr><td colspan="7" class="empty-row">Aucune donnée sur cette période.</td></tr>';
      majTotauxRent('chauffeur', { ca: 0, marge: 0, nbLivraisons: 0 });
      return;
    }
    tb.innerHTML = stats.map(function (s) {
      var couleur = s.marge >= 0 ? '#28a745' : '#dc3545';
      var warnSal = s.salairManquant
        ? ' <span style="background:rgba(245,166,35,.12);color:var(--accent);padding:2px 6px;border-radius:8px;font-size:.7rem" title="Aucune charge \'salaires\' avec salId=chauffeur trouvée — coût salaire non comptabilisé">⚠</span>'
        : '';
      return '<tr>' +
        '<td><strong>' + escapeHtml(s.chaufNom) + '</strong>' + warnSal + '</td>' +
        '<td>' + s.nbLivraisons + '</td>' +
        '<td>' + (s.kmTotal ? Math.round(s.kmTotal) + ' km' : '—') + '</td>' +
        '<td>' + euros(s.ca) + '</td>' +
        '<td style="font-size:.85rem">' + euros(s.coutSalaire) + '</td>' +
        '<td style="font-size:.85rem">' + euros(s.coutCarburant) + '</td>' +
        '<td style="color:' + couleur + ';font-weight:700">' + euros(s.marge) + ' <span style="font-size:.74rem;font-weight:400">(' + s.margePct.toFixed(1) + '%)</span></td>' +
      '</tr>';
    }).join('');
    var totaux = stats.reduce(function (acc, s) {
      acc.ca += s.ca; acc.marge += s.marge; acc.nbLivraisons += s.nbLivraisons;
      return acc;
    }, { ca: 0, marge: 0, nbLivraisons: 0 });
    majTotauxRent('chauffeur', totaux);
  }

  function majTotauxRent(suffix, totaux) {
    var setTxt = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('rent-' + suffix + '-total-ca', euros(totaux.ca || 0));
    setTxt('rent-' + suffix + '-total-marge', euros(totaux.marge || 0));
    setTxt('rent-' + suffix + '-total-livs', totaux.nbLivraisons || 0);
  }

  // ===== Par tournee =====
  // Une "tournee" = ensemble des livraisons d'un meme chauffeur sur une meme date.
  // CA tournee = Σ HT livraisons du jour
  // Couts directs : carburant du vehicule du jour (pleins date == jour)
  //                 + salaire jour = (cout salaire mensuel chauffeur / nb jours travailles)
  //                   approxime ici : salaire = coutSalaireMensuel × (nbLivsTournee / totalLivsChauffeurMois)
  function calculerRentabiliteParTournee(range) {
    var livraisons = (typeof charger === 'function' ? charger('livraisons') : []).filter(function (l) {
      return inRange(l.date, range);
    });
    var pleins = (typeof charger === 'function' ? charger('carburant') : []).filter(function (p) {
      return inRange(p.date, range);
    });
    var charges = (typeof charger === 'function' ? charger('charges') : []).filter(function (c) {
      return inRange(c.date, range);
    });
    var salaries = (typeof charger === 'function' ? charger('salaries') : []);
    var vehicules = (typeof charger === 'function' ? charger('vehicules') : []);

    // Cout salaire mensuel par chauffeur (charges cat='salaires' periode entiere)
    var salaireParChauf = {};
    charges.forEach(function (c) {
      if (c.categorie !== 'salaires' || !c.salId) return;
      var ttc = parseFloat(c.montant) || 0;
      var taux = parseFloat(c.tauxTVA) || 20;
      salaireParChauf[c.salId] = (salaireParChauf[c.salId] || 0) + ttc / (1 + taux / 100);
    });
    // Total livraisons periode par chauffeur (pour repartition salaire)
    var livsTotalParChauf = {};
    livraisons.forEach(function (l) {
      var ch = l.chaufId || 'sans-chauffeur';
      livsTotalParChauf[ch] = (livsTotalParChauf[ch] || 0) + 1;
    });
    // Carburant total par (vehicule, jour)
    var carbParVehJour = {};
    pleins.forEach(function (p) {
      if (!p.vehId) return;
      var key = p.vehId + '__' + (p.date || '').slice(0, 10);
      var ttc = parseFloat(p.total) || 0;
      var taux = parseFloat(p.tauxTVA) || 20;
      carbParVehJour[key] = (carbParVehJour[key] || 0) + ttc / (1 + taux / 100);
    });

    // Agregation par tournee (chaufId + date)
    var tournees = {};
    livraisons.forEach(function (l) {
      var tId = getTourneeId(l);
      if (!tId) return;
      if (!tournees[tId]) {
        var sal = salaries.find(function (s) { return s.id === l.chaufId; });
        var veh = vehicules.find(function (v) { return v.id === l.vehId; });
        tournees[tId] = {
          tourneeId: tId,
          date: (l.date || '').slice(0, 10),
          chaufId: l.chaufId || null,
          chaufNom: sal ? sal.nom : (l.chaufNom || '— Sans chauffeur —'),
          vehId: l.vehId || null,
          vehImmat: veh ? veh.immat : (l.vehNom || ''),
          ca: 0, nbLivraisons: 0, kmTotal: 0,
          coutCarburant: 0, coutSalaire: 0,
          livraisons: []
        };
      }
      var t = tournees[tId];
      t.ca += getMontantHTLiv(l);
      t.nbLivraisons++;
      t.kmTotal += parseFloat(l.distance) || 0;
      t.livraisons.push({ id: l.id, client: l.client, prix: l.prix, distance: l.distance, numLiv: l.numLiv });
    });

    Object.keys(tournees).forEach(function (k) {
      var t = tournees[k];
      // Carburant : on prend le carburant du vehicule sur la date de tournee
      var keyCarb = (t.vehId || '') + '__' + t.date;
      t.coutCarburant = carbParVehJour[keyCarb] || 0;
      // Salaire : prorata nb livs tournee / total livs chauffeur sur la periode
      var totalLivsChauf = livsTotalParChauf[t.chaufId || 'sans-chauffeur'] || 0;
      if (totalLivsChauf > 0) {
        t.coutSalaire = (salaireParChauf[t.chaufId] || 0) * (t.nbLivraisons / totalLivsChauf);
      }
      t.coutTotal = t.coutCarburant + t.coutSalaire;
      t.marge = t.ca - t.coutTotal;
      t.margePct = t.ca > 0 ? (t.marge / t.ca) * 100 : 0;
    });

    return Object.values(tournees).sort(function (a, b) {
      // Tri : date desc, puis marge desc
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.marge - a.marge;
    });
  }

  function afficherRentabiliteParTournee() {
    var range = getRangeAnalyse();
    var stats = calculerRentabiliteParTournee(range);
    // Cache pour le drill-down
    window.__rentTourneesCache = {};
    stats.forEach(function (t) { window.__rentTourneesCache[t.tourneeId] = t; });
    var tb = document.getElementById('tb-rent-tournee');
    if (!tb) return;
    if (!stats.length) {
      tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucune tournée sur cette période.</td></tr>';
      majTotauxRent('tournee', { ca: 0, marge: 0, nbLivraisons: 0 });
      return;
    }
    tb.innerHTML = stats.map(function (t) {
      var couleur = t.marge >= 0 ? '#28a745' : '#dc3545';
      return '<tr style="cursor:pointer" onclick="voirDetailTournee(\'' + t.tourneeId + '\')" title="Voir le détail des livraisons">' +
        '<td>' + escapeHtml(t.date) + '</td>' +
        '<td><strong>' + escapeHtml(t.chaufNom) + '</strong></td>' +
        '<td>' + escapeHtml(t.vehImmat || '—') + '</td>' +
        '<td>' + t.nbLivraisons + '</td>' +
        '<td>' + (t.kmTotal ? Math.round(t.kmTotal) + ' km' : '—') + '</td>' +
        '<td>' + euros(t.ca) + '</td>' +
        '<td style="font-size:.85rem">' + euros(t.coutTotal) + '</td>' +
        '<td style="color:' + couleur + ';font-weight:700">' + euros(t.marge) + ' <span style="font-size:.74rem;font-weight:400">(' + t.margePct.toFixed(1) + '%)</span></td>' +
      '</tr>';
    }).join('');
    var totaux = stats.reduce(function (acc, t) {
      acc.ca += t.ca; acc.marge += t.marge; acc.nbLivraisons += t.nbLivraisons;
      return acc;
    }, { ca: 0, marge: 0, nbLivraisons: 0 });
    majTotauxRent('tournee', totaux);
  }

  // ===== Drill-down tournee : detail livraisons =====
  function voirDetailTournee(tourneeId) {
    var t = (window.__rentTourneesCache || {})[tourneeId];
    if (!t) return;
    var corps = document.getElementById('detail-tournee-body');
    var titre = document.getElementById('detail-tournee-title');
    if (!corps || !titre) return;
    titre.textContent = '🛣️ Tournée ' + t.date + ' — ' + t.chaufNom;
    var couleur = t.marge >= 0 ? '#28a745' : '#dc3545';
    var html =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">' +
        kpiBox('CA HT', euros(t.ca)) +
        kpiBox('Carburant', euros(t.coutCarburant)) +
        kpiBox('Salaire imputé', euros(t.coutSalaire)) +
        kpiBox('Marge', '<span style="color:' + couleur + '">' + euros(t.marge) + ' (' + t.margePct.toFixed(1) + '%)</span>') +
      '</div>' +
      '<div style="font-weight:600;margin-bottom:6px">Livraisons (' + t.livraisons.length + ')</div>' +
      '<table class="data-table" style="font-size:.88rem">' +
        '<thead><tr><th>N°</th><th>Client</th><th>Distance</th><th>Prix</th></tr></thead>' +
        '<tbody>' +
          t.livraisons.map(function (l) {
            return '<tr>' +
              '<td>' + escapeHtml(l.numLiv || '?') + '</td>' +
              '<td>' + escapeHtml(l.client || '—') + '</td>' +
              '<td>' + (l.distance ? Math.round(l.distance) + ' km' : '—') + '</td>' +
              '<td>' + euros(parseFloat(l.prix) || 0) + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody></table>';
    corps.innerHTML = html;
    if (typeof openModal === 'function') openModal('modal-detail-tournee');
  }

  function kpiBox(label, val) {
    return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 12px">' +
      '<div style="font-size:.74rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">' + label + '</div>' +
      '<div style="font-size:1.05rem;font-weight:700;margin-top:2px">' + val + '</div>' +
    '</div>';
  }

  // ===== Export PDF rapport mensuel multi-axes =====
  function exporterRapportRentabilitePDF() {
    var range = getRangeAnalyse();
    var v = calculerRentabiliteParVehicule(range);
    var c = calculerRentabiliteParClient(range);
    var ch = calculerRentabiliteParChauffeur(range);
    var tr = calculerRentabiliteParTournee(range);
    var sumV = sumStats(v), sumC = sumStats(c), sumCh = sumStats(ch), sumT = sumStats(tr);

    var renderRow = function (cells) {
      return '<tr>' + cells.map(function (c) { return '<td style="padding:6px 10px;border-bottom:1px solid #eee">' + c + '</td>'; }).join('') + '</tr>';
    };
    var renderTable = function (titre, headers, rows) {
      return '<h2 style="font-size:14pt;color:#222;margin:18pt 0 6pt">' + titre + '</h2>' +
        '<table style="width:100%;border-collapse:collapse;font-size:9pt">' +
        '<thead><tr>' + headers.map(function (h) { return '<th style="padding:6px 10px;background:#f5f5f5;text-align:left;font-weight:700">' + h + '</th>'; }).join('') + '</tr></thead>' +
        '<tbody>' + rows.join('') + '</tbody></table>';
    };

    var rowsV = v.slice(0, 20).map(function (s) {
      return renderRow([escapeHtml(s.immat), s.nbLivraisons, Math.round(s.kmTotal) + ' km', euros(s.ca), euros(s.coutTotal), euros(s.marge) + ' (' + s.margePct.toFixed(1) + '%)']);
    });
    var rowsC = c.slice(0, 20).map(function (s) {
      return renderRow([escapeHtml(s.clientNom), s.nbLivraisons, Math.round(s.kmTotal) + ' km', euros(s.ca), euros(s.coutTotal), euros(s.marge) + ' (' + s.margePct.toFixed(1) + '%)']);
    });
    var rowsCh = ch.slice(0, 20).map(function (s) {
      return renderRow([escapeHtml(s.chaufNom), s.nbLivraisons, Math.round(s.kmTotal) + ' km', euros(s.ca), euros(s.coutTotal), euros(s.marge) + ' (' + s.margePct.toFixed(1) + '%)']);
    });
    var rowsT = tr.slice(0, 30).map(function (t) {
      return renderRow([t.date, escapeHtml(t.chaufNom), escapeHtml(t.vehImmat || '—'), t.nbLivraisons, euros(t.ca), euros(t.marge) + ' (' + t.margePct.toFixed(1) + '%)']);
    });

    var html =
      '<h1 style="font-size:18pt;color:#000;margin:0 0 6pt">📊 Rapport rentabilité — MCA Logistics</h1>' +
      '<div style="color:#666;font-size:10pt;margin-bottom:12pt">Période : ' + escapeHtml(range.debut || '') + ' → ' + escapeHtml(range.fin || '') + '</div>' +
      '<div style="display:flex;gap:18pt;font-size:10pt;margin-bottom:12pt">' +
        '<div><strong>CA total :</strong> ' + euros(sumV.ca) + '</div>' +
        '<div><strong>Marge :</strong> ' + euros(sumV.marge) + '</div>' +
        '<div><strong>Livraisons :</strong> ' + sumV.nb + '</div>' +
      '</div>' +
      renderTable('🚐 Par véhicule (top 20)',
        ['Véhicule', 'Livraisons', 'Km', 'CA HT', 'Coûts', 'Marge'], rowsV) +
      renderTable('👤 Par client (top 20 par marge)',
        ['Client', 'Livraisons', 'Km', 'CA HT', 'Coûts', 'Marge'], rowsC) +
      renderTable('🧑‍✈️ Par chauffeur (top 20 par marge)',
        ['Chauffeur', 'Livraisons', 'Km', 'CA HT', 'Coûts', 'Marge'], rowsCh) +
      renderTable('🛣️ Tournées (30 plus récentes)',
        ['Date', 'Chauffeur', 'Véhicule', 'Livraisons', 'CA HT', 'Marge'], rowsT);

    var win = window.open('', '_blank');
    if (!win) {
      if (typeof afficherToast === 'function') afficherToast('⚠️ Bloqué par le navigateur (popup)', 'error');
      return;
    }
    win.document.write('<!DOCTYPE html><html><head><title>Rentabilité ' + escapeHtml(range.debut || '') + '</title>' +
      '<style>body{margin:0;padding:24px;background:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222}@page{margin:12mm}h1,h2{page-break-after:avoid}table{page-break-inside:avoid}</style>' +
      '</head><body>' + html + '<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  }

  function sumStats(arr) {
    return arr.reduce(function (acc, s) {
      acc.ca += s.ca || 0;
      acc.marge += s.marge || 0;
      acc.nb += s.nbLivraisons || 0;
      return acc;
    }, { ca: 0, marge: 0, nb: 0 });
  }

  // Expose
  window.getConfigRentabilite          = getConfig;
  window.getTourneeIdLivraison         = getTourneeId;
  window.calculerRentabiliteParVehicule = calculerRentabiliteParVehicule;
  window.afficherRentabiliteParVehicule = afficherRentabiliteParVehicule;
  window.calculerRentabiliteParClient  = calculerRentabiliteParClient;
  window.afficherRentabiliteParClient  = afficherRentabiliteParClient;
  window.calculerRentabiliteParChauffeur = calculerRentabiliteParChauffeur;
  window.afficherRentabiliteParChauffeur = afficherRentabiliteParChauffeur;
  window.calculerRentabiliteParTournee = calculerRentabiliteParTournee;
  window.afficherRentabiliteParTournee = afficherRentabiliteParTournee;
  window.voirDetailTournee = voirDetailTournee;
  window.exporterRapportRentabilitePDF = exporterRapportRentabilitePDF;
  window.changerSousOngletRentabilite  = changerSousOngletRentabilite;
  window.ouvrirConfigRentabilite       = ouvrirConfigRentabilite;
  window.enregistrerConfigRentabilite  = enregistrerConfigRentabilite;
  window.getRangeAnalyseRentabilite    = getRangeAnalyse;
})();
