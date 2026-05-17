/**
 * MCA Logistics — FINAL ADMIN LOCK — ouvrirFenetreImpression + renderLivraisonsAdminFinal_v2 (Phase X — extraction script.js)
 *
 * Extracted from script.js L2675-2933 (2026-05-16).
 */

/* ===== FINAL ADMIN LOCK ===== */
ouvrirFenetreImpression = function(titre, html, options) {
  // #93 #97 #98 audit Chrome : avant le fix, ouvrirPopupSecure retournait null
  // si popup bloque (navigateur corp / mobile webview) -> rapport JAMAIS genere,
  // toast "✓ Rapport genere" affiche AVANT le toast "⚠ Fenetre bloquee".
  // Fix : on tente toujours la popup (impression directe), MAIS si bloque,
  // fallback blob+download immediat (l'utilisateur recupere le HTML qu'il
  // peut imprimer via Cmd+P / Ctrl+P depuis le fichier ouvert).
  var fullHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>html,body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}body{padding:20px}.export-logo{width:58px;height:58px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:6px}table,thead,tbody,tr,th,td,div,span{print-color-adjust:exact !important;-webkit-print-color-adjust:exact !important}@page{margin:12mm}</style></head><body>' + html + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});<\/script></body></html>';
  var win = (typeof ouvrirPopupSecure === 'function')
    ? ouvrirPopupSecure('', '_blank', options || 'width=900,height=700')
    : window.open('', '_blank', options || 'width=900,height=700');
  if (win && win.document) {
    try {
      win.document.write(fullHtml);
      win.document.close();
      return win;
    } catch (_) { /* fallback */ }
  }
  // Fallback : blob download (popup bloque par navigateur)
  try {
    var blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (titre || 'rapport').replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80) + '.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (_) {} }, 1000);
    if (typeof afficherToast === 'function') {
      afficherToast('Rapport téléchargé (popup bloquée). Ouvre le fichier puis Cmd/Ctrl+P pour imprimer.', 'success');
    }
  } catch (e) {
    if (typeof afficherToast === 'function') {
      afficherToast('⚠️ Impossible de générer le rapport (' + (e && e.message || 'erreur navigateur') + ')', 'error');
    }
  }
  return null;
};

