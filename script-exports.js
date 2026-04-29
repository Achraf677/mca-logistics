/**
 * MCA Logistics — Module Exports
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L413 (script.js d'origine)
function exporterJournalAuditCSV() {
  const logs = charger('audit_log').slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  exporterCSV(logs, [
    { label:'Date', get:function(r){ return formatDateHeureExport(r.date); } },
    { label:'Admin', get:function(r){ return r.admin || ''; } },
    { label:'Action', get:function(r){ return r.action || ''; } },
    { label:'Détail', get:function(r){ return r.detail || ''; } }
  ], 'journal-audit-mca-logistics.csv');
  ajouterEntreeAudit('Export audit', 'Export CSV du journal d’audit');
}

// L1616 (script.js d'origine)
function fermerHeuresRapportsMenu() {
  document.getElementById('heures-rapports-menu')?.classList.remove('open');
}

// L1619 (script.js d'origine)
function toggleHeuresRapportsMenu(event) {
  event?.stopPropagation();
  const menu = document.getElementById('heures-rapports-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}

// L6117 (script.js d'origine)
function exporterCSV(data, colonnes, nomFichier) {
  const sep = ';';
  const header = colonnes.map(c => csvCelluleSecurisee(c.label, sep)).join(sep);
  const rows = data.map(row =>
    colonnes.map(c => csvCelluleSecurisee(c.get(row) ?? '', sep)).join(sep)
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM pour Excel français
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// L6167 (script.js d'origine)
function exporterLivraisons() {
  const livraisons = getLivraisonsFiltresActifs();
  const deb = document.getElementById('filtre-date-debut')?.value || '';
  const fin = document.getElementById('filtre-date-fin')?.value || '';
  exporterCSV(livraisons, [
    { label: 'N° LIV',      get: l => l.numLiv||'' },
    { label: 'Date',         get: l => l.date||'' },
    { label: 'Client',       get: l => l.client||'' },
    { label: 'Départ',       get: l => l.depart||'' },
    { label: 'Arrivée',      get: l => l.arrivee||'' },
    { label: 'Distance km',  get: l => l.distance||'' },
    { label: 'Prix €',       get: l => l.prix||'' },
    { label: 'Chauffeur',    get: l => l.chaufNom||'' },
    { label: 'Véhicule',     get: l => l.vehNom||'' },
    { label: 'Statut',       get: l => l.statut||'' },
    { label: 'Paiement',     get: l => l.statutPaiement||'' },
    { label: 'Date paiement',get: l => l.datePaiement||'' },
    { label: 'Mode paiement',get: l => l.modePaiement||'' },
  ], `livraisons_${deb || aujourdhui()}${fin ? '_au_' + fin : ''}.csv`);
  afficherToast('✅ Export CSV téléchargé');
}

// L6189 (script.js d'origine)
function exporterCharges() {
  const charges = charger('charges').sort((a,b)=>new Date(b.date)-new Date(a.date));
  exporterCSV(charges, [
    { label:'Date',        get:c=>c.date||'' },
    { label:'Catégorie',   get:c=>c.categorie||'' },
    { label:'Description', get:c=>c.description||'' },
    { label:'Véhicule',    get:c=>c.vehNom||'' },
    { label:'Montant €',   get:c=>c.montant?parseFloat(c.montant).toFixed(2):'' },
  ], `charges_${aujourdhui()}.csv`);
  afficherToast('✅ Export charges CSV téléchargé');
}

// L6204 (script.js d'origine)
function genererRapportMensuel() {
  const auj    = new Date();
  const mois   = auj.toLocalISOMonth();
  const moisLabel = auj.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
  const params = getEntrepriseExportParams();
  const nom    = params.nom;

  const livraisons = charger('livraisons').filter(l => (l.date||'').startsWith(mois));
  const carburant  = charger('carburant').filter(p => (p.date||'').startsWith(mois));
  const salaries   = charger('salaries');

  const caTotal    = livraisons.reduce((s,l)=>s+(l.prix||0), 0);
  const carbTotal  = carburant.reduce((s,p)=>s+(p.total||0), 0);
  const kmTotal    = salaries.reduce((s,sal)=>{
    const entrees = charger('km_sal_'+sal.id).filter(e=>(e.date||'').startsWith(mois));
    return s + entrees.reduce((ss,e)=>ss+(e.distance||0),0);
  }, 0);
  const benefice   = caTotal - carbTotal;
  const livrees    = livraisons.filter(l=>l.statut==='livre').length;
  const enAttente  = livraisons.filter(l=>l.statut==='en-attente').length;
  const dateExp    = formatDateHeureExport(auj);

  // Stats par chauffeur
  const statsChauff = {};
  livraisons.forEach(l => {
    if (!l.chaufNom) return;
    if (!statsChauff[l.chaufNom]) statsChauff[l.chaufNom] = { livs:0, ca:0 };
    statsChauff[l.chaufNom].livs++;
    statsChauff[l.chaufNom].ca += l.prix||0;
  });

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">

    <!-- EN-TÊTE -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:3px solid #f5a623;margin-bottom:28px">
      <div>
        <div style="font-size:1.5rem;font-weight:800;color:#f5a623">${nom}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Rapport d'activité</div>
        <div style="font-size:1.2rem;font-weight:800;text-transform:capitalize">${moisLabel}</div>
      </div>
    </div>
    ${renderBlocInfosEntreprise(params)}

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
      ${[
        ['💶 CA du mois', new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(caTotal), '#f5a623'],
        ['📦 Livraisons', livraisons.length + ' total', '#4f8ef7'],
        ['⛽ Carburant',  new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(carbTotal), '#e74c3c'],
        ['💰 Bénéfice',  new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(benefice), benefice>=0?'#2ecc71':'#e74c3c'],
      ].map(([label, value, color]) => `
        <div style="background:#f8f9fc;border-radius:10px;padding:14px;text-align:center;border-top:3px solid ${color}">
          <div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${label}</div>
          <div style="font-size:1.15rem;font-weight:800;color:${color}">${value}</div>
        </div>`).join('')}
    </div>

    <!-- STATUTS LIVRAISONS -->
    <div style="background:#f8f9fc;border-radius:10px;padding:16px;margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:12px">Statuts des livraisons</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><span style="background:rgba(46,204,113,.15);color:#2ecc71;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:600">✅ Livré : ${livrees}</span></div>
        <div><span style="background:rgba(245,166,35,.15);color:#f5a623;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:600">⏳ En attente : ${enAttente}</span></div>
        <div><span style="background:rgba(52,152,219,.15);color:#4f8ef7;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:600">🚐 En cours : ${livraisons.filter(l=>l.statut==='en-cours').length}</span></div>
      </div>
    </div>

    <!-- KM + CARBURANT -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:#f8f9fc;border-radius:10px;padding:16px">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Kilométrage total</div>
        <div style="font-size:1.4rem;font-weight:800">${new Intl.NumberFormat('fr-FR').format(Math.round(kmTotal))} km</div>
        <div style="font-size:.78rem;color:#9ca3af;margin-top:4px">Tous chauffeurs confondus</div>
      </div>
      <div style="background:#f8f9fc;border-radius:10px;padding:16px">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px">Coût carburant</div>
        <div style="font-size:1.4rem;font-weight:800">${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(carbTotal)}</div>
        <div style="font-size:.78rem;color:#9ca3af;margin-top:4px">${carburant.length} plein(s) ce mois</div>
      </div>
    </div>

    <!-- STATS PAR CHAUFFEUR -->
    ${Object.keys(statsChauff).length ? `
    <div style="margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:12px">Performance par chauffeur</div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:9px 12px;text-align:left;font-weight:600;color:#6b7280">Chauffeur</th>
          <th style="padding:9px 12px;text-align:right;font-weight:600;color:#6b7280">Livraisons</th>
          <th style="padding:9px 12px;text-align:right;font-weight:600;color:#6b7280">CA généré</th>
        </tr></thead>
        <tbody>${Object.entries(statsChauff).sort((a,b)=>b[1].ca-a[1].ca).map(([nom,s],i) => `
          <tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}">
            <td style="padding:9px 12px;font-weight:500">${nom}</td>
            <td style="padding:9px 12px;text-align:right">${s.livs}</td>
            <td style="padding:9px 12px;text-align:right;font-weight:700;color:#f5a623">${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(s.ca)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- PIED DE PAGE -->
    <div style="border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
      <span>${nom} — Page 1/1</span>
      <span>${dateExp}</span>
      <span>${params.tel || params.email || params.siret || ''}</span>
    </div>
  </div>`;

  const win = ouvrirPopupSecure('', '_blank', 'width=850,height=950');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Rapport ${moisLabel} — ${nom}</title>
    <style>body{margin:0;padding:20px;background:#fff} @page{margin:12mm} @media print{body{padding:0}}</style>
    </head><body>${html}
    <script>setTimeout(()=>{window.print();},400)<\/script>
    </body></html>`);
  win.document.close();
  afficherToast('📄 Rapport mensuel généré');
}

// L6637 (script.js d'origine)
function exporterHistoriqueFournisseursCSV() {
  const fournisseurs = charger('fournisseurs');
  if (!fournisseurs.length) { afficherToast('Aucun fournisseur à exporter', 'info'); return; }
  const headers = ['Nom', 'Contact', 'Téléphone', 'Email', 'Adresse', 'CP', 'Ville', 'SIREN', 'TVA Intracom', 'IBAN', 'Notes'];
  const rows = fournisseurs.map(f => [f.nom, f.contact || f.prenom, f.tel, f.email, f.adresse, f.cp, f.ville, f.siren, f.tvaIntra, f.iban, f.notes].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  const csv = headers.map(h => '"' + h + '"').join(',') + '\n' + rows.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fournisseurs_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  afficherToast('📥 Export CSV fournisseurs');
}

// L6651 (script.js d'origine)
function genererRapportFournisseurs() {
  const fournisseurs = charger('fournisseurs');
  if (!fournisseurs.length) { afficherToast('Aucun fournisseur à exporter', 'info'); return; }
  const charges = charger('charges');
  const params = (typeof getEntrepriseExportParams === 'function') ? getEntrepriseExportParams() : {};
  const dateExp = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const esc = (typeof planningEscapeHtml === 'function') ? planningEscapeHtml : (v => String(v || ''));
  const lignes = fournisseurs.map(f => {
    const chargesF = charges.filter(c => c.fournisseurId === f.id || c.fournisseur === f.nom);
    const total = chargesF.reduce((s, c) => s + (parseFloat(c.montant) || 0), 0);
    return { f, nb: chargesF.length, total };
  }).sort((a, b) => b.total - a.total);
  const totalGlobal = lignes.reduce((s, L) => s + L.total, 0);
  const meta = fournisseurs.length + ' fournisseur(s) · ' + lignes.reduce((s, L) => s + L.nb, 0) + ' charge(s)';
  const rows = lignes.map(L => `<tr>
    <td style="padding:7px 10px;font-weight:600">${esc(L.f.nom || '')}${L.f.siren ? '<div style="font-size:.72rem;color:#9ca3af">SIREN ' + esc(L.f.siren) + '</div>' : ''}</td>
    <td style="padding:7px 10px;font-size:.82rem">${esc(L.f.contact || L.f.prenom || '—')}${L.f.tel ? '<div style="color:#6b7280">' + esc(L.f.tel) + '</div>' : ''}</td>
    <td style="padding:7px 10px;font-size:.78rem;color:#6b7280">${esc([L.f.adresse, ((L.f.cp || '') + ' ' + (L.f.ville || '')).trim()].filter(Boolean).join(' · ') || '—')}</td>
    <td style="padding:7px 10px;text-align:right">${L.nb}</td>
    <td style="padding:7px 10px;text-align:right;font-weight:700">${euros(L.total)}</td>
  </tr>`).join('');
  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#111827">'
    + construireEnteteExport(params, 'Carnet fournisseurs', '', dateExp, meta)
    + '<table style="width:100%;border-collapse:collapse;font-size:.82rem">'
    + '<thead><tr style="background:#f3f4f6;text-align:left">'
    +   '<th style="padding:8px 10px">Fournisseur</th>'
    +   '<th style="padding:8px 10px">Contact</th>'
    +   '<th style="padding:8px 10px">Adresse</th>'
    +   '<th style="padding:8px 10px;text-align:right">Charges</th>'
    +   '<th style="padding:8px 10px;text-align:right">Total dépensé</th>'
    + '</tr></thead><tbody>' + rows + '</tbody>'
    + '<tfoot><tr style="background:#fef3c7;font-weight:700"><td colspan="4" style="padding:8px 10px">TOTAL</td><td style="padding:8px 10px;text-align:right">' + euros(totalGlobal) + '</td></tr></tfoot>'
    + '</table></div>';
  if (typeof ouvrirFenetreImpression === 'function') ouvrirFenetreImpression('Carnet fournisseurs', html, 'width=1200,height=820');
  if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('Rapport fournisseurs', fournisseurs.length + ' fournisseur(s)');
}

// L7231 (script.js d'origine)
function exporterRecapHeures() {
  const range = getHeuresPeriodeRange();
  const contexteHeures = construireContexteHeures(range);
  const salaries = charger('salaries');
  const data = salaries.map(s => {
    const { planifiees, details } = calculerHeuresSalarieSemaine(s.id, contexteHeures);
    return { nom: s.nom, poste: s.poste||'', numero: s.numero, planifiees, details };
  });
  exporterCSV(data, [
    { label:'Nom', get:d=>d.nom },
    { label:'Poste', get:d=>d.poste },
    { label:'N° Salarié', get:d=>d.numero },
    { label: range.mode === 'mois' ? 'H/mois' : 'H/semaine', get:d=>d.planifiees.toFixed(1) },
    { label:'Détail', get:d=>d.details.map(j=>`${j.jour.substring(0,3)} ${j.date}:${j.duree.toFixed(1)}h`).join(' ') },
  ], `recap_heures_${range.debut}_${range.fin}.csv`);
  afficherToast('✅ Export heures téléchargé');
}

// L8224 (script.js d'origine)
function genererRapportClients() {
  // Rapport PDF du carnet clients : stats globales + ventilation par client.
  // Utilise construireEnteteExport pour le header unifié.
  var clients = charger('clients');
  if (!clients.length) {
    if (typeof afficherToast === 'function') afficherToast('Aucun client à exporter', 'info');
    return;
  }
  var livraisons = charger('livraisons');
  var paiements = (typeof charger === 'function') ? charger('paiements') || [] : [];
  var params = (typeof getEntrepriseExportParams === 'function') ? getEntrepriseExportParams() : {};
  var dateExp = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  var esc = (typeof planningEscapeHtml === 'function') ? planningEscapeHtml : function(v){ return String(v||''); };

  var lignes = clients.map(function(c) {
    var livsC = livraisons.filter(function(l) { return l.client === c.nom || l.clientId === c.id; });
    var caHT = livsC.reduce(function(s, l) { return s + (typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0)); }, 0);
    var caTTC = livsC.reduce(function(s, l) { return s + (parseFloat(l.prix) || 0); }, 0);
    var paye = livsC.reduce(function(s, l) { return s + ((l.statutPaiement === 'payé') ? (parseFloat(l.prix) || 0) : 0); }, 0);
    var attente = caTTC - paye;
    return { c: c, nb: livsC.length, caHT: caHT, caTTC: caTTC, paye: paye, attente: attente };
  }).sort(function(a, b) { return b.caTTC - a.caTTC; });

  var totalNb = lignes.reduce(function(s, l) { return s + l.nb; }, 0);
  var totalHT = lignes.reduce(function(s, l) { return s + l.caHT; }, 0);
  var totalTTC = lignes.reduce(function(s, l) { return s + l.caTTC; }, 0);
  var totalPaye = lignes.reduce(function(s, l) { return s + l.paye; }, 0);
  var totalAttente = lignes.reduce(function(s, l) { return s + l.attente; }, 0);
  var clientsActifs = lignes.filter(function(l) { return l.nb > 0; }).length;

  var meta = clients.length + ' client(s) · ' + clientsActifs + ' actif(s) · ' + totalNb + ' livraison(s)';

  var blocStats =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">' +
      '<div style="padding:12px;background:#f3f4f6;border-radius:8px"><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase">Clients</div><div style="font-size:1.15rem;font-weight:800;color:#111827">' + clients.length + '</div></div>' +
      '<div style="padding:12px;background:#ecfdf5;border-radius:8px"><div style="font-size:.7rem;color:#065f46;text-transform:uppercase">CA HT total</div><div style="font-size:1.15rem;font-weight:800;color:#065f46">' + euros(totalHT) + '</div></div>' +
      '<div style="padding:12px;background:#fff7ed;border-radius:8px"><div style="font-size:.7rem;color:#9a3412;text-transform:uppercase">Encaissé TTC</div><div style="font-size:1.15rem;font-weight:800;color:#9a3412">' + euros(totalPaye) + '</div></div>' +
      '<div style="padding:12px;background:#fef2f2;border-radius:8px"><div style="font-size:.7rem;color:#991b1b;text-transform:uppercase">En attente TTC</div><div style="font-size:1.15rem;font-weight:800;color:#991b1b">' + euros(totalAttente) + '</div></div>' +
    '</div>';

  var rows = lignes.map(function(L) {
    var c = L.c;
    var contact = (c.contact || c.prenom || '').trim();
    var addr = [c.adresse, ((c.cp || '') + ' ' + (c.ville || '')).trim()].filter(Boolean).join(' · ');
    return '<tr>' +
      '<td style="padding:7px 10px;font-weight:600">' + esc(c.nom || '') + (c.siren ? '<div style="font-size:.72rem;color:#9ca3af">SIREN ' + esc(c.siren) + '</div>' : '') + '</td>' +
      '<td style="padding:7px 10px;font-size:.82rem">' + esc(contact || '—') + (c.tel ? '<div style="color:#6b7280">' + esc(c.tel) + '</div>' : '') + '</td>' +
      '<td style="padding:7px 10px;font-size:.78rem;color:#6b7280">' + esc(addr || '—') + '</td>' +
      '<td style="padding:7px 10px;text-align:right">' + L.nb + '</td>' +
      '<td style="padding:7px 10px;text-align:right">' + euros(L.caHT) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;font-weight:700">' + euros(L.caTTC) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;color:#065f46">' + euros(L.paye) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;color:' + (L.attente > 0 ? '#92400e' : '#9ca3af') + '">' + euros(L.attente) + '</td>' +
    '</tr>';
  }).join('');

  var tableau =
    '<h3 style="font-size:.9rem;font-weight:700;margin:20px 0 8px">Détail par client</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.78rem">' +
      '<thead><tr style="background:#f3f4f6;text-align:left">' +
        '<th style="padding:8px 10px">Client</th>' +
        '<th style="padding:8px 10px">Contact</th>' +
        '<th style="padding:8px 10px">Adresse</th>' +
        '<th style="padding:8px 10px;text-align:right">Livs</th>' +
        '<th style="padding:8px 10px;text-align:right">CA HT</th>' +
        '<th style="padding:8px 10px;text-align:right">CA TTC</th>' +
        '<th style="padding:8px 10px;text-align:right">Encaissé</th>' +
        '<th style="padding:8px 10px;text-align:right">En attente</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr style="background:#fef3c7;font-weight:700">' +
        '<td colspan="3" style="padding:8px 10px">TOTAUX</td>' +
        '<td style="padding:8px 10px;text-align:right">' + totalNb + '</td>' +
        '<td style="padding:8px 10px;text-align:right">' + euros(totalHT) + '</td>' +
        '<td style="padding:8px 10px;text-align:right">' + euros(totalTTC) + '</td>' +
        '<td style="padding:8px 10px;text-align:right">' + euros(totalPaye) + '</td>' +
        '<td style="padding:8px 10px;text-align:right">' + euros(totalAttente) + '</td>' +
      '</tr></tfoot>' +
    '</table>';

  var html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#111827">' +
      construireEnteteExport(params, 'Carnet clients', '', dateExp, meta) +
      blocStats +
      tableau +
      '<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;font-size:.72rem;color:#9ca3af">Document généré par ' + esc(params.nom || 'MCA LOGISTICS') + ' le ' + esc(dateExp) + '</div>' +
    '</div>';

  if (typeof ouvrirFenetreImpression === 'function') {
    ouvrirFenetreImpression('Carnet clients — ' + (params.nom || 'MCA LOGISTICS'), html, 'width=1200,height=820');
  } else {
    var w = window.open('', '_blank', 'width=1200,height=820');
    if (w) { w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Carnet clients</title></head><body>' + html + '</body></html>'); w.document.close(); }
  }
  if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('Rapport clients', clients.length + ' client(s)');
}

// L8321 (script.js d'origine)
function exporterHistoriqueClientsCSV() {
  const clients = charger('clients');
  const rows = clients.map(function(client) {
    const snapshot = getClientHistoriqueSnapshot(client.id);
    const stats = (typeof window.getClientStats === 'function') ? window.getClientStats(client.id) : null;
    const scoring = (typeof window.getClientScoring === 'function') ? window.getClientScoring(client.id) : null;
    return {
      nom: client.nom || '',
      type: client.type || 'pro',
      siren: client.siren || '',
      tvaIntra: client.tvaIntra || '',
      contact: client.contact || client.prenom || '',
      telephone: client.tel || '',
      email: client.email || '',
      emailFact: client.emailFact || '',
      adresse: client.adresse || '',
      cp: client.cp || '',
      ville: client.ville || '',
      delaiPay: client.delaiPaiementJours != null ? client.delaiPaiementJours : 30,
      livraisons: snapshot?.livraisons.length || 0,
      caHTLivraisons: snapshot?.caHT || 0,
      caHTAnnee: stats?.caHTAnnee || 0,
      nbFactures: stats?.factures?.length || 0,
      totalFactureTTC: stats?.totalFactureTTC || 0,
      nbAvoirs: stats?.avoirs?.length || 0,
      totalAvoirsTTC: stats?.totalAvoirsTTC || 0,
      nbPaiements: stats?.paiements?.length || 0,
      totalPaiementsTTC: stats?.totalPaiementsTTC || 0,
      soldeDu: stats?.soldeDu || 0,
      echeancesDepassees: stats?.echeancesDepassees || 0,
      scoring: scoring ? scoring.label : '',
      incidents: snapshot?.incidents.length || 0
    };
  });
  exporterCSV(rows, [
    { label:'Client', get:function(row){ return row.nom; } },
    { label:'Type', get:function(row){ return row.type; } },
    { label:'SIREN', get:function(row){ return row.siren; } },
    { label:'TVA Intracom', get:function(row){ return row.tvaIntra; } },
    { label:'Contact', get:function(row){ return row.contact; } },
    { label:'Téléphone', get:function(row){ return row.telephone; } },
    { label:'Email', get:function(row){ return row.email; } },
    { label:'Email facturation', get:function(row){ return row.emailFact; } },
    { label:'Adresse', get:function(row){ return row.adresse; } },
    { label:'Code postal', get:function(row){ return row.cp; } },
    { label:'Ville', get:function(row){ return row.ville; } },
    { label:'Délai paiement (j)', get:function(row){ return row.delaiPay; } },
    { label:'Nb livraisons', get:function(row){ return row.livraisons; } },
    { label:'CA HT livraisons (total)', get:function(row){ return round2(row.caHTLivraisons); } },
    { label:'CA HT année en cours', get:function(row){ return round2(row.caHTAnnee); } },
    { label:'Nb factures émises', get:function(row){ return row.nbFactures; } },
    { label:'Total facturé TTC', get:function(row){ return round2(row.totalFactureTTC); } },
    { label:'Nb avoirs', get:function(row){ return row.nbAvoirs; } },
    { label:'Total avoirs TTC', get:function(row){ return round2(row.totalAvoirsTTC); } },
    { label:'Nb paiements reçus', get:function(row){ return row.nbPaiements; } },
    { label:'Total encaissé TTC', get:function(row){ return round2(row.totalPaiementsTTC); } },
    { label:'Solde dû TTC', get:function(row){ return round2(row.soldeDu); } },
    { label:'Échéances dépassées', get:function(row){ return row.echeancesDepassees; } },
    { label:'Scoring', get:function(row){ return row.scoring; } },
    { label:'Incidents', get:function(row){ return row.incidents; } }
  ], 'historique-clients-mca-logistics.csv');
  ajouterEntreeAudit('Export clients', 'Export CSV de l’historique clients');
}

// L8440 (script.js d'origine)
function exporterHistoriqueClientCourant() {
  if (!_clientHistoryCurrentId) return;
  const snapshot = getClientHistoriqueSnapshot(_clientHistoryCurrentId);
  if (!snapshot) return;
  exporterCSV(snapshot.livraisons, [
    { label:'N° LIV', get:function(item){ return item.numLiv || ''; } },
    { label:'Client', get:function(item){ return item.client || snapshot.client.nom || ''; } },
    { label:'Date livraison', get:function(item){ return formatDateExport(item.date); } },
    { label:'Date paiement', get:function(item){ return item.datePaiement ? formatDateExport(item.datePaiement) : ''; } },
    { label:'Statut', get:function(item){ return item.statut || ''; } },
    { label:'Paiement', get:function(item){ return getLivraisonStatutPaiement(item); } },
    { label:'HT', get:function(item){ return round2(getMontantHTLivraison(item)); } },
    { label:'TTC', get:function(item){ return round2(item.prix || 0); } }
  ], 'client-' + (snapshot.client.nom || 'historique').toLowerCase().replace(/[^a-z0-9]+/gi, '-') + '.csv');
  ajouterEntreeAudit('Export client', 'Export historique du client ' + (snapshot.client.nom || '—'));
}

// L8526 (script.js d'origine)
function exporterDonneesRGPDClientCourant() {
  if (!_clientHistoryCurrentId) return;
  const payload = collecterDonneesRGPDClient(_clientHistoryCurrentId);
  if (!payload) { if (typeof afficherToast === 'function') afficherToast('⚠️ Client introuvable', 'error'); return; }
  try {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nomFichier = 'RGPD_export_' + (payload.meta.clientNom || 'client').toLowerCase().replace(/[^a-z0-9]+/gi, '-')
                     + '_' + new Date().toLocalISODate() + '.json';
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    if (typeof ajouterEntreeAudit === 'function') {
      ajouterEntreeAudit('Export RGPD', 'Export portabilité art. 20 — client ' + (payload.meta.clientNom || '—'));
    }
    if (typeof afficherToast === 'function') afficherToast('🛡️ Export RGPD généré', 'success');
  } catch (e) {
    console.warn('[RGPD]', e);
    if (typeof afficherToast === 'function') afficherToast('❌ Échec export RGPD', 'error');
  }
}

// L9215 (script.js d'origine)
function exporterSauvegardeAdmin() {
  const payload = construireSauvegardeAdmin();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date();
  const stamp = date.getFullYear() + String(date.getMonth()+1).padStart(2,'0') + String(date.getDate()).padStart(2,'0') + '-' + String(date.getHours()).padStart(2,'0') + String(date.getMinutes()).padStart(2,'0');
  link.href = url;
  link.download = 'mca-logistics-backup-' + stamp + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem('backup_admin_last_export', payload.exportedAt);
  majResumeSauvegardeAdmin();
  afficherToast('Sauvegarde téléchargée');
}

// L9515 (script.js d'origine)
function exporterChargesPDF() {
  const charges = charger('charges').sort((a,b)=>new Date(b.date)-new Date(a.date));
  const params = chargerObj('params_entreprise', {});
  const nom = params.nom || 'MCA Logistics';
  const dateExp = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const total = charges.reduce((s,c)=>s+(c.montant||0),0);
  const catIcons = {carburant:'⛽',peage:'🛣️',entretien:'🔧',assurance:'🛡️',autre:'📝'};

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Récapitulatif des charges</div><div style="font-size:1rem;font-weight:700">Total : ${euros(total)}</div><div style="font-size:.78rem;color:#9ca3af">${dateExp}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left">Date</th><th style="padding:8px 12px;text-align:left">Catégorie</th><th style="padding:8px 12px;text-align:left">Description</th><th style="padding:8px 12px;text-align:left">Véhicule</th><th style="padding:8px 12px;text-align:right">Montant</th></tr></thead>
      <tbody>${charges.map((c,i)=>`<tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}">
        <td style="padding:8px 12px">${c.date||'—'}</td>
        <td style="padding:8px 12px">${catIcons[c.categorie]||'📝'} ${c.categorie||'autre'}</td>
        <td style="padding:8px 12px">${c.description||'—'}</td>
        <td style="padding:8px 12px">${c.vehNom||'—'}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700">${euros(c.montant||0)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div style="border-top:2px solid #1a1d27;margin-top:12px;padding-top:8px;display:flex;justify-content:flex-end"><strong style="font-size:1rem">Total : ${euros(total)}</strong></div>
    <div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>Généré par MCA Logistics — ${nom}</span><span>${dateExp}</span></div>
  </div>`;
  const win = ouvrirPopupSecure('','_blank','width=800,height=700');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Charges — ${nom}</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('📄 PDF charges généré');
}

// L10372 (script.js d'origine)
function exporterHeuresPDF() {
  const salaries = charger('salaries');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const dateExp = formatDateHeureExport();
  const range = getHeuresPeriodeRange();
  const rows = salaries.map(s => {
    const { planifiees, details } = calculerHeuresSalarieSemaine(s.id);
    const detailStr = details.map(d=>`${d.jour.substring(0,3)}: ${d.duree.toFixed(1)}h`).join(' · ');
    return `<tr><td style="padding:8px 12px;font-weight:600">${s.nom}</td><td style="padding:8px 12px">${s.poste||'—'}</td><td style="padding:8px 12px;text-align:center;font-weight:700">${planifiees.toFixed(1)}h</td><td style="padding:8px 12px;font-size:.82rem;color:#6b7280">${detailStr||'—'}</td></tr>`;
  }).join('');
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    ${construireEnteteExport(params, 'Rapport heures', `${range.label} · ${range.datesLabel}`, dateExp)}
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th><th style="padding:8px 12px;text-align:center;color:#6b7280">H/semaine</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Détail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  ouvrirFenetreImpression(`Heures - ${nom}`, html, 'width=800,height=700');
  afficherToast('📄 Rapport heures généré');
}

// L10549 (script.js d'origine)
function exporterRecapHeuresPDF() { exporterHeuresPDF(); }

// L10552 (script.js d'origine)
function exporterPlanningPDF() {
  const salaries = charger('salaries');
  const plannings = loadSafe('plannings', []);
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const dateExp = formatDateHeureExport();
  const JOURS_LABELS = {lundi:'Lun',mardi:'Mar',mercredi:'Mer',jeudi:'Jeu',vendredi:'Ven',samedi:'Sam',dimanche:'Dim'};
  const typeColors = {travail:'#2ecc71',repos:'#6b7280',conge:'#3498db',absence:'#e74c3c',maladie:'#9b59b6'};

  const rows = salaries.map(s => {
    const plan = plannings.find(p=>p.salId===s.id);
    const jours = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'].map(j => {
      const jour = plan?.semaine?.find(d=>d.jour===j);
      if (!jour || !jour.travaille) return `<td style="padding:6px 8px;text-align:center;color:${typeColors[jour?.typeJour||'repos']||'#6b7280'};font-size:.78rem">${jour?.typeJour==='conge'?'Congé':jour?.typeJour==='maladie'?'Maladie':jour?.typeJour==='absence'?'Absent':'—'}</td>`;
      return `<td style="padding:6px 8px;text-align:center;font-size:.78rem;color:#2ecc71">${jour.heureDebut||'—'}${jour.heureFin?' – '+jour.heureFin:''}</td>`;
    }).join('');
    return `<tr><td style="padding:8px 12px;font-weight:600">${s.nom}</td><td style="padding:8px 12px;font-size:.82rem;color:#6b7280">${s.poste||'—'}</td>${jours}</tr>`;
  }).join('');

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#1a1d27">
    ${construireEnteteExport(params, 'Planning hebdomadaire', '', dateExp)}
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th>${Object.values(JOURS_LABELS).map(j=>`<th style="padding:6px 8px;text-align:center;color:#6b7280">${j}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  ouvrirFenetreImpression(`Planning - ${nom}`, html, 'width=950,height=700');
  afficherToast('📄 Rapport planning généré');
}

// L10588 (script.js d'origine)
function exporterVehiculesPDF() {
  const vehicules = charger('vehicules');
  const entretiens = charger('entretiens');
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const dateExp = formatDateHeureExport();

  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Rapport flotte véhicules</div><div style="font-size:.78rem;color:#9ca3af">${dateExp}</div></div>
    </div>
    ${renderBlocInfosEntreprise(params)}
    <table style="width:100%;border-collapse:collapse;font-size:.82rem">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Immatriculation</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Modèle</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Acquisition</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Finances</th><th style="padding:8px 12px;text-align:left;color:#6b7280">CT</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Dernier entretien</th></tr></thead>
      <tbody>${vehicules.map((v,i)=>{
        const ent = entretiens.filter(e=>e.vehId===v.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
        const amort = calculerAmortissementVehicule(v);
        return `<tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'#fff':'#fafafa'}">
          <td style="padding:8px 12px;font-weight:700">${v.immat}</td>
          <td style="padding:8px 12px">${v.modele||'—'}</td>
          <td style="padding:8px 12px;text-align:right">${v.km?v.km.toLocaleString('fr-FR')+' km':'—'}</td>
          <td style="padding:8px 12px">${(v.modeAcquisition||'—').toUpperCase()}${v.dateAcquisition?'<br><span style="font-size:.76rem;color:#6b7280">'+formatDateExport(v.dateAcquisition)+'</span>':''}${v.dureeAmortissement?'<br><span style="font-size:.76rem;color:#6b7280">'+v.dureeAmortissement+' an(s)</span>':''}</td>
          <td style="padding:8px 12px">${v.prixAchatHT?euros(v.prixAchatHT)+' HT':'—'}${v.prixAchatTTC?'<br><span style="font-size:.76rem;color:#6b7280">'+euros(v.prixAchatTTC)+' TTC</span>':''}${amort.annuel?'<br><span style="font-size:.76rem;color:#6b7280">Amort. '+euros(amort.annuel)+'/an</span>':''}</td>
          <td style="padding:8px 12px">${formatDateExport(v.dateCT)}</td>
          <td style="padding:8px 12px">${v.salNom||'—'}</td>
          <td style="padding:8px 12px">${ent?formatDateExport(ent.date):'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  const win = ouvrirPopupSecure('','_blank','width=850,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><title>Véhicules — '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(()=>{window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('📄 Rapport véhicules généré');
}

// L10925 (script.js d'origine)
function exporterPlanningSemainePDF() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var salaries  = charger('salaries');
  var plannings = loadSafe('plannings', []);
  var absences  = loadSafe('absences_periodes', []);
  var params    = getEntrepriseExportParams();
  var nom       = params.nom;
  var dateExp   = formatDateHeureExport();

  var JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  var JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi); d.setDate(lundi.getDate() + i); datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var titreSemaine = 'Semaine ' + getNumSemaine(lundi) + ' — ' + lundi.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + ' au ' + dimanche.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});

  var thCols = datesSemaine.map(function(d,i) {
    return '<th style="padding:8px 6px;text-align:center;color:#6b7280;font-size:.82rem">' + JOURS_COURTS[i] + ' ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '</th>';
  }).join('');

  var rows = salaries.map(function(s) {
    var plan = plannings.find(function(p){return p.salId===s.id;});
    var cells = datesSemaine.map(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = absences.find(function(a){ return a.salId===s.id && dateStr>=a.debut && dateStr<=a.fin; });
      if (absJour) {
        var colors = { conge:'#3498db', maladie:'#9b59b6', absence:'#e74c3c' };
        var labels = { conge:'Congé', maladie:'Maladie', absence:'Absent' };
        return '<td style="padding:6px;text-align:center;background:' + (colors[absJour.type]||'#e74c3c') + '15;color:' + (colors[absJour.type]||'#e74c3c') + ';font-size:.78rem;font-weight:600">' + (labels[absJour.type]||'Absent') + '</td>';
      }
      var jourNom = JOURS[i];
      var jour = plan ? (plan.semaine||[]).find(function(j){return j.jour===jourNom;}) : null;
      if (!jour || !jour.travaille) {
        if (jour && ['conge','absence','maladie'].includes(jour.typeJour)) {
          var lb2 = {conge:'Congé',maladie:'Maladie',absence:'Absent'}; 
          return '<td style="padding:6px;text-align:center;color:#9ca3af;font-size:.78rem">' + (lb2[jour.typeJour]||'—') + '</td>';
        }
        return '<td style="padding:6px;text-align:center;color:#d1d5db;font-size:.78rem">—</td>';
      }
      return '<td style="padding:6px;text-align:center;color:#2ecc71;font-size:.78rem">' + (jour.heureDebut||'') + (jour.heureFin?' – '+jour.heureFin:'') + '</td>';
    }).join('');
    return '<tr><td style="padding:8px 12px;font-weight:600">' + s.nom + '</td><td style="padding:8px 12px;font-size:.82rem;color:#6b7280">' + (s.poste||'—') + '</td>' + cells + '</tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#1a1d27">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">' +
      '<div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">' + nom + '</div></div>' +
      '<div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">' + titreSemaine + '</div><div style="font-size:.78rem;color:#9ca3af">' + dateExp + '</div></div></div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem">' +
      '<thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th>' + thCols + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
    '<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>' + nom + '</span><span>' + dateExp + '</span></div></div>';

  var win = ouvrirPopupSecure('','_blank','width=950,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><title>Planning ' + titreSemaine + '</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:10mm;size:landscape}</style></head><body>' + html + '<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('📄 Rapport planning semaine généré');
}

// L11194 (script.js d'origine)
function exporterReleveKmPDF() {
  var salaries = charger('salaries');
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var range = getHeuresPeriodeRange();
  var allKm = [];
  salaries.forEach(function(s) {
    var entrees = loadSafe('km_sal_'+s.id, []);
    entrees.forEach(function(e) {
      if ((e.date || '') < range.debut || (e.date || '') > range.fin) return;
      var distance = e.kmArrivee != null ? (e.distance || (e.kmArrivee - e.kmDepart)) : 0;
      allKm.push({salNom:s.nom, date:e.date, kmDepart:e.kmDepart, kmArrivee:e.kmArrivee, distance:distance});
    });
  });
  allKm.sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var totalKm = allKm.reduce(function(s,e){return s+(e.distance||0);},0);
  var rows = allKm.slice(0,100).map(function(e,i) {
    var kmDep = e.kmDepart != null ? Math.round(e.kmDepart) : '—';
    var kmArr = e.kmArrivee != null ? Math.round(e.kmArrivee) : '—';
    var dist = e.kmArrivee != null ? Math.round(e.distance||0)+' km' : 'En attente';
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:8px 12px;font-weight:600">'+e.salNom+'</td><td style="padding:8px 12px">'+formatDateExport(e.date)+'</td><td style="padding:8px 12px;text-align:right">'+kmDep+'</td><td style="padding:8px 12px;text-align:right">'+kmArr+'</td><td style="padding:8px 12px;text-align:right;font-weight:700">'+dist+'</td></tr>';
  }).join('');
  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">'+
      '<div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">'+nom+'</div></div>'+
      '<div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Relevés kilométriques</div><div style="font-size:1rem;font-weight:700">Total : '+Math.round(totalKm)+' km</div><div style="font-size:.78rem;color:#9ca3af">'+range.label+' · '+range.datesLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'+
      '<thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Date</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km départ</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km arrivée</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Distance</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';
  var win = ouvrirPopupSecure('','_blank','width=800,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><title>Relevés km — '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('📄 Rapport relevés km généré');
}

// L11232 (script.js d'origine)
function exporterRapportHeuresEtKmPDF() {
  var salaries = charger('salaries');
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var range = getHeuresPeriodeRange();

  var rowsHeures = salaries.map(function(s) {
    var heuresData = calculerHeuresSalarieSemaine(s.id);
    var planifiees = heuresData.planifiees || 0;
    var details = Array.isArray(heuresData.details) ? heuresData.details : [];
    var detailStr = details.map(function(d) {
      return d.jour.substring(0,3) + ': ' + Number(d.duree || 0).toFixed(1) + 'h';
    }).join(' · ');
    return '<tr>'
      + '<td style="padding:8px 12px;font-weight:600">' + planningEscapeHtml(s.nom || '—') + '</td>'
      + '<td style="padding:8px 12px">' + planningEscapeHtml(s.poste || '—') + '</td>'
      + '<td style="padding:8px 12px;text-align:center;font-weight:700">' + Number(planifiees).toFixed(1) + 'h</td>'
      + '<td style="padding:8px 12px;font-size:.82rem;color:#6b7280">' + planningEscapeHtml(detailStr || '—') + '</td>'
      + '</tr>';
  }).join('');

  var allKm = [];
  salaries.forEach(function(s) {
    var entrees = loadSafe('km_sal_' + s.id, []);
    entrees.forEach(function(e) {
      if ((e.date || '') < range.debut || (e.date || '') > range.fin) return;
      var distance = e.kmArrivee != null ? (e.distance || (e.kmArrivee - e.kmDepart)) : 0;
      allKm.push({
        salNom: s.nom || '—',
        date: e.date,
        kmDepart: e.kmDepart,
        kmArrivee: e.kmArrivee,
        distance: distance
      });
    });
  });
  allKm.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  var totalKm = allKm.reduce(function(sum, item) { return sum + (item.distance || 0); }, 0);
  var rowsKm = allKm.slice(0, 100).map(function(e, i) {
    var kmDep = e.kmDepart != null ? Math.round(e.kmDepart) : '—';
    var kmArr = e.kmArrivee != null ? Math.round(e.kmArrivee) : '—';
    var dist = e.kmArrivee != null ? Math.round(e.distance || 0) + ' km' : 'En attente';
    return '<tr style="border-bottom:1px solid #f0f0f0;background:' + (i % 2 === 0 ? '#fff' : '#fafafa') + '">'
      + '<td style="padding:8px 12px;font-weight:600">' + planningEscapeHtml(e.salNom) + '</td>'
      + '<td style="padding:8px 12px">' + formatDateExport(e.date) + '</td>'
      + '<td style="padding:8px 12px;text-align:right">' + kmDep + '</td>'
      + '<td style="padding:8px 12px;text-align:right">' + kmArr + '</td>'
      + '<td style="padding:8px 12px;text-align:right;font-weight:700">' + dist + '</td>'
      + '</tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:920px;margin:0 auto;padding:32px;color:#1a1d27">'
    + construireEnteteExport(params, 'Rapport heures et km', range.label + ' · ' + range.datesLabel, dateExp)
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">'
      + '<div style="background:#f8f9fc;border-radius:12px;padding:14px;text-align:center;border-top:3px solid #4f8ef7"><div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">Salariés</div><div style="font-size:1.2rem;font-weight:800;color:#4f8ef7">' + salaries.length + '</div></div>'
      + '<div style="background:#f8f9fc;border-radius:12px;padding:14px;text-align:center;border-top:3px solid #2ecc71"><div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">Total km</div><div style="font-size:1.2rem;font-weight:800;color:#2ecc71">' + Math.round(totalKm) + ' km</div></div>'
      + '<div style="background:#f8f9fc;border-radius:12px;padding:14px;text-align:center;border-top:3px solid #f5a623"><div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">Période</div><div style="font-size:1rem;font-weight:800;color:#f5a623">' + planningEscapeHtml(range.label) + '</div></div>'
    + '</div>'
    + '<div style="margin-bottom:26px">'
      + '<div style="font-size:1rem;font-weight:800;margin-bottom:12px;color:#111827">Compteur d’heures</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'
        + '<thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Poste</th><th style="padding:8px 12px;text-align:center;color:#6b7280">Heures</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Détail</th></tr></thead>'
        + '<tbody>' + rowsHeures + '</tbody>'
      + '</table>'
    + '</div>'
    + '<div>'
      + '<div style="font-size:1rem;font-weight:800;margin-bottom:12px;color:#111827">Relevés kilométriques</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'
        + '<thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;color:#6b7280">Salarié</th><th style="padding:8px 12px;text-align:left;color:#6b7280">Date</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km départ</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Km arrivée</th><th style="padding:8px 12px;text-align:right;color:#6b7280">Distance</th></tr></thead>'
        + '<tbody>' + (rowsKm || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#6b7280">Aucun relevé kilométrique sur cette période</td></tr>') + '</tbody>'
      + '</table>'
    + '</div>'
    + renderFooterEntreprise(params, dateExp)
  + '</div>';

  ouvrirFenetreImpression('Heures et km - ' + nom, html, 'width=980,height=760');
  afficherToast('📄 Rapport heures et km généré');
}

// L11456 (script.js d'origine)
function exporterTvaCSV() {
  var range = getTvaPeriodeRange();
  var summary = getTVASummaryForRange(range);
  var rows = [];
  summary.collectee.forEach(function(entry) {
    rows.push({ sens:'Collectée', source:'Livraison', dateExigibilite:entry.exigibiliteDate || '', dateSource:entry.issueDate || '', libelle:entry.libelle, tauxTVA:entry.tauxTVA, baseHT:entry.baseHT, tva:entry.tva, ttc:entry.ttc });
  });
  summary.pending.forEach(function(entry) {
    rows.push({ sens:'Non exigible', source:'Livraison', dateExigibilite:entry.paymentDate || '', dateSource:entry.issueDate || '', libelle:entry.libelle, tauxTVA:entry.tauxTVA, baseHT:entry.baseHT, tva:entry.tva, ttc:entry.ttc });
  });
  summary.deductible.forEach(function(entry) {
    rows.push({ sens:'Déductible', source:entry.sourceType, dateExigibilite:entry.date || '', dateSource:entry.date || '', libelle:entry.libelle, tauxTVA:entry.tauxTVA, baseHT:entry.baseHT, tva:entry.tva, ttc:entry.ttc });
  });
  summary.settlements.forEach(function(entry) {
    rows.push({ sens:'Règlement TVA', source:'TVA', dateExigibilite:entry.paymentDate || '', dateSource:entry.periodLabel, libelle:entry.description, tauxTVA:0, baseHT:0, tva:0, ttc:entry.montant });
  });
  if (!rows.length) { afficherToast('Aucune donnée TVA à exporter sur cette période', 'error'); return; }
  exporterCSV('tva-' + range.debut + '-au-' + range.fin + '.csv', rows);
  afficherToast('📥 Export CSV TVA généré');
}

// L11478 (script.js d'origine)
function exporterTvaPDF() {
  var range = getTvaPeriodeRange();
  var summary = getTVASummaryForRange(range);
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var moisLabel = range.label;
  var totalCollectee = summary.totalCollectee;
  var totalDeductible = summary.totalDeductible;
  var solde = summary.soldeBrut;
  var collRows = summary.collectee.map(function(entry) {
    return '<tr><td style="padding:6px 12px">' + formatDateExport(entry.exigibiliteDate) + '</td><td style="padding:6px 12px">' + planningEscapeHtml(entry.libelle) + '</td><td style="padding:6px 12px;text-align:right">' + euros(entry.baseHT) + '</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:#2ecc71">' + euros(entry.tva) + '</td><td style="padding:6px 12px;text-align:right">' + euros(entry.ttc) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" style="padding:10px 12px;text-align:center;color:#6b7280">Aucune TVA collectée exigible</td></tr>';
  var pendingRows = summary.pending.map(function(item) {
    return '<tr><td style="padding:6px 12px">' + formatDateExport(item.issueDate) + '</td><td style="padding:6px 12px">' + planningEscapeHtml(item.libelle) + '</td><td style="padding:6px 12px;text-align:right">' + euros(item.tva) + '</td><td style="padding:6px 12px">' + (item.paymentDate ? 'Paiement le ' + formatDateExport(item.paymentDate) : 'Non encaissée') + '</td></tr>';
  }).join('');
  var dedRows = summary.deductible.map(function(entry) {
    return '<tr><td style="padding:6px 12px">' + formatDateExport(entry.date) + '</td><td style="padding:6px 12px">' + planningEscapeHtml(entry.libelle) + '</td><td style="padding:6px 12px;text-align:right">' + euros(entry.baseHT) + '</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:#e67e22">' + euros(entry.tva) + '</td><td style="padding:6px 12px;text-align:right">' + euros(entry.ttc) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" style="padding:10px 12px;text-align:center;color:#6b7280">Aucune TVA déductible</td></tr>';
  var settlementRows = summary.settlements.map(function(item) {
    return '<tr><td style="padding:6px 12px">' + item.periodLabel + '</td><td style="padding:6px 12px">' + formatDateExport(item.paymentDate) + '</td><td style="padding:6px 12px">' + planningEscapeHtml(item.description) + '</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:#2563eb">' + euros(item.montant) + '</td></tr>';
  }).join('') || '<tr><td colspan="4" style="padding:10px 12px;text-align:center;color:#6b7280">Aucun règlement TVA enregistré</td></tr>';

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px"><div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">'+nom+'</div>'+(params.siret?'<div style="font-size:.78rem;color:#9ca3af">SIRET : '+params.siret+'</div>':'')+'</div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Récapitulatif TVA</div><div style="font-size:1rem;font-weight:700;text-transform:capitalize">'+moisLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>' +
    '<div style="font-size:.84rem;color:#6b7280;margin-bottom:18px">' + getTVARegimeLabel(summary.profile.regime) + ' · ' + getTVAActiviteLabel(summary.profile.activiteType) + ' · ' + getTVAExigibiliteLabel(summary.profile) + '</div>' +
    '<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#2ecc71">📤 TVA Collectée exigible</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:20px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 12px;text-align:left">Exigibilité</th><th style="padding:6px 12px;text-align:left">Libellé</th><th style="padding:6px 12px;text-align:right">Base HT</th><th style="padding:6px 12px;text-align:right">TVA</th><th style="padding:6px 12px;text-align:right">TTC</th></tr></thead><tbody>'+collRows+'<tr style="background:#e8f5e9;font-weight:700"><td style="padding:6px 12px">TOTAL</td><td></td><td></td><td style="padding:6px 12px;text-align:right;color:#2ecc71">'+euros(totalCollectee)+'</td><td></td></tr></tbody></table>' +
    (pendingRows ? '<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#f5a623">📅 Facturé mais non encore exigible</div><table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:20px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 12px;text-align:left">Date facture</th><th style="padding:6px 12px;text-align:left">Libellé</th><th style="padding:6px 12px;text-align:right">TVA</th><th style="padding:6px 12px;text-align:left">Statut</th></tr></thead><tbody>' + pendingRows + '</tbody></table>' : '') +
    '<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e67e22">📥 TVA Déductible</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:20px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 12px;text-align:left">Date</th><th style="padding:6px 12px;text-align:left">Libellé</th><th style="padding:6px 12px;text-align:right">Base HT</th><th style="padding:6px 12px;text-align:right">TVA</th><th style="padding:6px 12px;text-align:right">TTC</th></tr></thead><tbody>'+dedRows+'<tr style="background:#fff3e0;font-weight:700"><td style="padding:6px 12px">TOTAL</td><td></td><td></td><td style="padding:6px 12px;text-align:right;color:#e67e22">'+euros(totalDeductible)+'</td><td></td></tr></tbody></table>' +
    '<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#2563eb">🧾 Règlements TVA rattachés à la période</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:20px"><thead><tr style="background:#f3f4f6"><th style="padding:6px 12px;text-align:left">Période TVA</th><th style="padding:6px 12px;text-align:left">Date paiement</th><th style="padding:6px 12px;text-align:left">Libellé</th><th style="padding:6px 12px;text-align:right">Montant</th></tr></thead><tbody>' + settlementRows + '</tbody></table>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0"><div style="padding:14px;background:#e8f5e9;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Collectée</div><div style="font-size:1.2rem;font-weight:800;color:#2ecc71">'+euros(totalCollectee)+'</div></div><div style="padding:14px;background:#fff3e0;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Déductible</div><div style="font-size:1.2rem;font-weight:800;color:#e67e22">'+euros(totalDeductible)+'</div></div><div style="padding:14px;background:#eff6ff;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Planifiée / réglée</div><div style="font-size:1.2rem;font-weight:800;color:#2563eb">'+euros(summary.totalTVAPlanifiee)+'</div></div><div style="padding:14px;background:'+(solde>=0?'#ffebee':'#f5edff')+';border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">'+(solde>=0?'Reste non planifié':'Crédit TVA')+'</div><div style="font-size:1.2rem;font-weight:800;color:'+(solde>=0?'#e74c3c':'#8e44ad')+'">'+euros(solde>=0 ? summary.tvaReverser : summary.tvaCredit)+'</div></div></div>' +
    '<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';

  var win = ouvrirPopupSecure('','_blank','width=800,height=800');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><title>TVA '+moisLabel+' — '+nom+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('📄 Rapport TVA généré');
}

// L11527 (script.js d'origine)
function genererRapportMensuelPeriode() {
  var livraisons = getLivraisonsFiltresActifs();
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var periode = getLivraisonsPeriodeActiveLabel();

  var escape = window.escapeHtml;
  var nomEntr = escape(nom);

  if (!livraisons.length) {
    afficherToast('⚠️ Aucune livraison sur la période sélectionnée', 'error');
    return;
  }

  var cellCss = 'padding:8px 10px;border-bottom:1px solid #f3f4f6';
  var badgeCss = 'padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600';

  // Agrégats
  var totalHT = 0, totalTVA = 0, totalTTC = 0, totalKm = 0;
  var tvaParTaux = {};   // { "20": { ht, tva, ttc }, "10": {...} }
  var parClient = {};    // { "Nom": { nb, ht, tva, ttc, paye, attente } }
  var nbPaye = 0, nbAttente = 0, nbLitige = 0;

  var rows = livraisons.map(function(l) {
    var ht = l.prixHT || (l.prix||0)/(1+(l.tauxTVA||20)/100);
    var ttc = l.prix || 0;
    var tva = ttc - ht;
    var taux = String(l.tauxTVA != null ? l.tauxTVA : 20);
    totalHT += ht; totalTVA += tva; totalTTC += ttc;
    totalKm += parseFloat(l.distance) || 0;

    if (!tvaParTaux[taux]) tvaParTaux[taux] = { ht: 0, tva: 0, ttc: 0, nb: 0 };
    tvaParTaux[taux].ht += ht; tvaParTaux[taux].tva += tva; tvaParTaux[taux].ttc += ttc; tvaParTaux[taux].nb++;

    var cleClient = l.client || '—';
    if (!parClient[cleClient]) parClient[cleClient] = { nb: 0, ht: 0, tva: 0, ttc: 0, paye: 0, attente: 0 };
    parClient[cleClient].nb++;
    parClient[cleClient].ht += ht;
    parClient[cleClient].tva += tva;
    parClient[cleClient].ttc += ttc;

    if (l.statutPaiement === 'payé' || l.statutPaiement === 'paye') { nbPaye++; parClient[cleClient].paye += ttc; }
    else if (l.statutPaiement === 'litige') { nbLitige++; }
    else { nbAttente++; parClient[cleClient].attente += ttc; }

    var badgeStatut = l.statut === 'livre' ? '<span style="'+badgeCss+';background:#d1fae5;color:#065f46">Livrée</span>'
                    : l.statut === 'en-cours' ? '<span style="'+badgeCss+';background:#dbeafe;color:#1e40af">En cours</span>'
                    : '<span style="'+badgeCss+';background:#fef3c7;color:#92400e">En attente</span>';
    var badgePay = l.statutPaiement === 'payé' ? '<span style="'+badgeCss+';background:#d1fae5;color:#065f46">Payé</span>'
                 : l.statutPaiement === 'litige' ? '<span style="'+badgeCss+';background:#fee2e2;color:#991b1b">Litige</span>'
                 : '<span style="'+badgeCss+';background:#fef3c7;color:#92400e">Attente</span>';

    return '<tr>' +
      '<td style="'+cellCss+'">' + escape(l.numLiv || '—') + '</td>' +
      '<td style="'+cellCss+'">' + escape(formatDateExport(l.date)) + '</td>' +
      '<td style="'+cellCss+'">' + escape(l.client || '—') + '</td>' +
      '<td style="'+cellCss+'">' + escape(l.chaufNom || '—') + '</td>' +
      '<td style="'+cellCss+';text-align:right">' + (l.distance ? escape(String(l.distance)) + ' km' : '—') + '</td>' +
      '<td style="'+cellCss+';text-align:right">' + euros(ht) + '</td>' +
      '<td style="'+cellCss+';text-align:right;color:#6b7280">' + euros(tva) + ' <span style="font-size:.68rem">('+taux+'%)</span></td>' +
      '<td style="'+cellCss+';text-align:right;font-weight:700">' + euros(ttc) + '</td>' +
      '<td style="'+cellCss+'">' + badgeStatut + '</td>' +
      '<td style="'+cellCss+'">' + badgePay + '</td>' +
    '</tr>';
  }).join('');

  // Bloc synthèse cards
  var cardCss = 'background:#f8f9fc;padding:12px 14px;border-radius:10px;border:1px solid #e5e7eb';
  var blocResume =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0">' +
      '<div style="'+cardCss+'"><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">CA HT</div><div style="font-size:1.15rem;font-weight:800;color:#111827">'+euros(totalHT)+'</div></div>' +
      '<div style="'+cardCss+';background:#fff3e0"><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">TVA collectée</div><div style="font-size:1.15rem;font-weight:800;color:#e67e22">'+euros(totalTVA)+'</div></div>' +
      '<div style="'+cardCss+'"><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">CA TTC</div><div style="font-size:1.15rem;font-weight:800;color:#111827">'+euros(totalTTC)+'</div></div>' +
      '<div style="'+cardCss+'"><div style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Missions · Km</div><div style="font-size:1.15rem;font-weight:800">'+livraisons.length+' · '+totalKm.toLocaleString('fr-FR')+' km</div></div>' +
    '</div>';

  // Ventilation TVA par taux (pour déclaration CA3)
  var tauxKeys = Object.keys(tvaParTaux).sort(function(a,b){return parseFloat(b)-parseFloat(a);});
  var blocTVA = '<h3 style="font-size:.9rem;font-weight:700;margin:20px 0 8px">Ventilation TVA par taux (pour déclaration CA3)</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:8px">' +
      '<thead><tr style="background:#f3f4f6;text-align:left"><th style="padding:6px 10px">Taux</th><th style="padding:6px 10px;text-align:right">Nb missions</th><th style="padding:6px 10px;text-align:right">Base HT</th><th style="padding:6px 10px;text-align:right">TVA collectée</th><th style="padding:6px 10px;text-align:right">Total TTC</th></tr></thead>' +
      '<tbody>' + tauxKeys.map(function(t){ var x = tvaParTaux[t]; return '<tr><td style="padding:6px 10px;font-weight:600">'+t+' %</td><td style="padding:6px 10px;text-align:right">'+x.nb+'</td><td style="padding:6px 10px;text-align:right">'+euros(x.ht)+'</td><td style="padding:6px 10px;text-align:right;color:#e67e22">'+euros(x.tva)+'</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(x.ttc)+'</td></tr>'; }).join('') + '</tbody>' +
    '</table>';

  // Récap par client
  var clientsArr = Object.entries(parClient).sort(function(a,b){return b[1].ttc - a[1].ttc;});
  var blocClients = '<h3 style="font-size:.9rem;font-weight:700;margin:20px 0 8px">Récap par client</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:8px">' +
      '<thead><tr style="background:#f3f4f6;text-align:left"><th style="padding:6px 10px">Client</th><th style="padding:6px 10px;text-align:right">Missions</th><th style="padding:6px 10px;text-align:right">CA HT</th><th style="padding:6px 10px;text-align:right">TVA</th><th style="padding:6px 10px;text-align:right">CA TTC</th><th style="padding:6px 10px;text-align:right">Encaissé</th><th style="padding:6px 10px;text-align:right">En attente</th></tr></thead>' +
      '<tbody>' + clientsArr.map(function(e){ var c = e[1]; return '<tr><td style="padding:6px 10px;font-weight:600">'+escape(e[0])+'</td><td style="padding:6px 10px;text-align:right">'+c.nb+'</td><td style="padding:6px 10px;text-align:right">'+euros(c.ht)+'</td><td style="padding:6px 10px;text-align:right;color:#6b7280">'+euros(c.tva)+'</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(c.ttc)+'</td><td style="padding:6px 10px;text-align:right;color:#065f46">'+euros(c.paye)+'</td><td style="padding:6px 10px;text-align:right;color:'+(c.attente>0?'#92400e':'#9ca3af')+'">'+euros(c.attente)+'</td></tr>'; }).join('') + '</tbody>' +
    '</table>';

  // Mentions société (pieds de document comme en facture)
  var mentionsHeader = renderFactureMentionsEntrepriseHeader(params);
  var siege = [params.adresse, ((params.codePostal||'')+' '+(params.ville||'')).trim()].filter(Boolean).map(escape).join(' · ');

  // En-tête unifié via construireEnteteExport (template référence du site)
  var metaLivraisons = livraisons.length+' livraison(s) · '+nbPaye+' payée(s) · '+nbAttente+' en attente' + (nbLitige?' · '+nbLitige+' litige(s)':'');
  var html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#111827">' +
      construireEnteteExport(params, 'Récapitulatif livraisons', periode, dateExp, metaLivraisons) +
      blocResume +
      blocTVA +
      blocClients +
      '<h3 style="font-size:.9rem;font-weight:700;margin:20px 0 8px">Détail des livraisons</h3>' +
      '<table style="width:100%;border-collapse:collapse;font-size:.78rem">' +
        '<thead>' +
          '<tr style="background:#f3f4f6;text-align:left">' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">N° LIV</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Date</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Client</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Chauffeur</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">Distance</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">HT</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">TVA</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">TTC</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Statut</th>' +
            '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Paiement</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody style="background:#fff">' + rows + '</tbody>' +
        '<tfoot>' +
          '<tr style="background:#fef3c7;font-weight:700">' +
            '<td colspan="4" style="padding:10px;text-align:right">TOTAUX</td>' +
            '<td style="padding:10px;text-align:right">'+totalKm.toLocaleString('fr-FR')+' km</td>' +
            '<td style="padding:10px;text-align:right">' + euros(totalHT) + '</td>' +
            '<td style="padding:10px;text-align:right;color:#6b7280">' + euros(totalTVA) + '</td>' +
            '<td style="padding:10px;text-align:right">' + euros(totalTTC) + '</td>' +
            '<td colspan="2"></td>' +
          '</tr>' +
        '</tfoot>' +
      '</table>' +
      '<div style="margin-top:20px;font-size:.7rem;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px">Document généré par '+nomEntr+' le '+escape(dateExp)+'</div>' +
    '</div>';

  var win = ouvrirPopupSecure('','_blank','width=1100,height=750');
  if (!win) { afficherToast('⚠️ Autorise les popups pour exporter en PDF','error'); return; }
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Récap livraisons — '+nomEntr+'</title>' +
    '<style>body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif}@page{margin:10mm;size:landscape}@media print{.no-print{display:none}}</style>' +
    '</head><body>' + html +
    '<script>setTimeout(function(){window.print();},400);<\/script></body></html>'
  );
  win.document.close();
}

// L11676 (script.js d'origine)
function exporterChargesPDFMois() {
  var range = getChargesPeriodeRange();
  var charges = charger('charges').filter(function(c){return isDateInRange(c.date, range);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var params = getEntrepriseExportParams();
  var nom = params.nom;
  var dateExp = formatDateHeureExport();
  var moisLabel = range.label;
  var totalHT=0, totalTVA=0, totalTTC=0;
  var catIcons = {carburant:'⛽',peage:'🛣️',entretien:'🔧',assurance:'🛡️',autre:'📝'};
  var rows = charges.map(function(c,i) {
    var ht = c.montantHT || (c.montant||0)/(1+(c.tauxTVA||20)/100);
    var tvaM = (c.montant||0) - ht;
    totalHT += ht; totalTVA += tvaM; totalTTC += (c.montant||0);
    return '<tr style="border-bottom:1px solid #f0f0f0;background:'+(i%2===0?'#fff':'#fafafa')+'"><td style="padding:6px 10px">'+c.date+'</td><td style="padding:6px 10px">'+(catIcons[c.categorie]||'📝')+' '+(c.categorie||'autre')+'</td><td style="padding:6px 10px">'+(c.description||'—')+'</td><td style="padding:6px 10px;text-align:right">'+euros(ht)+'</td><td style="padding:6px 10px;text-align:right;color:#6b7280">'+euros(tvaM)+'</td><td style="padding:6px 10px;text-align:right;font-weight:700">'+euros(c.montant||0)+'</td></tr>';
  }).join('');

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:20px"><div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">'+nom+'</div></div><div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af">Charges — '+moisLabel+'</div><div style="font-size:.78rem;color:#9ca3af">'+dateExp+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px"><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total HT</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalHT)+'</div></div><div style="background:#fff3e0;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">TVA</div><div style="font-size:1.1rem;font-weight:800;color:#e67e22">'+euros(totalTVA)+'</div></div><div style="background:#f8f9fc;padding:12px;border-radius:8px;text-align:center"><div style="font-size:.72rem;color:#6b7280">Total TTC</div><div style="font-size:1.1rem;font-weight:800">'+euros(totalTTC)+'</div></div></div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Date</th><th style="padding:6px 10px;text-align:left">Catégorie</th><th style="padding:6px 10px;text-align:left">Description</th><th style="padding:6px 10px;text-align:right">HT</th><th style="padding:6px 10px;text-align:right">TVA</th><th style="padding:6px 10px;text-align:right">TTC</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div style="border-top:1px solid #e5e7eb;margin-top:16px;padding-top:8px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between"><span>'+nom+'</span><span>'+dateExp+'</span></div></div>';

  var win = ouvrirPopupSecure('','_blank','width=800,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><title>Charges '+moisLabel+'</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>'+html+'<script>setTimeout(function(){window.print();},400)<\/script></body></html>');
  win.document.close();
  afficherToast('📄 Rapport charges généré');
}

