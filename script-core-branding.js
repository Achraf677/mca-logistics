/**
 * MCA Logistics — Module Core-branding
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L452 (script.js d'origine)
function getLogoEntrepriseExportSrc() {
  return getLogoEntreprise()
    || document.querySelector('.logo-icon img')?.src
    || document.querySelector('#param-logo-preview img')?.src
    || '';
}

// L458 (script.js d'origine)
function renderLogoEntrepriseExport() {
  const logo = getLogoEntrepriseExportSrc();
  return logo
    ? `<img src="${logo}" alt="Logo entreprise" class="export-logo" style="width:62px;height:62px;object-fit:contain;border-radius:14px;border:1px solid #e5e7eb;background:#fff;padding:6px" />`
    : '';
}

// L698 (script.js d'origine)
function getLogoEntreprise() {
  return localStorage.getItem('logo_entreprise_url') || localStorage.getItem('logo_entreprise') || '';
}

// L797 (script.js d'origine)
function appliquerBranding() {
  const logo = getLogoEntreprise();
  const params = getEntrepriseExportParams();
  const nomEntreprise = params.nom || 'MCA Logistics';
  const iconTargets = document.querySelectorAll('.logo-icon');
  iconTargets.forEach(el => {
    el.innerHTML = logo ? `<img src="${logo}" alt="Logo" />` : '🚐';
  });
  const topbarMarks = document.querySelectorAll('.topbar-logo-mark');
  topbarMarks.forEach(el => {
    el.innerHTML = logo ? `<img src="${logo}" alt="Logo" />` : '🚐';
  });
  const names = [
    document.getElementById('sidebar-nom-entreprise'),
    document.getElementById('topbar-brand-name')
  ].filter(Boolean);
  names.forEach(function(el) {
    el.textContent = nomEntreprise;
  });
  const preview = document.getElementById('param-logo-preview');
  if (preview) preview.innerHTML = logo ? `<img src="${logo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:12px" />` : '🚐';
  const link = document.querySelector("link[rel='icon']") || document.createElement('link');
  link.rel = 'icon';
  link.href = logo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚐</text></svg>";
  document.head.appendChild(link);
}

// L826 (script.js d'origine)
function sanitiserNomFichierLogo(value) {
  return String(value || 'logo-entreprise')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'logo-entreprise';
}

// L833 (script.js d'origine)
function getLogoEntreprisePath() {
  return localStorage.getItem('logo_entreprise_path') || '';
}

// L867 (script.js d'origine)
async function uploaderLogoEntreprise(file) {
  const storageHelper = getCompanyAssetsStorageHelper();
  if (!storageHelper) throw new Error('storage_unavailable');
  const sessionAdmin = getAdminSession();
  if (sessionAdmin.authMode !== 'supabase') throw new Error('admin_session_required');

  const nomEntreprise = chargerObj('params_entreprise', {}).nom || 'mca-logistics';
  const prefix = sanitiserNomFichierLogo(nomEntreprise);
  const previousPath = getLogoEntreprisePath();
  const blob = await compresserFichierImage(file, 900, 900, 0.84, 'image/webp');
  const path = 'logos/' + prefix + '-' + Date.now() + '.webp';
  const result = await storageHelper.uploadInspectionPhoto(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000'
  });

  if (!result || !result.ok || !result.url) {
    throw (result && result.error) || new Error('upload_failed');
  }

  localStorage.setItem('logo_entreprise_url', result.url);
  localStorage.setItem('logo_entreprise_path', result.path || path);
  localStorage.removeItem('logo_entreprise');

  if (previousPath && previousPath !== (result.path || path)) {
    storageHelper.removeInspectionPhotos([previousPath]).catch(function () {});
  }
  return result.url;
}

// L918 (script.js d'origine)
function initTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = '☀️';
  }
  // Appliquer couleur accent personnalisée
  const accent = localStorage.getItem('accent_color');
  if (accent) document.documentElement.style.setProperty('--accent', accent);
}

// L930 (script.js d'origine)
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
}

// L3430 (script.js d'origine)
async function changerLogoEntreprise(input) {
  const file = input?.files?.[0];
  if (!file) return;
  try {
    await uploaderLogoEntreprise(file);
    appliquerBranding();
    afficherToast('✅ Logo mis à jour');
  } catch (error) {
    const reason = error?.message || 'erreur inconnue';
    const message = reason === 'admin_session_required'
      ? '⚠️ Connectez-vous en admin Supabase pour enregistrer un logo partagé.'
      : reason === 'storage_unavailable'
        ? '⚠️ Supabase Storage est indisponible pour le moment.'
        : `⚠️ Logo non envoyé vers le cloud (${reason})`;
    afficherToast(message, 'error');
  } finally {
    if (input) input.value = '';
  }
}

// L3450 (script.js d'origine)
async function supprimerLogoEntreprise() {
  const storageHelper = getCompanyAssetsStorageHelper();
  const path = getLogoEntreprisePath();
  if (storageHelper && path) {
    try {
      await storageHelper.removeInspectionPhotos([path]);
    } catch (_) {}
  }
  localStorage.removeItem('logo_entreprise_url');
  localStorage.removeItem('logo_entreprise_path');
  localStorage.removeItem('logo_entreprise');
  const input = document.getElementById('param-logo-file');
  if (input) input.value = '';
  appliquerBranding();
  afficherToast('🗑️ Logo supprimé');
}

// L3508 (script.js d'origine)
function appliquerAccentColor() {
  const color = document.getElementById('param-accent-color')?.value || '#f5a623';
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('accent_color', color);
  afficherToast('🎨 Couleur appliquée');
}