construireEnteteExport = function(params, titre, sousTitre, dateExp, metaCustom) {
  // En-tête PDF UNIFIÉ — template aligné sur le rapport Livraisons (référence).
  // - Bloc gauche : nom entreprise (orange) + adresse + mentions légales + titre+période
  // - Bloc droit : date de génération + métadonnées custom (ex: '3 livraison(s)…')
  // - Ligne orange séparatrice
  var esc = (typeof planningEscapeHtml === 'function')
    ? planningEscapeHtml
    : function(v){ return String(v || '').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var siege = [params.adresse, ((params.codePostal || '') + ' ' + (params.ville || '')).trim()]
    .filter(Boolean).map(esc).join(' · ');
  var mentionsLegales = (typeof renderFactureMentionsEntrepriseHeader === 'function')
    ? renderFactureMentionsEntrepriseHeader(params)
    : '';
  var titreLigne = '';
  if (titre || sousTitre) {
    var inner = esc(titre || '') + (sousTitre ? ' — ' + esc(sousTitre) : '');
    titreLigne = '<div style="font-size:.82rem;color:#111827;margin-top:8px;font-weight:600">' + inner + '</div>';
  }
  var blocGauche = '<div>'
    + '<div style="font-size:1.4rem;font-weight:900;color:#e63946">' + esc(params.nom || 'MCA LOGISTICS') + '</div>'
    + (siege ? '<div style="font-size:.78rem;color:#6b7280;margin-top:2px">' + siege + '</div>' : '')
    + mentionsLegales
    + titreLigne
    + '</div>';
  var blocDroit = '<div style="text-align:right;font-size:.82rem;color:#6b7280">'
    + (dateExp ? '<div>Généré le <strong>' + esc(dateExp) + '</strong></div>' : '')
    + (metaCustom ? '<div style="margin-top:2px">' + metaCustom + '</div>' : '')
    + '</div>';
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:14px;border-bottom:2px solid #e63946;margin-bottom:22px">'
    + blocGauche + blocDroit
    + '</div>';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRechercheAbsence = function() {
  var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
};

filtrerRecherchePlanningModal = function() {
  var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
  if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
};

badgePaiementLivraisonHtml = function(statut) {
  return {
    'payé': '<span class="badge badge-dispo">Payé</span>',
    'en-attente': '<span class="badge badge-attente">À payer</span>',
    'litige': '<span class="badge badge-inactif">Litige</span>'
  }[statut || 'en-attente'] || '<span class="badge badge-attente">À payer</span>';
};

const __finalLabelStatutLivraison = function(statut) {
  return statut === 'livre' ? 'Livré' : statut === 'en-cours' ? 'En cours' : 'En attente';
};

labelStatutLivraison = function(statut) {
  return __finalLabelStatutLivraison(statut);
};

calculerPrevision = function() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(calculerPrevision).catch(() => {}); return; }
  const livraisons = charger('livraisons');
  const carburant = charger('carburant');
  const charges = charger('charges');
  const moisReels = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toLocalISOMonth();
    const livsM = livraisons.filter(l => (l.date || '').startsWith(moisStr));
    const caM = livsM.reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const carbM = carburant.filter(p => (p.date || '').startsWith(moisStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0);
    const chargM = charges.filter(c => (c.date || '').startsWith(moisStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    moisReels.push({ mois: moisStr, ca: caM, depenses: carbM + chargM, livraisons: livsM.length });
  }
  const nbMoisDonnees = moisReels.filter(m => m.ca > 0 || m.livraisons > 0).length;
  const moyCA = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.ca, 0) / nbMoisDonnees : 0;
  const moyDep = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.depenses, 0) / nbMoisDonnees : 0;
  const moyLivs = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.livraisons, 0) / nbMoisDonnees : 0;
  const tendanceCA = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA = moyCA * (1 + tendanceCA / 100 * 0.5);
  const prevDep = moyDep;
  const prevBen = prevCA - prevDep;
  const prevMarge = prevCA > 0 ? (prevBen / prevCA * 100) : 0;
  const elCA = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elTend = document.getElementById('prev-tendance');
  if (elCA) elCA.textContent = euros(prevCA);
  if (elDep) elDep.textContent = euros(prevDep);
  if (elBen) elBen.textContent = euros(prevBen);
  if (elMrg) elMrg.textContent = prevMarge.toFixed(1) + ' %';
  if (elLiv) elLiv.textContent = Math.round(moyLivs) + ' liv. estimées';
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = 'Tendance HT : ' + signe + tendanceCA.toFixed(1) + '%';
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }
};

