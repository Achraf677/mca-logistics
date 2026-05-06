/**
 * MCA Logistics — Module Core-storage
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L227 (script.js d'origine)
function charger(cle)          { return lireStockageJSON(cle, []); }

// L231 (script.js d'origine)
function loadSafe(cle, fallback) { return lireStockageJSON(cle, fallback !== undefined ? fallback : []); }

// L234 (script.js d'origine)
function sauvegarder(cle, val) {
  try {
    const raw = JSON.stringify(val);
    localStorage.setItem(cle, raw);
    STORAGE_CACHE.set(cle, { raw, value: dupliquerValeurStockage(val) });
    return true;
  } catch (error) {
    console.error(`[DelivPro] Impossible d'enregistrer "${cle}" dans le stockage local.`, error);
    const maintenant = Date.now();
    if (maintenant - lastStorageWarningAt > 4000 && typeof afficherToast === 'function') {
      lastStorageWarningAt = maintenant;
      afficherToast('⚠️ Enregistrement local impossible. Vérifiez l’espace navigateur disponible.', 'error');
    }
    return false;
  }
}

// L250 (script.js d'origine)
function chargerObj(cle, def)  { return lireStockageJSON(cle, def); }

// L1041 (script.js d'origine)
function getCompanyAssetsStorageHelper() {
  return window.DelivProSupabase && window.DelivProSupabase.getCompanyAssetsStorage
    ? window.DelivProSupabase.getCompanyAssetsStorage()
    : null;
}

// L1180 (script.js d'origine)
function chargerNomEntreprise() {
  const params = chargerObj('params_entreprise', {});
  const sessionAdmin = getAdminSession();
  const nom = params.nom || 'MCA Logistics';
  const el  = document.getElementById('sidebar-nom-entreprise');
  if (el) el.textContent = nom;
  const adminLabel = sessionAdmin.nom || 'Admin';
  const label = document.getElementById('topbar-admin-label');
  if (label) label.textContent = adminLabel;
  const avatar = document.getElementById('topbar-avatar-text');
  if (avatar) avatar.textContent = adminLabel[0].toUpperCase();
}

// L1292 (script.js d'origine)
function chargerCadreSalarieUnifie() {
  const frame = document.getElementById('espace-salarie-frame');
  if (!frame) return;
  const cible = 'salarie.html?embed=1';
  if (!frame.dataset.loadedSrc) {
    frame.src = cible;
    frame.dataset.loadedSrc = cible;
  }
}

// L1687 (script.js d'origine)
function planifierRafraichissementStorage(cle, callback) {
  if (typeof callback !== 'function') return;
  if (STORAGE_REFRESH_QUEUE.has(cle)) return;
  const executer = function() {
    STORAGE_REFRESH_QUEUE.delete(cle);
    callback();
  };
  const timer = document.visibilityState === 'visible' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(executer)
    : setTimeout(executer, 16);
  STORAGE_REFRESH_QUEUE.set(cle, timer);
}

// L3418 (script.js d'origine)
function charger_note_interne(salId) {
  const notes = loadSafe('notes_internes', {});
  return notes[salId]?.texte || '';
}

// L3423 (script.js d'origine)
function chargerNoteInterne(salId) {
  const notes = loadSafe('notes_internes', {});
  return notes[salId]?.texte || '';
}

// L3557 (script.js d'origine)
async function resolveStorageImages(container) {
  if (!container || !window.DelivProStorage) return;
  const imgs = container.querySelectorAll('img[data-photo-path]:not([data-resolved])');
  for (const img of imgs) {
    const path = img.dataset.photoPath;
    const bucket = img.dataset.photoBucket || 'messages-photos';
    if (!path) continue;
    const signed = await window.DelivProStorage.getSignedUrl(bucket, path, 600);
    if (signed.ok) {
      img.src = signed.signedUrl;
      img.dataset.resolved = '1';
    }
  }
}

// L4002 (script.js d'origine)
function sauvegarderObjectifCA() {
  const val = parseFloat(document.getElementById('param-objectif-ca')?.value) || 0;
  localStorage.setItem('objectif_ca_mensuel', val);
  afficherToast('✅ Objectif CA enregistré : ' + euros(val));
}

// L4028 (script.js d'origine)
function chargerParametres() {
  let params = chargerObj('params_entreprise', {});
  // Pré-remplissage initial MCA au premier affichage (ne stocke pas tant que l'utilisateur n'a pas cliqué Enregistrer)
  if (!params || !Object.keys(params).length) {
    params = Object.assign({}, MCA_DEFAULTS_ENTREPRISE);
  }
  const sessionAdmin = getAdminSession();
  const map = {
    'param-nom-entreprise':       params.nom || '',
    'param-nom-admin':             sessionAdmin.nom || '',
    'param-forme-juridique':       params.formeJuridique || '',
    'param-siret':                 params.siret || '',
    'param-code-ape':              params.codeAPE || '',
    'param-tva-intracom':          params.tvaIntracom || '',
    'param-rcs-ville':             params.rcsVille || '',
    'param-rcs-numero':            params.rcsNumero || '',
    'param-capital':               params.capital != null ? params.capital : '',
    'param-capital-libere':        params.capitalLibere != null ? params.capitalLibere : '',
    'param-adresse':               params.adresse || '',
    'param-code-postal':           params.codePostal || '',
    'param-ville':                 params.ville || '',
    'param-pays':                  params.pays || 'FR',
    'param-tel-entreprise':        params.tel || '',
    'param-email':                 params.email || '',
    'param-lti-numero':            params.ltiNumero || '',
    'param-lti-date-emission':     params.ltiDateEmission || '',
    'param-lti-date-expiration':   params.ltiDateExpiration || '',
    'param-dreal-dossier':         params.drealDossier || '',
    'param-registre-transporteurs':params.registreTransporteurs || '',
    'param-gestionnaire-nom':      params.gestionnaireNom || '',
    'param-capacite-pro-numero':   params.capaciteProNumero || '',
    'param-capacite-pro-date':     params.capaciteProDate || '',
    'param-iban':                  params.iban || '',
    'param-bic':                   params.bic || '',
    'param-banque':                params.banque || '',
    'param-delai-paiement':        params.delaiPaiementDefaut != null ? params.delaiPaiementDefaut : 30,
    'param-taux-penalites':        params.tauxPenalitesRetard != null ? params.tauxPenalitesRetard : 10.15
  };
  Object.entries(map).forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.value=val; });
  const colorEl = document.getElementById('param-accent-color');
  if (colorEl) colorEl.value = localStorage.getItem('accent_color') || '#f5a623';
  const maxTentEl = document.getElementById('param-max-tentatives');
  if (maxTentEl) maxTentEl.value = localStorage.getItem('max_tentatives') || '5';
  const sessionTimeoutEl = document.getElementById('param-session-timeout');
  if (sessionTimeoutEl) sessionTimeoutEl.value = String(getSessionTimeoutMinutesAdmin());
  const compteEl = document.getElementById('param-admin-compte');
  if (compteEl) compteEl.textContent = 'Compte connecté : ' + (sessionAdmin.identifiant || '—');
  appliquerBranding();
  afficherPostes();
  chargerConfigurationTVAParametres();
  chargerConfigurationTresorerieParametres();
  const nouveauPosteInput = document.getElementById('nouveau-poste');
  if (nouveauPosteInput) nouveauPosteInput.value = '';
  majResumeSauvegardeAdmin();
  afficherJournalAudit();
  if (typeof afficherChangelog === 'function') afficherChangelog();
  if (typeof afficherStatutRibEntreprise === 'function') afficherStatutRibEntreprise();
}

// Affiche le statut du RIB entreprise dans la card Informations entreprise.
function afficherStatutRibEntreprise() {
  const params = chargerObj('params_entreprise', {}) || {};
  const statusEl = document.getElementById('param-rib-status');
  const viewBtn = document.getElementById('param-rib-view-btn');
  if (!statusEl) return;
  if (params.ribPath) {
    statusEl.textContent = '✅ RIB chargé';
    statusEl.style.color = 'var(--success, #2ecc71)';
    if (viewBtn) viewBtn.style.display = '';
  } else {
    statusEl.textContent = 'Aucun document chargé';
    statusEl.style.color = 'var(--text-muted)';
    if (viewBtn) viewBtn.style.display = 'none';
  }
}

// Upload RIB entreprise -> bucket prive 'company-docs'. Stocke le path
// dans params_entreprise.ribPath. Supprime l'ancien fichier si remplace.
async function uploaderRibEntreprise(input) {
  const file = input?.files?.[0];
  if (!file) return;
  if (!window.DelivProStorage) {
    afficherToast('⚠️ Storage Supabase indisponible', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    afficherToast('⚠️ RIB trop lourd (5 Mo max)', 'error');
    input.value = '';
    return;
  }
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const safeExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'pdf';
  const newPath = 'rib/rib-' + Date.now() + '.' + safeExt;
  const statusEl = document.getElementById('param-rib-status');
  if (statusEl) { statusEl.textContent = 'Upload en cours…'; statusEl.style.color = 'var(--text-muted)'; }
  const res = await window.DelivProStorage.compressAndUpload('company-docs', newPath, file, {
    skipCompression: file.type === 'application/pdf',
    contentType: file.type
  });
  if (!res.ok) {
    afficherToast('⚠️ Upload RIB échoué : ' + (res.error?.message || 'inconnue'), 'error');
    if (statusEl) statusEl.textContent = 'Échec upload';
    input.value = '';
    return;
  }
  const params = chargerObj('params_entreprise', {}) || {};
  const ancienPath = params.ribPath;
  params.ribPath = res.path;
  sauvegarder('params_entreprise', params);
  // Cleanup ancien fichier
  if (ancienPath && ancienPath !== res.path) {
    try { await window.DelivProStorage.remove('company-docs', ancienPath); } catch (_) {}
  }
  afficherToast('✅ RIB chargé');
  afficherStatutRibEntreprise();
  input.value = '';
  if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('Upload RIB entreprise', file.name);
}

// Ouvre le RIB dans un nouvel onglet via signed URL (10 min TTL).
async function voirRibEntreprise() {
  const params = chargerObj('params_entreprise', {}) || {};
  if (!params.ribPath || !window.DelivProStorage) {
    afficherToast('⚠️ RIB introuvable', 'error');
    return;
  }
  const res = await window.DelivProStorage.getSignedUrl('company-docs', params.ribPath, 600);
  if (res.ok && res.signedUrl) window.open(res.signedUrl, '_blank');
  else afficherToast('⚠️ Erreur ouverture : ' + (res.error?.message || 'inconnue'), 'error');
}

// Charge CHANGELOG.md et le rend en HTML simple dans la carte "Historique des versions".
// Markdown minimal supporté : ## titres (versions), ### sous-sections, listes -, **gras**, code inline.
function afficherChangelog() {
  const container = document.getElementById('changelog-content');
  if (!container) return;
  fetch('/CHANGELOG.md', { cache: 'no-cache' })
    .then(r => r.ok ? r.text() : Promise.reject(r.status))
    .then(md => { container.innerHTML = renderChangelogMarkdown(md); })
    .catch(err => {
      container.innerHTML = '<div style="color:var(--text-muted)">Historique indisponible (' + err + ')</div>';
    });
}

function renderChangelogMarkdown(md) {
  // Échappe HTML d'abord pour la sécurité (XSS)
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  let inIntro = true;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('# ')) { /* titre principal — on saute */ continue; }
    if (line.startsWith('## ')) {
      closeList();
      inIntro = false;
      out.push('<h3 style="margin:18px 0 6px;color:var(--accent);font-size:1rem">' + escape(line.slice(3)) + '</h3>');
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push('<h4 style="margin:10px 0 4px;font-size:.88rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">' + escape(line.slice(4)) + '</h4>');
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul style="margin:4px 0 8px 18px;padding:0">'); inList = true; }
      out.push('<li style="margin-bottom:4px">' + inlineFormat(escape(line.slice(2))) + '</li>');
      continue;
    }
    if (line === '---') { closeList(); out.push('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0" />'); continue; }
    closeList();
    if (line === '' || inIntro) continue;
    out.push('<p style="margin:6px 0">' + inlineFormat(escape(line)) + '</p>');
  }
  closeList();
  return out.join('');
}

