/**
 * MCA Logistics — Registre RGPD art. 30 (Phase X.C — extraction script.js)
 *
 * Génère le registre des activités de traitement conforme à l'article 30 du
 * Règlement (UE) 2016/679. 4 traitements documentés : salariés, clients, flotte,
 * alertes/incidents. Volumétrie indicative dynamique.
 *
 * Dependencies (globals) : getEntrepriseExportParams, planningEscapeHtml,
 * formatDateHeureExport, charger, ouvrirFenetreImpression, ajouterEntreeAudit.
 *
 * Extracted from script.js L3717-3816 (Phase X.C, 2026-05-16).
 */

function genererRegistreRGPD() {
  const params = getEntrepriseExportParams();
  const esc = planningEscapeHtml;
  const dateExp = formatDateHeureExport();
  const nbSalaries = (charger('salaries') || []).length;
  const nbClients = (charger('clients') || []).length;
  const nbLivraisons = (charger('livraisons') || []).length;

  const traitements = [
    {
      nom: 'Gestion des salariés et contrats',
      finalite: 'Suivi des contrats, permis B, visite médicale du travail, incidents, paie externalisée',
      base: 'Exécution du contrat de travail (art. 6.1.b) + obligation légale (art. 6.1.c — R.4624-10 Code travail, L.3211-1 Code transports)',
      categories: 'Identité, contact, nº SS, permis B, visite médicale, incidents, kilométrage, heures travaillées',
      destinataires: 'Direction, gestionnaire paie externe (logiciel de paie), URSSAF via DSN, DREAL sur demande',
      duree: 'Durée du contrat + 5 ans (L1471-1 Code travail) / 10 ans documents sociaux',
      securite: 'Authentification PBKDF2 (210 000 itérations), chiffrement transport HTTPS, Supabase Row-Level Security, journal d\'audit'
    },
    {
      nom: 'Gestion de la clientèle',
      finalite: 'Tenue du carnet clients, émission de livraisons, historique commandes, relances (délégué Pennylane), géolocalisation des lieux de chargement/déchargement',
      base: 'Exécution du contrat commercial (art. 6.1.b) + intérêt légitime (relances factures)',
      categories: 'Raison sociale, SIREN, TVA intracom, adresse, contact, téléphone, email, historique livraisons',
      destinataires: 'Direction, chauffeurs assignés, logiciel comptable (Pennylane), expert-comptable',
      duree: '10 ans pour les documents comptables (L123-22 Code commerce, L102 B LPF), 3 ans pour les données marketing',
      securite: 'Authentification PBKDF2, HTTPS, journal d\'audit, droit à la portabilité (art. 20) outillé via bouton export RGPD par client'
    },
    {
      nom: 'Gestion de la flotte et des livraisons',
      finalite: 'Suivi véhicules, entretiens, contrôles techniques, carburant, lettres de voiture (arrêté 09/11/1999), rentabilité',
      base: 'Exécution du contrat (art. 6.1.b) + obligation légale (art. 6.1.c — Code des transports)',
      categories: 'Immatriculation, VIN, carte grise, PTAC, Crit\'Air, consommation, trajets, km, marchandises transportées',
      destinataires: 'Direction, chauffeurs, DREAL / gendarmerie sur contrôle routier, assureur en cas de sinistre',
      duree: 'Lettre de voiture : 5 ans (R.3411-13 Code transports). Documents véhicule (carte grise, CT, entretien) : durée d\'usage + 3 ans',
      securite: 'Authentification PBKDF2, chiffrement transport, Supabase RLS, journal d\'audit'
    },
    {
      nom: 'Gestion des alertes et incidents',
      finalite: 'Détection automatique des expirations permis / assurance / visite médicale. Enregistrement des incidents transport',
      base: 'Intérêt légitime (prévention des risques professionnels, L121-1 Code pénal — responsabilité exploitant)',
      categories: 'Dates d\'expiration documents obligatoires, nature incidents, gravité, description',
      destinataires: 'Direction, chauffeur concerné (notification), assurance en cas de sinistre',
      duree: '1 an après traitement ou fermeture incident, 5 ans pour incidents sinistrés',
      securite: 'Authentification PBKDF2, HTTPS, journal d\'audit'
    }
  ];

  const cellStyle = 'padding:10px 12px;border:1px solid #e5e7eb;vertical-align:top;font-size:.82rem;line-height:1.5';
  const headStyle = 'padding:10px 12px;border:1px solid #e5e7eb;text-align:left;background:#f8fafc;font-size:.78rem;text-transform:uppercase;color:#6b7280;font-weight:700';

  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1080px;margin:0 auto;padding:28px;color:#111827;background:#fff">'
    + '<div style="border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:20px">'
    + '<div style="font-size:1.4rem;font-weight:900">Registre des activités de traitement</div>'
    + '<div style="font-size:.85rem;color:#6b7280;margin-top:4px">Article 30 du Règlement (UE) 2016/679 (RGPD) · ' + esc(dateExp) + '</div>'
    + '</div>'
    + '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:20px">'
    + '<div style="font-size:.78rem;text-transform:uppercase;color:#6b7280;font-weight:700;margin-bottom:8px">Responsable du traitement</div>'
    + '<div style="font-weight:700;font-size:1rem">' + esc(params.nom || '—') + '</div>'
    + (params.adresse ? '<div style="font-size:.85rem;color:#4b5563;margin-top:4px">' + esc(params.adresse) + '</div>' : '')
    + (params.siret ? '<div style="font-size:.82rem;color:#6b7280;margin-top:4px">SIRET : ' + esc(params.siret) + '</div>' : '')
    + (params.email ? '<div style="font-size:.82rem;color:#6b7280;margin-top:2px">Contact : ' + esc(params.email) + '</div>' : '')
    + '<div style="font-size:.82rem;color:#6b7280;margin-top:6px"><strong>Volumétrie indicative :</strong> ' + nbSalaries + ' salarié(s) · ' + nbClients + ' client(s) · ' + nbLivraisons + ' livraison(s) enregistrée(s).</div>'
    + '<div style="font-size:.78rem;color:#9ca3af;margin-top:6px;font-style:italic">DPO : à désigner obligatoirement si traitement à grande échelle de données sensibles ou si effectif &ge; 250 salariés. Sinon, responsable = dirigeant de l\'entreprise.</div>'
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">'
    + '<thead><tr>'
    + '<th style="' + headStyle + '">Traitement</th>'
    + '<th style="' + headStyle + '">Finalité</th>'
    + '<th style="' + headStyle + '">Base légale</th>'
    + '<th style="' + headStyle + '">Données collectées</th>'
    + '<th style="' + headStyle + '">Destinataires</th>'
    + '<th style="' + headStyle + '">Durée de conservation</th>'
    + '<th style="' + headStyle + '">Mesures de sécurité</th>'
    + '</tr></thead><tbody>'
    + traitements.map(function (t) {
      return '<tr>'
        + '<td style="' + cellStyle + ';font-weight:700">' + esc(t.nom) + '</td>'
        + '<td style="' + cellStyle + '">' + esc(t.finalite) + '</td>'
        + '<td style="' + cellStyle + '">' + esc(t.base) + '</td>'
        + '<td style="' + cellStyle + '">' + esc(t.categories) + '</td>'
        + '<td style="' + cellStyle + '">' + esc(t.destinataires) + '</td>'
        + '<td style="' + cellStyle + '">' + esc(t.duree) + '</td>'
        + '<td style="' + cellStyle + '">' + esc(t.securite) + '</td>'
        + '</tr>';
    }).join('')
    + '</tbody></table>'
    + '<div style="font-size:.8rem;color:#4b5563;line-height:1.6;padding:12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;margin-bottom:14px">'
    + '<strong>⚠️ Droits des personnes concernées :</strong><br>'
    + '— Accès à ses données (art. 15)<br>'
    + '— Rectification (art. 16) · directement depuis la fiche concernée<br>'
    + '— Effacement (art. 17) · sur demande écrite, sous 1 mois<br>'
    + '— Portabilité (art. 20) · outillée via bouton "Export RGPD" sur fiche client<br>'
    + '— Opposition (art. 21) · traitement arrêté si légitime<br>'
    + '— Réclamation auprès de la CNIL : www.cnil.fr/plaintes</div>'
    + '<div style="font-size:.72rem;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px">Registre édité le ' + esc(dateExp) + ' · À tenir à jour à chaque modification de traitement · À présenter à la CNIL en cas de contrôle</div>'
    + '</div>';
  ouvrirFenetreImpression('Registre RGPD art. 30 — ' + (params.nom || ''), html, 'width=1120,height=820');
  ajouterEntreeAudit('Registre RGPD', 'Registre des traitements généré (art. 30 UE 2016/679)');
}

if (typeof window !== 'undefined') {
  window.genererRegistreRGPD = genererRegistreRGPD;
}
