/**
 * MCA Logistics — Module Rentabilite
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L3343 (script.js d'origine)
function alerteRentabilite() {
  // Lit en priorité prix HT (cohérent avec coût/km en HT). Sinon dérive depuis TTC.
  const ht = parseFloat(document.getElementById('liv-prix-ht')?.value) || 0;
  const ttc = parseFloat(document.getElementById('liv-prix')?.value) || 0;
  const taux = parseFloat(document.getElementById('liv-taux-tva')?.value) || 20;
  const prix = ht > 0 ? ht : (ttc > 0 ? ttc / (1 + taux/100) : 0);
  const dist = parseFloat(document.getElementById('liv-distance').value)||0;
  const profit = prix - dist * config.coutKmEstime;
  const ar = document.getElementById('alerte-rent'), pr = document.getElementById('profit-recap');
  if (prix > 0) {
    pr.style.display = 'block';
    document.getElementById('profit-estime').textContent = euros(profit);
    ar.style.display = (profit < prix*0.2 || profit < 0) ? 'block' : 'none';
  } else { pr.style.display = 'none'; ar.style.display = 'none'; }
}

// L3577 (script.js d'origine)
function getVehiculeMensualiteRentabilite(veh) {
  if (!veh) return 0;
  switch (veh.modeAcquisition) {
    case 'lld':
    case 'location':
    case 'loa':
      return parseFloat(veh.loyerMensuelHT) || 0;
    case 'credit':
      return parseFloat(veh.creditMensualiteHT) || 0;
    case 'achat':
    case 'occasion':
      if ((parseFloat(veh.prixAchatHT) || 0) > 0 && (parseFloat(veh.dureeAmortissement) || 0) > 0) {
        return (parseFloat(veh.prixAchatHT) || 0) / ((parseFloat(veh.dureeAmortissement) || 0) * 12);
      }
      return 0;
    default:
      return 0;
  }
}

// L4883 (script.js d'origine)
function afficherRentabilite() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(afficherRentabilite).catch(() => {}); return; }
  let livraisons=charger('livraisons'), pleins=charger('carburant'), entretiens=charger('entretiens'), charges=charger('charges');
  const range = getRentMoisRange();
  livraisons = livraisons.filter(l=>l.date>=range.debut&&l.date<=range.fin);
  pleins = pleins.filter(p=>p.date>=range.debut&&p.date<=range.fin);
  entretiens = entretiens.filter(e=>e.date>=range.debut&&e.date<=range.fin);
  charges = charges.filter(c=>c.date>=range.debut&&c.date<=range.fin && c.categorie !== 'entretien');
  const lbl = document.getElementById('rent-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('rent-mois-dates'); if (dates) dates.textContent = range.dates;

  const ca=livraisons.reduce((s,l)=>s+(l.prix||0),0);
  const carb=pleins.reduce((s,p)=>s+p.total,0);
  const entr=entretiens.reduce((s,e)=>s+(e.cout||0),0);
  const autresCharges = charges.reduce((s,c)=>s+(c.montant||0),0);
  const dep=carb+entr+autresCharges, profit=ca-dep, marge=ca>0?(profit/ca*100):0;
  const km=livraisons.reduce((s,l)=>s+(l.distance||0),0);
  document.getElementById('rent-ca').textContent        = euros(ca);
  document.getElementById('rent-carb').textContent      = euros(carb);
  document.getElementById('rent-entretien').textContent = euros(entr);
  document.getElementById('rent-charges').textContent   = euros(autresCharges);
  document.getElementById('rent-cout-km').textContent   = euros(km>0?dep/km:0);
  document.getElementById('rent-profit').textContent    = euros(profit);
  document.getElementById('rent-marge').textContent     = marge.toFixed(1)+' %';
  if (chartRentab) chartRentab.destroy();
  const isLight = document.body.classList.contains('light-mode');
  chartRentab = new Chart(document.getElementById('chartRentabilite'), {
    type:'doughnut',
    data:{
      labels:['Carburant','Entretien','Autres charges','Profit net'],
      datasets:[{
        data:[carb,entr,autresCharges,Math.max(profit,0)],
        backgroundColor:['rgba(230,126,34,0.9)','rgba(52,152,219,0.9)','rgba(155,89,182,0.9)','rgba(46,204,113,0.9)'],
        borderColor: isLight ? '#ffffff' : '#1a1d27',
        borderWidth:4,
        hoverOffset: 12,
        spacing: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      cutout: '62%',
      animation: { animateScale: true, animateRotate: true, duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: { color: isLight ? '#1a1d27' : '#e8eaf0', font: { weight: '600', size: 12 }, padding: 14, boxWidth: 14, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          backgroundColor: isLight ? 'rgba(17,24,39,0.95)' : 'rgba(10,13,20,0.95)',
          titleColor: '#ffffff', bodyColor: '#e2e8f0',
          borderColor: 'rgba(245,166,35,0.4)', borderWidth: 1,
          padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => ' ' + ctx.label + ' : ' + euros(ctx.parsed || 0) }
        }
      }
    }
  });
}

// L4941 (script.js d'origine)
function genererRentabilitePDF() {
  const params = getEntrepriseExportParams();
  const nom    = params.nom;
  const ca     = document.getElementById('rent-ca')?.textContent || '0 €';
  const carb   = document.getElementById('rent-carb')?.textContent || '0 €';
  const entr   = document.getElementById('rent-entretien')?.textContent || '0 €';
  const autres = document.getElementById('rent-charges')?.textContent || '0 €';
  const coutKm = document.getElementById('rent-cout-km')?.textContent || '0 €';
  const profit = document.getElementById('rent-profit')?.textContent || '0 €';
  const marge  = document.getElementById('rent-marge')?.textContent || '0 %';
  const dateExp = formatDateHeureExport();

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1d27">
    ${construireEnteteExport(params, 'Rapport de rentabilité', '', dateExp)}
    ${renderBlocInfosEntreprise(params)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">
      ${[['💶 CA',ca,'#f5a623'],['⛽ Carburant',carb,'#e74c3c'],['🔧 Entretien',entr,'#3498db'],['📝 Autres charges',autres,'#9b59b6'],['📏 Coût/km',coutKm,'#6b7280'],['💰 Profit',profit,'#2ecc71'],['📊 Marge',marge,'#9b59b6']].map(([l,v,c])=>`<div style="background:#f8f9fc;border-radius:10px;padding:14px;text-align:center;border-top:3px solid ${c}"><div style="font-size:.72rem;color:#9ca3af;margin-bottom:6px">${l}</div><div style="font-size:1.1rem;font-weight:800;color:${c}">${v}</div></div>`).join('')}
    </div>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  ouvrirFenetreImpression('Rentabilité — ' + nom, html, 'width=800,height=600');
  afficherToast('📄 Rapport rentabilité généré');
}

// L16110 (script.js d'origine)
function getRentabiliteDefaults() {
  return {
    modeCalcul: 'manuel',
    livraisonId: '',
    repartitionCharges: 'mensuel',
    kmJour: 0,
    prixKm: 0,
    joursTravailles: 0,
    conso: 0,
    prixCarburant: 0,
    lldCredit: 0,
    assurance: 0,
    salaireCharge: 0,
    tva: 20,
    autresCharges: []
  };
}

// L16128 (script.js d'origine)
function chargerRentabiliteConfig() {
  var config = chargerObj(RENTABILITE_STORAGE_KEY, null);
  var defaults = getRentabiliteDefaults();
  if (!config || typeof config !== 'object') return defaults;
  if (!Object.prototype.hasOwnProperty.call(config, 'modeCalcul')) return defaults;
  return {
    modeCalcul: config.modeCalcul === 'livraison' ? 'livraison' : 'manuel',
    livraisonId: config.livraisonId || '',
    repartitionCharges: config.repartitionCharges === 'prorata' ? 'prorata' : 'mensuel',
    kmJour: parseFloat(config.kmJour) || 0,
    prixKm: parseFloat(config.prixKm) || 0,
    joursTravailles: parseFloat(config.joursTravailles) || 0,
    conso: parseFloat(config.conso) || 0,
    prixCarburant: parseFloat(config.prixCarburant) || 0,
    lldCredit: parseFloat(config.lldCredit) || 0,
    assurance: parseFloat(config.assurance) || 0,
    salaireCharge: parseFloat(config.salaireCharge) || 0,
    tva: parseFloat(config.tva) || 0,
    autresCharges: Array.isArray(config.autresCharges) ? config.autresCharges.map(function(item) {
      return {
        id: item.id || genId(),
        label: item.label || '',
        montant: parseFloat(item.montant) || 0
      };
    }) : defaults.autresCharges
  };
}

// L16156 (script.js d'origine)
function sauvegarderRentabiliteConfig(config) {
  sauvegarder(RENTABILITE_STORAGE_KEY, config);
}

// L16160 (script.js d'origine)
function rentabiliteGetContainer() {
  return document.getElementById('page-rentabilite');
}

// L16164 (script.js d'origine)
function rentabiliteWireEvents() {
  var container = rentabiliteGetContainer();
  if (!container || container.dataset.rentabiliteBound === '1') return;
  container.dataset.rentabiliteBound = '1';
  container.addEventListener('input', function(event) {
    if (!event.target.matches('input[data-rent-field], input[data-rent-charge], select[data-rent-field]')) return;
    rentabiliteSyncFromDom();
  });
  container.addEventListener('change', function(event) {
    if (!event.target.matches('input[data-rent-field], input[data-rent-charge], select[data-rent-field]')) return;
    rentabiliteSyncFromDom();
  });
}

// L16178 (script.js d'origine)
function getRentabiliteLivraisonLabel(livraison) {
  if (!livraison) return '';
  return [
    livraison.numLiv || 'Livraison',
    livraison.client || '',
    livraison.date ? formatDateExport(livraison.date) : ''
  ].filter(Boolean).join(' - ');
}

// L16187 (script.js d'origine)
function rentabiliteGetSelectedLivraison(config) {
  if (!config.livraisonId) return null;
  return charger('livraisons').find(function(item) { return item.id === config.livraisonId; }) || null;
}

// L16192 (script.js d'origine)
function rentabiliteGetVehiculeActif(config) {
  var livraison = rentabiliteGetSelectedLivraison(config);
  if (livraison?.vehId) return getVehiculeById(livraison.vehId);
  var vehicules = charger('vehicules');
  if (vehicules.length === 1) return vehicules[0];
  return null;
}

// L16200 (script.js d'origine)
function rentabiliteGetMoisReference(config) {
  var livraison = rentabiliteGetSelectedLivraison(config);
  if (livraison?.date && /^\d{4}-\d{2}/.test(livraison.date)) return livraison.date.slice(0, 7);
  return aujourdhui().slice(0, 7);
}

// L16206 (script.js d'origine)
function rentabiliteGetChargesReellesMois(config) {
  var mois = rentabiliteGetMoisReference(config);
  var charges = charger('charges').filter(function(item) {
    return (item.date || '').slice(0, 7) === mois;
  });
  var totals = {
    mois: mois,
    lldCredit: 0,
    assurance: 0,
    salaireCharge: 0,
    autres: {}
  };
  charges.forEach(function(item) {
    var categorie = item.categorie || 'autre';
    if (categorie === 'tva') return;
    var montant = parseFloat(item.montantHT || item.montant) || 0;
    if (categorie === 'lld_credit' || categorie === 'lld-credit') totals.lldCredit += montant;
    else if (categorie === 'assurance') totals.assurance += montant;
    else if (categorie === 'salaires') totals.salaireCharge += montant;
    else totals.autres[categorie] = (totals.autres[categorie] || 0) + montant;
  });
  return totals;
}

// L16230 (script.js d'origine)
function rentabiliteGetPrixCarburantMoyen(livraison) {
  var pleins = charger('carburant');
  if (!pleins.length) return null;
  var filtres = [];
  if (livraison?.vehId) {
    filtres = pleins.filter(function(plein) { return plein.vehId === livraison.vehId && parseFloat(plein.prixLitre) > 0; });
  }
  if (!filtres.length) {
    filtres = pleins.filter(function(plein) { return parseFloat(plein.prixLitre) > 0; });
  }
  if (!filtres.length) return null;
  var total = filtres.reduce(function(sum, plein) { return sum + (parseFloat(plein.prixLitre) || 0); }, 0);
  return total / filtres.length;
}

// L16245 (script.js d'origine)
function rentabiliteUpdateFuelHelper(config) {
  var helper = document.getElementById('rent-fuel-helper');
  var button = document.getElementById('rent-use-real-fuel');
  if (!helper || !button) return;
  var livraison = rentabiliteGetSelectedLivraison(config);
  var moyenne = rentabiliteGetPrixCarburantMoyen(livraison);
  if (moyenne && isFinite(moyenne)) {
    helper.textContent = 'Prix moyen réel disponible : ' + moyenne.toFixed(2).replace('.', ',') + ' €/L';
    button.style.display = '';
  } else {
    helper.textContent = 'Aucun plein exploitable pour proposer un prix moyen réel.';
    button.style.display = 'none';
  }
}

// L16260 (script.js d'origine)
function rentabiliteAppliquerPrixCarburantReel() {
  var config = chargerRentabiliteConfig();
  var moyenne = rentabiliteGetPrixCarburantMoyen(rentabiliteGetSelectedLivraison(config));
  if (!moyenne || !isFinite(moyenne)) {
    afficherToast('Aucune donnée carburant exploitable', 'error');
    return;
  }
  var input = document.getElementById('rent-prix-carburant');
  if (input) input.value = moyenne.toFixed(2);
  rentabiliteSyncFromDom();
}

// L16272 (script.js d'origine)
function rentabiliteChargerDepuisVehicule() {
  var config = chargerRentabiliteConfig();
  var vehicule = rentabiliteGetVehiculeActif(config);
  if (!vehicule) {
    afficherToast('Aucun véhicule exploitable pour préremplir les coûts', 'error');
    return;
  }
  var mensualiteVehicule = getVehiculeMensualiteRentabilite(vehicule);
  if (mensualiteVehicule > 0) config.lldCredit = mensualiteVehicule;
  if ((parseFloat(config.conso) || 0) <= 0 && (parseFloat(vehicule.conso) || 0) > 0) {
    config.conso = parseFloat(vehicule.conso) || 0;
  }
  sauvegarderRentabiliteConfig(config);
  rentabiliteFillInputs(config);
  rentabiliteRenderResults(calculerRentabiliteAvancee(config), config);
  afficherToast('Coûts du véhicule chargés dans le calculateur');
}

// L16290 (script.js d'origine)
function rentabiliteChargerChargesReelles() {
  var config = chargerRentabiliteConfig();
  var chargesMois = rentabiliteGetChargesReellesMois(config);
  config.lldCredit = chargesMois.lldCredit;
  config.assurance = chargesMois.assurance;
  config.salaireCharge = chargesMois.salaireCharge;
  config.autresCharges = Object.entries(chargesMois.autres).filter(function(entry) {
    return (parseFloat(entry[1]) || 0) > 0;
  }).map(function(entry) {
    return {
      id: genId(),
      label: {
        carburant: 'Carburant réel',
        peage: 'Péages',
        entretien: 'Entretiens',
        autre: 'Autres charges'
      }[entry[0]] || entry[0],
      montant: parseFloat(entry[1]) || 0
    };
  });
  var helper = document.getElementById('rent-charges-helper');
  if (helper) {
    helper.textContent = 'Import du mois ' + chargesMois.mois.split('-').reverse().join('/') + ' : '
      + euros(chargesMois.lldCredit + chargesMois.assurance + chargesMois.salaireCharge
      + Object.values(chargesMois.autres).reduce(function(sum, value) { return sum + (parseFloat(value) || 0); }, 0));
  }
  sauvegarderRentabiliteConfig(config);
  rentabiliteFillInputs(config);
  rentabiliteRenderResults(calculerRentabiliteAvancee(config), config);
  afficherToast('Charges réelles du mois chargées');
}

// L16322 (script.js d'origine)
function rentabiliteHasChargeDoublonLLD(config) {
  return (config.autresCharges || []).some(function(item) {
    var label = (item.label || '').toLowerCase();
    return /(lld|leasing|credit|crédit)/.test(label) && (parseFloat(item.montant) || 0) > 0;
  });
}

// L16329 (script.js d'origine)
function rentabiliteApplyLivraisonToConfig(config, options) {
  options = options || {};
  var livraison = rentabiliteGetSelectedLivraison(config);
  if (!livraison) return config;
  var vehicule = livraison.vehId ? getVehiculeById(livraison.vehId) : null;
  config.kmJour = parseFloat(livraison.distance) || 0;
  config.prixKm = config.kmJour > 0 ? (getMontantHTLivraison(livraison) / config.kmJour) : 0;
  if (options.forceDaysMinOne !== false) {
    config.joursTravailles = Math.max(1, parseFloat(config.joursTravailles) || 0);
  }
  if ((!config.tva || config.tva < 0) && livraison.tauxTVA != null) {
    config.tva = parseFloat(livraison.tauxTVA) || 20;
  }
  if ((!config.prixCarburant || config.prixCarburant <= 0)) {
    var moyenne = rentabiliteGetPrixCarburantMoyen(livraison);
    if (moyenne && isFinite(moyenne)) config.prixCarburant = moyenne;
  }
  if ((!config.conso || config.conso <= 0) && vehicule && (parseFloat(vehicule.conso) || 0) > 0) {
    config.conso = parseFloat(vehicule.conso) || 0;
  }
  if ((!config.lldCredit || config.lldCredit <= 0) && vehicule) {
    var mensualiteVehicule = getVehiculeMensualiteRentabilite(vehicule);
    if (mensualiteVehicule > 0) config.lldCredit = mensualiteVehicule;
  }
  return config;
}

// L16356 (script.js d'origine)
function rentabiliteRenderLivraisonsSelect(config) {
  var select = document.getElementById('rent-livraison-select');
  if (!select) return;
  var livraisons = charger('livraisons').slice().sort(function(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });
  if (!config.livraisonId && livraisons.length) config.livraisonId = livraisons[0].id;
  select.innerHTML = '<option value="">' + (livraisons.length ? '-- Choisir une livraison --' : 'Aucune livraison disponible') + '</option>' + livraisons.map(function(livraison) {
    return '<option value="' + livraison.id + '">' + planningEscapeHtml(getRentabiliteLivraisonLabel(livraison)) + '</option>';
  }).join('');
  select.value = livraisons.some(function(item) { return item.id === config.livraisonId; }) ? config.livraisonId : '';
  select.setAttribute('data-rent-field', 'rent-livraison-select');
}

// L16370 (script.js d'origine)
function rentabiliteToggleMode(config) {
  var wrap = document.getElementById('rent-livraison-wrap');
  var modeHelper = document.getElementById('rent-mode-helper');
  var kmLabel = document.getElementById('rent-km-label');
  var joursLabel = document.getElementById('rent-jours-label');
  var joursHelper = document.getElementById('rent-jours-helper');
  if (wrap) wrap.style.display = config.modeCalcul === 'livraison' ? 'block' : 'none';
  ['rent-km-jour', 'rent-prix-km'].forEach(function(id) {
    var input = document.getElementById(id);
    var group = input?.closest('.form-group');
    if (!input) return;
    input.readOnly = config.modeCalcul === 'livraison';
    if (group) group.classList.toggle('is-disabled', config.modeCalcul === 'livraison');
  });
  var joursInput = document.getElementById('rent-jours-travailles');
  var joursGroup = joursInput?.closest('.form-group');
  if (joursInput) joursInput.readOnly = false;
  if (joursInput) joursInput.min = config.modeCalcul === 'livraison' ? '1' : '0';
  if (joursGroup) joursGroup.classList.remove('is-disabled');
  if (kmLabel) kmLabel.textContent = config.modeCalcul === 'livraison' ? 'Distance de la livraison (km)' : 'Km par jour';
  if (joursLabel) joursLabel.textContent = config.modeCalcul === 'livraison' ? 'Fréquence mensuelle de ce type de livraison' : 'Jours travaillés dans le mois';
  if (joursHelper) {
    joursHelper.textContent = config.modeCalcul === 'livraison'
      ? 'Combien de fois par mois réalisez-vous ce type de livraison ?'
      : 'Renseignez le nombre de jours réellement travaillés sur la période.';
  }
  if (modeHelper) {
    modeHelper.textContent = config.modeCalcul === 'livraison'
      ? 'Projection mensuelle : l’outil estime la rentabilité si vous répétez cette livraison sur le mois.'
      : 'Simulez votre activité à partir de vos propres hypothèses.';
  }
  var chargesHelper = document.getElementById('rent-charges-helper');
  if (chargesHelper && !chargesHelper.textContent) {
    chargesHelper.textContent = 'Importez vos charges réelles du mois si vous voulez partir du terrain.';
  }
  rentabiliteUpdateFuelHelper(config);
}

// L16408 (script.js d'origine)
function rentabiliteRenderCharges(config) {
  var host = document.getElementById('rent-autres-charges');
  if (!host) return;
  if (!config.autresCharges.length) {
    host.innerHTML = '<div class="rentabilite-alert-item">Aucune autre charge ajoutée pour le moment.</div>';
    return;
  }
  host.innerHTML = config.autresCharges.map(function(item) {
    return '<div class="rentabilite-charge-row">'
      + '<input type="text" data-rent-charge="label" data-charge-id="' + item.id + '" value="' + planningEscapeHtml(item.label || '') + '" placeholder="Libellé de la charge" />'
      + '<input type="number" data-rent-charge="montant" data-charge-id="' + item.id + '" value="' + (parseFloat(item.montant) || 0) + '" min="0" step="0.01" placeholder="Montant HT" />'
      + '<button type="button" class="btn-secondary" onclick="supprimerChargeRentabilite(\'' + item.id + '\')">Supprimer</button>'
      + '</div>';
  }).join('');
}

// L16424 (script.js d'origine)
function rentabiliteFillInputs(config) {
  var fieldMap = {
    'rent-mode-calcul': config.modeCalcul,
    'rent-repartition-charges': config.repartitionCharges,
    'rent-km-jour': config.kmJour,
    'rent-prix-km': config.prixKm,
    'rent-jours-travailles': config.joursTravailles,
    'rent-conso': config.conso,
    'rent-prix-carburant': config.prixCarburant,
    'rent-lld-credit': config.lldCredit,
    'rent-assurance': config.assurance,
    'rent-salaire-charge': config.salaireCharge,
    'rent-taux-tva': config.tva
  };
  Object.keys(fieldMap).forEach(function(id) {
    var input = document.getElementById(id);
    if (input) {
      if (id === 'rent-prix-km' || id === 'rent-prix-carburant' || id === 'rent-lld-credit' || id === 'rent-assurance' || id === 'rent-salaire-charge') {
        input.value = fieldMap[id] ? parseFloat(fieldMap[id]).toFixed(2) : fieldMap[id];
      } else {
        input.value = fieldMap[id];
      }
      input.setAttribute('data-rent-field', id);
    }
  });
  rentabiliteRenderLivraisonsSelect(config);
  rentabiliteToggleMode(config);
  rentabiliteRenderCharges(config);
}

// L16454 (script.js d'origine)
function rentabiliteReadFromDom(config) {
  var next = {
    modeCalcul: document.getElementById('rent-mode-calcul')?.value === 'livraison' ? 'livraison' : 'manuel',
    livraisonId: document.getElementById('rent-livraison-select')?.value || '',
    repartitionCharges: document.getElementById('rent-repartition-charges')?.value === 'prorata' ? 'prorata' : 'mensuel',
    kmJour: parseFloat(document.getElementById('rent-km-jour')?.value) || 0,
    prixKm: parseFloat(document.getElementById('rent-prix-km')?.value) || 0,
    joursTravailles: parseFloat(document.getElementById('rent-jours-travailles')?.value) || 0,
    conso: parseFloat(document.getElementById('rent-conso')?.value) || 0,
    prixCarburant: parseFloat(document.getElementById('rent-prix-carburant')?.value) || 0,
    lldCredit: parseFloat(document.getElementById('rent-lld-credit')?.value) || 0,
    assurance: parseFloat(document.getElementById('rent-assurance')?.value) || 0,
    salaireCharge: parseFloat(document.getElementById('rent-salaire-charge')?.value) || 0,
    tva: parseFloat(document.getElementById('rent-taux-tva')?.value) || 0,
    autresCharges: (config.autresCharges || []).map(function(item) {
      var labelInput = document.querySelector('[data-rent-charge="label"][data-charge-id="' + item.id + '"]');
      var montantInput = document.querySelector('[data-rent-charge="montant"][data-charge-id="' + item.id + '"]');
      return {
        id: item.id,
        label: labelInput ? labelInput.value.trim() : (item.label || ''),
        montant: montantInput ? (parseFloat(montantInput.value) || 0) : (parseFloat(item.montant) || 0)
      };
    })
  };
  if (next.modeCalcul === 'livraison') {
    next = rentabiliteApplyLivraisonToConfig(next);
  }
  return next;
}

// L16484 (script.js d'origine)
function calculerRentabiliteAvancee(config) {
  var livraison = rentabiliteGetSelectedLivraison(config);
  var isLivraisonMode = config.modeCalcul === 'livraison';
  var kmJour = isLivraisonMode ? (parseFloat(livraison?.distance) || 0) : config.kmJour;
  var joursTravailles = Math.max(0, config.joursTravailles || 0);
  if (isLivraisonMode && !livraison) joursTravailles = 0;
  var kmTotal = kmJour * joursTravailles;
  var caJournalierHT = isLivraisonMode ? (livraison ? getMontantHTLivraison(livraison) : 0) : (kmJour * config.prixKm);
  var caLivraisonHT = isLivraisonMode ? caJournalierHT : null;
  var caHT = caJournalierHT * joursTravailles;
  var prixKm = kmJour > 0 ? (caJournalierHT / kmJour) : 0;
  var caTTC = caHT * (1 + config.tva / 100);
  var litresMois = kmTotal * config.conso / 100;
  var coutCarburant = litresMois * config.prixCarburant;
  var autresCharges = (config.autresCharges || []).reduce(function(sum, item) { return sum + (parseFloat(item.montant) || 0); }, 0);
  var chargesFixesMensuelles = config.lldCredit + config.assurance + config.salaireCharge + autresCharges;
  var prorataBlocked = config.repartitionCharges === 'prorata' && joursTravailles <= 0;
  var chargesFixes = config.repartitionCharges === 'prorata' && !prorataBlocked
    ? (chargesFixesMensuelles / 30) * config.joursTravailles
    : chargesFixesMensuelles;
  var coutTotal = chargesFixes + coutCarburant;
  var beneficeNet = caHT - coutTotal;
  var coutParKm = kmTotal > 0 ? coutTotal / kmTotal : 0;
  var margeParKm = kmTotal > 0 ? beneficeNet / kmTotal : 0;
  var revenuJournalier = caJournalierHT;
  var coutVariableJournalier = (kmJour * config.conso / 100) * config.prixCarburant;
  var margeJournaliere = revenuJournalier - coutVariableJournalier;
  var seuilJours = margeJournaliere > 0 ? chargesFixes / margeJournaliere : null;
  var pointMortCA = seuilJours != null ? seuilJours * revenuJournalier : null;
  var pristine = config.modeCalcul !== 'livraison'
    && kmJour <= 0
    && (config.prixKm || 0) <= 0
    && joursTravailles <= 0
    && (config.conso || 0) <= 0
    && (config.prixCarburant || 0) <= 0;
  return {
    modeCalcul: config.modeCalcul,
    livraison: livraison,
    caLivraisonHT: caLivraisonHT,
    kmJour: kmJour,
    prixKm: prixKm,
    joursTravailles: joursTravailles,
    kmTotal: kmTotal,
    caHT: caHT,
    caTTC: caTTC,
    litresMois: litresMois,
    coutCarburant: coutCarburant,
    autresCharges: autresCharges,
    chargesFixesMensuelles: chargesFixesMensuelles,
    chargesFixes: chargesFixes,
    coutTotal: coutTotal,
    beneficeNet: beneficeNet,
    coutParKm: coutParKm,
    margeParKm: margeParKm,
    revenuJournalier: revenuJournalier,
    coutVariableJournalier: coutVariableJournalier,
    margeJournaliere: margeJournaliere,
    seuilJours: seuilJours,
    pointMortCA: pointMortCA,
    joursInvalides: joursTravailles <= 0,
    prorataBlocked: prorataBlocked,
    lldDoublonDetecte: rentabiliteHasChargeDoublonLLD(config),
    pristine: pristine
  };
}

// L16550 (script.js d'origine)
function rentabiliteFormatJours(value) {
  if (value == null || !isFinite(value)) return 'Non atteignable';
  return value.toFixed(2).replace('.', ',') + ' j';
}

// L16555 (script.js d'origine)
function rentabiliteRenderAlerts(results, config) {
  var host = document.getElementById('rent-alertes');
  if (!host) return;
  if (results.pristine) {
    host.innerHTML = '<div class="rentabilite-alert-item">Renseignez vos hypothèses ou chargez vos données réelles pour lancer l’analyse.</div>';
    return;
  }
  var alerts = [];
  if (results.joursInvalides) {
    alerts.push({ type: 'warning', text: results.modeCalcul === 'livraison'
      ? 'La fréquence mensuelle est à 0 : la livraison sélectionnée a bien un CA HT propre, mais la projection mensuelle reste nulle tant que vous ne saisissez pas au moins 1 occurrence.'
      : 'Les jours travaillés sont à 0 : renseignez au moins 1 jour pour obtenir une projection mensuelle exploitable.' });
  }
  if (results.beneficeNet < 0) {
    alerts.push({ type: 'danger', text: 'Bénéfice négatif : vos coûts dépassent actuellement votre chiffre d’affaires HT.' });
  }
  if (results.seuilJours != null && results.seuilJours > config.joursTravailles) {
    alerts.push({ type: 'warning', text: 'Seuil de rentabilité supérieur aux jours travaillés : l’activité ne couvre pas encore ses charges fixes sur le mois.' });
  }
  if (results.seuilJours == null) {
    alerts.push({ type: 'danger', text: 'Avec les paramètres actuels, la marge journalière ne permet pas d’atteindre la rentabilité.' });
  }
  if (results.prorataBlocked) {
    alerts.push({ type: 'danger', text: 'Prorata bloqué : veuillez renseigner des jours travaillés avant d’activer la proratisation.' });
  } else if (config.repartitionCharges === 'prorata') {
    alerts.push({ type: 'warning', text: 'Charges fixes proratisées : le calcul impute uniquement une quote-part selon les jours travaillés saisis.' });
  }
  if (results.lldDoublonDetecte && config.lldCredit > 0) {
    alerts.push({ type: 'warning', text: 'Possible doublon détecté : une autre charge ressemble à une LLD / leasing / crédit en plus du champ dédié.' });
  }
  if (!alerts.length) {
    alerts.push({ type: 'success', text: 'Structure saine : votre activité couvre ses coûts avec les paramètres actuels.' });
  }
  host.innerHTML = alerts.map(function(alert) {
    return '<div class="rentabilite-alert-item is-' + alert.type + '">' + alert.text + '</div>';
  }).join('');
}

// L16593 (script.js d'origine)
function rentabiliteRenderResults(results, config) {
  var setText = function(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('rent-ca-ht', euros(results.caHT));
  setText('rent-ca-ttc', euros(results.caTTC));
  setText('rent-cout-carburant', euros(results.coutCarburant));
  setText('rent-volume-carburant', results.litresMois.toFixed(1).replace('.', ',') + ' L / mois');
  setText('rent-charges-fixes', euros(results.chargesFixes));
  setText('rent-cout-total', euros(results.coutTotal));
  setText('rent-benefice-net-highlight', results.pristine ? '—' : euros(results.beneficeNet));
  setText('rent-seuil-jours', rentabiliteFormatJours(results.seuilJours));
  setText('rent-point-mort-ca', results.pointMortCA != null ? euros(results.pointMortCA) : 'Non atteignable');
  setText('rent-point-mort-jours', results.seuilJours != null ? rentabiliteFormatJours(results.seuilJours) : 'Non atteignable');
  setText('rent-cout-km', euros(results.coutParKm) + '/km');
  setText('rent-marge-km', 'Marge : ' + euros(results.margeParKm) + '/km');
  setText('rent-revenu-journalier', euros(results.revenuJournalier));
  setText('rent-cout-variable-journalier', euros(results.coutVariableJournalier));
  setText('rent-marge-journaliere', euros(results.margeJournaliere));
  setText('rent-marge-totale', euros(results.beneficeNet));
  setText('rent-resume-activite', results.modeCalcul === 'livraison'
    ? (results.livraison
      ? (getRentabiliteLivraisonLabel(results.livraison) + ' • 1 livraison = ' + euros(results.caLivraisonHT || 0) + ' HT')
      : 'Aucune livraison sélectionnée')
    : (Math.round(results.kmTotal) + ' km / mois'));

  var benefitCard = document.getElementById('rent-highlight-benefice');
  var benefitSummary = document.getElementById('rent-benefice-synthese');
  if (benefitCard) {
    benefitCard.classList.remove('is-positive', 'is-negative');
    benefitCard.classList.add(results.beneficeNet >= 0 ? 'is-positive' : 'is-negative');
  }
  if (benefitSummary) {
    benefitSummary.textContent = results.pristine
      ? 'Renseignez vos données ou importez vos charges réelles pour lancer une analyse fiable.'
      : results.beneficeNet >= 0
      ? 'Votre activité dégage une marge positive avec ces paramètres.'
      : 'Votre activité est déficitaire avec ces paramètres.';
  }

  var chargesCardSub = document.getElementById('rent-charges-fixes')?.closest('.kpi-card')?.querySelector('.kpi-sub');
  if (chargesCardSub) {
    chargesCardSub.textContent = config.repartitionCharges === 'prorata' && !results.prorataBlocked
      ? 'Charges fixes proratisées'
      : 'Mensuelles HT';
  }
  var joursWarning = document.getElementById('rent-jours-warning');
  if (joursWarning) {
    if (results.pristine) {
      joursWarning.style.display = 'none';
      joursWarning.textContent = '';
    } else if (results.joursInvalides) {
      joursWarning.style.display = '';
      joursWarning.textContent = results.modeCalcul === 'livraison'
        ? 'Cette vue projette le résultat mensuel. Passez à au moins 1 occurrence mensuelle pour obtenir un CA projeté.'
        : 'Veuillez renseigner au moins 1 jour travaillé pour éviter une projection mensuelle vide.';
    } else {
      joursWarning.style.display = 'none';
      joursWarning.textContent = '';
    }
  }
  var lldWarning = document.getElementById('rent-lld-warning');
  if (lldWarning) {
    if (results.lldDoublonDetecte && config.lldCredit > 0) {
      lldWarning.style.display = '';
      lldWarning.textContent = '⚠️ Possible doublon avec le champ LLD dédié : une autre charge contient LLD / leasing / crédit.';
    } else {
      lldWarning.style.display = 'none';
      lldWarning.textContent = '';
    }
  }

  var seuilSummary = document.getElementById('rent-resume-seuil');
  if (seuilSummary) {
    seuilSummary.textContent = results.seuilJours != null
      ? (results.modeCalcul === 'livraison'
        ? 'Avec ce type de livraison, il faut environ ' + rentabiliteFormatJours(results.seuilJours) + ' pour couvrir les charges fixes'
        : 'Votre activité devient rentable à partir de ' + rentabiliteFormatJours(results.seuilJours) + ' par mois')
      : 'Votre activité n’atteint pas le seuil de rentabilité avec ces paramètres';
  }
  var summaryCard = document.getElementById('rent-summary-empty');
  var summaryGrid = document.querySelector('#page-rentabilite .rentabilite-summary-grid');
  if (summaryCard && summaryGrid) {
    summaryCard.style.display = (results.pristine || results.joursInvalides) ? '' : 'none';
    summaryGrid.classList.toggle('is-muted', !!(results.pristine || results.joursInvalides));
    if (results.pristine) {
      summaryCard.textContent = 'Renseignez vos hypothèses ou importez vos données réelles pour afficher une synthèse mensuelle cohérente.';
    } else {
      summaryCard.textContent = 'Renseignez les jours travaillés pour afficher une synthèse mensuelle cohérente.';
    }
  }
  rentabiliteRenderAlerts(results, config);
}

// L16688 (script.js d'origine)
function rentabiliteSyncFromDom() {
  var current = chargerRentabiliteConfig();
  var previousMode = current.modeCalcul;
  var next = rentabiliteReadFromDom(current);
  if (next.modeCalcul === 'livraison') {
    next = rentabiliteApplyLivraisonToConfig(next);
  } else if (previousMode === 'livraison' && next.modeCalcul === 'manuel') {
    next.livraisonId = '';
    next.kmJour = 0;
    next.prixKm = 0;
  }
  sauvegarderRentabiliteConfig(next);
  if (next.modeCalcul === 'livraison' || previousMode !== next.modeCalcul) {
    rentabiliteFillInputs(next);
  } else {
    rentabiliteToggleMode(next);
    rentabiliteUpdateFuelHelper(next);
  }
  rentabiliteRenderResults(calculerRentabiliteAvancee(next), next);
}

// L16709 (script.js d'origine)
function ajouterChargeRentabilite() {
  var config = chargerRentabiliteConfig();
  config.autresCharges.push({ id: genId(), label: 'Nouvelle charge', montant: 0 });
  sauvegarderRentabiliteConfig(config);
  rentabiliteRenderCharges(config);
  rentabiliteSyncFromDom();
}

