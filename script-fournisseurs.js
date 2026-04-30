/**
 * MCA Logistics — Module Fournisseurs
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L5538 (script.js d'origine)
function afficherFournisseursDashboard() {
  const fournAll = loadSafe('fournisseurs', []);
  const tb = document.getElementById('tb-fournisseurs');
  if (!tb) return;
  if (!fournAll.length) {
    tb.innerHTML = emptyState('🏭', 'Aucun fournisseur', 'Enregistrez vos fournisseurs pour suivre vos achats et charges.');
    return;
  }
  const filtre = (document.getElementById('filtre-frn-search')?.value || '').trim().toLowerCase();
  const fournisseurs = filtre
    ? fournAll.filter(f => [f.nom, f.contact, f.tel, f.email, f.adresse, f.ville, f.cp, f.siren]
        .filter(Boolean).join(' ').toLowerCase().includes(filtre))
    : fournAll;
  if (!fournisseurs.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun résultat pour « ' + filtre + ' »</td></tr>'; return; }
  const charges = charger('charges');
  tb.innerHTML = fournisseurs.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr')).map(f => {
    const chargesF = charges.filter(c => c.fournisseurId === f.id || c.fournisseur === f.nom);
    const totalDepense = chargesF.reduce((s, c) => s + (parseFloat(c.montant) || 0), 0);
    const contact = (f.contact || f.prenom || '').trim();
    return `<tr>
      <td><strong>${f.nom || '—'}</strong></td>
      <td>${contact || '—'}</td>
      <td>${f.tel || '—'}</td>
      <td style="font-size:.82rem">${f.adresse || '—'}</td>
      <td><strong>${euros(totalDepense)}</strong><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">${chargesF.length} charge${chargesF.length > 1 ? 's' : ''}</div></td>
      <td>${buildInlineActionsDropdown('Actions', [
        { icon: '✏️', label: 'Modifier', action: `ouvrirEditFournisseur('${f.id}')` },
        { icon: '🗑️', label: 'Supprimer', action: `supprimerFournisseur('${f.id}')`, danger: true }
      ])}</td>
    </tr>`;
  }).join('');
}

// L5585 (script.js d'origine)
function resetFormulaireFournisseur() {
  ['frn-nom','frn-secteur','frn-contact','frn-tel','frn-email','frn-email-fact','frn-adresse','frn-cp','frn-ville','frn-siren','frn-tva-intra','frn-iban','frn-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const delai = document.getElementById('frn-delai-paiement');
  if (delai) delai.value = '30';
  const mode = document.getElementById('frn-mode-paiement');
  if (mode) mode.value = 'virement';
  const proRadio = document.querySelector('input[name="frn-type"][value="pro"]');
  if (proRadio) proRadio.checked = true;
  if (typeof window.toggleChampsFournisseurPro === 'function') window.toggleChampsFournisseurPro(false);
}

// L5599 (script.js d'origine)
function ajouterFournisseur() {
  const nom = document.getElementById('frn-nom')?.value.trim();
  if (!nom) { afficherToast('⚠️ Nom obligatoire', 'error'); return; }
  const type = document.querySelector('input[name="frn-type"]:checked')?.value || 'pro';
  const fournisseur = {
    id: genId(),
    nom,
    type,
    secteur: document.getElementById('frn-secteur')?.value || '',
    contact: document.getElementById('frn-contact')?.value.trim() || '',
    tel: document.getElementById('frn-tel')?.value.trim() || '',
    email: document.getElementById('frn-email')?.value.trim() || '',
    emailFact: document.getElementById('frn-email-fact')?.value.trim() || '',
    adresse: document.getElementById('frn-adresse')?.value.trim() || '',
    cp: document.getElementById('frn-cp')?.value.trim() || '',
    ville: document.getElementById('frn-ville')?.value.trim() || '',
    siren: type === 'pro' ? (document.getElementById('frn-siren')?.value.trim() || '') : '',
    tvaIntra: type === 'pro' ? (document.getElementById('frn-tva-intra')?.value.trim() || '') : '',
    delaiPaiementJours: type === 'pro' ? (parseInt(document.getElementById('frn-delai-paiement')?.value, 10) || 30) : null,
    modePaiement: document.getElementById('frn-mode-paiement')?.value || 'virement',
    iban: document.getElementById('frn-iban')?.value.trim() || '',
    notes: document.getElementById('frn-notes')?.value.trim() || '',
    creeLe: new Date().toISOString()
  };
  const fournisseurs = charger('fournisseurs');
  fournisseurs.push(fournisseur);
  sauvegarder('fournisseurs', fournisseurs);
  closeModal('modal-fournisseur');
  ['frn-nom','frn-secteur','frn-contact','frn-tel','frn-email','frn-email-fact','frn-adresse','frn-cp','frn-ville','frn-siren','frn-tva-intra','frn-delai-paiement','frn-iban','frn-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = el.tagName === 'SELECT' ? '' : (id === 'frn-delai-paiement' ? '30' : '');
  });
  // Reset radio Pro
  const proRadio = document.querySelector('input[name="frn-type"][value="pro"]');
  if (proRadio) proRadio.checked = true;
  if (typeof window.toggleChampsFournisseurPro === 'function') window.toggleChampsFournisseurPro(false);
  afficherFournisseursDashboard();
  if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('Création fournisseur', nom);
  afficherToast('✅ Fournisseur enregistré');
}

// L5640 (script.js d'origine)
async function ouvrirEditFournisseur(id) {
  const f = charger('fournisseurs').find(x => x.id === id);
  if (!f) return;
  _editFournisseurId = id;
  const $ = (k) => document.getElementById('edit-frn-' + k);
  if ($('id')) $('id').value = id;
  if ($('nom')) $('nom').value = f.nom || '';
  if ($('secteur')) $('secteur').value = f.secteur || '';
  if ($('contact')) $('contact').value = f.contact || '';
  if ($('tel')) $('tel').value = f.tel || '';
  if ($('email')) $('email').value = f.email || '';
  if ($('email-fact')) $('email-fact').value = f.emailFact || '';
  if ($('adresse')) $('adresse').value = f.adresse || '';
  if ($('cp')) $('cp').value = f.cp || '';
  if ($('ville')) $('ville').value = f.ville || '';
  if ($('siren')) $('siren').value = f.siren || '';
  if ($('tva-intra')) $('tva-intra').value = f.tvaIntra || '';
  if ($('delai-paiement')) $('delai-paiement').value = f.delaiPaiementJours || 30;
  if ($('mode-paiement')) $('mode-paiement').value = f.modePaiement || 'virement';
  if ($('iban')) $('iban').value = f.iban || '';
  if ($('notes')) $('notes').value = f.notes || '';
  // Type Pro/Particulier
  const typeRadio = document.querySelector('input[name="edit-frn-type"][value="' + (f.type || 'pro') + '"]');
  if (typeRadio) typeRadio.checked = true;
  if (typeof window.toggleChampsFournisseurPro === 'function') window.toggleChampsFournisseurPro(true);
  openModal('modal-edit-fournisseur');
}

// L5668 (script.js d'origine)
function confirmerEditFournisseur() {
  const id = document.getElementById('edit-frn-id')?.value || _editFournisseurId;
  if (!id) return;
  const fournisseurs = charger('fournisseurs');
  const idx = fournisseurs.findIndex(f => f.id === id);
  if (idx === -1) return;
  const ancienNom = fournisseurs[idx].nom || '';
  const $ = (k) => document.getElementById('edit-frn-' + k);
  const type = document.querySelector('input[name="edit-frn-type"]:checked')?.value || 'pro';
  fournisseurs[idx].nom = $('nom')?.value.trim() || '';
  fournisseurs[idx].type = type;
  fournisseurs[idx].secteur = $('secteur')?.value || '';
  fournisseurs[idx].contact = $('contact')?.value.trim() || '';
  fournisseurs[idx].tel = $('tel')?.value.trim() || '';
  fournisseurs[idx].email = $('email')?.value.trim() || '';
  fournisseurs[idx].emailFact = $('email-fact')?.value.trim() || '';
  fournisseurs[idx].adresse = $('adresse')?.value.trim() || '';
  fournisseurs[idx].cp = $('cp')?.value.trim() || '';
  fournisseurs[idx].ville = $('ville')?.value.trim() || '';
  fournisseurs[idx].siren = type === 'pro' ? ($('siren')?.value.trim() || '') : '';
  fournisseurs[idx].tvaIntra = type === 'pro' ? ($('tva-intra')?.value.trim() || '') : '';
  fournisseurs[idx].delaiPaiementJours = type === 'pro' ? (parseInt($('delai-paiement')?.value, 10) || 30) : null;
  fournisseurs[idx].modePaiement = $('mode-paiement')?.value || 'virement';
  fournisseurs[idx].iban = $('iban')?.value.trim() || '';
  fournisseurs[idx].notes = $('notes')?.value.trim() || '';
  sauvegarder('fournisseurs', fournisseurs);

  // PGI : propagation auto du nouveau nom sur les charges liees (snapshot mis a jour)
  // Si le nom a change, on actualise le snapshot fournisseur sur toutes les
  // charges qui pointent vers ce fournisseurId. Comme ca, l'historique reste
  // coherent meme apres modification.
  const nouveauNom = fournisseurs[idx].nom || '';
  let nbChargesPropagees = 0;
  if (ancienNom && nouveauNom && ancienNom !== nouveauNom) {
    const charges = charger('charges');
    let changed = false;
    charges.forEach(function(c) {
      if (c.fournisseurId === id) {
        c.fournisseur = nouveauNom;
        nbChargesPropagees++;
        changed = true;
      } else if (!c.fournisseurId && (c.fournisseur || '').toLowerCase() === ancienNom.toLowerCase()) {
        // Charge orpheline (sans id) qui pointait vers l'ancien nom : on la rattache
        c.fournisseurId = id;
        c.fournisseur = nouveauNom;
        nbChargesPropagees++;
        changed = true;
      }
    });
    if (changed) sauvegarder('charges', charges);
  }

  closeModal('modal-edit-fournisseur');
  _editFournisseurId = null;
  afficherFournisseursDashboard();
  if (typeof afficherCharges === 'function') afficherCharges();
  afficherToast(nbChargesPropagees
    ? '✅ Fournisseur mis à jour · ' + nbChargesPropagees + ' charge(s) synchronisée(s)'
    : '✅ Fournisseur mis à jour');
}

// L5699 (script.js d'origine)
async function supprimerFournisseur(id) {
  const f = charger('fournisseurs').find(x => x.id === id);
  if (!f) return;
  const charges = charger('charges');
  const chargesF = charges.filter(c => c.fournisseurId === id || c.fournisseur === f.nom);
  let msg = 'Supprimer le fournisseur « ' + (f.nom || 'sans nom') + ' » ?';
  if (chargesF.length) msg += '\n\n⚠️ Lié à ' + chargesF.length + ' charge' + (chargesF.length > 1 ? 's' : '') + ' (snapshots conservés).';
  const ok = await confirmDialog(msg, { titre: 'Supprimer le fournisseur', icone: '🏭', btnLabel: 'Supprimer', danger: true });
  if (!ok) return;
  sauvegarder('fournisseurs', charger('fournisseurs').filter(x => x.id !== id));
  afficherFournisseursDashboard();
  if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('Suppression fournisseur', f.nom || 'sans nom');
  afficherToast('🗑️ Fournisseur supprimé');
}

// ============================================================
// AUTOCOMPLETE FOURNISSEUR DANS MODAL CHARGE (PGI)
// ============================================================
// Pattern identique a autoCompleteClient (modal livraison) : input + suggestions
// + selection par id ou auto-creation si nom inexistant.

/**
 * Autocomplete des fournisseurs pour le formulaire charge.
 * Filtre par nom, secteur, email, SIREN, ville. Si aucun match, propose
 * de creer le fournisseur a la volee.
 */