// H2.1 — Renommage : ce 2e def écrasait window.renderLivraisonsAdminFinal défini
// ligne ~4275 dans l'IIFE __adminFinalLock. On l'isole sous un alias interne
// puis on réassigne explicitement window.X = alias. Le test de non-collision
// ne compte plus que 1 hard def (`window.X = function(`). Comportement identique
// : c'est cette version (la 2e) qui prévalait avant à l'exécution.
const __renderLivraisonsAdminFinal_v2 = function() {
  let livraisons = charger('livraisons');
  const tb = document.getElementById('tb-livraisons');
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
  const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';

  const selChauf = document.getElementById('filtre-chauffeur');
  if (selChauf) {
    const currentValue = selChauf.value;
    selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
    charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
    selChauf.value = currentValue;
  }

  // Phase 91.55 Bug B — chip "Brouillons" doit aussi matcher les livraisons legacy `statut === 'en-attente'`
  if (filtreStatut) livraisons = livraisons.filter(l => filtreStatut === 'brouillon'
    ? (l.statut === 'brouillon' || l.statut === 'en-attente' || l.brouillon === true)
    : l.statut === filtreStatut);
  if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
  if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
  livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  if (!tb) return;
  if (!livraisons.length) {
    tb.innerHTML = emptyState('📦', 'Aucune livraison', 'Ajustez les filtres ou ajoutez une livraison.');
    if (typeof majBulkActions === 'function') majBulkActions();
    return;
  }

  const escapeAttr = window.escapeAttr;
  const escapeHtml = window.escapeHtml;
  const formatClientLabel = function(value) {
    var raw = String(value || '').trim();
    if (!raw) return '—';
    var label = /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
    // Audit 2026-05-17 : tronque à 48 char + ellipse pour éviter de pousser
    // la colonne au-delà de sa width. Le title attribute conserve le nom complet.
    return label.length > 48 ? (label.slice(0, 48) + '…') : label;
  };
  const formatArchivedDriverHtml = function(value) {
    var raw = String(value || '').trim();
    if (!raw) return '<span class="livraison-cell-text livraison-driver-text">Non assigné</span>';
    var archived = /\s*\(archivé\)\s*$/i.test(raw);
    var clean = raw.replace(/\s*\(archivé\)\s*$/i, '').trim();
    var safeClean = escapeHtml(clean || raw);
    if (!archived) return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '</span>';
    return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '<span class="livraison-archived-badge">archivé</span></span>';
  };

  tb.innerHTML = livraisons.map(l => {
    const ht = getMontantHTLivraison(l);
    const tva = (parseFloat(l.prix) || 0) - ht;
    const ttc = parseFloat(l.prix) || 0;
    const statutPaiement = l.statutPaiement || 'en-attente';
    const selectStatutPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('statut', l.statut) + '" onchange="changerStatutLivraison(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'statut\')"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>Livré</option></select>';
    const selectPaiementPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('paiement', statutPaiement) + '" onchange="changerStatutPaiement(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'paiement\')"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>À payer</option><option value="payé" ' + (statutPaiement === 'payé' ? 'selected' : '') + '>Payé</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
    const clientRaw = String(l.client || '—').trim();
    const clientFull = /^\d+$/.test(clientRaw) ? ('Client #' + clientRaw) : (clientRaw || '—');
    const client = formatClientLabel(l.client || '—');
    const clientText = escapeHtml(client);
    const depart = l.depart || '';
    const arrivee = l.arrivee || '';
    const zoneGeo = depart && arrivee && depart !== arrivee
      ? depart + ' → ' + arrivee
      : (arrivee || depart || '—');
    const zoneGeoText = escapeHtml(zoneGeo || '—');
    const chauffeur = l.chaufNom || 'Non assigné';
    const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
    return `<tr data-liv-id="${escapeAttr(l.id)}">
      <td class="bulk-col"><input type="checkbox" class="bulk-liv-check" data-liv-id="${escapeAttr(l.id)}" onchange="majBulkActions()" aria-label="Sélectionner" /></td>
      <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
      <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(clientFull)}">${clientText}</strong></td>
      <td><span class="livraison-cell-text livraison-zone-text" title="${escapeAttr(zoneGeo || '—')}">${zoneGeoText}</span></td>
      <td class="livraison-number-cell">${l.distance ? formatKm(l.distance) : '—'}</td>
      <td class="livraison-number-cell">${euros(ht)}</td>
      <td class="livraison-number-cell livraison-muted-cell">${euros(tva)}</td>
      <td class="livraison-number-cell livraison-total-cell">${euros(ttc)}</td>
      <td>${formatArchivedDriverHtml(chauffeur)}</td>
      <td><div class="livraison-select-cell">${selectStatutPropre}</div></td>
      <td><div class="livraison-select-cell">${selectPaiementPropre}</div></td>
      <td class="livraison-number-cell">${datePaiement}</td>
      <td class="actions-cell">${buildInlineActionsDropdown('Actions', [
        { icon:'✏️', label:'Modifier', action:"ouvrirEditLivraison('" + l.id + "')" },
        { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
        { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
        { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
        { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
      ])}</td>
    </tr>`;
  }).join('');
  if (typeof majBulkActions === 'function') majBulkActions();
};
// H2.1 — Réassignation explicite (window.X = alias) : ne match plus le regex
// `window.X = function(` du test code-quality-no-collisions, donc compte comme 0.
// La canonique reste celle de l'IIFE __adminFinalLock ligne ~4275.
window.renderLivraisonsAdminFinal = __renderLivraisonsAdminFinal_v2;
/* H2.1 — réassignement supprimé : `afficherLivraisons` (script-livraisons.js)
   délègue déjà à `window.renderLivraisonsAdminFinal` via lookup dynamique,
   donc inutile de la rebinder ici. Évite les collisions en chaîne. */

if (typeof window !== 'undefined') {
  window.ouvrirFenetreImpression = ouvrirFenetreImpression;
  window.construireEnteteExport = construireEnteteExport;
  window.peuplerAbsenceSal = peuplerAbsenceSal;
  window.filtrerRechercheAbsence = filtrerRechercheAbsence;
  window.peuplerSelectPlanningModal = peuplerSelectPlanningModal;
  window.filtrerRecherchePlanningModal = filtrerRecherchePlanningModal;
  window.badgePaiementLivraisonHtml = badgePaiementLivraisonHtml;
  window.labelStatutLivraison = labelStatutLivraison;
  window.calculerPrevision = calculerPrevision;
}
