/**
 * MCA Logistics — Module Charges
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L709 (script.js d'origine)
function getChargeMontantHT(charge) {
  if (!charge) return 0;
  if (charge.montantHT != null && charge.montantHT !== '') return parseFloat(charge.montantHT) || 0;
  var total = parseFloat(charge.montant) || 0;
  var taux = parseFloat(charge.tauxTVA) || 0;
  return taux > 0 ? total / (1 + taux / 100) : total;
}

// L6982 (script.js d'origine)
function resetFormulaireCharge() {
  var fields = ['charge-edit-id','charge-date','charge-desc','charge-montant-ht','charge-montant','charge-veh','charge-tva-period','charge-fournisseur'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'charge-date') el.value = aujourdhui();
    else if (id === 'charge-tva-period') el.value = getTVADefaultPeriodInput();
    else el.value = '';
  });
  var cat = document.getElementById('charge-cat');
  if (cat) cat.value = 'autre';
  var tva = document.getElementById('charge-taux-tva');
  if (tva) tva.value = '20';
  var tvaInfo = document.getElementById('charge-montant-tva');
  if (tvaInfo) tvaInfo.textContent = '';
  var fSug = document.getElementById('fournisseur-suggestions');
  if (fSug) fSug.innerHTML = '';
  window.__chargeSelectedFournisseurId = null;
  window.__chargeSelectedFournisseurNom = null;
  var modal = document.getElementById('modal-charge');
  if (modal) {
    var title = modal.querySelector('.modal-header h3');
    var btn = modal.querySelector('.modal-footer .btn-primary');
    if (title) title.textContent = '💸 Nouvelle charge';
    if (btn) btn.textContent = '✅ Enregistrer';
  }
}

// L7005 (script.js d'origine)
function ajusterCategorieCharge() {
  var cat = document.getElementById('charge-cat');
  var tva = document.getElementById('charge-taux-tva');
  var desc = document.getElementById('charge-desc');
  var dateLabel = document.getElementById('charge-date-label');
  var periodWrap = document.getElementById('charge-tva-period-wrap');
  var vehWrap = document.getElementById('charge-veh-wrap');
  var periodInput = document.getElementById('charge-tva-period');
  if (!cat || !tva) return;
  if (cat.value === 'tva') {
    tva.value = '0';
    tva.disabled = true;
    if (desc && !desc.value.trim()) desc.placeholder = 'Ex : Versement TVA avril 2026';
    if (dateLabel) dateLabel.textContent = 'Date de paiement *';
    if (periodWrap) periodWrap.style.display = '';
    if (vehWrap) vehWrap.style.display = 'none';
    if (periodInput && !periodInput.value) periodInput.value = getTVADefaultPeriodInput(document.getElementById('charge-date')?.value || aujourdhui());
  } else {
    tva.disabled = false;
    if (desc) desc.placeholder = 'Description';
    if (dateLabel) dateLabel.textContent = 'Date *';
    if (periodWrap) periodWrap.style.display = 'none';
    if (vehWrap) vehWrap.style.display = '';
    if (parseFloat(tva.value || '0') === 0) tva.value = '20';
  }
  calculerTTCDepuisHT('charge');
}

// L7032 (script.js d'origine)
function ouvrirModalCharge() {
  resetFormulaireCharge();
  ajusterCategorieCharge();
  openModal('modal-charge');
}

// L7037 (script.js d'origine)
function ouvrirEditCharge(id) {
  var charge = charger('charges').find(function(item) { return item.id === id; });
  if (!charge) return;
  // Pre-remplit le fournisseur (lien stable + snapshot nom).
  // Si fournisseurId existe et est encore valide -> on prend son nom actuel.
  // Sinon (fournisseur supprime) -> snapshot nom conserve sur la charge.
  var fournisseurNomAffiche = '';
  if (charge.fournisseurId) {
    var fLive = charger('fournisseurs').find(function(x) { return x.id === charge.fournisseurId; });
    fournisseurNomAffiche = fLive ? (fLive.nom || charge.fournisseur || '') : (charge.fournisseur || '');
    window.__chargeSelectedFournisseurId = fLive ? fLive.id : null;
    window.__chargeSelectedFournisseurNom = fournisseurNomAffiche;
  } else {
    fournisseurNomAffiche = charge.fournisseur || '';
    window.__chargeSelectedFournisseurId = null;
    window.__chargeSelectedFournisseurNom = fournisseurNomAffiche;
  }

  var setters = {
    'charge-edit-id': charge.id,
    'charge-date': charge.date || aujourdhui(),
    'charge-cat': charge.categorie || 'autre',
    'charge-desc': charge.description || '',
    'charge-fournisseur': fournisseurNomAffiche,
    'charge-montant-ht': charge.montantHT || '',
    'charge-taux-tva': charge.tauxTVA || 20,
    'charge-montant': charge.montant || '',
    'charge-veh': charge.vehId || '',
    'charge-tva-period': getTVADeclarationPeriodRangeFromKey(charge.tvaPeriodeKey || charge.tvaPeriode || '')?.debut?.slice(0, 7) || ''
  };
  Object.keys(setters).forEach(function(idField) {
    var el = document.getElementById(idField);
    if (el) el.value = setters[idField];
  });
  var fSug = document.getElementById('fournisseur-suggestions');
  if (fSug) fSug.innerHTML = '';
  ajusterCategorieCharge();
  var modal = document.getElementById('modal-charge');
  if (modal) {
    var title = modal.querySelector('.modal-header h3');
    var btn = modal.querySelector('.modal-footer .btn-primary');
    if (title) title.textContent = '✏️ Modifier la charge';
    if (btn) btn.textContent = '✅ Enregistrer';
  }
  openModal('modal-charge');
}

// L7065 (script.js d'origine)
function resetFiltresCharges() {
  ['filtre-charge-cat', 'filtre-charge-vehicule', 'filtre-charge-search'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  afficherCharges();
}

// L7072 (script.js d'origine)
function afficherCharges() {
  var range = getChargesPeriodeRange();
  var periodSelect = document.getElementById('vue-charges-select');
  if (periodSelect) periodSelect.value = _chargesPeriode.mode;
  majPeriodeDisplay('charges-mois-label', 'charges-mois-dates', range);
  var charges = charger('charges').filter(function(c){return isDateInRange(c.date, range);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  const tb = document.getElementById('tb-charges');
  if (!tb) return;
  const vehicules = charger('vehicules');
  const filtreCat = document.getElementById('filtre-charge-cat')?.value || '';
  const filtreVeh = document.getElementById('filtre-charge-vehicule')?.value || '';
  const filtreSearch = (document.getElementById('filtre-charge-search')?.value || '').trim().toLowerCase();
  const selVeh = document.getElementById('filtre-charge-vehicule');
  if (selVeh) {
    const currentValue = selVeh.value;
    selVeh.innerHTML = '<option value="">Tous les véhicules</option>';
    vehicules.forEach(function(v) { selVeh.innerHTML += `<option value="${v.id}">${v.immat}</option>`; });
    selVeh.value = currentValue;
  }
  if (filtreCat) charges = charges.filter(function(c){ return (c.categorie || 'autre') === filtreCat; });
  if (filtreVeh) charges = charges.filter(function(c){ return (c.vehId || '') === filtreVeh; });
  if (filtreSearch) {
    charges = charges.filter(function(c) {
      var vehicule = c.vehId ? getVehiculeById(c.vehId) : null;
      return [
        c.description,
        c.categorie,
        c.tvaPeriodeKey,
        c.vehNom,
        c.fournisseur,
        vehicule?.immat,
        vehicule?.modele,
        c.date
      ].filter(Boolean).join(' ').toLowerCase().includes(filtreSearch);
    });
  }

  const total = charges.reduce((s,c)=>s+(c.montant||0),0);
  const totalEl = document.getElementById('charges-total-mois');
  if (totalEl) totalEl.textContent = euros(total);

  paginer.__reload_tb_charges = afficherCharges;
  if (!charges.length) {
    nettoyerPagination('tb-charges');
    tb.innerHTML = emptyState('💸','Aucune charge sur cette période','Ajustez les filtres ou ajoutez une charge.');
    return;
  }

  const catIcons = { carburant:'⛽', peage:'🛣️', entretien:'🔧', assurance:'🛡️', salaires:'👥', lld_credit:'🚐', tva:'🧾', autre:'📝' };
  paginer(charges, 'tb-charges', function(items) {
    return items.map(c => {
    const ht = c.montantHT || (c.montant||0) / (1 + (c.tauxTVA||20)/100);
    const tvaM = getChargeMontantTVA(c);
    const vehicule = c.vehId ? getVehiculeById(c.vehId) : null;
    let descAffichee = (c.categorie === 'tva' && getTVASettlementPeriodKey(c, getTVAConfig()))
      ? (c.description || 'Versement TVA') + '<div style="font-size:.76rem;color:var(--text-muted)">Période TVA : ' + planningEscapeHtml(getTVASettlementLabel(c, getTVAConfig())) + '</div>'
      : (c.description || '—');
    // PGI : affichage du fournisseur en sous-ligne si lien existe.
    // On utilise fournisseurId pour retrouver le nom courant (en cas de
    // changement de nom apres creation), avec fallback sur snapshot.
    if (c.fournisseurId || c.fournisseur) {
      const fLive = c.fournisseurId ? charger('fournisseurs').find(f => f.id === c.fournisseurId) : null;
      const fNom = fLive ? fLive.nom : c.fournisseur;
      if (fNom) {
        descAffichee += '<div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">🏭 ' + planningEscapeHtml(fNom) + '</div>';
      }
    }
    return `<tr>
    <td>${formatDateExport(c.date)}</td>
    <td><span class="charge-cat-badge charge-cat-${c.categorie||'autre'}">${catIcons[c.categorie]||'📝'} ${c.categorie||'autre'}</span></td>
    <td>${descAffichee}</td>
    <td>${vehicule ? `<button type="button" class="table-link-button" onclick="ouvrirFicheVehiculeDepuisTableau('${vehicule.id}')" title="Ouvrir le véhicule">${vehicule.immat}</button>` : (c.vehNom||'—')}</td>
    <td style="font-size:.85rem">${euros(ht)}</td>
    <td style="font-size:.82rem;color:var(--text-muted)">${euros(tvaM)}</td>
    <td><strong>${euros(c.montant||0)}</strong></td>
    <td>
      <button class="btn-icon" onclick="ouvrirEditCharge('${c.id}')" title="Modifier">✏️</button>
      <button class="btn-icon danger" onclick="supprimerCharge('${c.id}')">🗑️</button>
    </td>
  </tr>`;
  }).join('');
  }, 15);
}

// L7145 (script.js d'origine)
async function ajouterCharge() {
  const editId    = document.getElementById('charge-edit-id')?.value || '';
  const date      = document.getElementById('charge-date')?.value || aujourdhui();
  const categorie = document.getElementById('charge-cat')?.value || 'autre';
  const desc      = document.getElementById('charge-desc')?.value.trim() || '';
  const montantHT = parseFloat(document.getElementById('charge-montant-ht')?.value) || 0;
  const tauxTVA   = categorie === 'tva' ? 0 : parseTauxTVAValue(document.getElementById('charge-taux-tva')?.value, 20);
  const montant   = parseFloat(document.getElementById('charge-montant')?.value) || (montantHT * (1 + tauxTVA/100));
  const vehId     = document.getElementById('charge-veh')?.value || '';
  const profile   = getTVAConfig();
  const tvaPeriodeKey = categorie === 'tva'
    ? normaliserTVAPeriodeKey(document.getElementById('charge-tva-period')?.value || '', date, profile)
    : '';

  if (!montant && !montantHT) { afficherToast('⚠️ Montant obligatoire','error'); return; }
  if (hasNegativeNumber(montantHT, montant, tauxTVA)) {
    afficherToast('⚠️ Les montants doivent être positifs', 'error');
    return;
  }

  // PGI : resolution fournisseur (lien id + snapshot nom).
  // - Si un fournisseur a ete selectionne via autocomplete -> __chargeSelectedFournisseurId rempli
  // - Si un nom a ete tape sans selection -> auto-creation du fournisseur
  // - Si vide -> pas de lien fournisseur
  const fournisseurNom = (document.getElementById('charge-fournisseur')?.value || '').trim();
  let fournisseurId = window.__chargeSelectedFournisseurId || null;
  if (fournisseurNom && !fournisseurId) {
    const fournisseurs = charger('fournisseurs');
    let fExisting = fournisseurs.find(function(x) {
      return (x.nom || '').toLowerCase() === fournisseurNom.toLowerCase();
    });
    if (!fExisting) {
      fExisting = {
        id: genId(),
        nom: fournisseurNom,
        type: 'Pro',
        creeLe: new Date().toISOString()
      };
      fournisseurs.push(fExisting);
      sauvegarder('fournisseurs', fournisseurs);
      if (typeof ajouterEntreeAudit === 'function') {
        ajouterEntreeAudit('Création fournisseur (depuis charge)', fournisseurNom);
      }
      // PGI : forcer le flush immediat du fournisseur en DB avant de creer
      // la charge qui le reference (FK constraint charges.fournisseur_id ->
      // fournisseurs.id). Sans ce flush, la charge peut arriver avant le
      // fournisseur en DB et la FK rejette.
      try {
        if (window.DelivProEntityAdapters?.fournisseurs?.flushDiff) {
          await window.DelivProEntityAdapters.fournisseurs.flushDiff();
        }
      } catch (e) { console.warn('[ajouterCharge] flush fournisseur:', e); }
      afficherToast('✅ Fournisseur « ' + fournisseurNom + ' » créé automatiquement', 'info');
    }
    fournisseurId = fExisting.id;
  }

  const vehicule = vehId ? charger('vehicules').find(v=>v.id===vehId) : null;
  const charges  = charger('charges');
  const charge = {
    id:editId || genId(),
    date,
    categorie,
    description: desc || (categorie === 'tva' ? 'Versement TVA ' + getTVADeclarationPeriodLabel(tvaPeriodeKey).toLowerCase() : ''),
    montant,
    montantHT: montantHT || (tauxTVA > 0 ? montant/(1+tauxTVA/100) : montant),
    tauxTVA,
    vehId,
    vehNom:vehicule?.immat||'',
    fournisseurId: fournisseurId || null,
    fournisseur: fournisseurNom || '', // snapshot du nom (preserve l'historique)
    tvaPeriodeKey: tvaPeriodeKey || undefined,
    creeLe:new Date().toISOString()
  };
  if (editId) {
    const idx = charges.findIndex(function(item){ return item.id === editId; });
    if (idx === -1) return afficherToast('⚠️ Charge introuvable', 'error');
    charges[idx] = { ...charges[idx], ...charge, modifieLe: new Date().toISOString() };
  } else {
    charges.push(charge);
  }
  sauvegarder('charges', charges);
  ajouterEntreeAudit(editId ? 'Modification charge' : 'Création charge', (charge.categorie || 'charge') + ' · ' + euros(charge.montant || 0) + ' · ' + (charge.description || ''));
  synchroChargeVersEntretien(charge);
  closeModal('modal-charge');
  resetFormulaireCharge();
  afficherCharges();
  afficherTva();
  rafraichirDashboard();
  afficherRentabilite();
  afficherToast(editId ? '✅ Charge mise à jour' : '✅ Charge enregistrée');
}

// L7199 (script.js d'origine)
async function supprimerCharge(id) {
  const ok = await confirmDialog('Supprimer cette charge ?',{titre:'Supprimer',icone:'💸',btnLabel:'Supprimer'});
  if (!ok) return;
  const charge = charger('charges').find(function(item) { return item.id === id; });
  sauvegarder('charges', charger('charges').filter(c=>c.id!==id));
  afficherCharges();
  afficherTva();
  rafraichirDashboard();
  afficherRentabilite();
  ajouterEntreeAudit('Suppression charge', (charge?.categorie || 'charge') + ' · ' + euros(charge?.montant || 0));
  afficherToast('🗑️ Charge supprimée');
}

// L7493 (script.js d'origine)
function chargerFacturesEmises() {
  return charger('factures_emises');
}

// L8312 (script.js d'origine)
function getChargesPeriodeRange() { return getPeriodeRange(_chargesPeriode.mode, _chargesPeriode.offset); }

// L8313 (script.js d'origine)
function changerVueCharges(mode) { changeSimplePeriode(_chargesPeriode, mode, afficherCharges, 'charges-mois-label', 'charges-mois-dates', 'vue-charges-select'); }

// L8314 (script.js d'origine)
function navChargesPeriode(delta) { navSimplePeriode(_chargesPeriode, delta, afficherCharges, 'charges-mois-label', 'charges-mois-dates', 'vue-charges-select'); }

// L8315 (script.js d'origine)
function reinitialiserChargesPeriode() { resetSimplePeriode(_chargesPeriode, afficherCharges, 'charges-mois-label', 'charges-mois-dates', 'vue-charges-select'); }

// L8316 (script.js d'origine)
function navChargesMois(delta) { _chargesPeriode.mode = 'mois'; if (delta === 0) _chargesPeriode.offset = 0; else _chargesPeriode.offset += delta; navChargesPeriode(0); }

// L8317 (script.js d'origine)
function getChargesMoisStr() { return getChargesPeriodeRange().debut.slice(0,7); }

