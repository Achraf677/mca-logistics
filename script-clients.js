/**
 * MCA Logistics — Module Clients
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L65 (script.js d'origine)
function validerSIREN(siren) {
  const s = String(siren || '').replace(/\s+/g, '');
  if (!/^\d{9}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = parseInt(s[8 - i], 10);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

// L508 (script.js d'origine)
function renderFactureClientBlock(livraison, clientFiche) {
  const c = clientFiche || {};
  const nom = livraison.client || c.nom || 'Client';
  const adresse = c.adresse || '';
  const cp = c.cp || '';
  const ville = c.ville || '';
  const siren = livraison.clientSiren || c.siren || '';
  const tvaClient = livraison.clientTvaIntracom || c.tvaIntra || '';
  let html = '<div style="font-size:1rem;font-weight:700">' + planningEscapeHtml(nom) + '</div>';
  if (adresse) html += '<div style="font-size:.82rem;color:#4b5563;margin-top:4px">' + planningEscapeHtml(adresse) + '</div>';
  if (cp || ville) html += '<div style="font-size:.82rem;color:#4b5563">' + planningEscapeHtml((cp + ' ' + ville).trim()) + '</div>';
  if (siren) html += '<div style="font-size:.78rem;color:#6b7280;margin-top:4px">SIREN : ' + planningEscapeHtml(siren) + '</div>';
  if (tvaClient) html += '<div style="font-size:.78rem;color:#6b7280">TVA intracom : ' + planningEscapeHtml(tvaClient) + '</div>';
  return html;
}

// L767 (script.js d'origine)
function trouverClientParLivraison(livraison) {
  if (!livraison || typeof charger !== 'function') return null;
  try {
    const clients = charger('clients') || [];
    if (livraison.clientId) {
      const byId = clients.find(c => c && c.id === livraison.clientId);
      if (byId) return byId;
    }
    if (livraison.client) {
      const byName = clients.find(c => c && (c.nom || '').toLowerCase() === String(livraison.client).toLowerCase());
      if (byName) return byName;
    }
  } catch (e) {}
  return null;
}

// L4049 (script.js d'origine)
function getSupabaseClientSafe() {
  return window.DelivProSupabase && window.DelivProSupabase.getClient
    ? window.DelivProSupabase.getClient()
    : null;
}

// L5503 (script.js d'origine)
function afficherClientsDashboard() {
  const clientsAll = loadSafe('clients', []);
  const tb = document.getElementById('tb-clients');
  if (!tb) return;
  if (!clientsAll.length) { tb.innerHTML = emptyState('🧑‍💼','Aucun client','Enregistrez vos clients pour activer l\'auto-complétion.'); return; }
  // Filtre recherche (nom, contact, ville, SIREN, téléphone, email)
  const filtre = (document.getElementById('filtre-cl-search')?.value || '').trim().toLowerCase();
  const clients = filtre
    ? clientsAll.filter(c => [c.nom, c.prenom, c.contact, c.tel, c.email, c.adresse, c.ville, c.cp, c.siren]
        .filter(Boolean).join(' ').toLowerCase().includes(filtre))
    : clientsAll;
  if (!clients.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun résultat pour « ' + filtre + ' »</td></tr>'; return; }
  const livraisons = charger('livraisons');

  tb.innerHTML = clients.sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr')).map(c => {
    const livsC = livraisons.filter(l => l.client === c.nom || l.clientId === c.id);
    const caC = livsC.reduce((s,l)=>s + (typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0)), 0);
    const contact = (c.contact || c.prenom || '').trim();
    return `<tr>
      <td><button type="button" class="btn-link-inline" onclick="ouvrirHistoriqueClient('${c.id}')" style="font-weight:700">${c.nom}</button></td>
      <td>${contact||'—'}</td>
      <td>${c.tel||'—'}</td>
      <td style="font-size:.82rem">${c.adresse||'—'}</td>
      <td><strong>${euros(caC)}</strong><div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">${livsC.length} livraison${livsC.length>1?'s':''}</div></td>
      <td>${buildInlineActionsDropdown('Actions', [
        { icon:'📚', label:'Historique', action:`ouvrirHistoriqueClient('${c.id}')` },
        { icon:'✏️', label:'Modifier', action:`ouvrirEditClient('${c.id}')` },
        { icon:'📦', label:'Nouvelle livraison', action:`preFillLivraisonClient('${c.id}')` },
        { icon:'🗑️', label:'Supprimer', action:`supprimerClient('${c.id}')`, danger:true }
      ])}</td>
    </tr>`;
  }).join('');
}

// L6259 (script.js d'origine)
function afficherTopClients() {
  const livraisons = charger('livraisons');
  const clients    = loadSafe('clients', []);
  const cont       = document.getElementById('top-clients-list');
  if (!cont) return;

  // Agréger par client
  const stats = {};
  livraisons.forEach(l => {
    const nom = l.client;
    if (!stats[nom]) stats[nom] = { nom, ca:0, nb:0, impaye:0, derniere:'' };
    stats[nom].ca += l.prix || 0;
    stats[nom].nb++;
    if ((l.statutPaiement === 'en-attente' || !l.statutPaiement) && l.statut === 'livre') stats[nom].impaye += l.prix||0;
    if (!stats[nom].derniere || l.date > stats[nom].derniere) stats[nom].derniere = l.date;
  });

  const sorted = Object.values(stats).sort((a,b) => b.ca - a.ca).slice(0, 8);
  if (!sorted.length) { cont.innerHTML = '<div class="empty-illustrated"><div class="ei-icon">🧑‍💼</div><div class="ei-title">Aucun client</div></div>'; return; }

  const medals = ['🥇','🥈','🥉'];
  cont.innerHTML = sorted.map((c, i) => `
    <div class="client-score">
      <span class="client-score-rank">${medals[i] || (i+1)}</span>
      <div class="client-score-info">
        <div style="font-weight:600">${c.nom}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${c.nb} livraison(s) · Dernière : ${c.derniere||'—'}</div>
        ${c.impaye > 0 ? `<div style="font-size:.72rem;color:var(--red)">⚠️ ${euros(c.impaye)} impayé</div>` : ''}
      </div>
      <span class="client-score-ca">${euros(c.ca)}</span>
    </div>`).join('');
}

// L6517 (script.js d'origine)
function rechercheOuvrirClient(id) {
  if (!id) return;
  naviguerVers('clients');
  setTimeout(function() { ouvrirHistoriqueClient(id); }, 180);
}

// L6560 (script.js d'origine)
function getClientHistoriqueSnapshot(clientId) {
  const client = charger('clients').find(function(item) { return item.id === clientId; });
  if (!client) return null;
  const livraisons = charger('livraisons').filter(function(item) {
    return item.clientId === client.id || (item.client || '').trim().toLowerCase() === (client.nom || '').trim().toLowerCase();
  }).sort(function(a, b) {
    return new Date((b.datePaiement || b.date || '')) - new Date((a.datePaiement || a.date || ''));
  });
  const incidents = charger('incidents').filter(function(item) {
    return item.clientId === client.id || (item.client || item.clientNom || '').trim().toLowerCase() === (client.nom || '').trim().toLowerCase();
  }).sort(function(a, b) {
    return new Date((b.date || '')) - new Date((a.date || ''));
  });
  const impayes = livraisons.filter(function(item) { return getLivraisonStatutPaiement(item) !== 'payé'; });
  const payees = livraisons.filter(function(item) { return getLivraisonStatutPaiement(item) === 'payé'; });
  return {
    client: client,
    livraisons: livraisons,
    incidents: incidents,
    impayes: impayes,
    caHT: livraisons.reduce(function(sum, item) { return sum + getMontantHTLivraison(item); }, 0),
    caTTC: livraisons.reduce(function(sum, item) { return sum + (parseFloat(item.prix) || 0); }, 0),
    encaisseTTC: payees.reduce(function(sum, item) { return sum + (parseFloat(item.prix) || 0); }, 0),
    impayeTTC: impayes.reduce(function(sum, item) { return sum + (parseFloat(item.prix) || 0); }, 0)
  };
}

// L6591 (script.js d'origine)
function ouvrirHistoriqueClient(id) {
  const snapshot = getClientHistoriqueSnapshot(id);
  if (!snapshot) return;
  _clientHistoryCurrentId = id;
  const client = snapshot.client;
  const title = document.getElementById('client-history-title');
  const content = document.getElementById('client-history-content');
  if (title) title.textContent = client.nom || 'Client';
  if (!content) return;
  const lastPaiement = snapshot.livraisons.find(function(item) { return item.datePaiement; })?.datePaiement || '';
  content.innerHTML = ''
    + '<div class="kpi-grid" style="margin-bottom:18px">'
    +   '<div class="kpi-card green"><div class="kpi-label">CA HT cumulé</div><div class="kpi-value">' + euros(snapshot.caHT) + '</div></div>'
    +   '<div class="kpi-card blue"><div class="kpi-label">Encaissé TTC</div><div class="kpi-value">' + euros(snapshot.encaisseTTC) + '</div></div>'
    +   '<div class="kpi-card red"><div class="kpi-label">Impayé TTC</div><div class="kpi-value">' + euros(snapshot.impayeTTC) + '</div></div>'
    +   '<div class="kpi-card purple"><div class="kpi-label">Incidents</div><div class="kpi-value">' + snapshot.incidents.length + '</div></div>'
    + '</div>'
    + '<div class="card" style="margin-bottom:16px"><div class="modal-body">'
    +   '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">'
    +     '<div><div style="font-size:.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Contact</div><div style="font-weight:700">' + (client.contact || client.prenom || '—') + '</div></div>'
    +     '<div><div style="font-size:.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Téléphone</div><div style="font-weight:700">' + (client.tel || '—') + '</div></div>'
    +     '<div><div style="font-size:.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Email</div><div style="font-weight:700">' + (client.email || '—') + '</div></div>'
    +     '<div><div style="font-size:.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Dernier paiement</div><div style="font-weight:700">' + (lastPaiement ? formatDateExport(lastPaiement) : '—') + '</div></div>'
    +   '</div>'
    +   '<div style="margin-top:14px"><div style="font-size:.76rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Adresse habituelle</div><div style="font-weight:700">' + (client.adresse || '—') + '</div></div>'
    + '</div></div>'
    + '<div class="card" style="margin-bottom:16px"><div class="card-header"><h2>📦 Livraisons du client</h2></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>N° LIV</th><th>Date</th><th>Statut</th><th>Paiement</th><th>HT</th><th>TTC</th></tr></thead><tbody>'
    +   (snapshot.livraisons.length
          ? snapshot.livraisons.map(function(item) {
              return '<tr>'
                + '<td><strong>' + (item.numLiv || '—') + '</strong></td>'
                + '<td>' + formatDateExport(item.date) + '</td>'
                + '<td>' + (item.statut || '—') + '</td>'
                + '<td>' + (item.datePaiement ? 'Payé le ' + formatDateExport(item.datePaiement) : 'En attente') + '</td>'
                + '<td>' + euros(getMontantHTLivraison(item)) + '</td>'
                + '<td>' + euros(item.prix || 0) + '</td>'
                + '</tr>';
            }).join('')
          : '<tr><td colspan="6" class="empty-row">Aucune livraison pour ce client</td></tr>')
    + '</tbody></table></div></div>'
    + '<div class="card"><div class="card-header"><h2>🚨 Incidents & suivi</h2></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Gravité</th><th>Description</th><th>Statut</th></tr></thead><tbody>'
    +   (snapshot.incidents.length
          ? snapshot.incidents.map(function(item) {
              return '<tr>'
                + '<td>' + formatDateExport(item.date) + '</td>'
                + '<td>' + (item.gravite || '—') + '</td>'
                + '<td style="font-size:.84rem">' + (item.description || '—') + '</td>'
                + '<td>' + (item.statut || '—') + '</td>'
                + '</tr>';
            }).join('')
          : '<tr><td colspan="4" class="empty-row">Aucun incident enregistré pour ce client</td></tr>')
    + '</tbody></table></div></div>';
  openModal('modal-client-history');
}

// L6649 (script.js d'origine)
function collecterDonneesRGPDClient(clientId) {
  const client = (charger('clients') || []).find(function(c){ return c.id === clientId; });
  if (!client) return null;
  const nomNorm = String(client.nom || '').trim().toLowerCase();
  const matchNom = function(champ) { return String(champ || '').trim().toLowerCase() === nomNorm; };
  const livraisons = (charger('livraisons') || []).filter(function(l){
    return l.clientId === client.id || matchNom(l.client);
  });
  const factures = (loadSafe('factures_emises', []) || []).filter(function(f){
    return f.clientId === client.id || matchNom(f.client) || matchNom(f.clientNom);
  });
  const avoirs = (loadSafe('avoirs', []) || []).filter(function(a){
    return a.clientId === client.id || matchNom(a.client) || matchNom(a.clientNom);
  });
  const encaissements = (loadSafe('encaissements', []) || []).filter(function(e){
    return e.clientId === client.id || matchNom(e.client) || matchNom(e.clientNom);
  });
  const acomptes = (loadSafe('acomptes', []) || []).filter(function(a){
    return a.clientId === client.id || matchNom(a.client) || matchNom(a.clientNom);
  });
  const incidents = (charger('incidents') || []).filter(function(i){
    return i.clientId === client.id || matchNom(i.client) || matchNom(i.clientNom);
  });
  const relances = (loadSafe('relances', []) || []).filter(function(r){
    return r.clientId === client.id || matchNom(r.client) || matchNom(r.clientNom);
  });

  return {
    meta: {
      exportType: 'RGPD-art20-portabilite',
      dateExport: new Date().toISOString(),
      regulation: 'Règlement (UE) 2016/679 (RGPD) — article 20 : droit à la portabilité',
      format: 'JSON UTF-8',
      responsable: 'MCA Logistics',
      contactDPO: null,
      clientId: client.id,
      clientNom: client.nom || ''
    },
    donneesPersonnelles: {
      identifiant: client.id,
      nom: client.nom || '',
      prenom: client.prenom || '',
      contact: client.contact || '',
      telephone: client.tel || '',
      email: client.email || '',
      adresse: client.adresse || '',
      siret: client.siret || '',
      tvaIntracom: client.tvaIntracom || '',
      notesInternes: client.notes || '',
      creeLe: client.creeLe || '',
      majLe: client.majLe || ''
    },
    livraisons: livraisons,
    factures: factures,
    avoirs: avoirs,
    encaissements: encaissements,
    acomptes: acomptes,
    incidents: incidents,
    relances: relances,
    resumeFinancier: {
      nbLivraisons: livraisons.length,
      nbFactures: factures.length,
      caHT: Number((livraisons.reduce(function(s,l){ return s + getMontantHTLivraison(l); }, 0)).toFixed(2)),
      caTTC: Number((livraisons.reduce(function(s,l){ return s + (parseFloat(l.prix)||0); }, 0)).toFixed(2))
    }
  };
}

// L6722 (script.js d'origine)
function afficherClients() {
  if (typeof afficherClientsDashboard === 'function') return afficherClientsDashboard();
}

// L6740 (script.js d'origine)
function ajouterClient() {
  const nom         = document.getElementById('cl-nom')?.value.trim();
  const prenom      = document.getElementById('cl-prenom')?.value.trim() || '';
  const tel         = document.getElementById('cl-tel')?.value.trim();
  const email       = document.getElementById('cl-email')?.value.trim();
  const adresse     = document.getElementById('cl-adresse')?.value.trim();
  const cp          = document.getElementById('cl-cp')?.value.trim() || '';
  const ville       = document.getElementById('cl-ville')?.value.trim() || '';
  const type        = (document.querySelector('input[name="cl-type"]:checked')?.value) || 'pro';
  const siren       = (document.getElementById('cl-siren')?.value.trim() || '').replace(/\s+/g,'');
  const tvaIntra    = (document.getElementById('cl-tva-intra')?.value.trim() || '').replace(/\s+/g,'').toUpperCase();
  const emailFact   = document.getElementById('cl-email-fact')?.value.trim() || '';
  const delaiPay    = parseInt(document.getElementById('cl-delai-paiement')?.value, 10) || 30;
  const notes       = document.getElementById('cl-notes')?.value.trim() || '';
  if (!nom) { afficherToast('⚠️ Nom obligatoire','error'); return; }
  if (type === 'pro' && siren && !/^\d{9}$/.test(siren)) { afficherToast('⚠️ SIREN invalide (9 chiffres)','error'); return; }
  // BUG-010 fix : validation checksum TVA intracom FR (art. 289 II CGI)
  if (tvaIntra) {
    const __validTva = validerTVAIntracomFR(tvaIntra);
    if (!__validTva.valid) { afficherToast('⚠️ TVA intracom invalide : ' + (__validTva.message || 'format incorrect'), 'error'); return; }
  }
  const clients = loadSafe('clients', []);
  if (clients.find(c=>c.nom.toLowerCase()===nom.toLowerCase())) { afficherToast('⚠️ Client déjà existant','error'); return; }
  clients.push({
    id: genId(), nom, prenom, contact: prenom, tel, email, adresse,
    cp, ville, type, siren, tvaIntra, emailFact, delaiPaiementJours: delaiPay, notes,
    creeLe: new Date().toISOString()
  });
  localStorage.setItem('clients', JSON.stringify(clients));
  // Re-synchroniser le form livraison si création depuis modale livraison
  const venantDeLivraison = window.__livClientContextNom !== undefined;
  if (venantDeLivraison) {
    const livClient = document.getElementById('liv-client');
    if (livClient) livClient.value = nom;
    const livSiren = document.getElementById('liv-client-siren');
    if (livSiren && siren) livSiren.value = siren;
    const livZone = document.getElementById('liv-zone');
    if (livZone && adresse && !livZone.value) livZone.value = adresse;
    const livDep = document.getElementById('liv-depart');
    if (livDep && adresse && !livDep.value) livDep.value = adresse;
    delete window.__livClientContextNom;
  }
  ['cl-nom','cl-prenom','cl-tel','cl-email','cl-adresse','cl-cp','cl-ville','cl-siren','cl-tva-intra','cl-email-fact','cl-notes']
    .forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const delaiEl = document.getElementById('cl-delai-paiement'); if (delaiEl) delaiEl.value = '30';
  const typeRadio = document.querySelector('input[name="cl-type"][value="pro"]'); if (typeRadio) typeRadio.checked = true;
  if (window.toggleChampsClientPro) window.toggleChampsClientPro(false);
  const warnBox = document.getElementById('cl-doublons-warning'); if (warnBox) { warnBox.style.display='none'; warnBox.innerHTML=''; }
  closeModal('modal-client');
  if (!venantDeLivraison) afficherClients();
  ajouterEntreeAudit('Création client', nom + (email ? ' · ' + email : '') + (siren ? ' · SIREN ' + siren : ''));
  afficherToast(venantDeLivraison
    ? '✅ Client « ' + nom + ' » créé et lié à la livraison en cours'
    : '✅ Client ajouté');
}

// L6796 (script.js d'origine)
async function supprimerClient(id) {
  const client = charger('clients').find(function(item) { return item.id === id; });
  if (!client) return;
  // Vérification des livraisons liées avant suppression
  const livraisons = charger('livraisons');
  const livsLiees = livraisons.filter(l => l.clientId === id || l.client === client.nom);
  let message = 'Supprimer le client « ' + (client.nom || 'sans nom') + ' » ?';
  if (livsLiees.length) {
    message += '\n\n⚠️ Ce client est lié à ' + livsLiees.length + ' livraison'
            + (livsLiees.length > 1 ? 's' : '') + '. '
            + 'Elles seront conservées (le nom du client reste affiché) mais la fiche client disparaît.';
  }
  const _ok6 = await confirmDialog(message, {titre:'Supprimer le client', icone:'🧑‍💼', btnLabel:'Supprimer', danger:true});
  if (!_ok6) return;
  const clients = loadSafe('clients', []).filter(c=>c.id!==id);
  localStorage.setItem('clients', JSON.stringify(clients));
  afficherClients();
  ajouterEntreeAudit('Suppression client', (client.nom || 'Client') + ' supprimé' + (livsLiees.length ? ' (' + livsLiees.length + ' livraison(s) orpheline(s))' : ''));
  afficherToast('🗑️ Client supprimé');
}

// L6817 (script.js d'origine)
function preFillLivraisonClient(id) {
  const c = loadSafe('clients', []).find(x=>x.id===id);
  if (!c) return;
  naviguerVers('livraisons');
  setTimeout(()=>{
    openModal('modal-livraison');
    // Utilise la fonction centralisée pour pré-remplir tous les champs
    setTimeout(()=>{
      if (typeof selectionnerClientLivraisonParId === 'function') {
        selectionnerClientLivraisonParId(c.id);
      }
    }, 100);
  },100);
}

// L6833 (script.js d'origine)
function autoCompleteClient(val) {
  const sug = document.getElementById('client-suggestions');
  if (!sug) return;
  const terme = (val || '').trim();
  if (terme.length < 2) {
    sug.innerHTML = '';
    // Si l'utilisateur efface le nom, on délie le client précédemment sélectionné
    window.__livSelectedClientId = null;
    return;
  }
  const clients = loadSafe('clients', []);
  const termeLc = terme.toLowerCase();
  const matches = clients.filter(c => (c.nom || '').toLowerCase().includes(termeLc)).slice(0, 5);
  const matchExact = clients.some(c => (c.nom || '').toLowerCase() === termeLc);
  // On passe maintenant l'ID complet du client à selectionnerClientLivraison
  // (au lieu de juste nom+adresse) pour pouvoir lier proprement TOUS les champs.
  const htmlMatches = matches.map(c => {
    const nomHtml = escapeHtml(c.nom || '');
    const adrHtml = escapeHtml(c.adresse || '');
    const idAttr = escapeAttr(c.id || '');
    return `<div onclick="selectionnerClientLivraisonParId('${idAttr}')" style="padding:7px 12px;cursor:pointer;font-size:.88rem;border-bottom:1px solid var(--border)" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">${nomHtml}${adrHtml?`<span style='color:var(--text-muted);font-size:.78rem;margin-left:6px'>${adrHtml}</span>`:''}</div>`;
  }).join('');
  const htmlCreate = matchExact ? '' : `<div onclick="ouvrirCreationClientDepuisLivraison('${escapeAttr(terme)}')" style="padding:9px 12px;cursor:pointer;font-size:.88rem;color:#4ade80;font-weight:600;background:rgba(74,222,128,.08);border-top:1px solid var(--border)" onmouseover="this.style.background='rgba(74,222,128,.18)'" onmouseout="this.style.background='rgba(74,222,128,.08)'">+ Créer « ${escapeHtml(terme)} » comme nouveau client</div>`;
  sug.innerHTML = htmlMatches + htmlCreate;
}

// L6862 (script.js d'origine)
function selectionnerClientLivraisonParId(clientId) {
  const c = loadSafe('clients', []).find(x => x && x.id === clientId);
  if (!c) return;
  const $ = (id) => document.getElementById(id);
  if ($('liv-client'))       $('liv-client').value = c.nom || '';
  if ($('liv-client-siren')) $('liv-client-siren').value = c.siren || '';
  // Adresse → zone géographique + champ caché départ
  if (c.adresse) {
    const adrComplete = [c.adresse, ((c.cp || '') + ' ' + (c.ville || '')).trim()].filter(Boolean).join(', ');
    if ($('liv-zone'))   $('liv-zone').value = adrComplete;
    if ($('liv-depart')) $('liv-depart').value = adrComplete;
  }
  if ($('liv-arrivee')) $('liv-arrivee').value = '';
  // Mémorise l'ID pour ajouterLivraison (lien fiable, écrase le match par nom)
  window.__livSelectedClientId = c.id;
  window.__livSelectedClientTva = c.tvaIntra || '';
  window.__livSelectedClientPays = c.pays || 'FR';
  // Reset les suggestions
  const sug = document.getElementById('client-suggestions');
  if (sug) sug.innerHTML = '';
}

// L6886 (script.js d'origine)
function selectionnerClientLivraison(nom, adresse) {
  const c = loadSafe('clients', []).find(x => x && (x.nom || '').toLowerCase() === String(nom || '').toLowerCase());
  if (c) return selectionnerClientLivraisonParId(c.id);
  // Pas de match → comportement legacy minimal
  const livClient = document.getElementById('liv-client');
  if (livClient) livClient.value = nom;
  const livZone = document.getElementById('liv-zone');
  if (livZone && adresse) livZone.value = adresse;
  const livDep = document.getElementById('liv-depart');
  if (livDep && adresse) livDep.value = adresse;
  const sug = document.getElementById('client-suggestions');
  if (sug) sug.innerHTML = '';
}

// L6900 (script.js d'origine)
function ouvrirCreationClientDepuisLivraison(nom) {
  window.__livClientContextNom = nom;
  const sug = document.getElementById('client-suggestions');
  if (sug) sug.innerHTML = '';
  openModal('modal-client');
  setTimeout(function() {
    const clNom = document.getElementById('cl-nom');
    if (clNom) {
      clNom.value = nom;
      try { clNom.focus(); } catch (_) {}
      if (typeof window.detecterDoublonsClient === 'function') {
        try { window.detecterDoublonsClient(false); } catch (_) {}
      }
    }
  }, 80);
}

// L8353 (script.js d'origine)
async function ouvrirEditClient(id) {
  const c = charger('clients').find(x=>x.id===id);
  if (!c) return;
  await actualiserVerrousEditionDistance();
  const lockResult = prendreVerrouEdition('client', id, c.nom || 'Client');
  if (!lockResult.ok) {
    afficherToast(`⚠️ Client en cours de modification par ${lockResult.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  _editClientId = id;
  document.getElementById('edit-cl-id').value        = id;
  document.getElementById('edit-cl-nom').value       = c.nom||'';
  document.getElementById('edit-cl-prenom').value    = c.prenom||'';
  document.getElementById('edit-cl-tel').value       = c.tel||'';
  document.getElementById('edit-cl-email').value     = c.email||'';
  document.getElementById('edit-cl-adresse').value   = c.adresse||'';
  const setV = (id,v)=>{ const e=document.getElementById(id); if(e) e.value = v||''; };
  setV('edit-cl-cp',         c.cp);
  setV('edit-cl-ville',      c.ville);
  setV('edit-cl-siren',      c.siren);
  setV('edit-cl-tva-intra',  c.tvaIntra);
  setV('edit-cl-email-fact', c.emailFact);
  setV('edit-cl-delai-paiement', (c.delaiPaiementJours != null ? String(c.delaiPaiementJours) : '30'));
  setV('edit-cl-notes',      c.notes);
  const typeVal = c.type || 'pro';
  const tR = document.querySelector('input[name="edit-cl-type"][value="'+typeVal+'"]'); if (tR) tR.checked = true;
  if (window.toggleChampsClientPro) window.toggleChampsClientPro(true);
  document.getElementById('modal-edit-client').classList.add('open');
  afficherAlerteVerrouModal('modal-edit-client', '');
}

// L8384 (script.js d'origine)
function confirmerEditClient() {
  surveillerConflitsEditionActifs();
  const id      = document.getElementById('edit-cl-id').value;
  const lockState = verifierVerrouEdition('client', id);
  if (!lockState.ok) {
    afficherToast(`⚠️ Ce client est verrouillé par ${lockState.lock.actorLabel || 'un autre admin'}`, 'error');
    return;
  }
  const nom        = document.getElementById('edit-cl-nom').value.trim();
  const prenom     = document.getElementById('edit-cl-prenom').value.trim();
  const tel        = document.getElementById('edit-cl-tel').value.trim();
  const email      = document.getElementById('edit-cl-email').value.trim();
  const adresse    = document.getElementById('edit-cl-adresse').value.trim();
  const cp         = document.getElementById('edit-cl-cp')?.value.trim() || '';
  const ville      = document.getElementById('edit-cl-ville')?.value.trim() || '';
  const type       = (document.querySelector('input[name="edit-cl-type"]:checked')?.value) || 'pro';
  const siren      = (document.getElementById('edit-cl-siren')?.value.trim() || '').replace(/\s+/g,'');
  const tvaIntra   = (document.getElementById('edit-cl-tva-intra')?.value.trim() || '').replace(/\s+/g,'').toUpperCase();
  const emailFact  = document.getElementById('edit-cl-email-fact')?.value.trim() || '';
  const delaiPay   = parseInt(document.getElementById('edit-cl-delai-paiement')?.value, 10) || 30;
  const notes      = document.getElementById('edit-cl-notes')?.value.trim() || '';
  if (!nom) { afficherToast('⚠️ Nom obligatoire','error'); return; }
  if (type === 'pro' && siren && !/^\d{9}$/.test(siren)) { afficherToast('⚠️ SIREN invalide (9 chiffres)','error'); return; }
  // BUG-010 fix : validation checksum TVA intracom FR (art. 289 II CGI)
  if (tvaIntra) {
    const __validTva = validerTVAIntracomFR(tvaIntra);
    if (!__validTva.valid) { afficherToast('⚠️ TVA intracom invalide : ' + (__validTva.message || 'format incorrect'), 'error'); return; }
  }
  const clients = charger('clients');
  const idx = clients.findIndex(c=>c.id===id);
  let nbLivsRenommees = 0;
  if (idx>-1) {
    const ancienNom = clients[idx].nom;
    const ancienSiren = clients[idx].siren;
    clients[idx].nom=nom; clients[idx].prenom=prenom; clients[idx].tel=tel;
    clients[idx].contact=prenom; clients[idx].email=email; clients[idx].adresse=adresse;
    clients[idx].cp=cp; clients[idx].ville=ville;
    clients[idx].type=type; clients[idx].siren=siren; clients[idx].tvaIntra=tvaIntra;
    clients[idx].emailFact=emailFact; clients[idx].delaiPaiementJours=delaiPay; clients[idx].notes=notes;
    sauvegarder('clients', clients);
    // Propage le nouveau nom + SIREN aux livraisons liées via clientId.
    // Évite que le filtre `l.client === c.nom` casse le calcul Total CA et
    // l'historique client après un renommage.
    if (ancienNom !== nom || ancienSiren !== siren) {
      const livraisons = charger('livraisons');
      let dirty = false;
      livraisons.forEach(l => {
        if (l.clientId === id) {
          if (ancienNom !== nom && l.client === ancienNom) { l.client = nom; nbLivsRenommees++; dirty = true; }
          if (ancienSiren !== siren) { l.clientSiren = siren; dirty = true; }
        }
      });
      if (dirty) sauvegarder('livraisons', livraisons);
    }
  }
  closeModal('modal-edit-client');
  _editClientId = null;
  afficherClientsDashboard();
  ajouterEntreeAudit('Modification client', nom + (email ? ' · ' + email : '') + (nbLivsRenommees ? ' · ' + nbLivsRenommees + ' livraison(s) propagée(s)' : ''));
  afficherToast(nbLivsRenommees ? '✅ Client mis à jour · ' + nbLivsRenommees + ' livraison(s) synchronisée(s)' : '✅ Client mis à jour');
}