function autoCompleteFournisseurCharge(val) {
  const sug = document.getElementById('fournisseur-suggestions');
  if (!sug) return;
  // Reset selectedId si l'utilisateur retape (sinon le selected colle)
  const saisi = (val || '').trim();
  if (window.__chargeSelectedFournisseurNom && saisi !== window.__chargeSelectedFournisseurNom) {
    window.__chargeSelectedFournisseurId = null;
    window.__chargeSelectedFournisseurNom = null;
  }
  if (saisi.length < 1) { sug.innerHTML = ''; return; }
  const q = saisi.toLowerCase();
  const fournisseurs = charger('fournisseurs');
  const matches = fournisseurs.filter(function(f) {
    const blob = [f.nom, f.contact, f.secteur, f.email, f.siren, f.ville, f.cp]
      .filter(Boolean).join(' ').toLowerCase();
    return blob.indexOf(q) >= 0;
  }).slice(0, 8);

  if (!matches.length) {
    const safeName = escapeAttr(saisi);
    const displayName = escapeHtml(saisi);
    sug.innerHTML = '<div onclick="ouvrirCreationFournisseurDepuisCharge(\'' + safeName + '\')" style="padding:8px 12px;cursor:pointer;font-size:.88rem;color:var(--accent);font-weight:600;border-bottom:1px solid var(--border)">+ Créer fournisseur « ' + displayName + ' »</div>';
    return;
  }

  sug.innerHTML = matches.map(function(f) {
    const idAttr = escapeAttr(f.id);
    const nomHtml = escapeHtml(f.nom || 'Sans nom');
    const secteurHtml = f.secteur ? '<span style="color:var(--text-muted);font-size:.78rem;margin-left:6px">' + escapeHtml(f.secteur) + '</span>' : '';
    const sirenHtml = f.siren ? '<span style="color:var(--text-muted);font-size:.72rem;margin-left:8px">SIREN ' + escapeHtml(f.siren) + '</span>' : '';
    return '<div onclick="selectionnerFournisseurChargeParId(\'' + idAttr + '\')" style="padding:7px 12px;cursor:pointer;font-size:.88rem;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'transparent\'">' + nomHtml + secteurHtml + sirenHtml + '</div>';
  }).join('');
}

