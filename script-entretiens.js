/**
 * MCA Logistics — Module Entretiens
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L760 (script.js d'origine)
function getTypeEntretienLabel(type) {
  return {
    revision: 'Révision',
    vidange: 'Vidange',
    pneus: 'Pneus',
    plaquettes: 'Plaquettes de frein',
    courroie: 'Courroie de distribution',
    freins: 'Freins',
    carrosserie: 'Carrosserie',
    autre: 'Autre'
  }[type] || 'Autre';
}

// L780 (script.js d'origine)
function getTauxDeductibiliteEntretien(entretien) {
  return 100;
}

// L819 (script.js d'origine)
function getEntretienMontantHT(entretien) {
  if (!entretien) return 0;
  if (entretien.coutHT != null && entretien.coutHT !== '') return parseFloat(entretien.coutHT) || 0;
  var total = parseFloat(entretien.cout) || 0;
  var taux = parseFloat(entretien.tauxTVA) || 0;
  return taux > 0 ? total / (1 + taux / 100) : total;
}

// L827 (script.js d'origine)
function getEntretienMontantTVA(entretien) {
  return calculerMontantTVAFromHT(getEntretienMontantHT(entretien), parseFloat(entretien?.tauxTVA) || 0);
}

// L1190 (script.js d'origine)
function getLabelVehiculeEntretien(entretien, vehicule) {
  if (vehicule) {
    return '<button type="button" class="table-link-button" onclick="ouvrirFicheVehiculeDepuisTableau(\'' + vehicule.id + '\')" title="Ouvrir le véhicule"><strong>' + planningEscapeHtml(vehicule.immat) + '</strong></button>'
      + (vehicule.modele ? ' <span style="font-size:.78rem;color:var(--text-muted)">' + planningEscapeHtml(vehicule.modele) + '</span>' : '');
  }
  return '<strong>—</strong><span class="orphan-warning">(véhicule supprimé)</span>';
}

// L1365 (script.js d'origine)
function getMontantHTEntretien(entretien) {
  if (entretien?.coutHT !== undefined && entretien?.coutHT !== null && entretien?.coutHT !== '') {
    return parseFloat(entretien.coutHT) || 0;
  }
  const taux = parseFloat(entretien?.tauxTVA) || 0;
  return (parseFloat(entretien?.cout) || 0) / (1 + taux / 100);
}

// L2081 (script.js d'origine)
function getPilotageEntretienVehicule(veh) {
  if (!veh) return { kmActuel: 0, prochainKm: 0, dateEcheance: '', estEnRetard: false, estProche: false };
  const kmActuel = calculerKilometrageVehiculeActuel(veh);
  const intervalKm = parseFloat(veh.entretienIntervalKm) || 0;
  const intervalMois = parseFloat(veh.entretienIntervalMois) || 0;
  const entretiensVehicule = charger('entretiens')
    .filter(function(e) { return e.vehId === veh.id; })
    .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  const dernier = entretiensVehicule[0] || null;
  const dernierKm = parseFloat(dernier?.km) || 0;
  const prochainKm = parseFloat(dernier?.prochainKm) || (intervalKm ? ((dernierKm || kmActuel || (parseFloat(veh.kmInitial) || 0)) + intervalKm) : 0);
  let dateEcheance = '';
  if (intervalMois) {
    const baseDate = dernier?.date || veh.dateAcquisition || '';
    if (baseDate) {
      const d = new Date(baseDate + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + intervalMois);
        dateEcheance = d.toLocalISODate();
      }
    }
  }
  const auj = aujourdhui();
  const kmRestants = prochainKm ? (prochainKm - kmActuel) : null;
  return {
    kmActuel,
    prochainKm,
    dateEcheance,
    estEnRetard: Boolean((prochainKm && kmActuel >= prochainKm) || (dateEcheance && dateEcheance < auj)),
    estProche: Boolean((prochainKm && kmRestants !== null && kmRestants > 0 && kmRestants <= 1000) || (dateEcheance && dateEcheance >= auj && dateEcheance <= new Date(Date.now() + 30 * 86400000).toLocalISODate())),
    kmRestants
  };
}

// L3892 (script.js d'origine)
function afficherEntretiensVehicules() {
  const vehicules  = charger('vehicules');
  const entretiens = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const tb = document.getElementById('tb-entretiens-vehicules');
  if (!tb) return;
  if (!entretiens.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun entretien</td></tr>'; return; }
  tb.innerHTML = entretiens.slice(0,20).map(e => {
    const veh = vehicules.find(v=>v.id===e.vehId);
    return `<tr>
      <td><strong>${veh?.immat||'—'}</strong></td>
      <td>${getTypeEntretienLabel(e.type)}</td>
      <td><strong>${e.cout ? euros(e.cout) : '—'}</strong></td>
      <td>${formatDateExport(e.date)}</td>
      <td style="font-size:.82rem">${e.description||'—'}</td>
      <td><button class="btn-icon" onclick="ouvrirEditEntretien('${e.id}')" title="Modifier">✏️</button><button class="btn-icon danger" onclick="supprimerEntretien('${e.id}');afficherEntretiensVehicules()">🗑️</button></td>
    </tr>`;
  }).join('');
}

// L6656 (script.js d'origine)
function exporterEntretiens() {
  const tous = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const vehs = charger('vehicules');
  exporterCSV(tous, [
    { label:'Date',           get:e=>e.date||'' },
    { label:'Véhicule',       get:e=>vehs.find(v=>v.id===e.vehId)?.immat||'' },
    { label:'Type',           get:e=>e.type||'' },
    { label:'Description',    get:e=>e.description||'' },
    { label:'Km',             get:e=>e.km||'' },
    { label:'Prochain km',    get:e=>e.prochainKm||'' },
    { label:'Coût €',         get:e=>e.cout?parseFloat(e.cout).toFixed(2):'' },
  ], `entretiens_${aujourdhui()}.csv`);
  afficherToast('✅ Export entretiens CSV téléchargé');
}

// L10191 (script.js d'origine)
function afficherEntretiens() {
  const vehicules  = charger('vehicules');
  let entretiens = charger('entretiens').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const tb = document.getElementById('tb-entretiens');
  if (!tb) return;
  paginer.__reload_tb_entretiens = afficherEntretiens;
  const rangeEntr = getEntretiensPeriodeRange();
  const periodSelect = document.getElementById('vue-entr-select');
  if (periodSelect) periodSelect.value = _entrPeriode.mode;
  majPeriodeDisplay('entr-mois-label', 'entr-mois-dates', rangeEntr);

  // Filtres
  const filtreVeh  = document.getElementById('filtre-entr-vehicule')?.value || '';
  const filtreType = document.getElementById('filtre-entr-type')?.value || '';
  const selVeh = document.getElementById('filtre-entr-vehicule');
  if (selVeh && selVeh.options.length <= 1) {
    vehicules.forEach(v => { selVeh.innerHTML += `<option value="${v.id}">${v.immat}</option>`; });
  }
  if (filtreVeh)  entretiens = entretiens.filter(e => e.vehId === filtreVeh);
  if (filtreType) entretiens = entretiens.filter(e => e.type === filtreType);
  entretiens = entretiens.filter(e => isDateInRange(e.date, rangeEntr));
  if (entretiens.some(e => e.vehId && !vehicules.some(v => v.id === e.vehId))) {
    ajouterAlerteSiAbsente('entretien_orphelin', '⚠️ Certains entretiens sont liés à un véhicule supprimé.', { vehId: 'entretien_orphelin' });
  }

  if (!entretiens.length) {
    nettoyerPagination('tb-entretiens');
    tb.innerHTML = emptyState('🔧','Aucun entretien ce mois','Changez de mois ou ajoutez un entretien.');
    return;
  }

  const typeClass = { revision:'type-revision', pneus:'type-pneus', vidange:'type-vidange', plaquettes:'type-plaquettes', courroie:'type-courroie', freins:'type-plaquettes', carrosserie:'type-autre', autre:'type-autre' };
  const typeIcons = { revision:'🔩', pneus:'🔘', vidange:'🛢️', plaquettes:'⚙️', courroie:'⛓️', freins:'🛑', carrosserie:'🚘', autre:'🔧' };

  paginer(entretiens, 'tb-entretiens', function(items) {
    return items.map(e => {
    const veh = vehicules.find(v=>v.id===e.vehId);
    const ht = e.coutHT || (e.cout||0) / (1 + (e.tauxTVA||20)/100);
    const tvaM = (e.cout||0) - ht;
    return `<tr>
      <td>${formatDateExport(e.date)}</td>
      <td>${getLabelVehiculeEntretien(e, veh)}</td>
      <td><span class="entretien-type-badge ${typeClass[e.type]||'type-autre'}">${typeIcons[e.type]||'🔧'} ${getTypeEntretienLabel(e.type)}</span></td>
      <td>${e.description||'—'}</td>
      <td>${e.km ? formatKm(e.km) : '—'}</td>
      <td>${e.prochainKm ? formatKm(e.prochainKm) : '—'}</td>
      <td style="font-size:.85rem">${e.cout ? euros(ht) : '—'}</td>
      <td style="font-size:.82rem;color:var(--text-muted)">${e.cout ? euros(tvaM) : '—'}</td>
      <td><strong>${e.cout ? euros(e.cout) : '—'}</strong></td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditEntretien('${e.id}')" title="Modifier">✏️</button>
        <button class="btn-icon danger" onclick="supprimerEntretien('${e.id}')" title="Supprimer">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  }, 12);
}

// L10252 (script.js d'origine)
function autoFillKmEntretien() {
  const sel = document.getElementById('entr-veh');
  const kmInput = document.getElementById('entr-km');
  if (!sel || !kmInput || !sel.value) return;
  const veh = charger('vehicules').find(v => v.id === sel.value);
  if (!veh) return;
  const kmActuel = (typeof calculerKilometrageVehiculeActuel === 'function')
    ? calculerKilometrageVehiculeActuel(veh)
    : (parseFloat(veh.km) || 0);
  if (kmActuel) kmInput.value = kmActuel;
}

// L10264 (script.js d'origine)
function ouvrirModalEntretien() {
  window._editEntretienId = null;
  ['entr-date','entr-desc','entr-km','entr-prochain-km','entr-cout-ht','entr-cout'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = id === 'entr-date' ? aujourdhui() : '';
  });
  const veh = document.getElementById('entr-veh'); if (veh) veh.value = '';
  const type = document.getElementById('entr-type'); if (type) type.value = 'revision';
  const tva = document.getElementById('entr-taux-tva'); if (tva) tva.value = '20';
  const modal = document.getElementById('modal-entretien');
  modal.querySelector('h3').textContent = '🔧 Ajouter un entretien';
  modal.querySelector('.modal-footer .btn-primary').textContent = '✅ Enregistrer';
  openModal('modal-entretien');
}

// L10280 (script.js d'origine)
function ajouterEntretien() {
  if (window._editEntretienId) return confirmerEditEntretien();
  const vehId      = document.getElementById('entr-veh')?.value || '';
  const date       = document.getElementById('entr-date')?.value || aujourdhui();
  const type       = document.getElementById('entr-type')?.value || 'autre';
  const desc       = document.getElementById('entr-desc')?.value.trim() || '';
  const km         = parseFloat(document.getElementById('entr-km')?.value) || 0;
  const prochainKm = parseFloat(document.getElementById('entr-prochain-km')?.value) || 0;
  const coutHT     = parseFloat(document.getElementById('entr-cout-ht')?.value) || 0;
  const tauxTVA    = parseFloat(document.getElementById('entr-taux-tva')?.value) || 20;
  const cout       = parseFloat(document.getElementById('entr-cout')?.value) || (coutHT * (1 + tauxTVA/100));

  if (!vehId) { afficherToast('⚠️ Véhicule obligatoire','error'); return; }
  if (hasNegativeNumber(km, prochainKm, coutHT, cout, tauxTVA)) {
    afficherToast('⚠️ Les montants et kilométrages doivent être positifs', 'error');
    return;
  }

  const entretiens = charger('entretiens');
  const veh = getVehiculeById(vehId);
  const tauxDeductible = 100;
  const entretienId = genId();
  let chargeId = '';
  if (cout > 0) {
    chargeId = genId();
    const charges = charger('charges');
    charges.push({ id:chargeId, entretienId, date, categorie:'entretien', description:`${getTypeEntretienLabel(type)} — ${desc||veh?.immat||''}`, montant:cout, montantHT: coutHT || cout/(1+tauxTVA/100), tauxTVA, vehId, vehNom:veh?.immat||'', creeLe:new Date().toISOString() });
    sauvegarder('charges', charges);
  }
  entretiens.push({ id:entretienId, chargeId, vehId, date, type, description:desc, km, prochainKm, cout, coutHT: coutHT || cout/(1+tauxTVA/100), tauxTVA, tauxDeductible, creeLe:new Date().toISOString() });
  sauvegarder('entretiens', entretiens);
  ajouterEntreeAudit('Création entretien', (desc || getTypeEntretienLabel(type) || 'Entretien') + ' · ' + euros(cout || 0));
  if (veh && km > (parseFloat(veh.km) || 0)) {
    const vehicules = charger('vehicules');
    const idxVeh = vehicules.findIndex(function(item) { return item.id === vehId; });
    if (idxVeh > -1) {
      const kmAvant = parseFloat(vehicules[idxVeh].km) || 0;
      vehicules[idxVeh].km = Math.max(parseFloat(vehicules[idxVeh].km) || 0, km);
      if (!Number.isFinite(parseFloat(vehicules[idxVeh].kmInitial))) vehicules[idxVeh].kmInitial = kmAvant || km;
      sauvegarder('vehicules', vehicules);
    }
  }

  closeModal('modal-entretien');
  afficherEntretiens();
  afficherVehicules();
  afficherTva();
  afficherToast('✅ Entretien enregistré');
}

// L10330 (script.js d'origine)
function ouvrirEditEntretien(id) {
  const e = charger('entretiens').find(x => x.id === id);
  if (!e) return;
  window._editEntretienId = id;
  document.getElementById('entr-veh').value = e.vehId || '';
  document.getElementById('entr-date').value = e.date || '';
  document.getElementById('entr-type').value = e.type || 'autre';
  document.getElementById('entr-desc').value = e.description || '';
  document.getElementById('entr-km').value = e.km || '';
  document.getElementById('entr-prochain-km').value = e.prochainKm || '';
  document.getElementById('entr-cout-ht').value = e.coutHT || '';
  document.getElementById('entr-taux-tva').value = e.tauxTVA || 20;
  document.getElementById('entr-cout').value = e.cout || '';
  calculerTTCDepuisHT('entr');
  const modal = document.getElementById('modal-entretien');
  modal.querySelector('h3').textContent = '✏️ Modifier un entretien';
  modal.querySelector('.modal-footer .btn-primary').textContent = '✅ Enregistrer';
  modal.classList.add('open');
}

// L10350 (script.js d'origine)
function confirmerEditEntretien() {
  const id = window._editEntretienId;
  if (!id) return;
  const entretiens = charger('entretiens');
  const idx = entretiens.findIndex(e => e.id === id);
  if (idx === -1) return;
  const vehId = document.getElementById('entr-veh')?.value || '';
  const date = document.getElementById('entr-date')?.value || aujourdhui();
  const type = document.getElementById('entr-type')?.value || 'autre';
  const description = document.getElementById('entr-desc')?.value.trim() || '';
  const km = parseFloat(document.getElementById('entr-km')?.value) || 0;
  const prochainKm = parseFloat(document.getElementById('entr-prochain-km')?.value) || 0;
  const coutHT = parseFloat(document.getElementById('entr-cout-ht')?.value) || 0;
  const tauxTVA = parseFloat(document.getElementById('entr-taux-tva')?.value) || 20;
  const cout = parseFloat(document.getElementById('entr-cout')?.value) || (coutHT * (1 + tauxTVA/100));
  if (hasNegativeNumber(km, prochainKm, coutHT, cout, tauxTVA)) {
    afficherToast('⚠️ Les montants et kilométrages doivent être positifs', 'error');
    return;
  }
  const veh = getVehiculeById(vehId);
  entretiens[idx] = {
    ...entretiens[idx],
    vehId, date, type, description, km, prochainKm,
    cout, coutHT: coutHT || cout/(1+tauxTVA/100), tauxTVA,
    tauxDeductible: 100,
    modifieLe: new Date().toISOString()
  };
  sauvegarder('entretiens', entretiens);
  if (veh && km > (parseFloat(veh.km) || 0)) {
    const vehicules = charger('vehicules');
    const idxVeh = vehicules.findIndex(function(item) { return item.id === vehId; });
    if (idxVeh > -1) {
      const kmAvant = parseFloat(vehicules[idxVeh].km) || 0;
      vehicules[idxVeh].km = Math.max(parseFloat(vehicules[idxVeh].km) || 0, km);
      if (!Number.isFinite(parseFloat(vehicules[idxVeh].kmInitial))) vehicules[idxVeh].kmInitial = kmAvant || km;
      sauvegarder('vehicules', vehicules);
    }
  }
  const charges = charger('charges');
  const chargeIdx = charges.findIndex(c => c.id === entretiens[idx].chargeId || c.entretienId === id);
  if (chargeIdx > -1) {
    charges[chargeIdx] = {
      ...charges[chargeIdx],
      date,
      categorie:'entretien',
      description:`${getTypeEntretienLabel(type)} — ${description||veh?.immat||''}`,
      montant: cout,
      montantHT: coutHT || cout/(1+tauxTVA/100),
      tauxTVA,
      vehId,
      vehNom: veh?.immat || ''
    };
    sauvegarder('charges', charges);
  }
  closeModal('modal-entretien');
  const modal = document.getElementById('modal-entretien');
  modal.querySelector('h3').textContent = '🔧 Ajouter un entretien';
  modal.querySelector('.modal-footer .btn-primary').textContent = '✅ Enregistrer';
  window._editEntretienId = null;
  afficherEntretiens();
  afficherVehicules();
  afficherTva();
  afficherToast('✅ Entretien modifié');
}

// L10415 (script.js d'origine)
async function supprimerEntretien(id) {
  const ok = await confirmDialog('Supprimer cet entretien ?',{titre:'Supprimer',icone:'🔧',btnLabel:'Supprimer'});
  if (!ok) return;
  // Trouver l'entretien pour supprimer la charge liée
  const entretien = charger('entretiens').find(e=>e.id===id);
  sauvegarder('entretiens', charger('entretiens').filter(e=>e.id!==id));
  // Supprimer la charge correspondante si elle existe
  if (entretien && entretien.cout > 0) {
    const charges = charger('charges');
    const idxCharge = charges.findIndex(c => c.id === entretien.chargeId || c.entretienId === entretien.id || (c.categorie==='entretien' && c.vehId===entretien.vehId && c.date===entretien.date && Math.abs((c.montant||0)-entretien.cout) < 0.01));
    if (idxCharge > -1) { charges.splice(idxCharge, 1); sauvegarder('charges', charges); }
  }
  afficherEntretiens();
  afficherTva();
  afficherToast('🗑️ Entretien supprimé');
}

// L11408 (script.js d'origine)
function exporterEntretiensPDF() {
  const range = getEntretiensPeriodeRange();
  const entretiens = charger('entretiens').filter(e => isDateInRange(e.date, range)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const vehicules = charger('vehicules');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const total = entretiens.reduce((s,e)=>s+(e.cout||0),0);
  const dateExp = formatDateHeureExport();
  const typeIcons = {revision:'🔩',vidange:'🛢️',pneus:'🔘',plaquettes:'⚙️',courroie:'⛓️',autre:'🔧'};

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Carnet d'entretien</div><div style="font-size:1rem;font-weight:700">${range.label}</div><div style="font-size:.78rem;color:#9ca3af">${range.datesLabel}</div></div>
    </div>
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Date</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Véhicule</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Type</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Description</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Coût</th></tr></thead>
      <tbody>${entretiens.map((e,i)=>{const veh=vehicules.find(v=>v.id===e.vehId);return `<tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}"><td style="padding:8px 12px">${formatDateExport(e.date)}</td><td style="padding:8px 12px;font-weight:600">${veh?.immat||'—'}</td><td style="padding:8px 12px">${typeIcons[e.type]||'🔧'} ${e.type||'autre'}</td><td style="padding:8px 12px">${e.description||'—'}</td><td style="padding:8px 12px;text-align:right;font-weight:700">${e.cout?euros(e.cout):'—'}</td></tr>`;}).join('')}</tbody>
    </table>
    <div style="border-top:2px solid #1a1d27;margin-top:12px;padding-top:8px;display:flex;justify-content:flex-end"><strong>Total : ${euros(total)}</strong></div>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  const win = ouvrirPopupSecure('','_blank','width=800,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Entretiens — ${nom}</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('📄 Rapport entretiens généré');
}

// L11606 (script.js d'origine)
function synchroChargeVersEntretien(charge) {
  if (charge.categorie !== 'entretien') return;
  var entretiens = charger('entretiens');
  var existe = entretiens.find(function(e){return e.chargeId===charge.id;});
  if (existe) return;
  entretiens.push({
    id: genId(), chargeId: charge.id, vehId: charge.vehId || '',
    date: charge.date, type: 'autre', description: charge.description || 'Depuis charges',
    km: 0, prochainKm: 0, cout: charge.montant || 0, coutHT: charge.montantHT || 0, tauxTVA: charge.tauxTVA || 20,
    tauxDeductible: 100, creeLe: new Date().toISOString()
  });
  sauvegarder('entretiens', entretiens);
}

// L12054 (script.js d'origine)
function getEntretiensPeriodeRange() { return getPeriodeRange(_entrPeriode.mode, _entrPeriode.offset); }

// L12055 (script.js d'origine)
function changerVueEntretiens(mode) { changeSimplePeriode(_entrPeriode, mode, afficherEntretiens, 'entr-mois-label', 'entr-mois-dates', 'vue-entr-select'); }

// L12056 (script.js d'origine)
function navEntretiensPeriode(delta) { navSimplePeriode(_entrPeriode, delta, afficherEntretiens, 'entr-mois-label', 'entr-mois-dates', 'vue-entr-select'); }

// L12057 (script.js d'origine)
function reinitialiserEntretiensPeriode() { resetSimplePeriode(_entrPeriode, afficherEntretiens, 'entr-mois-label', 'entr-mois-dates', 'vue-entr-select'); }