function inlineFormat(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-dark);padding:1px 5px;border-radius:3px;font-size:.82em">$1</code>');
}

// L4087 (script.js d'origine)
function sauvegarderPostes(postes) { localStorage.setItem('postes', JSON.stringify(postes)); }

// L4138 (script.js d'origine)
function sauvegarderParametres() {
  const sessionAdmin = getAdminSession();
  const adminNomSaisi = document.getElementById('param-nom-admin')?.value.trim() || 'Admin';
  const siretRaw = (document.getElementById('param-siret')?.value || '').replace(/\s+/g, '');
  // SIRET optionnel tant que la société n'est pas immatriculée — validation uniquement si saisi
  if (siretRaw) {
    if (!/^\d{14}$/.test(siretRaw)) {
      afficherToast('⚠️ Le SIRET doit contenir 14 chiffres (ou laissez vide si en cours d\'immatriculation)', 'error');
      return;
    }
    if (!validerSIRET(siretRaw)) {
      afficherToast('⚠️ SIRET invalide (clé de contrôle Luhn incorrecte)', 'error');
      return;
    }
  }
  const adminNom = window.DelivProAuth && typeof window.DelivProAuth.normalizeAdminDisplayName === 'function'
    ? window.DelivProAuth.normalizeAdminDisplayName(adminNomSaisi, sessionAdmin.identifiant, sessionAdmin.email)
    : adminNomSaisi;
  const tvaIntracomRaw = (document.getElementById('param-tva-intracom')?.value || '').replace(/\s+/g, '').toUpperCase();
  if (tvaIntracomRaw) {
    const validation = validerTVAIntracomFR(tvaIntracomRaw);
    if (!validation.valid) {
      afficherToast('⚠️ N° TVA intracom invalide : ' + (validation.message || 'format incorrect'), 'error');
      return;
    }
  }
  const getParamVal = (id) => (document.getElementById(id)?.value || '').trim();
  const getParamNum = (id) => {
    const v = getParamVal(id);
    if (v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const paramsExistants = chargerObj('params_entreprise', {});
  const params = Object.assign({}, paramsExistants, {
    nom:                   getParamVal('param-nom-entreprise') || 'MCA LOGISTICS',
    nomAdmin:              adminNom,
    formeJuridique:        getParamVal('param-forme-juridique'),
    siret:                 siretRaw,
    codeAPE:               getParamVal('param-code-ape').toUpperCase(),
    tvaIntracom:           tvaIntracomRaw,
    rcsVille:              getParamVal('param-rcs-ville'),
    rcsNumero:             getParamVal('param-rcs-numero').replace(/\s+/g, ''),
    capital:               getParamNum('param-capital'),
    capitalLibere:         getParamNum('param-capital-libere'),
    adresse:               getParamVal('param-adresse'),
    codePostal:            getParamVal('param-code-postal'),
    ville:                 getParamVal('param-ville'),
    pays:                  (getParamVal('param-pays') || 'FR').toUpperCase(),
    tel:                   getParamVal('param-tel-entreprise'),
    email:                 getParamVal('param-email'),
    ltiNumero:             getParamVal('param-lti-numero'),
    ltiDateEmission:       getParamVal('param-lti-date-emission'),
    ltiDateExpiration:     getParamVal('param-lti-date-expiration'),
    drealDossier:          getParamVal('param-dreal-dossier'),
    registreTransporteurs: getParamVal('param-registre-transporteurs'),
    gestionnaireNom:       getParamVal('param-gestionnaire-nom'),
    capaciteProNumero:     getParamVal('param-capacite-pro-numero'),
    capaciteProDate:       getParamVal('param-capacite-pro-date'),
    iban:                  getParamVal('param-iban').replace(/\s+/g, '').toUpperCase(),
    bic:                   getParamVal('param-bic').toUpperCase(),
    banque:                getParamVal('param-banque'),
    delaiPaiementDefaut:   (getParamNum('param-delai-paiement') != null) ? getParamNum('param-delai-paiement') : 30,
    tauxPenalitesRetard:   (getParamNum('param-taux-penalites') != null) ? getParamNum('param-taux-penalites') : 10.15,
    // Compat : champ legacy "rcs" = "Ville Numéro" (consommé par renderFactureMentionsEntrepriseHeader existant)
    rcs: [getParamVal('param-rcs-ville'), getParamVal('param-rcs-numero').replace(/\s+/g,'')].filter(Boolean).join(' ')
  });
  sauvegarder('params_entreprise', params);
  const comptes = getAdminAccounts();
  const idx = comptes.findIndex(c => c.identifiant === sessionAdmin.identifiant);
  if (idx > -1) {
    comptes[idx].nom = adminNom;
    saveAdminAccounts(comptes);
  }
  sessionStorage.setItem('admin_nom', adminNom);
  chargerNomEntreprise();
  appliquerBranding();
  // BUG-020 fix : rafraîchir le formulaire pour refléter immédiatement la valeur
  // normalisée (ex. TVA intracom nettoyée, SIRET formaté, capital, forme juridique).
  if (typeof chargerParametres === 'function') {
    try { chargerParametres(); } catch (_) { /* silencieux : non bloquant */ }
  }
  ajouterEntreeAudit('Paramètres entreprise', (params.nom || 'Entreprise') + (siretRaw ? ' · SIRET ' + siretRaw : ' · en cours d\'immatriculation'));
  afficherToast('✅ Paramètres enregistrés');
}

// L4298 (script.js d'origine)
function sauvegarderMaxTentatives() {
  const val = parseInt(document.getElementById('param-max-tentatives')?.value, 10) || 5;
  const timeoutVal = Math.min(240, Math.max(5, parseInt(document.getElementById('param-session-timeout')?.value || '30', 10) || 30));
  localStorage.setItem('max_tentatives', val);
  localStorage.setItem('session_timeout_min', timeoutVal);
  resetTimerInactivite();
  afficherToast('✅ Blocage après ' + val + ' tentatives · Déconnexion auto ' + timeoutVal + ' min');
}

// L4491 (script.js d'origine)
function sauvegarderFacturesEmises(factures) {
  sauvegarder('factures_emises', factures);
}