/**
 * Selection d'un fournisseur existant via clic dans les suggestions.
 * Pre-remplit le champ + suggere intelligemment la categorie de charge
 * selon le secteur du fournisseur (PGI : automatisation).
 */
function selectionnerFournisseurChargeParId(fournisseurId) {
  const sug = document.getElementById('fournisseur-suggestions');
  if (sug) sug.innerHTML = '';
  const f = charger('fournisseurs').find(function(x) { return x.id === fournisseurId; });
  if (!f) return;
  const inp = document.getElementById('charge-fournisseur');
  if (inp) inp.value = f.nom || '';
  window.__chargeSelectedFournisseurId = f.id;
  window.__chargeSelectedFournisseurNom = f.nom || '';

  // PGI : pre-remplit la categorie de charge selon le secteur du fournisseur
  // (ex: "Carburant" -> categorie "carburant", "Garage" -> "entretien", etc.)
  const cat = document.getElementById('charge-cat');
  if (cat && f.secteur && !document.getElementById('charge-edit-id')?.value) {
    const sec = (f.secteur || '').toLowerCase();
    let suggCat = null;
    if (/carbur|station|essence|diesel/.test(sec)) suggCat = 'carburant';
    else if (/garage|entretien|mecanic|reparation|pneu/.test(sec)) suggCat = 'entretien';
    else if (/assur/.test(sec)) suggCat = 'assurance';
    else if (/peage|autoroute/.test(sec)) suggCat = 'peage';
    if (suggCat && cat.value === 'autre') {
      cat.value = suggCat;
      if (typeof ajusterCategorieCharge === 'function') ajusterCategorieCharge();
    }
  }

  // PGI : pre-remplit la description avec le nom + secteur si vide
  const desc = document.getElementById('charge-desc');
  if (desc && !desc.value.trim() && f.secteur) {
    desc.placeholder = f.nom + (f.secteur ? ' — ' + f.secteur : '');
  }
}

