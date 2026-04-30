/**
 * MCA Logistics — Module Vehicules
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L647 (script.js d'origine)
function calculerAmortissementVehicule(veh) {
  const ht = parseFloat(veh?.prixAchatHT) || 0;
  const valeurRebut = parseFloat(veh?.valeurMiseAuRebut) || 0;
  const duree = parseFloat(veh?.dureeAmortissement) || 0;
  const mode = veh?.modeAmortissement === 'degressif' ? 'degressif' : 'lineaire';
  const base = Math.max(0, ht - valeurRebut);
  if (!base || !duree) {
    return { annuel: 0, mensuel: 0, cumule: 0, reste: base, mode, prorataPremierExercice: 0 };
  }
  const built = construirePlanAmortissement({
    valeurHT: ht,
    valeurRebut,
    dureeAnnees: duree,
    mode,
    dateMiseEnService: veh?.dateAcquisition || '',
    dateCession: veh?.dateMiseAuRebut || ''
  });
  // "Annuel" = annuité théorique affichée en flotte (base × taux nominal)
  const tauxLineaire = duree > 0 ? 1 / duree : 0;
  const coef = mode === 'degressif' ? coefAmortissementDegressif(duree) : 1;
  const annuel = base * tauxLineaire * coef;
  return {
    annuel,
    mensuel: annuel / 12,
    cumule: built.cumuleAujourdHui,
    reste: built.reste,
    mode,
    prorataPremierExercice: built.prorataPremierExercice
  };
}

// L679 (script.js d'origine)
function getVehiculeById(vehId) {
  return charger('vehicules').find(v => v.id === vehId) || null;
}

// L760 (script.js d'origine)
function ouvrirFicheVehiculeDepuisTableau(vehId) {
  if (!vehId) return;
  naviguerVers('vehicules');
  setTimeout(function() {
    ouvrirEditVehicule(vehId);
  }, 180);
}

// L1453 (script.js d'origine)
function getVehiculeParSalId(salId) {
  return charger('vehicules').find(v => v.salId === salId) || null;
}

// L1461 (script.js d'origine)
function getVehiculeKmsParLivraisons(vehId) {
  return charger('livraisons')
    .filter(l => l.vehId === vehId)
    .reduce((sum, l) => sum + (parseFloat(l.distance) || 0), 0);
}

// L1467 (script.js d'origine)
function getVehiculePlusHautKmSaisi(veh) {
  const livraisons = charger('livraisons');
  let maxKm = 0;
  charger('salaries').forEach(function(salarie) {
    charger('km_sal_' + salarie.id).forEach(function(entry) {
      const livraisonLiee = entry.livId ? livraisons.find(l => l.id === entry.livId) : null;
      const concerneVehicule = (livraisonLiee && livraisonLiee.vehId === veh.id) || (veh.salId && salarie.id === veh.salId);
      if (!concerneVehicule) return;
      maxKm = Math.max(maxKm, parseFloat(entry.kmDepart) || 0, parseFloat(entry.kmArrivee) || 0);
    });
  });
  charger('inspections').forEach(function(insp) {
    if (insp.vehId !== veh.id) return;
    maxKm = Math.max(maxKm, parseFloat(insp.km) || 0);
  });
  return maxKm;
}

// L1485 (script.js d'origine)
function calculerKilometrageVehiculeActuel(veh) {
  if (!veh) return 0;
  const kmReference = parseFloat(veh.km) || 0;
  const kmInitial = parseFloat(veh.kmInitial);
  const kmLivraisons = Number.isFinite(kmInitial)
    ? kmInitial + getVehiculeKmsParLivraisons(veh.id)
    : 0;
  const kmSaisi = getVehiculePlusHautKmSaisi(veh);
  return Math.max(kmReference, Number.isFinite(kmInitial) ? kmInitial : 0, kmLivraisons, kmSaisi);
}

// L2596 (script.js d'origine)
function lireFinanceVehiculeDepuisForm() {
  return {
    prixAchatHT: parseFloat(document.getElementById('veh-acq-prix-ht')?.value) || 0,
    tauxTVAAchat: parseFloat(document.getElementById('veh-acq-taux-tva')?.value) || 20,
    prixAchatTTC: parseFloat(document.getElementById('veh-acq-prix')?.value) || 0,
    dureeAmortissement: parseFloat(document.getElementById('veh-duree-amortissement')?.value) || 0,
    modeAmortissement: document.getElementById('veh-mode-amortissement')?.value || 'lineaire',
    dateMiseAuRebut: document.getElementById('veh-date-rebut')?.value || '',
    valeurMiseAuRebut: parseFloat(document.getElementById('veh-valeur-rebut')?.value) || 0,
    kmRachat: parseFloat(document.getElementById('veh-km-rachat')?.value) || 0,
    anneeVehicule: parseFloat(document.getElementById('veh-annee-vehicule')?.value) || 0,
    prixCatalogueHT: parseFloat(document.getElementById('veh-prix-catalogue-ht')?.value) || 0,
    loyerMensuelHT: parseFloat(document.getElementById('veh-loyer-mensuel-ht')?.value) || 0,
    apportInitialHT: parseFloat(document.getElementById('veh-apport-initial-ht')?.value) || 0,
    dureeContratMois: parseFloat(document.getElementById('veh-duree-contrat-mois')?.value) || 0,
    kmInclusContrat: parseFloat(document.getElementById('veh-km-inclus-contrat')?.value) || 0,
    dateFinContrat: document.getElementById('veh-date-fin-contrat')?.value || '',
    depotGarantieHT: parseFloat(document.getElementById('veh-depot-garantie-ht')?.value) || 0,
    coutKmExcedentaire: parseFloat(document.getElementById('veh-cout-km-excedentaire')?.value) || 0,
    creditApportHT: parseFloat(document.getElementById('veh-credit-apport-ht')?.value) || 0,
    creditMensualiteHT: parseFloat(document.getElementById('veh-credit-mensualite-ht')?.value) || 0,
    creditDureeMois: parseFloat(document.getElementById('veh-credit-duree-mois')?.value) || 0,
    creditTaeg: parseFloat(document.getElementById('veh-credit-taeg')?.value) || 0,
    creditCoutTotalHT: parseFloat(document.getElementById('veh-credit-cout-total-ht')?.value) || 0,
    loaOptionAchatHT: parseFloat(document.getElementById('veh-loa-option-achat-ht')?.value) || 0
  };
}

// L2624 (script.js d'origine)
function hydraterFinanceVehiculeDansForm(veh) {
  var map = {
    'veh-acq-prix-ht': veh.prixAchatHT || '',
    'veh-acq-taux-tva': veh.tauxTVAAchat ?? 20,
    'veh-acq-prix': veh.prixAchatTTC || '',
    'veh-duree-amortissement': veh.dureeAmortissement || '',
    'veh-mode-amortissement': veh.modeAmortissement || 'lineaire',
    'veh-date-rebut': veh.dateMiseAuRebut || '',
    'veh-valeur-rebut': veh.valeurMiseAuRebut || '',
    'veh-km-rachat': veh.kmRachat || '',
    'veh-annee-vehicule': veh.anneeVehicule || '',
    'veh-prix-catalogue-ht': veh.prixCatalogueHT || '',
    'veh-loyer-mensuel-ht': veh.loyerMensuelHT || '',
    'veh-apport-initial-ht': veh.apportInitialHT || '',
    'veh-duree-contrat-mois': veh.dureeContratMois || '',
    'veh-km-inclus-contrat': veh.kmInclusContrat || '',
    'veh-date-fin-contrat': veh.dateFinContrat || '',
    'veh-depot-garantie-ht': veh.depotGarantieHT || '',
    'veh-cout-km-excedentaire': veh.coutKmExcedentaire || '',
    'veh-credit-apport-ht': veh.creditApportHT || '',
    'veh-credit-mensualite-ht': veh.creditMensualiteHT || '',
    'veh-credit-duree-mois': veh.creditDureeMois || '',
    'veh-credit-taeg': veh.creditTaeg || '',
    'veh-credit-cout-total-ht': veh.creditCoutTotalHT || '',
    'veh-loa-option-achat-ht': veh.loaOptionAchatHT || ''
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = map[id];
  });
}

// L2656 (script.js d'origine)
function reinitialiserFinanceVehiculeForm() {
  [
    'veh-acq-prix-ht','veh-acq-prix','veh-duree-amortissement','veh-date-rebut','veh-valeur-rebut',
    'veh-km-rachat','veh-annee-vehicule','veh-prix-catalogue-ht','veh-loyer-mensuel-ht','veh-apport-initial-ht',
    'veh-duree-contrat-mois','veh-km-inclus-contrat','veh-date-fin-contrat','veh-depot-garantie-ht',
    'veh-cout-km-excedentaire','veh-credit-apport-ht','veh-credit-mensualite-ht','veh-credit-duree-mois',
    'veh-credit-taeg','veh-credit-cout-total-ht','veh-loa-option-achat-ht'
  ].forEach(function(id) { var e = document.getElementById(id); if (e) e.value = ''; });
  var taux = document.getElementById('veh-acq-taux-tva');
  if (taux) taux.value = '20';
}

// L2668 (script.js d'origine)
function resetModalVehiculeToCreateMode() {
  var modal = document.getElementById('modal-vehicule');
  if (!modal) return;
  var title = modal.querySelector('.modal-header h3');
  var primary = modal.querySelector('.modal-footer .btn-primary');
  if (title) title.textContent = '🚐 Nouveau Véhicule';
  if (primary) {
    primary.textContent = 'Enregistrer';
    primary.setAttribute('onclick', 'ajouterVehicule()');
  }
  // Reset carte grise temp + UI (sinon un fichier sélectionné mais non
  // sauvegardé peut s'attacher à la prochaine création par erreur)
  if (typeof resetCarteGriseFormUI === 'function') resetCarteGriseFormUI();
}

// L2683 (script.js d'origine)
function mettreAJourFinContratVehicule() {
  var debut = document.getElementById('veh-date-acquisition')?.value || '';
  var duree = parseInt(document.getElementById('veh-duree-contrat-mois')?.value || '0', 10);
  var fin = document.getElementById('veh-date-fin-contrat');
  if (!fin) return;
  if (!debut || !duree) {
    fin.value = '';
    return;
  }
  var d = new Date(debut + 'T00:00:00');
  d.setMonth(d.getMonth() + duree);
  fin.value = dateToLocalISO(d);
}

// L2697 (script.js d'origine)
function mettreAJourInfosVehiculeFinancement() {
  var mode = document.getElementById('veh-mode-acquisition')?.value || 'achat';
  var amortInfo = document.getElementById('veh-amortissement-info');
  var creditInfo = document.getElementById('veh-credit-info');
  var locationInfo = document.getElementById('veh-location-info');
  var prixHt = parseFloat(document.getElementById('veh-acq-prix-ht')?.value) || 0;
  var dureeAmort = parseFloat(document.getElementById('veh-duree-amortissement')?.value) || 0;
  var mensualite = parseFloat(document.getElementById('veh-credit-mensualite-ht')?.value) || 0;
  var dureeCredit = parseFloat(document.getElementById('veh-credit-duree-mois')?.value) || 0;
  var apportCredit = parseFloat(document.getElementById('veh-credit-apport-ht')?.value) || 0;
  var coutCredit = Math.max(0, (mensualite * dureeCredit) + apportCredit - prixHt);
  var coutCreditInput = document.getElementById('veh-credit-cout-total-ht');
  if (coutCreditInput) coutCreditInput.value = coutCredit ? coutCredit.toFixed(2) : '';
  if (amortInfo) {
    amortInfo.textContent = (prixHt > 0 && dureeAmort > 0)
      ? ('Amortissement mensuel estimé : ' + euros(prixHt / (dureeAmort * 12)))
      : '';
  }
  if (creditInfo) {
    creditInfo.textContent = (mensualite > 0 && dureeCredit > 0)
      ? ('Coût total estimé du crédit : ' + euros(coutCredit))
      : '';
  }
  if (locationInfo) {
    var loyer = parseFloat(document.getElementById('veh-loyer-mensuel-ht')?.value) || 0;
    var dureeContrat = parseFloat(document.getElementById('veh-duree-contrat-mois')?.value) || 0;
    locationInfo.textContent = (loyer > 0 && dureeContrat > 0)
      ? ('Engagement estimé sur le contrat : ' + euros(loyer * dureeContrat))
      : '';
  }
}

// L2729 (script.js d'origine)
function mettreAJourFormulaireVehicule() {
  var mode = document.getElementById('veh-mode-acquisition')?.value || 'achat';
  var isAchat = ['achat', 'occasion'].includes(mode);
  // 'lld' couvre maintenant LCD/LMD/LLD (libellé groupé), 'location' = location simple
  var isLocation = ['lld', 'location'].includes(mode);
  var setDisplay = function(id, visible) {
    var el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  };
  setDisplay('veh-bloc-achat', isAchat);
  setDisplay('veh-bloc-location', isLocation);
  // Crédit/LOA supprimés : on cache leurs blocs si encore présents
  setDisplay('veh-bloc-credit', false);
  setDisplay('veh-bloc-loa', false);
  setDisplay('veh-prix-catalogue-wrap', false);
  setDisplay('veh-apport-wrap', false);
  // Achat comptant ET Achat occasion ont les mêmes champs (km rachat + année véhicule)
  setDisplay('veh-occasion-km-wrap', isAchat);
  setDisplay('veh-occasion-annee-wrap', isAchat);
  mettreAJourFinContratVehicule();
  mettreAJourInfosVehiculeFinancement();
}

// L2764 (script.js d'origine)
async function ajouterVehicule() {
  const immat  = document.getElementById('veh-immat').value.trim().toUpperCase();
  const modele = document.getElementById('veh-modele').value.trim();
  const km     = parseFloat(document.getElementById('veh-km').value) || 0;
  const conso  = parseFloat(document.getElementById('veh-conso').value) || 0;
  const capaciteReservoir = parseFloat(document.getElementById('veh-capacite-reservoir')?.value) || 0;
  const salId  = document.getElementById('veh-salarie')?.value || '';
  const dateCT = document.getElementById('veh-date-ct')?.value || '';
  const dateCTDernier = document.getElementById('veh-date-ct-dernier')?.value || '';
  const modeAcquisition = document.getElementById('veh-mode-acquisition')?.value || 'achat';
  const dateAcquisition = document.getElementById('veh-date-acquisition')?.value || '';
  const entretienIntervalKm = parseFloat(document.getElementById('veh-entretien-interval-km')?.value) || 0;
  const entretienIntervalMois = parseFloat(document.getElementById('veh-entretien-interval-mois')?.value) || 0;
  const finance = lireFinanceVehiculeDepuisForm();

  if (!immat) { afficherToast('⚠️ Immatriculation obligatoire', 'error'); return; }
  if (charger('vehicules').some(v => (v.immat || '').trim().toUpperCase() === immat)) {
    afficherToast('⚠️ Cette immatriculation existe déjà', 'error');
    return;
  }
  if (salId && charger('vehicules').find(v => v.salId === salId)) {
    afficherToast('⚠️ Ce salarié a déjà un véhicule', 'error'); return;
  }

  const sal = charger('salaries').find(s => s.id === salId);
  // BUG-046 fix : champs flotte étendus (genre, Crit'Air, PTAC, VIN, taxe essieu)
  const getV = (id) => (document.getElementById(id)?.value || '').trim();
  const genre = getV('veh-genre');
  const carburant = getV('veh-carburant');
  // TVA carburant selon genre (CGI art. 298-4-1° et 298-4 D)
  const tvaAutoCalc = calculerTauxTVACarburant(genre, carburant);
  const tvaCarbSaisi = parseFloat(document.getElementById('veh-tva-carburant')?.value);
  const tvaCarbDeductible = Number.isFinite(tvaCarbSaisi) ? tvaCarbSaisi : (tvaAutoCalc != null ? tvaAutoCalc : 100);
  const ptac = parseInt(getV('veh-ptac'), 10) || 0;
  const ptra = parseInt(getV('veh-ptra'), 10) || 0;
  const essieux = parseInt(getV('veh-essieux'), 10) || 0;
  const critAir = getV('veh-critair');
  const date1Immat = getV('veh-date-1immat');
  const vin = getV('veh-vin').toUpperCase();
  const carteGrise = getV('veh-carte-grise');
  const assurance = {
    compagnie: getV('veh-assurance-compagnie'),
    numeroContrat: getV('veh-assurance-numero'),
    dateExpiration: getV('veh-assurance-date-exp')
  };
  const vehicule = Object.assign({
    id: genId(), immat, modele, km, kmInitial: km, conso, capaciteReservoir, dateCT, dateCTDernier, tvaCarbDeductible,
    modeAcquisition, dateAcquisition, entretienIntervalKm, entretienIntervalMois,
    genre, carburant, ptac, ptra, essieux, critAir, date1Immat, vin, carteGrise, assurance,
    salId: salId||null, salNom: sal ? sal.nom : null,
    creeLe: new Date().toISOString()
  }, finance);
  // Carte grise : upload vers Supabase Storage si dispo, sinon fallback base64 local
  if (window.__vehCGTemp && (window.__vehCGTemp.data || window.__vehCGTemp._file)) {
    let uploaded = false;
    if (window.DelivProStorage && window.__vehCGTemp._file) {
      const cleanName = window.DelivProStorage.sanitizeFilename(window.__vehCGTemp.nom);
      const path = `${vehicule.id}/${Date.now()}_${cleanName}`;
      const up = await window.DelivProStorage.uploadBlob('vehicules-cartes-grises', path, window.__vehCGTemp._file, { contentType: window.__vehCGTemp.type });
      if (up.ok) {
        vehicule.carteGriseStoragePath = path;
        vehicule.carteGriseFichierType = window.__vehCGTemp.type;
        vehicule.carteGriseFichierNom = window.__vehCGTemp.nom;
        uploaded = true;
      } else {
        console.warn('[ajouterVehicule] upload Storage echoue, fallback base64:', up.error?.message);
      }
    }
    if (!uploaded && window.__vehCGTemp.data) {
      vehicule.carteGriseFichier = window.__vehCGTemp.data;
      vehicule.carteGriseFichierType = window.__vehCGTemp.type;
      vehicule.carteGriseFichierNom = window.__vehCGTemp.nom;
    }
    window.__vehCGTemp = null;
  }
  const vehicules = charger('vehicules');
  vehicules.push(vehicule);
  if (!sauvegarder('vehicules', vehicules)) {
    afficherToast('⚠️ Impossible d’enregistrer le véhicule', 'error');
    return;
  }

  closeModal('modal-vehicule');
  ['veh-immat','veh-modele','veh-km','veh-conso','veh-capacite-reservoir','veh-entretien-interval-km','veh-entretien-interval-mois',
   'veh-assurance-compagnie','veh-assurance-numero','veh-assurance-date-exp'].forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  reinitialiserFinanceVehiculeForm();
  if (document.getElementById('veh-mode-acquisition')) document.getElementById('veh-mode-acquisition').value = 'achat';
  if (document.getElementById('veh-mode-amortissement')) document.getElementById('veh-mode-amortissement').value = 'lineaire';
  if (document.getElementById('veh-date-acquisition')) document.getElementById('veh-date-acquisition').value = '';
  if (document.getElementById('veh-date-ct')) document.getElementById('veh-date-ct').value = '';
  if (document.getElementById('veh-date-ct-dernier')) document.getElementById('veh-date-ct-dernier').value = '';
  if (typeof resetCarteGriseFormUI === 'function') resetCarteGriseFormUI();
  if (document.getElementById('veh-salarie')) document.getElementById('veh-salarie').value = '';
  if (document.getElementById('veh-tva-carburant')) document.getElementById('veh-tva-carburant').value = '80';
  mettreAJourFormulaireVehicule();
  mettreAJourSelects();
  afficherVehicules();
  afficherChauffeurs();
  afficherTva();
  afficherEntretiens();
  afficherToast('✅ Véhicule ajouté !');
}

// L2866 (script.js d'origine)
function afficherVehicules() {
  let vehicules  = charger('vehicules');
  const entretiens = charger('entretiens');
  const salaries   = charger('salaries');
  const tb = document.getElementById('tb-vehicules');
  if (!tb) return;
  paginer.__reload_tb_vehicules = afficherVehicules;

  // Filtres
  const filtreVehSal = document.getElementById('filtre-veh-salarie')?.value || '';
  const filtreVehSearch = (document.getElementById('filtre-veh-search')?.value || '').trim().toLowerCase();
  const filtreVehCarb = (document.getElementById('filtre-veh-carburant')?.value || '').toLowerCase();
  const selFiltreVeh = document.getElementById('filtre-veh-salarie');
  if (selFiltreVeh) {
    const currentValue = selFiltreVeh.value;
    selFiltreVeh.innerHTML = '<option value="">Tous les véhicules</option>';
    vehicules.forEach(v => { selFiltreVeh.innerHTML += `<option value="${v.id}">${v.immat} — ${v.modele||''}</option>`; });
    selFiltreVeh.value = currentValue;
  }
  if (filtreVehSal) vehicules = vehicules.filter(v => v.id === filtreVehSal);
  if (filtreVehCarb) {
    vehicules = vehicules.filter(v => {
      const c = (v.typeCarburant || v.carburant || '').toLowerCase();
      // Match partiel pour gérer les libellés composés ('diesel/gazole', etc.)
      if (filtreVehCarb === 'diesel') return c.includes('diesel') || c.includes('gazole');
      if (filtreVehCarb === 'gnv') return c.includes('gnv') || c.includes('biognv');
      if (filtreVehCarb === 'electrique') return c.includes('electrique') || c.includes('électrique');
      if (filtreVehCarb === 'hybride') return c.includes('hybride');
      if (filtreVehCarb === 'hydrogene') return c.includes('hydrogene') || c.includes('hydrogène');
      if (filtreVehCarb === 'essence') return c.includes('essence');
      return c === filtreVehCarb;
    });
  }
  if (filtreVehSearch) {
    vehicules = vehicules.filter(function(v) {
      return [
        v.immat,
        v.modele,
        v.salNom,
        v.modeAcquisition,
        v.dateCT,
        v.carburant,
        v.typeCarburant
      ].filter(Boolean).join(' ').toLowerCase().includes(filtreVehSearch);
    });
  }

  const sv = document.getElementById('veh-salarie');
  if (sv) {
    const v = sv.value; sv.innerHTML = '<option value="">-- Aucun --</option>';
    const allVeh = charger('vehicules');
    salaries.forEach(s => { if (!allVeh.find(ve => ve.salId === s.id)) sv.innerHTML += `<option value="${s.id}">${s.nom} (${s.numero})</option>`; });
    sv.value = v;
  }

  // Vérifier alertes CT (dans les 30 jours)
  const auj = new Date(); const dans30j = new Date(); dans30j.setDate(auj.getDate()+30);
  vehicules.forEach(v => {
    const pilotageEntretien = getPilotageEntretienVehicule(v);
    if (v.dateCT) {
      const dateCT = new Date(v.dateCT);
      if (dateCT < auj) ajouterAlerteSiAbsente('ct_expire', `⚠️ Contrôle technique expiré — ${v.immat}`, { vehId: v.id });
      else if (dateCT < dans30j) ajouterAlerteSiAbsente('ct_proche', `🔔 CT à renouveler dans moins de 30 jours — ${v.immat}`, { vehId: v.id });
    }
    // Carte verte / assurance (art. L211-1 Code des assurances — circulation interdite sans assurance)
    const assurance = v.assurance || {};
    if (assurance.dateExpiration) {
      const dateAssu = new Date(assurance.dateExpiration);
      if (dateAssu < auj) ajouterAlerteSiAbsente('assu_veh_expire_' + v.id, `⚠️ Carte verte expirée — ${v.immat} (circulation interdite L211-1 C. assur.)`, { vehId: v.id });
      else if (dateAssu < dans30j) ajouterAlerteSiAbsente('assu_veh_proche_' + v.id, `🛡️ Carte verte expire dans moins de 30 jours — ${v.immat}`, { vehId: v.id });
    }
    if (pilotageEntretien.estEnRetard && pilotageEntretien.prochainKm) {
      ajouterAlerteSiAbsente('vidange', `🔧 Entretien à effectuer — ${v.immat} (${formatKm(pilotageEntretien.kmActuel)} / objectif ${formatKm(pilotageEntretien.prochainKm)})`, { vehId: v.id });
    } else if (pilotageEntretien.estProche && pilotageEntretien.prochainKm) {
      ajouterAlerteSiAbsente('vidange', `🔔 Entretien proche — ${v.immat} (${formatKm(pilotageEntretien.kmActuel)} / objectif ${formatKm(pilotageEntretien.prochainKm)})`, { vehId: v.id });
    }
  });
  afficherBadgeAlertes();

  if (!vehicules.length) {
    nettoyerPagination('tb-vehicules');
    tb.innerHTML = emptyState('🚐','Aucun véhicule','Ajoutez votre premier véhicule pour commencer le suivi de flotte.');
    return;
  }
  paginer(vehicules, 'tb-vehicules', function(items) {
    return items.map(v => {
    const ent = entretiens.filter(e => e.vehId === v.id).sort((a,b) => new Date(b.date)-new Date(a.date))[0];
    const sal = v.salId ? salaries.find(s => s.id === v.salId) : null;
    const kmActuel = calculerKilometrageVehiculeActuel(v);
    const pilotageEntretien = getPilotageEntretienVehicule(v);

    // Conso réelle : calcul entre pleins consécutifs (méthode correcte)
    const pleinsVeh = charger('carburant').filter(p=>p.vehId===v.id && p.km)
      .sort((a,b)=>new Date(a.date)-new Date(b.date));
    let consoReelle = null;
    if (pleinsVeh.length >= 2) {
      // Calculer sur tous les intervalles entre pleins consécutifs
      let totalLitres = 0, totalKm = 0, nbIntervalles = 0;
      for (let i = 1; i < pleinsVeh.length; i++) {
        const kmInterval = (pleinsVeh[i].km||0) - (pleinsVeh[i-1].km||0);
        const litresPlein = pleinsVeh[i].litres || 0;
        if (kmInterval > 0 && litresPlein > 0) {
          totalLitres += litresPlein;
          totalKm     += kmInterval;
          nbIntervalles++;
        }
      }
      if (totalKm > 0 && nbIntervalles > 0) {
        consoReelle = (totalLitres / totalKm * 100).toFixed(1);
      }
    }

    // Alerte CT
    let ctLabel = v.dateCT ? v.dateCT : '—';
    let ctStyle = '';
    if (v.dateCT) {
      const dct = new Date(v.dateCT);
      if (dct < auj) ctStyle = 'color:#e74c3c;font-weight:600';
      else if (dct < dans30j) ctStyle = 'color:var(--accent);font-weight:600';
    }
    const amort = calculerAmortissementVehicule(v);
    const acquisitionInfos = [
      v.modeAcquisition ? `<div style="font-weight:600">${(v.modeAcquisition||'').toUpperCase()}</div>` : '',
      v.dateAcquisition ? `<div style="font-size:.76rem;color:var(--text-muted)">Depuis le ${formatDateExport(v.dateAcquisition)}</div>` : '',
      (v.modeAcquisition === 'credit' && v.creditDureeMois) ? `<div style="font-size:.76rem;color:var(--text-muted)">Crédit ${v.creditDureeMois} mois</div>` : '',
      (['lld','loa','location'].includes(v.modeAcquisition) && v.dureeContratMois) ? `<div style="font-size:.76rem;color:var(--text-muted)">Contrat ${v.dureeContratMois} mois</div>` : '',
      (['achat','occasion'].includes(v.modeAcquisition) && v.dureeAmortissement) ? `<div style="font-size:.76rem;color:var(--text-muted)">Amort. ${v.dureeAmortissement} an(s)</div>` : '',
      (v.entretienIntervalKm || v.entretienIntervalMois) ? `<div style="font-size:.76rem;color:var(--text-muted)">Révision ${v.entretienIntervalKm ? 'tous les ' + formatKm(v.entretienIntervalKm) : ''}${v.entretienIntervalKm && v.entretienIntervalMois ? ' / ' : ''}${v.entretienIntervalMois ? 'tous les ' + v.entretienIntervalMois + ' mois' : ''}</div>` : ''
    ].filter(Boolean).join('');
    const financeInfos = [
      (['achat','occasion','credit'].includes(v.modeAcquisition) && v.prixAchatHT) ? `<div><strong>${euros(v.prixAchatHT)}</strong> HT</div>` : '',
      (['achat','occasion','credit'].includes(v.modeAcquisition) && v.prixAchatTTC) ? `<div style="font-size:.76rem;color:var(--text-muted)">${euros((v.prixAchatTTC||0) - (v.prixAchatHT||0))} TVA • ${euros(v.prixAchatTTC)} TTC</div>` : '',
      (['achat','occasion'].includes(v.modeAcquisition) && v.dureeAmortissement && amort.annuel) ? `<div style="font-size:.76rem;color:var(--accent)">Amort. ${euros(amort.annuel)}/an • ${amort.mode === 'degressif' ? 'dégressif' : 'linéaire'}</div>` : '',
      (['lld','loa','location'].includes(v.modeAcquisition) && v.loyerMensuelHT) ? `<div style="font-size:.76rem;color:var(--accent)">Loyer mensuel : ${euros(v.loyerMensuelHT)}</div>` : '',
      (v.modeAcquisition === 'credit' && v.creditMensualiteHT) ? `<div style="font-size:.76rem;color:var(--accent)">Mensualité : ${euros(v.creditMensualiteHT)}</div>` : '',
      (v.modeAcquisition === 'loa' && v.loaOptionAchatHT) ? `<div style="font-size:.76rem;color:var(--text-muted)">Option achat : ${euros(v.loaOptionAchatHT)}</div>` : '',
      (['lld','loa','location'].includes(v.modeAcquisition) && v.dateFinContrat) ? `<div style="font-size:.76rem;color:var(--text-muted)">Fin contrat : ${formatDateExport(v.dateFinContrat)}</div>` : '',
      amort.prorataPremierExercice ? `<div style="font-size:.76rem;color:var(--text-muted)">Prorata fiscal 1er exercice : ${(amort.prorataPremierExercice * 100).toFixed(1)} %</div>` : '',
      v.dateMiseAuRebut ? `<div style="font-size:.76rem;color:var(--text-muted)">Mise au rebut : ${formatDateExport(v.dateMiseAuRebut)}</div>` : '',
      `<div style="font-size:.76rem;color:var(--text-muted)">TVA carburant ${formaterTaux(v.tvaCarbDeductible || 0)}</div>`
    ].filter(Boolean).join('');
    const entretienInfos = [
      ent ? formatDateExport(ent.date) : '—',
      pilotageEntretien.prochainKm ? `<div style="font-size:.75rem;color:${pilotageEntretien.estEnRetard ? 'var(--red)' : pilotageEntretien.estProche ? 'var(--accent)' : 'var(--text-muted)'}">Prochain km : ${formatKm(pilotageEntretien.prochainKm)}</div>` : '',
      pilotageEntretien.dateEcheance ? `<div style="font-size:.75rem;color:var(--text-muted)">Échéance : ${formatDateExport(pilotageEntretien.dateEcheance)}</div>` : ''
    ].filter(Boolean).join('');

    // Type de carburant pour la nouvelle colonne dédiée
    const carburantLabels = {
      'diesel': '⛽ Diesel/Gazole', 'gazole': '⛽ Diesel/Gazole',
      'essence': '⛽ Essence',
      'gnv': '🌿 GNV/BioGNV', 'biognv': '🌿 GNV/BioGNV',
      'electrique': '⚡ Électrique',
      'hybride': '🔋 Hybride',
      'hydrogene': '💧 Hydrogène'
    };
    const carbKey = (v.typeCarburant || v.carburant || '').toLowerCase();
    // Match partiel pour les libellés composés ('diesel/gazole', etc.)
    let carbAffiche = '—';
    if (carbKey) {
      if (carburantLabels[carbKey]) carbAffiche = carburantLabels[carbKey];
      else if (carbKey.includes('diesel') || carbKey.includes('gazole')) carbAffiche = carburantLabels.diesel;
      else if (carbKey.includes('essence')) carbAffiche = carburantLabels.essence;
      else if (carbKey.includes('gnv')) carbAffiche = carburantLabels.gnv;
      else if (carbKey.includes('electrique') || carbKey.includes('électrique')) carbAffiche = carburantLabels.electrique;
      else if (carbKey.includes('hybride')) carbAffiche = carburantLabels.hybride;
      else if (carbKey.includes('hydrogene') || carbKey.includes('hydrogène')) carbAffiche = carburantLabels.hydrogene;
      else carbAffiche = v.typeCarburant || v.carburant; // Garde la casse originale
    }
    // Visualiser carte grise : grisé si aucun fichier uploadé
    const aCarteGrise = !!(v.carteGriseFichier || v.carteGriseUrl);
    const visuCG = aCarteGrise
      ? { icon:'📄', label:'Visualiser carte grise', action:`visualiserCarteGrise('${v.id}')` }
      : { icon:'📄', label:'Visualiser carte grise', action:`afficherToast('Aucune carte grise uploadée pour ce véhicule','info')`, disabled:true };
    return `<tr>
      <td><strong>${v.immat}</strong></td>
      <td>${v.modele||'—'}</td>
      <td>${kmActuel ? formatKm(kmActuel) : '—'}</td>
      <td>${acquisitionInfos || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${v.conso ? v.conso+' L/100km' : '—'}${consoReelle
        ? ` <span style="color:var(--green);font-size:.75rem" title="Calculé entre ${pleinsVeh.length} pleins">(réel: ${consoReelle} L/100km)</span>`
        : pleinsVeh.length === 1
          ? ` <span style="color:var(--text-muted);font-size:.72rem">(1 plein — besoin de 2+)</span>`
          : ''
      }</td>
      <td style="${ctStyle}">
        ${v.dateCTDernier ? `<div style="font-size:.72rem;color:var(--text-muted);font-weight:400">Dernier : ${formatDateExport(v.dateCTDernier)}</div>` : ''}
        <div>${v.dateCT ? 'Prochain : ' + formatDateExport(ctLabel) : '—'}${v.dateCT && new Date(v.dateCT)<auj?' ⚠️':''}</div>
      </td>
      <td>${financeInfos || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${carbAffiche}</td>
      <td>${sal ? `<span style="color:var(--accent-2)">👤 ${getSalarieNomComplet(sal)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${entretienInfos || '—'}</td>
      <td>
        ${buildInlineActionsDropdown('Actions', [
          { icon:'✏️', label:'Modifier', action:`ouvrirEditVehicule('${v.id}')` },
          { icon:'👤', label:'Affecter un salarié', action:`ouvrirAffectationVehicule('${v.id}')` },
          visuCG,
          { icon:'💰', label:'Voir le TCO', action:`ouvrirTCO('${v.id}')` },
          { icon:'🚐', label:'Historique conducteurs', action:`ouvrirHistoriqueConducteurs('${v.id}')` },
          { icon:'🗑️', label:'Supprimer', action:`supprimerVehicule('${v.id}')`, danger:true }
        ])}
      </td>
    </tr>`;
  }).join('');
  }, 10);
}

// L3078 (script.js d'origine)
function ouvrirAffectationVehicule(vehId) {
  affectVehId = vehId;
  const vehicules = charger('vehicules'), salaries = charger('salaries');
  const veh = vehicules.find(v => v.id === vehId);
  document.getElementById('affect-veh-label').textContent = veh ? `${veh.immat} — ${veh.modele}` : '';
  const sel = document.getElementById('affect-salarie-sel');
  sel.innerHTML = '<option value="">-- Retirer l\'affectation --</option>';
  salaries.forEach(s => {
    const pris = vehicules.find(v => v.salId === s.id && v.id !== vehId);
    if (!pris) sel.innerHTML += `<option value="${s.id}" ${veh?.salId===s.id?'selected':''}>${getSalarieNomComplet(s, { includeNumero: true })}</option>`;
  });
  document.getElementById('modal-affecter-vehicule').classList.add('open');
}

// L3092 (script.js d'origine)
function confirmerAffectationVehicule() {
  const salId = document.getElementById('affect-salarie-sel').value;
  const vehicules = charger('vehicules');
  const idx = vehicules.findIndex(v => v.id === affectVehId);
  if (idx > -1) {
    // Retirer l'ancienne affectation
    vehicules[idx].salId = salId || null;
    vehicules[idx].salNom = null;
    if (salId) {
      const sal = charger('salaries').find(s => s.id === salId);
      if (sal) vehicules[idx].salNom = sal.nom;
    }
    sauvegarder('vehicules', vehicules);
  }
  closeModal('modal-affecter-vehicule');
  affectVehId = null;
  afficherVehicules(); afficherChauffeurs();
  afficherToast(salId ? '✅ Véhicule affecté !' : '✅ Affectation retirée');
}

// L3112 (script.js d'origine)
async function supprimerVehicule(id) {
  const veh = charger('vehicules').find(v => v.id === id);
  const _ok2 = await confirmDialog(`Supprimer ${veh?.immat || 'ce véhicule'} ?`, {titre:'Supprimer le véhicule',icone:'🚐',btnLabel:'Supprimer'});
  if (!_ok2) return;
  // Supprimer le véhicule
  sauvegarder('vehicules', charger('vehicules').filter(v => v.id !== id));
  // Anonymiser les livraisons liées (garder l'historique)
  const livraisons = charger('livraisons');
  livraisons.forEach(l => { if (l.vehId === id) { l.vehId = null; l.vehNom = (veh?.immat||'Véhicule supprimé') + ' (archivé)'; } });
  sauvegarder('livraisons', livraisons);
  afficherVehicules(); afficherChauffeurs();
  afficherToast('🗑️ Véhicule supprimé');
}

// L4926 (script.js d'origine)
async function uploaderCarteGriseVehicule(vehId, input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const okType = /^application\/pdf$|^image\//i.test(file.type);
  if (!okType) { afficherToast('Format non supporté (PDF ou image attendu)', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { afficherToast('Fichier trop lourd (5 Mo max)', 'error'); return; }

  if (window.DelivProStorage) {
    const cleanName = window.DelivProStorage.sanitizeFilename(file.name);
    const path = `${vehId}/${Date.now()}_${cleanName}`;
    const up = await window.DelivProStorage.uploadBlob('vehicules-cartes-grises', path, file, { contentType: file.type });
    if (up.ok) {
      const vehicules = charger('vehicules');
      const idx = vehicules.findIndex(v => v.id === vehId);
      if (idx > -1) {
        const previous = vehicules[idx].carteGriseStoragePath;
        vehicules[idx].carteGriseStoragePath = path;
        vehicules[idx].carteGriseFichierType = file.type;
        vehicules[idx].carteGriseFichierNom = file.name;
        delete vehicules[idx].carteGriseFichier; // strip legacy base64
        sauvegarder('vehicules', vehicules);
        if (previous && previous !== path) {
          window.DelivProStorage.remove('vehicules-cartes-grises', previous).catch(function () {});
        }
        afficherVehicules();
        afficherToast('✅ Carte grise enregistrée');
      }
      return;
    }
    console.warn('[carteGrise] upload Storage echoue, fallback base64:', up.error?.message);
  }

  // Fallback : Storage indisponible -> base64 local (compat offline)
  const reader = new FileReader();
  reader.onload = e => {
    const vehicules = charger('vehicules');
    const idx = vehicules.findIndex(v => v.id === vehId);
    if (idx > -1) {
      vehicules[idx].carteGriseFichier = e.target.result;
      vehicules[idx].carteGriseFichierType = file.type;
      vehicules[idx].carteGriseFichierNom = file.name;
      sauvegarder('vehicules', vehicules);
      afficherVehicules();
      afficherToast('✅ Carte grise enregistrée (mode local)');
    }
  };
  reader.readAsDataURL(file);
}

// L4978 (script.js d'origine)
async function uploaderCarteGriseFromForm(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const okType = /^application\/pdf$|^image\//i.test(file.type);
  if (!okType) { afficherToast('Format non supporté (PDF ou image attendu)', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { afficherToast('Fichier trop lourd (5 Mo max)', 'error'); return; }

  const btnLabel = document.getElementById('veh-carte-grise-button-label');
  const wrapper = document.querySelector('.file-upload-button[for="veh-carte-grise-fichier"]');
  const status = document.getElementById('veh-carte-grise-status');
  const inputEl = document.getElementById('veh-carte-grise-fichier');

  if (window._editVehId && window.DelivProStorage) {
    // Mode édition : upload immediat vers Storage avec UX feedback clair
    if (btnLabel) btnLabel.textContent = '⏳ Envoi en cours… (' + Math.round(file.size / 1024) + ' Ko)';
    if (inputEl) inputEl.disabled = true;
    if (status) status.textContent = 'Envoi du fichier vers le cloud, ne fermez pas la fenêtre...';
    afficherToast('⏳ Envoi de la carte grise…', 'info');

    const t0 = Date.now();
    const cleanName = window.DelivProStorage.sanitizeFilename(file.name);
    const path = `${window._editVehId}/${Date.now()}_${cleanName}`;
    const up = await window.DelivProStorage.uploadBlob('vehicules-cartes-grises', path, file, { contentType: file.type });
    const elapsed = Math.round((Date.now() - t0) / 1000);

    if (inputEl) inputEl.disabled = false;

    if (up.ok) {
      const vehicules = charger('vehicules');
      const idx = vehicules.findIndex(v => v.id === window._editVehId);
      if (idx > -1) {
        const previous = vehicules[idx].carteGriseStoragePath;
        vehicules[idx].carteGriseStoragePath = path;
        vehicules[idx].carteGriseFichierType = file.type;
        vehicules[idx].carteGriseFichierNom = file.name;
        delete vehicules[idx].carteGriseFichier;
        sauvegarder('vehicules', vehicules);
        if (previous && previous !== path) {
          window.DelivProStorage.remove('vehicules-cartes-grises', previous).catch(function () {});
        }
      }
      if (btnLabel) btnLabel.textContent = '✅ ' + file.name;
      if (wrapper) wrapper.classList.add('has-file');
      if (status) status.innerHTML = '<button type="button" class="btn-link-inline" style="font-size:.78rem;color:var(--accent)" onclick="visualiserCarteGrise(window._editVehId)">👁️ Visualiser</button>';
      afficherToast(`✅ Carte grise enregistrée (${elapsed}s)`);
      return;
    }
    if (btnLabel) btnLabel.textContent = '❌ Échec';
    if (status) status.textContent = up.error?.message || 'Erreur upload';
    afficherToast('⚠️ Upload échoué : ' + (up.error?.message || 'erreur'), 'error');
    return;
  }

  // Mode création : stocke le file en memoire (sera uploade dans ajouterVehicule)
  // En mode édition sans Storage : fallback dataUrl
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    if (window._editVehId) {
      const vehicules = charger('vehicules');
      const idx = vehicules.findIndex(v => v.id === window._editVehId);
      if (idx > -1) {
        vehicules[idx].carteGriseFichier = dataUrl;
        vehicules[idx].carteGriseFichierType = file.type;
        vehicules[idx].carteGriseFichierNom = file.name;
        sauvegarder('vehicules', vehicules);
        afficherToast('✅ Carte grise enregistrée (mode local)');
      }
    } else {
      window.__vehCGTemp = { data: dataUrl, type: file.type, nom: file.name, _file: file };
    }
    if (btnLabel) btnLabel.textContent = '✅ ' + file.name;
    if (wrapper) wrapper.classList.add('has-file');
    if (status) status.textContent = 'Fichier prêt : ' + file.name;
  };
  reader.readAsDataURL(file);
}

// L5058 (script.js d'origine)
function resetCarteGriseFormUI() {
  const btnLabel = document.getElementById('veh-carte-grise-button-label');
  const wrapper = document.querySelector('.file-upload-button[for="veh-carte-grise-fichier"]');
  const status = document.getElementById('veh-carte-grise-status');
  const input = document.getElementById('veh-carte-grise-fichier');
  if (btnLabel) btnLabel.textContent = '📎 Choisir un fichier';
  if (wrapper) wrapper.classList.remove('has-file');
  if (status) status.textContent = '';
  if (input) input.value = '';
  window.__vehCGTemp = null;
}

// L5071 (script.js d'origine)
function prefillCarteGriseFormUI(veh) {
  const hasFile = !!(veh && (veh.carteGriseStoragePath || veh.carteGriseFichier));
  if (!hasFile) { resetCarteGriseFormUI(); return; }
  const btnLabel = document.getElementById('veh-carte-grise-button-label');
  const wrapper = document.querySelector('.file-upload-button[for="veh-carte-grise-fichier"]');
  const status = document.getElementById('veh-carte-grise-status');
  if (btnLabel) btnLabel.textContent = '✅ ' + (veh.carteGriseFichierNom || 'Carte grise enregistrée') + ' (cliquez pour remplacer)';
  if (wrapper) wrapper.classList.add('has-file');
  if (status) status.innerHTML = '<button type="button" class="btn-link-inline" style="font-size:.78rem;color:var(--accent)" onclick="visualiserCarteGrise(window._editVehId)">👁️ Visualiser</button>';
}

// L5084 (script.js d'origine)
async function visualiserCarteGrise(vehId) {
  const veh = charger('vehicules').find(v => v.id === vehId);
  if (!veh || (!veh.carteGriseFichier && !veh.carteGriseStoragePath)) {
    afficherToast('Aucune carte grise uploadée pour ce véhicule', 'info');
    return;
  }

  const isPdf = (veh.carteGriseFichierType || '').includes('pdf');
  const titre = 'Carte grise — ' + (veh.immat || '');

  // Cas legacy base64
  if (veh.carteGriseFichier && veh.carteGriseFichier.indexOf('data:') === 0) {
    afficherDocumentDansFenetre(veh.carteGriseFichier, isPdf, titre);
    return;
  }

  // Cas Storage : download le blob, cree un objectURL local (plus fiable
  // que <embed src="signed_url"> qui foire parfois sur les PDFs prives)
  if (!veh.carteGriseStoragePath || !window.DelivProStorage) {
    afficherToast('Carte grise indisponible', 'info');
    return;
  }

  afficherToast('⏳ Chargement du document...', 'info');
  const dl = await window.DelivProStorage.download('vehicules-cartes-grises', veh.carteGriseStoragePath);
  if (!dl.ok) {
    afficherToast('⚠️ Lien indisponible : ' + (dl.error?.message || 'erreur'), 'error');
    return;
  }
  const objectUrl = URL.createObjectURL(dl.blob);
  afficherDocumentDansFenetre(objectUrl, isPdf, titre);
  // Cleanup objectURL apres 5 min (le temps que la fenetre soit fermee)
  setTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 300000);
}

// L6715 (script.js d'origine)
function autoRemplirVehicule() {
  const chaufId = document.getElementById('liv-chauffeur').value;
  const selVeh  = document.getElementById('liv-vehicule');
  if (!chaufId || !selVeh) return;
  const veh = getVehiculeParSalId(chaufId);
  if (veh) {
    // S'assurer que l'option existe dans le select
    let found = false;
    for (let opt of selVeh.options) { if (opt.value === veh.id) { found = true; break; } }
    if (!found) {
      const opt = document.createElement('option');
      opt.value = veh.id;
      opt.textContent = `${veh.immat} — ${veh.modele}`;
      selVeh.appendChild(opt);
    }
    selVeh.value = veh.id;
  }
}

// L6736 (script.js d'origine)
function autoRemplirVehiculeEdit() {
  const selVeh = document.getElementById('edit-liv-vehicule');
  if (!selVeh) return;
  const affectation = synchroniserAffectationLivraison(
    document.getElementById('edit-liv-chauffeur')?.value || '',
    selVeh.value || ''
  );
  if (affectation.vehId) selVeh.value = affectation.vehId;
}

// L6761 (script.js d'origine)
async function ouvrirEditVehicule(vehId) {
  try {
    const veh = charger('vehicules').find(v=>v.id===vehId);
    if (!veh) {
      afficherToast('⚠️ Véhicule introuvable', 'error');
      return;
    }

    // On ne s'embete plus avec actualiserVerrousEditionDistance ici : le
    // verrou local suffit, et le pull realtime des adapters maintient deja
    // les donnees a jour. Eviter cette attente = ouverture modal instantanee.

    const lockResult = prendreVerrouEdition('vehicule', vehId, veh.immat || 'Véhicule');
    if (!lockResult.ok) {
      afficherToast(`⚠️ Véhicule en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
      return;
    }

    window._editVehId = vehId;
    const modal = document.getElementById('modal-vehicule');
    if (!modal) {
      afficherToast('⚠️ Modal véhicule introuvable', 'error');
      return;
    }

    if (typeof prefillCarteGriseFormUI === 'function') {
      try { prefillCarteGriseFormUI(veh); } catch (e) { console.warn('prefillCarteGriseFormUI:', e); }
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = (val != null ? val : '');
    };

    setVal('veh-immat',    veh.immat);
    setVal('veh-modele',   veh.modele);
    setVal('veh-km',       calculerKilometrageVehiculeActuel(veh));
    setVal('veh-conso',    veh.conso);
    setVal('veh-capacite-reservoir', veh.capaciteReservoir);
    setVal('veh-mode-acquisition',  veh.modeAcquisition || 'achat');
    setVal('veh-date-acquisition',  veh.dateAcquisition);
    setVal('veh-date-ct',  veh.dateCT);
    setVal('veh-date-ct-dernier',   veh.dateCTDernier);
    setVal('veh-entretien-interval-km',   veh.entretienIntervalKm);
    setVal('veh-entretien-interval-mois', veh.entretienIntervalMois);

    try { hydraterFinanceVehiculeDansForm(veh); } catch (e) { console.warn('hydraterFinance:', e); }

    setVal('veh-tva-carburant', veh.tvaCarbDeductible !== undefined ? veh.tvaCarbDeductible : 100);
    setVal('veh-salarie',  veh.salId);
    setVal('veh-genre',    veh.genre);
    setVal('veh-carburant',veh.carburant);
    setVal('veh-ptac',     veh.ptac);
    setVal('veh-ptra',     veh.ptra);
    setVal('veh-essieux',  veh.essieux);
    setVal('veh-critair',  veh.critAir);
    setVal('veh-date-1immat', veh.date1Immat);
    setVal('veh-vin',      veh.vin);
    setVal('veh-carte-grise', veh.carteGrise);

    const assu = veh.assurance || {};
    setVal('veh-assurance-compagnie', assu.compagnie);
    setVal('veh-assurance-numero',    assu.numeroContrat);
    setVal('veh-assurance-date-exp',  assu.dateExpiration);

    try { mettreAJourFormulaireVehicule(); } catch (e) { console.warn('mettreAJourFormulaireVehicule:', e); }

    const titleEl = modal.querySelector('h3');
    const btnPrimary = modal.querySelector('.modal-footer .btn-primary');
    if (titleEl) titleEl.textContent = '✏️ Modifier le véhicule';
    if (btnPrimary) {
      btnPrimary.textContent = '✅ Enregistrer';
      btnPrimary.setAttribute('onclick', 'confirmerEditVehicule()');
    }

    if (typeof openModal === 'function') openModal('modal-vehicule');
    else modal.classList.add('open');

    try { afficherAlerteVerrouModal('modal-vehicule', ''); } catch (_) {}
  } catch (err) {
    console.error('[ouvrirEditVehicule] erreur:', err);
    afficherToast('⚠️ Impossible d\'ouvrir la modification : ' + (err && err.message ? err.message : 'erreur inattendue'), 'error');
  }
}

// L6846 (script.js d'origine)
function confirmerEditVehicule() {
  surveillerConflitsEditionActifs();
  const id = window._editVehId;
  if (!id) return;
  const lockState = verifierVerrouEdition('vehicule', id);
  if (!lockState.ok) {
    afficherToast(`⚠️ Ce véhicule est verrouillé par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const vehicules = charger('vehicules');
  const idx = vehicules.findIndex(v=>v.id===id);
  if (idx === -1) return;
  vehicules[idx].immat    = document.getElementById('veh-immat').value.trim().toUpperCase();
  vehicules[idx].modele   = document.getElementById('veh-modele').value.trim();
  vehicules[idx].km       = parseFloat(document.getElementById('veh-km').value)||0;
  if (!Number.isFinite(parseFloat(vehicules[idx].kmInitial))) vehicules[idx].kmInitial = vehicules[idx].km;
  vehicules[idx].conso    = parseFloat(document.getElementById('veh-conso').value)||0;
  vehicules[idx].capaciteReservoir = parseFloat(document.getElementById('veh-capacite-reservoir')?.value)||0;
  vehicules[idx].modeAcquisition = document.getElementById('veh-mode-acquisition')?.value || 'achat';
  vehicules[idx].dateAcquisition = document.getElementById('veh-date-acquisition')?.value || '';
  vehicules[idx].dateCT   = document.getElementById('veh-date-ct').value||'';
  vehicules[idx].dateCTDernier = document.getElementById('veh-date-ct-dernier')?.value||'';
  vehicules[idx].entretienIntervalKm = parseFloat(document.getElementById('veh-entretien-interval-km')?.value)||0;
  vehicules[idx].entretienIntervalMois = parseFloat(document.getElementById('veh-entretien-interval-mois')?.value)||0;
  Object.assign(vehicules[idx], lireFinanceVehiculeDepuisForm());
  vehicules[idx].tvaCarbDeductible = parseFloat(document.getElementById('veh-tva-carburant')?.value) || 100;
  const salId = document.getElementById('veh-salarie')?.value||'';
  vehicules[idx].salId = salId||null;
  vehicules[idx].salNom = salId ? (charger('salaries').find(s=>s.id===salId)?.nom||null) : null;
  vehicules[idx].assurance = {
    compagnie: (document.getElementById('veh-assurance-compagnie')?.value || '').trim(),
    numeroContrat: (document.getElementById('veh-assurance-numero')?.value || '').trim(),
    dateExpiration: document.getElementById('veh-assurance-date-exp')?.value || ''
  };
  // Flotte étendue
  const getV2 = (id) => (document.getElementById(id)?.value || '').trim();
  vehicules[idx].genre = getV2('veh-genre');
  vehicules[idx].carburant = getV2('veh-carburant');
  vehicules[idx].ptac = parseInt(getV2('veh-ptac'), 10) || 0;
  vehicules[idx].ptra = parseInt(getV2('veh-ptra'), 10) || 0;
  vehicules[idx].essieux = parseInt(getV2('veh-essieux'), 10) || 0;
  vehicules[idx].critAir = getV2('veh-critair');
  vehicules[idx].date1Immat = getV2('veh-date-1immat');
  vehicules[idx].vin = getV2('veh-vin').toUpperCase();
  vehicules[idx].carteGrise = getV2('veh-carte-grise');
  sauvegarder('vehicules', vehicules);
  closeModal('modal-vehicule');
  const modal = document.getElementById('modal-vehicule');
  modal.querySelector('h3').textContent = '🚐 Nouveau Véhicule';
  modal.querySelector('.modal-footer .btn-primary').textContent = 'Enregistrer';
  modal.querySelector('.modal-footer .btn-primary').setAttribute('onclick', 'ajouterVehicule()');
  ['veh-entretien-interval-km','veh-entretien-interval-mois'].forEach(function(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.value = '';
  });
  reinitialiserFinanceVehiculeForm();
  if (document.getElementById('veh-mode-amortissement')) document.getElementById('veh-mode-amortissement').value = 'lineaire';
  if (document.getElementById('veh-mode-acquisition')) document.getElementById('veh-mode-acquisition').value = 'achat';
  mettreAJourFormulaireVehicule();
  window._editVehId = null;
  afficherVehicules();
  afficherTva();
  afficherEntretiens();
  afficherToast('✅ Véhicule mis à jour');
}

