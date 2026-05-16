/**
 * MCA Logistics — window.__adminFinalLock IIFE — override final UX au boot (Phase X — extraction script.js)
 *
 * Extracted from script.js L1740-1864 (2026-05-16).
 */

window.__adminFinalLock = function() {
  ouvrirFenetreImpression = function(titre, html, options) {
    const win = ouvrirPopupSecure('', '_blank', options || 'width=900,height=700');
    if (!win) return;
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>body{margin:0;padding:20px;background:#fff;font-family:Segoe UI,Arial,sans-serif}.export-logo{width:58px;height:58px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:6px}@page{margin:12mm}</style></head><body>' + html + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});<\/script></body></html>');
    win.document.close();
  };

  // construireEnteteExport : ancienne définition supprimée (code mort —
  // écrasée par les redéfinitions ultérieures du fichier).

  peuplerAbsenceSal = function() { planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist'); };
  filtrerRechercheAbsence = function() {
    var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
    if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
  };
  peuplerSelectPlanningModal = function() { planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist'); };
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

  window.renderLivraisonsAdminFinal = function() {
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
      return;
    }

    const escapeAttr = window.escapeAttr;
    const escapeHtml = window.escapeHtml;
    const formatClientLabel = function(value) {
      var raw = String(value || '').trim();
      if (!raw) return '—';
      return /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
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
      const client = formatClientLabel(l.client || '—');
      const clientText = escapeHtml(client);
      const depart = l.depart || '';
      const arrivee = l.arrivee || '';
      const zoneGeo = depart && arrivee && depart !== arrivee ? depart + ' → ' + arrivee : (arrivee || depart || '—');
      const zoneGeoText = escapeHtml(zoneGeo || '—');
      const chauffeur = l.chaufNom || 'Non assigné';
      const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
      return `<tr>
        <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
        <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(client)}">${clientText}</strong></td>
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
          { icon:'📄', label:'Bon de livraison', action:"genererBonLivraison('" + l.id + "')" },
          { icon:'🧾', label:'Facture', action:"genererFactureLivraison('" + l.id + "')" },
          { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
          { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
          { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
          { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
        ])}</td>
      </tr>`;
    }).join('');
  }

  afficherLivraisons = window.renderLivraisonsAdminFinal;
};
