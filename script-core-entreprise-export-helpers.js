/**
 * MCA Logistics — Helpers export entreprise (params + mentions légales + bloc info + footer) (Phase X — extraction script.js)
 *
 * Extracted from script.js L293-396 (2026-05-16).
 */

function getEntrepriseExportParams() {
  const params = chargerObj('params_entreprise', {});
  const sessionAdmin = getAdminSession();
  const rcsCompose = params.rcs || [params.rcsVille, params.rcsNumero].filter(Boolean).join(' ');
  return {
    nom: params.nom || 'MCA LOGISTICS',
    nomAdmin: sessionAdmin.nom || params.nomAdmin || '',
    siret: params.siret || '',
    tvaIntracom: params.tvaIntracom || '',
    adresse: params.adresse || '',
    tel: params.tel || '',
    email: params.email || '',
    // Mentions légales CGI 242 nonies A / R123-237 C.com
    formeJuridique: params.formeJuridique || '',
    capital: params.capital || '',
    capitalLibere: params.capitalLibere || '',
    codeAPE: params.codeAPE || '',
    rcs: rcsCompose,
    rcsVille: params.rcsVille || '',
    rcsNumero: params.rcsNumero || '',
    adresseLigne: params.adresseLigne || '',
    codePostal: params.codePostal || '',
    ville: params.ville || '',
    pays: params.pays || 'FR',
    iban: params.iban || '',
    bic: params.bic || '',
    banque: params.banque || '',
    // Transport léger (Règl. CE 1071/2009 + L.3211-1 Code transports)
    ltiNumero: params.ltiNumero || '',
    ltiDateEmission: params.ltiDateEmission || '',
    ltiDateExpiration: params.ltiDateExpiration || '',
    drealDossier: params.drealDossier || '',
    registreTransporteurs: params.registreTransporteurs || '',
    gestionnaireNom: params.gestionnaireNom || '',
    capaciteProNumero: params.capaciteProNumero || '',
    capaciteProDate: params.capaciteProDate || '',
    tauxPenalitesRetard: params.tauxPenalitesRetard != null ? params.tauxPenalitesRetard : 10.15,
    delaiPaiementDefaut: params.delaiPaiementDefaut != null ? params.delaiPaiementDefaut : 30
  };
}

// BUG-010 fix : validation du numéro de TVA intracommunautaire FR (clé + SIREN).
// Algorithme officiel : clé = (12 + 3 × (SIREN mod 97)) mod 97.
// Les numéros "new TVA" (clé non-numérique comme "H2", "L1"...) passent le format
// mais on ne valide pas la checksum dans ce cas (rare, principalement pour les
// doublons administratifs). On rejette uniquement les cas où la clé EST numérique
// mais invalide.
// MOVED -> script-tva.js : validerTVAIntracomFR

