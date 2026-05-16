/**
 * MCA Logistics — Lettre de voiture CMR (Phase X.E — extraction script.js)
 *
 * Génère la Lettre De Voiture (LDV) obligatoire pour le transport de marchandises
 * (arrêté 09/11/1999 modifié + décret 2017-443). Détecte les champs manquants et
 * affiche un bandeau d alerte si incomplet. Bloc ADR spécifique chapitre 5.4 ADR 2025.
 *
 * Dependencies (globals) : charger, afficherToast, getEntrepriseExportParams,
 * normalizeLDV (optionnel), formatDateExport, formatDateHeureExport, planningEscapeHtml,
 * euros, ouvrirFenetreImpression, ajouterEntreeAudit.
 *
 * Extracted from script.js L3582-3688 (Phase X.E, 2026-05-16).
 */

function genererLettreDeVoiture(livId) {
  const livraison = charger('livraisons').find(l => l.id === livId);
  if (!livraison) { afficherToast('⚠️ Livraison introuvable', 'error'); return; }
  const params = getEntrepriseExportParams();
  // Dual-read : normalise flat (mobile) -> nested pour rendre la LDV PC
  // visible meme pour les livraisons saisies cote mobile (R3 fix).
  if (typeof normalizeLDV === 'function') normalizeLDV(livraison);
  const exp = livraison.expediteur || {};
  const dest = livraison.destinataire || {};
  const merch = livraison.marchandise || {};
  const adr = livraison.adr || {};
  const dateLiv = livraison.date ? formatDateExport(livraison.date) : '—';
  const dateEmission = formatDateHeureExport();
  const numLDV = livraison.numLiv ? 'LDV-' + livraison.numLiv.replace(/^LIV-/, '') : 'LDV-' + (livraison.id || '').slice(0, 8);

  const esc = planningEscapeHtml;
  const adresseComplete = function(obj) {
    const parts = [obj.adresse, ((obj.cp || '') + ' ' + (obj.ville || '')).trim(), (obj.pays && obj.pays !== 'FR') ? obj.pays : ''];
    return parts.filter(Boolean).map(esc).join('<br>');
  };

  const manques = [];
  if (!exp.nom) manques.push('expéditeur');
  if (!exp.adresse || !exp.ville) manques.push('adresse chargement');
  if (!dest.nom) manques.push('destinataire');
  if (!dest.adresse || !dest.ville) manques.push('adresse déchargement');
  if (!merch.nature) manques.push('nature marchandise');
  if (!merch.poidsKg) manques.push('poids');
  if (!merch.nbColis) manques.push('nombre de colis');

  const bandeauAlerte = manques.length
    ? '<div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:.85rem"><strong>⚠️ Lettre de voiture incomplète.</strong> Champs manquants : ' + esc(manques.join(', ')) + '. Complétez-les sur la fiche livraison pour un document légalement conforme (arrêté 09/11/1999).</div>'
    : '';

  const blocADR = adr.estADR
    ? '<div style="margin-top:14px;padding:12px;border:2px solid #dc2626;background:#fef2f2;border-radius:8px">'
      + '<div style="font-weight:800;color:#dc2626;font-size:.95rem;margin-bottom:6px">⚠️ TRANSPORT ADR — MATIÈRES DANGEREUSES (chapitre 5.4 ADR 2025)</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:.85rem">'
      + '<div><strong>Code ONU :</strong> ' + esc(adr.codeONU || '—') + '</div>'
      + '<div><strong>Classe :</strong> ' + esc(adr.classe || '—') + '</div>'
      + '<div><strong>Groupe emballage :</strong> ' + esc(adr.groupeEmballage || '—') + '</div>'
      + '</div></div>'
    : '';

  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:28px;color:#111827;background:#fff">'
    + bandeauAlerte
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #111827;padding-bottom:12px">'
    + '<div><div style="font-size:1.4rem;font-weight:900">LETTRE DE VOITURE</div>'
    + '<div style="font-size:.8rem;color:#6b7280;margin-top:4px">N° ' + esc(numLDV) + ' · ' + esc(dateLiv) + '</div>'
    + '<div style="font-size:.72rem;color:#9ca3af;margin-top:2px">Document obligatoire — arrêté 09/11/1999 modifié + décret 2017-443</div></div>'
    + '<div style="text-align:right;font-size:.82rem"><div><strong>' + esc(params.nom || '') + '</strong>'
    + (params.formeJuridique ? ' <span style="color:#6b7280;font-weight:500">' + esc(params.formeJuridique) + '</span>' : '')
    + '</div>'
    + (params.adresse ? '<div style="color:#6b7280">' + esc(params.adresse) + '</div>' : '')
    + ((params.codePostal || params.ville) ? '<div style="color:#6b7280">' + esc(((params.codePostal || '') + ' ' + (params.ville || '')).trim()) + '</div>' : '')
    + (params.siret ? '<div style="color:#6b7280;margin-top:2px">SIRET : ' + esc(params.siret) + '</div>' : (params.rcsVille && !params.rcsNumero ? '<div style="color:#6b7280;margin-top:2px">En cours d\'immatriculation RCS ' + esc(params.rcsVille) + '</div>' : ''))
    + '</div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">'
    + '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px">'
    + '<div style="font-size:.72rem;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-bottom:8px">Expéditeur / Chargeur</div>'
    + '<div style="font-weight:700;font-size:.95rem">' + esc(exp.nom || '—') + '</div>'
    + '<div style="font-size:.82rem;color:#4b5563;margin-top:6px">' + adresseComplete(exp) + '</div>'
    + (exp.contact ? '<div style="font-size:.78rem;color:#6b7280;margin-top:6px">Contact : ' + esc(exp.contact) + '</div>' : '')
    + '<div style="font-size:.78rem;color:#6b7280;margin-top:8px"><strong>Date chargement :</strong> ' + esc(dateLiv) + '</div>'
    + '</div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px">'
    + '<div style="font-size:.72rem;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-bottom:8px">Destinataire</div>'
    + '<div style="font-weight:700;font-size:.95rem">' + esc(dest.nom || '—') + '</div>'
    + '<div style="font-size:.82rem;color:#4b5563;margin-top:6px">' + adresseComplete(dest) + '</div>'
    + (dest.contact ? '<div style="font-size:.78rem;color:#6b7280;margin-top:6px">Contact : ' + esc(dest.contact) + '</div>' : '')
    + '<div style="font-size:.78rem;color:#6b7280;margin-top:8px"><strong>Date déchargement prévue :</strong> ' + esc(dateLiv) + '</div>'
    + '</div></div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px">'
    + '<div style="font-size:.72rem;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-bottom:8px">Marchandise</div>'
    + '<div style="font-size:.9rem;margin-bottom:8px"><strong>Nature :</strong> ' + esc(merch.nature || '—') + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:.85rem">'
    + '<div><strong>Poids brut :</strong> ' + (merch.poidsKg ? merch.poidsKg + ' kg' : '—') + '</div>'
    + '<div><strong>Volume :</strong> ' + (merch.volumeM3 ? merch.volumeM3 + ' m³' : '—') + '</div>'
    + '<div><strong>Nombre de colis :</strong> ' + (merch.nbColis || '—') + '</div>'
    + '</div></div>'
    + blocADR
    + '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-top:14px">'
    + '<div style="font-size:.72rem;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-bottom:8px">Transporteur</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:.85rem">'
    + '<div><strong>Société :</strong> ' + esc(params.nom || '—') + (params.formeJuridique ? ' ' + esc(params.formeJuridique) : '') + '</div>'
    + '<div><strong>SIRET :</strong> ' + esc(params.siret || 'En cours') + '</div>'
    + (params.ltiNumero ? '<div><strong>Licence Transport (LTI) :</strong> ' + esc(params.ltiNumero) + '</div>' : (params.drealDossier ? '<div><strong>Dossier DREAL :</strong> ' + esc(params.drealDossier) + '</div>' : ''))
    + (params.gestionnaireNom ? '<div><strong>Gestionnaire de transport :</strong> ' + esc(params.gestionnaireNom) + '</div>' : '')
    + '<div><strong>Chauffeur :</strong> ' + esc(livraison.chaufNom || '—') + '</div>'
    + '<div><strong>Immatriculation :</strong> ' + esc(livraison.vehNom || '—') + '</div>'
    + '<div><strong>Prix du transport :</strong> ' + euros(livraison.prixHT || livraison.prix || 0) + ' HT</div>'
    + '<div><strong>Distance :</strong> ' + (livraison.distance ? livraison.distance + ' km' : '—') + '</div>'
    + '</div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px">'
    + '<div style="border:1px dashed #9ca3af;border-radius:8px;padding:14px;min-height:80px"><div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">Signature expéditeur</div></div>'
    + '<div style="border:1px dashed #9ca3af;border-radius:8px;padding:14px;min-height:80px"><div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">Signature transporteur</div></div>'
    + '<div style="border:1px dashed #9ca3af;border-radius:8px;padding:14px;min-height:80px"><div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">Signature destinataire</div></div>'
    + '</div>'
    + '<div style="margin-top:16px;font-size:.7rem;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px">Édité le ' + esc(dateEmission) + ' · Conservation obligatoire 5 ans (R.3411-13 Code des transports)</div>'
    + '</div>';
  ouvrirFenetreImpression('Lettre de voiture ' + numLDV, html, 'width=1000,height=820');
  ajouterEntreeAudit('Lettre de voiture', numLDV + ' · ' + (livraison.client || 'Client') + (manques.length ? ' (incomplète : ' + manques.length + ' champs)' : ''));
  afficherToast(manques.length
    ? '⚠️ Lettre de voiture générée avec ' + manques.length + ' champ(s) manquant(s)'
    : 'Lettre de voiture générée');
}
if (typeof window !== "undefined") {
  window.genererLettreDeVoiture = genererLettreDeVoiture;
}
