/**
 * MCA Logistics — Module Alertes
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L1511 (script.js d'origine)
function afficherAlerteVerrouModal(modalId, message) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const body = modal.querySelector('.modal-body');
  if (!body) return;
  let banner = modal.querySelector('.edit-lock-alert');
  if (!message) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'edit-lock-alert';
    banner.style.cssText = 'margin-bottom:14px;padding:12px 14px;border-radius:10px;border:1px solid rgba(231,76,60,.35);background:rgba(231,76,60,.1);color:#ffb3aa;font-size:.84rem;line-height:1.4';
    body.insertBefore(banner, body.firstChild);
  }
  banner.textContent = message;
}

// L2088 (script.js d'origine)
function ajouterAlerte(type, message, meta) {
  const alertes = charger('alertes_admin');
  alertes.push({ id: genId(), type, message, meta: meta || {}, lu: false, traitee: false, creeLe: new Date().toISOString() });
  sauvegarder('alertes_admin', alertes);
}

// L2094 (script.js d'origine)
function compterAlertesNonLues() {
  return charger('alertes_admin').filter(a => !a.lu && !a.traitee && !estReportee(a)).length;
}

// L2098 (script.js d'origine)
function afficherBadgeAlertes() {
  const n = compterAlertesNonLues();
  const el = document.getElementById('badge-alertes');
  if (!el) return;
  el.textContent = n > 0 ? n : '';
  el.style.display = n > 0 ? 'inline-flex' : 'none';
}

// L3763 (script.js d'origine)
function ajouterAlerteSiAbsente(type, message, meta) {
  const alertes = charger('alertes_admin');
  const scopeMatch = function(alertItem) {
    if (!meta) return true;
    if (meta.stageKey) return alertItem.meta?.stageKey === meta.stageKey;
    if (meta.vehId) return alertItem.meta?.vehId === meta.vehId;
    if (meta.salId) return alertItem.meta?.salId === meta.salId;
    if (meta.livId) return alertItem.meta?.livId === meta.livId;
    return true;
  };
  const existe  = alertes.find(a => a.type === type && scopeMatch(a) && !a.traitee);
  if (!existe) ajouterAlerte(type, message, meta);
}

function estReportee(a) {
  return a?.meta?.repousseJusquA && new Date(a.meta.repousseJusquA) > new Date();
}

// L3952 (script.js d'origine)
function afficherAlertes() {
  const toutes  = charger('alertes_admin').sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe));

  // Filtres
  const filtreType   = document.getElementById('filtre-alerte-type')?.value || '';
  const filtreSal    = document.getElementById('filtre-alerte-salarie')?.value || '';
  const filtreStatut = document.getElementById('filtre-alerte-statut')?.value || 'actives';
  const filtreDate   = document.getElementById('filtre-alerte-date')?.value || '';

  // Remplir select salarié si vide
  const selSal = document.getElementById('filtre-alerte-salarie');
  if (selSal && selSal.options.length <= 1) {
    charger('salaries').forEach(s => { selSal.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
  }

  let filtered = toutes;
  if (filtreStatut === 'actives')   filtered = filtered.filter(a => !a.traitee && !estReportee(a));
  if (filtreStatut === 'traitees')  filtered = filtered.filter(a => a.traitee);
  if (filtreStatut === 'reportees') filtered = filtered.filter(a => !a.traitee && estReportee(a));
  if (filtreType)   filtered = filtered.filter(a => a.type === filtreType);
  if (filtreSal)    filtered = filtered.filter(a => a.meta?.salId === filtreSal);
  if (filtreDate)   filtered = filtered.filter(a => (a.creeLe||'').startsWith(filtreDate));

  const actives = filtered.filter(a => !a.traitee);
  const traitees = filtered.filter(a => a.traitee);

  // Marquer toutes comme lues
  const toutesDejaLues = toutes.every(a => a.lu);
if (!toutesDejaLues) {
  sauvegarder('alertes_admin', toutes.map(a => ({ ...a, lu: true })));
}
  afficherBadgeAlertes();

  // Afficher/masquer la section historique selon le filtre
  const cardTraitees = document.getElementById('card-alertes-traitees');
  if (cardTraitees) cardTraitees.style.display = (filtreStatut === 'actives' || filtreStatut === 'reportees') ? 'none' : 'block';

  // ── Catégories d'alertes (sévérité : critique / alerte / info) ──
  // critique = action immédiate (sécurité, conformité, cash) ; alerte = à traiter cette semaine ; info = trace de modif salarié
  const categories = [
    // 🔴 CRITIQUE
    { type: 'ct_expire',              severity: 'critique', label: '⚠️ Contrôles techniques expirés',           color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)'  },
    { type: 'permis_expire',          severity: 'critique', label: '⚠️ Permis de conduire expirés',             color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)'  },
    { type: 'assurance_expire',       severity: 'critique', label: '⚠️ Assurances expirées',                    color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)'  },
    { type: 'charge_retard_paiement', severity: 'critique', label: '💸 Charges en retard de paiement',          color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)'  },
    { type: 'carburant_anomalie',     severity: 'critique', label: '⛽ Anomalies carburant (conso / fraude)',    color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)'  },
    // 🟠 ALERTE
    { type: 'ct_proche',              severity: 'alerte',   label: '🔔 CT à renouveler (< 30 jours)',           color: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.2)' },
    { type: 'permis_proche',          severity: 'alerte',   label: '🪪 Permis expirent bientôt',                color: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.2)' },
    { type: 'assurance_proche',       severity: 'alerte',   label: '🛡️ Assurances expirent bientôt',           color: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.2)' },
    { type: 'vidange',                severity: 'alerte',   label: '🔧 Vidanges à effectuer',                   color: 'rgba(52,152,219,0.06)', border: 'rgba(52,152,219,0.2)' },
    { type: 'prix_manquant',          severity: 'alerte',   label: '💶 Prix de livraison manquant',             color: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.3)' },
    { type: 'planning_manquant',      severity: 'alerte',   label: '📅 Salariés sans planning défini',          color: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.2)' },
    { type: 'inspection_manquante',   severity: 'alerte',   label: '🚗 Véhicules sans inspection récente',      color: 'rgba(245,166,35,0.06)', border: 'rgba(245,166,35,0.2)' },
    // 🔵 INFO
    { type: 'livraison_modif',        severity: 'info',     label: '✏️ Livraisons modifiées',                   color: 'rgba(155,89,182,0.06)', border: 'rgba(155,89,182,0.25)'},
    { type: 'carburant_modif',        severity: 'info',     label: '✏️ Modifications carburant',                color: 'rgba(231,76,60,0.06)',  border: 'rgba(231,76,60,0.25)' },
    { type: 'km_modif',               severity: 'info',     label: '✏️ Modifications relevés km',               color: 'rgba(79,142,247,0.06)', border: 'rgba(79,142,247,0.25)'},
    { type: 'inspection',             severity: 'info',     label: '🚗 Inspections véhicules reçues',           color: 'rgba(46,204,113,0.06)', border: 'rgba(46,204,113,0.25)'},
  ];
  // Types à ne jamais afficher dans les alertes (gérés ailleurs)
  const typesExclus = ['message'];

  const SEVERITES_ORDER = ['critique', 'alerte', 'info'];
  const SEVERITES_HEADER = {
    critique: { label: '🔴 Critique — à traiter immédiatement', color: '#e74c3c' },
    alerte:   { label: '🟠 À traiter prochainement',             color: '#f5a623' },
    info:     { label: '🔵 Pour information',                    color: '#4f8ef7' },
  };

  const container = document.getElementById('alertes-categories');
  if (!container) return;
  container.innerHTML = '';

  let totalActives = 0;
  // Mode reportées : vue spéciale pour reprendre les alertes en attente
  const enModeReportees = filtreStatut === 'reportees';

  const renderCategorie = (cat) => {
    const items = actives.filter(a => a.type === cat.type);
    if (!items.length) return;
    totalActives += items.length;

    const section = document.createElement('div');
    section.style.cssText = `background:${cat.color};border:1px solid ${cat.border};border-radius:10px;margin-bottom:16px;overflow:hidden`;
    // Boutons "Tout valider / Tout ignorer" cachés en mode reportées (ils n'auraient pas de sens)
    const bulkBtns = enModeReportees
      ? ''
      : `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3);font-size:.72rem;padding:3px 8px" onclick="validerAlertesParType('${cat.type}')" title="Marquer toutes ces alertes comme traitées">✅ Tout</button>
         <button class="btn-icon danger" style="font-size:.72rem;padding:3px 8px;margin-left:4px" onclick="ignorerAlertesParType('${cat.type}')" title="Ignorer toutes ces alertes">✕ Tout</button>`;
    section.innerHTML = `
      <div style="padding:12px 16px;font-weight:600;font-size:0.9rem;border-bottom:1px solid ${cat.border};display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span>${cat.label}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span style="background:rgba(255,255,255,0.1);padding:2px 10px;border-radius:20px;font-size:0.78rem">${items.length}</span>
          ${bulkBtns}
        </div>
      </div>
      <table class="data-table" style="background:transparent">
        <thead><tr><th>Message</th><th>Salarié</th><th>Date/Heure</th><th>Action</th></tr></thead>
        <tbody>${items.map(a => {
          const dateFmt = new Date(a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
          // Critique = pas de bouton "ignorer" (on doit traiter, pas planquer)
          const estCritique = ['ct_expire','permis_expire','assurance_expire'].includes(cat.type);
          const estPrixManquant = cat.type === 'prix_manquant';

          let btnActions = '';
          // Raccourci contextuel selon le type
          let btnRaccourci = '';
          if (['permis_expire','permis_proche'].includes(cat.type) && a.meta?.salId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="ouvrirEditSalarie('${a.meta.salId}')" title="Modifier la fiche salarié">🪪 Modifier permis</button>`;
          } else if (['assurance_expire','assurance_proche'].includes(cat.type) && a.meta?.salId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="ouvrirEditSalarie('${a.meta.salId}')" title="Modifier la fiche salarié">🛡️ Modifier assurance</button>`;
          } else if (['ct_expire','ct_proche'].includes(cat.type) && a.meta?.vehId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('vehicules');setTimeout(()=>ouvrirEditVehicule('${a.meta.vehId}'),200)" title="Modifier le véhicule">🚐 Modifier véhicule</button>`;
          } else if (cat.type === 'vidange' && a.meta?.vehId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('entretiens')" title="Ajouter entretien">🔧 Entretien</button>`;
          } else if (cat.type === 'charge_retard_paiement' && a.meta?.chargeId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(46,204,113,.12);color:#2ecc71;border:1px solid rgba(46,204,113,.3);font-size:.75rem" onclick="basculerStatutCharge('${a.meta.chargeId}');validerAlerte('${a.id}')" title="Marquer la charge payée">💸 Marquer payée</button>`;
          } else if (cat.type === 'carburant_anomalie' && a.meta?.vehId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('carburant');setTimeout(()=>{var f=document.getElementById('filtre-carb-vehicule');if(f){f.value='${a.meta.vehId}';if(typeof afficherCarburant==='function')afficherCarburant();}},80)" title="Voir les pleins de ce véhicule">⛽ Voir pleins</button>`;
          } else if (cat.type === 'planning_manquant' && a.meta?.salId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('planning');setTimeout(()=>{if(typeof ouvrirModalPlanning==='function')ouvrirModalPlanning();},80)" title="Definir le planning">📅 Définir planning</button>`;
          } else if (cat.type === 'inspection_manquante' && a.meta?.vehId) {
            btnRaccourci = `<button class="btn-icon" style="background:rgba(79,142,247,.1);color:var(--blue);border:1px solid rgba(79,142,247,.3);font-size:.75rem" onclick="naviguerVers('inspections')" title="Demander/saisir une inspection">🚗 Inspections</button>`;
          }

          // Mode reportées : un seul bouton "Reprendre" (la date de reprise s'affiche dans la colonne date)
          if (enModeReportees) {
            btnActions = `<button class="btn-icon" style="background:rgba(155,89,182,.12);color:#9b59b6;border:1px solid rgba(155,89,182,.3)" onclick="reprendreAlerte('${a.id}')" title="Réafficher l'alerte maintenant">▶️ Reprendre</button>`;
          } else if (estPrixManquant) {
            btnActions = `<button class="btn-icon" style="background:rgba(245,166,35,0.12);color:var(--accent);border:1px solid rgba(245,166,35,0.3)" onclick="ouvrirLivraisonPourPrix('${a.meta?.client||''}')">📝 Saisir</button>
              <button class="btn-icon" style="background:rgba(155,89,182,.1);color:#9b59b6;border:1px solid rgba(155,89,182,.3);font-size:.75rem;margin-left:4px" onclick="repousserAlerte('${a.id}',7)" title="Reporter de 7 jours">⏰ +7j</button>
              <button class="btn-icon danger" onclick="ignorerAlerte('${a.id}')" style="margin-left:4px" title="Ignorer définitivement">✕ Ignorer</button>`;
          } else if (estCritique) {
            btnActions = `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">✅ Traité</button>`;
          } else {
            btnActions = `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">✅ Valider</button>
              <button class="btn-icon" style="background:rgba(155,89,182,.1);color:#9b59b6;border:1px solid rgba(155,89,182,.3);font-size:.75rem;margin-left:4px" onclick="repousserAlerte('${a.id}',7)" title="Reporter de 7 jours">⏰ +7j</button>
              <button class="btn-icon danger" onclick="ignorerAlerte('${a.id}')" style="margin-left:4px" title="Ignorer définitivement">✕ Ignorer</button>`;
          }

          // En mode reportées, afficher la date de reprise au lieu de la date de création
          let dateCol = `<span style="color:var(--text-muted);font-size:0.82rem">${dateFmt}</span>`;
          if (enModeReportees && a.meta?.repousseJusquA) {
            const repriseFmt = new Date(a.meta.repousseJusquA).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
            dateCol = `<span style="color:#9b59b6;font-size:0.82rem">⏰ Reprise le ${repriseFmt}</span>`;
          }

          return `<tr>
            <td style="font-size:0.85rem">${a.message}</td>
            <td>${a.meta?.salNom||a.meta?.client||'—'}</td>
            <td>${dateCol}</td>
            <td style="white-space:nowrap">${btnRaccourci} ${btnActions}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    container.appendChild(section);
  };

  // Itère par sévérité, ajoute un en-tête de groupe avant chaque cluster non vide
  SEVERITES_ORDER.forEach(sev => {
    const catsOfSev = categories.filter(c => c.severity === sev);
    const itemsCount = catsOfSev.reduce((acc, c) => acc + actives.filter(a => a.type === c.type).length, 0);
    if (!itemsCount) return;

    const header = document.createElement('div');
    const cfg = SEVERITES_HEADER[sev];
    header.style.cssText = `margin:24px 0 12px;padding:6px 0;font-size:.78rem;font-weight:700;color:${cfg.color};text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid ${cfg.color}33`;
    header.textContent = `${cfg.label} — ${itemsCount} alerte${itemsCount > 1 ? 's' : ''}`;
    container.appendChild(header);

    catsOfSev.forEach(renderCategorie);
  });

  // Alertes d'autres types non catégorisés
  const autres = actives.filter(a => !categories.find(c => c.type === a.type) && !typesExclus.includes(a.type));
  if (autres.length) {
    totalActives += autres.length;
    const section = document.createElement('div');
    section.style.cssText = 'background:rgba(108,117,125,0.06);border:1px solid rgba(108,117,125,0.2);border-radius:10px;margin-bottom:16px;overflow:hidden';
    section.innerHTML = `
      <div style="padding:12px 16px;font-weight:600;font-size:0.9rem;border-bottom:1px solid rgba(108,117,125,0.2)">🔔 Autres alertes</div>
      <table class="data-table" style="background:transparent"><thead><tr><th>Message</th><th>Salarié</th><th>Date/Heure</th><th>Action</th></tr></thead>
      <tbody>${autres.map(a => {
        const dateFmt = new Date(a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        return `<tr><td style="font-size:0.85rem">${a.message}</td><td>${a.meta?.salNom||'—'}</td>
          <td style="color:var(--text-muted);font-size:0.82rem">${dateFmt}</td>
          <td><button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">✅ Valider</button></td></tr>`;
      }).join('')}</tbody></table>`;
    container.appendChild(section);
  }

  if (!totalActives) {
    const emptyMsg = enModeReportees ? '⏰ Aucune alerte reportée' : '✅ Aucune alerte en attente';
    container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:32px;font-size:0.9rem">${emptyMsg}</div>`;
  }

  // ── Historique traité ──
  const tbT = document.getElementById('tb-alertes-traitees');
  if (tbT) {
    if (!traitees.length) {
      tbT.innerHTML = '<tr><td colspan="4" class="empty-row">Aucune alerte traitée</td></tr>';
    } else {
      tbT.innerHTML = traitees.slice(0, 30).map(a => {
        const dateFmt = new Date(a.traiteLe||a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        const icon = a.type==='carburant_modif' ? '✏️⛽' : a.type==='km_modif' ? '✏️🛣️' : a.type==='prix_manquant' ? '💶' : '✅';
        return `<tr style="opacity:0.6">
          <td>${icon}</td><td style="font-size:0.85rem">${a.message}</td>
          <td>${a.meta?.salNom||a.meta?.client||'—'}</td>
          <td style="color:var(--text-muted);font-size:0.82rem">Traité le ${dateFmt}</td>
        </tr>`;
      }).join('');
    }
  }
}

// L4116 (script.js d'origine)
function validerAlerte(id) {
  const alertes = charger('alertes_admin');
  const idx = alertes.findIndex(a => a.id === id);
  if (idx > -1) {
    alertes[idx].traitee  = true;
    alertes[idx].traiteLe = new Date().toISOString();
    // Notifier le salarié que sa modification a été validée
    const salId = alertes[idx].meta?.salId;
    const type  = alertes[idx].type;
    if (salId) {
      const notifs = charger('notifs_sal_'+salId);
      notifs.push({
        id: genId(), type: type+'_valide',
        message: type==='carburant_modif'
          ? '✅ Votre modification de plein a été validée par l\'administrateur.'
          : '✅ Votre modification de relevé km a été validée par l\'administrateur.',
        lu: false,
        creeLe: new Date().toISOString()
      });
      sauvegarder('notifs_sal_'+salId, notifs);
    }
    sauvegarder('alertes_admin', alertes);
    afficherAlertes();
    afficherBadgeAlertes();
    afficherToast('✅ Alerte traitée — salarié notifié');
  }
}

// L4144 (script.js d'origine)
function ignorerAlerte(id) {
  // Supprime définitivement l'alerte — pas dans l'historique traité
  sauvegarder('alertes_admin', charger('alertes_admin').filter(a => a.id !== id));
  afficherAlertes();
  afficherBadgeAlertes();
  afficherToast('🗑️ Alerte ignorée');
}

// L4152 (script.js d'origine)
async function viderAlertes() {
  const _ok7 = await confirmDialog('Effacer toutes les alertes traitées ?', {titre:'Vider l\'historique',icone:'🗑️',btnLabel:'Effacer',danger:false});
  if (!_ok7) return;
  sauvegarder('alertes_admin', charger('alertes_admin').filter(a => !a.traitee));
  afficherAlertes(); afficherToast('🗑️ Historique effacé');
}

// Bulk : valider toutes les alertes actives d'un type
async function validerAlertesParType(type) {
  const alertes = charger('alertes_admin');
  const cibles = alertes.filter(a => a.type === type && !a.traitee && !estReportee(a));
  if (!cibles.length) return;
  const ok = await confirmDialog(
    `Marquer ${cibles.length} alerte${cibles.length > 1 ? 's' : ''} comme traitée${cibles.length > 1 ? 's' : ''} ?`,
    { titre: 'Tout valider', icone: '✅', btnLabel: 'Tout valider', danger: false }
  );
  if (!ok) return;
  const now = new Date().toISOString();
  const ids = new Set(cibles.map(a => a.id));
  const out = alertes.map(a => ids.has(a.id) ? { ...a, traitee: true, traiteLe: now } : a);
  sauvegarder('alertes_admin', out);
  afficherAlertes();
  afficherBadgeAlertes();
  afficherToast(`✅ ${cibles.length} alerte${cibles.length > 1 ? 's' : ''} traitée${cibles.length > 1 ? 's' : ''}`);
}

// Bulk : ignorer (suppression définitive) toutes les alertes actives d'un type
async function ignorerAlertesParType(type) {
  const alertes = charger('alertes_admin');
  const cibles = alertes.filter(a => a.type === type && !a.traitee && !estReportee(a));
  if (!cibles.length) return;
  const ok = await confirmDialog(
    `Ignorer définitivement ${cibles.length} alerte${cibles.length > 1 ? 's' : ''} ?`,
    { titre: 'Tout ignorer', icone: '🗑️', btnLabel: 'Ignorer', danger: true }
  );
  if (!ok) return;
  const ids = new Set(cibles.map(a => a.id));
  sauvegarder('alertes_admin', alertes.filter(a => !ids.has(a.id)));
  afficherAlertes();
  afficherBadgeAlertes();
  afficherToast(`🗑️ ${cibles.length} alerte${cibles.length > 1 ? 's' : ''} ignorée${cibles.length > 1 ? 's' : ''}`);
}

// Snooze : reporte une alerte de N jours (cachée du listing actives jusqu'à expiration)
function repousserAlerte(id, jours) {
  const n = Number(jours) || 7;
  const alertes = charger('alertes_admin');
  const a = alertes.find(x => x.id === id);
  if (!a) return;
  const d = new Date();
  d.setDate(d.getDate() + n);
  a.meta = { ...(a.meta || {}), repousseJusquA: d.toISOString() };
  sauvegarder('alertes_admin', alertes);
  afficherAlertes();
  afficherBadgeAlertes();
  afficherToast(`⏰ Alerte reportée de ${n} jour${n > 1 ? 's' : ''}`);
}

// Inverse de repousserAlerte : remet l'alerte en visible immédiatement
function reprendreAlerte(id) {
  const alertes = charger('alertes_admin');
  const a = alertes.find(x => x.id === id);
  if (!a || !a.meta?.repousseJusquA) return;
  delete a.meta.repousseJusquA;
  sauvegarder('alertes_admin', alertes);
  afficherAlertes();
  afficherBadgeAlertes();
  afficherToast('▶️ Alerte reprise');
}

