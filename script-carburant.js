/**
 * MCA Logistics — Module Carburant
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L779 (script.js d'origine)
function getTauxDeductibiliteCarburant(plein) {
  const typeCarburant = plein?.typeCarburant || plein?.type || 'gasoil';
  const fallback = typeCarburant === 'essence' ? 100 : 80;
  return getTauxDeductibiliteVehicule(plein?.vehId, fallback);
}

// L819 (script.js d'origine)
function getCarburantMontantHT(plein) {
  var total = parseFloat(plein?.total) || 0;
  var taux = parseFloat(plein?.tauxTVA ?? 20) || 0;
  return taux > 0 ? total / (1 + taux / 100) : total;
}

// L825 (script.js d'origine)
function getCarburantMontantTVA(plein) {
  return calculerMontantTVAFromHT(getCarburantMontantHT(plein), parseFloat(plein?.tauxTVA ?? 20) || 0);
}

// L1350 (script.js d'origine)
function syncChargeCarburant(plein) {
  if (!plein) return '';
  const charges = charger('charges');
  const tauxTVA = parseFloat(plein.tauxTVA ?? 20) || 20;
  const total = parseFloat(plein.total) || 0;
  const chargePayload = {
    date: plein.date || aujourdhui(),
    categorie: 'carburant',
    description: 'Carburant — ' + (plein.vehNom || plein.vehiculeNom || 'Véhicule'),
    montant: total,
    montantHT: total / (1 + tauxTVA / 100),
    tauxTVA,
    vehId: plein.vehId || '',
    vehNom: plein.vehNom || '',
    creeLe: plein.creeLe || new Date().toISOString(),
    carburantId: plein.id
  };
  const idx = charges.findIndex(function(charge) {
    return charge.carburantId === plein.id;
  });
  if (idx > -1) {
    charges[idx] = { ...charges[idx], ...chargePayload };
    sauvegarder('charges', charges);
    return charges[idx].id;
  }
  const chargeId = genId();
  charges.push({ id: chargeId, ...chargePayload });
  sauvegarder('charges', charges);
  return chargeId;
}

// L1380 (script.js d'origine)
function removeChargeCarburant(carburantId) {
  if (!carburantId) return;
  sauvegarder('charges', charger('charges').filter(function(charge) {
    return charge.carburantId !== carburantId;
  }));
}

// L1386 (script.js d'origine)
function enrichirPleinCarburant(plein) {
  const tauxTVA = parseFloat(plein?.tauxTVA ?? 20) || 20;
  const total = parseFloat(plein?.total) || 0;
  const ht = total / (1 + tauxTVA / 100);
  const tva = total - ht;
  const tauxDeductible = getTauxDeductibiliteCarburant(plein);
  return {
    ...plein,
    totalHT: ht,
    tvaMontant: tva,
    tauxDeductible,
    tvaDeductible: tva * (tauxDeductible / 100)
  };
}

// L1421 (script.js d'origine)
function getMontantHTCarburant(plein) {
  if (plein?.totalHT !== undefined && plein?.totalHT !== null && plein?.totalHT !== '') {
    return parseFloat(plein.totalHT) || 0;
  }
  return (parseFloat(plein?.total) || 0) / 1.2;
}

// L3574 (script.js d'origine)
function calculerTauxTVACarburant(genre, carburant) {
  if (!genre || !carburant) return null;
  if (genre === 'REM' || genre === 'SREM') return 0;
  if (carburant === 'electrique' || carburant === 'h2') return 100;
  if (genre === 'VP') return 80;
  // VU, CTTE, CAM, TRR : tous carburants 100 %
  return 100;
}

// L3582 (script.js d'origine)
function ajusterTVACarburantSelonGenre() {
  const genre = document.getElementById('veh-genre')?.value || '';
  const carb = document.getElementById('veh-carburant')?.value || '';
  const taux = calculerTauxTVACarburant(genre, carb);
  if (taux == null) return;
  const input = document.getElementById('veh-tva-carburant');
  if (input && (!input.value || input.dataset.autoSet === '1')) {
    input.value = String(taux);
    input.dataset.autoSet = '1';
  }
}

// L3991 (script.js d'origine)
function ajouterCarburant() {
  const vehId     = document.getElementById('carb-vehicule').value;
  const litres    = parseFloat(document.getElementById('carb-litres').value);
  const prixLitre = parseFloat(document.getElementById('carb-prix-litre').value);
  const kmCompteur = parseFloat(document.getElementById('carb-km')?.value);
  const date      = document.getElementById('carb-date').value || aujourdhui();
  const typeCarb  = document.getElementById('carb-type')?.value || 'gasoil';
  const tauxTVA   = parseFloat(document.getElementById('carb-taux-tva')?.value) || 20;
  if (!vehId || isNaN(litres) || isNaN(prixLitre)) { afficherToast('⚠️ Tous les champs sont obligatoires', 'error'); return; }
  if (hasNegativeNumber(litres, prixLitre, kmCompteur, tauxTVA)) {
    afficherToast('⚠️ Les montants, litres et kilomètres doivent être positifs', 'error');
    return;
  }
  const veh   = charger('vehicules').find(v => v.id === vehId);
  const total = litres * prixLitre;
  let libelle = veh ? veh.immat : 'Inconnu';
  if (veh?.salNom) libelle = `${veh.immat} — ${veh.salNom}`;
  const pleins = charger('carburant');
  const plein = { id: genId(), vehId, vehNom: libelle, litres, prixLitre, total, date, typeCarburant: typeCarb, kmCompteur: Number.isFinite(kmCompteur) ? kmCompteur : null, tauxTVA: tauxTVA, source: 'admin', modifie: false, creeLe: new Date().toISOString() };
  plein.chargeId = syncChargeCarburant(plein);
  pleins.push(plein);
  sauvegarder('carburant', pleins);
  ajouterEntreeAudit('Création carburant', libelle + ' · ' + euros(total || 0));
  if (veh && Number.isFinite(kmCompteur) && kmCompteur > (parseFloat(veh.km) || 0)) {
    const vehicules = charger('vehicules');
    const idxVeh = vehicules.findIndex(function(item) { return item.id === vehId; });
    if (idxVeh > -1) {
      vehicules[idxVeh].km = Math.max(parseFloat(vehicules[idxVeh].km) || 0, kmCompteur);
      sauvegarder('vehicules', vehicules);
    }
  }
  closeModal('modal-carburant');
  ['carb-litres','carb-prix-litre','carb-km'].forEach(id => document.getElementById(id).value = '');
  if (document.getElementById('carb-taux-tva')) document.getElementById('carb-taux-tva').value = '20';
  afficherCarburant(); afficherToast('✅ Plein enregistré !');
}

// L4028 (script.js d'origine)
function afficherCarburant() {
  let pleins = charger('carburant');
  const tb = document.getElementById('tb-carburant');
  const range = getCarburantPeriodeRange();
  const periodSelect = document.getElementById('vue-carb-select');
  if (periodSelect) periodSelect.value = _carbPeriode.mode;
  majPeriodeDisplay('carb-mois-label', 'carb-mois-dates', range);

  // Filtres
  const filtreType = document.getElementById('filtre-carb-type')?.value || '';
  const filtreVeh  = document.getElementById('filtre-carb-vehicule')?.value || '';

  // Remplir le select véhicules du filtre
  const selVeh = document.getElementById('filtre-carb-vehicule');
  if (selVeh) {
    const currentValue = selVeh.value;
    selVeh.innerHTML = '<option value="">Tous les véhicules</option>';
    charger('vehicules').forEach(v => { selVeh.innerHTML += `<option value="${v.id}">${v.immat}</option>`; });
    selVeh.value = currentValue;
  }

  // Appliquer les filtres (avec support synonymes pour les libellés étendus)
  if (filtreType) {
    pleins = pleins.filter(p => {
      const c = (p.typeCarburant || 'diesel').toLowerCase();
      if (filtreType === 'diesel') return c === 'diesel' || c === 'gazole' || c === 'gasoil';
      if (filtreType === 'gnv') return c === 'gnv' || c === 'biognv';
      return c === filtreType;
    });
  }
  if (filtreVeh)  pleins = pleins.filter(p => p.vehId === filtreVeh);
  pleins = pleins.filter(p => isDateInRange(p.date, range));
  pleins = pleins.map(enrichirPleinCarburant);

  // KPIs (basés sur la période affichée)
  const pleinsMois = charger('carburant').filter(p => isDateInRange(p.date, range));
  const pleinsMoisEnrichis = pleinsMois.map(enrichirPleinCarburant);
  const tot = pleinsMoisEnrichis.reduce((s,p) => s+p.total,0), lts = pleinsMoisEnrichis.reduce((s,p) => s+p.litres,0);
  const totalHT = pleinsMoisEnrichis.reduce((s,p) => s + (p.totalHT||0), 0);
  const totalTVA = pleinsMoisEnrichis.reduce((s,p) => s + (p.tvaDeductible||0), 0);
  const prixMoyenHT = lts > 0 ? totalHT / lts : 0;
  const prixMoyenTTC = lts > 0 ? tot / lts : 0;
  document.getElementById('kpi-carb-mois').textContent   = euros(tot);
  const elCarbDetail = document.getElementById('kpi-carb-mois-detail');
  if (elCarbDetail) elCarbDetail.textContent = `HT ${euros(totalHT)} • TVA déductible ${euros(totalTVA)}`;
  document.getElementById('kpi-litres-mois').textContent = lts.toFixed(1)+' L';
  document.getElementById('kpi-prix-litre').textContent  = euros(prixMoyenTTC);
  const elPrixLitreDetail = document.getElementById('kpi-prix-litre-detail');
  if (elPrixLitreDetail) elPrixLitreDetail.textContent = `HT ${euros(prixMoyenHT)} • TTC ${euros(prixMoyenTTC)}`;

  if (!pleins.length) { tb.innerHTML = emptyState('⛽','Aucun plein enregistré','Les pleins saisis par vos salariés ou vous-même apparaîtront ici.'); return; }
  tb.innerHTML = [...pleins].sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe)).map(p => {
    const src = p.source==='salarie'
      ? '<span style="background:rgba(79,142,247,0.15);color:#4f8ef7;padding:2px 7px;border-radius:12px;font-size:0.75rem;">👤 Salarié</span>'
      : '<span style="background:rgba(245,166,35,0.12);color:var(--accent);padding:2px 7px;border-radius:12px;font-size:0.75rem;">⚙️ Admin</span>';
    const mod = p.modifie ? '<span style="background:rgba(231,76,60,0.15);color:#e74c3c;padding:2px 7px;border-radius:12px;font-size:0.75rem;margin-left:4px;">✏️ Modifié</span>' : '';
    // Label étendu : matche les 6 types + tolère les synonymes
    const carbKey = (p.typeCarburant || 'diesel').toLowerCase();
    let typeLabel = '⛽ Diesel/Gazole';
    if (carbKey === 'essence') typeLabel = '🟢 Essence';
    else if (carbKey === 'gnv' || carbKey === 'biognv') typeLabel = '🌿 GNV/BioGNV';
    else if (carbKey === 'electrique') typeLabel = '⚡ Électrique';
    else if (carbKey === 'hybride') typeLabel = '🔋 Hybride';
    else if (carbKey === 'hydrogene') typeLabel = '💧 Hydrogène';
    // Menu Actions standardisé (pattern Livraisons/Clients)
    const actionsItems = [
      { icon: '✏️', label: 'Modifier', action: `ouvrirEditCarburantAdmin('${p.id}')` },
      p.photoRecu
        ? { icon: '🧾', label: 'Voir le reçu', action: `voirRecuCarburant('${p.id}')` }
        : { icon: '🧾', label: 'Voir le reçu (aucun)', action: '', disabled: true, title: 'Aucun reçu uploadé' },
      { icon: '🗑️', label: 'Supprimer', action: `supprimerCarburant('${p.id}')`, danger: true }
    ];
    return `<tr${p.modifie?' style="background:rgba(231,76,60,0.04)"':''}>
      <td>${p.vehId ? `<button type="button" class="table-link-button" onclick="ouvrirFicheVehiculeDepuisTableau('${p.vehId}')" title="Ouvrir le véhicule">${p.vehNom}</button>` : p.vehNom}${mod}</td><td>${typeLabel}</td><td>${p.litres}L</td><td>${euros(p.prixLitre)}</td>
      <td><strong>${euros(p.total)}</strong></td><td>${euros(p.tvaDeductible||0)}</td><td>${p.kmCompteur ? formatKm(p.kmCompteur) : '—'}</td><td>${formatDateExport(p.date)}</td><td>${src}</td>
      <td>${buildInlineActionsDropdown('Actions', actionsItems)}</td>
    </tr>`;
  }).join('');
}

// L4108 (script.js d'origine)
function resetFiltresCarburant() {
  ['filtre-carb-type','filtre-carb-vehicule'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  afficherCarburant();
}

// L4115 (script.js d'origine)
async function supprimerCarburant(id) {
  const _ok = await confirmDialog('Supprimer ce plein ?', {titre:'Supprimer',icone:'⛽',btnLabel:'Supprimer'});
  if (!_ok) return;
  removeChargeCarburant(id);
  sauvegarder('carburant', charger('carburant').filter(p => p.id !== id));
  afficherCarburant(); afficherToast('🗑️ Supprimé');
}

// L4131 (script.js d'origine)
function actionCarburant(action, id) {
  if (!action) return;
  if (action === 'modifier') ouvrirEditCarburantAdmin(id);
  else if (action === 'recu') voirRecuCarburant(id);
  else if (action === 'supprimer') supprimerCarburant(id);
}

// L4138 (script.js d'origine)
async function voirRecuCarburant(id) {
  const pleins = charger('carburant');
  const plein = pleins.find(p => p.id === id);
  if (!plein) return;
  if (!plein.photoRecu && !plein.photoRecuPath) {
    afficherToast('Aucun reçu pour ce plein', 'info');
    return;
  }

  let url = plein.photoRecu || '';
  if (!url && plein.photoRecuPath && window.DelivProStorage) {
    const bucket = plein.photoRecuBucket || 'carburant-recus';
    const signed = await window.DelivProStorage.getSignedUrl(bucket, plein.photoRecuPath, 600);
    if (!signed.ok) { afficherToast('⚠️ Lien indisponible : ' + (signed.error?.message || 'erreur'), 'error'); return; }
    url = signed.signedUrl;
  }
  if (!url) { afficherToast('Reçu indisponible', 'info'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<button style="position:absolute;top:20px;right:20px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="this.parentElement.remove()">✕</button><img src="${url}" style="max-width:100%;max-height:100%;border-radius:8px" />`;
  document.body.appendChild(overlay);
}

// L6013 (script.js d'origine)
function ouvrirEditCarburantAdmin(id) {
  const p = charger('carburant').find(x => x.id === id);
  if (!p) return;
  _editCarbId = id;
  document.getElementById('edit-carb-id').value     = id;
  document.getElementById('edit-carb-litres').value = p.litres;
  document.getElementById('edit-carb-prix').value   = p.prixLitre;
  document.getElementById('edit-carb-km').value     = p.kmCompteur || '';
  document.getElementById('edit-carb-date').value   = p.date;
  if (document.getElementById('edit-carb-taux-tva')) document.getElementById('edit-carb-taux-tva').value = String(p.tauxTVA ?? 20);
  document.getElementById('modal-edit-carburant').classList.add('open');
}

// L6026 (script.js d'origine)
function confirmerEditCarburantAdmin() {
  const id        = document.getElementById('edit-carb-id').value;
  const litres    = parseFloat(document.getElementById('edit-carb-litres').value);
  const prixLitre = parseFloat(document.getElementById('edit-carb-prix').value);
  const kmCompteur = parseFloat(document.getElementById('edit-carb-km').value);
  const date      = document.getElementById('edit-carb-date').value;
  const tauxTVA   = parseFloat(document.getElementById('edit-carb-taux-tva')?.value) || 20;
  if (!litres || !prixLitre) { afficherToast('⚠️ Litres et prix obligatoires', 'error'); return; }
  if (hasNegativeNumber(litres, prixLitre, kmCompteur, tauxTVA)) {
    afficherToast('⚠️ Les montants, litres et kilomètres doivent être positifs', 'error');
    return;
  }
  const total  = litres * prixLitre;
  const pleins = charger('carburant');
  const idx    = pleins.findIndex(p => p.id === id);
  if (idx === -1) return;
  const salId = pleins[idx].salId;
  pleins[idx].litres = litres; pleins[idx].prixLitre = prixLitre;
  pleins[idx].total  = total;  pleins[idx].date = date;
  pleins[idx].kmCompteur = Number.isFinite(kmCompteur) ? kmCompteur : null;
  pleins[idx].tauxTVA = tauxTVA;
  pleins[idx].modifie = true;  pleins[idx].modifieLe = new Date().toISOString();
  pleins[idx].chargeId = syncChargeCarburant(pleins[idx]);
  sauvegarder('carburant', pleins);
  if (salId) {
    const cle  = 'carb_sal_' + salId;
    const perso = loadSafe(cle, []);
    const pi    = perso.findIndex(p => p.id === id);
    if (pi > -1) {
      perso[pi].litres = litres; perso[pi].prixLitre = prixLitre;
      perso[pi].total  = total;  perso[pi].date = date;
      perso[pi].kmCompteur = Number.isFinite(kmCompteur) ? kmCompteur : null;
      perso[pi].tauxTVA = tauxTVA;
      perso[pi].modifie = true;
      localStorage.setItem(cle, JSON.stringify(perso));
    }
  }
  const vehId = pleins[idx].vehId;
  const veh = vehId ? getVehiculeById(vehId) : null;
  if (veh && Number.isFinite(kmCompteur) && kmCompteur > (parseFloat(veh.km) || 0)) {
    const vehicules = charger('vehicules');
    const idxVeh = vehicules.findIndex(function(item) { return item.id === vehId; });
    if (idxVeh > -1) {
      vehicules[idxVeh].km = Math.max(parseFloat(vehicules[idxVeh].km) || 0, kmCompteur);
      sauvegarder('vehicules', vehicules);
    }
  }
  closeModal('modal-edit-carburant');
  afficherCarburant();
  afficherToast('✅ Plein mis à jour');
}

// L6742 (script.js d'origine)
function ouvrirRecurrence(id) {
  const liv = charger('livraisons').find(l => l.id === id);
  if (!liv) return;
  document.getElementById('rec-liv-id').value  = id;
  document.getElementById('rec-liv-info').textContent = `${liv.client} — ${liv.numLiv||''}`;
  document.getElementById('rec-semaines').value = '4';
  openModal('modal-recurrence');
}

// L6751 (script.js d'origine)
function confirmerRecurrence() {
  const id      = document.getElementById('rec-liv-id').value;
  const nb      = parseInt(document.getElementById('rec-semaines').value, 10) || 1;
  const source  = charger('livraisons').find(l => l.id === id);
  if (!source || nb < 1 || nb > 52) { afficherToast('⚠️ Nombre de semaines invalide (1-52)', 'error'); return; }

  const livraisons = charger('livraisons');
  const baseDate   = new Date(source.date);
  const creees     = [];

  for (let i = 1; i <= nb; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * 7);
    const copie = {
      ...source,
      id: genId(),
      numLiv: genNumLivraison(),
      date: d.toLocalISODate(),
      statut: 'en-attente',
      statutPaiement: 'en-attente',
      creeLe: new Date().toISOString()
    };
    livraisons.push(copie);
    creees.push(copie.numLiv);
  }
  sauvegarder('livraisons', livraisons);
  closeModal('modal-recurrence');
  afficherLivraisons();
  afficherToast(`✅ ${nb} livraison(s) récurrente(s) créée(s)`);
}

// L12375 (script.js d'origine)
function getCarburantPeriodeRange() { return getPeriodeRange(_carbPeriode.mode, _carbPeriode.offset); }

// L12376 (script.js d'origine)
function changerVueCarburant(mode) { changeSimplePeriode(_carbPeriode, mode, afficherCarburant, 'carb-mois-label', 'carb-mois-dates', 'vue-carb-select'); }

// L12377 (script.js d'origine)
function navCarburantPeriode(delta) { navSimplePeriode(_carbPeriode, delta, afficherCarburant, 'carb-mois-label', 'carb-mois-dates', 'vue-carb-select'); }

// L12378 (script.js d'origine)
function reinitialiserCarburantPeriode() { resetSimplePeriode(_carbPeriode, afficherCarburant, 'carb-mois-label', 'carb-mois-dates', 'vue-carb-select'); }

// L12961 (script.js d'origine)
function exporterCarburantPDF() {
  var range = getCarburantPeriodeRange();
  var pleins = charger('carburant').filter(function(p){return isDateInRange(p.date, range);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var vehicules = charger('vehicules');
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var moisLabel = range.label;
  var totalHT=0, totalTVA=0, totalTTC=0;

  var rows = pleins.map(function(p,i) {
    var veh = vehicules.find(function(v){return v.id===p.vehId;});
    var tauxRecup = veh && veh.tvaCarbDeductible !== undefined ? veh.tvaCarbDeductible : (p.type==='essence'?100:80);
    var ht = (p.total||0) / 1.2;
    var tvaFull = (p.total||0) - ht;
    var tvaDeduct = tvaFull * tauxRecup / 100;
    totalHT += ht; totalTVA += tvaDeduct; totalTTC += (p.total||0);
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:6px 10px">'+p.date+'</td><td style="padding:6px 10px">'+(veh?veh.immat:'—')+'</td><td style="padding:6px 10px">'+(p.type||'gasoil')+'</td><td style="padding:6px 10px;text-align:right">'+(p.litres||0)+' L</td><td style="padding:6px 10px;text-align:right">'+euros(ht)+'</td><td style="padding:6px 10px;text-align:right;color:#6b7280">'+euros(tvaDeduct)+' ('+tauxRecup+'%)</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(p.total||0)+'</td></tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:800px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px"><div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">'+nom+'</div></div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af">Carburant — '+moisLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px"><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total HT</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalHT)+'</div></div><div style="background:#fff3e0;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">TVA déductible</div><div style="font-size:1.1rem;font-weight:800;color:#e67e22">'+euros(totalTVA)+'</div></div><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total TTC</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalTTC)+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Date</th><th style="padding:6px 10px;text-align:left">Véhicule</th><th style="padding:6px 10px">Type</th><th style="padding:6px 10px;text-align:right">Litres</th><th style="padding:6px 10px;text-align:right">HT</th><th style="padding:6px 10px;text-align:right">TVA déd.</th><th style="padding:6px 10px;text-align:right">TTC</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:8px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';

  var win = ouvrirPopupSecure('','_blank','width=850,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><title>Carburant '+moisLabel+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('📄 Rapport carburant généré');
}

