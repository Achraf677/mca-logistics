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
function getInspectionPhotoThumb(photo) {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.thumbUrl || photo.url || '';
}

// L6032 (script.js d'origine)
function getInspectionPhotoFull(photo) {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  return photo.url || photo.thumbUrl || '';
}

// L6038 (script.js d'origine)
function isInspectionPhotoBase64(value) {
  if (!value) return false;
  if (typeof value === 'string') return /^data:image\//.test(String(value || ''));
  return /^data:image\//.test(String(value.url || value.thumbUrl || ''));
}

// L6044 (script.js d'origine)
function getInspectionRemotePhotoPaths(insp) {
  const storageHelper = getInspectionStorageAdminHelper();
  if (!storageHelper || typeof storageHelper.extractPathFromPublicUrl !== 'function') return [];
  return getInspectionPhotoList(insp)
    .filter(photo => !isInspectionPhotoBase64(photo))
    .flatMap(photo => typeof photo === 'string' ? [photo] : [photo.url, photo.thumbUrl].filter(Boolean))
    .map(photoUrl => storageHelper.extractPathFromPublicUrl(photoUrl))
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
      const photoUrls = typeof photo === 'string' ? [photo] : [photo.url, photo.thumbUrl].filter(Boolean);
      photoUrls.forEach(function(url) {
        const path = storageHelper.extractPathFromPublicUrl(url);
        if (path) pathsToDelete.push(path);
      });
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

  if (filtreSal)  inspections = inspections.filter(i => i.salId === filtreSal);
  inspections = inspections.filter(i => isDateInRange(i.date, range));
  inspections.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  if (!inspections.length) {
    container.innerHTML = '<div class="card"><div class="modal-body" style="text-align:center;color:var(--text-muted);padding:32px">Aucune inspection trouvée</div></div>';
    return;
  }

  container.innerHTML = inspections.map(insp => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span>👤 <strong>${insp.salNom}</strong> — ${insp.vehImmat}${insp.source === 'admin' ? ' <span class="inspection-source-badge admin">Admin</span>' : ''}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:.82rem;color:var(--text-muted)">🗓️ ${formatDateExport(insp.date)}${insp.km ? ' · ' + parseInt(insp.km, 10).toLocaleString('fr-FR') + ' km' : ''}</span>
          <button class="btn-icon danger" onclick="supprimerInspectionAdmin('${insp.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
          ${getInspectionPhotoList(insp).map((p, i) => `
            <div style="border-radius:8px;overflow:hidden;aspect-ratio:4/3;cursor:pointer" onclick="voirPhotoAdmin('${insp.id}',${i})">
              <img src="${getInspectionPhotoThumb(p)}" style="width:100%;height:100%;object-fit:cover" />
            </div>`).join('')}
        </div>
        ${insp.note_cleanup_storage ? `<div style="margin-top:10px;font-size:.78rem;color:var(--text-muted)">${insp.note_cleanup_storage}</div>` : ''}
      </div>
    </div>`).join('');
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
  inspections.push({
    id: genId(),
    salId: salId,
    salNom: salarie ? getSalarieNomComplet(salarie) : 'Salarié',
    vehId: vehicule ? vehicule.id : '',
    vehImmat: vehicule ? vehicule.immat : 'Non affecté',
    date: date,
    km: km,
    commentaire: commentaire,
    photos: [],
    source: 'admin',
    creeLe: new Date().toISOString()
  });
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
  ajouterEntreeAudit('Création inspection', (salarie ? getSalarieNomComplet(salarie) : 'Salarié') + ' · ' + date + (vehicule ? ' · ' + vehicule.immat : ''));
  afficherInspections();
  if (typeof rafraichirDashboard === 'function') rafraichirDashboard();
  afficherToast('✅ Inspection ajoutée');
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
  afficherInspections();
  afficherToast('🗑️ Inspection supprimée');
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

