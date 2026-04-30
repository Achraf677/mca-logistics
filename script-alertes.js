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
  return charger('alertes_admin').filter(a => !a.lu && !a.traitee).length;
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
  if (filtreStatut === 'actives')  filtered = filtered.filter(a => !a.traitee);
  if (filtreStatut === 'traitees') filtered = filtered.filter(a => a.traitee);
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
  if (cardTraitees) cardTraitees.style.display = (filtreStatut === 'actives') ? 'none' : 'block';

  // ── Catégories d'alertes actives ──
  const categories = [
    { type: 'prix_manquant',   label: '💶 Prix de livraison manquant',  color: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.3)'  },
    { type: 'livraison_modif', label: '✏️ Livraisons modifiées',         color: 'rgba(155,89,182,0.06)',  border: 'rgba(155,89,182,0.25)' },
    { type: 'carburant_modif', label: '✏️ Modifications carburant',      color: 'rgba(231,76,60,0.06)',   border: 'rgba(231,76,60,0.25)'  },
    { type: 'km_modif',        label: '✏️ Modifications relevés km',     color: 'rgba(79,142,247,0.06)',  border: 'rgba(79,142,247,0.25)' },
    { type: 'inspection',      label: '🚗 Inspections véhicules reçues', color: 'rgba(46,204,113,0.06)',  border: 'rgba(46,204,113,0.25)' },
    { type: 'ct_expire',       label: '⚠️ Contrôles techniques expirés', color: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.3)'   },
    { type: 'ct_proche',       label: '🔔 CT à renouveler (< 30 jours)', color: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.2)'  },
    { type: 'vidange',            label: '🔧 Vidanges à effectuer',           color: 'rgba(52,152,219,0.06)',  border: 'rgba(52,152,219,0.2)'  },
    { type: 'permis_expire',    label: '⚠️ Permis de conduire expirés',     color: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.3)'   },
    { type: 'permis_proche',    label: '🪪 Permis expirent bientôt',        color: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.2)'  },
    { type: 'assurance_expire', label: '⚠️ Assurances expirées',            color: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.3)'   },
    { type: 'assurance_proche', label: '🛡️ Assurances expirent bientôt',   color: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.2)'  },
    { type: 'charge_retard_paiement', label: '💸 Charges en retard de paiement', color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)' },
    { type: 'carburant_anomalie',     label: '⛽ Anomalies carburant (conso / fraude)', color: 'rgba(231,76,60,0.08)', border: 'rgba(231,76,60,0.3)' },
  ];
  // Types à ne jamais afficher dans les alertes (gérés ailleurs)
  const typesExclus = ['message'];

  const container = document.getElementById('alertes-categories');
  if (!container) return;
  container.innerHTML = '';

  let totalActives = 0;

  categories.forEach(cat => {
    const items = actives.filter(a => a.type === cat.type);
    if (!items.length) return;
    totalActives += items.length;

    const section = document.createElement('div');
    section.style.cssText = `background:${cat.color};border:1px solid ${cat.border};border-radius:10px;margin-bottom:16px;overflow:hidden`;
    section.innerHTML = `
      <div style="padding:12px 16px;font-weight:600;font-size:0.9rem;border-bottom:1px solid ${cat.border};display:flex;justify-content:space-between;align-items:center">
        <span>${cat.label}</span>
        <span style="background:rgba(255,255,255,0.1);padding:2px 10px;border-radius:20px;font-size:0.78rem">${items.length}</span>
      </div>
      <table class="data-table" style="background:transparent">
        <thead><tr><th>Message</th><th>Salarié</th><th>Date/Heure</th><th>Action</th></tr></thead>
        <tbody>${items.map(a => {
          const dateFmt = new Date(a.creeLe).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
          // Types critiques = pas d'ignorer (CT expiré uniquement)
          const estCritique = ['ct_expire'].includes(cat.type);
          // Types avec saisie rapide
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
          }

          if (estPrixManquant) {
            btnActions = `<button class="btn-icon" style="background:rgba(245,166,35,0.12);color:var(--accent);border:1px solid rgba(245,166,35,0.3)" onclick="ouvrirLivraisonPourPrix('${a.meta?.client||''}')">📝 Saisir</button>
              <button class="btn-icon danger" onclick="ignorerAlerte('${a.id}')" style="margin-left:4px" title="Ignorer définitivement">✕ Ignorer</button>`;
          } else if (estCritique) {
            btnActions = `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">✅ Traité</button>`;
          } else {
            btnActions = `<button class="btn-icon" style="background:rgba(46,204,113,0.12);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)" onclick="validerAlerte('${a.id}')">✅ Valider</button>
              <button class="btn-icon danger" onclick="ignorerAlerte('${a.id}')" style="margin-left:4px" title="Ignorer définitivement">✕ Ignorer</button>`;
          }
          return `<tr>
            <td style="font-size:0.85rem">${a.message}</td>
            <td>${a.meta?.salNom||a.meta?.client||'—'}</td>
            <td style="color:var(--text-muted);font-size:0.82rem">${dateFmt}</td>
            <td style="white-space:nowrap">${btnRaccourci} ${btnActions}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    container.appendChild(section);
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
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:32px;font-size:0.9rem">✅ Aucune alerte en attente</div>';
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

