/**
 * MCA Logistics — Vérification notifications auto mois 2+ (relances livraisons impayées + CT + charges + planning manquant + inspection) (Phase X — extraction script.js)
 *
 * Extracted from script.js L2101-2221 (2026-05-16).
 */

function verifierNotificationsAutomatiquesMois2() {
  const alertes = charger('alertes_admin');
  const auj = new Date();
  auj.setHours(0,0,0,0);
  const delai = parseInt(localStorage.getItem('relance_delai') || '7', 10) || 7;

  charger('livraisons').forEach(function(item) {
    if (item.statut !== 'livre' || getLivraisonStatutPaiement(item) === 'payé') return;
    const dateBase = new Date((item.date || '') + 'T00:00:00');
    if (Number.isNaN(dateBase.getTime())) return;
    const dateEcheance = new Date(dateBase);
    dateEcheance.setDate(dateEcheance.getDate() + delai);
    const joursRetard = Math.floor((auj - dateEcheance) / 86400000);
    if (joursRetard <= 0) return;
    const niveau = joursRetard > 30 ? 3 : joursRetard > 15 ? 2 : 1;
    const label = niveau === 3 ? 'Dernier avis' : niveau === 2 ? 'Mise en demeure' : 'Relance amiable';
    ajouterAlerteSiAbsente('relance_auto', `${label} à envoyer — ${item.client} (${item.numLiv || 'livraison'})`, {
      livId: item.id,
      stageKey: 'relance-' + niveau + '-' + item.id,
      client: item.client || '',
      numLiv: item.numLiv || ''
    });
  });

  const nowIso = aujourdhui();
  const seuilsVehicule = [30, 15, 7];
  const seuilsDate = {};
  seuilsVehicule.forEach(function(jours) {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + jours);
    seuilsDate[jours] = dateToLocalISO(d);
  });
  charger('vehicules').forEach(function(item) {
    const ctIso = normaliserDateISO(item.dateCT);
    if (!ctIso) return;
    if (ctIso < nowIso) {
      ajouterAlerteSiAbsente('ct_expire', `⚠️ Contrôle technique expiré — ${item.immat}`, { vehId:item.id, stageKey:'ct-expire-' + item.id });
      return;
    }
    const seuil = [7, 15, 30].find(function(jours) { return ctIso <= seuilsDate[jours]; });
    if (seuil) {
      ajouterAlerteSiAbsente('ct_proche', `CT à renouveler dans ${seuil} jour(s) — ${item.immat} (${formatDateExport(ctIso)})`, {
        vehId:item.id,
        stageKey:'ct-' + seuil + '-' + item.id
      });
    }
  });

  // PGI : alertes retard paiement charges (echeance = date charge + delai
  // fournisseur, defaut 30j). On n'alerte que si statut still "a_payer".
  charger('charges').forEach(function(c) {
    var statut = c.statutPaiement || 'a_payer';
    if (statut === 'paye' || statut === 'partiel') return;
    var ech = (typeof getChargeDateEcheance === 'function') ? getChargeDateEcheance(c) : null;
    if (!ech) return;
    var joursRetard = Math.floor((auj - ech) / 86400000);
    if (joursRetard < 0) return;
    var libelle = (c.fournisseur || c.description || c.categorie || 'charge');
    var msg;
    if (joursRetard === 0) msg = 'Charge à payer aujourd’hui — ' + libelle + ' (' + euros(c.montant || 0) + ')';
    else msg = 'Charge en retard de paiement (' + joursRetard + 'j) — ' + libelle + ' (' + euros(c.montant || 0) + ')';
    ajouterAlerteSiAbsente('charge_retard_paiement', msg, {
      chargeId: c.id,
      stageKey: 'charge-retard-' + c.id + '-' + (joursRetard > 30 ? '30' : joursRetard > 7 ? '7' : '0')
    });
  });

  // PGI : sweep anomalies carburant (conso anormale + capacite reservoir)
  if (typeof sweepAnomaliesCarburant === 'function') {
    try { sweepAnomaliesCarburant(); } catch (e) { console.warn('[anomalies-carb] sweep:', e); }
  }

  // PGI : salaries actifs sans planning defini (template vide ou aucun jour de
  // travail). Detecte les onboardings incomplets et evite les angles morts RH.
  charger('salaries').forEach(function(sal) {
    if (!sal || sal.statut === 'inactif' || sal.archive) return;
    var planning = (charger('plannings') || []).find(function(p) { return p.salId === sal.id; });
    var aJourTravail = planning && Array.isArray(planning.semaine)
      && planning.semaine.some(function(j) { return j.typeJour === 'travail' || j.travaille === true; });
    if (!aJourTravail) {
      ajouterAlerteSiAbsente('planning_manquant',
        'Aucun planning de travail défini — ' + (sal.nom || sal.id),
        { salId: sal.id, salNom: sal.nom || '', stageKey: 'planning-manquant-' + sal.id });
    }
  });

  // PGI : vehicules sans inspection recente. Securite operationnelle (etat
  // vehicule, conformite). Seuil 30j = avertissement, 60j = critique.
  var inspections = charger('inspections') || [];
  var lastInspByVeh = {};
  inspections.forEach(function(insp) {
    if (!insp || !insp.vehId) return;
    var d = insp.date || (insp.creeLe ? insp.creeLe.slice(0, 10) : '');
    if (!d) return;
    if (!lastInspByVeh[insp.vehId] || d > lastInspByVeh[insp.vehId]) {
      lastInspByVeh[insp.vehId] = d;
    }
  });
  var aujMs = Date.now();
  charger('vehicules').forEach(function(v) {
    if (!v || v.archive) return;
    var last = lastInspByVeh[v.id];
    var ageJ = last ? Math.floor((aujMs - new Date(last).getTime()) / 86400000) : null;
    if (last == null) {
      ajouterAlerteSiAbsente('inspection_manquante',
        'Aucune inspection enregistrée — ' + (v.immat || v.id),
        { vehId: v.id, stageKey: 'insp-manquante-jamais-' + v.id });
    } else if (ageJ >= 60) {
      ajouterAlerteSiAbsente('inspection_manquante',
        'Pas d\'inspection depuis ' + ageJ + ' jours (>60j) — ' + (v.immat || v.id),
        { vehId: v.id, stageKey: 'insp-manquante-60-' + v.id });
    } else if (ageJ >= 30) {
      ajouterAlerteSiAbsente('inspection_manquante',
        'Pas d\'inspection depuis ' + ageJ + ' jours — ' + (v.immat || v.id),
        { vehId: v.id, stageKey: 'insp-manquante-30-' + v.id });
    }
  });

  if (alertes.length !== charger('alertes_admin').length) afficherBadgeAlertes();
}

if (typeof window !== 'undefined') {
  window.verifierNotificationsAutomatiquesMois2 = verifierNotificationsAutomatiquesMois2;
}
