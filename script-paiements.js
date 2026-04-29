/**
 * MCA Logistics — Module Paiements
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L9185 (script.js d'origine)
function sauvegarderRelanceDelai() {
  const val = parseInt(document.getElementById('relance-delai-input')?.value || document.getElementById('param-relance-delai')?.value, 10) || 7;
  localStorage.setItem('relance_delai', val);
  // Synchroniser les deux inputs
  const p = document.getElementById('param-relance-delai'); if (p) p.value = val;
  const r = document.getElementById('relance-delai-input'); if (r) r.value = val;
  afficherToast('✅ Délai relance : ' + val + ' jours');
}

// L9556 (script.js d'origine)
function getRelanceTemplatesDefaut() {
  return {
    1: 'Nous nous permettons de vous rappeler que la livraison {numLiv} du {dateLivraison} d’un montant de {montant} reste, à ce jour, impayée ({joursRetard} jours de retard).\n\nSi le règlement a déjà été effectué, merci de ne pas tenir compte de ce message. Dans le cas contraire, nous vous remercions de bien vouloir régulariser la situation dans les meilleurs délais.',
    2: 'Malgré notre précédente relance, nous constatons que la livraison {numLiv} du {dateLivraison} d’un montant de {montant} demeure impayée ({joursRetard} jours de retard).\n\nPar la présente, nous vous mettons en demeure de procéder au règlement sous 8 jours.',
    3: 'Nos précédentes relances étant restées sans effet, nous vous informons que la livraison {numLiv} du {dateLivraison} d’un montant de {montant} n’a toujours pas été réglée ({joursRetard} jours de retard).\n\nCe courrier constitue un dernier avis avant engagement d’une procédure contentieuse.'
  };
}

// L9564 (script.js d'origine)
function chargerTemplatesRelance() {
  var defaut = getRelanceTemplatesDefaut();
  var saved = chargerObj('relance_templates', {});
  return {
    1: saved['1'] || defaut[1],
    2: saved['2'] || defaut[2],
    3: saved['3'] || defaut[3]
  };
}

// L9574 (script.js d'origine)
function peuplerTemplatesRelance() {
  var templates = chargerTemplatesRelance();
  ['1', '2', '3'].forEach(function(level) {
    var el = document.getElementById('relance-template-' + level);
    if (el && !el.matches(':focus')) el.value = templates[level];
  });
}

// L9582 (script.js d'origine)
function ouvrirModalTemplatesRelance() {
  peuplerTemplatesRelance();
  openModal('modal-relance-templates');
}

// L9587 (script.js d'origine)
function sauvegarderTemplatesRelance() {
  var payload = {};
  ['1', '2', '3'].forEach(function(level) {
    var el = document.getElementById('relance-template-' + level);
    payload[level] = (el?.value || '').trim() || getRelanceTemplatesDefaut()[level];
  });
  sauvegarder('relance_templates', payload);
  afficherToast('✅ Texte de relance enregistré');
}

// L9597 (script.js d'origine)
function reinitialiserTemplatesRelance() {
  sauvegarder('relance_templates', getRelanceTemplatesDefaut());
  peuplerTemplatesRelance();
  afficherToast('Texte de relance réinitialisé');
}

// L9603 (script.js d'origine)
function construireTexteRelancePersonnalise(template, liv, params, joursRetard, montant) {
  return String(template || '')
    .replace(/\{client\}/g, liv.client || '')
    .replace(/\{numLiv\}/g, liv.numLiv || '')
    .replace(/\{dateLivraison\}/g, formatDateExport(liv.date))
    .replace(/\{montant\}/g, montant)
    .replace(/\{joursRetard\}/g, String(joursRetard))
    .replace(/\{societe\}/g, params.nom || 'MCA Logistics');
}

// L9613 (script.js d'origine)
function afficherRelances() {
  const tb = document.getElementById('tb-relances');
  if (!tb) return;
  paginer.__reload_tb_relances = afficherRelances;
  peuplerTemplatesRelance();
  const delai = parseInt(localStorage.getItem('relance_delai')||'7', 10);

  // Synchroniser l'input délai dans la page relances
  const inputDelai = document.getElementById('relance-delai-input');
  if (inputDelai && !inputDelai.matches(':focus')) inputDelai.value = delai;

  const today = new Date();
  today.setHours(0,0,0,0);
  const livraisons = charger('livraisons').filter(function(l) {
    return l.statut === 'livre'
      && getLivraisonStatutPaiement(l) !== 'payé'
      && (parseFloat(l.prix) || 0) > 0;
  }).sort(function(a, b) {
    return new Date((a.date || '')) - new Date((b.date || ''));
  });

  const totalEl = document.getElementById('relances-total');
  if (totalEl) totalEl.textContent = euros(livraisons.reduce((s,l)=>s+(l.prix||0),0));

  if (!livraisons.length) {
    nettoyerPagination('tb-relances');
    tb.innerHTML = emptyState('✅','Aucune relance nécessaire','Toutes les livraisons livrées sont payées ou récentes.');
    return;
  }

  paginer(livraisons, 'tb-relances', function(items) {
    return items.map(l => {
    const dateBase = new Date((l.date || '') + 'T00:00:00');
    const dateEcheance = new Date(dateBase);
    dateEcheance.setDate(dateEcheance.getDate() + delai);
    const joursRetard = Math.floor((today - dateEcheance) / (1000*60*60*24));
    const joursAffiches = Math.max(0, joursRetard);
    const niveau = joursRetard > 30 ? 3 : joursRetard > 15 ? 2 : joursRetard > 0 ? 1 : 0;
    const niveauLabel = niveau===3 ? '🔴 Dernier avis' : niveau===2 ? '🟡 Mise en demeure' : niveau===1 ? '🟢 Amiable' : '🔵 À suivre';
    return `<tr class="relance-row">
      <td><span style="font-size:.78rem;color:var(--text-muted)">${l.numLiv||'—'}</span></td>
      <td><strong>${l.client}</strong></td>
      <td>${formatDateExport(l.date || '')}</td>
      <td><strong>${euros(l.prix)}</strong></td>
      <td><span class="relance-badge">⏰ ${joursAffiches}j</span><br><span style="font-size:.7rem">${niveauLabel}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-icon" onclick="marquerPaye('${l.id}')" title="Marquer payé">💳</button>
        <button class="btn-rapport" onclick="genererLettreRelance('${l.id}',${Math.max(niveau,1)})" title="Lettre de relance" style="padding:4px 10px;font-size:.75rem">📄 Lettre</button>
      </td>
    </tr>`;
  }).join('');
  }, 12);
}

// L9681 (script.js d'origine)
function marquerRelance(id) {
  const livs = charger('livraisons');
  const idx  = livs.findIndex(l=>l.id===id);
  if (idx>-1) { livs[idx].derniereRelance=new Date().toISOString(); sauvegarder('livraisons',livs); afficherRelances(); afficherToast('📧 Relance notée'); }
}

// L10747 (script.js d'origine)
function genererLettreRelance(livId, niveau) {
  const liv = charger('livraisons').find(l=>l.id===livId);
  if (!liv) return;
  const params  = getEntrepriseExportParams();
  const nom     = params.nom;
  const dateExp = formatDateExport(new Date());
  const joursRetard = Math.floor((new Date()-new Date(liv.date))/(1000*60*60*24));
  const montant = euros(liv.prix||0);
  const logo = renderLogoEntrepriseExport();
  const templates = chargerTemplatesRelance();

  const niveaux = {
    1: {
      titre: 'RELANCE AMIABLE',
      couleur: '#2ecc71',
      objet: 'Relance amiable — Facture ' + (liv.numLiv||''),
      corps: construireTexteRelancePersonnalise(templates[1], liv, params, joursRetard, montant).replace(/\n/g, '<br><br>')
    },
    2: {
      titre: 'MISE EN DEMEURE',
      couleur: '#f39c12',
      objet: 'Mise en demeure — Facture ' + (liv.numLiv||''),
      corps: construireTexteRelancePersonnalise(templates[2], liv, params, joursRetard, montant).replace(/\n/g, '<br><br>')
    },
    3: {
      titre: 'DERNIER AVIS AVANT CONTENTIEUX',
      couleur: '#e74c3c',
      objet: 'Dernier avis avant procédure — Facture ' + (liv.numLiv||''),
      corps: construireTexteRelancePersonnalise(templates[3], liv, params, joursRetard, montant).replace(/\n/g, '<br><br>')
    }
  };
  var n = niveaux[niveau] || niveaux[1];

  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;color:#1a1d27">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">' +
      '<div><div style="font-size:1.3rem;font-weight:800;color:#f5a623">' + nom + '</div>' +
      (params.adresse ? '<div style="font-size:.82rem;color:#6b7280;margin-top:2px">' + params.adresse + '</div>' : '') +
      (params.tel ? '<div style="font-size:.82rem;color:#6b7280">📞 ' + params.tel + '</div>' : '') +
      (params.email ? '<div style="font-size:.82rem;color:#6b7280">✉️ ' + params.email + '</div>' : '') +
      (params.siret ? '<div style="font-size:.78rem;color:#9ca3af;margin-top:4px">SIRET : ' + params.siret + '</div>' : '') +
      (params.nomAdmin ? '<div style="font-size:.78rem;color:#9ca3af">Contact : ' + params.nomAdmin + '</div>' : '') +
      '</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;text-align:right">' + (logo || '') + '<div style="font-size:.82rem;color:#9ca3af">' + dateExp + '</div></div></div>' +
    '<div style="text-align:center;margin:24px 0;padding:12px;background:' + n.couleur + '15;border:2px solid ' + n.couleur + ';border-radius:10px">' +
      '<div style="font-size:1.1rem;font-weight:800;color:' + n.couleur + ';letter-spacing:2px">' + n.titre + '</div></div>' +
    '<div style="margin-bottom:20px"><div style="font-size:.85rem;color:#6b7280;margin-bottom:4px">Destinataire :</div><div style="font-size:1rem;font-weight:700">' + liv.client + '</div></div>' +
    '<div style="font-size:.88rem;margin-bottom:24px;padding:16px;background:#f8f9fc;border-radius:8px;border-left:4px solid ' + n.couleur + '"><strong>Objet :</strong> ' + n.objet + '</div>' +
    '<div style="font-size:.9rem;line-height:1.7;margin-bottom:24px"><p>Madame, Monsieur,</p><p>' + n.corps + '</p><p>Nous restons à votre disposition pour tout renseignement complémentaire.</p><p>Veuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.</p></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0;padding:14px;background:#f8f9fc;border-radius:8px">' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Référence</div><div style="font-weight:700">' + (liv.numLiv||'—') + '</div></div>' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Date livraison</div><div style="font-weight:700">' + formatDateExport(liv.date) + '</div></div>' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Montant dû</div><div style="font-weight:700;color:' + n.couleur + ';font-size:1.1rem">' + montant + '</div></div>' +
      '<div><div style="font-size:.72rem;color:#9ca3af;text-transform:uppercase">Retard</div><div style="font-weight:700">' + joursRetard + ' jours</div></div></div>' +
    '<div style="margin-top:32px;text-align:right"><div style="font-size:.9rem;font-weight:600">' + (params.nomAdmin||'La Direction') + '</div><div style="font-size:.82rem;color:#6b7280">' + nom + '</div></div>' +
    '<div style="border-top:1px solid #e5e7eb;margin-top:40px;padding-top:10px;font-size:.7rem;color:#9ca3af;text-align:center">' + nom + ' — ' + dateExp + '</div></div>';

  ouvrirFenetreImpression(n.titre + ' - ' + liv.client, html, 'width=800,height=900');

  var livs = charger('livraisons');
  var idx = livs.findIndex(function(l){return l.id===livId;});
  if (idx>-1) { livs[idx].derniereRelance=new Date().toISOString(); livs[idx].niveauRelance=niveau; sauvegarder('livraisons',livs); }
  afficherRelances();
  afficherToast('📄 Lettre de relance niveau ' + niveau + ' générée');
}