/**
 * Marque le nom comme a creer a la sauvegarde (auto-creation lors du
 * ajouterCharge). Pas d'ouverture de modal pour rester rapide.
 */
function ouvrirCreationFournisseurDepuisCharge(nom) {
  const sug = document.getElementById('fournisseur-suggestions');
  if (sug) sug.innerHTML = '';
  const inp = document.getElementById('charge-fournisseur');
  if (inp) inp.value = nom;
  // Pas d'id encore : sera cree au moment de ajouterCharge
  window.__chargeSelectedFournisseurId = null;
  window.__chargeSelectedFournisseurNom = nom;
  if (typeof afficherToast === 'function') {
    afficherToast('💡 « ' + nom + ' » sera créé à l\'enregistrement', 'info');
  }
}

// Ferme les suggestions si on clique en dehors
document.addEventListener('click', function(e) {
  const inp = document.getElementById('charge-fournisseur');
  const sug = document.getElementById('fournisseur-suggestions');
  if (!inp || !sug) return;
  if (e.target !== inp && !sug.contains(e.target)) {
    sug.innerHTML = '';
  }
});

window.autoCompleteFournisseurCharge = autoCompleteFournisseurCharge;
window.selectionnerFournisseurChargeParId = selectionnerFournisseurChargeParId;
window.ouvrirCreationFournisseurDepuisCharge = ouvrirCreationFournisseurDepuisCharge;

