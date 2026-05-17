/**
 * MCA Logistics — Module Inspections
 *
 * Extrait de script.js (decomposition modulaire phase 1).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L6016 (script.js d'origine)
function getInspectionStorageAdminHelper() {
  return window.DelivProSupabase && window.DelivProSupabase.getInspectionStorage
    ? window.DelivProSupabase.getInspectionStorage()
    : null;
}

// L6022 (script.js d'origine)
function getInspectionPhotoList(insp) {
  return Array.isArray(insp && insp.photos) ? insp.photos.filter(Boolean) : [];
}

// L6026 (script.js d'origine)
// Retourne soit un src direct (base64 legacy), soit un path Storage prive a resoudre.
// Forme: { src, path } - utiliser src si present, sinon resoudre path en signed URL.
function getInspectionPhotoThumbDescriptorAdmin(photo) {
  if (!photo) return { src: '', path: '' };
  if (typeof photo === 'string') {
    if (/^data:image\//.test(photo)) return { src: photo, path: '' };
    const helper = getInspectionStorageAdminHelper();
    const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(photo) : '';
    return { src: '', path: path };
  }
  if (photo.thumbPath) return { src: '', path: photo.thumbPath };
  if (photo.path) return { src: '', path: photo.path };
  const helper = getInspectionStorageAdminHelper();
  const fallback = photo.thumbUrl || photo.url || '';
  if (/^data:image\//.test(fallback)) return { src: fallback, path: '' };
  const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(fallback) : '';
  return { src: '', path: path };
}

function getInspectionPhotoFullDescriptorAdmin(photo) {
  if (!photo) return { src: '', path: '' };
  if (typeof photo === 'string') {
    if (/^data:image\//.test(photo)) return { src: photo, path: '' };
    const helper = getInspectionStorageAdminHelper();
    const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(photo) : '';
    return { src: '', path: path };
  }
  if (photo.path) return { src: '', path: photo.path };
  if (photo.thumbPath) return { src: '', path: photo.thumbPath };
  const helper = getInspectionStorageAdminHelper();
  const fallback = photo.url || photo.thumbUrl || '';
  if (/^data:image\//.test(fallback)) return { src: fallback, path: '' };
  const path = helper && helper.extractPathFromPublicUrl ? helper.extractPathFromPublicUrl(fallback) : '';
  return { src: '', path: path };
}

function getInspectionPhotoThumb(photo) {
  return getInspectionPhotoThumbDescriptorAdmin(photo).src;
}

// L6032 (script.js d'origine)
function getInspectionPhotoFull(photo) {
  return getInspectionPhotoFullDescriptorAdmin(photo).src;
}

// L6038 (script.js d'origine)
function isInspectionPhotoBase64(value) {
  if (!value) return false;
  if (typeof value === 'string') return /^data:image\//.test(String(value || ''));
  return /^data:image\//.test(String(value.url || value.thumbUrl || ''));
}

// L6044 (script.js d'origine)
// Extrait tous les paths Storage d'une inspection (nouveau format prive + legacy URL publique).
function getInspectionRemotePhotoPaths(insp) {
  const storageHelper = getInspectionStorageAdminHelper();
  return getInspectionPhotoList(insp)
    .filter(photo => !isInspectionPhotoBase64(photo))
    .flatMap(function(photo) {
      if (typeof photo === 'string') {
        // Legacy: URL publique pure
        if (storageHelper && storageHelper.extractPathFromPublicUrl) {
          const p = storageHelper.extractPathFromPublicUrl(photo);
          return p ? [p] : [];
        }
        return [];
      }
      // Nouveau format prive : { path, thumbPath }
      const paths = [];
      if (photo.path) paths.push(photo.path);
      if (photo.thumbPath) paths.push(photo.thumbPath);
      // Legacy : objet avec url/thumbUrl publiques
      if (!paths.length && storageHelper && storageHelper.extractPathFromPublicUrl) {
        [photo.url, photo.thumbUrl].filter(Boolean).forEach(function(u) {
          const p = storageHelper.extractPathFromPublicUrl(u);
          if (p) paths.push(p);
        });
      }
      return paths;
    })
    .filter(Boolean);
}

// L6054 (script.js d'origine)
async function supprimerPhotosInspectionDepuisStorage(insp) {
  const storageHelper = getInspectionStorageAdminHelper();
  const paths = getInspectionRemotePhotoPaths(insp);
  if (!paths.length) return { ok: true, skipped: true };
  if (!storageHelper || typeof storageHelper.removeInspectionPhotos !== 'function') {
    return { ok: false, error: { message: 'Supabase Storage indisponible' } };
  }
  return await storageHelper.removeInspectionPhotos(paths);
}

// L6064 (script.js d'origine)
function getInspectionReferenceDate(insp) {
  const candidates = [insp && insp.creeLe, insp && insp.date];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (!value) continue;
    const source = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value;
    const date = new Date(source);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

// L6076 (script.js d'origine)
async function nettoyerPhotosInspectionsAnciennes(forceRun) {
  const storageHelper = getInspectionStorageAdminHelper();
  if (!storageHelper || typeof storageHelper.removeInspectionPhotos !== 'function') {
    return { ok: false, skipped: true, reason: 'storage_unavailable' };
  }

  const now = Date.now();
  const lastCleanupAt = Number(localStorage.getItem(INSPECTION_STORAGE_CLEANUP_KEY) || '0');
  if (!forceRun && lastCleanupAt && now - lastCleanupAt < 24 * 60 * 60 * 1000) {
    return { ok: true, skipped: true, reason: 'recently_cleaned' };
  }

  const threshold = now - (INSPECTION_STORAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const inspections = charger('inspections');
  const pathsToDelete = [];
  let changed = false;

  inspections.forEach(function(insp) {
    const referenceDate = getInspectionReferenceDate(insp);
    if (!referenceDate || referenceDate.getTime() > threshold) return;

    const photos = getInspectionPhotoList(insp);
    if (!photos.length) return;

    const remotePhotos = photos.filter(photo => !isInspectionPhotoBase64(photo));
    if (!remotePhotos.length) return;

    remotePhotos.forEach(function(photo) {
      if (typeof photo === 'string') {
        // Legacy URL publique
        const path = storageHelper.extractPathFromPublicUrl(photo);
        if (path) pathsToDelete.push(path);
        return;
      }
      // Nouveau format prive
      if (photo.path) pathsToDelete.push(photo.path);
      if (photo.thumbPath) pathsToDelete.push(photo.thumbPath);
      // Legacy : url/thumbUrl publiques
      if (!photo.path && !photo.thumbPath) {
        [photo.url, photo.thumbUrl].filter(Boolean).forEach(function(url) {
          const path = storageHelper.extractPathFromPublicUrl(url);
          if (path) pathsToDelete.push(path);
        });
      }
    });

    insp.photos = photos.filter(isInspectionPhotoBase64);
    if (!insp.note_cleanup_storage) {
      insp.note_cleanup_storage = 'Photos Supabase supprimées automatiquement après 60 jours';
    }
    insp.photosNettoyeesLe = new Date(now).toISOString();
    changed = true;
  });

  if (pathsToDelete.length) {
    const deleteResult = await storageHelper.removeInspectionPhotos(Array.from(new Set(pathsToDelete)));
    if (!deleteResult || !deleteResult.ok) {
      return { ok: false, error: deleteResult && deleteResult.error ? deleteResult.error : { message: 'Suppression Storage impossible' } };
    }
  }

  if (changed) {
    sauvegarder('inspections', inspections);
  }
  localStorage.setItem(INSPECTION_STORAGE_CLEANUP_KEY, String(now));
  return { ok: true, deletedCount: Array.from(new Set(pathsToDelete)).length, changed: changed };
}

// L6133 (script.js d'origine)
function afficherInspections() {
  let inspections = loadSafe('inspections', []);
  const salaries  = charger('salaries');
  const vehicules = charger('vehicules');
  const container = document.getElementById('inspections-container');
  const filtreSal = document.getElementById('filtre-insp-sal')?.value || '';
  const range = getInspectionsPeriodeRange();
  const periodSelect = document.getElementById('vue-insp-select');
  if (periodSelect) periodSelect.value = _inspPeriode.mode;
  majPeriodeDisplay('insp-semaine-label', 'insp-semaine-dates', range);

  // Remplir le datalist pour la recherche
  const datalist = document.getElementById('datalist-insp-sal');
  if (datalist && datalist.options.length === 0) {
    salaries.forEach(s => { const opt = document.createElement('option'); opt.value = s.nom; opt.dataset.id = s.id; datalist.appendChild(opt); });
  }

  // Onglet 11 (2026-05-17) : peupler select véhicules (drilldown)
  const selVeh = document.getElementById('filtre-insp-veh');
  if (selVeh && selVeh.options.length <= 1) {
    const current = selVeh.value;
    vehicules
      .filter(v => v && v.immat)
      .sort((a, b) => String(a.immat).localeCompare(String(b.immat), 'fr'))
      .forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.immat + (v.modele ? ' — ' + v.modele : '');
        selVeh.appendChild(opt);
      });
    if (current) selVeh.value = current;
  }

  if (filtreSal)  inspections = inspections.filter(i => i.salId === filtreSal);

  // Onglet 11 (2026-05-17) : filtre véhicule (par vehId ou fallback immat)
  const filtreVeh = selVeh?.value || '';
  if (filtreVeh) {
    const vehTarget = vehicules.find(v => v.id === filtreVeh);
    inspections = inspections.filter(i => {
      if (i.vehId === filtreVeh) return true;
      if (vehTarget && i.vehImmat && vehTarget.immat) {
        return String(i.vehImmat).trim().toUpperCase() === String(vehTarget.immat).trim().toUpperCase();
      }
      return false;
    });
  }

  // Phase 58 polish (BUG-024) — filtre statut conforme / anomalies
  const filtreStatut = document.getElementById('filtre-insp-statut')?.value || '';
  if (filtreStatut === 'conforme') {
    inspections = inspections.filter(i => i.statut === 'conforme');
  } else if (filtreStatut === 'defaut-mineur' || filtreStatut === 'defaut-majeur') {
    // Heuristique : data model actuel a juste 'conforme' vs 'avec_anomalies'.
    // mineur = 1-2 KO, majeur = 3+ KO (à raffiner quand vraie severite ajoutée).
    inspections = inspections.filter(i => {
      if (i.statut !== 'avec_anomalies') return false;
      const koCount = Array.isArray(i.pointsKO) ? i.pointsKO.length : 0;
      return filtreStatut === 'defaut-majeur' ? koCount >= 3 : koCount > 0 && koCount < 3;
    });
  }

  inspections = inspections.filter(i => isDateInRange(i.date, range));
  inspections.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  if (!inspections.length) {
    container.innerHTML = '<div class="card"><div class="modal-body" style="text-align:center;color:var(--text-muted);padding:32px">Aucune inspection trouvée</div></div>';
    return;
  }

  // Phase 59 polish (BUG-023) — table-view mockup-aligned (Date/Véhicule/Chauffeur/Photos/Défauts/Statut)
  // Photos count clickable -> ouvre lightbox via voirPhotoAdmin
  function statutBadge(insp) {
    if (insp.statut === 'conforme') return '<span class="badge ok">Conforme</span>';
    const koCount = Array.isArray(insp.pointsKO) ? insp.pointsKO.length : 0;
    if (koCount >= 3) return '<span class="badge alert">Défaut majeur</span>';
    return '<span class="badge warn">Défaut mineur</span>';
  }
  function defautsList(insp) {
    if (insp.statut === 'conforme') return '—';
    const ko = Array.isArray(insp.pointsKO) ? insp.pointsKO : [];
    if (!ko.length) return '—';
    if (ko.length <= 2) return ko.join(', ');
    return ko.slice(0, 2).join(', ') + ' +' + (ko.length - 2);
  }
  // Onglet 11 (2026-05-17) — clic sur ligne ouvre drawer 360 inspection
  // (bouton photo + bouton 🗑️ stop-propagation pour preserver leur action propre).
  const rows = inspections.map(insp => {
    const photos = getInspectionPhotoList(insp);
    const photoCount = photos.length;
    const sourceBadge = insp.source === 'admin' ? ' <span class="inspection-source-badge admin">Admin</span>' : '';
    return `
      <tr class="row-hover" data-insp-id="${insp.id}" style="cursor:pointer" onclick="window.ouvrirFiche360Inspection&&window.ouvrirFiche360Inspection('${insp.id}')">
        <td class="mono" style="white-space:nowrap">${formatDateExport(insp.date)}${insp.km ? ' · ' + parseInt(insp.km, 10).toLocaleString('fr-FR') + ' km' : ''}</td>
        <td>${insp.vehImmat || '—'}</td>
        <td>${insp.salNom || '—'}${sourceBadge}</td>
        <td>${photoCount > 0
          ? `<button type="button" class="btn-link" style="background:none;border:none;color:var(--brand);cursor:pointer;font-size:.85rem;padding:0;text-decoration:underline" onclick="event.stopPropagation();voirPhotoAdmin('${insp.id}',0)">${photoCount} photo${photoCount > 1 ? 's' : ''}</button>`
          : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${defautsList(insp)}</td>
        <td>${statutBadge(insp)}</td>
        <td style="text-align:right"><button class="btn-icon danger" onclick="event.stopPropagation();supprimerInspectionAdmin('${insp.id}')" title="Supprimer">🗑️</button></td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="card table-card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Véhicule</th><th>Chauffeur</th><th>Photos</th><th>Défauts</th><th>Statut</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  // Resoudre signed URLs pour les photos (en cas d'usage drawer/modal)
  if (window.resolveStorageImages) {
    window.resolveStorageImages(container);
  }
}

// L6178 (script.js d'origine)
function ouvrirModalInspectionAdmin() {
  var selSalarie = document.getElementById('admin-insp-salarie');
  var selVehicule = document.getElementById('admin-insp-vehicule');
  var salaries = charger('salaries');
  var vehicules = charger('vehicules');
  if (selSalarie) {
    selSalarie.innerHTML = '<option value="">— Choisir —</option>' + salaries.map(function(s) {
      return '<option value="' + s.id + '">' + planningEscapeHtml(getSalarieNomComplet(s, { includeNumero: true })) + '</option>';
    }).join('');
  }
  if (selVehicule) {
    selVehicule.innerHTML = '<option value="">— Aucun véhicule —</option>' + vehicules.map(function(v) {
      return '<option value="' + v.id + '">' + planningEscapeHtml(v.immat + (v.modele ? ' — ' + v.modele : '')) + '</option>';
    }).join('');
  }
  var dateInput = document.getElementById('admin-insp-date');
  var kmInput = document.getElementById('admin-insp-km');
  var commentaire = document.getElementById('admin-insp-commentaire');
  if (dateInput) dateInput.value = aujourdhui();
  if (kmInput) kmInput.value = '';
  if (commentaire) commentaire.value = '';
  if (selSalarie) {
    selSalarie.onchange = function() {
      var veh = vehicules.find(function(item) { return item.salId === selSalarie.value; });
      if (selVehicule) selVehicule.value = veh ? veh.id : '';
    };
  }
  openModal('modal-inspection-admin');
}

// L6208 (script.js d'origine)
function ajouterInspectionAdmin() {
  var salId = document.getElementById('admin-insp-salarie')?.value || '';
  var vehId = document.getElementById('admin-insp-vehicule')?.value || '';
  var date = document.getElementById('admin-insp-date')?.value || '';
  var km = parseFloat(document.getElementById('admin-insp-km')?.value || '') || null;
  var commentaire = (document.getElementById('admin-insp-commentaire')?.value || '').trim();
  // #47 audit Chrome : recolte des checkpoints OK/KO (DGITM controle vehicule).
  var checkpoints = {};
  var pointsKO = [];
  document.querySelectorAll('#admin-insp-checkpoints input[data-checkpoint]').forEach(function (cb) {
    var key = cb.dataset.checkpoint;
    checkpoints[key] = cb.checked ? 'ok' : 'ko';
    if (!cb.checked) {
      var label = (cb.parentElement && cb.parentElement.textContent || key).trim();
      pointsKO.push(label);
    }
  });
  if (!salId || !date) {
    afficherToast('Sélectionnez un salarié et une date d’inspection', 'error');
    return;
  }
  if (hasNegativeNumber(km || 0)) {
    afficherToast('Le kilométrage ne peut pas être négatif', 'error');
    return;
  }
  var salaries = charger('salaries');
  var vehicules = charger('vehicules');
  var salarie = salaries.find(function(item) { return item.id === salId; });
  var vehicule = vehicules.find(function(item) { return item.id === vehId; }) || vehicules.find(function(item) { return item.salId === salId; }) || null;
  var inspections = charger('inspections');
  var inspectionId = genId();
  inspections.push({
    id: inspectionId,
    salId: salId,
    salNom: salarie ? getSalarieNomComplet(salarie) : 'Salarié',
    vehId: vehicule ? vehicule.id : '',
    vehImmat: vehicule ? vehicule.immat : 'Non affecté',
    date: date,
    km: km,
    commentaire: commentaire,
    checkpoints: checkpoints,
    statut: pointsKO.length > 0 ? 'avec_anomalies' : 'conforme',
    photos: [],
    source: 'admin',
    creeLe: new Date().toISOString()
  });
  // Auto-creation incidents pour les KO
  if (pointsKO.length > 0) {
    var incidents = charger('incidents');
    pointsKO.forEach(function (label) {
      incidents.push({
        id: genId(),
        date: date,
        livId: '',
        salId: salId,
        salNom: salarie ? getSalarieNomComplet(salarie) : '',
        client: '',
        chaufId: salId,
        chaufNom: salarie ? getSalarieNomComplet(salarie) : '',
        description: 'Inspection KO : ' + label + (commentaire ? ' — ' + commentaire : '') + (vehicule ? ' · ' + vehicule.immat : ''),
        gravite: 'moyen',
        statut: 'ouvert',
        inspectionId: inspectionId,
        creeLe: new Date().toISOString()
      });
    });
    sauvegarder('incidents', incidents);
  }
  sauvegarder('inspections', inspections);
  if (vehicule && km) {
    var vehiculesMaj = charger('vehicules');
    var idxVeh = vehiculesMaj.findIndex(function(item) { return item.id === vehicule.id; });
    if (idxVeh > -1) {
      vehiculesMaj[idxVeh].km = Math.max(parseFloat(vehiculesMaj[idxVeh].km) || 0, km);
      sauvegarder('vehicules', vehiculesMaj);
    }
  }
  closeModal('modal-inspection-admin');
  // Reset checkboxes pour la prochaine ouverture
  document.querySelectorAll('#admin-insp-checkpoints input[data-checkpoint]').forEach(function (cb) { cb.checked = true; });
  ajouterEntreeAudit('Création inspection', (salarie ? getSalarieNomComplet(salarie) : 'Salarié') + ' · ' + date + (vehicule ? ' · ' + vehicule.immat : '') + (pointsKO.length > 0 ? ' · ' + pointsKO.length + ' KO' : ' · conforme'));
  afficherInspections();
  if (typeof rafraichirDashboard === 'function') rafraichirDashboard();
  afficherToast(pointsKO.length > 0
    ? '⚠️ Inspection enregistrée avec ' + pointsKO.length + ' anomalie(s) — incident(s) auto-créé(s)'
    : '✅ Inspection conforme enregistrée');
}

// L6266 (script.js d'origine)
async function supprimerInspectionAdmin(id) {
  const _ok8 = await confirmDialog('Supprimer cette inspection ?', {titre:'Supprimer',icone:'🚗',btnLabel:'Supprimer'});
  if (!_ok8) return;
  const inspections = loadSafe('inspections', []);
  const inspection = inspections.find(i => i.id === id);
  if (!inspection) return;

  const deleteResult = await supprimerPhotosInspectionDepuisStorage(inspection);
  if (!deleteResult || !deleteResult.ok) {
    afficherToast('⚠️ Suppression des photos Supabase impossible. Réessayez.', 'error');
    return;
  }

  const toutes = inspections.filter(i => i.id !== id);
  localStorage.setItem('inspections', JSON.stringify(toutes));
  ajouterEntreeAudit('Suppression inspection', (inspection.vehImmat || 'Inspection') + ' · ' + (inspection.date || ''));
  // Onglet 11 — ferme drawer 360 inspection si ouvert (no-op si fermé)
  try { if (typeof window.fermerFiche360Inspection === 'function') window.fermerFiche360Inspection(); } catch (_) {}
  afficherInspections();
  afficherToast('Inspection supprimée');
}

// L8001 (script.js d'origine)
function planningGetInspectionForDate(salId, dateStr) {
  return charger('inspections').find(function(item) {
    return item.salId === salId && item.date === dateStr;
  }) || null;
}

// L12805 (script.js d'origine)
function getInspectionsPeriodeRange() { return getPeriodeRange(_inspPeriode.mode, _inspPeriode.offset); }

// L12806 (script.js d'origine)
function changerVueInspections(mode) { changeSimplePeriode(_inspPeriode, mode, afficherInspections, 'insp-semaine-label', 'insp-semaine-dates', 'vue-insp-select'); }

// L12807 (script.js d'origine)
function navInspectionsPeriode(delta) { navSimplePeriode(_inspPeriode, delta, afficherInspections, 'insp-semaine-label', 'insp-semaine-dates', 'vue-insp-select'); }

// L12808 (script.js d'origine)
function reinitialiserInspectionsPeriode() { resetSimplePeriode(_inspPeriode, afficherInspections, 'insp-semaine-label', 'insp-semaine-dates', 'vue-insp-select'); }