// BUG-002 helpers : blocs HTML partagés entre buildFactureHTML et genererFactureLivraison
// MOVED -> script-core-utils.js : __formatEurFR
function renderFactureMentionsEntrepriseHeader(params) {
  const parts = [];
  if (params.formeJuridique) parts.push(params.formeJuridique);
  if (params.capital) parts.push('capital ' + __formatEurFR(params.capital));
  // Mention RCS : si numéro présent -> "RCS <ville> <numéro>", sinon si ville seule -> "Société en cours d'immatriculation au RCS <ville>"
  if (params.rcsNumero && params.rcsVille) {
    parts.push('RCS ' + params.rcsVille + ' ' + params.rcsNumero);
  } else if (params.rcs && !params.rcsVille && !params.rcsNumero) {
    parts.push('RCS ' + params.rcs);
  } else if (params.rcsVille && !params.rcsNumero) {
    parts.push('Société en cours d\'immatriculation au RCS ' + params.rcsVille);
  }
  if (params.codeAPE) parts.push('APE ' + params.codeAPE);
  if (params.siret) parts.push('SIRET ' + params.siret);
  if (!parts.length) return '';
  return '<div style="font-size:.72rem;color:#9ca3af;margin-top:4px">' + planningEscapeHtml(parts.join(' · ')) + '</div>';
}
// MOVED -> script-clients.js : renderFactureClientBlock
function renderFacturePiedMentionsLegales(params, livraison, clientFiche) {
  const delaiClient = clientFiche && parseInt(clientFiche.delaiPaiementJours, 10);
  const delai = (delaiClient && delaiClient > 0)
    ? delaiClient
    : (parseInt(params.delaiPaiementDefaut, 10) || 30);
  const tauxPenalites = parseFloat(params.tauxPenalitesRetard);
  const tauxFmt = (Number.isFinite(tauxPenalites) ? tauxPenalites : 10.15).toFixed(2).replace('.', ',');
  const lignesBanque = [];
  if (params.iban) lignesBanque.push('IBAN : ' + params.iban);
  if (params.bic) lignesBanque.push('BIC : ' + params.bic);
  const dateLivraison = livraison && livraison.date ? formatDateExport(livraison.date) : '';
  return '<div style="margin-top:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;font-size:.72rem;color:#4b5563;line-height:1.55">'
    + '<div style="font-weight:700;color:#111827;margin-bottom:4px">Conditions de règlement</div>'
    + (dateLivraison ? '<div>Date de livraison / prestation : <strong>' + planningEscapeHtml(dateLivraison) + '</strong></div>' : '')
    + '<div>Paiement à <strong>' + delai + ' jours</strong> à compter de la date d\'émission (art. L441-10 Code de commerce).</div>'
    + '<div>En cas de retard de paiement, application de pénalités de retard au taux annuel de <strong>' + tauxFmt + ' %</strong> (taux BCE majoré de 10 points, art. L441-10 C. com.).</div>'
    + '<div>Indemnité forfaitaire de recouvrement de <strong>40 €</strong> due de plein droit en cas de retard (art. D441-5 C. com.).</div>'
    + '<div>Pas d\'escompte pour paiement anticipé.</div>'
    + (lignesBanque.length ? '<div style="margin-top:6px">' + planningEscapeHtml(lignesBanque.join(' · ')) + '</div>' : '')
    + '</div>';
}
function renderBlocInfosEntreprise(params) {
  const logo = renderLogoEntrepriseExport();
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:18px">`
    + `<div><div style="font-size:1.35rem;font-weight:800;color:#e63946">${planningEscapeHtml(params.nom || 'MCA Logistics')}</div>`
    + (params.adresse ? `<div style="font-size:.86rem;color:#6b7280;margin-top:4px">${planningEscapeHtml(params.adresse)}</div>` : '')
    + (params.tel ? `<div style="font-size:.82rem;color:#6b7280;margin-top:2px">Tél. : ${planningEscapeHtml(params.tel)}</div>` : '')
    + (params.email ? `<div style="font-size:.82rem;color:#6b7280;margin-top:2px">Email : ${planningEscapeHtml(params.email)}</div>` : '')
    + `</div>`
    + (logo || '')
    + `</div>`;
}
function renderFooterEntreprise(params, dateExp, extra) {
  return `<div style="border-top:1px solid #e5e7eb;margin-top:20px;padding-top:10px;font-size:.72rem;color:#9ca3af;display:flex;justify-content:space-between;gap:12px"><span>${extra || params.nom}</span><span>${dateExp}</span></div>`;
}

if (typeof window !== 'undefined') {
  window.getEntrepriseExportParams = getEntrepriseExportParams;
  window.renderFactureMentionsEntrepriseHeader = renderFactureMentionsEntrepriseHeader;
  window.renderFacturePiedMentionsLegales = renderFacturePiedMentionsLegales;
  window.renderBlocInfosEntreprise = renderBlocInfosEntreprise;
  window.renderFooterEntreprise = renderFooterEntreprise;
}
