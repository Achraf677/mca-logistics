/* =====================================================
   DelivPro — script.js  (v20 — full featured + bugfixes)
   ===================================================== */

/* ===== UTILITAIRES ===== */
// BUG-022 fix : toISOString() convertit en UTC → décalage d'un jour si fuseau != UTC.
// toLocalISODate() retourne YYYY-MM-DD dans le fuseau local (utilisé partout à la place de toISOString().slice(0,10)).
if (!Date.prototype.toLocalISODate) {
  Date.prototype.toLocalISODate = function() {
    if (isNaN(this.getTime())) return '';
    const y = this.getFullYear();
    const m = String(this.getMonth() + 1).padStart(2, '0');
    const d = String(this.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
}
if (!Date.prototype.toLocalISOMonth) {
  Date.prototype.toLocalISOMonth = function() {
    if (isNaN(this.getTime())) return '';
    const y = this.getFullYear();
    const m = String(this.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  };
}

// BUG-012 fix : escape HTML/attribute centralisés — source unique de vérité pour prévenir XSS.
// Exposés sur window + fonctions nommées hoistées (disponibles dans tous les scopes IIFE/helpers).
// MOVED -> script-core-utils.js : escapeHtml
// MOVED -> script-core-utils.js : escapeAttr
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.escHtml = escapeHtml; // alias attendu par certains call sites existants

// BUG-009 fix : validateurs SIRET (Luhn) + IBAN (mod-97)
function validerSIRET(siret) {
  const s = String(siret || '').replace(/\s+/g, '');
  if (!/^\d{14}$/.test(s)) return false;
  // Algorithme de Luhn : positions impaires (depuis la droite) ×1, paires ×2
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(s[13 - i], 10);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  // Exception La Poste : SIRET 356000000XXXXX accepté par DGFiP si somme chiffres = multiple de 5
  if (s.startsWith('356000000')) {
    let sumPoste = 0;
    for (const c of s) sumPoste += parseInt(c, 10);
    return sumPoste % 5 === 0;
  }
  return sum % 10 === 0;
}

// Validation SIREN (9 chiffres, Luhn) — utilisée pour la validation inline du formulaire livraison
// MOVED -> script-clients.js : validerSIREN

// BUG-014 fix : guard double-clic — debounce sur boutons d'action (Créer/Générer/Valider/Enregistrer/Payer/Sauvegarder).
// Détecte via label + attributs. Ignore les boutons de fermeture, navigation, tri, etc.
(function() {
  if (window.__delivproDoubleClickGuardInstalled) return;
  window.__delivproDoubleClickGuardInstalled = true;
  const GUARD_DELAY_MS = 700;
  const DECLENCHEURS = /^(cr[ée]er|g[ée]n[ée]rer|valider|enregistrer|sauvegarder|payer|confirmer|envoyer|ajouter|soumettre|transmettre)/i;
  function estBoutonAction(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.tagName !== 'BUTTON') return false;
    if (el.type === 'reset') return false;
    if (el.hasAttribute('data-no-guard')) return false;
    if (el.closest('.modal-header, .modal-close, .sidebar, .topbar-user-menu, .pagination, thead, .filters')) return false;
    const txt = (el.textContent || '').trim();
    if (!txt) return false;
    if (el.classList.contains('btn-primary') || el.classList.contains('btn-success')) return DECLENCHEURS.test(txt);
    return DECLENCHEURS.test(txt);
  }
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!estBoutonAction(btn)) return;
    if (btn.__delivproBusy) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    btn.__delivproBusy = true;
    const prevDisabled = btn.disabled;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    setTimeout(function() {
      btn.__delivproBusy = false;
      btn.disabled = prevDisabled;
      btn.removeAttribute('aria-busy');
    }, GUARD_DELAY_MS);
  }, true);
})();

// BUG-029 fix : garde popup blocker — toute ouverture passe par ouvrirPopupSecure() qui détecte le blocage et notifie.
// Centralisation : un seul site à auditer si on change le message / le fallback.
// MOVED -> script-core-ui.js : ouvrirPopupSecure
window.ouvrirPopupSecure = ouvrirPopupSecure;

// BUG-018/019/031 fix : registre global + cleanup au unload (timers + observers orphelins).
// Monkey-patch non invasif : les 35 setInterval et les MutationObserver existants sont captés automatiquement.
if (!window.__delivproLifecyclePatched) {
  window.__delivproLifecyclePatched = true;
  window.__delivproIntervals = new Set();
  window.__delivproObservers = new Set();

  const nativeSetInterval = window.setInterval;
  const nativeClearInterval = window.clearInterval;
  window.setInterval = function() {
    const id = nativeSetInterval.apply(this, arguments);
    try { window.__delivproIntervals.add(id); } catch(e) {}
    return id;
  };
  window.clearInterval = function(id) {
    try { window.__delivproIntervals.delete(id); } catch(e) {}
    return nativeClearInterval.call(this, id);
  };

  if (typeof window.MutationObserver === 'function') {
    const NativeMO = window.MutationObserver;
    function PatchedMO(cb) {
      const inst = new NativeMO(cb);
      try { window.__delivproObservers.add(inst); } catch(e) {}
      const nativeDisc = inst.disconnect.bind(inst);
      inst.disconnect = function() {
        try { window.__delivproObservers.delete(inst); } catch(e) {}
        return nativeDisc();
      };
      return inst;
    }
    PatchedMO.prototype = NativeMO.prototype;
    window.MutationObserver = PatchedMO;
  }

  window.addEventListener('beforeunload', function() {
    try { window.__delivproIntervals.forEach(function(id){ try { nativeClearInterval(id); } catch(e) {} }); } catch(e) {}
    try { window.__delivproObservers.forEach(function(o){ try { o.disconnect(); } catch(e) {} }); } catch(e) {}
  });
}

const STORAGE_CACHE = new Map();
let lastStorageWarningAt = 0;

function emettreEvenementStockageLocal(cle, oldValue, newValue) {
  window.dispatchEvent(new CustomEvent('delivpro:storage-sync', {
    detail: {
      key: cle || '',
      oldValue: oldValue == null ? null : String(oldValue),
      newValue: newValue == null ? null : String(newValue)
    }
  }));
}

if (!window.__delivproStoragePatched) {
  window.__delivproStoragePatched = true;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeClear = Storage.prototype.clear;

  Storage.prototype.setItem = function(cle, valeur) {
    const ancienneValeur = this === window.localStorage ? this.getItem(cle) : null;
    STORAGE_CACHE.delete(String(cle));
    const resultat = nativeSetItem.call(this, cle, valeur);
    if (this === window.localStorage) emettreEvenementStockageLocal(String(cle), ancienneValeur, valeur);
    return resultat;
  };

  Storage.prototype.removeItem = function(cle) {
    const ancienneValeur = this === window.localStorage ? this.getItem(cle) : null;
    STORAGE_CACHE.delete(String(cle));
    const resultat = nativeRemoveItem.call(this, cle);
    if (this === window.localStorage) emettreEvenementStockageLocal(String(cle), ancienneValeur, null);
    return resultat;
  };

  Storage.prototype.clear = function() {
    STORAGE_CACHE.clear();
    const resultat = nativeClear.call(this);
    if (this === window.localStorage) emettreEvenementStockageLocal('', null, null);
    return resultat;
  };
}

function dupliquerValeurStockage(valeur) {
  if (valeur === null || valeur === undefined) return valeur;
  if (typeof valeur !== 'object') return valeur;
  // PERF: JSON.parse(JSON.stringify) est ~3x plus rapide que structuredClone
  // pour des données JSON pures (localStorage = toujours JSON-safe).
  return JSON.parse(JSON.stringify(valeur));
}

function lireStockageJSON(cle, fallback) {
  const raw = localStorage.getItem(cle);
  const cached = STORAGE_CACHE.get(cle);

  // PERF: cache hit → JSON.parse direct sur le raw string mis en cache
  // (saute l'étape JSON.stringify du deep-clone). ~2x plus rapide que l'ancien
  // dupliquerValeurStockage(cached.value) qui faisait stringify→parse.
  if (cached && cached.raw === raw) {
    if (raw === null) return dupliquerValeurStockage(cached.value);
    try { return JSON.parse(raw); } catch (_) { return dupliquerValeurStockage(cached.value); }
  }

  if (raw === null) {
    STORAGE_CACHE.set(cle, { raw: null, value: fallback });
    return dupliquerValeurStockage(fallback);
  }

  try {
    const parsed = JSON.parse(raw);
    STORAGE_CACHE.set(cle, { raw, value: parsed });
    // 1ère lecture : retourne un nouveau parse (copie fraîche pour mutations sûres)
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[DelivPro] Donnée locale invalide pour "${cle}", fallback utilisé.`, error);
    STORAGE_CACHE.set(cle, { raw, value: fallback });
    return dupliquerValeurStockage(fallback);
  }
}

// logMCA — wrapper console.log conditionnel. Désactivé en prod (BUG-034).
// Activer via : localStorage.setItem('mca_debug', '1') puis recharger.
window.__MCA_DEBUG = window.__MCA_DEBUG || (function(){ try { return localStorage.getItem('mca_debug') === '1'; } catch(e){ return false; } })();
function logMCA() { if (window.__MCA_DEBUG && typeof console !== 'undefined' && console.log) console.log.apply(console, arguments); }
window.logMCA = logMCA;

// MOVED -> script-core-storage.js : charger
// loadSafe : alias global pour JSON.parse résilient du localStorage.
// Usage : loadSafe('factures_emises', []) ou loadSafe('params', {}).
// Toujours préférer à loadSafe(..., []) qui crash sur corruption.
// MOVED -> script-core-storage.js : loadSafe
window.loadSafe = loadSafe;
window.lireStockageJSON = lireStockageJSON;
// MOVED -> script-core-storage.js : sauvegarder
// MOVED -> script-core-storage.js : chargerObj

// BUG-050 fix : purge défensive de données corrompues ou de test résiduelles en localStorage.
// Exécuté une seule fois au chargement du script, avant toute lecture métier.
(function purgerDonneesCorrompuesAuBoot() {
  try {
    if (typeof localStorage === 'undefined') return;
    const MARQUEURS_INVALIDES = ['xxxxxxxGAR', 'xxxxxxGAR', 'undefined', '[object Object]'];
    const CLES_JSON = [
      'factures_emises', 'livraisons', 'clients', 'fournisseurs',
      'vehicules', 'salaries', 'employes', 'charges', 'entretiens',
      'paiements', 'avoirs_emis', 'immobilisations', 'amortissements_dotations',
      'cloture_ajustements', 'audit_log'
    ];
    let purges = 0;
    CLES_JSON.forEach(function (cle) {
      const raw = localStorage.getItem(cle);
      if (!raw) return;
      // Marqueurs de corruption connus (données de test DEMO non purgées)
      const contientMarqueur = MARQUEURS_INVALIDES.some(function (m) {
        return raw.indexOf(m) !== -1;
      });
      if (contientMarqueur) {
        console.warn('[MCA] Purge "' + cle + '" (données de test détectées).');
        localStorage.removeItem(cle);
        purges++;
        return;
      }
      // JSON invalide
      try { JSON.parse(raw); }
      catch (_) {
        console.warn('[MCA] Purge "' + cle + '" (JSON invalide).');
        localStorage.removeItem(cle);
        purges++;
      }
    });
    if (purges > 0) {
      console.info('[MCA] ' + purges + ' clé(s) de stockage corrompue(s) purgée(s).');
    }
  } catch (e) {
    console.warn('[MCA] Purge boot stockage : échec silencieux.', e);
  }
})();

// genId — identifiant unique. Préfère crypto.randomUUID() (RFC 4122 v4, collision ~0).
// Fallback getRandomValues pour 16 octets aléatoires, puis Math.random en dernier recours.
// MOVED -> script-core-utils.js : genId
window.genId = genId;
function dateToLocalISO(date)  {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function aujourdhui()          { return dateToLocalISO(new Date()); }
function euros(n)              { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(parseFloat(n||0)); }
function round2(n)             { return Math.round((parseFloat(n || 0) + Number.EPSILON) * 100) / 100; }
function hasNegativeNumber()   {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (typeof value === 'number' && Number.isFinite(value) && value < 0) return true;
  }
  return false;
}
// MOVED -> script-core-utils.js : formatKm
// MOVED -> script-core-utils.js : formatDateExport
// MOVED -> script-heures.js : formatDateHeureExport
function getAuditActorLabel() {
  const sessionAdmin = typeof getAdminSession === 'function' ? getAdminSession() : {};
  return sessionAdmin.nom || sessionAdmin.identifiant || sessionAdmin.email || 'Admin';
}
function ajouterEntreeAudit(action, detail, meta) {
  const logs = charger('audit_log');
  logs.push({
    id: genId(),
    date: new Date().toISOString(),
    admin: getAuditActorLabel(),
    action: action || 'Action',
    detail: detail || '—',
    meta: meta || {}
  });
  while (logs.length > 400) logs.shift();
  sauvegarder('audit_log', logs);
  if (typeof afficherJournalAudit === 'function' && window.__delivproCurrentPage === 'parametres') afficherJournalAudit();
}
function afficherJournalAudit() {
  const tb = document.getElementById('tb-audit-log');
  if (!tb) return;
  const logs = charger('audit_log').slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 40);
  if (!logs.length) {
    tb.innerHTML = '<tr><td colspan="4" class="empty-row">Aucune action journalisée</td></tr>';
    return;
  }
  tb.innerHTML = logs.map(function(log) {
    return '<tr>'
      + '<td style="white-space:nowrap">' + formatDateHeureExport(log.date) + '</td>'
      + '<td>' + (log.admin || 'Admin') + '</td>'
      + '<td><strong>' + (log.action || 'Action') + '</strong></td>'
      + '<td style="font-size:.84rem;color:var(--text-muted)">' + (log.detail || '—') + '</td>'
      + '</tr>';
  }).join('');
}
// MOVED -> script-exports.js : exporterJournalAuditCSV
async function viderJournalAudit() {
  const ok = await confirmDialog('Vider le journal d’audit ? Cette action supprime l’historique local enregistré.', { titre:'Journal d’audit', icone:'📜', btnLabel:'Vider' });
  if (!ok) return;
  sauvegarder('audit_log', []);
  afficherJournalAudit();
  afficherToast('🗑️ Journal d’audit vidé');
}
// MOVED -> script-salaries.js : notifierSalarieSiAbsente
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
    + `<div><div style="font-size:1.35rem;font-weight:800;color:#f5a623">${planningEscapeHtml(params.nom || 'MCA Logistics')}</div>`
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
function getLogoEntrepriseExportSrc() {
  return getLogoEntreprise()
    || document.querySelector('.logo-icon img')?.src
    || document.querySelector('#param-logo-preview img')?.src
    || '';
}
function renderLogoEntrepriseExport() {
  const logo = getLogoEntrepriseExportSrc();
  return logo
    ? `<img src="${logo}" alt="Logo entreprise" class="export-logo" style="width:62px;height:62px;object-fit:contain;border-radius:14px;border:1px solid #e5e7eb;background:#fff;padding:6px" />`
    : '';
}
// ==========================================================================
// AMORTISSEMENT — moteur unifié (CGI art. 39 A, PCG base 360)
// Sert aux véhicules (calculerAmortissementVehicule) ET aux immobilisations
// générales (s30CalculerPlan). Coefficients dégressifs fiscaux :
//   durée 3-4 ans → 1.25 · 5-6 ans → 1.75 · 7+ ans → 2.25
// Switchover automatique vers le taux linéaire résiduel en dégressif.
// ==========================================================================
function coefAmortissementDegressif(duree) {
  const d = Number(duree) || 0;
  if (d >= 3 && d <= 4) return 1.25;
  if (d >= 5 && d <= 6) return 1.75;
  if (d >= 7) return 2.25;
  return 1;
}
window.coefAmortissementDegressif = coefAmortissementDegressif;

function construirePlanAmortissement(opts) {
  opts = opts || {};
  const valeurHT = parseFloat(opts.valeurHT) || 0;
  const valeurRebut = parseFloat(opts.valeurRebut) || 0;
  const base = Math.max(0, valeurHT - valeurRebut);
  const duree = Math.max(0, Math.round(Number(opts.dureeAnnees) || 0));
  const mode = opts.mode === 'degressif' ? 'degressif' : 'lineaire';
  const parseISO = (s) => {
    if (!s) return null;
    const str = String(s);
    const d = new Date(str.length <= 10 ? str + 'T00:00:00' : str);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dateMes = parseISO(opts.dateMiseEnService);
  const dateCession = parseISO(opts.dateCession);
  const refDate = parseISO(opts.dateReference) || new Date();
  const plan = [];
  const empty = {
    plan, mode, base, duree,
    coefficient: mode === 'degressif' ? coefAmortissementDegressif(duree) : 1,
    dotationAnnuelleTheorique: 0, dotationMensuelleTheorique: 0,
    cumuleAujourdHui: 0, reste: base,
    prorataPremierExercice: 0
  };
  if (!base || !duree || !dateMes) return empty;

  const anneeStart = dateMes.getFullYear();
  const jourDebut = dateMes.getDate();
  const moisDebut = dateMes.getMonth() + 1;
  const joursAnnee1 = Math.max(0, (12 - moisDebut) * 30 + (30 - jourDebut + 1));
  const proRata1 = joursAnnee1 / 360;

  if (mode === 'lineaire') {
    const dotationComplete = round2(base / duree);
    const dotationAnnee1 = round2(dotationComplete * proRata1);
    let vnc = base, restant = base;
    const d1 = Math.min(dotationAnnee1, restant);
    vnc = round2(vnc - d1); restant = round2(restant - d1);
    plan.push({ annee: anneeStart, dotation: d1, vnc, base, proRata: Math.round(proRata1 * 100) });
    let anneesUtilisees = proRata1;
    let year = anneeStart + 1;
    while (restant > 0.01 && anneesUtilisees < duree + 1.1) {
      const anneesRestantes = Math.max(1, duree - anneesUtilisees);
      let dot = (anneesRestantes >= 1) ? dotationComplete : round2(dotationComplete * anneesRestantes);
      if (dot > restant) dot = round2(restant);
      vnc = round2(vnc - dot); restant = round2(restant - dot);
      plan.push({ annee: year, dotation: dot, vnc, base, proRata: 100 });
      year++; anneesUtilisees += 1;
      if (plan.length > 40) break;
    }
  } else {
    const coef = coefAmortissementDegressif(duree);
    const tauxDegressif = duree > 0 ? (1 / duree) * coef : 0;
    let vnc = base;
    for (let i = 0; i < duree; i++) {
      const annee = anneeStart + i;
      const anneesRestantes = duree - i;
      const tauxLineaireResid = anneesRestantes > 0 ? 1 / anneesRestantes : 0;
      const tauxEffectif = Math.max(tauxDegressif, tauxLineaireResid);
      let dot = vnc * tauxEffectif;
      if (i === 0) {
        const moisRestants = 13 - moisDebut;
        dot = vnc * tauxDegressif * (moisRestants / 12);
      }
      dot = round2(dot);
      if (dot > vnc) dot = round2(vnc);
      vnc = round2(vnc - dot);
      plan.push({ annee, dotation: dot, vnc, base, proRata: i === 0 ? Math.round(((13 - moisDebut) / 12) * 100) : 100 });
      if (vnc <= 0.01) break;
    }
    if (vnc > 0.01 && plan.length > 0) {
      plan[plan.length - 1].dotation = round2(plan[plan.length - 1].dotation + vnc);
      plan[plan.length - 1].vnc = 0;
    }
  }

  // Synthèse (dotations "typiques" + cumul à la date de référence)
  const dotationAnnuelleTheorique = round2(base / Math.max(1, duree));
  const dotationMensuelleTheorique = round2(dotationAnnuelleTheorique / 12);
  const stopDate = (dateCession && dateCession < refDate) ? dateCession : refDate;
  let cumule = 0;
  plan.forEach(l => {
    if (l.annee < stopDate.getFullYear()) {
      cumule += l.dotation;
    } else if (l.annee === stopDate.getFullYear()) {
      const moisEcoulesDansAnnee = stopDate.getMonth() + 1;
      cumule += l.dotation * (moisEcoulesDansAnnee / 12);
    }
  });
  cumule = Math.min(base, round2(cumule));

  return {
    plan, mode, base, duree,
    coefficient: mode === 'degressif' ? coefAmortissementDegressif(duree) : 1,
    dotationAnnuelleTheorique,
    dotationMensuelleTheorique,
    cumuleAujourdHui: cumule,
    reste: Math.max(0, round2(base - cumule)),
    prorataPremierExercice: proRata1
  };
}
window.construirePlanAmortissement = construirePlanAmortissement;

// MOVED -> script-vehicules.js : calculerAmortissementVehicule
window.calculerAmortissementVehicule = calculerAmortissementVehicule;
// MOVED -> script-tva.js : formaterTaux
// MOVED -> script-vehicules.js : getVehiculeById
// MOVED -> script-entretiens.js : getTypeEntretienLabel
// MOVED -> script-tva.js : getTauxDeductibiliteVehicule
// MOVED -> script-carburant.js : getTauxDeductibiliteCarburant
// MOVED -> script-entretiens.js : getTauxDeductibiliteEntretien

// MOVED -> script-tva.js : calculerMontantTVAFromHT

// MOVED -> script-tva.js : parseTauxTVAValue

// MOVED -> script-charges.js : getChargeMontantHT

// MOVED -> script-tva.js : getChargeMontantTVA

// MOVED -> script-tva.js : getChargeTauxDeductibilite

// MOVED -> script-carburant.js : getCarburantMontantHT

// MOVED -> script-carburant.js : getCarburantMontantTVA

// MOVED -> script-entretiens.js : getEntretienMontantHT

// MOVED -> script-entretiens.js : getEntretienMontantTVA

function normaliserDateISO(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  var d = new Date(val);
  return Number.isNaN(d.getTime()) ? '' : dateToLocalISO(d);
}

// MOVED -> script-tva.js : getTVAConfig

// MOVED -> script-tva.js : getTVARegimeLabel

// MOVED -> script-tva.js : getTVAActiviteLabel

// BUG-011 : retrouve la fiche client liée à une livraison via clientId (priorité) ou nom (fallback).
// MOVED -> script-clients.js : trouverClientParLivraison

// BUG-011 : mention TVA légale (CGI art. 242 nonies A II) selon régime et client destinataire.
// Retourne le texte à afficher sur le PDF / facture HTML. Si taux > 0 et pas d'exonération, retourne "TVA <taux>%".
// MOVED -> script-tva.js : choisirMentionTVALegale

// MOVED -> script-tva.js : getTVAExigibiliteLabel

// MOVED -> script-tva.js : getTVAPeriodiciteLabel

// MOVED -> script-tva.js : getTVADefaultPeriodInput

// MOVED -> script-tva.js : getTVADeclarationPeriodKeyFromDate

// MOVED -> script-tva.js : getTVADeclarationPeriodRangeFromKey

// MOVED -> script-tva.js : getTVADeclarationPeriodLabel

// MOVED -> script-tva.js : normaliserTVAPeriodeKey

// MOVED -> script-tva.js : getTVAPeriodKeysForRange

// MOVED -> script-tva.js : getTVASettlementPeriodKey

// MOVED -> script-tva.js : getTVASettlementLabel

// MOVED -> script-tva.js : getLivraisonTVAOperationType

// MOVED -> script-tva.js : getLivraisonTVAExigibiliteDate

// MOVED -> script-tva.js : buildTVACollecteeEntryFromLivraison

// MOVED -> script-tva.js : buildTVACollecteeData

// MOVED -> script-tva.js : buildTVADeductibleEntries

// MOVED -> script-tva.js : buildTVASettlementEntries

// MOVED -> script-tva.js : getTVASummaryForRange


// MOVED -> script-vehicules.js : ouvrirFicheVehiculeDepuisTableau
// MOVED -> script-entretiens.js : getLabelVehiculeEntretien
// MOVED -> script-salaries.js : getSalarieVehicule
// MOVED -> script-stats.js : getSalarieStatsMois
// MOVED -> script-salaries.js : getSalarieConformiteBadges
// MOVED -> script-salaries.js : ouvrirLivraisonsSalarie
// MOVED -> script-planning.js : ouvrirPlanningSalarie
// MOVED -> script-heures.js : ouvrirHeuresSalarie
// MOVED -> script-planning.js : ouvrirPlanningRecurrence
// MOVED -> script-core-ui.js : fermerInlineDropdowns
// MOVED -> script-core-ui.js : positionnerInlineDropdown
// MOVED -> script-core-ui.js : buildInlineActionsDropdown
// MOVED -> script-core-ui.js : toggleInlineDropdown
// MOVED -> script-carburant.js : syncChargeCarburant
// MOVED -> script-carburant.js : removeChargeCarburant
// MOVED -> script-carburant.js : enrichirPleinCarburant
// MOVED -> script-core-utils.js : calculerDureeJour
// MOVED -> script-livraisons.js : getMontantHTLivraison

// MOVED -> script-livraisons.js : getLivraisonStatutPaiement
// MOVED -> script-carburant.js : getMontantHTCarburant
// MOVED -> script-entretiens.js : getMontantHTEntretien
function getDateRangeInclusive(debut, fin) {
  const dates = [];
  if (!debut || !fin) return dates;
  const current = new Date(debut + 'T00:00:00');
  const end = new Date(fin + 'T00:00:00');
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
function getLogoEntreprise() {
  return localStorage.getItem('logo_entreprise_url') || localStorage.getItem('logo_entreprise') || '';
}
// MOVED -> script-core-auth.js : getDefaultAdminAccounts
// MOVED -> script-core-auth.js : adminCompteEstConfigureLocal
// MOVED -> script-core-auth.js : getAdminAccounts
// MOVED -> script-core-auth.js : saveAdminAccounts
function getSecurityHelper() {
  return window.DelivProSecurity || null;
}
// MOVED -> script-core-auth.js : getSessionTimeoutMinutesAdmin
function evaluerQualiteMotDePasseFort(value) {
  const security = getSecurityHelper();
  if (security && typeof security.evaluatePassword === 'function') {
    return security.evaluatePassword(value, { minLength: 8 });
  }
  const motDePasse = String(value || '');
  if (!motDePasse) return { ok: false, message: 'Utilisez au moins 8 caractères avec majuscule, minuscule et chiffre.', color: 'var(--text-muted)' };
  if (motDePasse.length >= 8) return { ok: true, message: 'Mot de passe conforme.', color: 'var(--green)' };
  return { ok: false, message: 'Utilisez au moins 8 caractères.', color: 'var(--red)' };
}
// BUG-021 fix : fallback btoa casse sur Unicode (emoji, accents). UTF-8 encode avant btoa.
function btoaUnicodeSafe(str) {
  try {
    return btoa(unescape(encodeURIComponent(String(str || ''))));
  } catch (e) {
    try { return btoa(String(str || '')); } catch (_) { return ''; }
  }
}
async function hasherMotDePasseLocal(value) {
  const security = getSecurityHelper();
  if (security && typeof security.hashPassword === 'function') {
    return security.hashPassword(value);
  }
  return btoaUnicodeSafe(value);
}
async function verifierMotDePasseLocal(value, storedValue) {
  const security = getSecurityHelper();
  if (security && typeof security.verifyPassword === 'function') {
    return security.verifyPassword(value, storedValue);
  }
  const stored = String(storedValue || '');
  const plain = String(value || '');
  return stored === plain || stored === btoaUnicodeSafe(plain);
}
// MOVED -> script-core-auth.js : getAdminSession
const ADMIN_EDIT_LOCKS_KEY = 'admin_edit_locks';
const ADMIN_EDIT_LOCK_TTL_MS = 20 * 60 * 1000;
const adminHeldEditLocks = new Set();
let derniereAlerteConflitEdition = '';

// MOVED -> script-core-auth.js : getAdminActorKey

// MOVED -> script-core-auth.js : getAdminActorLabel

// MOVED -> script-core-auth.js : getAdminEditLocks

// MOVED -> script-core-auth.js : getAdminEditLockKey

function synchroniserVerrousEdition() {
  if (window.DelivProRemoteStorage && typeof window.DelivProRemoteStorage.flush === 'function') {
    window.DelivProRemoteStorage.flush().catch(function () {});
  }
}

async function actualiserVerrousEditionDistance() {
  if (window.DelivProRemoteStorage && typeof window.DelivProRemoteStorage.pullLatest === 'function') {
    try {
      await window.DelivProRemoteStorage.pullLatest();
    } catch (_) {}
  }
}

// MOVED -> script-core-ui.js : getModalIdForLockType

// MOVED -> script-alertes.js : afficherAlerteVerrouModal

function surveillerConflitsEditionActifs() {
  const modals = [
    { id: 'modal-edit-salarie', type: 'salarie', entityId: editSalarieId || window._editSalarieId },
    { id: 'modal-edit-livraison', type: 'livraison', entityId: window._editLivId },
    { id: 'modal-edit-client', type: 'client', entityId: _editClientId },
    { id: 'modal-vehicule', type: 'vehicule', entityId: window._editVehId }
  ];

  modals.forEach(function(entry) {
    const modal = document.getElementById(entry.id);
    if (!modal?.classList.contains('open') || !entry.entityId) {
      afficherAlerteVerrouModal(entry.id, '');
      return;
    }
    const lockState = verifierVerrouEdition(entry.type, entry.entityId);
    if (!lockState.ok) {
      const lock = lockState.lock || {};
      const signature = `${entry.type}:${entry.entityId}:${lock.actorKey || ''}:${lock.createdAt || ''}`;
      const message = `Modification en cours par ${lock.actorLabel || 'un autre admin'}. Évite d'enregistrer cette fiche tant que le verrou n'est pas libéré.`;
      afficherAlerteVerrouModal(entry.id, message);
      if (signature !== derniereAlerteConflitEdition) {
        derniereAlerteConflitEdition = signature;
        afficherToast(`⚠️ ${lock.actorLabel || 'Un autre admin'} modifie déjà cette fiche`, 'error');
      }
      return;
    }
    afficherAlerteVerrouModal(entry.id, '');
  });
}

function prendreVerrouEdition(type, id, label) {
  if (!type || !id || sessionStorage.getItem('role') !== 'admin') return { ok: true };
  const locks = getAdminEditLocks();
  const lockKey = getAdminEditLockKey(type, id);
  const actorKey = getAdminActorKey();
  const existing = locks[lockKey];
  if (existing && existing.actorKey && existing.actorKey !== actorKey) {
    return { ok: false, lock: existing };
  }
  locks[lockKey] = {
    actorKey: actorKey,
    actorLabel: getAdminActorLabel(),
    type: type,
    id: id,
    label: label || '',
    createdAt: new Date().toISOString()
  };
  sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  adminHeldEditLocks.add(lockKey);
  synchroniserVerrousEdition();
  return { ok: true, lock: locks[lockKey] };
}

function verifierVerrouEdition(type, id) {
  if (!type || !id || sessionStorage.getItem('role') !== 'admin') return { ok: true };
  const locks = getAdminEditLocks();
  const lock = locks[getAdminEditLockKey(type, id)];
  const actorKey = getAdminActorKey();
  if (!lock || !lock.actorKey || lock.actorKey === actorKey) return { ok: true };
  return { ok: false, lock: lock };
}

function libererVerrouEdition(type, id) {
  if (!type || !id) return;
  const locks = getAdminEditLocks();
  const lockKey = getAdminEditLockKey(type, id);
  const lock = locks[lockKey];
  if (lock && lock.actorKey === getAdminActorKey()) {
    delete locks[lockKey];
    sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
    synchroniserVerrousEdition();
  }
  adminHeldEditLocks.delete(lockKey);
}

function libererTousVerrousEdition() {
  if (!adminHeldEditLocks.size) return;
  const locks = getAdminEditLocks();
  const actorKey = getAdminActorKey();
  adminHeldEditLocks.forEach(function(lockKey) {
    const lock = locks[lockKey];
    if (lock && lock.actorKey === actorKey) delete locks[lockKey];
  });
  adminHeldEditLocks.clear();
  sauvegarder(ADMIN_EDIT_LOCKS_KEY, locks);
  synchroniserVerrousEdition();
}

// MOVED -> script-core-ui.js : getEditLockContextForModal

window.addEventListener('pagehide', libererTousVerrousEdition);
window.addEventListener('beforeunload', libererTousVerrousEdition);
window.addEventListener('storage', function(event) {
  if (event.key === ADMIN_EDIT_LOCKS_KEY) {
    surveillerConflitsEditionActifs();
  }
});
window.addEventListener('delivpro:storage-sync', function(event) {
  if (event.detail?.key === ADMIN_EDIT_LOCKS_KEY) {
    surveillerConflitsEditionActifs();
  }
});
// MOVED -> script-core-auth.js : fermerMenuAdmin
// MOVED -> script-exports.js : fermerHeuresRapportsMenu
// MOVED -> script-exports.js : toggleHeuresRapportsMenu
// MOVED -> script-core-auth.js : toggleAdminMenu
// MOVED -> script-core-auth.js : setBoutonDeconnexionAdminEtat
// MOVED -> script-core-auth.js : redirigerVersLoginAdmin
// MOVED -> script-core-auth.js : purgerSessionAdminLocale
// MOVED -> script-core-auth.js : deconnexionAdmin
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

// MOVED -> script-core-storage.js : getCompanyAssetsStorageHelper

function sanitiserNomFichierLogo(value) {
  return String(value || 'logo-entreprise')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'logo-entreprise';
}

function getLogoEntreprisePath() {
  return localStorage.getItem('logo_entreprise_path') || '';
}

function compresserFichierImage(file, maxW, maxH, qualite, mimeType) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        let w = img.width;
        let h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          if (!blob) {
            reject(new Error('compression_failed'));
            return;
          }
          resolve(blob);
        }, mimeType || 'image/webp', qualite || 0.82);
      };
      img.onerror = function() { reject(new Error('image_load_failed')); };
      img.src = String(event.target?.result || '');
    };
    reader.onerror = function() { reject(new Error('file_read_failed')); };
    reader.readAsDataURL(file);
  });
}

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
/* Génère un numéro de livraison unique LIV-AAAA-XXXX */
// MOVED -> script-livraisons.js : genNumLivraison

/* Compression image base64 avant stockage */
function compresserImage(base64, callback) {
  const img = new Image();
  img.onload = () => {
    const max = 800;
    let w = img.width, h = img.height;
    if (w > max || h > max) { const r = Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r); }
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    callback(c.toDataURL('image/jpeg',0.72));
  };
  img.src = base64;
}

/* ===== HT / TVA / TTC — Calculs bidirectionnels ===== */
// MOVED -> script-core-utils.js : calculerTTCDepuisHT
// MOVED -> script-core-utils.js : calculerHTDepuisTTC

/* ===== THÈME MODE CLAIR / SOMBRE ===== */
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

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
}

/* ===== MODAL CONFIRMATION STYLÉE ===== */
let _confirmResolve = null;
// MOVED -> script-core-ui.js : confirmDialog
// MOVED -> script-core-ui.js : confirmResolve
// MOVED -> script-core-ui.js : confirmReject

// BUG-010 fix : promptDialog stylée (remplace window.prompt). DOM créé à la volée, focus trap via listeners locaux.
// MOVED -> script-core-ui.js : promptDialog
window.promptDialog = promptDialog;

/* ===== SCROLL TO TOP ===== */
function initScrollTop() {
  const main = document.getElementById('mainContent');
  const btn  = document.getElementById('btn-scroll-top');
  if (!main || !btn) return;
  main.addEventListener('scroll', () => {
    btn.classList.toggle('visible', main.scrollTop > 300);
  });
  btn.onclick = () => main.scrollTo({ top:0, behavior:'smooth' });
}

/* ===== NOM ENTREPRISE DANS TOPBAR ===== */
// MOVED -> script-core-storage.js : chargerNomEntreprise

// MOVED -> script-salaries.js : rafraichirDependancesSalaries

// MOVED -> script-vehicules.js : getVehiculeParSalId

// MOVED -> script-salaries.js : mettreAJourKmVehiculeParSalarie

// MOVED -> script-salaries.js : getSalarieNomComplet

// MOVED -> script-vehicules.js : getVehiculeKmsParLivraisons

// MOVED -> script-vehicules.js : getVehiculePlusHautKmSaisi

// MOVED -> script-vehicules.js : calculerKilometrageVehiculeActuel

// MOVED -> script-entretiens.js : getPilotageEntretienVehicule

// MOVED -> script-livraisons.js : synchroniserAffectationLivraison

// MOVED -> script-livraisons.js : peuplerSelectsLivraisonEdition

let config = chargerObj('config', { coutKmEstime: 0.20 });

/* ===== ALERTES ADMIN ===== */
// MOVED -> script-alertes.js : ajouterAlerte

// MOVED -> script-alertes.js : compterAlertesNonLues

// MOVED -> script-alertes.js : afficherBadgeAlertes

let derniereAlerteSynchroAdmin = '';
let warmupAdminPromise = null;
const FAST_BOOT_ROLE_KEY = 'delivpro_fast_boot_role';
const PAGE_SALARIE_UNIFIED = 'espace-salarie';
const TAB_AUTH_PENDING_KEY = 'delivpro_tab_auth_pending';

// MOVED -> script-core-auth.js : nettoyerSessionAppCourante

function consommerTicketAccesOnglet() {
  if (window.__delivproTabUnlocked) return true;
  let url;
  try {
    url = new URL(window.location.href);
  } catch (_) {
    return false;
  }
  const ticketUrl = url.searchParams.get('tab_auth') || '';
  const ticketAttendu = sessionStorage.getItem(TAB_AUTH_PENDING_KEY) || '';
  if (!ticketUrl || !ticketAttendu || ticketUrl !== ticketAttendu) {
    return false;
  }
  sessionStorage.removeItem(TAB_AUTH_PENDING_KEY);
  window.__delivproTabUnlocked = true;
  url.searchParams.delete('tab_auth');
  const suffixe = url.search ? url.search : '';
  window.history.replaceState({}, document.title, url.pathname + suffixe + url.hash);
  return true;
}

// MOVED -> script-core-auth.js : notifierMajAutreAdmin

// MOVED -> script-core-auth.js : lancerWarmupAdmin

// MOVED -> script-core-auth.js : getRoleSessionCourant

// MOVED -> script-core-storage.js : chargerCadreSalarieUnifie

// MOVED -> script-salaries.js : activerModeSalarieUnifie

/* ===== NAVIGATION ===== */
document.addEventListener('DOMContentLoaded', async () => {
  if (window.__delivproAdminBootstrapped) return;
  window.__delivproAdminBootstrapped = true;
  if (!consommerTicketAccesOnglet()) {
    // Tenter restauration session Supabase avant de rediriger
    // (utile pour les nouveaux appareils avec session admin valide)
    let supabaseSessionValide = false;
    if (window.DelivProAuth) {
      try {
        const restored = window.DelivProAuth.restoreLegacySessionFromSupabase
          ? await window.DelivProAuth.restoreLegacySessionFromSupabase('admin')
          : await window.DelivProAuth.ensureAdminLegacySessionFromSupabase();
        if (restored === 'admin' || restored === true) {
          supabaseSessionValide = true;
          window.__delivproTabUnlocked = true;
          sessionStorage.setItem('auth_mode', 'supabase');
        }
      } catch(_) {}
    }
    if (!supabaseSessionValide) {
      nettoyerSessionAppCourante();
      redirigerVersLoginAdmin();
      return;
    }
  }
  window.addEventListener('delivpro:remote-update', function(event) {
    notifierMajAutreAdmin(event.detail || {});
  });
  window.addEventListener('offline', function() {
    afficherToast('⚠️ Connexion perdue — les données sont sauvegardées localement et seront synchronisées dès le retour réseau.', 'error');
  });
  window.addEventListener('online', function() {
    afficherToast('✅ Connexion rétablie — synchronisation en cours…', 'success');
    if (window.DelivProRemoteStorage && window.DelivProRemoteStorage.flush) {
      window.DelivProRemoteStorage.flush().catch(function() {});
    }
  });
  // BUG-005 PWA : prompt d'installation via beforeinstallprompt
  if (!window.__delivproPwaInstallSetup) {
    window.__delivproPwaInstallSetup = true;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      window.__delivproDeferredPrompt = e;
      try {
        const btn = document.getElementById('btn-install-pwa');
        if (btn) btn.style.display = 'inline-flex';
      } catch(_) {}
    });
    window.addEventListener('appinstalled', function() {
      window.__delivproDeferredPrompt = null;
      try {
        const btn = document.getElementById('btn-install-pwa');
        if (btn) btn.style.display = 'none';
      } catch(_) {}
      if (typeof afficherToast === 'function') afficherToast('📲 MCA Logistics installé sur votre appareil', 'success');
      if (typeof ajouterEntreeAudit === 'function') ajouterEntreeAudit('PWA', 'Application installée en mode standalone');
    });
    window.declencherInstallPWA = function() {
      const prompt = window.__delivproDeferredPrompt;
      if (!prompt) {
        if (typeof afficherToast === 'function') afficherToast('Installation déjà effectuée ou non disponible sur ce navigateur.', 'info');
        return;
      }
      prompt.prompt();
      prompt.userChoice.then(function(choice) {
        window.__delivproDeferredPrompt = null;
        if (choice && choice.outcome === 'accepted' && typeof afficherToast === 'function') {
          afficherToast('📲 Installation en cours…', 'success');
        }
      });
    };
  }
  const fastBootRole = sessionStorage.getItem(FAST_BOOT_ROLE_KEY);
  if (fastBootRole === 'admin' || fastBootRole === 'salarie') {
    sessionStorage.removeItem(FAST_BOOT_ROLE_KEY);
  } else if (window.DelivProAuth) {
    await (window.DelivProAuth.restoreLegacySessionFromSupabase
      ? window.DelivProAuth.restoreLegacySessionFromSupabase()
      : window.DelivProAuth.ensureAdminLegacySessionFromSupabase());
  }
  const roleCourant = getRoleSessionCourant();
  if (roleCourant !== 'admin' && roleCourant !== 'salarie') {
    redirigerVersLoginAdmin();
    return;
  }
  if (roleCourant === 'salarie') {
    activerModeSalarieUnifie();
    return;
  }
  getAdminAccounts();
  nettoyerHistoriqueModifsLivraisons();
  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.querySelectorAll('input[type="date"]').forEach(el => { el.value = aujourdhui(); });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); naviguerVers(item.dataset.page); fermerMenuMobile(); });
    item.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); naviguerVers(item.dataset.page); fermerMenuMobile(); } });
  });
  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
  });
  document.getElementById('menuMobile')?.addEventListener('click', function() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('mobile-open');
    // Overlay pour fermer en cliquant dehors
    let overlay = document.getElementById('sidebar-mobile-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-mobile-overlay';
      overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;';
      overlay.onclick = function() {
        sidebar.classList.remove('mobile-open');
        overlay.style.display = 'none';
      };
      document.body.appendChild(overlay);
    }
    overlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#topbar-user-menu')) fermerMenuAdmin();
    if (!e.target.closest('#heures-rapports-menu')) fermerHeuresRapportsMenu();
    if (!e.target.closest('.inline-dropdown')) fermerInlineDropdowns();
  });
  afficherBadgeAlertes();
  initTheme();
  initScrollTop();
  chargerNomEntreprise();
  appliquerBranding();
  appliquerLibellesAnalyseHT();
  initSwipeSidebar();
  initPullToRefresh();
  initDensiteTableau();
  verifierNotificationsAutomatiquesMois2();
  mettreAJourBadgesNav();
  verifierTriggersPlanningAuto(); // Vérifier au démarrage
  naviguerVers('dashboard');
  majBadgeAgent();
  afficherDecisionsAgent();
  // PERF anti-FOUC : exécute S22 (hubs sidebar) et S26 (timeline dashboard)
  // synchrone avant de révéler le body, pour éviter le flash
  // "anciens onglets → nouveaux onglets" et l'apparition retardée de la timeline.
  try { if (typeof window.__s22InitSidebar === 'function') window.__s22InitSidebar(); } catch (_) {}
  try { if (typeof window.__s26InitDashboard === 'function') window.__s26InitDashboard(); } catch (_) {}
  requestAnimationFrame(() => {
    document.body.classList.remove('app-booting');
  });
  setTimeout(() => {
    lancerWarmupAdmin();
  }, 0);
});

function naviguerVers(page) {
  if (!page) return;
  window.__delivproCurrentPage = page;
  if (getRoleSessionCourant() === 'admin') {
    mettreAJourBadgesNav();
  }
  document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) { navItem.classList.add('active'); navItem.setAttribute('aria-current', 'page'); }
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active', 'route-enter');
    setTimeout(() => pageEl.classList.remove('route-enter'), 240);
  }
  const titres = {
    dashboard:'📊 Dashboard', livraisons:'📦 Livraisons', clients:'🧑‍💼 Carnet Clients', fournisseurs:'🏭 Carnet Fournisseurs',
    vehicules:'🚐 Véhicules', carburant:'⛽ Carburant',
    rentabilite:'💰 Rentabilité', statistiques:'📈 Statistiques', tva:'🧾 TVA',
    salaries:'👥 Gestion Salariés', planning:'📅 Planning hebdomadaire',
    alertes:'🔔 Alertes', inspections:'🚗 Inspections véhicules',
    messagerie:'💬 Messagerie interne', parametres:'⚙️ Paramètres',
    charges:'💸 Charges', encaissements:'💳 Encaissements & Avoirs', incidents:'🚨 Incidents / Réclamations', relances:'⏰ Relances paiement', entretiens:'🔧 Carnet d\'entretien',
    heures:'⏱️ Heures & Km',
    'espace-salarie':'Espace salarié'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titres[page] || page;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      switch (page) {
        case 'dashboard':    rafraichirDashboard(); break;
        case 'livraisons':   navLivPeriode('reset',0); afficherLivraisons(); break;
        case 'vehicules':    afficherVehicules(); break;
        case 'carburant':    navCarbMois(0); break;
        case 'rentabilite':  afficherRentabilite(); break;
        case 'statistiques': afficherStatistiques(); break;
        case 'salaries':
          afficherSalaries();
          break;
        case 'heures':       navHeuresSemaine(0); break;
        case 'planning':     afficherPlanning(); afficherPlanningSemaine(); peuplerAbsenceSal(); afficherAbsencesPeriodes(); initFormulairePlanningRapide(); break;
        case 'alertes':      verifierNotificationsAutomatiquesMois2(); verifierDocumentsSalaries(); afficherAlertes(); break;
        case 'inspections':  navInspSemaine(0); break;
        case 'clients':      afficherClientsDashboard(); break;
        case 'fournisseurs': afficherFournisseursDashboard(); break;
        case 'charges':      navChargesMois(0); break;
        case 'tva':          navTvaPeriode(0); afficherTva(); break;
        case 'incidents':    afficherIncidents(); break;
        case 'entretiens':   navEntrMois(0); break;
        case 'parametres':   chargerParametres(); break;
        case 'espace-salarie': chargerCadreSalarieUnifie(); break;
      }
    });
  });
}

/* ===== GARDE-FOU ROUTES =====
   Au boot, vérifie que toutes les sections <section class="page" id="page-X">
   du DOM ont une route connue (case dans naviguerVers + entrée valide dans
   un hub OU un nav-item sidebar). Et inversement, qu'aucune route invoquée
   ne pointe vers une section absente. Évite les "404 silencieux" comme la
   page TVA récemment retrouvée. */
(function() {
  if (typeof document === 'undefined') return;
  function audit() {
    if (document.readyState === 'loading') {
      return document.addEventListener('DOMContentLoaded', audit);
    }
    var sectionsDOM = Array.from(document.querySelectorAll('section.page[id^="page-"]'))
      .map(function(s) { return s.id.replace(/^page-/, ''); });
    var hubsDebug = window.__s22Debug;
    var hubPages = hubsDebug ? hubsDebug.ALL_SUB_PAGES.slice() : [];
    var navItems = Array.from(document.querySelectorAll('.nav-item[data-page]'))
      .map(function(a) { return a.dataset.page; });
    var routesConnues = new Set(hubPages.concat(navItems).concat([
      'dashboard', 'espace-salarie'
    ]));
    sectionsDOM.forEach(function(p) {
      if (!routesConnues.has(p)) {
        console.warn('[ROUTES] Section #page-' + p + ' existe dans le DOM mais aucune route ne mène à elle (ni hub ni nav-item)');
      }
    });
    // Expose pour debug
    window.__routesDebug = { sectionsDOM: sectionsDOM, hubPages: hubPages, navItems: navItems };
  }
  audit();
})();

function appliquerLibellesAnalyseHT() {
  const rent = {
    'rent-ca': "Chiffre d'affaires HT",
    'rent-carb': 'Dépenses carburant HT',
    'rent-entretien': 'Dépenses entretien HT',
    'rent-cout-km': 'Coût HT par kilomètre',
    'rent-profit': 'Profit net estimé HT'
  };
  Object.entries(rent).forEach(([id, label]) => {
    const card = document.getElementById(id)?.closest('.kpi-card');
    const target = card?.querySelector('.kpi-label');
    if (target) target.textContent = label;
  });
  const stats = {
    'stats-ca-periode': 'CA période HT',
    'stats-panier-moyen': 'Panier moyen HT'
  };
  Object.entries(stats).forEach(([id, label]) => {
    const card = document.getElementById(id)?.closest('.kpi-card');
    const target = card?.querySelector('.kpi-label');
    if (target) target.textContent = label;
  });
  const rentTitle = document.getElementById('chartRentabilite')?.closest('.card')?.querySelector('.card-header h2');
  if (rentTitle) rentTitle.textContent = 'Répartition des dépenses HT';
  const statsTitle = document.getElementById('chartCA')?.closest('.card')?.querySelector('.card-header h2');
  if (statsTitle) statsTitle.textContent = 'Évolution du CA HT';
  const statsDriverTitle = document.getElementById('chartCAParChauffeur')?.closest('.card')?.querySelector('.card-header h2');
  if (statsDriverTitle) statsDriverTitle.textContent = 'CA HT par chauffeur (détail)';
}

// MOVED -> script-planning.js : toggleAbsenceTypeFields

// MOVED -> script-planning.js : initFormulairePlanningRapide

function ouvrirMenuMobile()  { document.getElementById('sidebar').classList.add('mobile-open');    document.getElementById('sidebarOverlay').classList.add('active'); }
function fermerMenuMobile()  { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

/* ===== MODALS ===== */
// BUG-006 fix : a11y — role="dialog", aria-modal, focus trap, Échap pour fermer, restauration focus.
const MODAL_FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const __modalFocusStack = [];

// MOVED -> script-core-ui.js : __appliquerA11yModale

// MOVED -> script-core-ui.js : __modalTrapKeydown

// MOVED -> script-core-ui.js : openModal
// MOVED -> script-core-ui.js : closeModal
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id); });

function mettreAJourSelects() {
  const chauffeurs = charger('chauffeurs');
  const vehicules  = charger('vehicules');
  const salaries   = charger('salaries');

  // Véhicule dans charges et entretiens
  ['charge-veh','entr-veh'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const v = sel.value;
    sel.innerHTML = id==='charge-veh' ? '<option value="">— Général —</option>' : '<option value="">— Choisir —</option>';
    vehicules.forEach(vh => sel.innerHTML += `<option value="${vh.id}">${vh.immat}${vh.modele?' — '+vh.modele:''}</option>`);
    sel.value = v;
  });

  // Livraisons récentes dans incident (30 derniers jours)
  const incSel = document.getElementById('inc-livraison');
  if (incSel) {
    const v = incSel.value;
    const dateMin = new Date(Date.now()-30*24*60*60*1000).toLocalISODate();
    incSel.innerHTML = '<option value="">— Aucune livraison spécifique —</option>';
    charger('livraisons').filter(l=>l.date>=dateMin).sort((a,b)=>new Date(b.date)-new Date(a.date))
      .forEach(l => incSel.innerHTML += `<option value="${l.id}">${l.numLiv||''} — ${l.client} (${l.date})</option>`);
    incSel.value = v;
  }

  // Sélect salarié dans modal incident
  peupleIncSalarie();

  // Sélect salarié dans modal planning
  const sp = document.getElementById('plan-salarie');
  if (sp) {
    const v = sp.value;
    sp.innerHTML = '<option value="">-- Choisir un salarié --</option>';
    salaries.forEach(s => { sp.innerHTML += `<option value="${s.id}">${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    sp.value = v;
  }

  const sc = document.getElementById('liv-chauffeur');
  if (sc) {
    const v = sc.value; sc.innerHTML = '<option value="">-- Choisir un salarié / chauffeur --</option>';
    // Salariés d'abord (avec badge), puis chauffeurs non-salariés
    salaries.forEach(s => { sc.innerHTML += `<option value="${s.id}">👤 ${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    chauffeurs.filter(c => !salaries.find(s => s.id === c.id))
      .forEach(c => { sc.innerHTML += `<option value="${c.id}">${c.nom}</option>`; });
    sc.value = v;
  }

  const sec = document.getElementById('edit-liv-chauffeur');
  if (sec) {
    const v = sec.value; sec.innerHTML = '<option value="">-- Choisir un salarié / chauffeur --</option>';
    salaries.forEach(s => { sec.innerHTML += `<option value="${s.id}">👤 ${getSalarieNomComplet(s, { includeNumero: true })}</option>`; });
    chauffeurs.filter(c => !salaries.find(s => s.id === c.id))
      .forEach(c => { sec.innerHTML += `<option value="${c.id}">${c.nom}</option>`; });
    sec.value = v;
  }

  ['liv-vehicule','edit-liv-vehicule','carb-vehicule','entr-vehicule'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    const v = sel.value; sel.innerHTML = '<option value="">-- Choisir un véhicule --</option>';
    vehicules.forEach(veh => { sel.innerHTML += `<option value="${veh.id}">${veh.immat} — ${veh.modele}${veh.salNom ? ' ('+veh.salNom+')' : ''}</option>`; });
    sel.value = v;
  });

  // Sélect véhicule dans création salarié
  const sv = document.getElementById('nsal-vehicule');
  if (sv) {
    const v = sv.value; sv.innerHTML = '<option value="">-- Aucun pour l\'instant --</option>';
    vehicules.filter(veh => !veh.salId).forEach(veh => { sv.innerHTML += `<option value="${veh.id}">${veh.immat} — ${veh.modele}</option>`; });
    sv.value = v;
  }

  // Sélect véhicule dans modal edit salarié
  const sve = document.getElementById('edit-sal-vehicule');
  if (sve) {
    const v = sve.value; sve.innerHTML = '<option value="">-- Retirer l\'affectation --</option>';
    vehicules.forEach(veh => {
      const dejaPris = veh.salId && veh.salId !== (window._editSalarieId || '');
      if (!dejaPris) sve.innerHTML += `<option value="${veh.id}">${veh.immat} — ${veh.modele}</option>`;
    });
    sve.value = v;
  }
}

/* ===== LIVRAISONS ===== */
// MOVED -> script-livraisons.js : ajouterLivraison

// MOVED -> script-livraisons.js : viderFormulaireLivraison

const STORAGE_REFRESH_QUEUE = new Map();

// MOVED -> script-core-storage.js : planifierRafraichissementStorage

/* Auto-remplir le véhicule quand on choisit un salarié dans le modal livraison */
document.addEventListener('DOMContentLoaded', () => {
  const selChauf = document.getElementById('liv-chauffeur');
  if (selChauf) selChauf.addEventListener('change', () => {
    const chaufId = selChauf.value;
    const vehAff  = getVehiculeParSalId(chaufId);
    const selVeh  = document.getElementById('liv-vehicule');
    if (vehAff && selVeh && !selVeh.value) selVeh.value = vehAff.id;
  });

  if (document.getElementById('charges-mois-label')) {
    var rangeChargesInit = getChargesPeriodeRange();
    majPeriodeDisplay('charges-mois-label', 'charges-mois-dates', rangeChargesInit);
    var selectChargesInit = document.getElementById('vue-charges-select');
    if (selectChargesInit) selectChargesInit.value = _chargesPeriode.mode;
  }
});

// MOVED -> script-core-auth.js : getPageActiveAdminId

// MOVED -> script-livraisons.js : rafraichirVueLivraisonsActive

// MOVED -> script-heures.js : rafraichirVueHeuresEtKm

// MOVED -> script-planning.js : rafraichirVuePlanningAdmin

function planifierRafraichissementSiPageActive(pageId, cle, callback) {
  if (getPageActiveAdminId() !== pageId) return;
  planifierRafraichissementStorage(cle, callback);
}

// MOVED -> script-core-auth.js : gererChangementStorageAdmin

/* ===== SYNCHRO STORAGE (salarié → admin en temps réel) ===== */
window.addEventListener('storage', function(e) {
  if (e.key) STORAGE_CACHE.delete(e.key);
  else STORAGE_CACHE.clear();
  gererChangementStorageAdmin(e.key);
});

window.addEventListener('delivpro:storage-sync', function(e) {
  var key = e && e.detail ? e.detail.key : '';
  if (key) STORAGE_CACHE.delete(key);
  else STORAGE_CACHE.clear();
  gererChangementStorageAdmin(key);
});

// MOVED -> script-livraisons.js : afficherLivraisons

function changerStatutPaiement(id, statut) {
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(l => l.id === id);
  if (idx > -1) {
    livraisons[idx].statutPaiement = statut;
    sauvegarder('livraisons', livraisons);
    ajouterEntreeAudit('Paiement livraison', (livraisons[idx].numLiv || 'Livraison') + ' · statut ' + statut);
    afficherToast('💳 Paiement mis à jour');
  }
}

// MOVED -> script-livraisons.js : getLivraisonInlineSelectClass

// MOVED -> script-livraisons.js : styliserSelectLivraison

// MOVED -> script-livraisons.js : changerStatutLivraison

// MOVED -> script-livraisons.js : supprimerLivraison

function resetFiltres() {
  ['filtre-statut','filtre-paiement','filtre-date-debut','filtre-date-fin','filtre-recherche-liv','filtre-chauffeur'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  _livPeriodePersonnalisee = null;
  var range = getPeriodeRange(_livPeriodeMode, _livPeriodeOffset);
  majPeriodeDisplay('liv-periode-label', 'liv-periode-dates', range);
  afficherLivraisons();
}

// MOVED -> script-livraisons.js : appliquerFiltresDatesLivraisons

// MOVED -> script-rentabilite.js : alerteRentabilite

/* ===== CHAUFFEURS ===== */
// MOVED -> script-salaries.js : ajouterChauffeur

// MOVED -> script-salaries.js : afficherChauffeurs

// MOVED -> script-salaries.js : changerStatutChauffeur

// MOVED -> script-salaries.js : supprimerChauffeur

/* ===== VÉHICULES ===== */
// MOVED -> script-vehicules.js : lireFinanceVehiculeDepuisForm

// MOVED -> script-vehicules.js : hydraterFinanceVehiculeDansForm

// MOVED -> script-vehicules.js : reinitialiserFinanceVehiculeForm

// MOVED -> script-vehicules.js : resetModalVehiculeToCreateMode

// MOVED -> script-vehicules.js : mettreAJourFinContratVehicule

// MOVED -> script-vehicules.js : mettreAJourInfosVehiculeFinancement

// MOVED -> script-vehicules.js : mettreAJourFormulaireVehicule

// MOVED -> script-rentabilite.js : getVehiculeMensualiteRentabilite

// BUG-046 fix : TVA déductible sur carburant selon genre (CGI art. 298-4-1° et 298-4 D)
// - VP (voiture particulière) : 80 % diesel, 80 % essence depuis 2022
// - VU/CTTE/CAM/TRR (utilitaire, camionnette, camion, tracteur) : 100 % gazole/GPL/GNV, 100 % essence (depuis 2022)
// - Électrique (tout genre) : 100 % de l'électricité de recharge
// - REM/SREM (remorque, semi-remorque) : pas de carburant propre, 0 %
// MOVED -> script-carburant.js : calculerTauxTVACarburant
// MOVED -> script-carburant.js : ajusterTVACarburantSelonGenre
window.ajusterTVACarburantSelonGenre = ajusterTVACarburantSelonGenre;
window.calculerTauxTVACarburant = calculerTauxTVACarburant;

// MOVED -> script-vehicules.js : ajouterVehicule

// MOVED -> script-vehicules.js : afficherVehicules

/* Ajoute une alerte seulement si elle n'existe pas déjà (évite les doublons) */
// MOVED -> script-alertes.js : ajouterAlerteSiAbsente

let affectVehId = null;
// MOVED -> script-vehicules.js : ouvrirAffectationVehicule

// MOVED -> script-vehicules.js : confirmerAffectationVehicule

// MOVED -> script-vehicules.js : supprimerVehicule

/* ===== ENTRETIENS (dans page Véhicules — historique simplifié) ===== */
// MOVED -> script-entretiens.js : afficherEntretiensVehicules

/* ===== CARBURANT ===== */
// MOVED -> script-carburant.js : ajouterCarburant

// MOVED -> script-carburant.js : afficherCarburant

// MOVED -> script-carburant.js : resetFiltresCarburant

// MOVED -> script-carburant.js : supprimerCarburant

function toggleMenuCarbAdmin(id) {
  document.querySelectorAll('.menu-actions-dropdown').forEach(m => {
    if (m.id !== 'menu-carb-' + id) m.style.display = 'none';
  });
  const menu = document.getElementById('menu-carb-' + id);
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// MOVED -> script-carburant.js : actionCarburant

// MOVED -> script-carburant.js : voirRecuCarburant

document.addEventListener('click', function(e) {
  if (!e.target.closest('.menu-actions-wrap')) {
    document.querySelectorAll('.menu-actions-dropdown').forEach(m => m.style.display = 'none');
  }
});

/* ===== RELEVÉS KM — ADMIN ===== */
function afficherReleveKm() {
  const salaries = charger('salaries');
  const vehicules = charger('vehicules');
  const tb = document.getElementById('tb-releve-km');
  const range = getHeuresPeriodeRange();
  const tous = [];
  salaries.forEach(s => {
    charger('km_sal_'+s.id)
      .filter(e => (e.date || '') >= range.debut && (e.date || '') <= range.fin)
      .forEach(e => {
        const veh = vehicules.find(v => v.salId === s.id) || null;
        tous.push({ ...e, salNom: s.nom, salNumero: s.numero, vehId: veh?.id || '', vehNom: veh?.immat || '—' });
      });
  });
  tous.sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe));
  if (!tous.length) {
    tb.innerHTML = emptyState('🛣️','Aucun relevé km',`Aucun relevé kilométrique sur ${range.label.toLowerCase()} (${range.datesLabel}).`);
    return;
  }
  tb.innerHTML = tous.map(e => {
    const modTag = e.modifie
      ? '<span style="font-size:.72rem;background:rgba(231,76,60,.12);color:#e74c3c;padding:1px 6px;border-radius:12px;margin-left:4px">✏️ Modifié</span>'
      : '';
    const kmDepart = e.kmDepart != null ? e.kmDepart.toLocaleString('fr-FR')+' km' : '—';
    const kmArrivee = e.kmArrivee != null ? e.kmArrivee.toLocaleString('fr-FR')+' km' : '—';
    const distance = e.kmArrivee != null
      ? ((e.distance || (e.kmArrivee - e.kmDepart)) || 0).toFixed(0)+' km'
      : 'En attente';
    return `<tr>
      <td><strong>${e.salNom}</strong> <span style="color:var(--text-muted);font-size:0.8rem">${e.salNumero||''}</span></td>
      <td>${e.vehId ? `<button type="button" class="table-link-button" onclick="ouvrirFicheVehiculeDepuisTableau('${e.vehId}')" title="Ouvrir le véhicule">${e.vehNom}</button>` : e.vehNom}</td>
      <td>${e.date}</td>
      <td>${kmDepart}</td>
      <td>${kmArrivee}</td>
      <td><strong style="color:var(--accent)">${distance}</strong>${modTag}</td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditKmAdmin('${e.salId}','${e.id}')">✏️</button>
        <button class="btn-icon danger" onclick="supprimerKmAdmin('${e.salId}','${e.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

let _editKmSalId = null, _editKmId = null;
// MOVED -> script-core-auth.js : ouvrirEditKmAdmin

// MOVED -> script-core-auth.js : confirmerEditKmAdmin

// MOVED -> script-core-auth.js : supprimerKmAdmin

/* Met à jour le km de départ mémorisé pour la prochaine saisie */
/* mettreAJourKmReport supprimé — v12fix3 */


/* ===== ALERTES ADMIN ===== */
// MOVED -> script-alertes.js : afficherAlertes

// MOVED -> script-livraisons.js : ouvrirLivraisonPourPrix

// MOVED -> script-alertes.js : validerAlerte

// MOVED -> script-alertes.js : ignorerAlerte

// MOVED -> script-alertes.js : viderAlertes

/* ===== Chart.js lazy loader — charge 197KB uniquement au premier graphique ===== */
let _chartJsPromise = null;
function ensureChartJs() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (_chartJsPromise) return _chartJsPromise;
  _chartJsPromise = new Promise(function(resolve, reject) {
    const s = document.createElement('script');
    s.src = 'chart.min.js';
    s.async = false;
    s.onload = function() { resolve(); };
    s.onerror = function() { _chartJsPromise = null; reject(new Error('Chart.js load failed')); };
    document.head.appendChild(s);
  });
  return _chartJsPromise;
}

/* ===== HELPERS CHART.JS — gradient fill + animations smooth partagés ===== */
function mcaChartGradient(canvas, colorHex, opacityTop, opacityBottom) {
  if (!canvas) return colorHex;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return colorHex;
  const height = canvas.clientHeight || canvas.height || 280;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  const hexToRgb = (h) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return '245,166,35';
    const i = parseInt(m[1], 16);
    return [(i>>16)&255, (i>>8)&255, i&255].join(',');
  };
  const rgb = hexToRgb(colorHex);
  gradient.addColorStop(0, `rgba(${rgb},${opacityTop != null ? opacityTop : 0.55})`);
  gradient.addColorStop(1, `rgba(${rgb},${opacityBottom != null ? opacityBottom : 0.02})`);
  return gradient;
}
function mcaChartBaseOptions(isLight, extra) {
  const tickColor = isLight ? '#334155' : '#e2e8f0';
  const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)';
  const legendColor = isLight ? '#0f172a' : '#f8fafc';
  const tooltipBg = isLight ? 'rgba(17,24,39,0.95)' : 'rgba(10,13,20,0.95)';
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: legendColor, font: { weight: '600', size: 12 }, boxWidth: 14, padding: 14 } },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(245,166,35,0.4)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { weight: '700' },
        bodyFont: { size: 12 },
        displayColors: true,
        boxPadding: 4
      }
    },
    scales: {
      x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 } } }
    }
  }, extra || {});
}

/* ===== DASHBOARD ===== */
let chartActivite = null;
function rafraichirDashboard() {
  // PERF: lazy Chart.js — si pas encore chargé, on rappelle la fonction après chargement
  if (typeof Chart === 'undefined') { ensureChartJs().then(rafraichirDashboard).catch(() => {}); return; }
  const isLight = document.body.classList.contains('light-mode');
  const chartTickColor = isLight ? '#334155' : '#e2e8f0';
  const chartGridColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.10)';
  verifierNotificationsAutomatiquesMois2();
  verifierDocumentsSalaries();
  // Bannière CT expiré / proche (< 7 jours)
  const ctBanner = document.getElementById('dashboard-ct-banner');
  if (ctBanner) {
    const vehsCT = charger('vehicules', []);
    const maintenant = new Date(); maintenant.setHours(0,0,0,0);
    const dans7j = new Date(maintenant); dans7j.setDate(dans7j.getDate() + 7);
    const alertesCT = vehsCT.filter(v => v.dateCT).map(v => {
      const d = new Date(v.dateCT); d.setHours(0,0,0,0);
      if (d < maintenant) return { immat: v.immat, label: `CT expiré le ${formatDateExport(v.dateCT)}`, urgent: true };
      if (d <= dans7j) return { immat: v.immat, label: `CT expire le ${formatDateExport(v.dateCT)}`, urgent: false };
      return null;
    }).filter(Boolean);
    if (alertesCT.length) {
      ctBanner.innerHTML = alertesCT.map(a =>
        `<div class="info-banner" style="margin-bottom:8px;border-left-color:${a.urgent?'var(--red)':'var(--orange, #f39c12)'}">
          ⚠️ Véhicule <strong>${a.immat}</strong> — ${a.label}
        </div>`
      ).join('');
    } else {
      ctBanner.innerHTML = '';
    }
  }

  const setText = function(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    return el;
  };
  const livraisons = charger('livraisons'), chauffeurs = charger('chauffeurs');
  const vehicules  = charger('vehicules'),  pleins     = charger('carburant');
  const charges    = charger('charges');
  const salaries   = charger('salaries');
  const auj = aujourdhui(), mois = auj.slice(0,7), sem = getSemaineDebut();
  // H7 fix : budgetGetMonthlyRange/Variation supprimés avec le module Budget.
  // Remplacés par un calcul inline minimal pour les KPIs dashboard.
  const monthRange = { debut: mois + '-01', fin: mois + '-31' };
  const tvaSummary = getTVASummaryForRange(monthRange);
  const chargesMois = charger('charges').filter(c => (c.date || '').startsWith(mois));
  const carbMoisAll = (charger('carburant') || []).filter(p => (p.date || '').startsWith(mois));
  const totalMontantHT = (arr) => arr.reduce((s, it) => {
    const ht = parseFloat(it.montantHT);
    if (Number.isFinite(ht)) return s + ht;
    const ttc = parseFloat(it.montant) || 0;
    const taux = parseFloat(it.tauxTVA) || 0;
    return s + ttc / (1 + taux / 100);
  }, 0);
  const budgetData = {
    totalCarb: totalMontantHT(carbMoisAll) + totalMontantHT(chargesMois.filter(c => c.categorie === 'carburant')),
    totalEntr: totalMontantHT(chargesMois.filter(c => c.categorie === 'entretien')),
    totalSalaires: totalMontantHT(chargesMois.filter(c => c.categorie === 'salaires')),
    totalCharg: totalMontantHT(chargesMois.filter(c => c.categorie !== 'carburant' && c.categorie !== 'entretien' && c.categorie !== 'salaires')),
    totalDepHorsTVA: totalMontantHT(chargesMois) + totalMontantHT(carbMoisAll)
  };
  const livraisonsMois = livraisons.filter(l => (l.date || '').startsWith(mois));
  const livsAuj = livraisons.filter(l => l.date===auj);
  const caJour   = livsAuj.reduce((s,l)=>s+getMontantHTLivraison(l),0);
  const caSem    = livraisons.filter(l=>(l.date || '')>=sem).reduce((s,l)=>s+getMontantHTLivraison(l),0);
  const caMoisBrut   = livraisonsMois.reduce((s,l)=>s+getMontantHTLivraison(l),0);
  const caMoisTTCBrut = livraisonsMois.reduce((s,l)=>s+(parseFloat(l.prix) || 0),0);
  // CA net = CA - avoirs émis ce mois (Sprint 12)
  const avoirsMois = charger('avoirs_emis').filter(a => (a.date || '').startsWith(mois));
  const avoirsHTMois = avoirsMois.reduce((s, a) => s + (parseFloat(a.montantHT) || 0), 0);
  const avoirsTTCMois = avoirsMois.reduce((s, a) => s + (parseFloat(a.montantTTC) || 0), 0);
  const caMois   = Math.max(0, caMoisBrut - avoirsHTMois);
  const caMoisTTC = Math.max(0, caMoisTTCBrut - avoirsTTCMois);
  const carbMois = budgetData.totalCarb || 0;
  const entretienChargesMois = budgetData.totalEntr || 0;
  const chargesSalarialesMois = budgetData.totalSalaires || 0;
  const autresChargesMois = budgetData.totalCharg || 0;
  const depensesMois = budgetData.totalDepHorsTVA || 0;
  const impayesMois = livraisons
    .filter(function(l) {
      return l.statut === 'livre' && getLivraisonStatutPaiement(l) !== 'payé' && (parseFloat(l.prix) || 0) > 0;
    })
    .reduce(function(sum, l) { return sum + (parseFloat(l.prix) || 0); }, 0);
  const alertes  = compterAlertesNonLues();
  const totalTvaCollectee = tvaSummary.totalCollectee;
  const totalTvaDeductible = tvaSummary.totalDeductible;
  const soldeTva = tvaSummary.tvaReverser > 0 ? tvaSummary.tvaReverser : -tvaSummary.tvaCredit;

  setText('kpi-livraisons-jour', livsAuj.length);
  const livsM = livraisons.filter(l=>l.date.startsWith(mois));
  setText('kpi-livraisons-mois', livsM.length);
  setText('kpi-ca-jour', euros(caJour));
  setText('kpi-ca-semaine', euros(caSem));
  setText('kpi-ca-mois', euros(caMois));
  setText('kpi-ca-mois-ttc', 'TTC ' + euros(caMoisTTC));
  setText('kpi-carburant', euros(depensesMois));
  setText('kpi-benefice', euros(caMois-depensesMois));
  var impayesEl = setText('kpi-solde', euros(impayesMois));
  if (impayesEl) impayesEl.className = 'kpi-value ' + (impayesMois > 0 ? 'solde-negatif' : '');
  setText('kpi-tva-solde', soldeTva >= 0 ? euros(soldeTva) : euros(Math.abs(soldeTva)));
  const depDetailEl = document.getElementById('kpi-depenses-detail');
  if (depDetailEl) depDetailEl.innerHTML = `
    <div class="kpi-depenses-line"><span>⛽</span><span class="kpi-depenses-label">Carburant</span><strong>${euros(carbMois)}</strong></div>
    <div class="kpi-depenses-line"><span>🔧</span><span class="kpi-depenses-label">Entretien</span><strong>${euros(entretienChargesMois)}</strong></div>
    <div class="kpi-depenses-line"><span>💸</span><span class="kpi-depenses-label">Charges</span><strong>${euros(autresChargesMois)}</strong></div>
    <div class="kpi-depenses-line"><span>👥</span><span class="kpi-depenses-label">Salaires</span><strong>${euros(chargesSalarialesMois)}</strong></div>
  `;
  const tvaDetailEl = document.getElementById('kpi-tva-detail');
  if (tvaDetailEl) {
    tvaDetailEl.innerHTML = soldeTva >= 0
      ? `<div class="kpi-sub-lines">
          <div class="kpi-sub-line"><span class="kpi-sub-line-label">Collectée</span><strong>${euros(totalTvaCollectee)}</strong></div>
          <div class="kpi-sub-line"><span class="kpi-sub-line-label">Déductible</span><strong>${euros(totalTvaDeductible)}</strong></div>
          <div class="kpi-sub-line"><span class="kpi-sub-line-label">Planifiée / réglée</span><strong>${euros(tvaSummary.totalTVAPlanifiee || 0)}</strong></div>
        </div>`
      : `<div class="kpi-sub-lines">
          <div class="kpi-sub-line"><span class="kpi-sub-line-label">Crédit TVA</span><strong>${euros(Math.abs(soldeTva))}</strong></div>
        </div>`;
  }
  setText('kpi-chauffeurs', chauffeurs.filter(c=>c.statut!=='inactif').length);
  setText('kpi-vehicules', vehicules.length);
  setText('kpi-alertes', alertes);

  // Objectif CA mensuel
  const objectif = parseFloat(localStorage.getItem('objectif_ca_mensuel') || '0');
  const objEl = document.getElementById('kpi-objectif-pct');
  if (objEl && objectif > 0) {
    const pct = Math.min(Math.round(caMois / objectif * 100), 100);
    objEl.innerHTML = `<div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px">Objectif ${euros(objectif)}</div>
      <div style="background:rgba(255,255,255,.08);border-radius:20px;height:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--green)':'var(--accent)'};border-radius:20px;transition:width .4s"></div>
      </div>
      <div style="font-size:.82rem;margin-top:4px;color:${pct>=100?'var(--green)':'var(--text)'}">${pct}%</div>`;
  }

  // Qui travaille aujourd'hui
  const jourSemaine = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][new Date().getDay()];
  const plannings   = loadSafe('plannings', []);
  const travaillent = salaries.filter(s => {
    const plan = plannings.find(p => p.salId === s.id);
    const jour = plan?.semaine?.find(j => j.jour === jourSemaine);
    return jour?.travaille;
  });
  const travailleEl = document.getElementById('kpi-travaillent');
  if (travailleEl) {
    travailleEl.textContent = travaillent.length;
    const listEl = document.getElementById('liste-travaillent');
    if (listEl) listEl.innerHTML = travaillent.length
      ? travaillent.map(s => `<span style="font-size:.8rem;background:rgba(46,204,113,.1);color:var(--green);padding:3px 8px;border-radius:20px;margin:2px">${s.nom}</span>`).join('')
      : '<span style="font-size:.82rem;color:var(--text-muted)">Aucun salarié planifié aujourd\'hui</span>';
  }

  // Objectif livraisons
  const objLiv = parseInt(localStorage.getItem('objectif_livraisons_mensuel')||'0', 10);
  const objLivEl = document.getElementById('kpi-objectif-liv-pct');
  if (objLivEl && objLiv > 0) {
    const pct = Math.min(Math.round(comp.livActuel / objLiv * 100), 100);
    objLivEl.innerHTML = `<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:3px">${comp.livActuel} / ${objLiv} livraisons</div>
      <div style="background:rgba(255,255,255,.08);border-radius:20px;height:5px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--green)':'var(--blue)'};border-radius:20px;transition:width .4s"></div>
      </div>
      <div style="font-size:.78rem;margin-top:3px;color:${pct>=100?'var(--green)':'var(--text)'}">${pct}%</div>`;
  }

  // Taux ponctualité
  afficherPonctualite();

  // Incidents ouverts
  const incOpen = charger('incidents').filter(i=>i.statut==='ouvert').length;
  const incEl   = document.getElementById('kpi-incidents');
  if (incEl) incEl.textContent = incOpen;

  // Taux de ponctualité
  const ponct = calculerTauxPonctualite();
  const ponctEl = document.getElementById('kpi-ponctualite');
  if (ponctEl) {
    ponctEl.innerHTML = `<div style="font-size:1.5rem;font-weight:800;color:${ponct.taux>=90?'var(--green)':ponct.taux>=70?'var(--accent)':'var(--red)'}">${ponct.taux}%</div>
      <div class="ponctualite-bar"><div class="ponctualite-fill" style="width:${ponct.taux}%;background:${ponct.taux>=90?'var(--green)':ponct.taux>=70?'var(--accent)':'var(--red)'}"></div></div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">${ponct.livres}/${ponct.total} livrées</div>`;
  }

  // Top clients
  afficherTopClients();

  const recentes = [...livraisons].sort((a,b)=>new Date(b.creeLe)-new Date(a.creeLe)).slice(0,5);
  document.getElementById('tb-livraisons-recentes').innerHTML = recentes.length===0
    ? '<tr><td colspan="6" class="empty-row">Aucune livraison</td></tr>'
    : recentes.map(function(l) {
        var chauffeur = l.chaufNom || salaries.find(function(s) { return s.id === l.chaufId; })?.nom || '—';
        var clientLabel = String(l.client || '').trim();
        if (/^\d+$/.test(clientLabel)) clientLabel = 'Client #' + clientLabel;
        return '<tr><td><strong title="' + planningEscapeHtml(clientLabel || '—') + '">' + planningEscapeHtml(clientLabel || '—') + '</strong></td><td>' + planningEscapeHtml(chauffeur) + '</td><td>' + euros(getMontantHTLivraison(l)) + '</td><td>' + euros(parseFloat(l.prix) || 0) + '</td><td>' + badgeStatut(l.statut) + '</td><td>' + formatDateExport(l.date || '') + '</td></tr>';
      }).join('');

  const labels=[], donnees=[];
  for (let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=dateToLocalISO(d);
    labels.push(d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}));
    donnees.push(livraisons.filter(l=>l.date===ds).reduce((s,l)=>s+getMontantHTLivraison(l),0));
  }
  if (chartActivite) chartActivite.destroy();
  const _cvActivite = document.getElementById('chartActivite');
  chartActivite = new Chart(_cvActivite, {
    type:'bar', data:{ labels, datasets:[{
      label:'CA (€)', data:donnees,
      backgroundColor: mcaChartGradient(_cvActivite, '#f2a33b', 0.95, 0.30),
      hoverBackgroundColor: mcaChartGradient(_cvActivite, '#f6b456', 1, 0.45),
      borderRadius:10,
      borderSkipped:false,
      borderWidth:0,
      barPercentage:0.62,
      categoryPercentage:0.78
    }] },
    options: mcaChartBaseOptions(isLight, {
      layout: { padding: { top: 12, right: 8, bottom: 4, left: 8 } },
      animation: { duration: 800, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? 'rgba(17,24,39,0.95)' : 'rgba(13,21,36,0.95)',
          titleColor: '#ffffff', bodyColor: '#ffd49e',
          borderColor: 'rgba(242,163,59,0.5)', borderWidth: 1,
          padding: 12, cornerRadius: 10,
          displayColors: false,
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 14, weight: '700' },
          callbacks: { label: (ctx) => ' ' + euros(ctx.parsed.y || 0) }
        }
      },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { color: chartTickColor, font: { size: 11, weight: '500' } } },
        y: { beginAtZero: true, grid: { color: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: chartTickColor, font: { size: 11 }, callback: v => euros(v) } }
      }
    })
  });

  // Carte santé globale
  (function() {
    const caMoisVal = parseFloat(document.getElementById('kpi-ca-mois')?.textContent?.replace(/[^0-9,-]/g,'')?.replace(',','.')) || 0;
    const beneficeEl = document.getElementById('kpi-benefice');
    const beneficeVal = parseFloat(beneficeEl?.textContent?.replace(/[^0-9,-]/g,'')?.replace(',','.')) || 0;
    const alertesVal = parseInt(document.getElementById('kpi-alertes')?.textContent, 10) || 0;
    const impayes = parseFloat(document.getElementById('kpi-solde')?.textContent?.replace(/[^0-9,-]/g,'')?.replace(',','.')) || 0;

    const santeLabel = document.getElementById('kpi-sante-label');
    const santeDetail = document.getElementById('kpi-sante-detail');
    const seuilLabel = document.getElementById('kpi-seuil-label');
    if (!santeLabel) return;

    let etat, couleur, detail, etatClass;
    if (beneficeVal > 0 && alertesVal === 0 && impayes === 0) {
      etat = '🟢 Excellente santé'; couleur = 'rgba(39,174,96,0.35)'; etatClass = 'etat-bon';
      detail = `Marge positive · Aucune alerte · Aucun impayé`;
    } else if (beneficeVal > 0 && (alertesVal > 0 || impayes > 0)) {
      etat = '🟢 Santé correcte'; couleur = 'rgba(46,204,113,0.15)'; etatClass = 'etat-bon';
      detail = `Bénéfice positif${alertesVal > 0 ? ` · ${alertesVal} alerte(s) à traiter` : ''}${impayes > 0 ? ` · ${euros(impayes)} impayés` : ''}`;
    } else if (beneficeVal <= 0 && caMoisVal > 0) {
      etat = '🔴 Attention requise'; couleur = 'rgba(231,76,60,0.2)'; etatClass = 'etat-mauvais';
      detail = `Bénéfice négatif ce mois · Vérifiez vos charges`;
    } else {
      etat = '⚪ En attente de données'; couleur = 'rgba(255,255,255,0.05)'; etatClass = 'etat-vide';
      detail = `Saisissez vos premières livraisons pour activer l'analyse`;
    }

    santeLabel.textContent = etat;
    if (santeDetail) santeDetail.textContent = detail;
    const carteEl = document.getElementById('kpi-sante-globale');
    if (carteEl) {
      carteEl.classList.remove('etat-bon', 'etat-moyen', 'etat-mauvais', 'etat-vide');
      carteEl.classList.add(etatClass);
      carteEl.style.background = '';
    }

    const objectif = parseFloat(localStorage.getItem('objectif_ca_mensuel') || '0');
    if (seuilLabel && objectif > 0) {
      const pct = Math.round(caMoisVal / objectif * 100);
      seuilLabel.textContent = `${pct}% de l'objectif atteint`;
      seuilLabel.style.color = pct >= 100 ? '#2ecc71' : pct >= 70 ? '#f5a623' : '#e74c3c';
    } else if (seuilLabel) {
      seuilLabel.textContent = 'Objectif non défini';
      seuilLabel.style.color = '#7c8299';
    }
  })();
}
function getSemaineDebut() {
  const d=new Date(), j=d.getDay(), diff=d.getDate()-j+(j===0?-6:1);
  return new Date(new Date().setDate(diff)).toLocalISODate();
}

/* ===== RENTABILITÉ ===== */
let chartRentab = null;
var _rentMoisOffset = 0;
function getRentMoisRange() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + _rentMoisOffset);
  var debut = d.toLocalISODate();
  var finDate = new Date(d.getFullYear(), d.getMonth()+1, 0);
  var fin = finDate.toLocalISODate();
  return { debut, fin, label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}), dates: formatDateExport(debut) + ' au ' + formatDateExport(fin) };
}
function navRentMois(delta) {
  _rentMoisOffset = delta === 0 ? 0 : _rentMoisOffset + delta;
  afficherRentabilite();
}
// MOVED -> script-rentabilite.js : afficherRentabilite

/* ===== RENTABILITÉ — Export PDF ===== */
// MOVED -> script-rentabilite.js : genererRentabilitePDF

/* ===== STATISTIQUES ===== */
let chartCA=null,chartChauff=null,chartVeh=null,chartCAParChauff=null;
var _statsPeriode = buildSimplePeriodeState('mois');
// MOVED -> script-stats.js : getStatsMoisRange
// MOVED -> script-stats.js : navStatsMois
// MOVED -> script-stats.js : changerVueStats
// MOVED -> script-stats.js : navStatsPeriode
// MOVED -> script-stats.js : reinitialiserStatsPeriode
// MOVED -> script-stats.js : afficherStatistiques

/* ===== PRÉVISIONS ===== */
let chartPrev=null;
// MOVED -> script-core-utils.js : calculerPrevision

/* ===== GESTION SALARIÉS ===== */
let accessSalarieTargetId=null, editSalarieId=null;

// MOVED -> script-salaries.js : toggleFormulaireNewSalarie

function genererMotDePasseFort(prefix) {
  // Format : 1ère lettre majuscule + reste minuscule + '!' + 4 chiffres
  // → satisfait les 4 règles : majuscule, minuscule, chiffre, caractère spécial
  // Avant : 'MCA!8370' (sans minuscule) → user recevait l'erreur 'ajouter une minuscule'
  // Après : 'Mca!8370'
  const baseRaw = String(prefix || 'MCA').replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'MCA';
  const base = baseRaw.charAt(0).toUpperCase() + baseRaw.slice(1).toLowerCase();
  const suffixe = String(Math.floor(1000 + Math.random() * 9000));
  return base + '!' + suffixe;
}

function evaluerQualiteMotDePasse(value) {
  const evaluation = evaluerQualiteMotDePasseFort(value);
  return {
    texte: evaluation.message,
    couleur: evaluation.color
  };
}

// MOVED -> script-salaries.js : mettreAJourQualiteMdpSalarie

// MOVED -> script-salaries.js : genererMotDePasseSalarie

// MOVED -> script-salaries.js : getStatutAccesSalarieLocal

// MOVED -> script-salaries.js : genererEmailTechniqueSalarie

// MOVED -> script-clients.js : getSupabaseClientSafe

// MOVED -> script-salaries.js : construirePayloadSupabaseSalarie

// MOVED -> script-salaries.js : synchroniserSalarieVersSupabase

// MOVED -> script-salaries.js : supprimerSalarieDansSupabase

// MOVED -> script-salaries.js : hydraterSalarieLocalDepuisSupabase

// MOVED -> script-salaries.js : notifierSynchroSalarie

// MOVED -> script-salaries.js : provisionnerAccesSalarie

// Upload documents salarié (permis / cni / iban / vitale / medecine).
// En mode création : stockage en window.__salDocsTemp[type]
// En mode édition : sauvegarde directe sur le salarié via window._editSalarieId
window.__salDocsTemp = {};
// Upload doc salarie : pousse vers Supabase Storage (bucket salaries-docs).
// Le storage_path est stocke dans salarie.docs[type] au lieu du base64.
// Multi-device natif : ce qu'un admin upload, l'autre admin le voit instantanement.
// MOVED -> script-salaries.js : uploaderDocSalarie

// Visualise un document salarié (PDF embed ou image).
// Pour Storage : download blob + objectURL (plus fiable que signed URL embed).
// MOVED -> script-salaries.js : visualiserDocSalarie

// MOVED -> script-salaries.js : creerSalarie

// MOVED -> script-salaries.js : afficherSalaries

// MOVED -> script-salaries.js : ouvrirEditSalarie

// MOVED -> script-salaries.js : confirmerEditSalarie

// MOVED -> script-salaries.js : ouvrirGestionAccesSalarie

// MOVED -> script-core-auth.js : confirmerResetMdp

// MOVED -> script-salaries.js : toggleActifSalarie

// MOVED -> script-salaries.js : supprimerSalarie

/* ===== UTILITAIRES AFFICHAGE ===== */
function badgeStatut(s) {
  return {
    'en-attente': '<span class="badge badge-attente">⏳ En attente</span>',
    'en-cours':   '<span class="badge badge-cours">🚐 En cours</span>',
    'livre':      '<span class="badge badge-livre">✅ Livré</span>'
  }[s] || s;
}
// MOVED -> script-salaries.js : badgeChauffeur
function togglePanneauAgent() {
  const panneau = document.getElementById('panneau-agent');
  const overlay = document.getElementById('panneau-agent-overlay');
  if (!panneau) return;
  const isOpen = panneau.style.right === '0px';
  panneau.style.right = isOpen ? '-420px' : '0px';
  overlay.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const decisions = loadSafe('agent_decisions', []);
    decisions.forEach(d => d.lu = true);
    localStorage.setItem('agent_decisions', JSON.stringify(decisions));
    majBadgeAgent();
  }
}

function majBadgeAgent() {
  const decisions = loadSafe('agent_decisions', []);
  const nonLues = decisions.filter(d => !d.lu).length;
  const badge = document.getElementById('ai-decisions-badge');
  if (!badge) return;
  badge.textContent = nonLues;
  badge.style.display = nonLues > 0 ? 'inline-block' : 'none';
}

function ajouterDecisionAgent(decision) {
  const decisions = loadSafe('agent_decisions', []);
  decisions.unshift({ ...decision, id: genId(), creeLe: new Date().toISOString(), lu: false });
  localStorage.setItem('agent_decisions', JSON.stringify(decisions));
  majBadgeAgent();
  afficherDecisionsAgent();
}

function afficherDecisionsAgent() {
  const decisions = loadSafe('agent_decisions', []);
  const container = document.getElementById('agent-decisions-list');
  if (!container) return;
  if (!decisions.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#7c8299"><div style="font-size:2rem;margin-bottom:12px">✅</div><div style="font-size:.88rem">Aucune décision en attente</div></div>';
    return;
  }
  const couleurs = { haute: 'rgba(231,76,60,0.4)', opportunite: 'rgba(46,204,113,0.4)', info: 'rgba(52,152,219,0.3)' };
  container.innerHTML = decisions.map(d => `
    <div style="background:rgba(255,255,255,0.04);border:1px solid ${couleurs[d.priorite] || '#2a2d3d'};border-radius:12px;padding:16px;margin-bottom:12px;${!d.lu ? 'border-left:3px solid #f5a623' : ''}">
      <div style="font-size:.82rem;font-weight:700;margin-bottom:6px;color:#e8eaf0">${d.titre}</div>
      <div style="font-size:.78rem;color:#7c8299;margin-bottom:12px;line-height:1.5">${d.description}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(d.actions || []).map(a => `<button onclick="executerActionAgent('${d.id}','${a.id}')" style="background:${a.style === 'primary' ? '#f5a623' : 'rgba(255,255,255,0.08)'};color:${a.style === 'primary' ? '#000' : '#e8eaf0'};border:1px solid ${a.style === 'primary' ? '#f5a623' : '#2a2d3d'};border-radius:8px;padding:6px 12px;font-size:.78rem;font-weight:600;cursor:pointer">${a.label}</button>`).join('')}
      </div>
      <div style="font-size:.7rem;color:#7c8299;margin-top:10px">${new Date(d.creeLe).toLocaleString('fr-FR')}</div>
    </div>
  `).join('');
}

function executerActionAgent(decisionId, actionId) {
  const decisions = loadSafe('agent_decisions', []);
  const idx = decisions.findIndex(d => d.id === decisionId);
  if (idx === -1) return;
  decisions[idx].lu = true;
  decisions[idx].actionPrise = actionId;
  decisions[idx].actionLe = new Date().toISOString();
  localStorage.setItem('agent_decisions', JSON.stringify(decisions));
  afficherDecisionsAgent();
  majBadgeAgent();
  afficherToast('✅ Action enregistrée');
}

const __toastRecents = new Map();
function afficherToast(message, type='success') {
  const t=document.getElementById('toast');
  if (!t) return;
  // Dédup : même message émis dans les 2s = ignoré (anti-spam)
  const now = Date.now();
  const cle = type + '|' + message;
  const dernier = __toastRecents.get(cle);
  if (dernier && (now - dernier) < 2000) return;
  __toastRecents.set(cle, now);
  if (__toastRecents.size > 40) {
    for (const [k, v] of __toastRecents) {
      if (now - v > 10000) __toastRecents.delete(k);
    }
  }
  // BUG-006 a11y : erreurs en assertive pour lecture immédiate par screen reader
  t.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.textContent=message; t.className='toast show'+(type==='error'?' error':'');
  setTimeout(()=>{t.className='toast';},3000);
}

/* ===== INSPECTIONS ===== */
const INSPECTION_STORAGE_RETENTION_DAYS = 60;
const INSPECTION_STORAGE_CLEANUP_KEY = 'delivpro_inspection_storage_cleanup_at';

// MOVED -> script-inspections.js : getInspectionStorageAdminHelper

// MOVED -> script-inspections.js : getInspectionPhotoList

// MOVED -> script-inspections.js : getInspectionPhotoThumb

// MOVED -> script-inspections.js : getInspectionPhotoFull

// MOVED -> script-inspections.js : isInspectionPhotoBase64

// MOVED -> script-inspections.js : getInspectionRemotePhotoPaths

// MOVED -> script-inspections.js : supprimerPhotosInspectionDepuisStorage

// MOVED -> script-inspections.js : getInspectionReferenceDate

// MOVED -> script-inspections.js : nettoyerPhotosInspectionsAnciennes

// MOVED -> script-inspections.js : afficherInspections

// MOVED -> script-inspections.js : ouvrirModalInspectionAdmin

// MOVED -> script-inspections.js : ajouterInspectionAdmin

let _adminPhotos = [];

// MOVED -> script-salaries.js : filtrerInspParSalarieInput
// MOVED -> script-inspections.js : supprimerInspectionAdmin

/* ===== ÉDITION LIVRAISON ADMIN ===== */
let _editLivId = null;
// MOVED -> script-livraisons.js : confirmerEditLivraison

/* ===== ÉDITION CARBURANT ADMIN ===== */
let _editCarbId = null;
// MOVED -> script-carburant.js : ouvrirEditCarburantAdmin

// MOVED -> script-carburant.js : confirmerEditCarburantAdmin

// MOVED -> script-core-auth.js : voirPhotoAdmin
// MOVED -> script-core-auth.js : changerPhotoAdmin

/* ===== MESSAGERIE ADMIN ===== */
let _msgSalarieActif = null;

// MOVED -> script-messages.js : afficherMessagerie

// MOVED -> script-messages.js : supprimerConversation

/* Broadcast — gestion cible par poste / sélection */
// MOVED -> script-messages.js : majBroadcastSelection

// MOVED -> script-messages.js : filtrerBroadcastSalaries

// MOVED -> script-messages.js : majBroadcastCount

// MOVED -> script-messages.js : getBroadcastDestinataires

// MOVED -> script-messages.js : ouvrirConversation

// Ouvre une photo message en grand (signed URL fraiche, 10 min)
// MOVED -> script-messages.js : ouvrirPhotoMessageAdmin

// MOVED -> script-messages.js : envoyerMessageAdmin

// MOVED -> script-messages.js : mettreAJourBadgeMsgAdmin

/* ===== PLANNING HEBDOMADAIRE ===== */
const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_COURTS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

// MOVED -> script-planning.js : afficherPlanning

function genererGrilleJours() {
  const salId = document.getElementById('plan-salarie').value;
  const grid  = document.getElementById('plan-jours-grid');
  if (!grid) return;

  const plannings = loadSafe('plannings', []);
  const plan = plannings.find(p => p.salId === salId);

  grid.innerHTML = JOURS.map((jour, i) => {
    const existing = plan?.semaine?.find(j => j.jour === jour) || {};
    const typeJour = existing.typeJour || (existing.travaille ? 'travail' : 'repos');
    const classeRow = typeJour==='conge'?'jour-conge':typeJour==='absence'?'jour-absence':typeJour==='maladie'?'jour-maladie':'';
    return `
      <div id="plan-row-${jour}" style="background:var(--bg-dark,#0f1117);border:1px solid var(--border);border-radius:8px;padding:10px 12px" class="${classeRow}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
            <input type="checkbox" id="plan-travaille-${jour}" ${existing.travaille ? 'checked' : ''}
              onchange="toggleJourPlanning('${jour}')"
              style="width:16px;height:16px;accent-color:var(--accent)" />
            <strong style="font-size:.9rem">${JOURS_COURTS[i]} — ${jour.charAt(0).toUpperCase()+jour.slice(1)}</strong>
          </label>
          <select class="planning-type-select" id="plan-type-${jour}" onchange="toggleTypeJour('${jour}')" style="width:110px">
            <option value="travail" ${typeJour==='travail'?'selected':''}>🟢 Travail</option>
            <option value="repos"   ${typeJour==='repos'  ?'selected':''}>⚪ Repos</option>
            <option value="conge"   ${typeJour==='conge'  ?'selected':''}>🔵 Congé</option>
            <option value="absence" ${typeJour==='absence'?'selected':''}>🔴 Absence</option>
            <option value="maladie" ${typeJour==='maladie'?'selected':''}>🟣 Maladie</option>
          </select>
        </div>
        <div id="plan-horaires-${jour}" style="display:${existing.travaille&&typeJour==='travail' ? 'grid' : 'none'};grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Début</label>
            <input type="time" id="plan-debut-${jour}" value="${existing.heureDebut||''}"
              onchange="mettreAJourTotalHeuresPlanning()"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Fin</label>
            <input type="time" id="plan-fin-${jour}" value="${existing.heureFin||''}"
              onchange="mettreAJourTotalHeuresPlanning()"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Zone</label>
            <input type="text" id="plan-zone-${jour}" value="${existing.zone||''}" placeholder="Ex: Nord"
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
          <div style="grid-column:1/-1"><label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:3px">Note</label>
            <input type="text" id="plan-note-${jour}" value="${existing.note||''}" placeholder="Informations..."
              style="width:100%;background:var(--bg-card,#13161f);border:1px solid var(--border);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.85rem;font-family:inherit" /></div>
        </div>
      </div>`;
  }).join('');
  mettreAJourTotalHeuresPlanning();
}

// MOVED -> script-planning.js : toggleJourPlanning

// MOVED -> script-planning.js : ouvrirModalPlanning

// MOVED -> script-planning.js : ouvrirEditPlanning

// BUG-008 fix : contrôles Règlement CE 561/2006 (temps de conduite).
// Alertes non bloquantes affichées après sauvegarde planning + audit.
function verifierConformiteConduiteCE561(semaine) {
  const warnings = [];
  if (!Array.isArray(semaine)) return { ok: true, warnings: warnings, totalHebdoMin: 0 };
  let totalHebdoMin = 0;
  let nbJoursSupA9h = 0;
  (semaine || []).forEach(function(j) {
    if (!j || !j.travaille || j.typeJour && j.typeJour !== 'travail') return;
    const hd = String(j.heureDebut || '').trim();
    const hf = String(j.heureFin || '').trim();
    if (!hd || !hf) return;
    const [h1, m1] = hd.split(':').map(function(x){ return parseInt(x, 10) || 0; });
    const [h2, m2] = hf.split(':').map(function(x){ return parseInt(x, 10) || 0; });
    let minJour = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (minJour < 0) minJour += 24 * 60;
    if (minJour > 9 * 60) {
      nbJoursSupA9h++;
      warnings.push('⚠️ ' + j.jour + ' : ' + (minJour / 60).toFixed(1) + 'h — dépasse le max journalier de 9h (CE 561/2006 art. 6.1)');
    }
    if (minJour > 10 * 60) {
      warnings.push('🛑 ' + j.jour + ' : ' + (minJour / 60).toFixed(1) + 'h — dépasse le plafond absolu 10h (même avec dérogation 2×/sem)');
    }
    totalHebdoMin += minJour;
  });
  if (nbJoursSupA9h > 2) {
    warnings.push('🛑 ' + nbJoursSupA9h + ' jours > 9h cette semaine — max 2 dérogations autorisées (CE 561/2006 art. 6.1)');
  }
  if (totalHebdoMin > 56 * 60) {
    warnings.push('🛑 Semaine : ' + (totalHebdoMin / 60).toFixed(1) + 'h — dépasse la limite 56h/sem (CE 561/2006 art. 6.2)');
  } else if (totalHebdoMin > 48 * 60) {
    warnings.push('⚠️ Semaine : ' + (totalHebdoMin / 60).toFixed(1) + 'h — au-delà de la moyenne 48h/sem recommandée (directive 2002/15/CE)');
  }
  return { ok: warnings.length === 0, warnings: warnings, totalHebdoMin: totalHebdoMin };
}

// MOVED -> script-planning.js : sauvegarderPlanning

// MOVED -> script-planning.js : supprimerPlanning

/* ===== VUE KANBAN LIVRAISONS ===== */
let _vueLivraisons = 'tableau'; // 'tableau' | 'kanban' | 'calendrier'

// MOVED -> script-livraisons.js : changerVueLivraisons

function afficherKanban() {
  let livraisons = charger('livraisons');
  const filtreDeb = document.getElementById('filtre-date-debut')?.value;
  const filtreFin = document.getElementById('filtre-date-fin')?.value;
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';
  if (filtreDeb) livraisons = livraisons.filter(l => l.date >= filtreDeb);
  if (filtreFin) livraisons = livraisons.filter(l => l.date <= filtreFin);
  if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) {
    livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee, l.vehNom].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
  }
  livraisons.sort((a,b) => new Date(b.creeLe) - new Date(a.creeLe));

  const cols = { 'en-attente': [], 'en-cours': [], 'livre': [] };
  livraisons.forEach(l => {
    if (cols[l.statut]) cols[l.statut].push(l);
    else cols['en-attente'].push(l);
  });

  const labels = { 'en-attente': '⏳ En attente', 'en-cours': '🚐 En cours', 'livre': '✅ Livré' };
  const classes= { 'en-attente': 'attente', 'en-cours': 'cours', 'livre': 'livre' };

  const board = document.getElementById('kanban-board');
  if (!board) return;
  board.innerHTML = Object.entries(cols).map(([statut, items]) => `
    <div class="kanban-col">
      <div class="kanban-col-header ${classes[statut]}">
        <span>${labels[statut]}</span>
        <span class="kanban-count">${items.length}</span>
      </div>
      <div class="kanban-col-body" id="kanban-col-${statut}"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="dropKanban(event,'${statut}')">
        ${items.length === 0
          ? `<div style="text-align:center;padding:24px 8px;color:var(--text-muted);font-size:.8rem;opacity:.5">Aucune livraison</div>`
          : items.map(l => `
            <div class="kanban-card" draggable="true"
              ondragstart="dragKanban(event,'${l.id}')"
              ondragend="document.querySelectorAll('.kanban-col-body').forEach(c=>c.classList.remove('drag-over'))"
              onclick="ouvrirEditLivraison('${l.id}')">
              <div class="kanban-card-client">📦 ${l.client}</div>
              <div class="kanban-card-sub">${l.numLiv||'—'} · ${l.date}</div>
              ${l.chaufNom ? `<div class="kanban-card-sub">👤 ${l.chaufNom}</div>` : ''}
              ${l.arrivee  ? `<div class="kanban-card-sub">📍 ${l.arrivee}</div>` : ''}
              <div class="kanban-card-prix">${l.prix ? euros(l.prix) : 'Prix manquant'}</div>
            </div>`).join('')}
      </div>
    </div>`).join('');
}

let _dragLivId = null;
function dragKanban(event, livId) {
  _dragLivId = livId;
  event.dataTransfer.effectAllowed = 'move';
}
function dropKanban(event, nouveauStatut) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if (!_dragLivId) return;
  const livraisons = charger('livraisons');
  const idx = livraisons.findIndex(l => l.id === _dragLivId);
  if (idx > -1) {
    livraisons[idx].statut = nouveauStatut;
    sauvegarder('livraisons', livraisons);
    afficherKanban();
    afficherToast(`✅ Livraison déplacée → ${nouveauStatut === 'livre' ? 'Livré' : nouveauStatut === 'en-cours' ? 'En cours' : 'En attente'}`);
  }
  _dragLivId = null;
}

/* ===== VUE CALENDRIER LIVRAISONS ===== */
let _calMois = new Date();

function afficherCalendrier() {
  const livraisons = charger('livraisons');
  const annee = _calMois.getFullYear();
  const mois  = _calMois.getMonth();
  const label = _calMois.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  const el = document.getElementById('cal-mois-label');
  if (el) el.textContent = label;

  const cal = document.getElementById('calendrier-grid');
  if (!cal) return;

  // Premier jour du mois et nombre de jours
  const premier = new Date(annee, mois, 1).getDay(); // 0=dim
  const offset  = (premier + 6) % 7; // lundi=0
  const nbJours = new Date(annee, mois+1, 0).getDate();
  const auj     = aujourdhui();

  // Grouper livraisons par date
  const parDate = {};
  livraisons.forEach(l => {
    if (!parDate[l.date]) parDate[l.date] = [];
    parDate[l.date].push(l);
  });

  const joursEnTete = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let html = joursEnTete.map(j => `<div class="cal-header-day">${j}</div>`).join('');

  // Cases vides avant le 1er
  for (let i = 0; i < offset; i++) {
    const d = new Date(annee, mois, -offset+i+1);
    const ds = d.toLocalISODate();
    const livs = parDate[ds]||[];
    html += `<div class="cal-day autre-mois" onclick="filtrerCalJour('${ds}')">
      <div class="cal-day-num">${d.getDate()}</div>
      <div class="cal-liv-dot">${livs.slice(0,2).map(l=>`<div class="cal-liv-item ${l.statut}">${l.client.substring(0,10)}</div>`).join('')}</div>
    </div>`;
  }

  // Jours du mois
  for (let d = 1; d <= nbJours; d++) {
    const ds   = `${annee}-${String(mois+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const livs = parDate[ds] || [];
    const isAuj = ds === auj;
    html += `<div class="cal-day${isAuj?' today':''}${livs.length?' has-livraisons':''}" onclick="filtrerCalJour('${ds}')">
      <div class="cal-day-num">${d}</div>
      <div class="cal-liv-dot">
        ${livs.slice(0,3).map(l=>`<div class="cal-liv-item ${l.statut==='livre'?'livre':l.statut==='en-cours'?'cours':''}">${l.client.substring(0,10)}</div>`).join('')}
        ${livs.length>3?`<div class="cal-liv-item">+${livs.length-3}</div>`:''}
      </div>
    </div>`;
  }

  // Cases vides après le dernier
  const total = offset + nbJours;
  const reste = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= reste; i++) {
    const d = new Date(annee, mois+1, i);
    html += `<div class="cal-day autre-mois" onclick="filtrerCalJour('${d.toLocalISODate()}')">
      <div class="cal-day-num">${i}</div>
    </div>`;
  }

  cal.innerHTML = html;
}

function calNaviguer(delta) {
  _calMois = new Date(_calMois.getFullYear(), _calMois.getMonth() + delta, 1);
  afficherCalendrier();
}

function filtrerCalJour(date) {
  changerVueLivraisons('tableau');
  const deb = document.getElementById('filtre-date-debut');
  const fin = document.getElementById('filtre-date-fin');
  if (deb) deb.value = date;
  if (fin) fin.value = date;
  afficherLivraisons();
  document.getElementById('barre-recherche-univ')?.blur();
  afficherToast(`📅 Livraisons du ${new Date(date).toLocaleDateString('fr-FR', {day:'numeric',month:'long'})}`);
}

/* ===== DUPLICATION LIVRAISON ===== */
// MOVED -> script-livraisons.js : dupliquerLivraison

/* ===== RÉCURRENCE LIVRAISON ===== */
// MOVED -> script-carburant.js : ouvrirRecurrence

// MOVED -> script-carburant.js : confirmerRecurrence

/* ===== PAGINATION GÉNÉRIQUE ===== */
const _pageState = {};
function nettoyerPagination(containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  const wrap = cont.closest('.card') || cont.parentElement;
  const pag = wrap?.querySelector('.pagination');
  if (pag) pag.remove();
  if (_pageState[containerId]) _pageState[containerId].page = 1;
}
function paginer(items, containerId, renderFn, pageSize=20) {
  const state = _pageState[containerId] || { page: 1 };
  _pageState[containerId] = state;
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  state.page = Math.min(state.page, pages);
  const slice = items.slice((state.page-1)*pageSize, state.page*pageSize);

  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = renderFn(slice);

  // Pagination bar
  const wrap = cont.closest('.card') || cont.parentElement;
  let pag = wrap.querySelector('.pagination');
  if (total <= pageSize) { if (pag) pag.remove(); return; }
  if (!pag) { pag = document.createElement('div'); pag.className='pagination'; wrap.appendChild(pag); }

  const btns = [];
  for (let p=1; p<=pages; p++) {
    if (p===1||p===pages||Math.abs(p-state.page)<=1) {
      btns.push(`<button class="btn-page${p===state.page?' active':''}" onclick="_pageState['${containerId}'].page=${p};paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">${p}</button>`);
    } else if (Math.abs(p-state.page)===2) {
      btns.push(`<span style="padding:0 4px;color:var(--text-muted)">…</span>`);
    }
  }
  pag.innerHTML = `
    <span>${(state.page-1)*pageSize+1}–${Math.min(state.page*pageSize,total)} sur ${total}</span>
    <div class="pagination-btns">
      <button class="btn-page" ${state.page<=1?'disabled':''} onclick="_pageState['${containerId}'].page--;paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">‹</button>
      ${btns.join('')}
      <button class="btn-page" ${state.page>=pages?'disabled':''} onclick="_pageState['${containerId}'].page++;paginer.__reload_${containerId}&&paginer.__reload_${containerId}()">›</button>
    </div>`;
}

/* ===== ÉTATS VIDES ILLUSTRÉS ===== */
function emptyState(icon, title, sub, btnLabel='', btnAction='') {
  return `<tr><td colspan="99">
    <div class="empty-illustrated">
      <div class="ei-icon">${icon}</div>
      <div class="ei-title">${title}</div>
      <div class="ei-sub">${sub}</div>
      ${btnLabel ? `<button class="ei-btn" onclick="${btnAction}">${btnLabel}</button>` : ''}
    </div>
  </td></tr>`;
}

/* ===== BADGE FAVICON ===== */
let _faviconCanvas = null;
function majBadgeFavicon(count) {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.rel = 'icon';
  const logo = getLogoEntreprise();
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const dessinerBadge = function() {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(25, 7, 8, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(count > 9 ? '9+' : String(count), 25, 11);
    link.href = canvas.toDataURL();
    document.head.appendChild(link);
  };
  if (count <= 0) {
    link.href = logo || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚐</text></svg>";
    document.head.appendChild(link);
    return;
  }
  if (logo) {
    const img = new Image();
    img.onload = function() {
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      dessinerBadge();
    };
    img.onerror = function() {
      ctx.font = '24px serif';
      ctx.fillText('🚐', 0, 24);
      dessinerBadge();
    };
    img.src = logo;
    return;
  }
  ctx.font = '24px serif';
  ctx.fillText('🚐', 0, 24);
  dessinerBadge();
}

/* ===== EXPORT CSV ===== */
// csvCelluleSecurisee — neutralise l'injection de formules Excel/LibreOffice (OWASP CSV Injection).
// Préfixe une apostrophe devant =, +, -, @, tab, CR : Excel n'exécute plus la formule, affiche le texte littéral.
// Puis échappe les guillemets et encadre si la cellule contient séparateur, guillemet ou saut de ligne.
function csvCelluleSecurisee(value, separator) {
  const sep = separator || ';';
  const raw = value == null ? '' : String(value);
  const neutralise = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  const needsQuote = neutralise.includes(sep) || neutralise.includes('"') || neutralise.includes('\n') || neutralise.includes('\r');
  const echappe = neutralise.replace(/"/g, '""');
  return needsQuote ? '"' + echappe + '"' : echappe;
}
window.csvCelluleSecurisee = csvCelluleSecurisee;

// MOVED -> script-exports.js : exporterCSV


// MOVED -> script-livraisons.js : getLivraisonsFiltresActifs

// MOVED -> script-livraisons.js : getLivraisonsPeriodeActiveLabel

// MOVED -> script-exports.js : exporterLivraisons

// MOVED -> script-exports.js : exporterCharges

// MOVED -> script-entretiens.js : exporterEntretiens

/* ===== RAPPORT MENSUEL PDF ===== */
// MOVED -> script-exports.js : genererRapportMensuel

/* ===== ACCUSÉ DE LECTURE MESSAGERIE ===== */
/* ===== GOOGLE MAPS — CALCUL DISTANCE AUTO ===== */
// MOVED -> script-core-utils.js : calculerDistanceMaps

/* ===== HT/TVA DANS LE TABLEAU LIVRAISONS ===== */
// MOVED -> script-core-utils.js : formatPrixAvecHT

/* ===== BADGES NAV — INCIDENTS + RELANCES ===== */
function mettreAJourBadgesNav() {
  // Badge incidents ouverts
  const incOpen = charger('incidents').filter(i=>i.statut==='ouvert').length;
  const badgeInc = document.getElementById('badge-incidents-nav');
  if (badgeInc) { badgeInc.textContent=incOpen; badgeInc.style.display=incOpen>0?'inline-flex':'none'; }

  // Badge relances
  const delai   = parseInt(localStorage.getItem('relance_delai')||'7', 10);
  const limite  = new Date(); limite.setDate(limite.getDate()-delai);
  const limStr  = limite.toLocalISODate();
  const relOpen = charger('livraisons').filter(l=>
    l.statut==='livre' && (l.statutPaiement==='en-attente'||!l.statutPaiement) && l.prix>0 && l.date<=limStr
  ).length;
  const badgeRel = document.getElementById('badge-relances');
  if (badgeRel) { badgeRel.textContent=relOpen; badgeRel.style.display=relOpen>0?'inline-flex':'none'; }
}

/* ===== TAUX DE PONCTUALITÉ ===== */
// MOVED -> script-core-utils.js : calculerPonctualite

function afficherPonctualite() {
  const cont = document.getElementById('ponctualite-container');
  if (!cont) return;
  const { taux, livrees, total } = calculerPonctualite();
  const color = taux>=90?'var(--green)':taux>=70?'var(--accent)':'var(--red)';
  cont.innerHTML = `
    <div class="card mt-20">
      <div class="card-header"><h2>🎯 Taux de ponctualité</h2><span style="font-size:1.3rem;font-weight:800;color:${color}">${taux}%</span></div>
      <div style="padding:16px">
        <div class="ponctualite-bar"><div class="ponctualite-fill" style="width:${taux}%;background:${color}"></div></div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:6px">${livrees} livrées sur ${total} assignées</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px">
          ${[
            ['✅ Livrées', livrees, 'var(--green)'],
            ['⏳ En attente', total-livrees, 'var(--accent)'],
            ['📊 Taux', taux+'%', color]
          ].map(([l,v,c])=>`<div style="background:rgba(255,255,255,.03);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:${c}">${v}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${l}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ===== TABLEAU DE BORD CLIENT ENRICHI ===== */
// MOVED -> script-clients.js : afficherClientsDashboard

/* ===== TABLEAU DE BORD FOURNISSEUR (miroir Clients) ===== */
// MOVED -> script-fournisseurs.js : afficherFournisseursDashboard

// Bascule l'affichage des champs Pro pour la modal Fournisseur (miroir
// du toggleChampsClientPro). Un fournisseur peut être Particulier (artisan,
// auto-entrepreneur sans SIREN, etc.) — auquel cas on masque les champs Pro.
window.toggleChampsFournisseurPro = function(isEdit) {
  var prefix = isEdit ? 'edit-frn' : 'frn';
  var radios = document.getElementsByName(isEdit ? 'edit-frn-type' : 'frn-type');
  var type = 'pro';
  for (var i = 0; i < radios.length; i++) if (radios[i].checked) { type = radios[i].value; break; }
  var bloc = document.getElementById(prefix + '-champs-pro');
  if (bloc) bloc.classList.toggle('is-hidden', type !== 'pro');
};

// Reset complet du formulaire 'Nouveau Fournisseur' avant ouverture.
// Garantit un état initial propre (Pro coché, bloc Pro visible, champs vides).
// MOVED -> script-fournisseurs.js : resetFormulaireFournisseur

// MOVED -> script-fournisseurs.js : ajouterFournisseur

let _editFournisseurId = null;
// MOVED -> script-fournisseurs.js : ouvrirEditFournisseur

// MOVED -> script-fournisseurs.js : confirmerEditFournisseur

// MOVED -> script-fournisseurs.js : supprimerFournisseur

// MOVED -> script-exports.js : exporterHistoriqueFournisseursCSV

// MOVED -> script-exports.js : genererRapportFournisseurs

/* ===== CONGÉS / ABSENCES DANS LE PLANNING ===== */
function toggleTypeJour(jour) {
  const sel = document.getElementById('plan-type-'+jour);
  const row = document.getElementById('plan-row-'+jour);
  if (!sel || !row) return;
  const type = sel.value;
  row.className = type === 'travail' ? '' : type === 'conge' ? 'jour-conge' : type === 'absence' ? 'jour-absence' : 'jour-maladie';
  // Afficher/masquer les champs horaires selon le type
  const horaires = document.getElementById('plan-horaires-'+jour);
  if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
  const cb = document.getElementById('plan-travaille-'+jour);
  if (cb) cb.checked = type === 'travail';
  mettreAJourTotalHeuresPlanning();
}

/* ===== CONNEXION TCO DANS LA PAGE VÉHICULES ===== */
function ouvrirTCO(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId);
  if (!veh) return;
  document.getElementById('tco-veh-nom').textContent = `${veh.immat} — ${veh.modele||''}`;
  afficherTCO(vehId);
  openModal('modal-tco');
}

/* ===== CONNEXION HISTOR. MODIFS DANS MODAL EDIT LIVRAISON ===== */
// MOVED -> script-livraisons.js : ouvrirEditLivraison

/* ===== VUE COMPACTE TABLEAUX ===== */
let _vueCompacte = false;
function toggleVueCompacte() {
  _vueCompacte = !_vueCompacte;
  document.querySelectorAll('.data-table').forEach(t => t.classList.toggle('compact', _vueCompacte));
  const btn = document.getElementById('btn-density-compact');
  const btn2= document.getElementById('btn-density-normal');
  if (btn)  btn.classList.toggle('active',  _vueCompacte);
  if (btn2) btn2.classList.toggle('active', !_vueCompacte);
  afficherToast(_vueCompacte ? '🗜️ Vue compacte' : '📋 Vue normale');
}

/* ===== MODÈLES DE MESSAGES PRÉDÉFINIS ===== */
const MODELES_MESSAGES = [
  { id:1, titre:'Tournée prête',      texte:'Bonjour {prenom} 👋 Votre tournée du jour est prête. Vérifiez vos livraisons assignées dans l\'onglet Livraisons.' },
  { id:2, titre:'Rappel km retour',   texte:'Bonsoir {prenom}, n\'oubliez pas d\'enregistrer votre km de retour et votre plein si vous en avez fait un. Merci 🙏' },
  { id:3, titre:'Rappel inspection',  texte:'Rappel : pensez à faire l\'inspection de votre véhicule avant le départ. Photos obligatoires 📷' },
  { id:4, titre:'Livraison urgente',  texte:'📦 Livraison urgente ajoutée à votre tournée. Consultez l\'onglet Livraisons pour les détails.' },
  { id:5, titre:'Bonne journée',      texte:'Bonjour {prenom} ☀️ Bonne journée de livraisons ! N\'hésitez pas à me contacter en cas de problème.' },
];

function afficherModelesMessages() {
  const cont = document.getElementById('modeles-msg-list');
  if (!cont) return;
  cont.innerHTML = MODELES_MESSAGES.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:600">${m.titre}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${m.texte.substring(0,55)}...</div>
      </div>
      <button class="btn-icon" onclick="utiliserModele(${m.id})" title="Utiliser">→</button>
    </div>`).join('');
}

function utiliserModele(id) {
  const modele = MODELES_MESSAGES.find(m=>m.id===id);
  if (!modele || !_msgSalarieActif) { afficherToast('⚠️ Sélectionnez d\'abord un salarié','error'); return; }
  const sal = charger('salaries').find(s=>s.id===_msgSalarieActif);
  const texte = modele.texte.replace('{prenom}', sal?.nom.split(' ')[0]||'');
  const input = document.getElementById('msg-admin-input');
  if (input) { input.value = texte; input.focus(); }
  document.getElementById('panel-modeles')?.classList.remove('open');
}

function togglePanelModeles() {
  const panel = document.getElementById('panel-modeles');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (isOpen) afficherModelesMessages();
}

/* ===== RH — COMPTEUR HEURES ===== */
// MOVED -> script-salaries.js : calculerHeuresSalarie

function getHeuresSemaineRange() {
  const lundi = getLundiDeSemaine(_heuresSemaineOffset || 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return {
    lundi,
    dimanche,
    debut: dateToLocalISO(lundi),
    fin: dateToLocalISO(dimanche),
    label: `Semaine ${getNumSemaine(lundi)}`,
    datesLabel: `${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  };
}

var _heuresVue = 'semaine';
var _heuresJourOffset = 0;
var _heuresMoisOffset = 0;
var _heuresAnneeOffset = 0;

// MOVED -> script-heures.js : getHeuresPeriodeRange

// MOVED -> script-planning.js : getPlanningPeriodForDate

// MOVED -> script-planning.js : planningGetVehicleForSalarie

// MOVED -> script-planning.js : planningGetLivraisonsForDate

// MOVED -> script-incidents.js : planningGetOpenIncidentsForSalarie

// MOVED -> script-inspections.js : planningGetInspectionForDate

// MOVED -> script-planning.js : planningGetIndisponibilitePourDate

// MOVED -> script-planning.js : planningOuvrirSaisieRapide

// MOVED -> script-planning.js : togglePlanningQuickPanel

// MOVED -> script-planning.js : planningCalculerRecapPeriode

// MOVED -> script-planning.js : ouvrirRecapPlanningPeriode

// MOVED -> script-planning.js : planningOuvrirFicheSalarie

// MOVED -> script-heures.js : construireContexteHeures

// MOVED -> script-planning.js : getPlanningPeriodLabel

// MOVED -> script-heures.js : majHeuresPeriodeLabel

// MOVED -> script-heures.js : changerVueHeures

// MOVED -> script-heures.js : naviguerHeuresPeriode

// MOVED -> script-heures.js : reinitialiserHeuresPeriode

// MOVED -> script-heures.js : calculerHeuresSalarieSemaine

// MOVED -> script-heures.js : afficherCompteurHeures

// MOVED -> script-heures.js : resetFiltresHeures

// MOVED -> script-exports.js : exporterRecapHeures

/* ===== RH — NOTE INTERNE SALARIÉ ===== */
// MOVED -> script-core-storage.js : charger_note_interne

// MOVED -> script-core-storage.js : chargerNoteInterne

function ouvrirNoteInterne(salId, salNom) {
  document.getElementById('note-interne-sal-id').value  = salId;
  document.getElementById('note-interne-sal-nom').textContent = salNom;
  document.getElementById('note-interne-texte').value   = chargerNoteInterne(salId);
  openModal('modal-note-interne');
}

// MOVED -> script-core-ui.js : confirmerNoteInterne

/* ===== FLOTTE — PHOTO VÉHICULE ===== */

// Upload carte grise PDF (ou image) — pousse vers Supabase Storage (bucket vehicules-cartes-grises).
// Le storage_path est stocke sur le vehicule au lieu du base64. Multi-device natif.
// MOVED -> script-vehicules.js : uploaderCarteGriseVehicule

// Wrapper appelé par l'input du formulaire véhicule (création + édition).
// - En édition (window._editVehId set) : upload immediat vers Storage
// - En création : stocke le file en temp jusqu'au save final (qui declenchera l'upload avec l'id genere)
// MOVED -> script-vehicules.js : uploaderCarteGriseFromForm

// Reset visuel du champ carte grise (appelé à l'ouverture de la modal Création
// ou au reset après save).
// MOVED -> script-vehicules.js : resetCarteGriseFormUI

// Affiche le fichier déjà uploadé dans le formulaire d'édition véhicule.
// MOVED -> script-vehicules.js : prefillCarteGriseFormUI

// Visualise la carte grise dans une nouvelle fenêtre/onglet.
// Pour les PDFs en Storage : download blob + object URL (plus fiable que embed signed URL).
// MOVED -> script-vehicules.js : visualiserCarteGrise

// Helper : affiche un document (PDF ou image) dans une nouvelle fenetre
function afficherDocumentDansFenetre(url, isPdf, titre) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { afficherToast('Popup bloquée', 'error'); return; }
  const contenu = isPdf
    ? '<embed src="' + url + '" type="application/pdf" style="width:100%;height:100vh;border:none" />'
    : '<img src="' + url + '" style="max-width:100%;height:auto;display:block;margin:0 auto" />';
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>body{margin:0;font-family:sans-serif;background:#1a1d27}h1{color:#f5a623;padding:14px 20px;margin:0;font-size:1.05rem}</style></head><body><h1>📄 ' + titre + '</h1>' + contenu + '</body></html>');
  w.document.close();
}

/* ===== FLOTTE — HISTORIQUE CONDUCTEURS ===== */
// MOVED -> script-salaries.js : ouvrirHistoriqueConducteurs
function enregistrerConduite(livraison) {
  if (!livraison.vehId || !livraison.chaufId) return;
  const cle  = 'conducteurs_veh_' + livraison.vehId;
  const hist = loadSafe(cle, []);
  hist.push({
    salId:    livraison.chaufId,
    salNom:   livraison.chaufNom,
    date:     livraison.date,
    livNom:   livraison.client,
    numLiv:   livraison.numLiv||'',
    distance: livraison.distance||0
  });
  if (hist.length > 100) hist.shift();
  localStorage.setItem(cle, JSON.stringify(hist));
}

// MOVED -> script-salaries.js : afficherHistoriqueConducteurs

/* ===== MESSAGES AUTOMATIQUES BEST EFFORT ===== */
// MOVED -> script-messages.js : verifierMessagesAuto

/* Côté admin : vérifier si un salarié commence bientôt (H-15min) ou vient de finir (H+30min) */
// MOVED -> script-planning.js : verifierTriggersPlanningAuto

// Vérifier toutes les minutes
setInterval(verifierTriggersPlanningAuto, 60000);

/* ===== MOBILE — SWIPE SIDEBAR ===== */
function initSwipeSidebar() {
  let startX = 0, isDragging = false;
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.changedTouches[0].clientX - startX;
    if (diff > 60 && startX < 40) ouvrirMenuMobile();
    if (diff < -60) fermerMenuMobile();
  }, { passive: true });
}

/* ===== MOBILE — PULL TO REFRESH ===== */
function initPullToRefresh() {
  // Uniquement sur mobile/tactile
  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) return;
  const main = document.getElementById('mainContent');
  if (!main) return;
  let startY = 0, pulling = false;
  const ind = document.getElementById('ptr-indicator');

  main.addEventListener('touchstart', e => {
    if (main.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 40 && ind) ind.classList.add('visible');
  }, { passive: true });

  main.addEventListener('touchend', e => {
    if (!pulling) return;
    pulling = false;
    const diff = e.changedTouches[0].clientY - startY;
    if (ind) ind.classList.remove('visible');
    if (diff > 80) {
      const page = document.querySelector('.page.active')?.id?.replace('page-','');
      if (page) naviguerVers(page);
      afficherToast('🔄 Actualisé');
    }
  }, { passive: true });
}

/* ===== PIÈCES JOINTES MESSAGERIE ===== */
// MOVED -> script-messages.js : envoyerMessageAvecPhoto

// Helper : apres render d'un container avec messages, resoud les signed URLs
// pour les <img data-photo-path="..." data-photo-bucket="...">.
// MOVED -> script-core-storage.js : resolveStorageImages
window.resolveStorageImages = resolveStorageImages;

/* ===== SON / VIBRATION MESSAGES ===== */
/* ===== FICHE TOURNÉE JOURNALIÈRE PDF ===== */
function genererFicheTournee(salId, date) {
  date = date || aujourdhui();
  const salaries   = charger('salaries');
  const sal        = salaries.find(s => s.id === salId);
  if (!sal) return;
  const livraisons = charger('livraisons').filter(l => l.chaufId === salId && l.date === date);
  const params     = getEntrepriseExportParams();
  const nom        = params.nom;
  const dateLabel  = formatDateExport(date);
  const veh        = charger('vehicules').find(v => v.salId === salId);
  const dateExp    = formatDateHeureExport();
  const totalKm    = livraisons.reduce((s,l)=>s+(l.distance||0),0);

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div>
        <div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Fiche de tournée</div>
        <div style="font-size:1rem;font-weight:700">${dateLabel}</div>
      </div>
    </div>
    ${renderBlocInfosEntreprise(params)}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:#f8f9fc;border-radius:10px;padding:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Chauffeur</div>
        <div style="font-size:1rem;font-weight:700">${sal.nom}</div>
        ${sal.tel?`<div style="font-size:.82rem;color:#6b7280">📞 ${sal.tel}</div>`:''}
      </div>
      <div style="background:#f8f9fc;border-radius:10px;padding:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Véhicule</div>
        <div style="font-size:1rem;font-weight:700">${veh?.immat||'Non affecté'}</div>
        <div style="font-size:.82rem;color:#6b7280">${veh?.modele||''}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px">
      ${[
        ['📦 Livraisons', livraisons.length],
        ['🛣️ Km estimés', totalKm+' km'],
      ].map(([l,v])=>`<div style="background:#f8f9fc;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:.72rem;color:#9ca3af;margin-bottom:4px">${l}</div>
        <div style="font-size:1.2rem;font-weight:800">${v}</div>
      </div>`).join('')}
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:10px">Détail des livraisons</div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">#</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Client</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Adresse</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600;color:#6b7280">Km</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#6b7280">Statut</th>
        </tr></thead>
        <tbody>${livraisons.length === 0
          ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af">Aucune livraison assignée</td></tr>`
          : livraisons.map((l,i)=>`
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:8px 12px;color:#9ca3af">${i+1}</td>
            <td style="padding:8px 12px;font-weight:600">${l.client}</td>
            <td style="padding:8px 12px;color:#6b7280;font-size:.82rem">${l.arrivee||l.depart||'—'}</td>
            <td style="padding:8px 12px;text-align:right">${l.distance?l.distance+' km':'—'}</td>
            <td style="padding:8px 12px;text-align:center">${l.statut==='livre'?'✅':l.statut==='en-cours'?'🚐':'⏳'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:20px;min-height:60px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Observations / Signature chauffeur</div>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
      <span>${nom} — Page 1/1</span><span>${dateExp}</span><span>${params.tel || params.email || ''}</span>
    </div>
  </div>`;

  const win = ouvrirPopupSecure('', '_blank', 'width=850,height=950');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Tournée ${sal.nom} — ${date}</title>
    <style>body{margin:0;padding:20px;background:#fff} @page{margin:12mm}</style>
    </head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('📄 Fiche de tournée générée');
}

/* ===== GOOGLE MAPS — DISTANCE AUTO ===== */
/* ===== VUE COMPACTE / ÉTENDUE ===== */
let _tableauCompact = false;
function initDensiteTableau() {
  _tableauCompact = localStorage.getItem('tableau_compact') === '1';
  if (_tableauCompact) document.querySelectorAll('.data-table').forEach(t => t.classList.add('compact'));
  const btn = document.getElementById('btn-densite');
  if (btn) { btn.textContent = _tableauCompact ? '⊞ Étendu' : '⊟ Compact'; btn.classList.toggle('active', _tableauCompact); }
}

/* ===== MODÈLES DE MESSAGES ===== */
const MSG_TEMPLATES = [
  { label: '🚀 Tournée prête',   texte: 'Bonjour [prénom] 👋 Votre tournée du jour est prête. Vérifiez vos livraisons dans l\'onglet Livraisons. Bonne journée !' },
  { label: '🛣️ Relevé km',       texte: 'Rappel : pensez à enregistrer votre relevé kilométrique de retour dans l\'onglet Inspection & Km. Merci !' },
  { label: '🚗 Inspection',      texte: 'Rappel : inspection véhicule obligatoire avant le départ. Prenez les 4 photos demandées. Merci !' },
  { label: '⛽ Plein',           texte: 'Si vous avez fait le plein aujourd\'hui, n\'oubliez pas de le saisir dans l\'onglet Carburant. Merci !' },
  { label: '✅ Bonne journée',   texte: 'Bonjour à tous ! Bonne journée de livraisons. Restez prudents sur la route 🚐' },
];

function insererTemplate(texte, salNom) {
  const input = document.getElementById('msg-admin-input');
  if (!input) return;
  input.value = texte.replace('[prénom]', salNom || '');
  input.focus();
  input.dispatchEvent(new Event('input'));
}

// MOVED -> script-messages.js : afficherTemplatesMsg

/* ===== MESSAGES AUTOMATIQUES "BEST EFFORT" ===== */
// MOVED -> script-messages.js : verifierMessagesAutomatiques

/* ===== TAUX DE PONCTUALITÉ ===== */
// MOVED -> script-tva.js : calculerTauxPonctualite

/* ===== TABLEAU DE BORD CLIENTS ===== */
// MOVED -> script-clients.js : afficherTopClients

/* ===== SUIVI CONGÉS / ABSENCES ===== */
/* ===== BROADCAST MESSAGE ===== */
// MOVED -> script-messages.js : envoyerBroadcast

/* ===== ALERTES PERMIS / ASSURANCE ===== */
// MOVED -> script-salaries.js : verifierDocumentsSalaries

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
    ajouterAlerteSiAbsente('relance_auto', `💸 ${label} à envoyer — ${item.client} (${item.numLiv || 'livraison'})`, {
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
      ajouterAlerteSiAbsente('ct_proche', `🚐 CT à renouveler dans ${seuil} jour(s) — ${item.immat} (${formatDateExport(ctIso)})`, {
        vehId:item.id,
        stageKey:'ct-' + seuil + '-' + item.id
      });
    }
  });

  if (alertes.length !== charger('alertes_admin').length) afficherBadgeAlertes();
}

/* ===== TEMPLATES SMS ===== */
const TEMPLATES_SMS = [
  { id:1, titre:'Avis de passage',    texte:"Bonjour, votre livreur [NOM] sera chez vous prochainement. MCA Logistics." },
  { id:2, titre:'Livraison effectuée',texte:"Votre commande a été livrée par [NOM]. Merci de votre confiance. MCA Logistics." },
  { id:3, titre:'Retard',             texte:"Nous vous informons d\u2019un léger retard sur votre livraison. Merci de votre compréhension. MCA Logistics." },
  { id:4, titre:'Tentative échouée',  texte:"Nous avons tenté de vous livrer sans succès. Merci de nous recontacter. MCA Logistics." },
];

function afficherTemplatesSMS() {
  const cont = document.getElementById('templates-sms-list');
  if (!cont) return;
  cont.innerHTML = TEMPLATES_SMS.map(t => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">${t.titre}</div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;font-style:italic">${t.texte}</div>
      <button class="btn-secondary" style="font-size:.75rem;padding:4px 10px"
        onclick="copierTemplateSMS('${t.id}')">📋 Copier</button>
    </div>`).join('');
}

function copierTemplateSMS(id) {
  const t = TEMPLATES_SMS.find(x=>x.id===parseInt(id, 10));
  if (!t) return;
  navigator.clipboard?.writeText(t.texte).then(()=>{
    afficherToast('📋 Template SMS copié dans le presse-papier');
  }).catch(()=>{
    // Fallback si clipboard non disponible
    const ta = document.createElement('textarea');
    ta.value = t.texte; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    afficherToast('📋 Template SMS copié');
  });
}

/* ===== RACCOURCIS CLAVIER ===== */
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    // Ctrl+K est géré par la palette S15 (plus riche) — ne pas doubler
    if (e.key === 'n') { e.preventDefault(); openModal('modal-livraison'); }
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ===== RECHERCHE UNIVERSELLE ===== */
function ouvrirRechercheGlobale() {
  var modal = document.getElementById('modal-recherche-globale');
  var input = document.getElementById('barre-recherche-univ');
  if (!modal || !input) return;
  modal.classList.add('open');
  setTimeout(function() { input.focus(); input.select(); }, 30);
}
function fermerRechercheGlobale() {
  var modal = document.getElementById('modal-recherche-globale');
  if (modal) modal.classList.remove('open');
  fermerRecherche();
}
// MOVED -> script-livraisons.js : rechercheOuvrirLivraison
// MOVED -> script-clients.js : rechercheOuvrirClient
function rechercheUniverselle(q) {
  const cont = document.getElementById('recherche-resultats');
  if (!cont) return;
  if (!q || q.length < 2) { cont.style.display='none'; return; }
  q = q.toLowerCase();
  const livraisons = charger('livraisons');
  const salaries   = charger('salaries');
  const vehicules  = charger('vehicules');
  const clients    = loadSafe('clients', []);
  const res = [];

  livraisons.filter(l => (l.client||'').toLowerCase().includes(q)||(l.numLiv||'').toLowerCase().includes(q)||(l.chaufNom||'').toLowerCase().includes(q))
    .slice(0,4).forEach(l => res.push({ label:`📦 ${l.numLiv||''} — ${l.client}`, sub:`${formatDateExport(l.date)} · ${euros(l.prix||0)}`, action:`rechercheOuvrirLivraison('${l.id}')` }));
  salaries.filter(s => [s.nom, s.prenom, s.numero].filter(Boolean).join(' ').toLowerCase().includes(q))
    .slice(0,3).forEach(s => res.push({ label:`👤 ${getSalarieNomComplet(s)}`, sub:`N° ${s.numero || '—'}`, action:`ouvrirEditSalarie('${s.id}')` }));
  vehicules.filter(v => (v.immat||'').toLowerCase().includes(q)||(v.modele||'').toLowerCase().includes(q))
    .slice(0,3).forEach(v => res.push({ label:`🚐 ${v.immat}`, sub:v.modele||'', action:`ouvrirFicheVehiculeDepuisTableau('${v.id}')` }));
  clients.filter(c => [c.nom, c.prenom, c.tel].filter(Boolean).join(' ').toLowerCase().includes(q))
    .slice(0,3).forEach(c => res.push({ label:`🧑‍💼 ${c.nom}`, sub:c.adresse||c.tel||'', action:`rechercheOuvrirClient('${c.id}')` }));

  if (!res.length) { cont.innerHTML='<div style="padding:10px 14px;color:var(--text-muted);font-size:.85rem">Aucun résultat</div>'; cont.style.display='block'; return; }
  cont.innerHTML = res.map(r => `
    <div onclick="${r.action};fermerRechercheGlobale()" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">
      <div style="font-size:.88rem;font-weight:500">${r.label}</div>
      ${r.sub?`<div style="font-size:.76rem;color:var(--text-muted)">${r.sub}</div>`:''}
    </div>`).join('');
  cont.style.display = 'block';
}
function fermerRecherche() {
  const el = document.getElementById('recherche-resultats');
  if (el) el.style.display='none';
  const input = document.getElementById('barre-recherche-univ');
  if (input) input.value = '';
}

/* ===== CARNET CLIENTS ===== */
let _clientHistoryCurrentId = null;

// MOVED -> script-clients.js : getClientHistoriqueSnapshot

// MOVED -> script-exports.js : genererRapportClients

// MOVED -> script-exports.js : exporterHistoriqueClientsCSV

// MOVED -> script-clients.js : ouvrirHistoriqueClient

// MOVED -> script-exports.js : exporterHistoriqueClientCourant

// BUG-007 fix : RGPD art. 20 — droit à la portabilité. Export JSON structuré de toutes les données du client.
// MOVED -> script-clients.js : collecterDonneesRGPDClient

// MOVED -> script-exports.js : exporterDonneesRGPDClientCourant

// afficherClients : alias historique. La vraie fonction de rendu est
// afficherClientsDashboard (ligne ~7232). Ce wrapper évite de casser les
// nombreux appels existants tout en garantissant un seul code de rendu.
// MOVED -> script-clients.js : afficherClients

// Bascule l'affichage des champs Pro (SIREN, TVA, paiement, IBAN, Secteur,
// Email facturation) selon le type de client. Appelée par les radios cl-type.
window.toggleChampsClientPro = function(isEdit) {
  var prefix = isEdit ? 'edit-cl' : 'cl';
  var radios = document.getElementsByName(isEdit ? 'edit-cl-type' : 'cl-type');
  var type = 'pro';
  for (var i = 0; i < radios.length; i++) if (radios[i].checked) { type = radios[i].value; break; }
  var bloc = document.getElementById(prefix + '-champs-pro');
  if (bloc) bloc.classList.toggle('is-hidden', type !== 'pro');
  // Pour Particulier : vider le secteur (au cas où une ancienne valeur 'particulier' subsiste)
  var secteurEl = document.getElementById(prefix + '-secteur');
  if (secteurEl && type === 'particulier' && secteurEl.value === 'particulier') secteurEl.value = '';
};

// MOVED -> script-clients.js : ajouterClient

// MOVED -> script-clients.js : supprimerClient

// MOVED -> script-clients.js : preFillLivraisonClient

/* Auto-complétion client dans modal livraison + création à la volée */
// MOVED -> script-clients.js : autoCompleteClient

// Pré-remplit la modal Nouvelle livraison avec TOUTES les infos du client
// sélectionné (SIREN, TVA intracom, adresse, zone) et stocke son ID pour
// liaison fiable à la sauvegarde (sans dépendre du matching par nom).
// MOVED -> script-clients.js : selectionnerClientLivraisonParId

// Compat : ancienne signature (nom, adresse) — appelée encore depuis quelques
// endroits historiques. Délègue à la version par ID si possible.
// MOVED -> script-clients.js : selectionnerClientLivraison

// MOVED -> script-clients.js : ouvrirCreationClientDepuisLivraison

/* ===== COPIER PLANNING SEMAINE PRÉCÉDENTE ===== */
function copierSemainePrecedente() {
  const salId = document.getElementById('plan-salarie').value;
  if (!salId) { afficherToast('⚠️ Choisissez un salarié','error'); return; }
  const plannings = loadSafe('plannings', []);
  const plan = plannings.find(p=>p.salId===salId);
  if (!plan?.semaine?.length) { afficherToast('⚠️ Aucun planning précédent à copier','error'); return; }
  // Pré-remplir la grille avec les données existantes
  JOURS.forEach(jour => {
    const j = plan.semaine.find(s=>s.jour===jour);
    const cb = document.getElementById('plan-travaille-'+jour);
    if (cb && j) {
      cb.checked = j.travaille;
      toggleJourPlanning(jour);
      if (j.travaille) {
        const d=document.getElementById('plan-debut-'+jour); if(d) d.value=j.heureDebut||'';
        const f=document.getElementById('plan-fin-'+jour);   if(f) f.value=j.heureFin||'';
        const z=document.getElementById('plan-zone-'+jour);  if(z) z.value=j.zone||'';
        const n=document.getElementById('plan-note-'+jour);  if(n) n.value=j.note||'';
      }
    }
  });
  afficherToast('✅ Semaine précédente copiée — modifiez si nécessaire');
}

/* ===== DÉCONNEXION AUTO ADMIN (inactivité configurable) ===== */
let _timerInactivite = null;
function resetTimerInactivite() {
  if (getRoleSessionCourant() !== 'admin') return;
  clearTimeout(_timerInactivite);
  _timerInactivite = setTimeout(() => {
    sessionStorage.setItem('delivpro_session_expired', '1');
    sessionStorage.setItem('delivpro_pending_signout', '1');
    purgerSessionAdminLocale();
    redirigerVersLoginAdmin();
  }, getSessionTimeoutMinutesAdmin() * 60 * 1000);
}
['click','keydown','mousemove','scroll'].forEach(ev => document.addEventListener(ev, resetTimerInactivite, { passive:true }));

/* ===== PARAMÈTRES ADMIN ===== */
// MOVED -> script-core-auth.js : toggleParamMdp

// MOVED -> script-core-auth.js : changerMdpAdmin

// MOVED -> script-core-storage.js : sauvegarderObjectifCA

// Valeurs par défaut MCA LOGISTICS (Statuts SAS signés 22/03/2026, PV désignation
// gestionnaire transport 17/04/2026, dossier DREAL 2026-15119). Utilisées uniquement
// si aucun paramètre n'a encore été saisi côté utilisateur.
const MCA_DEFAULTS_ENTREPRISE = {
  nom: 'MCA LOGISTICS',
  formeJuridique: 'SAS',
  capital: 7200,
  capitalLibere: 3600,
  adresse: '17 rue de la Chapelle',
  codePostal: '67540',
  ville: 'Ostwald',
  pays: 'FR',
  rcsVille: 'Strasbourg',
  drealDossier: '2026-15119',
  gestionnaireNom: 'Mohammed CHIKRI',
  banque: 'Qonto',
  delaiPaiementDefaut: 30,
  tauxPenalitesRetard: 10.15
};

// MOVED -> script-core-storage.js : chargerParametres

/* ===== GESTION DES POSTES ===== */
function getPostes() { return loadSafe('postes', ["Livreur","Dispatcher"]); }
// MOVED -> script-core-storage.js : sauvegarderPostes

function afficherPostes() {
  const postes = getPostes();
  const cont = document.getElementById('liste-postes');
  if (!cont) return;
  cont.innerHTML = postes.map((p,i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.25);color:var(--accent);padding:5px 12px;border-radius:20px;font-size:.82rem;font-weight:600">
      ${p}
      <button onclick="supprimerPoste(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:.9rem;padding:0;line-height:1" title="Supprimer">✕</button>
    </span>`).join('');
  // Mettre à jour les selects de poste partout
  majSelectsPostes();
}

function ajouterPoste() {
  const input = document.getElementById('nouveau-poste');
  const nom = input?.value.trim();
  if (!nom) { afficherToast('⚠️ Nom du poste vide','error'); return; }
  const postes = getPostes();
  if (postes.find(p=>p.toLowerCase()===nom.toLowerCase())) { afficherToast('⚠️ Ce poste existe déjà','error'); return; }
  postes.push(nom);
  sauvegarderPostes(postes);
  input.value = '';
  afficherPostes();
  afficherToast('✅ Poste ajouté : ' + nom);
}

function supprimerPoste(idx) {
  const postes = getPostes();
  postes.splice(idx, 1);
  sauvegarderPostes(postes);
  afficherPostes();
  afficherToast('🗑️ Poste supprimé');
}

function majSelectsPostes() {
  const postes = getPostes();
  ['nsal-poste','edit-sal-poste'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const v = sel.value;
    // Si c'est un select (pas un input text)
    if (sel.tagName === 'SELECT') {
      sel.innerHTML = '<option value="">-- Choisir un poste --</option>';
      postes.forEach(p => { sel.innerHTML += `<option value="${p}">${p}</option>`; });
      sel.value = v;
    }
  });
}

// MOVED -> script-core-storage.js : sauvegarderParametres

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

// MOVED -> script-tva.js : sauvegarderTVA

// MOVED -> script-tva.js : chargerConfigurationTVAParametres

function chargerConfigurationTresorerieParametres() {
  var cfg = getTresoConfigBudget();
  var map = {
    'param-treso-solde-depart': cfg.soldeDepart || 0,
    'param-treso-echeance-tva': cfg.echeanceTVA || ''
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = map[id];
  });
  var helper = document.getElementById('param-treso-helper');
  if (helper) {
    helper.textContent = 'Base de trésorerie : ' + euros(cfg.soldeDepart || 0)
      + (cfg.echeanceTVA ? ' · Échéance TVA : ' + formatDateExport(cfg.echeanceTVA) : '');
  }
}

// MOVED -> script-tva.js : sauvegarderConfigurationTVA

function sauvegarderConfigurationTresorerie() {
  var cfg = chargerObj('treso_config', {});
  cfg.soldeDepart = parseFloat(document.getElementById('param-treso-solde-depart')?.value || '0') || 0;
  cfg.echeanceTVA = document.getElementById('param-treso-echeance-tva')?.value || '';
  delete cfg.chargesSalariales;
  sauvegarder('treso_config', cfg);
  chargerConfigurationTresorerieParametres();
  rafraichirDashboard();
  ajouterEntreeAudit('Configuration trésorerie', 'Base ' + euros(cfg.soldeDepart || 0) + (cfg.echeanceTVA ? ' · Échéance TVA ' + formatDateExport(cfg.echeanceTVA) : ''));
  afficherToast('✅ Configuration de trésorerie enregistrée');
}

// MOVED -> script-livraisons.js : sauvegarderObjectifLivraisons

// MOVED -> script-core-storage.js : sauvegarderMaxTentatives

// MOVED -> script-paiements.js : sauvegarderRelanceDelai

function appliquerAccentColor() {
  const color = document.getElementById('param-accent-color')?.value || '#f5a623';
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('accent_color', color);
  afficherToast('🎨 Couleur appliquée');
}

// MOVED -> script-core-auth.js : majResumeSauvegardeAdmin

// MOVED -> script-core-auth.js : construireSauvegardeAdmin

// MOVED -> script-exports.js : exporterSauvegardeAdmin

// MOVED -> script-core-auth.js : importerSauvegardeAdmin

/* ===== HT / TVA ===== */
function prixHT(prixTTC, tauxTVA) {
  return prixTTC / (1 + tauxTVA / 100);
}
// MOVED -> script-tva.js : getTauxTVA
/* ===== SOLDE TRÉSORERIE ===== */
// MOVED -> script-core-utils.js : calculerSoldeTresorerie

/* ===== CATÉGORIES DE CHARGES ===== */
// MOVED -> script-charges.js : resetFormulaireCharge
// MOVED -> script-charges.js : ajusterCategorieCharge
// MOVED -> script-charges.js : ouvrirModalCharge
// MOVED -> script-charges.js : ouvrirEditCharge
// MOVED -> script-charges.js : resetFiltresCharges
// MOVED -> script-charges.js : afficherCharges

// MOVED -> script-charges.js : ajouterCharge

// MOVED -> script-charges.js : supprimerCharge

// MOVED -> script-exports.js : exporterChargesPDF

/* ===== RELANCE PAIEMENT ===== */
// MOVED -> script-paiements.js : getRelanceTemplatesDefaut

// MOVED -> script-paiements.js : chargerTemplatesRelance

// MOVED -> script-paiements.js : peuplerTemplatesRelance

// MOVED -> script-paiements.js : ouvrirModalTemplatesRelance

// MOVED -> script-paiements.js : sauvegarderTemplatesRelance

// MOVED -> script-paiements.js : reinitialiserTemplatesRelance

// MOVED -> script-paiements.js : construireTexteRelancePersonnalise

// MOVED -> script-paiements.js : afficherRelances

function marquerPaye(id) {
  const livs = charger('livraisons');
  const idx  = livs.findIndex(l=>l.id===id);
  if (idx>-1) {
    livs[idx].statutPaiement = 'payé';
    livs[idx].datePaiement = aujourdhui();
    sauvegarder('livraisons',livs);
    ajouterEntreeAudit('Paiement livraison', (livs[idx].numLiv || 'Livraison') + ' · ' + euros(livs[idx].prix || 0));
    afficherRelances();
    afficherTva();
    rafraichirDashboard();
    afficherToast('💳 Marqué comme payé');
  }
}
// MOVED -> script-paiements.js : marquerRelance

/* ===== TCO VÉHICULE ===== */
// MOVED -> script-core-utils.js : calculerTCO

function afficherTCO(vehId) {
  const veh  = charger('vehicules').find(v=>v.id===vehId);
  const tco  = calculerTCO(vehId);
  const cont = document.getElementById('tco-detail');
  if (!cont || !veh) return;

  cont.innerHTML = `
    <div style="font-size:.9rem;font-weight:600;margin-bottom:12px">🚐 TCO — ${veh.immat} ${veh.modele||''}</div>
    <div class="tco-grid">
      <div class="tco-item"><div class="tco-label">🏷️ Acquisition HT</div><div class="tco-value" style="color:#4f8ef7">${euros(tco.achatHT)}</div></div>
      <div class="tco-item"><div class="tco-label">⛽ Carburant</div><div class="tco-value" style="color:#e74c3c">${euros(tco.totalCarb)}</div></div>
      <div class="tco-item"><div class="tco-label">🔧 Entretiens</div><div class="tco-value" style="color:var(--accent)">${euros(tco.totalEntr)}</div></div>
      <div class="tco-item"><div class="tco-label">💸 Autres charges</div><div class="tco-value" style="color:#9b59b6">${euros(tco.totalCharg)}</div></div>
      <div class="tco-item"><div class="tco-label">📉 Amorti cumulé</div><div class="tco-value" style="color:#16a34a">${euros(tco.amort.cumule)}</div></div>
      <div class="tco-item" style="border:1px solid var(--border)"><div class="tco-label">💰 Total TCO</div><div class="tco-value" style="color:var(--text-primary)">${euros(tco.total)}</div></div>
    </div>`;
}

/* ===== CARNET ENTRETIEN DÉTAILLÉ ===== */
// MOVED -> script-entretiens.js : afficherEntretiens

// Auto-fill du km actuel quand on sélectionne un véhicule dans la modal Entretien
// (le user veut pouvoir modifier mais avoir le km actuel pré-rempli).
// Le champ 'Prochain entretien' reste vide intentionnellement.
// MOVED -> script-entretiens.js : autoFillKmEntretien

// MOVED -> script-entretiens.js : ouvrirModalEntretien

// MOVED -> script-entretiens.js : ajouterEntretien

// MOVED -> script-entretiens.js : ouvrirEditEntretien

// MOVED -> script-entretiens.js : confirmerEditEntretien

// MOVED -> script-entretiens.js : supprimerEntretien

/* ===== BLOCAGE COMPTE après X tentatives ===== */
/* ===== INCIDENTS / RÉCLAMATIONS ===== */
// MOVED -> script-incidents.js : afficherIncidents

// MOVED -> script-incidents.js : ajouterIncident

// MOVED -> script-incidents.js : changerStatutIncident

// MOVED -> script-incidents.js : supprimerIncident

/* ===== HISTORIQUE MODIFICATIONS LIVRAISON ===== */
// MOVED -> script-livraisons.js : logModifLivraison

// MOVED -> script-salaries.js : nettoyerHistoriqueModifsLivraisons

// MOVED -> script-salaries.js : afficherHistoriqueModifs

/* ===== COMMENTAIRES INTERNES LIVRAISON ===== */
// MOVED -> script-livraisons.js : ajouterCommentaireLiv

// MOVED -> script-livraisons.js : afficherCommentairesLiv

/* ===== BON DE LIVRAISON PDF ===== */
// MOVED -> script-livraisons.js : genererBonLivraison

// MOVED -> script-charges.js : chargerFacturesEmises

// MOVED -> script-core-storage.js : sauvegarderFacturesEmises

function getAnneeFactureReference(livraison) {
  const source = livraison?.datePaiement || livraison?.date || aujourdhui();
  const match = String(source || '').match(/^(\d{4})/);
  return match ? match[1] : String(new Date().getFullYear());
}

// MOVED -> script-core-utils.js : formatNumeroFacture

// BUG-001 — compteur facture persistant par année (CGI art. 289)
// La séquence ne régresse jamais, même après suppression.
const COMPTEURS_FACTURES_KEY = 'compteurs_factures_annee';
function incrementerCompteurFactureAnnee(annee) {
  const key = String(annee || new Date().getFullYear());
  let compteurs = {};
  try { compteurs = loadSafe(COMPTEURS_FACTURES_KEY, {}) || {}; } catch(e){ compteurs = {}; }
  // Synchro de sécurité : si tableau factures contient un numéro plus grand (migration), on part de là
  try {
    const maxLive = (loadSafe('factures_emises', []) || [])
      .filter(f => String(f.annee || '') === key)
      .reduce((m, f) => Math.max(m, parseInt(f.sequence, 10) || 0), 0);
    if (maxLive > (compteurs[key] || 0)) compteurs[key] = maxLive;
  } catch(e) {}
  compteurs[key] = (compteurs[key] || 0) + 1;
  localStorage.setItem(COMPTEURS_FACTURES_KEY, JSON.stringify(compteurs));
  return compteurs[key];
}

// MOVED -> script-livraisons.js : assurerArchiveFactureLivraison

// MOVED -> script-livraisons.js : annulerArchiveFactureLivraison

// MOVED -> script-livraisons.js : genererFactureLivraison

/* ============================================================
   Lettre de voiture — arrêté 09/11/1999 modifié + décret 2017-443
   + ADR 2025 chapitre 5.4 pour matières dangereuses
   Mentions obligatoires : date, nom+adresse expéditeur, nom+adresse
   destinataire, lieu+date chargement et déchargement, nature
   marchandise, poids brut, nombre de colis, prix transport, nom+
   immat transporteur, signatures.
   ============================================================ */
function genererLettreDeVoiture(livId) {
  const livraison = charger('livraisons').find(l => l.id === livId);
  if (!livraison) { afficherToast('⚠️ Livraison introuvable', 'error'); return; }
  const params = getEntrepriseExportParams();
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
    : '📋 Lettre de voiture générée');
}
window.genererLettreDeVoiture = genererLettreDeVoiture;

/* ============================================================
   Registre des traitements RGPD — art. 30 UE 2016/679
   Production d'un document imprimable listant les traitements
   pré-configurés pour une entreprise transport + synthèse des
   données du responsable (nom, SIRET, adresse).
   ============================================================ */
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
    + '<div style="font-size:1.4rem;font-weight:900">📖 Registre des activités de traitement</div>'
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
    + traitements.map(function(t) {
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
window.genererRegistreRGPD = genererRegistreRGPD;

/* Auto-remplir le véhicule quand on choisit un salarié dans le modal livraison */
// MOVED -> script-vehicules.js : autoRemplirVehicule

// MOVED -> script-salaries.js : autoRemplirChauffeurDepuisVehicule

// MOVED -> script-vehicules.js : autoRemplirVehiculeEdit

// MOVED -> script-salaries.js : autoRemplirChauffeurDepuisVehiculeEdit

/* ===== MODIFIER CLIENT ===== */
let _editClientId = null;
// MOVED -> script-clients.js : ouvrirEditClient

// MOVED -> script-clients.js : confirmerEditClient

/* ===== EXPORT STATS PDF ===== */
// MOVED -> script-stats.js : exporterStatsPDF

/* ===== EXPORT HEURES PDF ===== */
// MOVED -> script-exports.js : exporterHeuresPDF

/* ===== MODIFIER VÉHICULE ===== */
// MOVED -> script-vehicules.js : ouvrirEditVehicule
window.ouvrirEditVehicule = ouvrirEditVehicule;

// MOVED -> script-vehicules.js : confirmerEditVehicule
window.confirmerEditVehicule = confirmerEditVehicule;

/* ===== ALIAS EXPORTS ===== */
// MOVED -> script-exports.js : exporterRecapHeuresPDF

/* ===== EXPORT PLANNING PDF ===== */
// MOVED -> script-exports.js : exporterPlanningPDF

/* ===== EXPORT ENTRETIENS PDF ===== */
// MOVED -> script-entretiens.js : exporterEntretiensPDF

/* ===== EXPORT VÉHICULES PDF ===== */
// MOVED -> script-exports.js : exporterVehiculesPDF

/* ===============================================
   AJOUTS v22+ — Fonctionnalités supplémentaires
   =============================================== */

/* ===== FORMAT PRIX COMPLET HT/TVA€/TTC ===== */
// MOVED -> script-core-utils.js : formatPrixComplet

/* ===== RELANCES — LETTRES PDF 3 NIVEAUX ===== */
// MOVED -> script-paiements.js : genererLettreRelance

/* ===== PLANNING — PÉRIODE ABSENCE ===== */
// MOVED -> script-planning.js : ajouterPeriodeAbsence

// MOVED -> script-planning.js : afficherAbsencesPeriodes

// MOVED -> script-planning.js : supprimerAbsencePeriode

/* ===== CHARGES → SYNCHRO ENTRETIEN ===== */
// MOVED -> script-entretiens.js : synchroChargeVersEntretien

/* ===== INCIDENTS — PEUPLER SELECT SALARIÉ ===== */
// MOVED -> script-incidents.js : peupleIncSalarie

/* ===== PEUPLER SELECT ABSENCE SAL ===== */
// MOVED -> script-planning.js : peuplerAbsenceSal

// MOVED -> script-planning.js : filtrerRechercheAbsence

// MOVED -> script-planning.js : peuplerSelectPlanningModal

// MOVED -> script-planning.js : filtrerRecherchePlanningModal

// MOVED -> script-heures.js : mettreAJourTotalHeuresPlanning

// MOVED -> script-planning.js : filtrerPlanningSemaine

/* ===============================================
   PLANNING SEMAINE — Navigation + Absences + PDF
   =============================================== */

var _planningSemaineOffset = 0; // 0 = semaine courante
var _planningPeriode = buildSimplePeriodeState('semaine');

function getLundiDeSemaine(offset) {
  var d = new Date();
  var day = d.getDay(); // 0=dim
  var diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  d.setDate(diff + (offset||0) * 7);
  d.setHours(0,0,0,0);
  return d;
}

function naviguerSemaine(delta) {
  if (delta === 0) _planningSemaineOffset = 0;
  else _planningSemaineOffset += delta;
  afficherPlanningSemaine();
}

// MOVED -> script-planning.js : changerVuePlanning

// MOVED -> script-planning.js : naviguerPlanningPeriode

// MOVED -> script-planning.js : reinitialiserPlanningPeriode

// MOVED -> script-planning.js : afficherPlanningSemaine

function getNumSemaine(d) {
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}

/* ===== EXPORT PDF SEMAINE ===== */
// MOVED -> script-exports.js : exporterPlanningSemainePDF

/* ===============================================
   NAVIGATION PÉRIODE — Toutes les pages
   =============================================== */

// MOVED -> script-core-utils.js : formatPeriodeDateFr

function getStartOfWeek(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// MOVED -> script-stats.js : buildSimplePeriodeState

function majPeriodeDisplay(labelId, datesId, range) {
  var lbl = document.getElementById(labelId);
  var dates = document.getElementById(datesId);
  if (lbl) lbl.textContent = (range.label || '').charAt(0).toUpperCase() + (range.label || '').slice(1);
  if (dates) dates.textContent = range.datesLabel || '';
}

function isDateInRange(dateStr, range) {
  return !!dateStr && !!range && dateStr >= range.debut && dateStr <= range.fin;
}

/* --- LIVRAISONS : mois + semaine --- */
var _livPeriodeOffset = 0;
var _livPeriodeMode = 'mois';
var _livPeriodePersonnalisee = null;

// MOVED -> script-livraisons.js : syncLivPeriodeModeSelect

// MOVED -> script-livraisons.js : changerVuePeriodeLivraisons

// MOVED -> script-livraisons.js : navLivPeriode

// MOVED -> script-livraisons.js : reinitialiserLivPeriode

/* --- HEURES & KM : semaine --- */
var _heuresSemaineOffset = 0;
// MOVED -> script-heures.js : navHeuresSemaine
// MOVED -> script-heures.js : majHeuresSemaineLabel

/* --- INSPECTIONS / CHARGES / CARBURANT / ENTRETIENS --- */
var _inspPeriode = buildSimplePeriodeState('semaine');
var _chargesPeriode = buildSimplePeriodeState('mois');
var _carbPeriode = buildSimplePeriodeState('mois');
var _entrPeriode = buildSimplePeriodeState('mois');

function changeSimplePeriode(state, mode, refreshFn, labelId, datesId, selectId) {
  state.mode = ['jour', 'semaine', 'mois', 'annee'].includes(mode) ? mode : state.mode;
  state.offset = 0;
  var select = selectId ? document.getElementById(selectId) : null;
  if (select) select.value = state.mode;
  majPeriodeDisplay(labelId, datesId, getPeriodeRange(state.mode, state.offset));
  if (typeof refreshFn === 'function') refreshFn();
}

function navSimplePeriode(state, delta, refreshFn, labelId, datesId, selectId) {
  state.offset += delta || 0;
  var select = selectId ? document.getElementById(selectId) : null;
  if (select) select.value = state.mode;
  majPeriodeDisplay(labelId, datesId, getPeriodeRange(state.mode, state.offset));
  if (typeof refreshFn === 'function') refreshFn();
}

function resetSimplePeriode(state, refreshFn, labelId, datesId, selectId) {
  state.offset = 0;
  navSimplePeriode(state, 0, refreshFn, labelId, datesId, selectId);
}

// MOVED -> script-inspections.js : getInspectionsPeriodeRange
// MOVED -> script-inspections.js : changerVueInspections
// MOVED -> script-inspections.js : navInspectionsPeriode
// MOVED -> script-inspections.js : reinitialiserInspectionsPeriode
function navInspSemaine(delta) { _inspPeriode.mode = 'semaine'; if (delta === 0) _inspPeriode.offset = 0; else _inspPeriode.offset += delta; navInspectionsPeriode(0); }

// MOVED -> script-charges.js : getChargesPeriodeRange
// MOVED -> script-charges.js : changerVueCharges
// MOVED -> script-charges.js : navChargesPeriode
// MOVED -> script-charges.js : reinitialiserChargesPeriode
// MOVED -> script-charges.js : navChargesMois
// MOVED -> script-charges.js : getChargesMoisStr

// MOVED -> script-carburant.js : getCarburantPeriodeRange
// MOVED -> script-carburant.js : changerVueCarburant
// MOVED -> script-carburant.js : navCarburantPeriode
// MOVED -> script-carburant.js : reinitialiserCarburantPeriode
function navCarbMois(delta) { _carbPeriode.mode = 'mois'; if (delta === 0) _carbPeriode.offset = 0; else _carbPeriode.offset += delta; navCarburantPeriode(0); }
function getCarbMoisStr() { return getCarburantPeriodeRange().debut.slice(0,7); }

// MOVED -> script-entretiens.js : getEntretiensPeriodeRange
// MOVED -> script-entretiens.js : changerVueEntretiens
// MOVED -> script-entretiens.js : navEntretiensPeriode
// MOVED -> script-entretiens.js : reinitialiserEntretiensPeriode
function navEntrMois(delta) { _entrPeriode.mode = 'mois'; if (delta === 0) _entrPeriode.offset = 0; else _entrPeriode.offset += delta; navEntretiensPeriode(0); }
function getEntrMoisStr() { return getEntretiensPeriodeRange().debut.slice(0,7); }

/* --- Utilitaire getPeriodeRange --- */
function getPeriodeRange(mode, offset) {
  mode = mode || 'mois';
  offset = offset || 0;
  var base = new Date();
  base.setHours(0, 0, 0, 0);

  if (mode === 'jour') {
    base.setDate(base.getDate() + offset);
    var jour = dateToLocalISO(base);
    return {
      mode: mode,
      debut: jour,
      fin: jour,
      label: formatPeriodeDateFr(base),
      datesLabel: 'Du ' + formatPeriodeDateFr(base) + ' au ' + formatPeriodeDateFr(base)
    };
  }

  if (mode === 'semaine') {
    var lundi = getStartOfWeek(base);
    lundi.setDate(lundi.getDate() + (offset * 7));
    var dim = new Date(lundi);
    dim.setDate(lundi.getDate() + 6);
    return {
      mode: mode,
      debut: dateToLocalISO(lundi),
      fin: dateToLocalISO(dim),
      label: 'Semaine ' + getNumSemaine(lundi),
      datesLabel: 'Du ' + formatPeriodeDateFr(lundi) + ' au ' + formatPeriodeDateFr(dim)
    };
  }

  if (mode === 'annee') {
    var annee = base.getFullYear() + offset;
    var debutA = new Date(annee, 0, 1);
    var finA = new Date(annee, 11, 31);
    return {
      mode: mode,
      debut: dateToLocalISO(debutA),
      fin: dateToLocalISO(finA),
      label: String(annee),
      datesLabel: 'Du ' + formatPeriodeDateFr(debutA) + ' au ' + formatPeriodeDateFr(finA)
    };
  }

  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  var debut = new Date(base.getFullYear(), base.getMonth(), 1);
  var finD = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    mode: 'mois',
    debut: dateToLocalISO(debut),
    fin: dateToLocalISO(finD),
    label: debut.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),
    datesLabel: 'Du ' + formatPeriodeDateFr(debut) + ' au ' + formatPeriodeDateFr(finD)
  };
}

/* --- EXPORT RELEVÉ KM PDF --- */
// MOVED -> script-exports.js : exporterReleveKmPDF

// MOVED -> script-exports.js : exporterRapportHeuresEtKmPDF

/* ===============================================
   ONGLET TVA — Récapitulatif mensuel
   =============================================== */

var _tvaPeriode = buildSimplePeriodeState('mois');
// MOVED -> script-tva.js : navTvaMois

// MOVED -> script-tva.js : getTvaMoisStr
// MOVED -> script-tva.js : getTvaPeriodeRange
// MOVED -> script-tva.js : changerVueTVA
// MOVED -> script-tva.js : navTvaPeriode
// MOVED -> script-tva.js : reinitialiserTVAPeriode

// MOVED -> script-tva.js : afficherTva

// MOVED -> script-tva.js : supprimerSourceDepuisTVA

// MOVED -> script-exports.js : exporterTvaCSV

/* === EXPORT TVA PDF === */
// MOVED -> script-exports.js : exporterTvaPDF

/* ===============================================
   CORRECTIONS & AJOUTS — Exports + Planning + Carburant
   =============================================== */

/* --- Livraisons export suit la période --- */
var _origGenererRapportMensuel = typeof genererRapportMensuel === 'function' ? genererRapportMensuel : null;
// MOVED -> script-exports.js : genererRapportMensuelPeriode

/* --- Charges export suit le mois navigué + HT/TVA/TTC --- */
var _origExporterChargesPDF = typeof exporterChargesPDF === 'function' ? exporterChargesPDF : null;
// MOVED -> script-exports.js : exporterChargesPDFMois

/* --- Carburant export PDF avec HT/TVA/TTC --- */
// MOVED -> script-carburant.js : exporterCarburantPDF
ajouterPeriodeAbsence = function() {
  var salId = document.getElementById('absence-sal') ? document.getElementById('absence-sal').value : '';
  var type = document.getElementById('absence-type') ? document.getElementById('absence-type').value : 'travail';
  var debut = document.getElementById('absence-debut') ? document.getElementById('absence-debut').value : '';
  var fin = document.getElementById('absence-fin') ? document.getElementById('absence-fin').value : '';
  var heureDebut = document.getElementById('absence-heure-debut') ? document.getElementById('absence-heure-debut').value : '';
  var heureFin = document.getElementById('absence-heure-fin') ? document.getElementById('absence-heure-fin').value : '';
  if (!salId || !debut || !fin) { afficherToast('⚠️ Salarié, date début et date fin obligatoires','error'); return; }
  if (fin < debut) { afficherToast('⚠️ La date de fin doit être après la date de début','error'); return; }
  if (type === 'travail') {
    if (!heureDebut || !heureFin) { afficherToast('⚠️ Renseignez les heures de travail','error'); return; }
    if (calculerDureeJour(heureDebut, heureFin) <= 0) { afficherToast('⚠️ Les heures de travail sont invalides','error'); return; }
    var plannings = loadSafe('plannings', []);
    var planIndex = plannings.findIndex(function(p){ return p.salId === salId; });
    var plan = planIndex > -1 ? plannings[planIndex] : { salId: salId, salNom: '', semaine: [] };
    var sal = charger('salaries').find(function(s){ return s.id === salId; });
    plan.salNom = sal ? sal.nom : (plan.salNom || '');
    plan.semaine = Array.isArray(plan.semaine) ? plan.semaine : [];
    getDateRangeInclusive(debut, fin).forEach(function(dateObj) {
      var dayIndex = (dateObj.getDay() + 6) % 7;
      var jourNom = JOURS[dayIndex];
      var jourIndex = plan.semaine.findIndex(function(j){ return j.jour === jourNom; });
      var jourData = { jour: jourNom, travaille: true, typeJour: 'travail', heureDebut: heureDebut, heureFin: heureFin };
      if (jourIndex > -1) plan.semaine[jourIndex] = { ...plan.semaine[jourIndex], ...jourData };
      else plan.semaine.push({ ...jourData, zone: '', note: '' });
    });
    plan.mis_a_jour = new Date().toISOString();
    if (planIndex > -1) plannings[planIndex] = plan;
    else plannings.push(plan);
    localStorage.setItem('plannings', JSON.stringify(plannings));
    ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    afficherPlanning();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('✅ Horaires de travail enregistrés');
    return;
  }
  var absences = loadSafe('absences_periodes', []);
  absences.push({ id: genId(), salId: salId, type: type, debut: debut, fin: fin, creeLe: new Date().toISOString() });
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  var typeLabel = type === 'conge' ? 'Congé' : type === 'maladie' ? 'Maladie' : 'Absence';
  afficherToast('✅ ' + typeLabel + ' du ' + debut + ' au ' + fin);
};

afficherRentabilite = function() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(afficherRentabilite).catch(() => {}); return; }
  let livraisons = charger('livraisons'), pleins = charger('carburant'), entretiens = charger('entretiens'), charges = charger('charges');
  const range = getRentMoisRange();
  livraisons = livraisons.filter(l => l.date >= range.debut && l.date <= range.fin);
  pleins = pleins.filter(p => p.date >= range.debut && p.date <= range.fin);
  entretiens = entretiens.filter(e => e.date >= range.debut && e.date <= range.fin);
  charges = charges.filter(c => c.date >= range.debut && c.date <= range.fin && !['entretien', 'tva'].includes(c.categorie));
  const lbl = document.getElementById('rent-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('rent-mois-dates'); if (dates) dates.textContent = range.dates;
  const ca = livraisons.reduce((s, l) => s + getMontantHTLivraison(l), 0);
  const carb = pleins.reduce((s, p) => s + getMontantHTCarburant(p), 0);
  const entr = entretiens.reduce((s, e) => s + getMontantHTEntretien(e), 0);
  const autresCharges = charges.reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
  const dep = carb + entr + autresCharges;
  const profit = ca - dep;
  const marge = ca > 0 ? (profit / ca * 100) : 0;
  const kmLivraisons = livraisons.reduce((s, l) => s + (parseFloat(l.distance) || 0), 0);
  const kmReleves = charger('salaries').reduce((sum, sal) => {
    const entrees = charger('km_sal_' + sal.id).filter(e => (e.date || '') >= range.debut && (e.date || '') <= range.fin && e.kmArrivee != null);
    return sum + entrees.reduce((ss, e) => ss + (parseFloat(e.distance) || Math.max(0, (parseFloat(e.kmArrivee) || 0) - (parseFloat(e.kmDepart) || 0))), 0);
  }, 0);
  const km = kmLivraisons > 0 ? kmLivraisons : kmReleves;
  document.getElementById('rent-ca').textContent = euros(ca);
  document.getElementById('rent-carb').textContent = euros(carb);
  document.getElementById('rent-entretien').textContent = euros(entr);
  document.getElementById('rent-charges').textContent = euros(autresCharges);
  document.getElementById('rent-cout-km').textContent = euros(km > 0 ? dep / km : 0);
  document.getElementById('rent-profit').textContent = euros(profit);
  document.getElementById('rent-marge').textContent = marge.toFixed(1) + ' %';
  appliquerLibellesAnalyseHT();
  if (chartRentab) chartRentab.destroy();
  const isLight = document.body.classList.contains('light-mode');
  chartRentab = new Chart(document.getElementById('chartRentabilite'), {
    type: 'doughnut',
    data: { labels: ['Carburant HT', 'Entretien HT', 'Autres charges HT', 'Profit net HT'], datasets: [{ data: [carb, entr, autresCharges, Math.max(profit, 0)], backgroundColor: ['rgba(230,126,34,0.8)', 'rgba(52,152,219,0.8)', 'rgba(155,89,182,0.8)', 'rgba(46,204,113,0.8)'], borderColor: isLight ? '#ffffff' : '#1a1d27', borderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: isLight ? '#1a1d27' : '#e8eaf0' } }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${euros(ctx.parsed || 0)}` } } } }
  });
};

afficherStatistiques = function() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(afficherStatistiques).catch(() => {}); return; }
  const isLight = document.body.classList.contains('light-mode');
  const tickColor = isLight ? '#334155' : '#e2e8f0';
  const gridColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.10)';
  const legendColor = isLight ? '#0f172a' : '#f8fafc';
  const range = getStatsMoisRange();
  const periodSelect = document.getElementById('vue-stats-select');
  if (periodSelect) periodSelect.value = _statsPeriode.mode;
  const dateMinStr = range.debut;
  const dateMaxStr = range.fin;
  const livraisons = charger('livraisons');
  const livsFiltrees = livraisons.filter(l => l.date >= dateMinStr && l.date <= dateMaxStr);
  const lbl = document.getElementById('stats-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('stats-mois-dates'); if (dates) dates.textContent = range.dates;
  const caPeriode = livsFiltrees.reduce((s, l) => s + getMontantHTLivraison(l), 0);
  const nbLivs = livsFiltrees.length;
  const panierMoy = nbLivs > 0 ? caPeriode / nbLivs : 0;
  const kmTotal = livsFiltrees.reduce((s, l) => s + (parseFloat(l.distance) || 0), 0);
  const el1 = document.getElementById('stats-ca-periode'); if (el1) el1.textContent = euros(caPeriode);
  const el2 = document.getElementById('stats-livraisons-periode'); if (el2) el2.textContent = nbLivs;
  const el3 = document.getElementById('stats-panier-moyen'); if (el3) el3.textContent = euros(panierMoy);
  const el4 = document.getElementById('stats-km-total'); if (el4) el4.textContent = Math.round(kmTotal) + ' km';
  appliquerLibellesAnalyseHT();
  const labels = [];
  const donnees = [];
  getDateRangeInclusive(dateMinStr, dateMaxStr).forEach(function(dateObj) {
    const ds = dateObj.toLocalISODate();
    labels.push(dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    donnees.push(livsFiltrees.filter(l => l.date === ds).reduce((s, l) => s + getMontantHTLivraison(l), 0));
  });
  if (chartCA) chartCA.destroy();
  chartCA = new Chart(document.getElementById('chartCA'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'CA HT (€)', data: donnees, borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#4f8ef7', borderWidth: 2.5 }] },
    options: { responsive: true, plugins: { legend: { labels: { color: legendColor } } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 12 } }, y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => euros(v) } } } }
  });
  const ch = charger('chauffeurs');
  if (chartChauff) chartChauff.destroy();
  const chData = ch.length ? ch.map(c => ({ nom: c.nom, nb: livsFiltrees.filter(l => l.chaufId === c.id).length })).sort((a, b) => b.nb - a.nb) : [{ nom: 'Aucun', nb: 0 }];
  chartChauff = new Chart(document.getElementById('chartChauffeurs'), {
    type: 'bar',
    data: { labels: chData.map(c => c.nom), datasets: [{ label: 'Livraisons', data: chData.map(c => c.nb), backgroundColor: 'rgba(155,89,182,0.65)', borderColor: 'rgba(155,89,182,1)', borderWidth: 1.5, borderRadius: 8 }] },
    options: { indexAxis: 'horizontal', responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor } }, y: { grid: { color: gridColor }, ticks: { color: tickColor } } } }
  });
  const veh = charger('vehicules');
  if (chartVeh) chartVeh.destroy();
  const vehData = veh.length ? veh.map(v => ({ nom: v.immat, nb: livsFiltrees.filter(l => l.vehId === v.id).length })).sort((a, b) => b.nb - a.nb) : [{ nom: 'Aucun', nb: 0 }];
  chartVeh = new Chart(document.getElementById('chartVehicules'), {
    type: 'bar',
    data: { labels: vehData.map(v => v.nom), datasets: [{ label: 'Livraisons', data: vehData.map(v => v.nb), backgroundColor: 'rgba(230,126,34,0.65)', borderColor: 'rgba(230,126,34,1)', borderWidth: 1.5, borderRadius: 8 }] },
    options: { indexAxis: 'horizontal', responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor } }, y: { grid: { color: gridColor }, ticks: { color: tickColor } } } }
  });
  if (chartCAParChauff) chartCAParChauff.destroy();
  const caChData = ch.length ? ch.map(c => ({ nom: c.nom, ca: livsFiltrees.filter(l => l.chaufId === c.id).reduce((s, l) => s + getMontantHTLivraison(l), 0) })).sort((a, b) => b.ca - a.ca) : [{ nom: 'Aucun', ca: 0 }];
  const ctxCA = document.getElementById('chartCAParChauffeur');
  if (ctxCA) {
    chartCAParChauff = new Chart(ctxCA, {
      type: 'doughnut',
      data: { labels: caChData.map(c => c.nom), datasets: [{ data: caChData.map(c => c.ca), backgroundColor: ['rgba(79,142,247,0.7)', 'rgba(245,166,35,0.7)', 'rgba(46,204,113,0.7)', 'rgba(155,89,182,0.7)', 'rgba(231,76,60,0.7)', 'rgba(52,152,219,0.7)', 'rgba(230,126,34,0.7)'], borderColor: isLight ? '#fff' : '#1a1d27', borderWidth: 3 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: legendColor } }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${euros(ctx.parsed || 0)}` } } } }
    });
  }
};

afficherPlanningSemaine = function() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var planningRange = getPeriodeRange(_planningPeriode.mode, _planningPeriode.offset);
  var planningSelect = document.getElementById('vue-planning-select');
  if (planningSelect) planningSelect.value = _planningPeriode.mode;
  var salaries = charger('salaries');
  var plannings = loadSafe('plannings', []);
  var absences = loadSafe('absences_periodes', []);
  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var labelSemaine = planningRange.label || ('Semaine ' + getNumSemaine(lundi) + ' — ' + lundi.getFullYear());
  var labelDates = planningRange.datesLabel || ('Du ' + formatPeriodeDateFr(lundi) + ' au ' + formatPeriodeDateFr(dimanche));
  var elLabel = document.getElementById('planning-semaine-label');
  var elDates = document.getElementById('planning-semaine-dates');
  if (elLabel) elLabel.textContent = labelSemaine;
  if (elDates) elDates.textContent = labelDates;

  initFormulairePlanningRapide();

  var thead = document.getElementById('thead-planning-semaine');
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + datesSemaine.map(function(d,i) {
      var isAuj = dateToLocalISO(d) === aujourdhui();
      return '<th style="text-align:center;' + (isAuj ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[i] + ' ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '</th>';
    }).join('') + '</tr>';
  }

  var tb = document.getElementById('tb-planning-semaine');
  if (!tb) return;
  if (!salaries.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>'; return; }

  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var salariesFiltres = salaries.filter(function(s) {
    if (!filtre) return true;
    return [s.nom, s.prenom, s.nomFamille, s.numero, s.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });

  var totalPlanifies = 0;
  var totalAbsences = 0;
  salariesFiltres.forEach(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var aUnJourTravaille = false;
    datesSemaine.forEach(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = absences.find(function(a) { return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin; });
      if (absJour) totalAbsences++;
      var jour = plan ? (plan.semaine||[]).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (jour && jour.travaille) aUnJourTravaille = true;
    });
    if (aUnJourTravaille) totalPlanifies++;
  });

  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
  if (!salariesFiltres.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>'; return; }

  var typeIcons = { travail:'🟢', repos:'⚪', conge:'🔵', absence:'🟡', maladie:'🟣' };
  const renderPlanningCell = function(className, title, detail, note) {
    return '<td><div class="planning-week-state ' + className + '"><span>' + title + '</span>' + (detail ? '<span class="planning-week-time">' + detail + '</span>' : '') + (note ? '<span class="planning-week-note">' + note + '</span>' : '') + '</div></td>';
  };

  tb.innerHTML = salariesFiltres.map(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var cellules = datesSemaine.map(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = absences.find(function(a) { return a.salId === s.id && dateStr >= a.debut && dateStr <= a.fin; });
      if (absJour) {
        var labelAbs = absJour.type === 'conge' ? 'Congé' : absJour.type === 'maladie' ? 'Maladie' : 'Absence';
        return renderCell('is-' + absJour.type, (typeIcons[absJour.type] || '🟡') + ' ' + labelAbs, '', '');
      }

      var jour = plan ? (plan.semaine||[]).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (!jour || !jour.travaille) {
        if (jour && ['conge','absence','maladie'].includes(jour.typeJour)) {
          var lb = jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence';
          return renderCell('is-' + jour.typeJour, (typeIcons[jour.typeJour] || '⚪') + ' ' + lb, '', '');
        }
        return renderCell('is-rest', '⚪ Repos', '', '');
      }

      return renderCell('is-work', '🟢 Travail', (jour.heureDebut||'') + (jour.heureFin ? ' – ' + jour.heureFin : ''), jour.zone || '');
    }).join('');

    return '<tr><td><div class="planning-week-salarie"><strong>' + s.nom + '</strong>' + (s.poste ? '<span class="planning-week-meta">' + s.poste + '</span>' : '') + (s.numero ? '<span class="planning-week-meta">#' + s.numero + '</span>' : '') + '</div></td>' + cellules + '</tr>';
  }).join('');
};
window.__adminFinalLock = function() {
  ouvrirFenetreImpression = function(titre, html, options) {
    const win = ouvrirPopupSecure('', '_blank', options || 'width=900,height=700');
    if (!win) return;
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>body{margin:0;padding:20px;background:#fff;font-family:Segoe UI,Arial,sans-serif}.export-logo{width:58px;height:58px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:6px}@page{margin:12mm}</style></head><body>' + html + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});<\/script></body></html>');
    win.document.close();
  };

  // construireEnteteExport : ancienne définition supprimée (code mort —
  // écrasée par les redéfinitions ultérieures du fichier).

  peuplerAbsenceSal = function() { planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist'); };
  filtrerRechercheAbsence = function() {
    var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
    if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
  };
  peuplerSelectPlanningModal = function() { planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist'); };
  filtrerRecherchePlanningModal = function() {
    var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
    if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
  };

  badgePaiementLivraisonHtml = function(statut) {
    return {
      'payé': '<span class="badge badge-dispo">Payé</span>',
      'en-attente': '<span class="badge badge-attente">En attente</span>',
      'litige': '<span class="badge badge-inactif">Litige</span>'
    }[statut || 'en-attente'] || '<span class="badge badge-attente">En attente</span>';
  };

  window.renderLivraisonsAdminFinal = function() {
    let livraisons = charger('livraisons');
    const tb = document.getElementById('tb-livraisons');
    const filtreStatut = document.getElementById('filtre-statut')?.value || '';
    const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
    const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
    const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
    const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
    const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';
    const selChauf = document.getElementById('filtre-chauffeur');

    if (selChauf) {
      const currentValue = selChauf.value;
      selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
      charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
      selChauf.value = currentValue;
    }

    if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
    if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
    if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
    if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
    if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
    if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
    livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

    if (!tb) return;
    if (!livraisons.length) {
      tb.innerHTML = '<tr><td colspan="12" class="empty-row">Aucune livraison</td></tr>';
      return;
    }

    const escapeAttr = window.escapeAttr;
    const escapeHtml = window.escapeHtml;
    const formatClientLabel = function(value) {
      var raw = String(value || '').trim();
      if (!raw) return '—';
      return /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
    };
    const formatArchivedDriverHtml = function(value) {
      var raw = String(value || '').trim();
      if (!raw) return '<span class="livraison-cell-text livraison-driver-text">Non assigné</span>';
      var archived = /\s*\(archivé\)\s*$/i.test(raw);
      var clean = raw.replace(/\s*\(archivé\)\s*$/i, '').trim();
      var safeClean = escapeHtml(clean || raw);
      if (!archived) return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '</span>';
      return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '<span class="livraison-archived-badge">archivé</span></span>';
    };

    tb.innerHTML = livraisons.map(l => {
      const ht = getMontantHTLivraison(l);
      const tva = (parseFloat(l.prix) || 0) - ht;
      const ttc = parseFloat(l.prix) || 0;
      const statutPaiement = l.statutPaiement || 'en-attente';
      const selectStatutPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('statut', l.statut) + '" onchange="changerStatutLivraison(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'statut\')"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>Livré</option></select>';
      const selectPaiementPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('paiement', statutPaiement) + '" onchange="changerStatutPaiement(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'paiement\')"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="payé" ' + (statutPaiement === 'payé' ? 'selected' : '') + '>Payé</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
      const client = formatClientLabel(l.client || '—');
      const clientText = escapeHtml(client);
      const depart = l.depart || '';
      const arrivee = l.arrivee || '';
      const zoneGeo = depart && arrivee && depart !== arrivee ? depart + ' → ' + arrivee : (arrivee || depart || '—');
      const zoneGeoText = escapeHtml(zoneGeo || '—');
      const chauffeur = l.chaufNom || 'Non assigné';
      const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
      return `<tr>
        <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
        <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(client)}">${clientText}</strong></td>
        <td><span class="livraison-cell-text livraison-zone-text" title="${escapeAttr(zoneGeo || '—')}">${zoneGeoText}</span></td>
        <td class="livraison-number-cell">${l.distance ? formatKm(l.distance) : '—'}</td>
        <td class="livraison-number-cell">${euros(ht)}</td>
        <td class="livraison-number-cell livraison-muted-cell">${euros(tva)}</td>
        <td class="livraison-number-cell livraison-total-cell">${euros(ttc)}</td>
        <td>${formatArchivedDriverHtml(chauffeur)}</td>
        <td><div class="livraison-select-cell">${selectStatutPropre}</div></td>
        <td><div class="livraison-select-cell">${selectPaiementPropre}</div></td>
        <td class="livraison-number-cell">${datePaiement}</td>
        <td class="actions-cell">${buildInlineActionsDropdown('Actions', [
          { icon:'✏️', label:'Modifier', action:"ouvrirEditLivraison('" + l.id + "')" },
          { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
          { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
          { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
          { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
        ])}</td>
      </tr>`;
    }).join('');
  }

  afficherLivraisons = window.renderLivraisonsAdminFinal;
};
/* ===== FINAL ADMIN LOCK ===== */
ouvrirFenetreImpression = function(titre, html, options) {
  const win = ouvrirPopupSecure('', '_blank', options || 'width=900,height=700');
  if (!win) return;
  win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + titre + '</title><style>html,body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}body{padding:20px}.export-logo{width:58px;height:58px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:6px}table,thead,tbody,tr,th,td,div,span{print-color-adjust:exact !important;-webkit-print-color-adjust:exact !important}@page{margin:12mm}</style></head><body>' + html + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});<\/script></body></html>');
  win.document.close();
};

construireEnteteExport = function(params, titre, sousTitre, dateExp, metaCustom) {
  // En-tête PDF UNIFIÉ — template aligné sur le rapport Livraisons (référence).
  // - Bloc gauche : nom entreprise (orange) + adresse + mentions légales + titre+période
  // - Bloc droit : date de génération + métadonnées custom (ex: '3 livraison(s)…')
  // - Ligne orange séparatrice
  var esc = (typeof planningEscapeHtml === 'function')
    ? planningEscapeHtml
    : function(v){ return String(v || '').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var siege = [params.adresse, ((params.codePostal || '') + ' ' + (params.ville || '')).trim()]
    .filter(Boolean).map(esc).join(' · ');
  var mentionsLegales = (typeof renderFactureMentionsEntrepriseHeader === 'function')
    ? renderFactureMentionsEntrepriseHeader(params)
    : '';
  var titreLigne = '';
  if (titre || sousTitre) {
    var inner = esc(titre || '') + (sousTitre ? ' — ' + esc(sousTitre) : '');
    titreLigne = '<div style="font-size:.82rem;color:#111827;margin-top:8px;font-weight:600">' + inner + '</div>';
  }
  var blocGauche = '<div>'
    + '<div style="font-size:1.4rem;font-weight:900;color:#f5a623">' + esc(params.nom || 'MCA LOGISTICS') + '</div>'
    + (siege ? '<div style="font-size:.78rem;color:#6b7280;margin-top:2px">' + siege + '</div>' : '')
    + mentionsLegales
    + titreLigne
    + '</div>';
  var blocDroit = '<div style="text-align:right;font-size:.82rem;color:#6b7280">'
    + (dateExp ? '<div>Généré le <strong>' + esc(dateExp) + '</strong></div>' : '')
    + (metaCustom ? '<div style="margin-top:2px">' + metaCustom + '</div>' : '')
    + '</div>';
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:14px;border-bottom:2px solid #f5a623;margin-bottom:22px">'
    + blocGauche + blocDroit
    + '</div>';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRechercheAbsence = function() {
  var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
};

filtrerRecherchePlanningModal = function() {
  var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
  if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
};

badgePaiementLivraisonHtml = function(statut) {
  return {
    'payé': '<span class="badge badge-dispo">Payé</span>',
    'en-attente': '<span class="badge badge-attente">En attente</span>',
    'litige': '<span class="badge badge-inactif">Litige</span>'
  }[statut || 'en-attente'] || '<span class="badge badge-attente">En attente</span>';
};

const __finalLabelStatutLivraison = function(statut) {
  return statut === 'livre' ? 'Livré' : statut === 'en-cours' ? 'En cours' : 'En attente';
};

labelStatutLivraison = function(statut) {
  return __finalLabelStatutLivraison(statut);
};

calculerPrevision = function() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(calculerPrevision).catch(() => {}); return; }
  const livraisons = charger('livraisons');
  const carburant = charger('carburant');
  const charges = charger('charges');
  const moisReels = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toLocalISOMonth();
    const livsM = livraisons.filter(l => (l.date || '').startsWith(moisStr));
    const caM = livsM.reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const carbM = carburant.filter(p => (p.date || '').startsWith(moisStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0);
    const chargM = charges.filter(c => (c.date || '').startsWith(moisStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    moisReels.push({ mois: moisStr, ca: caM, depenses: carbM + chargM, livraisons: livsM.length });
  }
  const nbMoisDonnees = moisReels.filter(m => m.ca > 0 || m.livraisons > 0).length;
  const moyCA = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.ca, 0) / nbMoisDonnees : 0;
  const moyDep = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.depenses, 0) / nbMoisDonnees : 0;
  const moyLivs = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.livraisons, 0) / nbMoisDonnees : 0;
  const tendanceCA = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA = moyCA * (1 + tendanceCA / 100 * 0.5);
  const prevDep = moyDep;
  const prevBen = prevCA - prevDep;
  const prevMarge = prevCA > 0 ? (prevBen / prevCA * 100) : 0;
  const elCA = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elTend = document.getElementById('prev-tendance');
  if (elCA) elCA.textContent = euros(prevCA);
  if (elDep) elDep.textContent = euros(prevDep);
  if (elBen) elBen.textContent = euros(prevBen);
  if (elMrg) elMrg.textContent = prevMarge.toFixed(1) + ' %';
  if (elLiv) elLiv.textContent = Math.round(moyLivs) + ' liv. estimées';
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = 'Tendance HT : ' + signe + tendanceCA.toFixed(1) + '%';
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }
};

window.renderLivraisonsAdminFinal = function() {
  let livraisons = charger('livraisons');
  const tb = document.getElementById('tb-livraisons');
  const filtreStatut = document.getElementById('filtre-statut')?.value || '';
  const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
  const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
  const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
  const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
  const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';

  const selChauf = document.getElementById('filtre-chauffeur');
  if (selChauf) {
    const currentValue = selChauf.value;
    selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
    charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
    selChauf.value = currentValue;
  }

  if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
  if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
  if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
  if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
  if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
  if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
  livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  if (!tb) return;
  if (!livraisons.length) {
    tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
    if (typeof majBulkActions === 'function') majBulkActions();
    return;
  }

  const escapeAttr = window.escapeAttr;
  const escapeHtml = window.escapeHtml;
  const formatClientLabel = function(value) {
    var raw = String(value || '').trim();
    if (!raw) return '—';
    return /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
  };
  const formatArchivedDriverHtml = function(value) {
    var raw = String(value || '').trim();
    if (!raw) return '<span class="livraison-cell-text livraison-driver-text">Non assigné</span>';
    var archived = /\s*\(archivé\)\s*$/i.test(raw);
    var clean = raw.replace(/\s*\(archivé\)\s*$/i, '').trim();
    var safeClean = escapeHtml(clean || raw);
    if (!archived) return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '</span>';
    return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '<span class="livraison-archived-badge">archivé</span></span>';
  };

  tb.innerHTML = livraisons.map(l => {
    const ht = getMontantHTLivraison(l);
    const tva = (parseFloat(l.prix) || 0) - ht;
    const ttc = parseFloat(l.prix) || 0;
    const statutPaiement = l.statutPaiement || 'en-attente';
    const selectStatutPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('statut', l.statut) + '" onchange="changerStatutLivraison(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'statut\')"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>Livré</option></select>';
    const selectPaiementPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('paiement', statutPaiement) + '" onchange="changerStatutPaiement(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'paiement\')"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="payé" ' + (statutPaiement === 'payé' ? 'selected' : '') + '>Payé</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
    const client = formatClientLabel(l.client || '—');
    const clientText = escapeHtml(client);
    const depart = l.depart || '';
    const arrivee = l.arrivee || '';
    const zoneGeo = depart && arrivee && depart !== arrivee
      ? depart + ' → ' + arrivee
      : (arrivee || depart || '—');
    const zoneGeoText = escapeHtml(zoneGeo || '—');
    const chauffeur = l.chaufNom || 'Non assigné';
    const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
    return `<tr data-liv-id="${escapeAttr(l.id)}">
      <td class="bulk-col"><input type="checkbox" class="bulk-liv-check" data-liv-id="${escapeAttr(l.id)}" onchange="majBulkActions()" aria-label="Sélectionner" /></td>
      <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
      <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(client)}">${clientText}</strong></td>
      <td><span class="livraison-cell-text livraison-zone-text" title="${escapeAttr(zoneGeo || '—')}">${zoneGeoText}</span></td>
      <td class="livraison-number-cell">${l.distance ? formatKm(l.distance) : '—'}</td>
      <td class="livraison-number-cell">${euros(ht)}</td>
      <td class="livraison-number-cell livraison-muted-cell">${euros(tva)}</td>
      <td class="livraison-number-cell livraison-total-cell">${euros(ttc)}</td>
      <td>${formatArchivedDriverHtml(chauffeur)}</td>
      <td><div class="livraison-select-cell">${selectStatutPropre}</div></td>
      <td><div class="livraison-select-cell">${selectPaiementPropre}</div></td>
      <td class="livraison-number-cell">${datePaiement}</td>
      <td class="actions-cell">${buildInlineActionsDropdown('Actions', [
        { icon:'✏️', label:'Modifier', action:"ouvrirEditLivraison('" + l.id + "')" },
        { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
        { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
        { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
        { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
      ])}</td>
    </tr>`;
  }).join('');
  if (typeof majBulkActions === 'function') majBulkActions();
};
afficherLivraisons = window.renderLivraisonsAdminFinal;

/* ===== ADMIN FINAL UX / EXPORTS ===== */
const labelPaiementLivraison = function(statut) {
  return statut === 'payé' ? 'Payé' : statut === 'litige' ? 'Litige' : 'En attente';
};

const labelStatutLivraisonLisible = function(statut) {
  return statut === 'livre' ? 'Livré' : statut === 'en-cours' ? 'En cours' : 'En attente';
};

planningSyncSearchWithSelect = function(searchId, selectId, datalistId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  var datalist = document.getElementById(datalistId);
  var salaries = charger('salaries');
  var query = (search?.value || '').trim().toLowerCase();
  var currentValue = select?.value || '';
  var filtered = salaries.filter(function(s) {
    if (!query) return true;
    return [planningBuildEmployeeLabel(s), s.nom, s.prenom, s.nomFamille, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(query);
  });
  if (select) {
    select.innerHTML = '<option value="">-- Choisir un salarié --</option>';
    filtered.forEach(function(s) {
      select.innerHTML += '<option value="' + s.id + '">' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '</option>';
    });
    if (filtered.some(function(s) { return s.id === currentValue; })) select.value = currentValue;
  }
  if (datalist) {
    datalist.innerHTML = salaries.map(function(s) {
      return '<option value="' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '"></option>';
    }).join('');
  }
};

filtrerRechercheAbsence = function() {
  var found = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!found) planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRecherchePlanningModal = function() {
  var found = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!found) planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
  if (document.getElementById('plan-salarie')?.value) genererGrilleJours();
};

construireEnteteExport = function(params, titre, sousTitre, dateExp, metaCustom) {
  // En-tête PDF UNIFIÉ — template aligné sur le rapport Livraisons (référence).
  // - Bloc gauche : nom entreprise (orange) + adresse + mentions légales + titre+période
  // - Bloc droit : date de génération + métadonnées custom (ex: '3 livraison(s)…')
  // - Ligne orange séparatrice
  var esc = (typeof planningEscapeHtml === 'function')
    ? planningEscapeHtml
    : function(v){ return String(v || '').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var siege = [params.adresse, ((params.codePostal || '') + ' ' + (params.ville || '')).trim()]
    .filter(Boolean).map(esc).join(' · ');
  var mentionsLegales = (typeof renderFactureMentionsEntrepriseHeader === 'function')
    ? renderFactureMentionsEntrepriseHeader(params)
    : '';
  var titreLigne = '';
  if (titre || sousTitre) {
    var inner = esc(titre || '') + (sousTitre ? ' — ' + esc(sousTitre) : '');
    titreLigne = '<div style="font-size:.82rem;color:#111827;margin-top:8px;font-weight:600">' + inner + '</div>';
  }
  var blocGauche = '<div>'
    + '<div style="font-size:1.4rem;font-weight:900;color:#f5a623">' + esc(params.nom || 'MCA LOGISTICS') + '</div>'
    + (siege ? '<div style="font-size:.78rem;color:#6b7280;margin-top:2px">' + siege + '</div>' : '')
    + mentionsLegales
    + titreLigne
    + '</div>';
  var blocDroit = '<div style="text-align:right;font-size:.82rem;color:#6b7280">'
    + (dateExp ? '<div>Généré le <strong>' + esc(dateExp) + '</strong></div>' : '')
    + (metaCustom ? '<div style="margin-top:2px">' + metaCustom + '</div>' : '')
    + '</div>';
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:14px;border-bottom:2px solid #f5a623;margin-bottom:22px">'
    + blocGauche + blocDroit
    + '</div>';
};

badgePaiementLivraisonHtml = function(statut) {
  return {
    'payé': '<span class="badge badge-dispo">Payé</span>',
    'en-attente': '<span class="badge badge-attente">En attente</span>',
    'litige': '<span class="badge badge-inactif">Litige</span>'
  }[statut || 'en-attente'] || '<span class="badge badge-attente">En attente</span>';
};

labelStatutLivraison = function(statut) {
  return labelStatutLivraisonLisible(statut);
};

calculerPrevision = function() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(calculerPrevision).catch(() => {}); return; }
  const livraisons = charger('livraisons');
  const carburant = charger('carburant');
  const charges = charger('charges');
  const moisReels = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toLocalISOMonth();
    const livsM = livraisons.filter(l => (l.date || '').startsWith(moisStr));
    const caM = livsM.reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const carbM = carburant.filter(p => (p.date || '').startsWith(moisStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0);
    const chargM = charges.filter(c => (c.date || '').startsWith(moisStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    moisReels.push({ mois: moisStr, ca: caM, depenses: carbM + chargM, livraisons: livsM.length });
  }
  const nbMoisDonnees = moisReels.filter(m => m.ca > 0 || m.livraisons > 0).length;
  const moyCA = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.ca, 0) / nbMoisDonnees : 0;
  const moyDep = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.depenses, 0) / nbMoisDonnees : 0;
  const moyLivs = nbMoisDonnees > 0 ? moisReels.slice(0, nbMoisDonnees).reduce((s, m) => s + m.livraisons, 0) / nbMoisDonnees : 0;
  const tendanceCA = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA = moyCA * (1 + tendanceCA / 100 * 0.5);
  const prevDep = moyDep;
  const prevBen = prevCA - prevDep;
  const prevMarge = prevCA > 0 ? (prevBen / prevCA * 100) : 0;
  const elCA = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elTend = document.getElementById('prev-tendance');
  if (elCA) elCA.textContent = euros(prevCA);
  if (elDep) elDep.textContent = euros(prevDep);
  if (elBen) elBen.textContent = euros(prevBen);
  if (elMrg) elMrg.textContent = prevMarge.toFixed(1) + ' %';
  if (elLiv) elLiv.textContent = Math.round(moyLivs) + ' liv. estimées';
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = 'Tendance HT : ' + signe + tendanceCA.toFixed(1) + '%';
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }
  const labels = [], dataCA = [], dataBen = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mStr = d.toLocalISOMonth();
    const caM = livraisons.filter(l => (l.date || '').startsWith(mStr)).reduce((s, l) => s + getMontantHTLivraison(l), 0);
    const depM = carburant.filter(p => (p.date || '').startsWith(mStr)).reduce((s, p) => s + getMontantHTCarburant(p), 0)
      + charges.filter(c => (c.date || '').startsWith(mStr)).reduce((s, c) => s + (parseFloat(c.montantHT) || ((parseFloat(c.montant) || 0) / (1 + (parseFloat(c.tauxTVA) || 0) / 100))), 0);
    labels.push(d.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }));
    dataCA.push(caM);
    dataBen.push(caM - depM);
  }
  const dNext = new Date(); dNext.setMonth(dNext.getMonth() + 1);
  labels.push(dNext.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }) + ' *');
  dataCA.push(Math.round(prevCA));
  dataBen.push(Math.round(prevBen));
  if (chartPrev) chartPrev.destroy();
  const ctx = document.getElementById('chartPrevision');
  if (!ctx) return;
  chartPrev = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'CA réel HT (€)', data:dataCA.slice(0,-1).concat([null]), backgroundColor:'rgba(79,142,247,0.4)', borderColor:'rgba(79,142,247,0.9)', borderWidth:2, borderRadius:6 },
        { label:'CA prévu HT (€)', data:Array(6).fill(null).concat([dataCA[6]]), backgroundColor:'rgba(245,166,35,0.3)', borderColor:'rgba(245,166,35,0.9)', borderWidth:2, borderRadius:6, borderDash:[5,5] },
        { label:'Bénéfice net HT (€)', data:dataBen.slice(0,-1).concat([null]), type:'line', borderColor:'#2ecc71', backgroundColor:'rgba(46,204,113,0.1)', fill:true, tension:0.4, pointRadius:4 }
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#e8eaf0' } }, tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${euros(ctx.parsed.y||0)}` } } },
      scales:{ x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299'} }, y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299', callback:v=>euros(v)} } }
    }
  });
};

afficherLivraisons = window.renderLivraisonsAdminFinal;

window.__planningRewriteFinal = function() {
  toggleAbsenceTypeFields = function() {
    var type = document.getElementById('absence-type')?.value || 'travail';
    var startWrap = document.getElementById('absence-heure-debut-wrap');
    var endWrap = document.getElementById('absence-heure-fin-wrap');
    if (startWrap) startWrap.style.display = type === 'travail' ? '' : 'none';
    if (endWrap) endWrap.style.display = type === 'travail' ? '' : 'none';
  };

  peuplerAbsenceSal = function() { planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist'); };
  filtrerRechercheAbsence = function() { planningResolveSelectedEmployee('absence-sal-search', 'absence-sal'); };
  peuplerSelectPlanningModal = function() { planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist'); };
  filtrerRecherchePlanningModal = function() {
    var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (salarie) genererGrilleJours();
  };

  mettreAJourTotalHeuresPlanning = function() {
    var total = 0;
    JOURS.forEach(function(jour) {
      if ((document.getElementById('plan-type-' + jour)?.value || 'repos') !== 'travail') return;
      total += calculerDureeJour(document.getElementById('plan-debut-' + jour)?.value || '', document.getElementById('plan-fin-' + jour)?.value || '');
    });
    var el = document.getElementById('plan-total-heures');
    if (el) el.textContent = total.toFixed(1) + ' h';
  };

  toggleTypeJour = function(jour) {
    var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
    var horaires = document.getElementById('plan-horaires-' + jour);
    if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
    mettreAJourTotalHeuresPlanning();
  };

  genererGrilleJours = function() {
    var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    var grid = document.getElementById('plan-jours-grid');
    if (!grid) return;
    if (!salarie) {
      grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
      mettreAJourTotalHeuresPlanning();
      return;
    }
    var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; }) || { semaine: [] };
    grid.innerHTML = JOURS.map(function(jour, index) {
      var data = (planning.semaine || []).find(function(item) { return item.jour === jour; }) || {};
      var typeJour = data.typeJour || (data.travaille ? 'travail' : 'repos');
      return '<div class="planning-day-editor"><div class="planning-day-top"><div class="planning-day-title">' + JOURS_COURTS[index] + ' - ' + jour.charAt(0).toUpperCase() + jour.slice(1) + '</div><select id="plan-type-' + jour + '" onchange="toggleTypeJour(\'' + jour + '\')"><option value="travail"' + (typeJour === 'travail' ? ' selected' : '') + '>Travail</option><option value="repos"' + (typeJour === 'repos' ? ' selected' : '') + '>Repos</option><option value="conge"' + (typeJour === 'conge' ? ' selected' : '') + '>Congé</option><option value="absence"' + (typeJour === 'absence' ? ' selected' : '') + '>Absence</option><option value="maladie"' + (typeJour === 'maladie' ? ' selected' : '') + '>Maladie</option></select></div><div class="planning-day-grid" id="plan-horaires-' + jour + '" style="display:' + (typeJour === 'travail' ? 'grid' : 'none') + '"><div><label>Début</label><input type="time" id="plan-debut-' + jour + '" value="' + (data.heureDebut || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div><div><label>Fin</label><input type="time" id="plan-fin-' + jour + '" value="' + (data.heureFin || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div><div><label>Zone</label><input type="text" id="plan-zone-' + jour + '" value="' + ((data.zone || '').replace(/"/g, '&quot;')) + '" placeholder="Tournée, secteur..." /></div><div class="wide"><label>Note</label><input type="text" id="plan-note-' + jour + '" value="' + ((data.note || '').replace(/"/g, '&quot;')) + '" placeholder="Information utile..." /></div></div></div>';
    }).join('');
    mettreAJourTotalHeuresPlanning();
  };

  ouvrirModalPlanning = function() {
    peuplerSelectPlanningModal();
    var search = document.getElementById('plan-salarie-search');
    var select = document.getElementById('plan-salarie');
    var grid = document.getElementById('plan-jours-grid');
    if (search) search.value = '';
    if (select) select.value = '';
    if (grid) grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
    mettreAJourTotalHeuresPlanning();
    openModal('modal-planning');
  };

  ouvrirEditPlanning = function(salId) {
    peuplerSelectPlanningModal();
    var select = document.getElementById('plan-salarie');
    var search = document.getElementById('plan-salarie-search');
    var salarie = charger('salaries').find(function(s) { return s.id === salId; });
    if (select) select.value = salId;
    if (search && salarie) search.value = planningBuildEmployeeLabel(salarie);
    genererGrilleJours();
    openModal('modal-planning');
  };

  sauvegarderPlanning = function() {
    var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (!salarie) return afficherToast('Choisis un salarié', 'error');
    var planning = { salId: salarie.id, salNom: salarie.nom || '', semaine: JOURS.map(function(jour) {
      var typeJour = document.getElementById('plan-type-' + jour)?.value || 'repos';
      return { jour: jour, travaille: typeJour === 'travail', typeJour: typeJour, heureDebut: typeJour === 'travail' ? (document.getElementById('plan-debut-' + jour)?.value || '') : '', heureFin: typeJour === 'travail' ? (document.getElementById('plan-fin-' + jour)?.value || '') : '', zone: typeJour === 'travail' ? (document.getElementById('plan-zone-' + jour)?.value || '') : '', note: typeJour === 'travail' ? (document.getElementById('plan-note-' + jour)?.value || '') : '' };
    }), mis_a_jour: new Date().toISOString() };
    if (planning.semaine.some(function(j) { return j.typeJour === 'travail' && j.heureDebut && j.heureFin && calculerDureeJour(j.heureDebut, j.heureFin) <= 0; })) return afficherToast('Certaines heures sont invalides', 'error');
    var plannings = charger('plannings');
    var index = plannings.findIndex(function(p) { return p.salId === salarie.id; });
    if (index > -1) plannings[index] = planning; else plannings.push(planning);
    sauvegarder('plannings', plannings);
    closeModal('modal-planning');
    afficherPlanning();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Planning enregistré');
  };

  supprimerPlanning = async function(salId) {
    var ok = await confirmDialog('Supprimer le planning hebdomadaire de ce salarié ?', { titre:'Supprimer le planning', icone:'📅', btnLabel:'Supprimer' });
    if (!ok) return;
    sauvegarder('plannings', charger('plannings').filter(function(p) { return p.salId !== salId; }));
    afficherPlanning();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Planning supprimé');
  };

  copierSemainePrecedente = function() {
    var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
    if (!salarie) return afficherToast('Choisis un salarié', 'error');
    var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; });
    if (!planning || !planning.semaine || !planning.semaine.length) return afficherToast('Aucun planning existant à copier', 'error');
    genererGrilleJours();
  };

  afficherPlanning = function() { peuplerSelectPlanningModal(); };

  reinitialiserFormulairePlanningRapide = function() {
    ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
    if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    if (document.getElementById('absence-type')) document.getElementById('absence-type').value = 'travail';
    if (document.getElementById('planning-submit-btn')) document.getElementById('planning-submit-btn').textContent = '+ Enregistrer';
    toggleAbsenceTypeFields();
  };

  initFormulairePlanningRapide = function() { peuplerAbsenceSal(); toggleAbsenceTypeFields(); };

  ajouterPeriodeAbsence = function() {
    var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
    var type = document.getElementById('absence-type')?.value || 'travail';
    var debut = document.getElementById('absence-debut')?.value || '';
    var fin = document.getElementById('absence-fin')?.value || '';
    var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
    var heureFin = document.getElementById('absence-heure-fin')?.value || '';
    var editId = document.getElementById('absence-edit-id')?.value || '';
    if (!salarie || !debut || !fin) return afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
    if (fin < debut) return afficherToast('La date de fin doit être postérieure à la date de début', 'error');
    if (type === 'travail') {
      if (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0) return afficherToast('Renseigne des horaires valides', 'error');
      var plannings = charger('plannings');
      var indexPlan = plannings.findIndex(function(p) { return p.salId === salarie.id; });
      var planning = indexPlan > -1 ? plannings[indexPlan] : { salId: salarie.id, salNom: salarie.nom || '', semaine: [] };
      planning.salNom = salarie.nom || '';
      planning.semaine = Array.isArray(planning.semaine) ? planning.semaine : [];
      getDateRangeInclusive(debut, fin).forEach(function(dateObj) {
        var jourNom = JOURS[(dateObj.getDay() + 6) % 7];
        var indexJour = planning.semaine.findIndex(function(j) { return j.jour === jourNom; });
        var dataJour = { jour: jourNom, travaille: true, typeJour: 'travail', heureDebut: heureDebut, heureFin: heureFin, zone: indexJour > -1 ? (planning.semaine[indexJour].zone || '') : '', note: indexJour > -1 ? (planning.semaine[indexJour].note || '') : '' };
        if (indexJour > -1) planning.semaine[indexJour] = { ...planning.semaine[indexJour], ...dataJour }; else planning.semaine.push(dataJour);
      });
      planning.mis_a_jour = new Date().toISOString();
      if (indexPlan > -1) plannings[indexPlan] = planning; else plannings.push(planning);
      sauvegarder('plannings', plannings);
      reinitialiserFormulairePlanningRapide();
      afficherPlanningSemaine();
      afficherCompteurHeures();
      return afficherToast('Créneau de travail enregistré');
    }
    var absences = charger('absences_periodes');
    var payload = { id: editId || genId(), salId: salarie.id, salNom: salarie.nom || '', type: type, debut: debut, fin: fin, creeLe: editId ? (absences.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(), modifieLe: new Date().toISOString() };
    var indexAbs = absences.findIndex(function(a) { return a.id === payload.id; });
    if (indexAbs > -1) absences[indexAbs] = payload; else absences.push(payload);
    sauvegarder('absences_periodes', absences);
    reinitialiserFormulairePlanningRapide();
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast(editId ? 'Période mise à jour' : 'Période enregistrée');
  };

  afficherAbsencesPeriodes = function() {
    var container = document.getElementById('liste-absences-periodes');
    if (!container) return;
    var salaries = charger('salaries');
    var colors = { conge:'#3498db', maladie:'#9b59b6', absence:'#f39c12' };
    var labels = { conge:'Congé', maladie:'Maladie', absence:'Absence' };
    var absences = charger('absences_periodes').sort(function(a, b) { return new Date(b.debut) - new Date(a.debut); });
    if (!absences.length) return container.innerHTML = '<div class="planning-empty-note">Aucune période enregistrée.</div>';
    container.innerHTML = absences.map(function(absence) {
      var salarie = salaries.find(function(s) { return s.id === absence.salId; });
      var labelSal = planningBuildEmployeeLabel(salarie || { nom: absence.salNom || 'Salarié supprimé' });
      return '<div class="planning-period-item"><span class="planning-period-dot" style="background:' + (colors[absence.type] || '#f39c12') + '"></span><div class="planning-period-content"><div class="planning-period-title">' + (labels[absence.type] || 'Période') + ' - ' + labelSal + '</div><div class="planning-period-meta">Du ' + formatDateExport(absence.debut) + ' au ' + formatDateExport(absence.fin) + '</div></div><div class="planning-period-actions"><button type="button" onclick="editerPeriodeAbsence(\'' + absence.id + '\')">Modifier</button><button type="button" class="danger" onclick="supprimerAbsencePeriode(\'' + absence.id + '\')">Supprimer</button></div></div>';
    }).join('');
  };

  editerPeriodeAbsence = function(id) {
    var absence = charger('absences_periodes').find(function(a) { return a.id === id; });
    if (!absence) return;
    peuplerAbsenceSal();
    var salarie = charger('salaries').find(function(s) { return s.id === absence.salId; });
    if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = absence.id;
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = absence.salId;
    if (document.getElementById('absence-sal-search') && salarie) document.getElementById('absence-sal-search').value = planningBuildEmployeeLabel(salarie);
    if (document.getElementById('absence-type')) document.getElementById('absence-type').value = absence.type;
    if (document.getElementById('absence-debut')) document.getElementById('absence-debut').value = absence.debut;
    if (document.getElementById('absence-fin')) document.getElementById('absence-fin').value = absence.fin;
    if (document.getElementById('planning-submit-btn')) document.getElementById('planning-submit-btn').textContent = 'Mettre à jour';
    toggleAbsenceTypeFields();
  };

  supprimerAbsencePeriode = async function(id) {
    var ok = await confirmDialog('Supprimer cette période ?', { titre:'Supprimer la période', icone:'📅', btnLabel:'Supprimer' });
    if (!ok) return;
    sauvegarder('absences_periodes', charger('absences_periodes').filter(function(a) { return a.id !== id; }));
    if (document.getElementById('absence-edit-id')?.value === id) reinitialiserFormulairePlanningRapide();
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Période supprimée');
  };

  afficherPlanningSemaine = function() {
    initFormulairePlanningRapide();
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var absences = charger('absences_periodes');
    var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
    if (document.getElementById('planning-semaine-label')) document.getElementById('planning-semaine-label').textContent = 'Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear();
    if (document.getElementById('planning-semaine-dates')) document.getElementById('planning-semaine-dates').textContent = formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
    var thead = document.getElementById('thead-planning-semaine');
    var tbody = document.getElementById('tb-planning-semaine');
    if (thead) thead.innerHTML = '<tr><th>Salarié</th>' + week.dates.map(function(dateObj, index) { var isToday = dateToLocalISO(dateObj) === aujourdhui(); return '<th style="text-align:center;' + (isToday ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[index].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>'; }).join('') + '</tr>';
    if (!tbody) return;
    if (!salaries.length) return tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>';
    var filtered = salaries.filter(function(salarie) { return !filtre || [planningBuildEmployeeLabel(salarie), salarie.nom, salarie.prenom, salarie.numero, salarie.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre); });
    var totalPlanifies = 0;
    var totalAbsences = 0;
    tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var hasWork = false;
      var cells = week.dates.map(function(dateObj, index) {
        var dateStr = dateToLocalISO(dateObj);
        var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
        if (absence) { totalAbsences += 1; return planningRenderWeekState('is-' + absence.type, absence.type === 'conge' ? 'Congé' : absence.type === 'maladie' ? 'Maladie' : 'Absence', '', ''); }
        var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[index]; }) || null;
        if (!jour) return planningRenderWeekState('is-rest', 'Repos', '', '');
        if (jour.typeJour === 'travail' && jour.travaille) { hasWork = true; return planningRenderWeekState('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || jour.note || ''); }
        if (jour.typeJour === 'conge' || jour.typeJour === 'absence' || jour.typeJour === 'maladie') return planningRenderWeekState('is-' + jour.typeJour, jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence', '', '');
        return planningRenderWeekState('is-rest', 'Repos', '', '');
      }).join('');
      if (hasWork) totalPlanifies += 1;
      return '<tr><td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>' + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '') + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '') + '</div></td>' + cells + '</tr>';
    }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
    if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
    if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
    if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
    afficherAbsencesPeriodes();
  };

  filtrerPlanningSemaine = function() { afficherPlanningSemaine(); };

  exporterPlanningSemainePDF = function() {
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var absences = charger('absences_periodes');
    var params = getEntrepriseExportParams();
    var dateExp = formatDateHeureExport();
    var cols = week.dates.map(function(dateObj, index) { return '<th style="padding:8px 10px;text-align:center;color:#6b7280">' + JOURS_COURTS[index] + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>'; }).join('');
    var rows = salaries.map(function(salarie, index) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var cells = week.dates.map(function(dateObj, dayIndex) {
        var dateStr = dateToLocalISO(dateObj);
        var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
        if (absence) return '<td style="padding:8px 10px;text-align:center">' + (absence.type === 'conge' ? 'Congé' : absence.type === 'maladie' ? 'Maladie' : 'Absence') + '</td>';
        var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[dayIndex]; });
        if (!jour) return '<td style="padding:8px 10px;text-align:center">Repos</td>';
        if (jour.typeJour === 'travail' && jour.travaille) return '<td style="padding:8px 10px;text-align:center">' + (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : '') + '</td>';
        return '<td style="padding:8px 10px;text-align:center">' + (jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : jour.typeJour === 'absence' ? 'Absence' : 'Repos') + '</td>';
      }).join('');
      return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + ';border-bottom:1px solid #e5e7eb"><td style="padding:8px 10px;font-weight:600">' + (salarie.nom || '') + (salarie.numero ? '<br><span style="font-size:.75rem;color:#6b7280">#' + salarie.numero + '</span>' : '') + '</td>' + cells + '</tr>';
    }).join('');
    var html = '<html><head><meta charset="utf-8"><title>Planning hebdomadaire</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111827"><h1 style="margin:0 0 6px;font-size:22px">' + params.nom + '</h1><div style="color:#6b7280;margin-bottom:16px">Planning hebdomadaire - Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear() + '</div>' + renderBlocInfosEntreprise(params) + '<div style="margin-bottom:16px;font-size:14px;color:#374151">Période : ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche) + '</div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left">Salarié</th>' + cols + '</tr></thead><tbody>' + rows + '</tbody></table>' + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire') + '</body></html>';
    var popup = ouvrirPopupSecure('', '_blank');
    if (!popup) return afficherToast('Autorise les popups pour générer le PDF', 'error');
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(function() { popup.print(); }, 250);
    afficherToast('Rapport planning généré');
  };
};

/* ===== PLANNING REWRITE FINAL ===== */
toggleAbsenceTypeFields = function() {
  var type = document.getElementById('absence-type')?.value || 'travail';
  var startWrap = document.getElementById('absence-heure-debut-wrap');
  var endWrap = document.getElementById('absence-heure-fin-wrap');
  if (startWrap) startWrap.style.display = type === 'travail' ? '' : 'none';
  if (endWrap) endWrap.style.display = type === 'travail' ? '' : 'none';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal', 'absence-sal-datalist');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie', 'plan-salarie-datalist');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (salarie) genererGrilleJours();
};

mettreAJourTotalHeuresPlanning = function() {
  var total = 0;
  JOURS.forEach(function(jour) {
    if ((document.getElementById('plan-type-' + jour)?.value || 'repos') !== 'travail') return;
    total += calculerDureeJour(
      document.getElementById('plan-debut-' + jour)?.value || '',
      document.getElementById('plan-fin-' + jour)?.value || ''
    );
  });
  var el = document.getElementById('plan-total-heures');
  if (el) el.textContent = total.toFixed(1) + ' h';
};

toggleTypeJour = function(jour) {
  var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
  var horaires = document.getElementById('plan-horaires-' + jour);
  if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
  mettreAJourTotalHeuresPlanning();
};

genererGrilleJours = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  var grid = document.getElementById('plan-jours-grid');
  if (!grid) return;
  if (!salarie) {
    grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
    mettreAJourTotalHeuresPlanning();
    return;
  }
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; }) || { semaine: [] };
  grid.innerHTML = JOURS.map(function(jour, index) {
    var data = (planning.semaine || []).find(function(item) { return item.jour === jour; }) || {};
    var typeJour = data.typeJour || (data.travaille ? 'travail' : 'repos');
    return '<div class="planning-day-editor">'
      + '<div class="planning-day-top"><div class="planning-day-title">' + JOURS_COURTS[index] + ' - ' + jour.charAt(0).toUpperCase() + jour.slice(1) + '</div>'
      + '<select id="plan-type-' + jour + '" onchange="toggleTypeJour(\'' + jour + '\')">'
      + '<option value="travail"' + (typeJour === 'travail' ? ' selected' : '') + '>Travail</option>'
      + '<option value="repos"' + (typeJour === 'repos' ? ' selected' : '') + '>Repos</option>'
      + '<option value="conge"' + (typeJour === 'conge' ? ' selected' : '') + '>Congé</option>'
      + '<option value="absence"' + (typeJour === 'absence' ? ' selected' : '') + '>Absence</option>'
      + '<option value="maladie"' + (typeJour === 'maladie' ? ' selected' : '') + '>Maladie</option>'
      + '</select></div>'
      + '<div class="planning-day-grid" id="plan-horaires-' + jour + '" style="display:' + (typeJour === 'travail' ? 'grid' : 'none') + '">'
      + '<div><label>Début</label><input type="time" id="plan-debut-' + jour + '" value="' + (data.heureDebut || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Fin</label><input type="time" id="plan-fin-' + jour + '" value="' + (data.heureFin || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Zone</label><input type="text" id="plan-zone-' + jour + '" value="' + ((data.zone || '').replace(/"/g, '&quot;')) + '" placeholder="Tournée, secteur..." /></div>'
      + '<div class="wide"><label>Note</label><input type="text" id="plan-note-' + jour + '" value="' + ((data.note || '').replace(/"/g, '&quot;')) + '" placeholder="Information utile..." /></div>'
      + '</div></div>';
  }).join('');
  mettreAJourTotalHeuresPlanning();
};

ouvrirModalPlanning = function() {
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle) modalTitle.textContent = '📅 Horaires hebdomadaires';
  peuplerSelectPlanningModal();
  var search = document.getElementById('plan-salarie-search');
  var select = document.getElementById('plan-salarie');
  var grid = document.getElementById('plan-jours-grid');
  if (search) search.value = '';
  if (select) select.value = '';
  if (grid) grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
  mettreAJourTotalHeuresPlanning();
  openModal('modal-planning');
};

ouvrirEditPlanning = function(salId) {
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle) modalTitle.textContent = '📅 Horaires hebdomadaires';
  peuplerSelectPlanningModal();
  var select = document.getElementById('plan-salarie');
  var search = document.getElementById('plan-salarie-search');
  var salarie = charger('salaries').find(function(s) { return s.id === salId; });
  if (select) select.value = salId;
  if (search && salarie) search.value = planningBuildEmployeeLabel(salarie);
  genererGrilleJours();
  openModal('modal-planning');
};

sauvegarderPlanning = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!salarie) return afficherToast('Choisis un salarié', 'error');
  var planning = {
    salId: salarie.id,
    salNom: salarie.nom || '',
    semaine: JOURS.map(function(jour) {
      var typeJour = document.getElementById('plan-type-' + jour)?.value || 'repos';
      return {
        jour: jour,
        travaille: typeJour === 'travail',
        typeJour: typeJour,
        heureDebut: typeJour === 'travail' ? (document.getElementById('plan-debut-' + jour)?.value || '') : '',
        heureFin: typeJour === 'travail' ? (document.getElementById('plan-fin-' + jour)?.value || '') : '',
        zone: typeJour === 'travail' ? (document.getElementById('plan-zone-' + jour)?.value || '') : '',
        note: typeJour === 'travail' ? (document.getElementById('plan-note-' + jour)?.value || '') : ''
      };
    }),
    mis_a_jour: new Date().toISOString()
  };
  if (planning.semaine.some(function(j) { return j.typeJour === 'travail' && j.heureDebut && j.heureFin && calculerDureeJour(j.heureDebut, j.heureFin) <= 0; })) {
    return afficherToast('Certaines heures sont invalides', 'error');
  }
  var plannings = charger('plannings');
  var index = plannings.findIndex(function(p) { return p.salId === salarie.id; });
  if (index > -1) plannings[index] = planning;
  else plannings.push(planning);
  sauvegarder('plannings', plannings);
  closeModal('modal-planning');
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning enregistré');
};

supprimerPlanning = async function(salId) {
  var ok = await confirmDialog('Supprimer le planning hebdomadaire de ce salarié ?', { titre:'Supprimer le planning', icone:'📅', btnLabel:'Supprimer' });
  if (!ok) return;
  sauvegarder('plannings', charger('plannings').filter(function(p) { return p.salId !== salId; }));
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning supprimé');
};

copierSemainePrecedente = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!salarie) return afficherToast('Choisis un salarié', 'error');
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; });
  if (!planning || !planning.semaine || !planning.semaine.length) return afficherToast('Aucun planning existant à copier', 'error');
  genererGrilleJours();
};

afficherPlanning = function() {
  peuplerSelectPlanningModal();
};

reinitialiserFormulairePlanningRapide = function() {
  ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var search = document.getElementById('absence-sal-search');
  var select = document.getElementById('absence-sal');
  var type = document.getElementById('absence-type');
  var btn = document.getElementById('planning-submit-btn');
  if (search) search.value = '';
  if (select) select.value = '';
  if (type) type.value = 'travail';
  if (btn) btn.textContent = '+ Enregistrer';
  toggleAbsenceTypeFields();
};

initFormulairePlanningRapide = function() {
  peuplerAbsenceSal();
  toggleAbsenceTypeFields();
};

ajouterPeriodeAbsence = function() {
  var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debut = document.getElementById('absence-debut')?.value || '';
  var fin = document.getElementById('absence-fin')?.value || '';
  var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
  var heureFin = document.getElementById('absence-heure-fin')?.value || '';
  var editId = document.getElementById('absence-edit-id')?.value || '';
  if (!salarie || !debut || !fin) return afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
  if (fin < debut) return afficherToast('La date de fin doit être postérieure à la date de début', 'error');

  if (type === 'travail') {
    if (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0) {
      return afficherToast('Renseigne des horaires valides', 'error');
    }
    var plannings = charger('plannings');
    var indexPlan = plannings.findIndex(function(p) { return p.salId === salarie.id; });
    var planning = indexPlan > -1 ? plannings[indexPlan] : { salId: salarie.id, salNom: salarie.nom || '', semaine: [] };
    planning.salNom = salarie.nom || '';
    planning.semaine = Array.isArray(planning.semaine) ? planning.semaine : [];
    getDateRangeInclusive(debut, fin).forEach(function(dateObj) {
      var jourNom = JOURS[(dateObj.getDay() + 6) % 7];
      var indexJour = planning.semaine.findIndex(function(j) { return j.jour === jourNom; });
      var dataJour = {
        jour: jourNom,
        travaille: true,
        typeJour: 'travail',
        heureDebut: heureDebut,
        heureFin: heureFin,
        zone: indexJour > -1 ? (planning.semaine[indexJour].zone || '') : '',
        note: indexJour > -1 ? (planning.semaine[indexJour].note || '') : ''
      };
      if (indexJour > -1) planning.semaine[indexJour] = { ...planning.semaine[indexJour], ...dataJour };
      else planning.semaine.push(dataJour);
    });
    planning.mis_a_jour = new Date().toISOString();
    if (indexPlan > -1) plannings[indexPlan] = planning;
    else plannings.push(planning);
    sauvegarder('plannings', plannings);
    reinitialiserFormulairePlanningRapide();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    return afficherToast('Créneau de travail enregistré');
  }

  var absences = charger('absences_periodes');
  var payload = {
    id: editId || genId(),
    salId: salarie.id,
    salNom: salarie.nom || '',
    type: type,
    debut: debut,
    fin: fin,
    creeLe: editId ? (absences.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
    modifieLe: new Date().toISOString()
  };
  var indexAbs = absences.findIndex(function(a) { return a.id === payload.id; });
  if (indexAbs > -1) absences[indexAbs] = payload;
  else absences.push(payload);
  sauvegarder('absences_periodes', absences);
  reinitialiserFormulairePlanningRapide();
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast(editId ? 'Période mise à jour' : 'Période enregistrée');
};

afficherAbsencesPeriodes = function() {
  var container = document.getElementById('liste-absences-periodes');
  if (!container) return;
  var salaries = charger('salaries');
  var colors = { repos:'#6b7280', conge:'#3498db', maladie:'#9b59b6', absence:'#f39c12' };
  var labels = { repos:'Repos', conge:'Congé', maladie:'Maladie', absence:'Absence' };
  var absences = charger('absences_periodes').sort(function(a, b) { return new Date(b.debut) - new Date(a.debut); });
  if (!absences.length) {
    container.innerHTML = '<div class="planning-empty-note">Aucune période enregistrée.</div>';
    return;
  }
  container.innerHTML = absences.map(function(absence) {
    var salarie = salaries.find(function(s) { return s.id === absence.salId; });
    var labelSal = planningBuildEmployeeLabel(salarie || { nom: absence.salNom || 'Salarié supprimé' });
    return '<div class="planning-period-item">'
      + '<span class="planning-period-dot" style="background:' + (colors[absence.type] || '#f39c12') + '"></span>'
      + '<div class="planning-period-content"><div class="planning-period-title">' + (labels[absence.type] || 'Période') + ' - ' + labelSal + '</div>'
      + '<div class="planning-period-meta">Du ' + formatDateExport(absence.debut) + ' au ' + formatDateExport(absence.fin) + '</div></div>'
      + '<div class="planning-period-actions"><button type="button" onclick="editerPeriodeAbsence(\'' + absence.id + '\')">Modifier</button><button type="button" class="danger" onclick="supprimerAbsencePeriode(\'' + absence.id + '\')">Supprimer</button></div>'
      + '</div>';
  }).join('');
};

editerPeriodeAbsence = function(id) {
  var absence = charger('absences_periodes').find(function(a) { return a.id === id; });
  if (!absence) return;
  peuplerAbsenceSal();
  var salarie = charger('salaries').find(function(s) { return s.id === absence.salId; });
  if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = absence.id;
  if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = absence.salId;
  if (document.getElementById('absence-sal-search') && salarie) document.getElementById('absence-sal-search').value = planningBuildEmployeeLabel(salarie);
  if (document.getElementById('absence-type')) document.getElementById('absence-type').value = absence.type;
  if (document.getElementById('absence-debut')) document.getElementById('absence-debut').value = absence.debut;
  if (document.getElementById('absence-fin')) document.getElementById('absence-fin').value = absence.fin;
  if (document.getElementById('planning-submit-btn')) document.getElementById('planning-submit-btn').textContent = 'Mettre à jour';
  toggleAbsenceTypeFields();
};

supprimerAbsencePeriode = async function(id) {
  var ok = await confirmDialog('Supprimer cette période ?', { titre:'Supprimer la période', icone:'📅', btnLabel:'Supprimer' });
  if (!ok) return;
  sauvegarder('absences_periodes', charger('absences_periodes').filter(function(a) { return a.id !== id; }));
  if (document.getElementById('absence-edit-id')?.value === id) reinitialiserFormulairePlanningRapide();
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Période supprimée');
};

afficherPlanningSemaine = function() {
  initFormulairePlanningRapide();
  var week = planningGetWeekDates();
  var salaries = charger('salaries');
  var plannings = charger('plannings');
  var absences = charger('absences_periodes');
  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var label = document.getElementById('planning-semaine-label');
  var datesLabel = document.getElementById('planning-semaine-dates');
  var thead = document.getElementById('thead-planning-semaine');
  var tbody = document.getElementById('tb-planning-semaine');
  if (label) label.textContent = 'Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear();
  if (datesLabel) datesLabel.textContent = formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + week.dates.map(function(dateObj, index) {
      var isToday = dateToLocalISO(dateObj) === aujourdhui();
      return '<th style="text-align:center;' + (isToday ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[index].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>';
    }).join('') + '</tr>';
  }
  if (!tbody) return;
  if (!salaries.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>';
    return;
  }
  var filtered = salaries.filter(function(salarie) {
    if (!filtre) return true;
    return [planningBuildEmployeeLabel(salarie), salarie.nom, salarie.prenom, salarie.numero, salarie.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });
  var totalPlanifies = 0;
  var totalAbsences = 0;
  tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var hasWork = false;
    var cells = week.dates.map(function(dateObj, index) {
      var dateStr = dateToLocalISO(dateObj);
      var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
      if (absence) {
        totalAbsences += 1;
        return planningRenderWeekState('is-' + absence.type, absence.type === 'conge' ? 'Congé' : absence.type === 'maladie' ? 'Maladie' : 'Absence', '', '');
      }
      var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[index]; }) || null;
      if (!jour) return planningRenderWeekState('is-rest', 'Repos', '', '');
      if (jour.typeJour === 'travail' && jour.travaille) {
        hasWork = true;
        return planningRenderWeekState('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || jour.note || '');
      }
      if (jour.typeJour === 'conge' || jour.typeJour === 'absence' || jour.typeJour === 'maladie') {
        return planningRenderWeekState('is-' + jour.typeJour, jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence', '', '');
      }
      return planningRenderWeekState('is-rest', 'Repos', '', '');
    }).join('');
    if (hasWork) totalPlanifies += 1;
    return '<tr><td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>' + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '') + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '') + '</div></td>' + cells + '</tr>';
  }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
  afficherAbsencesPeriodes();
};

filtrerPlanningSemaine = function() {
  afficherPlanningSemaine();
};

exporterPlanningSemainePDF = function() {
  var week = planningGetWeekDates();
  var salaries = charger('salaries');
  var plannings = charger('plannings');
  var absences = charger('absences_periodes');
  var params = getEntrepriseExportParams();
  var dateExp = formatDateHeureExport();
  var cols = week.dates.map(function(dateObj, index) {
    return '<th style="padding:8px 10px;text-align:center;color:#6b7280">' + JOURS_COURTS[index] + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>';
  }).join('');
  var rows = salaries.map(function(salarie, index) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var cells = week.dates.map(function(dateObj, dayIndex) {
      var dateStr = dateToLocalISO(dateObj);
      var absence = absences.find(function(item) { return item.salId === salarie.id && dateStr >= item.debut && dateStr <= item.fin; });
      if (absence) return '<td style="padding:8px 10px;text-align:center">' + (absence.type === 'conge' ? 'Congé' : absence.type === 'maladie' ? 'Maladie' : 'Absence') + '</td>';
      var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[dayIndex]; });
      if (!jour) return '<td style="padding:8px 10px;text-align:center">Repos</td>';
      if (jour.typeJour === 'travail' && jour.travaille) return '<td style="padding:8px 10px;text-align:center">' + (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : '') + '</td>';
      return '<td style="padding:8px 10px;text-align:center">' + (jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : jour.typeJour === 'absence' ? 'Absence' : 'Repos') + '</td>';
    }).join('');
    return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + ';border-bottom:1px solid #e5e7eb"><td style="padding:8px 10px;font-weight:600">' + (salarie.nom || '') + (salarie.numero ? '<br><span style="font-size:.75rem;color:#6b7280">#' + salarie.numero + '</span>' : '') + '</td>' + cells + '</tr>';
  }).join('');
  var html = '<html><head><meta charset="utf-8"><title>Planning hebdomadaire</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111827">'
    + '<h1 style="margin:0 0 6px;font-size:22px">' + params.nom + '</h1>'
    + '<div style="color:#6b7280;margin-bottom:16px">Planning hebdomadaire - Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear() + '</div>'
    + renderBlocInfosEntreprise(params)
    + '<div style="margin-bottom:16px;font-size:14px;color:#374151">Période : ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche) + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left">Salarié</th>' + cols + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
    + '</body></html>';
  var popup = ouvrirPopupSecure('', '_blank');
  if (!popup) return afficherToast('Autorise les popups pour générer le PDF', 'error');
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(function() { popup.print(); }, 250);
  afficherToast('Rapport planning généré');
};

/* ===== PLANNING REWRITE ===== */
// MOVED -> script-planning.js : planningBuildEmployeeLabel

// MOVED -> script-planning.js : planningFindEmployeeBySearch

// MOVED -> script-planning.js : planningEscapeHtml

// MOVED -> script-planning.js : planningDateToLocalISO

function planningSyncSearchWithSelect(searchId, selectId) {
  var search = document.getElementById(searchId);
  var select = document.getElementById(selectId);
  var salaries = charger('salaries');
  if (select) {
    var currentValue = select.value;
    select.innerHTML = '<option value="">-- Choisir --</option>';
    salaries.forEach(function(s) {
      select.innerHTML += '<option value="' + s.id + '">' + planningBuildEmployeeLabel(s).replace(/"/g, '&quot;') + '</option>';
    });
    if (salaries.some(function(s) { return s.id === currentValue; })) {
      select.value = currentValue;
    }
  }
  if (search && select && select.value) {
    var salarie = salaries.find(function(s) { return s.id === select.value; });
    if (salarie) search.value = planningBuildEmployeeLabel(salarie);
  }
}

// MOVED -> script-planning.js : planningResolveSelectedEmployee

// MOVED -> script-planning.js : planningRenderEmployeeSuggestions

// MOVED -> script-planning.js : planningRenderWeekState

// MOVED -> script-planning.js : planningGetWeekDates

// MOVED -> script-planning.js : planningBuildDateArray

// MOVED -> script-planning.js : planningGetDisplayedPeriod

// MOVED -> script-planning.js : reinitialiserFormulairePlanningRapide

toggleAbsenceTypeFields = function() {
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debutWrap = document.getElementById('absence-heure-debut-wrap');
  var finWrap = document.getElementById('absence-heure-fin-wrap');
  if (debutWrap) debutWrap.style.display = type === 'travail' ? '' : 'none';
  if (finWrap) finWrap.style.display = type === 'travail' ? '' : 'none';
};

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  planningRenderEmployeeSuggestions('absence-sal-search', 'absence-sal', 'absence-sal-suggestions');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  planningRenderEmployeeSuggestions('plan-salarie-search', 'plan-salarie', 'plan-salarie-suggestions', function() {
    genererGrilleJours();
  });
  if (salarie) genererGrilleJours();
};

mettreAJourTotalHeuresPlanning = function() {
  var total = 0;
  var out = document.getElementById('plan-total-heures');
  JOURS.forEach(function(jour) {
    var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
    if (type !== 'travail') return;
    total += calculerDureeJour(
      document.getElementById('plan-debut-' + jour)?.value || '',
      document.getElementById('plan-fin-' + jour)?.value || ''
    );
  });
  if (out) out.textContent = total.toFixed(1) + ' h';
};

toggleTypeJour = function(jour) {
  var type = document.getElementById('plan-type-' + jour)?.value || 'repos';
  var horaires = document.getElementById('plan-horaires-' + jour);
  if (horaires) horaires.style.display = type === 'travail' ? 'grid' : 'none';
  mettreAJourTotalHeuresPlanning();
};

genererGrilleJours = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  var grid = document.getElementById('plan-jours-grid');
  if (!grid) return;
  if (!salarie) {
    grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
    mettreAJourTotalHeuresPlanning();
    return;
  }
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; }) || { semaine: [] };
  grid.innerHTML = JOURS.map(function(jour, index) {
    var data = (planning.semaine || []).find(function(item) { return item.jour === jour; }) || {};
    var typeJour = data.typeJour || (data.travaille ? 'travail' : 'repos');
    return '<div class="planning-day-editor">'
      + '<div class="planning-day-top"><div class="planning-day-title">' + JOURS_COURTS[index] + ' - ' + jour.charAt(0).toUpperCase() + jour.slice(1) + '</div>'
      + '<select id="plan-type-' + jour + '" onchange="toggleTypeJour(\'' + jour + '\')">'
      + '<option value="travail"' + (typeJour === 'travail' ? ' selected' : '') + '>Travail</option>'
      + '<option value="repos"' + (typeJour === 'repos' ? ' selected' : '') + '>Repos</option>'
      + '<option value="conge"' + (typeJour === 'conge' ? ' selected' : '') + '>Congé</option>'
      + '<option value="absence"' + (typeJour === 'absence' ? ' selected' : '') + '>Absence</option>'
      + '<option value="maladie"' + (typeJour === 'maladie' ? ' selected' : '') + '>Maladie</option>'
      + '</select></div>'
      + '<div class="planning-day-grid" id="plan-horaires-' + jour + '" style="display:' + (typeJour === 'travail' ? 'grid' : 'none') + '">'
      + '<div><label>Début</label><input type="time" id="plan-debut-' + jour + '" value="' + (data.heureDebut || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Fin</label><input type="time" id="plan-fin-' + jour + '" value="' + (data.heureFin || '') + '" onchange="mettreAJourTotalHeuresPlanning()" /></div>'
      + '<div><label>Zone</label><input type="text" id="plan-zone-' + jour + '" value="' + ((data.zone || '').replace(/"/g, '&quot;')) + '" placeholder="Tournée, secteur..." /></div>'
      + '<div class="wide"><label>Note</label><input type="text" id="plan-note-' + jour + '" value="' + ((data.note || '').replace(/"/g, '&quot;')) + '" placeholder="Information utile..." /></div>'
      + '</div></div>';
  }).join('');
  mettreAJourTotalHeuresPlanning();
};

ouvrirModalPlanning = function() {
  // Restaure le titre par défaut '📋 Gérer les horaires' (ouvrirPlanningRecurrence
  // peut le surcharger avec '🔁 Horaires récurrents' avant nous → on reset ici)
  var modalTitle = document.querySelector('#modal-planning .modal-header h3');
  if (modalTitle && !modalTitle.dataset.recurrent) modalTitle.textContent = '📋 Gérer les horaires';
  peuplerSelectPlanningModal();
  var search = document.getElementById('plan-salarie-search');
  var select = document.getElementById('plan-salarie');
  var grid = document.getElementById('plan-jours-grid');
  if (search) search.value = '';
  if (select) select.value = '';
  if (grid) grid.innerHTML = '<div class="planning-empty-note">Sélectionne un salarié pour saisir ses horaires.</div>';
  mettreAJourTotalHeuresPlanning();
  openModal('modal-planning');
};

ouvrirEditPlanning = function(salId) {
  peuplerSelectPlanningModal();
  var select = document.getElementById('plan-salarie');
  var search = document.getElementById('plan-salarie-search');
  var salarie = charger('salaries').find(function(s) { return s.id === salId; });
  if (select) select.value = salId;
  if (search && salarie) search.value = planningBuildEmployeeLabel(salarie);
  genererGrilleJours();
  openModal('modal-planning');
};

sauvegarderPlanning = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!salarie) {
    afficherToast('Choisis un salarié', 'error');
    return;
  }
  var planning = {
    salId: salarie.id,
    salNom: salarie.nom || '',
    semaine: JOURS.map(function(jour) {
      var typeJour = document.getElementById('plan-type-' + jour)?.value || 'repos';
      return {
        jour: jour,
        travaille: typeJour === 'travail',
        typeJour: typeJour,
        heureDebut: typeJour === 'travail' ? (document.getElementById('plan-debut-' + jour)?.value || '') : '',
        heureFin: typeJour === 'travail' ? (document.getElementById('plan-fin-' + jour)?.value || '') : '',
        zone: typeJour === 'travail' ? (document.getElementById('plan-zone-' + jour)?.value || '') : '',
        note: typeJour === 'travail' ? (document.getElementById('plan-note-' + jour)?.value || '') : ''
      };
    }),
    mis_a_jour: new Date().toISOString()
  };
  for (var i = 0; i < planning.semaine.length; i++) {
    var jour = planning.semaine[i];
    if (jour.typeJour === 'travail' && jour.heureDebut && jour.heureFin && calculerDureeJour(jour.heureDebut, jour.heureFin) <= 0) {
      afficherToast('Certaines heures sont invalides', 'error');
      return;
    }
  }
  var plannings = charger('plannings');
  var index = plannings.findIndex(function(item) { return item.salId === salarie.id; });
  if (index > -1) plannings[index] = planning;
  else plannings.push(planning);
  sauvegarder('plannings', plannings);
  closeModal('modal-planning');
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning enregistré');
};

supprimerPlanning = async function(salId) {
  var ok = await confirmDialog('Supprimer le planning hebdomadaire de ce salarié ?', { titre:'Supprimer le planning', icone:'📅', btnLabel:'Supprimer' });
  if (!ok) return;
  sauvegarder('plannings', charger('plannings').filter(function(p) { return p.salId !== salId; }));
  afficherPlanning();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Planning supprimé');
};

copierSemainePrecedente = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  if (!salarie) {
    afficherToast('Choisis un salarié', 'error');
    return;
  }
  var planning = (charger('plannings') || []).find(function(p) { return p.salId === salarie.id; });
  if (!planning || !Array.isArray(planning.semaine) || !planning.semaine.length) {
    afficherToast('Aucun planning existant à copier', 'error');
    return;
  }
  genererGrilleJours();
};

afficherPlanning = function() {
  peuplerSelectPlanningModal();
};

initFormulairePlanningRapide = function() {
  peuplerAbsenceSal();
  var btn = document.getElementById('planning-submit-btn');
  if (btn && !document.getElementById('absence-edit-id')?.value) btn.textContent = '+ Enregistrer';
  var editBtn = document.getElementById('planning-edit-work-btn');
  if (editBtn) editBtn.textContent = 'Modifier les horaires';
  toggleAbsenceTypeFields();
};

ouvrirEditionTravailRapide = function() {
  var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  if (!salarie) {
    afficherToast('Choisis un salarié à modifier', 'error');
    return;
  }
  ouvrirEditPlanning(salarie.id);
};

ajouterPeriodeAbsence = function() {
  var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  var type = document.getElementById('absence-type')?.value || 'travail';
  var debut = document.getElementById('absence-debut')?.value || '';
  var fin = document.getElementById('absence-fin')?.value || '';
  var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
  var heureFin = document.getElementById('absence-heure-fin')?.value || '';
  var editId = document.getElementById('absence-edit-id')?.value || '';
  if (!salarie || !debut || !fin) {
    afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
    return;
  }
  if (fin < debut) {
    afficherToast('La date de fin doit être postérieure à la date de début', 'error');
    return;
  }
  if (type === 'travail') {
    if (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0) {
      afficherToast('Renseigne des horaires de travail valides', 'error');
      return;
    }
    var periodesTravail = charger('absences_periodes');
    var payloadTravail = {
      id: editId || genId(),
      salId: salarie.id,
      salNom: salarie.nom || '',
      type: 'travail',
      debut: debut,
      fin: fin,
      heureDebut: heureDebut,
      heureFin: heureFin,
      creeLe: editId ? (periodesTravail.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };
    var indexTravail = periodesTravail.findIndex(function(a) { return a.id === payloadTravail.id; });
    if (indexTravail > -1) periodesTravail[indexTravail] = payloadTravail;
    else periodesTravail.push(payloadTravail);
    sauvegarder('absences_periodes', periodesTravail);
    reinitialiserFormulairePlanningRapide();
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast(editId ? 'Créneau de travail mis à jour' : 'Créneau de travail enregistré');
    return;
  }

  var absences = charger('absences_periodes');
  var payload = {
    id: editId || genId(),
    salId: salarie.id,
    salNom: salarie.nom || '',
    type: type,
    debut: debut,
    fin: fin,
    creeLe: editId ? (absences.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
    modifieLe: new Date().toISOString()
  };
  var indexAbs = absences.findIndex(function(a) { return a.id === payload.id; });
  if (indexAbs > -1) absences[indexAbs] = payload;
  else absences.push(payload);
  sauvegarder('absences_periodes', absences);
  reinitialiserFormulairePlanningRapide();
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast(editId ? 'Période mise à jour' : 'Période enregistrée');
};

afficherAbsencesPeriodes = function() {
  var container = document.getElementById('liste-absences-periodes');
  if (!container) return;
  var salaries = charger('salaries');
  var colors = { travail:'#2ecc71', repos:'#6b7280', conge:'#3498db', maladie:'#9b59b6', absence:'#f39c12' };
  var labels = { travail:'Travail', repos:'Repos', conge:'Congé', maladie:'Maladie', absence:'Absence' };
  var absences = charger('absences_periodes').sort(function(a, b) {
    return new Date(b.debut) - new Date(a.debut);
  });
  if (!absences.length) {
    container.innerHTML = '<div class="planning-empty-note">Aucune période enregistrée.</div>';
    return;
  }
  container.innerHTML = absences.map(function(absence) {
    var salarie = salaries.find(function(s) { return s.id === absence.salId; });
    var labelSal = planningBuildEmployeeLabel(salarie || { nom: absence.salNom || 'Salarié supprimé' });
    return '<div class="planning-period-item">'
      + '<span class="planning-period-dot" style="background:' + (colors[absence.type] || '#f39c12') + '"></span>'
      + '<div class="planning-period-content">'
      + '<div class="planning-period-title">' + (labels[absence.type] || 'Période') + ' - ' + labelSal + '</div>'
      + '<div class="planning-period-meta">Du ' + formatDateExport(absence.debut) + ' au ' + formatDateExport(absence.fin) + (absence.type === 'travail' && absence.heureDebut && absence.heureFin ? ' · ' + absence.heureDebut + ' - ' + absence.heureFin : '') + '</div>'
      + '</div>'
      + '<div class="planning-period-actions">'
      + '<button type="button" onclick="editerPeriodeAbsence(\'' + absence.id + '\')">Modifier</button>'
      + '<button type="button" class="danger" onclick="supprimerAbsencePeriode(\'' + absence.id + '\')">Supprimer</button>'
      + '</div></div>';
  }).join('');
};

editerPeriodeAbsence = function(id) {
  var absence = charger('absences_periodes').find(function(a) { return a.id === id; });
  if (!absence) return;
  peuplerAbsenceSal();
  var salarie = charger('salaries').find(function(s) { return s.id === absence.salId; });
  var editInput = document.getElementById('absence-edit-id');
  var search = document.getElementById('absence-sal-search');
  var select = document.getElementById('absence-sal');
  var type = document.getElementById('absence-type');
  var debut = document.getElementById('absence-debut');
  var fin = document.getElementById('absence-fin');
  var heureDebut = document.getElementById('absence-heure-debut');
  var heureFin = document.getElementById('absence-heure-fin');
  var btn = document.getElementById('planning-submit-btn');
  if (editInput) editInput.value = absence.id;
  if (search && salarie) search.value = planningBuildEmployeeLabel(salarie);
  if (select) select.value = absence.salId;
  if (type) type.value = absence.type;
  if (debut) debut.value = absence.debut;
  if (fin) fin.value = absence.fin;
  if (heureDebut) heureDebut.value = absence.heureDebut || '';
  if (heureFin) heureFin.value = absence.heureFin || '';
  if (btn) btn.textContent = 'Mettre à jour';
  toggleAbsenceTypeFields();
};

supprimerAbsencePeriode = async function(id) {
  var ok = await confirmDialog('Supprimer cette période ?', { titre:'Supprimer la période', icone:'📅', btnLabel:'Supprimer' });
  if (!ok) return;
  sauvegarder('absences_periodes', charger('absences_periodes').filter(function(a) { return a.id !== id; }));
  if (document.getElementById('absence-edit-id')?.value === id) reinitialiserFormulairePlanningRapide();
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  afficherToast('Période supprimée');
};

afficherPlanningSemaine = function() {
  initFormulairePlanningRapide();
  var week = planningGetWeekDates();
  var salaries = charger('salaries');
  var plannings = charger('plannings');
  var absences = charger('absences_periodes');
  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var label = document.getElementById('planning-semaine-label');
  var datesLabel = document.getElementById('planning-semaine-dates');
  var thead = document.getElementById('thead-planning-semaine');
  var tbody = document.getElementById('tb-planning-semaine');
  if (label) label.textContent = 'Semaine ' + getNumSemaine(week.lundi) + ' - ' + week.lundi.getFullYear();
  if (datesLabel) datesLabel.textContent = formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + week.dates.map(function(dateObj, index) {
      var isToday = dateToLocalISO(dateObj) === aujourdhui();
      return '<th style="text-align:center;' + (isToday ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[index].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5) + '</th>';
    }).join('') + '</tr>';
  }
  if (!tbody) return;
  if (!salaries.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>';
    return;
  }
  var filtered = salaries.filter(function(salarie) {
    if (!filtre) return true;
    return [
      planningBuildEmployeeLabel(salarie),
      salarie.nom,
      salarie.prenom,
      salarie.numero,
      salarie.poste
    ].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });
  var totalPlanifies = 0;
  var totalAbsences = 0;
  tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var hasWork = false;
    var cells = week.dates.map(function(dateObj, index) {
      var dateStr = planningDateToLocalISO(dateObj);
      var periode = getPlanningPeriodForDate(salarie.id, dateStr, absences);
      if (periode) {
        if (periode.type === 'travail') {
          hasWork = true;
          return planningRenderWeekState('is-work', 'Travail', (periode.heureDebut || '') + (periode.heureFin ? ' - ' + periode.heureFin : ''), '');
        }
        if (periode.type !== 'repos') totalAbsences += 1;
        return planningRenderWeekState('is-' + periode.type, getPlanningPeriodLabel(periode.type), '', '');
      }
      var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[index]; }) || null;
      if (!jour) return planningRenderWeekState('is-rest', 'Repos', '', '');
      if (jour.typeJour === 'travail' && jour.travaille) {
        hasWork = true;
        return planningRenderWeekState('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || jour.note || '');
      }
      if (jour.typeJour === 'conge' || jour.typeJour === 'absence' || jour.typeJour === 'maladie') {
        return planningRenderWeekState('is-' + jour.typeJour, jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence', '', '');
      }
      return planningRenderWeekState('is-rest', 'Repos', '', '');
    }).join('');
    if (hasWork) totalPlanifies += 1;
    return '<tr>'
      + '<td><div class="planning-week-salarie"><strong>' + (salarie.nom || '') + '</strong>'
      + (salarie.poste ? '<span class="planning-week-meta">' + salarie.poste + '</span>' : '')
      + (salarie.numero ? '<span class="planning-week-meta">#' + salarie.numero + '</span>' : '')
      + '</div></td>'
      + cells
      + '</tr>';
  }).join('') : '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
  var kpiSal = document.getElementById('planning-kpi-salaries');
  var kpiPlan = document.getElementById('planning-kpi-planifies');
  var kpiAbs = document.getElementById('planning-kpi-absences');
  if (kpiSal) kpiSal.textContent = salaries.length;
  if (kpiPlan) kpiPlan.textContent = totalPlanifies;
  if (kpiAbs) kpiAbs.textContent = totalAbsences;
  afficherAbsencesPeriodes();
};

filtrerPlanningSemaine = function() {
  afficherPlanningSemaine();
};

exporterPlanningSemainePDF = function() {
  var week = planningGetWeekDates();
  var salaries = charger('salaries');
  var plannings = charger('plannings');
  var absences = charger('absences_periodes');
  var params = getEntrepriseExportParams();
  var dateExp = formatDateHeureExport();
  var titreSemaine = 'Semaine ' + getNumSemaine(week.lundi) + ' — ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
  var stateStyles = {
    travail: { bg:'#e9f8ef', border:'#b7e7c8', color:'#177245', label:'Travail' },
    repos: { bg:'#f4f5f7', border:'#d7dbe2', color:'#6b7280', label:'Repos' },
    conge: { bg:'#eaf3ff', border:'#c7defd', color:'#3498db', label:'Congé' },
    maladie: { bg:'#f4edff', border:'#dcc8fa', color:'#9b59b6', label:'Maladie' },
    absence: { bg:'#fdeeee', border:'#f7c7c7', color:'#e74c3c', label:'Absence' }
  };
  var getStateBlockStyle = function(style, extra) {
    return 'min-height:56px;display:flex;align-items:center;justify-content:center;padding:8px 6px;border-radius:12px;background:' + style.bg + ';border:1px solid ' + style.border + ';color:' + style.color + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;' + (extra || '');
  };
  var formatCellulePlanning = function(salarie, dateObj, dayIndex, planning) {
    var dateStr = dateToLocalISO(dateObj);
    var periode = getPlanningPeriodForDate(salarie.id, dateStr, absences);
    if (periode) {
      if (periode.type === 'travail') {
        var periodeStyle = stateStyles.travail;
        var horairePeriode = (periode.heureDebut || '') + (periode.heureFin ? ' - ' + periode.heureFin : '');
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodeStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">' + periodeStyle.label + '</span><span style="font-size:.76rem;font-weight:600">' + horairePeriode + '</span></div></td>';
      }
      var absStyle = stateStyles[periode.type] || stateStyles.absence;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(absStyle, 'font-size:.78rem;font-weight:700') + '">' + absStyle.label + '</div></td>';
    }
    var jour = (planning.semaine || []).find(function(item) { return item.jour === JOURS[dayIndex]; });
    if (!jour) {
      var restStyle = stateStyles.repos;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(restStyle, 'font-size:.78rem') + '">Repos</div></td>';
    }
    if (jour.typeJour === 'travail' && jour.travaille) {
      var workStyle = stateStyles.travail;
      var horaire = (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : '');
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(workStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">' + workStyle.label + '</span><span style="font-size:.76rem;font-weight:600">' + horaire + '</span></div></td>';
    }
    var state = stateStyles[jour.typeJour] || stateStyles.repos;
    return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(state, 'font-size:.78rem;font-weight:700') + '">' + state.label + '</div></td>';
  };
  var rows = salaries.map(function(salarie, index) {
    var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
    var cells = week.dates.map(function(dateObj, dayIndex) {
      return formatCellulePlanning(salarie, dateObj, dayIndex, planning);
    }).join('');
    return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + '">'
      + '<td style="padding:10px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;min-width:170px">' + (salarie.nom || '') + (salarie.numero ? '<br><span style="font-size:.75rem;color:#6b7280">#' + salarie.numero + '</span>' : '') + (salarie.poste ? '<br><span style="font-size:.74rem;color:#9ca3af">' + salarie.poste + '</span>' : '') + '</td>'
      + cells + '</tr>';
  }).join('');
  var thead = week.dates.map(function(dateObj, dayIndex) {
    return '<th style="padding:10px 8px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #dfe3ea;min-width:92px">' + JOURS_COURTS[dayIndex] + '<div style="font-size:.76rem;color:#9ca3af;margin-top:2px">' + formatDateExport(dateObj).slice(0, 5) + '</div></th>';
  }).join('');
  var html = '<style>@page{size:landscape;margin:10mm}body,table,thead,tbody,tr,th,td,div,span{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}</style><div style="font-family:Segoe UI,Arial,sans-serif;width:100%;padding:22px 24px;color:#1a1d27;box-sizing:border-box">'
    + construireEnteteExport(params, 'Planning hebdomadaire', titreSemaine, dateExp)
    + renderBlocInfosEntreprise(params)
    + '<div style="margin:0 0 16px;font-size:.88rem;color:#4b5563">Période : <strong>' + formatDateExport(week.lundi) + '</strong> au <strong>' + formatDateExport(week.dimanche) + '</strong></div>'
    + '<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;table-layout:fixed"><thead><tr style="background:#f3f4f6"><th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;border-bottom:1px solid #dfe3ea;min-width:170px">Salarié</th>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
    + '</div>';
  ouvrirFenetreImpression('Planning ' + titreSemaine, html, 'width=1200,height=780');
  afficherToast('Rapport planning généré');
};

validerLivraisonLivree = async function(id) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return false;
  var ok = await confirmDialog('Confirmer cette livraison comme livrée ?', { titre:'Valider la livraison', icone:'📦', btnLabel:'Valider', danger:false });
  if (!ok) return false;
  livraisons[idx].statut = 'livre';
  livraisons[idx].dateLivraison = new Date().toISOString();
  sauvegarder('livraisons', livraisons);
  afficherLivraisons();
  rafraichirDashboard();
  afficherToast('Livraison marquée comme livrée');
  return true;
};

validerLivraisonPayee = async function(id) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return false;
  var liv = livraisons[idx];
  var msg = liv.statut !== 'livre'
    ? 'Marquer cette livraison comme payée ?\n(le statut de livraison reste inchangé)'
    : 'Confirmer cette livraison comme payée ?';
  var ok = await confirmDialog(msg, { titre:'Valider le paiement', icone:'💳', btnLabel:'Valider', danger:false });
  if (!ok) return false;
  liv.statutPaiement = 'payé';
  liv.datePaiement = new Date().toISOString();
  sauvegarder('livraisons', livraisons);
  afficherLivraisons();
  rafraichirDashboard();
  afficherRelances();
  afficherToast('Livraison marquée comme payée');
  return true;
};

changerStatutPaiement = async function(id, statut, selectEl) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return;
  var ancienStatut = livraisons[idx].statutPaiement || 'en-attente';
  var ok = false;
  if (statut === 'payé') {
    ok = await validerLivraisonPayee(id);
  } else if (statut === 'en-attente') {
    ok = await confirmDialog('Remettre le paiement en attente ?', { titre:'Paiement', icone:'💳', btnLabel:'Confirmer', danger:false });
    if (ok) {
      livraisons[idx].statutPaiement = statut;
      delete livraisons[idx].datePaiement;
      sauvegarder('livraisons', livraisons);
      afficherLivraisons();
      afficherRelances();
      afficherToast('Paiement mis à jour');
    }
  } else {
    livraisons[idx].statutPaiement = statut;
    sauvegarder('livraisons', livraisons);
    afficherLivraisons();
    afficherRelances();
    afficherToast('Paiement mis à jour');
    ok = true;
  }
  // Si l'utilisateur a annulé la modal, restaurer la valeur du select
  if (!ok && selectEl) selectEl.value = ancienStatut;
};

changerStatutLivraison = async function(id, statut, selectEl) {
  var livraisons = charger('livraisons');
  var idx = livraisons.findIndex(l => l.id === id);
  if (idx === -1) return;
  var ancienStatut = livraisons[idx].statut || 'en-attente';
  var ok = false;
  if (statut === 'livre') {
    ok = await validerLivraisonLivree(id);
  } else {
    ok = await confirmDialog('Mettre à jour le statut de cette livraison ?', { titre:'Statut livraison', icone:'📦', btnLabel:'Confirmer', danger:false });
    if (ok) {
      livraisons[idx].statut = statut;
      delete livraisons[idx].dateLivraison;
      // Découplage : ne plus reset statutPaiement quand on remet en-cours/en-attente
      sauvegarder('livraisons', livraisons);
      afficherLivraisons();
      rafraichirDashboard();
      afficherToast('Statut livraison mis à jour');
    }
  }
  // Si annulé, restaurer le select
  if (!ok && selectEl) selectEl.value = ancienStatut;
};

afficherLivraisons = window.renderLivraisonsAdminFinal;

peuplerAbsenceSal = function() {
  var sel = document.getElementById('absence-sal');
  var datalist = document.getElementById('absence-sal-datalist');
  var search = document.getElementById('absence-sal-search');
  var salaries = charger('salaries');
  if (sel) {
    var currentValue = sel.value;
    sel.innerHTML = '<option value="">-- Choisir --</option>';
    salaries.forEach(function(s) {
      var label = s.nom + (s.poste ? ' - ' + s.poste : '') + (s.numero ? ' (' + s.numero + ')' : '');
      sel.innerHTML += '<option value="' + s.id + '">' + label + '</option>';
    });
    sel.value = currentValue;
  }
  if (datalist) {
    datalist.innerHTML = salaries.map(function(s) {
      var label = s.nom + (s.poste ? ' - ' + s.poste : '') + (s.numero ? ' (' + s.numero + ')' : '');
      return '<option value="' + label.replace(/"/g, '&quot;') + '"></option>';
    }).join('');
  }
  if (search && sel && sel.value) {
    var selected = salaries.find(function(s){ return s.id === sel.value; });
    if (selected) search.value = selected.nom + (selected.poste ? ' - ' + selected.poste : '') + (selected.numero ? ' (' + selected.numero + ')' : '');
  }
};

filtrerRechercheAbsence = function() {
  var search = (document.getElementById('absence-sal-search')?.value || '').trim().toLowerCase();
  var sel = document.getElementById('absence-sal');
  if (!sel) return;
  if (!search) {
    sel.value = '';
    return;
  }
  var match = charger('salaries').find(function(s) {
    return [s.nom, s.prenom, s.nomFamille, s.poste, s.numero].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
  if (match) sel.value = match.id;
};

initFormulairePlanningRapide = function() {
  appliquerLibellesAnalyseHT();
  var panelTitle = document.querySelector('#page-planning .planning-absence-form .planning-panel-title');
  if (panelTitle) panelTitle.textContent = 'Ajouter une période planning';
  var btn = document.querySelector('#page-planning .planning-absence-form .btn-primary');
  if (btn) btn.textContent = '+ Enregistrer la période';

  var typeSelect = document.getElementById('absence-type');
  if (typeSelect) {
    var currentType = typeSelect.value || 'travail';
    typeSelect.innerHTML = ''
      + '<option value="travail">Travail</option>'
      + '<option value="repos">Repos</option>'
      + '<option value="conge">Congé</option>'
      + '<option value="maladie">Maladie</option>'
      + '<option value="absence">Absence</option>';
    typeSelect.value = currentType;
    typeSelect.onchange = toggleAbsenceTypeFields;
  }

  var finField = document.getElementById('absence-fin')?.closest('.planning-field');
  if (finField && !document.getElementById('absence-heure-debut')) {
    finField.insertAdjacentHTML('afterend',
      '<div class="planning-field" id="absence-heure-debut-wrap">'
      + '<label>Heure début</label>'
      + '<input type="time" id="absence-heure-debut" />'
      + '</div>'
      + '<div class="planning-field" id="absence-heure-fin-wrap">'
      + '<label>Heure fin</label>'
      + '<input type="time" id="absence-heure-fin" />'
      + '</div>'
    );
  }

  var toolbar = document.querySelector('#page-planning .planning-table-toolbar');
  if (toolbar && !toolbar.querySelector('.planning-table-search')) {
    var toolbarInput = toolbar.querySelector('#filtre-planning-salarie');
    var firstBlock = toolbar.children[0];
    if (firstBlock) firstBlock.classList.add('planning-table-toolbar-main');
    if (toolbarInput) {
      var searchWrap = document.createElement('div');
      searchWrap.className = 'planning-table-search';
      toolbarInput.parentNode.insertBefore(searchWrap, toolbarInput);
      searchWrap.appendChild(toolbarInput);
    }
  }

  var weekTable = document.querySelector('#page-planning .table-wrapper table');
  if (weekTable) weekTable.classList.add('planning-week-grid');
  var weekWrapper = document.querySelector('#page-planning .table-wrapper');
  if (weekWrapper) weekWrapper.classList.add('planning-week-table');

  var searchInput = document.getElementById('absence-sal-search');
  var hiddenSelect = document.getElementById('absence-sal');
  if (searchInput) {
    if (hiddenSelect) hiddenSelect.style.display = 'none';
    var datalist = document.getElementById('absence-sal-datalist');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'absence-sal-datalist';
      searchInput.insertAdjacentElement('afterend', datalist);
    }
    searchInput.setAttribute('list', 'absence-sal-datalist');
    searchInput.placeholder = 'Rechercher ou sélectionner un salarié...';
  }

  peuplerAbsenceSal();
  toggleAbsenceTypeFields();
};

ajouterPeriodeAbsence = function() {
  var salId = document.getElementById('absence-sal') ? document.getElementById('absence-sal').value : '';
  var type = document.getElementById('absence-type') ? document.getElementById('absence-type').value : 'travail';
  var debut = document.getElementById('absence-debut') ? document.getElementById('absence-debut').value : '';
  var fin = document.getElementById('absence-fin') ? document.getElementById('absence-fin').value : '';
  var heureDebut = document.getElementById('absence-heure-debut') ? document.getElementById('absence-heure-debut').value : '';
  var heureFin = document.getElementById('absence-heure-fin') ? document.getElementById('absence-heure-fin').value : '';
  var editId = document.getElementById('absence-edit-id') ? document.getElementById('absence-edit-id').value : '';
  if (!salId || !debut || !fin) { afficherToast('Salarié, date début et date fin obligatoires', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit être après la date de début', 'error'); return; }

  if (type === 'travail') {
    if (!heureDebut || !heureFin) { afficherToast('Renseignez les heures de travail', 'error'); return; }
    if (calculerDureeJour(heureDebut, heureFin) <= 0) { afficherToast('Les heures de travail sont invalides', 'error'); return; }
    var sal = charger('salaries').find(function(s){ return s.id === salId; });
    var periodes = charger('absences_periodes');
    var payloadTravail = {
      id: editId || genId(),
      salId: salId,
      salNom: sal ? sal.nom : '',
      type: 'travail',
      debut: debut,
      fin: fin,
      heureDebut: heureDebut,
      heureFin: heureFin,
      creeLe: editId ? (periodes.find(function(a) { return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };
    var idxTravail = periodes.findIndex(function(a) { return a.id === payloadTravail.id; });
    if (idxTravail > -1) periodes[idxTravail] = payloadTravail;
    else periodes.push(payloadTravail);
    localStorage.setItem('absences_periodes', JSON.stringify(periodes));
    ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    afficherAbsencesPeriodes();
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast(editId ? 'Créneau de travail mis à jour' : 'Créneau de travail enregistré');
    return;
  }

  var absences = loadSafe('absences_periodes', []);
  var payload = { id: editId || genId(), salId: salId, type: type, debut: debut, fin: fin, creeLe: editId ? (absences.find(function(a){ return a.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(), modifieLe: new Date().toISOString() };
  var idx = absences.findIndex(function(a){ return a.id === payload.id; });
  if (idx > -1) absences[idx] = payload;
  else absences.push(payload);
  localStorage.setItem('absences_periodes', JSON.stringify(absences));
  ['absence-debut','absence-fin','absence-heure-debut','absence-heure-fin','absence-sal-search'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (document.getElementById('absence-edit-id')) document.getElementById('absence-edit-id').value = '';
  if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
  afficherAbsencesPeriodes();
  afficherPlanningSemaine();
  afficherCompteurHeures();
  var typeLabel = type === 'repos' ? 'Repos' : type === 'conge' ? 'Congé' : type === 'maladie' ? 'Maladie' : 'Absence';
  afficherToast(typeLabel + ' enregistré');
};

afficherPlanningSemaine = function() {
  var lundi = getLundiDeSemaine(_planningSemaineOffset);
  var salaries = charger('salaries');
  var plannings = loadSafe('plannings', []);
  var absences = loadSafe('absences_periodes', []);
  var datesSemaine = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    datesSemaine.push(d);
  }

  var dimanche = datesSemaine[6];
  var labelSemaine = 'Semaine ' + getNumSemaine(lundi) + ' - ' + lundi.getFullYear();
  var labelDates = lundi.toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) + ' au ' + dimanche.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
  var elLabel = document.getElementById('planning-semaine-label');
  var elDates = document.getElementById('planning-semaine-dates');
  if (elLabel) elLabel.textContent = labelSemaine;
  if (elDates) elDates.textContent = labelDates;

  initFormulairePlanningRapide();

  var thead = document.getElementById('thead-planning-semaine');
  if (thead) {
    thead.innerHTML = '<tr><th>Salarié</th>' + datesSemaine.map(function(d, i) {
      var isAuj = dateToLocalISO(d) === aujourdhui();
      return '<th style="text-align:center;' + (isAuj ? 'color:var(--accent);font-weight:800' : '') + '">' + JOURS_COURTS[i].toUpperCase() + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '</th>';
    }).join('') + '</tr>';
  }

  var tb = document.getElementById('tb-planning-semaine');
  if (!tb) return;
  if (!salaries.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié</td></tr>'; return; }

  var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
  var salariesFiltres = salaries.filter(function(s) {
    if (!filtre) return true;
    return [s.nom, s.prenom, s.nomFamille, s.numero, s.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
  });

  var totalPlanifies = 0;
  var totalAbsences = 0;
  salariesFiltres.forEach(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var aUnJourTravaille = false;
    datesSemaine.forEach(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = getPlanningPeriodForDate(s.id, dateStr, absences);
      if (absJour) {
        if (absJour.type === 'travail') aUnJourTravaille = true;
        else if (absJour.type !== 'repos') totalAbsences++;
        return;
      }
      var jour = plan ? (plan.semaine || []).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (jour && jour.travaille) aUnJourTravaille = true;
    });
    if (aUnJourTravaille) totalPlanifies++;
  });

  if (document.getElementById('planning-kpi-salaries')) document.getElementById('planning-kpi-salaries').textContent = salaries.length;
  if (document.getElementById('planning-kpi-planifies')) document.getElementById('planning-kpi-planifies').textContent = totalPlanifies;
  if (document.getElementById('planning-kpi-absences')) document.getElementById('planning-kpi-absences').textContent = totalAbsences;
  if (!salariesFiltres.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>'; return; }

  function renderCell(className, title, detail, note) {
    return '<td><div class="planning-week-state ' + className + '"><span>' + title + '</span>' + (detail ? '<span class="planning-week-time">' + detail + '</span>' : '') + (note ? '<span class="planning-week-note">' + note + '</span>' : '') + '</div></td>';
  }

  tb.innerHTML = salariesFiltres.map(function(s) {
    var plan = plannings.find(function(p){ return p.salId === s.id; });
    var cellules = datesSemaine.map(function(d, i) {
      var dateStr = dateToLocalISO(d);
      var absJour = getPlanningPeriodForDate(s.id, dateStr, absences);
      if (absJour) {
        if (absJour.type === 'travail') {
          return renderPlanningCell('is-work', 'Travail', (absJour.heureDebut || '') + (absJour.heureFin ? ' - ' + absJour.heureFin : ''), '');
        }
        return renderPlanningCell('is-' + absJour.type, getPlanningPeriodLabel(absJour.type), '', '');
      }

      var jour = plan ? (plan.semaine || []).find(function(j){ return j.jour === JOURS[i]; }) : null;
      if (!jour || !jour.travaille) {
        if (jour && ['repos','conge','absence','maladie'].includes(jour.typeJour)) {
          var lb = jour.typeJour === 'repos' ? 'Repos' : jour.typeJour === 'conge' ? 'Congé' : jour.typeJour === 'maladie' ? 'Maladie' : 'Absence';
          return renderPlanningCell('is-' + jour.typeJour, lb, '', '');
        }
        return renderPlanningCell('is-rest', 'Repos', '', '');
      }

      return renderPlanningCell('is-work', 'Travail', (jour.heureDebut || '') + (jour.heureFin ? ' - ' + jour.heureFin : ''), jour.zone || '');
    }).join('');

    return '<tr><td><div class="planning-week-salarie"><strong>' + s.nom + '</strong>' + (s.poste ? '<span class="planning-week-meta">' + s.poste + '</span>' : '') + (s.numero ? '<span class="planning-week-meta">#' + s.numero + '</span>' : '') + '</div></td>' + cellules + '</tr>';
  }).join('');
};
window.__planningRewriteFinal && window.__planningRewriteFinal();

window.__planningPeriodOnlyFinal = function() {
  function planningEmployeeUsesPeriods(salId, periodes) {
    return (periodes || charger('absences_periodes')).some(function(item) { return item.salId === salId; });
  }

  function getPlanningDeleteButton(salId, dateStr, enabled) {
    if (!enabled) return '';
    return '<button type="button" class="planning-week-delete" title="Supprimer" onclick="event.stopPropagation();supprimerPlanningJour(\'' + salId + '\',\'' + dateStr + '\')">×</button>';
  }

  function planningBuildCellExtras(salarie, dateStr) {
    var extras = [];
    var livraisons = planningGetLivraisonsForDate(salarie.id, dateStr);
    if (livraisons.length) {
      extras.push('<div class="planning-week-extras planning-week-livraisons">' + livraisons.slice(0, 2).map(function(livraison) {
        return '<button type="button" class="planning-week-chip is-livraison" onclick="event.stopPropagation();ouvrirEditLivraison(\'' + livraison.id + '\')" title="' + planningEscapeHtml((livraison.numLiv || 'Livraison') + ' — ' + (livraison.client || '')) + '">' + planningEscapeHtml(livraison.numLiv || 'LIV') + '</button>';
      }).join('') + (livraisons.length > 2 ? '<span class="planning-week-chip is-more">+' + (livraisons.length - 2) + '</span>' : '') + '</div>');
    }
    var inspection = planningGetInspectionForDate(salarie.id, dateStr);
    if (!inspection) {
      extras.push('<div class="planning-week-indicator is-muted">Inspection à faire</div>');
    } else {
      extras.push('<div class="planning-week-indicator is-success">Inspection OK</div>');
    }
    return extras.join('');
  }

  function planningBuildSalarieMeta(salarie) {
    var vehicule = planningGetVehicleForSalarie(salarie.id);
    var incidents = planningGetOpenIncidentsForSalarie(salarie.id);
    return '<div class="planning-week-salarie">'
      + '<button type="button" class="planning-salarie-link" onclick="planningOuvrirFicheSalarie(\'' + salarie.id + '\')"><strong>' + planningEscapeHtml(getSalarieNomComplet(salarie)) + '</strong></button>'
      + (salarie.poste ? '<span class="planning-week-meta">' + planningEscapeHtml(salarie.poste) + '</span>' : '')
      + (vehicule ? '<span class="planning-week-meta">🚐 ' + planningEscapeHtml(vehicule.immat + (vehicule.modele ? ' — ' + vehicule.modele : '')) + '</span>' : '')
      + (salarie.numero ? '<span class="planning-week-meta">#' + planningEscapeHtml(salarie.numero) + '</span>' : '')
      + (incidents.length ? '<span class="planning-week-incident">🚨 ' + incidents.length + ' incident' + (incidents.length > 1 ? 's' : '') + '</span>' : '')
      + '</div>';
  }

  function planningRenderCellState(salarie, dateStr, className, title, detail, note, options) {
    var opts = options || {};
    var cellClass = ['planning-cell', opts.clickable !== false ? 'is-clickable' : '', opts.today ? 'is-today' : ''].filter(Boolean).join(' ');
    var attrs = 'class="' + cellClass + '" onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + (opts.typeHint || 'travail') + '\')"';
    var extras = planningBuildCellExtras(salarie, dateStr);
    return planningRenderWeekState(className, title, detail, note, extras, attrs);
  }

  function planningGetEntryForDate(salId, dateStr, periodes, planning) {
    var periodEntry = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periodEntry) return { source: 'period', entry: periodEntry };
    if (planningEmployeeUsesPeriods(salId, periodes)) return { source: 'period', entry: null };
    var dateObj = new Date(dateStr + 'T00:00:00');
    var jourNom = JOURS[(dateObj.getDay() + 6) % 7];
    var recurring = (planning?.semaine || []).find(function(item) { return item.jour === jourNom; }) || null;
    return { source: 'recurring', entry: recurring };
  }

  supprimerPlanningJour = async function(salId, dateStr) {
    var ok = await confirmDialog('Supprimer ce créneau de cette journée ?', { titre:'Supprimer le créneau', icone:'❌', btnLabel:'Supprimer' });
    if (!ok) return;

    var periodes = charger('absences_periodes');
    var periode = getPlanningPeriodForDate(salId, dateStr, periodes);
    if (periode && periode.type === 'travail') {
      var updated = periodes.filter(function(item) { return item.id !== periode.id; });
      if (periode.debut < dateStr) {
        updated.push({
          ...periode,
          id: genId(),
          fin: planningDateToLocalISO(new Date(new Date(dateStr + 'T00:00:00').getTime() - 86400000)),
          modifieLe: new Date().toISOString()
        });
      }
      if (periode.fin > dateStr) {
        updated.push({
          ...periode,
          id: genId(),
          debut: planningDateToLocalISO(new Date(new Date(dateStr + 'T00:00:00').getTime() + 86400000)),
          modifieLe: new Date().toISOString()
        });
      }
      sauvegarder('absences_periodes', updated.sort(function(a, b) { return new Date(a.debut) - new Date(b.debut); }));
      afficherPlanningSemaine();
      afficherCompteurHeures();
      return afficherToast('Créneau supprimé pour cette journée');
    }

    var plannings = charger('plannings');
    var planningIndex = plannings.findIndex(function(item) { return item.salId === salId; });
    if (planningIndex === -1) return;
    var jourNom = JOURS[(new Date(dateStr + 'T00:00:00').getDay() + 6) % 7];
    var semaine = Array.isArray(plannings[planningIndex].semaine) ? plannings[planningIndex].semaine : [];
    var jourIndex = semaine.findIndex(function(item) { return item.jour === jourNom; });
    if (jourIndex === -1) return;
    semaine[jourIndex] = {
      ...semaine[jourIndex],
      travaille: false,
      typeJour: 'repos',
      heureDebut: '',
      heureFin: '',
      zone: '',
      note: ''
    };
    plannings[planningIndex].semaine = semaine;
    plannings[planningIndex].mis_a_jour = new Date().toISOString();
    sauvegarder('plannings', plannings);
    afficherPlanningSemaine();
    afficherCompteurHeures();
    afficherToast('Créneau hebdomadaire retiré');
  };

  initFormulairePlanningRapide = function() {
    peuplerAbsenceSal();
    toggleAbsenceTypeFields();
    var title = document.querySelector('#page-planning .planning-absence-form .planning-panel-title');
    var sub = document.querySelector('#page-planning .planning-absence-form .planning-toolbar-sub');
    var layout = document.querySelector('#page-planning .planning-absence-layout');
    var list = document.querySelector('#page-planning .planning-absence-list');
    var editBtn = document.getElementById('planning-edit-work-btn');
    var btn = document.getElementById('planning-submit-btn');
    if (title) title.textContent = 'Ajouter une période';
    if (sub) sub.textContent = 'Saisis uniquement des périodes datées. Rien ne se répète automatiquement hors des dates choisies.';
    if (layout) layout.style.gridTemplateColumns = 'minmax(0, 1fr)';
    if (list) list.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    var typeSelect = document.getElementById('absence-type');
    if (typeSelect) {
      var currentType = typeSelect.value;
      typeSelect.innerHTML = ''
        + '<option value="travail">Travail</option>'
        + '<option value="conge">Congé</option>'
        + '<option value="maladie">Maladie</option>'
        + '<option value="absence">Absence</option>';
      typeSelect.value = ['travail', 'conge', 'maladie', 'absence'].includes(currentType) ? currentType : 'travail';
    }
    if (btn && !document.getElementById('absence-edit-id')?.value) btn.textContent = '+ Enregistrer la période';
  };

  afficherAbsencesPeriodes = function() {
    var list = document.querySelector('#page-planning .planning-absence-list');
    if (list) list.style.display = 'none';
  };

  ouvrirEditionTravailRapide = function() {
    afficherToast('Les périodes de planning se gèrent directement dans le formulaire.', 'info');
  };

  reinitialiserFormulairePlanningRapide = function() {
    ['absence-edit-id', 'absence-debut', 'absence-fin', 'absence-heure-debut', 'absence-heure-fin'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('absence-sal-search')) document.getElementById('absence-sal-search').value = '';
    if (document.getElementById('absence-sal')) document.getElementById('absence-sal').value = '';
    if (document.getElementById('absence-type')) document.getElementById('absence-type').value = 'travail';
    var btn = document.getElementById('planning-submit-btn');
    if (btn) btn.textContent = '+ Enregistrer la période';
    toggleAbsenceTypeFields();
  };

  ajouterPeriodeAbsence = function() {
    try {
      var salarie = planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
      var type = document.getElementById('absence-type')?.value || 'travail';
      var debut = document.getElementById('absence-debut')?.value || '';
      var fin = document.getElementById('absence-fin')?.value || '';
      var heureDebut = document.getElementById('absence-heure-debut')?.value || '';
      var heureFin = document.getElementById('absence-heure-fin')?.value || '';
      var editId = document.getElementById('absence-edit-id')?.value || '';
      if (!salarie || !debut || !fin) return afficherToast('Salarié, date de début et date de fin obligatoires', 'error');
      if (fin < debut) return afficherToast('La date de fin doit être postérieure à la date de début', 'error');
      if (type === 'travail' && (!heureDebut || !heureFin || calculerDureeJour(heureDebut, heureFin) <= 0)) return afficherToast('Renseigne des horaires de travail valides', 'error');

      var periodes = charger('absences_periodes');
      var payload = {
        id: editId || genId(),
        salId: salarie.id,
        salNom: salarie.nom || '',
        type: type,
        debut: debut,
        fin: fin,
        heureDebut: type === 'travail' ? heureDebut : '',
        heureFin: type === 'travail' ? heureFin : '',
        creeLe: editId ? (periodes.find(function(item) { return item.id === editId; })?.creeLe || new Date().toISOString()) : new Date().toISOString(),
        modifieLe: new Date().toISOString()
      };
      var index = periodes.findIndex(function(item) { return item.id === payload.id; });
      if (index > -1) periodes[index] = payload; else periodes.push(payload);
      sauvegarder('absences_periodes', periodes);
      reinitialiserFormulairePlanningRapide();
      if (typeof afficherAbsencesPeriodes === 'function') afficherAbsencesPeriodes();
      afficherPlanningSemaine();
      afficherCompteurHeures();
      rafraichirDashboard();
      afficherToast(editId ? 'Période mise à jour' : 'Période enregistrée');
    } catch (error) {
      console.error('ajouterPeriodeAbsence', error);
      afficherToast('⚠️ Enregistrement impossible pour cette période', 'error');
    }
  };

  afficherPlanningSemaine = function() {
    initFormulairePlanningRapide();
    var period = planningGetDisplayedPeriod();
    var range = period.range;
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var periodes = charger('absences_periodes');
    var filtre = (document.getElementById('filtre-planning-salarie')?.value || '').trim().toLowerCase();
    var planningSelect = document.getElementById('vue-planning-select');
    var label = document.getElementById('planning-semaine-label');
    var datesLabel = document.getElementById('planning-semaine-dates');
    var thead = document.getElementById('thead-planning-semaine');
    var tbody = document.getElementById('tb-planning-semaine');
    var table = document.querySelector('#page-planning .planning-week-grid');
    if (planningSelect) planningSelect.value = _planningPeriode.mode || 'semaine';
    if (table) table.classList.toggle('is-month-view', period.mode === 'mois');
    if (table) table.classList.toggle('is-day-view', period.mode === 'jour');
    if (label) label.textContent = range.label || '';
    if (datesLabel) datesLabel.textContent = range.datesLabel || '';
    if (thead) {
      if (period.mode === 'annee') {
        thead.innerHTML = '<tr><th>Salarié</th>' + period.months.map(function(month) {
          return '<th style="text-align:center">' + month.label + '</th>';
        }).join('') + '</tr>';
      } else if (period.mode === 'mois') {
        thead.innerHTML = '<tr><th>Salarié</th>' + period.weeks.map(function(week) {
          return '<th style="text-align:center"><div>' + week.label + '</div><div style="font-size:.68rem;color:var(--text-muted);font-weight:500;text-transform:none;letter-spacing:0">' + week.meta + '</div></th>';
        }).join('') + '</tr>';
      } else {
        thead.innerHTML = '<tr><th>Salarié</th>' + period.dates.map(function(dateObj, index) {
          var dayLabel = period.mode === 'jour'
            ? formatDateExport(dateObj)
            : (JOURS_COURTS[index % 7].toUpperCase() + ' ' + formatDateExport(dateObj).slice(0, 5));
          return '<th style="text-align:center">' + dayLabel + '</th>';
        }).join('') + '</tr>';
      }
    }
    if (!tbody) return;
    if (!salaries.length) {
      tbody.innerHTML = '<tr><td colspan="' + (period.mode === 'annee' ? 13 : period.mode === 'mois' ? ((period.weeks?.length || 0) + 1) : ((period.dates?.length || 0) + 1)) + '" class="empty-row">Aucun salarié</td></tr>';
      return;
    }
    var filtered = salaries.filter(function(salarie) {
      if (!filtre) return true;
      return [planningBuildEmployeeLabel(salarie), salarie.nom, salarie.prenom, salarie.numero, salarie.poste].filter(Boolean).join(' ').toLowerCase().includes(filtre);
    });
    var totalPlanifies = 0;
    var totalAbsences = 0;
    tbody.innerHTML = filtered.length ? filtered.map(function(salarie) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var hasWork = false;
      var cells = '';
      if (period.mode === 'annee') {
        cells = period.months.map(function(month) {
          var workDays = 0;
          var absenceDays = 0;
          for (var day = 1; day <= 31; day++) {
            var dateObj = new Date(month.year, month.index, day);
            if (dateObj.getMonth() !== month.index) break;
            var resolved = planningGetEntryForDate(salarie.id, planningDateToLocalISO(dateObj), periodes, planning);
            var entry = resolved.entry;
            if (!entry) continue;
            if (resolved.source === 'period') {
              if (entry.type === 'travail') workDays += 1;
              else if (entry.type !== 'repos') absenceDays += 1;
            } else if (entry.typeJour === 'travail' && entry.travaille) {
              workDays += 1;
            } else if (['conge', 'absence', 'maladie'].includes(entry.typeJour)) {
              absenceDays += 1;
            }
          }
          if (workDays > 0) hasWork = true;
          totalAbsences += absenceDays;
          if (!workDays && !absenceDays) return planningRenderWeekState('is-rest', 'Non planifié', '', '', '', 'class="planning-cell"');
          var detail = workDays ? (workDays + ' j') : '';
          var note = absenceDays ? (absenceDays + ' abs.') : '';
          var className = workDays ? 'is-work' : 'is-absence';
          var title = workDays ? 'Planifié' : 'Absences';
          return planningRenderWeekState(
            className,
            title,
            detail,
            note,
            '',
            'class="planning-cell" onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + planningDateToLocalISO(month.start) + '\',\'' + planningDateToLocalISO(month.end) + '\',\'' + planningEscapeHtml(month.label + ' ' + month.year).replace(/'/g, '&#39;') + '\')"'
          );
        }).join('');
      } else if (period.mode === 'mois') {
        cells = period.weeks.map(function(week) {
          var workDays = 0;
          var absenceDays = 0;
          var livraisonCount = 0;
          var inspectionCount = 0;
          week.dates.forEach(function(dateObj) {
            var dateStr = planningDateToLocalISO(dateObj);
            var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
            var entry = resolved.entry;
            if (entry) {
              if (resolved.source === 'period') {
                if (entry.type === 'travail') workDays += 1;
                else if (entry.type !== 'repos') absenceDays += 1;
              } else if (entry.typeJour === 'travail' && entry.travaille) {
                workDays += 1;
              } else if (['conge', 'absence', 'maladie'].includes(entry.typeJour)) {
                absenceDays += 1;
              }
            }
            livraisonCount += planningGetLivraisonsForDate(salarie.id, dateStr).length;
            if (planningGetInspectionForDate(salarie.id, dateStr)) inspectionCount += 1;
          });
          if (workDays > 0) hasWork = true;
          totalAbsences += absenceDays;
          var detail = workDays ? (workDays + ' j planifiés') : (absenceDays ? 'Absence / congé' : '');
          var noteParts = [];
          if (livraisonCount) noteParts.push(livraisonCount + ' livr.');
          if (inspectionCount) noteParts.push(inspectionCount + ' insp.');
          if (absenceDays) noteParts.push(absenceDays + ' abs.');
          var note = noteParts.join(' · ');
          var className = workDays ? 'is-work' : (absenceDays ? 'is-absence' : 'is-rest');
          var title = workDays ? 'Semaine active' : (absenceDays ? 'Indisponibilité' : 'Non planifié');
          return planningRenderWeekState(className, title, detail, note, '', 'class="planning-cell planning-cell-month" onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + planningDateToLocalISO(week.start) + '\',\'' + planningDateToLocalISO(week.end) + '\',\'' + planningEscapeHtml(week.label + ' · ' + week.meta).replace(/'/g, '&#39;') + '\')"');
        }).join('');
      } else {
        cells = period.dates.map(function(dateObj) {
          var dateStr = planningDateToLocalISO(dateObj);
          var isToday = dateStr === aujourdhui();
          var recapLabel = formatDateExport(dateObj);
          var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
          var entry = resolved.entry;
          if (!entry) {
            var emptyCell = planningRenderCellState(salarie, dateStr, 'is-rest', period.mode === 'jour' ? 'Aucun créneau' : 'Non planifié', '', '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
            if (period.mode === 'jour') emptyCell = emptyCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return emptyCell;
          }
          if (resolved.source === 'period') {
            if (entry.type === 'travail') {
              hasWork = true;
              var workedPeriodCell = planningRenderCellState(salarie, dateStr, 'is-work', period.mode === 'jour' ? 'Journée travaillée' : 'Travail', (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : ''), '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : '')).replace('<div class="planning-week-state is-work">', '<div class="planning-week-state is-work">' + getPlanningDeleteButton(salarie.id, dateStr, true));
              if (period.mode === 'jour') workedPeriodCell = workedPeriodCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
              return workedPeriodCell;
            }
            if (entry.type === 'repos') {
              var reposCell = planningRenderCellState(salarie, dateStr, 'is-repos', 'Repos', '', '', { today: isToday, typeHint: 'repos' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
              if (period.mode === 'jour') reposCell = reposCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'repos\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
              return reposCell;
            }
            totalAbsences += 1;
            var periodAbsCell = planningRenderCellState(salarie, dateStr, 'is-' + entry.type, getPlanningPeriodLabel(entry.type), '', '', { today: isToday, typeHint: entry.type }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
            if (period.mode === 'jour') periodAbsCell = periodAbsCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + entry.type + '\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return periodAbsCell;
          }
          if (entry.typeJour === 'travail' && entry.travaille) {
            hasWork = true;
            var workedRecurringCell = planningRenderCellState(salarie, dateStr, 'is-work', period.mode === 'jour' ? 'Journée travaillée' : 'Travail', (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : ''), entry.zone || entry.note || '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : '')).replace('<div class="planning-week-state is-work">', '<div class="planning-week-state is-work">' + getPlanningDeleteButton(salarie.id, dateStr, true));
            if (period.mode === 'jour') workedRecurringCell = workedRecurringCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return workedRecurringCell;
          }
          if (['repos', 'conge', 'absence', 'maladie'].includes(entry.typeJour)) {
            if (entry.typeJour !== 'repos') totalAbsences += 1;
            var statusCell = planningRenderCellState(salarie, dateStr, 'is-' + entry.typeJour, entry.typeJour === 'repos' ? 'Repos' : getPlanningPeriodLabel(entry.typeJour), '', '', { today: isToday, typeHint: entry.typeJour }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
            if (period.mode === 'jour') statusCell = statusCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + entry.typeJour + '\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
            return statusCell;
          }
          var fallbackCell = planningRenderCellState(salarie, dateStr, 'is-rest', period.mode === 'jour' ? 'Aucun créneau' : 'Non planifié', '', '', { today: isToday, typeHint: 'travail' }).replace('class="planning-cell', 'class="planning-cell ' + (period.mode === 'jour' ? 'planning-cell-day' : ''));
          if (period.mode === 'jour') fallbackCell = fallbackCell.replace('onclick="planningOuvrirSaisieRapide(\'' + salarie.id + '\',\'' + dateStr + '\',\'travail\')"', 'onclick="ouvrirRecapPlanningPeriode(\'' + salarie.id + '\',\'' + dateStr + '\',\'' + dateStr + '\',\'' + recapLabel + '\')"');
          return fallbackCell;
        }).join('');
      }
      if (hasWork) totalPlanifies += 1;
      return '<tr><td>' + planningBuildSalarieMeta(salarie) + '</td>' + cells + '</tr>';
    }).join('') : '<tr><td colspan="' + (period.mode === 'annee' ? 13 : period.mode === 'mois' ? ((period.weeks?.length || 0) + 1) : ((period.dates?.length || 0) + 1)) + '" class="empty-row">Aucun salarié ne correspond à la recherche</td></tr>';
    var kpiSal = document.getElementById('planning-kpi-salaries');
    var kpiPlan = document.getElementById('planning-kpi-planifies');
    var kpiAbs = document.getElementById('planning-kpi-absences');
    if (kpiSal) kpiSal.textContent = salaries.length;
    if (kpiPlan) kpiPlan.textContent = totalPlanifies;
    if (kpiAbs) kpiAbs.textContent = totalAbsences;
  };

  exporterPlanningSemainePDF = function() {
    var week = planningGetWeekDates();
    var salaries = charger('salaries');
    var plannings = charger('plannings');
    var periodes = charger('absences_periodes');
    var params = getEntrepriseExportParams();
    var dateExp = formatDateHeureExport();
    var titreSemaine = 'Semaine ' + getNumSemaine(week.lundi) + ' — ' + formatDateExport(week.lundi) + ' au ' + formatDateExport(week.dimanche);
    var stateStyles = {
      travail: { bg:'#e9f8ef', border:'#b7e7c8', color:'#177245', label:'Travail' },
      repos: { bg:'#f4f5f7', border:'#d7dbe2', color:'#6b7280', label:'Repos' },
      conge: { bg:'#eaf3ff', border:'#c7defd', color:'#3498db', label:'Congé' },
      maladie: { bg:'#f4edff', border:'#dcc8fa', color:'#9b59b6', label:'Maladie' },
      absence: { bg:'#fdeeee', border:'#f7c7c7', color:'#e74c3c', label:'Absence' }
    };
    function getStateBlockStyle(style, extra) {
      return 'min-height:56px;display:flex;align-items:center;justify-content:center;padding:8px 6px;border-radius:12px;background:' + style.bg + ';border:1px solid ' + style.border + ';color:' + style.color + ';-webkit-print-color-adjust:exact;print-color-adjust:exact;' + (extra || '');
    }
    function formatCellulePlanning(salarie, dateObj, planning) {
      var dateStr = planningDateToLocalISO(dateObj);
      var resolved = planningGetEntryForDate(salarie.id, dateStr, periodes, planning);
      var entry = resolved.entry;
      if (!entry) {
        var restStyle = stateStyles.repos;
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(restStyle, 'font-size:.78rem') + '">Repos</div></td>';
      }
      if (resolved.source === 'period') {
        if (entry.type === 'travail') {
          var workStyle = stateStyles.travail;
          var horaire = (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '');
          return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(workStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">Travail</span><span style="font-size:.76rem;font-weight:600">' + horaire + '</span></div></td>';
        }
        if (entry.type === 'repos') {
          var periodRestStyle = stateStyles.repos;
          return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodRestStyle, 'font-size:.78rem') + '">Repos</div></td>';
        }
        var periodStyle = stateStyles[entry.type] || stateStyles.absence;
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(periodStyle, 'font-size:.78rem;font-weight:700') + '">' + getPlanningPeriodLabel(entry.type) + '</div></td>';
      }
      if (entry.typeJour === 'travail' && entry.travaille) {
        var recurringWorkStyle = stateStyles.travail;
        var recurringHoraire = (entry.heureDebut || '') + (entry.heureFin ? ' - ' + entry.heureFin : '');
        return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(recurringWorkStyle, 'flex-direction:column;gap:4px;text-align:center') + '"><span style="font-size:.78rem;font-weight:700">Travail</span><span style="font-size:.76rem;font-weight:600">' + recurringHoraire + '</span></div></td>';
      }
      var recurringStyle = stateStyles[entry.typeJour] || stateStyles.repos;
      return '<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb"><div style="' + getStateBlockStyle(recurringStyle, 'font-size:.78rem;font-weight:700') + '">' + getPlanningPeriodLabel(entry.typeJour || 'repos') + '</div></td>';
    }
    var rows = salaries.map(function(salarie, index) {
      var planning = plannings.find(function(item) { return item.salId === salarie.id; }) || { semaine: [] };
      var cells = week.dates.map(function(dateObj) {
        return formatCellulePlanning(salarie, dateObj, planning);
      }).join('');
      return '<tr style="background:' + (index % 2 === 0 ? '#fff' : '#fafafa') + '"><td style="padding:10px 12px;font-weight:600;border-bottom:1px solid #e5e7eb;min-width:170px">' + (salarie.nom || '') + (salarie.poste ? '<br><span style="font-size:.74rem;color:#9ca3af">' + salarie.poste + '</span>' : '') + '</td>' + cells + '</tr>';
    }).join('');
    var thead = week.dates.map(function(dateObj, dayIndex) {
      return '<th style="padding:10px 8px;text-align:center;color:#6b7280;font-weight:600;border-bottom:1px solid #dfe3ea;min-width:92px">' + JOURS_COURTS[dayIndex] + '<div style="font-size:.76rem;color:#9ca3af;margin-top:2px">' + formatDateExport(dateObj).slice(0, 5) + '</div></th>';
    }).join('');
    var html = '<style>@page{size:landscape;margin:10mm}body,table,thead,tbody,tr,th,td,div,span{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}</style><div style="font-family:Segoe UI,Arial,sans-serif;width:100%;padding:22px 24px;color:#1a1d27;box-sizing:border-box">'
      + construireEnteteExport(params, 'Planning hebdomadaire', titreSemaine, dateExp)
      + '<div style="margin:0 0 16px;font-size:.88rem;color:#4b5563">Période : <strong>' + formatDateExport(week.lundi) + '</strong> au <strong>' + formatDateExport(week.dimanche) + '</strong></div>'
      + '<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;table-layout:fixed"><thead><tr style="background:#f3f4f6"><th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;border-bottom:1px solid #dfe3ea;min-width:170px">Salarié</th>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table>'
      + renderFooterEntreprise(params, dateExp, 'Planning hebdomadaire')
      + '</div>';
    ouvrirFenetreImpression('Planning ' + titreSemaine, html, 'width=1200,height=780');
    afficherToast('Rapport planning généré');
  };
};

window.__planningPeriodOnlyFinal();

// MOVED -> script-planning.js : planningPrepareEmployeeInput

peuplerAbsenceSal = function() {
  planningSyncSearchWithSelect('absence-sal-search', 'absence-sal');
  planningPrepareEmployeeInput('absence-sal-search', 'absence-sal-suggestions');
};

filtrerRechercheAbsence = function() {
  planningResolveSelectedEmployee('absence-sal-search', 'absence-sal');
  planningRenderEmployeeSuggestions('absence-sal-search', 'absence-sal', 'absence-sal-suggestions');
};

peuplerSelectPlanningModal = function() {
  planningSyncSearchWithSelect('plan-salarie-search', 'plan-salarie');
  planningPrepareEmployeeInput('plan-salarie-search', 'plan-salarie-suggestions');
};

filtrerRecherchePlanningModal = function() {
  var salarie = planningResolveSelectedEmployee('plan-salarie-search', 'plan-salarie');
  planningRenderEmployeeSuggestions('plan-salarie-search', 'plan-salarie', 'plan-salarie-suggestions', function() {
    genererGrilleJours();
  });
  if (salarie) genererGrilleJours();
};

document.addEventListener('click', function(event) {
  [
    { input: 'absence-sal-search', box: 'absence-sal-suggestions' },
    { input: 'plan-salarie-search', box: 'plan-salarie-suggestions' }
  ].forEach(function(entry) {
    var input = document.getElementById(entry.input);
    var box = document.getElementById(entry.box);
    if (!input || !box) return;
    if (input.contains(event.target) || box.contains(event.target)) return;
    box.innerHTML = '';
    box.style.display = 'none';
  });
});

/* ===== RENTABILITE — Calculateur avancé ===== */
var RENTABILITE_STORAGE_KEY = 'rentabilite_calculateur_v2';

// MOVED -> script-rentabilite.js : getRentabiliteDefaults

// MOVED -> script-rentabilite.js : chargerRentabiliteConfig

// MOVED -> script-rentabilite.js : sauvegarderRentabiliteConfig

// MOVED -> script-rentabilite.js : rentabiliteGetContainer

// MOVED -> script-rentabilite.js : rentabiliteWireEvents

// MOVED -> script-rentabilite.js : getRentabiliteLivraisonLabel

// MOVED -> script-rentabilite.js : rentabiliteGetSelectedLivraison

// MOVED -> script-rentabilite.js : rentabiliteGetVehiculeActif

// MOVED -> script-rentabilite.js : rentabiliteGetMoisReference

// MOVED -> script-rentabilite.js : rentabiliteGetChargesReellesMois

// MOVED -> script-rentabilite.js : rentabiliteGetPrixCarburantMoyen

// MOVED -> script-rentabilite.js : rentabiliteUpdateFuelHelper

// MOVED -> script-rentabilite.js : rentabiliteAppliquerPrixCarburantReel

// MOVED -> script-rentabilite.js : rentabiliteChargerDepuisVehicule

// MOVED -> script-rentabilite.js : rentabiliteChargerChargesReelles

// MOVED -> script-rentabilite.js : rentabiliteHasChargeDoublonLLD

// MOVED -> script-rentabilite.js : rentabiliteApplyLivraisonToConfig

// MOVED -> script-rentabilite.js : rentabiliteRenderLivraisonsSelect

// MOVED -> script-rentabilite.js : rentabiliteToggleMode

// MOVED -> script-rentabilite.js : rentabiliteRenderCharges

// MOVED -> script-rentabilite.js : rentabiliteFillInputs

// MOVED -> script-rentabilite.js : rentabiliteReadFromDom

// MOVED -> script-rentabilite.js : calculerRentabiliteAvancee

// MOVED -> script-rentabilite.js : rentabiliteFormatJours

// MOVED -> script-rentabilite.js : rentabiliteRenderAlerts

// MOVED -> script-rentabilite.js : rentabiliteRenderResults

// MOVED -> script-rentabilite.js : rentabiliteSyncFromDom

// MOVED -> script-rentabilite.js : ajouterChargeRentabilite

supprimerChargeRentabilite = async function(id) {
  var ok = await confirmDialog('Supprimer cette charge ?', { titre: 'Supprimer la charge', icone: '💸', btnLabel: 'Supprimer' });
  if (!ok) return;
  var config = chargerRentabiliteConfig();
  config.autresCharges = (config.autresCharges || []).filter(function(item) { return item.id !== id; });
  sauvegarderRentabiliteConfig(config);
  rentabiliteRenderCharges(config);
  rentabiliteSyncFromDom();
};

afficherRentabilite = function() {
  rentabiliteWireEvents();
  var config = chargerRentabiliteConfig();
  if (config.modeCalcul === 'livraison') {
    config = rentabiliteApplyLivraisonToConfig(config);
    sauvegarderRentabiliteConfig(config);
  }
  rentabiliteFillInputs(config);
  rentabiliteRenderResults(calculerRentabiliteAvancee(config), config);
};

genererRentabilitePDF = function() {
  var config = chargerRentabiliteConfig();
  if (config.modeCalcul === 'livraison') config = rentabiliteApplyLivraisonToConfig(config, { forceDaysMinOne: false });
  var results = calculerRentabiliteAvancee(config);
  if (results.joursInvalides) {
    afficherToast('Renseignez au moins 1 jour / occurrence avant de générer le rapport', 'error');
    return;
  }
  var params = getEntrepriseExportParams();
  var dateExp = formatDateHeureExport();
  var html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:28px;color:#1a1d27">'
    + construireEnteteExport(params, 'Rapport de rentabilité', 'Calculateur financier', dateExp)
    + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:18px 0">'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:.75rem;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Activité</div><div style="display:grid;gap:8px;font-size:.92rem"><div>Mode : <strong>' + (config.modeCalcul === 'livraison' ? 'Livraison ciblée' : 'Simulation manuelle') + '</strong></div><div>' + (config.modeCalcul === 'livraison' ? 'Distance livraison' : 'Km / jour') + ' : <strong>' + results.kmJour + '</strong></div><div>Prix / km HT : <strong>' + parseFloat(results.prixKm || 0).toFixed(2).replace('.', ',') + ' €</strong></div><div>' + (config.modeCalcul === 'livraison' ? 'Occurrences mensuelles' : 'Jours travaillés') + ' : <strong>' + results.joursTravailles + '</strong></div>' + (results.livraison ? '<div>Livraison : <strong>' + planningEscapeHtml(getRentabiliteLivraisonLabel(results.livraison)) + '</strong></div><div>CA HT par livraison : <strong>' + euros(results.caLivraisonHT || 0) + '</strong></div>' : '') + '</div></div>'
    + '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px"><div style="font-size:.75rem;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Coûts mensuels</div><div style="display:grid;gap:8px;font-size:.92rem"><div>Répartition charges fixes : <strong>' + (config.repartitionCharges === 'prorata' ? 'Proratisée' : 'Mois complet') + '</strong></div><div>Carburant HT : <strong>' + euros(results.coutCarburant) + '</strong></div><div>Charges fixes imputées HT : <strong>' + euros(results.chargesFixes) + '</strong></div><div>Charges fixes mensuelles HT : <strong>' + euros(results.chargesFixesMensuelles) + '</strong></div><div>Coût total HT : <strong>' + euros(results.coutTotal) + '</strong></div></div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px">'
    + [
      ['CA HT', euros(results.caHT), '#177245'],
      ['CA TTC', euros(results.caTTC), '#2563eb'],
      ['Bénéfice net', euros(results.beneficeNet), results.beneficeNet >= 0 ? '#177245' : '#e74c3c'],
      ['Seuil de rentabilité', rentabiliteFormatJours(results.seuilJours), '#f5a623'],
      ['Point mort', results.pointMortCA != null ? euros(results.pointMortCA) : 'Non atteignable', '#7c3aed'],
      ['Coût / km', euros(results.coutParKm) + '/km', '#4b5563'],
      ['Marge / km', euros(results.margeParKm) + '/km', results.margeParKm >= 0 ? '#177245' : '#e74c3c'],
      ['Revenu journalier', euros(results.revenuJournalier), '#111827'],
      ['Coût variable / jour', euros(results.coutVariableJournalier), '#f97316']
    ].map(function(item) {
      return '<div style="background:#f8fafc;border-radius:14px;padding:14px;border-top:3px solid ' + item[2] + '"><div style="font-size:.75rem;color:#6b7280;margin-bottom:6px">' + item[0] + '</div><div style="font-size:1.05rem;font-weight:800;color:' + item[2] + '">' + item[1] + '</div></div>';
    }).join('')
    + '</div>'
    + '<div style="padding:14px 16px;border-radius:14px;background:' + (results.beneficeNet >= 0 ? '#ecfdf5' : '#fef2f2') + ';border:1px solid ' + (results.beneficeNet >= 0 ? '#bbf7d0' : '#fecaca') + ';font-size:.92rem">'
    + (results.seuilJours != null ? 'Votre activité devient rentable à partir de <strong>' + rentabiliteFormatJours(results.seuilJours) + '</strong> par mois.' : 'Votre activité n’atteint pas le seuil de rentabilité avec les paramètres actuels.')
    + '</div>'
    + renderFooterEntreprise(params, dateExp, 'Rapport de rentabilité')
    + '</div>';
  ouvrirFenetreImpression('Rentabilité - ' + (params.nom || 'Entreprise'), html, 'width=1024,height=760');
  afficherToast('Rapport rentabilité généré');
};


/* ========== SYNCHRO ADMIN POLLING ========== */
(function() {
  let pollInterval = null;
  let lastHashes = {};

  function hashData(key) {
    const raw = localStorage.getItem(key) || '';
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  function detecterChangementsAdmin() {
    const sessionRole = sessionStorage.getItem('role');
    if (sessionRole !== 'admin') return;

    const cles = [
      'livraisons','plannings','absences_periodes',
      'inspections','carburant','salaries','vehicules',
      'incidents'
    ];

    const salaries = loadSafe('salaries', []);
    salaries.forEach(s => cles.push('messages_' + s.id));
    salaries.forEach(s => cles.push('km_sal_' + s.id));
    salaries.forEach(s => cles.push('carb_sal_' + s.id));

    let needsRefresh = false;
    cles.forEach(cle => {
      const h = hashData(cle);
      if (lastHashes[cle] !== undefined && lastHashes[cle] !== h) {
        needsRefresh = true;
      }
      lastHashes[cle] = h;
    });

    if (needsRefresh) {
      const pageActive = document.querySelector('.page.active')?.id;
      if (pageActive === 'page-dashboard' && typeof afficherDashboard === 'function') afficherDashboard();
      if (pageActive === 'page-livraisons' && typeof afficherLivraisons === 'function') afficherLivraisons();
      if (pageActive === 'page-heures' && typeof afficherCompteurHeures === 'function') afficherCompteurHeures();
      if (pageActive === 'page-planning' && typeof afficherPlanningSemaine === 'function') afficherPlanningSemaine();
      if (pageActive === 'page-inspections' && typeof afficherInspections === 'function') afficherInspections();
      if (pageActive === 'page-carburant' && typeof afficherCarburant === 'function') afficherCarburant();
      if (pageActive === 'page-salaries' && typeof afficherSalaries === 'function') afficherSalaries();
      if (typeof afficherBadgeAlertes === 'function') afficherBadgeAlertes();
    }
  }

  document.addEventListener('visibilitychange', function() {
    const delay = document.hidden ? 30000 : 5000;
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(detecterChangementsAdmin, delay);
    if (!document.hidden) detecterChangementsAdmin();
  });

  setTimeout(function() {
    detecterChangementsAdmin();
    pollInterval = setInterval(detecterChangementsAdmin, 5000);
  }, 3000);
})();

/* ================================================================
   SPRINT 2 — SIDEBAR HIÉRARCHIQUE REPLIABLE
   Gère l'ouverture/fermeture des sections de la sidebar admin
   avec persistance localStorage (clé: nav_sections_collapsed).
   ================================================================ */
(function() {
  const LS_KEY = 'nav_sections_collapsed';

  function lireEtatReplie() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function ecrireEtatReplie(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (e) { /* quota ou mode privé — on ignore */ }
  }

  window.toggleNavSection = function(id) {
    const section = document.querySelector('.nav-section[data-section="' + id + '"]');
    if (!section) return;
    section.classList.toggle('collapsed');
    const isCollapsed = section.classList.contains('collapsed');

    // Met à jour aria-expanded sur le header
    const header = section.querySelector('.nav-section-header');
    if (header) header.setAttribute('aria-expanded', String(!isCollapsed));

    // Persiste l'état
    const list = lireEtatReplie();
    const idx = list.indexOf(id);
    if (isCollapsed && idx === -1) list.push(id);
    else if (!isCollapsed && idx !== -1) list.splice(idx, 1);
    ecrireEtatReplie(list);
  };

  function initNavSections() {
    const list = lireEtatReplie();
    list.forEach(function(id) {
      const section = document.querySelector('.nav-section[data-section="' + id + '"]');
      if (section) {
        section.classList.add('collapsed');
        const header = section.querySelector('.nav-section-header');
        if (header) header.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavSections);
  } else {
    initNavSections();
  }

})();

/* ================================================================
   SPRINT 3 — COMMAND PALETTE (Cmd/Ctrl + K)
   Enrichit la recherche globale existante avec :
   - actions rapides (navigation, création)
   - suggestions par défaut à l'ouverture
   - navigation clavier ↑↓ Entrée
   Surcharge rechercheUniverselle() et ouvrirRechercheGlobale()
   sans casser leur API publique.
   ================================================================ */
(function() {
  const CMD_ACTIONS = [
    // Navigation
    { icon:'📊', label:'Dashboard',            cat:'Aller à', keys:['dashboard','accueil','home','pilotage'],    run:() => naviguerVers('dashboard') },
    { icon:'📦', label:'Livraisons',           cat:'Aller à', keys:['livraisons','courses','missions'],          run:() => naviguerVers('livraisons') },
    { icon:'📅', label:'Planning',             cat:'Aller à', keys:['planning','agenda','semaine'],              run:() => naviguerVers('planning') },
    { icon:'🔔', label:'Alertes',              cat:'Aller à', keys:['alertes','notifications'],                  run:() => naviguerVers('alertes') },
    { icon:'🧑‍💼', label:'Clients',            cat:'Aller à', keys:['clients','carnet'],                         run:() => naviguerVers('clients') },
    { icon:'🚐', label:'Véhicules',            cat:'Aller à', keys:['vehicules','véhicules','flotte','camions'], run:() => naviguerVers('vehicules') },
    { icon:'⛽', label:'Carburant',            cat:'Aller à', keys:['carburant','essence','fuel','pleins'],      run:() => naviguerVers('carburant') },
    { icon:'🔧', label:'Entretiens',           cat:'Aller à', keys:['entretiens','maintenance','revisions'],     run:() => naviguerVers('entretiens') },
    { icon:'🚗', label:'Inspections',          cat:'Aller à', keys:['inspections','controles','contrôles'],      run:() => naviguerVers('inspections') },
    { icon:'👥', label:'Salariés',             cat:'Aller à', keys:['salaries','salariés','équipe','equipe','staff'], run:() => naviguerVers('salaries') },
    { icon:'⏱️', label:'Heures & Km',          cat:'Aller à', keys:['heures','km','kilometres','temps'],         run:() => naviguerVers('heures') },
    { icon:'🚨', label:'Incidents',            cat:'Aller à', keys:['incidents','accidents','problemes'],        run:() => naviguerVers('incidents') },
    { icon:'💸', label:'Charges',              cat:'Aller à', keys:['charges','depenses','dépenses','couts'],    run:() => naviguerVers('charges') },
    { icon:'💰', label:'Rentabilité',          cat:'Aller à', keys:['rentabilite','rentabilité','marge','profit'], run:() => naviguerVers('rentabilite') },
    { icon:'📈', label:'Statistiques',         cat:'Aller à', keys:['statistiques','stats','analytics'],         run:() => naviguerVers('statistiques') },
    { icon:'⚙️', label:'Paramètres',           cat:'Aller à', keys:['parametres','paramètres','settings','config'], run:() => naviguerVers('parametres') },
    // Création
    { icon:'➕', label:'Nouvelle livraison',   cat:'Créer', hint:'Ctrl+N', keys:['nouvelle livraison','new livraison','ajouter livraison','creer livraison'], run:() => { if (typeof openModal === 'function') openModal('modal-livraison'); } },
    { icon:'💸', label:'Nouvelle charge',      cat:'Créer', keys:['nouvelle charge','ajouter charge'],          run:() => { if (typeof openModal === 'function') openModal('modal-charge'); } },
    { icon:'🔧', label:'Nouvel entretien',     cat:'Créer', keys:['nouvel entretien','ajouter entretien'],      run:() => { if (typeof openModal === 'function') openModal('modal-entretien'); } },
    { icon:'📅', label:'Gérer le planning',    cat:'Créer', keys:['planning','creer planning','ajouter planning'], run:() => { if (typeof openModal === 'function') openModal('modal-planning'); } },
    // Actions générales
    { icon:'🌙', label:'Basculer thème clair/sombre', cat:'Action', keys:['theme','thème','sombre','clair','dark','light','mode'], run:() => { if (typeof toggleTheme === 'function') toggleTheme(); } }
  ];

  function normalize(s) { return (s || '').toString().toLowerCase(); }

  function matcherActions(q) {
    const qn = normalize(q).trim();
    if (!qn) return CMD_ACTIONS.slice(0, 6);
    return CMD_ACTIONS.filter(function(a) {
      if (normalize(a.label).includes(qn)) return true;
      return a.keys.some(function(k) { return normalize(k).includes(qn); });
    }).slice(0, 8);
  }

  function rendrerActionRow(a, idx) {
    const hint = a.hint ? '<span class="cmd-action-hint">' + a.hint + '</span>' : '';
    const cat  = a.cat ? '<span class="cmd-action-cat">' + a.cat + '</span>' : '';
    return '<div class="cmd-action-row" data-cmd-action="' + idx + '" role="option" tabindex="-1">' +
             '<span class="cmd-action-icon">' + a.icon + '</span>' +
             '<span class="cmd-action-label">' + a.label + '</span>' +
             cat + hint +
           '</div>';
  }

  // BUG-025/026/027 fix : dispatcher whitelisté + escape HTML (plus de new Function, plus d'innerHTML brut)
  const CMD_ENTITY_HANDLERS = {
    rechercheOuvrirLivraison: function(id) { if (typeof rechercheOuvrirLivraison === 'function') rechercheOuvrirLivraison(id); },
    ouvrirEditSalarie: function(id) { if (typeof ouvrirEditSalarie === 'function') ouvrirEditSalarie(id); },
    ouvrirFicheVehiculeDepuisTableau: function(id) { if (typeof ouvrirFicheVehiculeDepuisTableau === 'function') ouvrirFicheVehiculeDepuisTableau(id); },
    rechercheOuvrirClient: function(id) { if (typeof rechercheOuvrirClient === 'function') rechercheOuvrirClient(id); }
  };
  function escCmd(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function calculerEntites(q) {
    try {
      const livraisons = typeof charger === 'function' ? (charger('livraisons') || []) : [];
      const salaries   = typeof charger === 'function' ? (charger('salaries')   || []) : [];
      const vehicules  = typeof charger === 'function' ? (charger('vehicules')  || []) : [];
      let clients = [];
      try { clients = loadSafe('clients', []); } catch (_) { clients = []; }

      const res = [];
      const qn = normalize(q);

      livraisons.filter(function(l) {
        return normalize(l.client).includes(qn) || normalize(l.numLiv).includes(qn) || normalize(l.chaufNom).includes(qn);
      }).slice(0, 4).forEach(function(l) {
        const sub = (typeof formatDateExport === 'function' ? formatDateExport(l.date) : (l.date || '')) +
                    ' · ' + (typeof euros === 'function' ? euros(l.prix || 0) : (l.prix || 0) + '€');
        res.push({
          label: '📦 ' + (l.numLiv || '') + ' — ' + (l.client || ''),
          sub: sub,
          handler: 'rechercheOuvrirLivraison',
          arg: l.id
        });
      });

      salaries.filter(function(s) {
        return normalize([s.nom, s.prenom, s.numero].filter(Boolean).join(' ')).includes(qn);
      }).slice(0, 3).forEach(function(s) {
        const nom = typeof getSalarieNomComplet === 'function' ? getSalarieNomComplet(s) : ((s.prenom || '') + ' ' + (s.nom || ''));
        res.push({
          label: '👤 ' + nom,
          sub: 'N° ' + (s.numero || '—'),
          handler: 'ouvrirEditSalarie',
          arg: s.id
        });
      });

      vehicules.filter(function(v) {
        return normalize(v.immat).includes(qn) || normalize(v.modele).includes(qn);
      }).slice(0, 3).forEach(function(v) {
        res.push({
          label: '🚐 ' + (v.immat || ''),
          sub: v.modele || '',
          handler: 'ouvrirFicheVehiculeDepuisTableau',
          arg: v.id
        });
      });

      clients.filter(function(c) {
        return normalize([c.nom, c.prenom, c.tel].filter(Boolean).join(' ')).includes(qn);
      }).slice(0, 3).forEach(function(c) {
        res.push({
          label: '🧑‍💼 ' + (c.nom || ''),
          sub: c.adresse || c.tel || '',
          handler: 'rechercheOuvrirClient',
          arg: c.id
        });
      });

      return res;
    } catch (e) {
      return [];
    }
  }

  function rendrerEntiteRow(r) {
    const sub = r.sub ? '<div class="cmd-entity-sub">' + escCmd(r.sub) + '</div>' : '';
    return '<div class="cmd-entity-row" data-cmd-handler="' + escCmd(r.handler) + '" data-cmd-arg="' + escCmd(r.arg) + '" role="option" tabindex="-1">' +
             '<div class="cmd-entity-main">' + escCmd(r.label) + '</div>' +
             sub +
           '</div>';
  }

  // --- Surcharge de rechercheUniverselle ---
  window.rechercheUniverselle = function(q) {
    const cont = document.getElementById('recherche-resultats');
    if (!cont) return;

    const actions = matcherActions(q);
    const entities = (q && q.length >= 2) ? calculerEntites(q) : [];

    let html = '';
    if (actions.length) {
      html += '<div class="cmd-section-label">' + (q ? 'Actions' : 'Raccourcis suggérés') + '</div>';
      html += actions.map(rendrerActionRow).join('');
    }
    if (entities.length) {
      html += '<div class="cmd-section-label">Résultats</div>';
      html += entities.map(rendrerEntiteRow).join('');
    }
    if (!html) {
      cont.innerHTML = '<div class="cmd-empty">Aucun résultat pour « ' + (q || '') + ' »</div>';
    } else {
      cont.innerHTML = html;
    }
    cont.style.display = 'block';

    // Bind actions
    cont.querySelectorAll('[data-cmd-action]').forEach(function(el) {
      const idx = parseInt(el.getAttribute('data-cmd-action'), 10);
      const act = actions[idx];
      el.onclick = function() {
        if (typeof fermerRechercheGlobale === 'function') fermerRechercheGlobale();
        if (act && typeof act.run === 'function') {
          try { act.run(); } catch (err) { console.warn('[cmd-palette]', err); }
        }
      };
    });

    // Bind entités (dispatcher whitelisté, plus de new Function)
    cont.querySelectorAll('[data-cmd-handler]').forEach(function(el) {
      const handler = el.getAttribute('data-cmd-handler') || '';
      const arg = el.getAttribute('data-cmd-arg') || '';
      el.onclick = function() {
        if (typeof fermerRechercheGlobale === 'function') fermerRechercheGlobale();
        const fn = CMD_ENTITY_HANDLERS[handler];
        if (typeof fn === 'function') {
          try { fn(arg); } catch (err) { console.warn('[cmd-palette]', err); }
        }
      };
    });
  };

  // --- Surcharge de ouvrirRechercheGlobale pour afficher suggestions par défaut ---
  const ouvrirOrig = window.ouvrirRechercheGlobale;
  window.ouvrirRechercheGlobale = function() {
    if (typeof ouvrirOrig === 'function') ouvrirOrig();
    setTimeout(function() {
      const input = document.getElementById('barre-recherche-univ');
      if (input) {
        window.rechercheUniverselle(input.value || '');
        setupCmdKeyboard(input);
      }
    }, 60);
  };

  // --- Navigation clavier ↑↓ Entrée ---
  function setupCmdKeyboard(input) {
    if (!input || input.dataset.cmdBound === '1') return;
    input.dataset.cmdBound = '1';

    input.addEventListener('keydown', function(e) {
      const cont = document.getElementById('recherche-resultats');
      if (!cont || cont.style.display === 'none') return;
      const rows = cont.querySelectorAll('[data-cmd-action],[data-cmd-entity]');
      if (!rows.length) return;

      const active = cont.querySelector('.cmd-row-active');
      let idx = active ? Array.prototype.indexOf.call(rows, active) : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = (idx + 1) % rows.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = idx <= 0 ? rows.length - 1 : idx - 1;
      } else if (e.key === 'Enter') {
        if (idx >= 0) {
          e.preventDefault();
          rows[idx].click();
        }
        return;
      } else {
        return;
      }

      rows.forEach(function(r) { r.classList.remove('cmd-row-active'); });
      if (rows[idx]) {
        rows[idx].classList.add('cmd-row-active');
        rows[idx].scrollIntoView({ block: 'nearest' });
      }
    });
  }

})();

/* ================================================================
   SPRINT 4 — DASHBOARD HIÉRARCHISÉ : SCORE DE SANTÉ + HERO RING
   calculerScoreSante() : 0-100 selon CA, bénéfice, impayés, alertes
   afficherHeroSante()  : applique état visuel + ring SVG animé
   ================================================================ */
(function() {
  function lireNombreDepuisDOM(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const txt = (el.textContent || '').replace(/[^0-9,.-]/g, '').replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(txt);
    return isNaN(n) ? 0 : n;
  }

  window.calculerScoreSante = function() {
    const ca       = lireNombreDepuisDOM('kpi-ca-mois');
    const benefice = lireNombreDepuisDOM('kpi-benefice');
    const impayes  = lireNombreDepuisDOM('kpi-solde');
    const alertes  = lireNombreDepuisDOM('kpi-alertes');

    if (ca <= 0 && benefice === 0) {
      return { score: 0, etat: 'vide', raisons: ['Pas encore de données'] };
    }

    let score = 100;
    const raisons = [];

    if (benefice < 0) { score -= 40; raisons.push('Bénéfice négatif'); }
    else if (ca > 0 && benefice / ca < 0.1) { score -= 15; raisons.push('Marge faible (<10%)'); }

    if (impayes > 0 && ca > 0) {
      const malus = Math.min(25, Math.round((impayes / Math.max(ca, 1)) * 100));
      score -= malus;
      raisons.push(malus + ' pts impayés');
    }

    if (alertes > 0) {
      const malus = Math.min(20, alertes * 4);
      score -= malus;
      raisons.push(alertes + ' alerte(s)');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let etat;
    if (score >= 75) etat = 'bon';
    else if (score >= 50) etat = 'moyen';
    else etat = 'mauvais';

    return { score, etat, raisons };
  };

  window.afficherHeroSante = function() {
    const res = window.calculerScoreSante();
    const hero = document.getElementById('kpi-sante-globale');
    const ring = document.getElementById('sante-ring-fg');
    const scoreText = document.getElementById('sante-ring-score');

    if (hero) {
      hero.classList.remove('etat-bon', 'etat-moyen', 'etat-mauvais', 'etat-vide');
      hero.classList.add('etat-' + res.etat);
    }
    if (ring) {
      const C = 2 * Math.PI * 52; // ≈ 326.73
      const dash = (res.score / 100) * C;
      ring.setAttribute('stroke-dasharray', dash.toFixed(2) + ' ' + C.toFixed(2));
    }
    if (scoreText) {
      scoreText.textContent = res.etat === 'vide' ? '—' : String(res.score);
    }
  };

  // Hook : à chaque appel de afficherDashboard, mettre à jour le hero ring
  const afficherDashboardOrig = window.afficherDashboard;
  if (typeof afficherDashboardOrig === 'function') {
    window.afficherDashboard = function() {
      const r = afficherDashboardOrig.apply(this, arguments);
      try { window.afficherHeroSante(); } catch (e) { /* ignore */ }
      return r;
    };
  }

  // Premier rendu au chargement si dashboard déjà actif
  function initHeroSante() {
    setTimeout(function() {
      try { window.afficherHeroSante(); } catch (e) {}
    }, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroSante);
  } else {
    initHeroSante();
  }

})();

/* ================================================================
   SPRINT 5 — SIDE DRAWER PATTERN
   API publique :
     ouvrirDrawer(titre, contenuHTML)
     ouvrirDrawer({ titre, contenuHTML, onClose, largeur })
     fermerDrawer()
   Exposé globalement pour réutilisation par Sprint 6 (bulk actions)
   et Sprint 8 (vue 360° salarié).
   ================================================================ */
(function() {
  let _drawerOnClose = null;
  let _drawerEscBound = false;
  let _elementFocusAvantOuverture = null;

  function getNodes() {
    return {
      overlay: document.getElementById('side-drawer-overlay'),
      drawer:  document.getElementById('side-drawer'),
      title:   document.getElementById('side-drawer-title'),
      body:    document.getElementById('side-drawer-body')
    };
  }

  function onEscape(e) {
    if (e.key === 'Escape') {
      const { drawer } = getNodes();
      if (drawer && drawer.classList.contains('open')) {
        e.preventDefault();
        window.fermerDrawer();
      }
    }
  }

  window.ouvrirDrawer = function(titreOuOpts, contenuHTML) {
    const { overlay, drawer, title, body } = getNodes();
    if (!drawer || !overlay) {
      console.warn('[ouvrirDrawer] éléments side-drawer introuvables');
      return;
    }

    let titre, contenu, onClose, largeur;
    if (typeof titreOuOpts === 'object' && titreOuOpts !== null) {
      titre     = titreOuOpts.titre     || 'Détails';
      contenu   = titreOuOpts.contenuHTML || titreOuOpts.html || '';
      onClose   = typeof titreOuOpts.onClose === 'function' ? titreOuOpts.onClose : null;
      largeur   = titreOuOpts.largeur || null;
    } else {
      titre   = titreOuOpts || 'Détails';
      contenu = contenuHTML || '';
      onClose = null;
      largeur = null;
    }

    if (title) title.textContent = titre;
    if (body) body.innerHTML = contenu;

    if (largeur) drawer.style.width = largeur;
    else drawer.style.width = '';

    _drawerOnClose = onClose;
    _elementFocusAvantOuverture = document.activeElement;

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');

    // Focus sur le bouton de fermeture après transition
    setTimeout(function() {
      const closeBtn = drawer.querySelector('.side-drawer-close');
      if (closeBtn) closeBtn.focus();
    }, 320);

    if (!_drawerEscBound) {
      document.addEventListener('keydown', onEscape);
      _drawerEscBound = true;
    }
  };

  window.fermerDrawer = function() {
    const { overlay, drawer, body } = getNodes();
    if (!drawer || !overlay) return;

    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');

    // Rend le focus à l'élément précédent
    if (_elementFocusAvantOuverture && typeof _elementFocusAvantOuverture.focus === 'function') {
      try { _elementFocusAvantOuverture.focus(); } catch (e) {}
      _elementFocusAvantOuverture = null;
    }

    // Callback onClose éventuel
    if (typeof _drawerOnClose === 'function') {
      try { _drawerOnClose(); } catch (e) { console.warn('[fermerDrawer] onClose', e); }
      _drawerOnClose = null;
    }

    // Vide le body après animation pour libérer la mémoire
    setTimeout(function() {
      if (body && !drawer.classList.contains('open')) body.innerHTML = '';
    }, 350);
  };

})();

/* ================================================================
   SPRINT 6 — BULK ACTIONS SUR LIVRAISONS
   toggleBulkSelectAll, majBulkActions, bulkMarquerPayees,
   bulkSupprimer, bulkExporter, bulkClear
   ================================================================ */
(function() {
  function getCheckboxes() {
    return document.querySelectorAll('#tb-livraisons .bulk-liv-check');
  }
  function getSelectedIds() {
    const ids = [];
    getCheckboxes().forEach(function(cb) {
      if (cb.checked) ids.push(cb.getAttribute('data-liv-id'));
    });
    return ids;
  }

  window.toggleBulkSelectAll = function(checked) {
    getCheckboxes().forEach(function(cb) {
      cb.checked = !!checked;
      const tr = cb.closest('tr');
      if (tr) tr.classList.toggle('bulk-selected', !!checked);
    });
    window.majBulkActions();
  };

  window.majBulkActions = function() {
    const bar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-count-num');
    const selectAll = document.getElementById('bulk-select-all');
    const cbs = getCheckboxes();
    const selected = [];

    cbs.forEach(function(cb) {
      const tr = cb.closest('tr');
      if (cb.checked) {
        selected.push(cb.getAttribute('data-liv-id'));
        if (tr) tr.classList.add('bulk-selected');
      } else {
        if (tr) tr.classList.remove('bulk-selected');
      }
    });

    const n = selected.length;
    if (countEl) countEl.textContent = String(n);

    if (bar) {
      if (n > 0) {
        bar.classList.add('visible');
        bar.setAttribute('aria-hidden', 'false');
      } else {
        bar.classList.remove('visible');
        bar.setAttribute('aria-hidden', 'true');
      }
    }

    // État "intermédiaire" du select-all
    if (selectAll) {
      if (n === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      } else if (n === cbs.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      }
    }
  };

  window.bulkClear = function() {
    getCheckboxes().forEach(function(cb) {
      cb.checked = false;
      const tr = cb.closest('tr');
      if (tr) tr.classList.remove('bulk-selected');
    });
    const selectAll = document.getElementById('bulk-select-all');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    window.majBulkActions();
  };

  window.bulkMarquerPayees = async function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const ok = await confirmDialog('Marquer ' + ids.length + ' livraison(s) comme payée(s) ?', { titre:'Marquer payées', icone:'💳', btnLabel:'Confirmer', danger:false });
    if (!ok) return;

    const livraisons = charger('livraisons');
    let count = 0;
    const today = new Date().toLocalISODate();

    livraisons.forEach(function(l) {
      if (ids.indexOf(l.id) !== -1) {
        l.statutPaiement = 'payé';
        if (!l.datePaiement) l.datePaiement = today;
        count++;
        if (typeof ajouterEntreeAudit === 'function') {
          try { ajouterEntreeAudit('Paiement livraison (bulk)', (l.numLiv || 'Livraison') + ' · payé'); } catch (e) {}
        }
      }
    });

    sauvegarder('livraisons', livraisons);
    if (typeof afficherLivraisons === 'function') afficherLivraisons();
    if (typeof afficherToast === 'function') afficherToast('💳 ' + count + ' livraison(s) marquée(s) payée(s)');
    window.bulkClear();
  };

  window.bulkMarquerLivrees = async function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const ok = await confirmDialog('Marquer ' + ids.length + ' livraison(s) comme livrée(s) ?', { titre:'Marquer livrées', icone:'✅', btnLabel:'Confirmer', danger:false });
    if (!ok) return;

    const livraisons = charger('livraisons');
    let count = 0;
    livraisons.forEach(function(l) {
      if (ids.indexOf(l.id) !== -1) {
        l.statut = 'livre';
        count++;
        if (typeof ajouterEntreeAudit === 'function') {
          try { ajouterEntreeAudit('Statut livraison (bulk)', (l.numLiv || 'Livraison') + ' · livrée'); } catch (e) {}
        }
      }
    });

    sauvegarder('livraisons', livraisons);
    if (typeof afficherLivraisons === 'function') afficherLivraisons();
    if (typeof afficherToast === 'function') afficherToast('✅ ' + count + ' livraison(s) marquée(s) livrée(s)');
    window.bulkClear();
  };

  window.bulkSupprimer = async function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const ok = await confirmDialog('Supprimer définitivement ' + ids.length + ' livraison(s) ? Cette action est irréversible.', { titre:'Suppression en masse', icone:'🗑️', btnLabel:'Supprimer' });
    if (!ok) return;

    const livraisons = charger('livraisons');
    const restantes = livraisons.filter(function(l) {
      if (ids.indexOf(l.id) !== -1) {
        if (typeof annulerArchiveFactureLivraison === 'function') {
          try { annulerArchiveFactureLivraison(l); } catch (e) {}
        }
        if (typeof ajouterEntreeAudit === 'function') {
          try { ajouterEntreeAudit('Suppression livraison (bulk)', (l.numLiv || 'Livraison') + ' · ' + (l.client || 'Client')); } catch (e) {}
        }
        return false;
      }
      return true;
    });

    sauvegarder('livraisons', restantes);
    if (typeof afficherLivraisons === 'function') afficherLivraisons();
    if (typeof afficherToast === 'function') afficherToast('🗑️ ' + ids.length + ' livraison(s) supprimée(s)');
    window.bulkClear();
  };

  window.bulkExporter = function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const livraisons = charger('livraisons').filter(function(l) {
      return ids.indexOf(l.id) !== -1;
    });

    if (typeof exporterCSV !== 'function') {
      if (typeof afficherToast === 'function') afficherToast('⚠️ Export indisponible', 'error');
      return;
    }

    const filename = 'livraisons_selection_' + new Date().toLocalISODate() + '.csv';
    exporterCSV(livraisons, [
      { label: 'N° LIV',       get: function(l) { return l.numLiv || ''; } },
      { label: 'Date',          get: function(l) { return l.date || ''; } },
      { label: 'Client',        get: function(l) { return l.client || ''; } },
      { label: 'Départ',        get: function(l) { return l.depart || ''; } },
      { label: 'Arrivée',       get: function(l) { return l.arrivee || ''; } },
      { label: 'Distance km',   get: function(l) { return l.distance || ''; } },
      { label: 'Prix €',        get: function(l) { return l.prix || ''; } },
      { label: 'Chauffeur',     get: function(l) { return l.chaufNom || ''; } },
      { label: 'Statut',        get: function(l) { return l.statut || ''; } },
      { label: 'Paiement',      get: function(l) { return l.statutPaiement || ''; } },
      { label: 'Date paiement', get: function(l) { return l.datePaiement || ''; } }
    ], filename);

    if (typeof afficherToast === 'function') afficherToast('📥 Export de ' + ids.length + ' livraison(s)');
  };

  window.bulkExporterPDF = function() {
    const ids = getSelectedIds();
    if (!ids.length) return;

    const livraisons = charger('livraisons').filter(function(l) {
      return ids.indexOf(l.id) !== -1;
    }).sort(function(a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

    const fmtDate = typeof formatDateExport === 'function' ? formatDateExport : function(d) { return d || ''; };
    const fmtEur  = typeof euros === 'function' ? euros : function(v) { return (v || 0) + ' €'; };
    const escape  = window.escapeHtml;

    const params = typeof getEntrepriseExportParams === 'function' ? getEntrepriseExportParams() : {};
    const nomEntr = escape(params.nom || 'MCA Logistics');

    const cellCss = 'padding:8px 10px;border-bottom:1px solid #f3f4f6';
    const badgeCss = 'padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600';

    let totalHT = 0, totalTVA = 0, totalTTC = 0;
    const rows = livraisons.map(function(l) {
      const ht = typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0);
      const ttc = parseFloat(l.prix) || 0;
      const tva = ttc - ht;
      totalHT += ht; totalTVA += tva; totalTTC += ttc;

      const badgeStatut = l.statut === 'livre' ? '<span style="' + badgeCss + ';background:#d1fae5;color:#065f46">Livrée</span>'
                      : l.statut === 'en-cours' ? '<span style="' + badgeCss + ';background:#dbeafe;color:#1e40af">En cours</span>'
                      : '<span style="' + badgeCss + ';background:#fef3c7;color:#92400e">En attente</span>';
      const badgePay = l.statutPaiement === 'payé' ? '<span style="' + badgeCss + ';background:#d1fae5;color:#065f46">Payé</span>'
                     : l.statutPaiement === 'litige' ? '<span style="' + badgeCss + ';background:#fee2e2;color:#991b1b">Litige</span>'
                     : '<span style="' + badgeCss + ';background:#fef3c7;color:#92400e">Attente</span>';

      return '<tr>' +
        '<td style="' + cellCss + '">' + escape(l.numLiv || '—') + '</td>' +
        '<td style="' + cellCss + '">' + escape(fmtDate(l.date)) + '</td>' +
        '<td style="' + cellCss + '">' + escape(l.client || '—') + '</td>' +
        '<td style="' + cellCss + '">' + escape(l.chaufNom || '—') + '</td>' +
        '<td style="' + cellCss + ';text-align:right">' + fmtEur(ht) + '</td>' +
        '<td style="' + cellCss + ';text-align:right;color:#6b7280">' + fmtEur(tva) + '</td>' +
        '<td style="' + cellCss + ';text-align:right;font-weight:700">' + fmtEur(ttc) + '</td>' +
        '<td style="' + cellCss + '">' + badgeStatut + '</td>' +
        '<td style="' + cellCss + '">' + badgePay + '</td>' +
      '</tr>';
    }).join('');

    const now = new Date();
    const dateGen = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    const html =
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#111827">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #f5a623">' +
          '<div>' +
            '<div style="font-size:1.4rem;font-weight:900;color:#f5a623">' + nomEntr + '</div>' +
            '<div style="font-size:.82rem;color:#6b7280;margin-top:4px">Récapitulatif livraisons</div>' +
          '</div>' +
          '<div style="text-align:right;font-size:.82rem;color:#6b7280">' +
            '<div>Généré le <strong>' + escape(dateGen) + '</strong></div>' +
            '<div>' + livraisons.length + ' livraison(s)</div>' +
          '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
          '<thead>' +
            '<tr style="background:#f3f4f6;text-align:left">' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">N° LIV</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Date</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Client</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Chauffeur</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">HT</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">TVA</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">TTC</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Statut</th>' +
              '<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Paiement</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody style="background:#fff">' + rows + '</tbody>' +
          '<tfoot>' +
            '<tr style="background:#fef3c7;font-weight:700">' +
              '<td colspan="4" style="padding:10px;text-align:right">TOTAUX</td>' +
              '<td style="padding:10px;text-align:right">' + fmtEur(totalHT) + '</td>' +
              '<td style="padding:10px;text-align:right;color:#6b7280">' + fmtEur(totalTVA) + '</td>' +
              '<td style="padding:10px;text-align:right">' + fmtEur(totalTTC) + '</td>' +
              '<td colspan="2"></td>' +
            '</tr>' +
          '</tfoot>' +
        '</table>' +
        '<div style="margin-top:16px;font-size:.72rem;color:#9ca3af;text-align:center">Document généré par MCA Logistics</div>' +
      '</div>';

    const win = ouvrirPopupSecure('', '_blank');
    if (!win) {
      if (typeof afficherToast === 'function') afficherToast('⚠️ Autorise les popups pour exporter en PDF', 'error');
      return;
    }
    win.document.write(
      '<!DOCTYPE html><html><head><title>Livraisons — ' + nomEntr + '</title>' +
      '<style>body{margin:0;padding:0;background:#fff;font-family:Segoe UI,Arial,sans-serif}@page{margin:10mm;size:landscape}@media print{.no-print{display:none}}</style>' +
      '</head><body>' + html +
      '<script>setTimeout(function(){window.print();},400);<\/script>' +
      '</body></html>'
    );
    win.document.close();

    if (typeof afficherToast === 'function') afficherToast('📄 PDF de ' + ids.length + ' livraison(s) prêt à imprimer');
  };

  // Touche Échap pour vider la sélection
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const bar = document.getElementById('bulk-action-bar');
      if (bar && bar.classList.contains('visible')) {
        const drawer = document.getElementById('side-drawer');
        if (drawer && drawer.classList.contains('open')) return;
        window.bulkClear();
      }
    }
  });

})();

/* =========================================================================
   SPRINT 7 — Pagination + recherche instantanée
   ========================================================================= */
(function() {
  'use strict';

  const LS_KEY = 'pagination_state';
  const DEFAULT_PER_PAGE = 25;
  const PER_PAGE_OPTIONS = [25, 50, 100];

  function loadState() {
    try { return loadSafe(LS_KEY, {}); } catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  }

  function getPageState(key) {
    const all = loadState();
    const st = all[key] || {};
    return {
      page: typeof st.page === 'number' ? st.page : 1,
      perPage: typeof st.perPage === 'number' ? st.perPage : DEFAULT_PER_PAGE
    };
  }
  function setPageState(key, patch) {
    const all = loadState();
    all[key] = Object.assign({}, all[key] || {}, patch);
    saveState(all);
  }

  /**
   * Découpe un tableau selon l'état de pagination.
   * Retourne { slice, total, page, perPage, totalPages }.
   */
  function paginerListe(arr, key) {
    const total = arr.length;
    const st = getPageState(key);
    const perPage = st.perPage;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    let page = Math.min(Math.max(1, st.page), totalPages);
    if (page !== st.page) setPageState(key, { page });
    const start = (page - 1) * perPage;
    const slice = arr.slice(start, start + perPage);
    return { slice, total, page, perPage, totalPages, start };
  }

  /**
   * Construit la barre de pagination dans le conteneur.
   */
  function rendrerPagination(key, total, page, perPage, totalPages, start) {
    const container = document.querySelector('[data-pagination-key="' + key + '"]');
    if (!container) return;
    if (total === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }
    container.style.display = '';

    const end = Math.min(start + perPage, total);
    const info = 'Affichage <strong>' + (start + 1) + '–' + end + '</strong> sur <strong>' + total + '</strong>';

    const pagesToShow = [];
    const push = (n) => { if (!pagesToShow.includes(n) && n >= 1 && n <= totalPages) pagesToShow.push(n); };
    push(1); push(totalPages);
    for (let i = page - 1; i <= page + 1; i++) push(i);
    pagesToShow.sort((a, b) => a - b);

    let pagesHtml = '';
    let prev = 0;
    pagesToShow.forEach(n => {
      if (n - prev > 1) pagesHtml += '<span class="pagination-ellipsis">…</span>';
      pagesHtml += '<button type="button" class="pagination-btn pagination-num' + (n === page ? ' is-active' : '') +
        '" data-pagination-go="' + n + '">' + n + '</button>';
      prev = n;
    });

    const perPageOptions = PER_PAGE_OPTIONS.map(n =>
      '<option value="' + n + '"' + (n === perPage ? ' selected' : '') + '>' + n + ' / page</option>'
    ).join('');

    container.innerHTML =
      '<div class="pagination-info">' + info + '</div>' +
      '<div class="pagination-controls">' +
        '<button type="button" class="pagination-btn" data-pagination-go="first" ' + (page === 1 ? 'disabled' : '') + ' aria-label="Première page">«</button>' +
        '<button type="button" class="pagination-btn" data-pagination-go="prev" ' + (page === 1 ? 'disabled' : '') + ' aria-label="Précédente">‹</button>' +
        pagesHtml +
        '<button type="button" class="pagination-btn" data-pagination-go="next" ' + (page === totalPages ? 'disabled' : '') + ' aria-label="Suivante">›</button>' +
        '<button type="button" class="pagination-btn" data-pagination-go="last" ' + (page === totalPages ? 'disabled' : '') + ' aria-label="Dernière page">»</button>' +
      '</div>' +
      '<div class="pagination-per-page">' +
        '<select class="pagination-select" data-pagination-perpage>' + perPageOptions + '</select>' +
      '</div>';

    // Bind events (une seule fois, via délégation)
    if (!container.dataset.bound) {
      container.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-pagination-go]');
        if (!btn || btn.disabled) return;
        const st = getPageState(key);
        const action = btn.getAttribute('data-pagination-go');
        let newPage = st.page;
        if (action === 'first') newPage = 1;
        else if (action === 'prev') newPage = Math.max(1, st.page - 1);
        else if (action === 'next') newPage = st.page + 1;
        else if (action === 'last') newPage = totalPages;
        else newPage = parseInt(action, 10) || 1;
        setPageState(key, { page: newPage });
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      });
      container.addEventListener('change', function(e) {
        const sel = e.target.closest('[data-pagination-perpage]');
        if (!sel) return;
        setPageState(key, { perPage: parseInt(sel.value, 10) || DEFAULT_PER_PAGE, page: 1 });
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      });
      container.dataset.bound = '1';
    }
  }

  // Exposer
  window.PAGINATION = {
    getPageState: getPageState,
    setPageState: setPageState,
    paginerListe: paginerListe,
    rendrerPagination: rendrerPagination
  };

  /* ---------- Patch renderLivraisonsAdminFinal pour paginer ---------- */
  function patchRender() {
    const orig = window.renderLivraisonsAdminFinal;
    if (typeof orig !== 'function' || orig.__paginated) return;

    const patched = function() {
      let livraisons = charger('livraisons');
      const tb = document.getElementById('tb-livraisons');
      if (!tb) return;

      const filtreStatut = document.getElementById('filtre-statut')?.value || '';
      const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
      const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
      const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
      const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
      const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';

      const selChauf = document.getElementById('filtre-chauffeur');
      if (selChauf) {
        const currentValue = selChauf.value;
        selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
        charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
        selChauf.value = currentValue;
      }

      if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
      if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
      if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
      if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
      if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
      if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));
      livraisons.sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

      if (!livraisons.length) {
        tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
        rendrerPagination('livraisons', 0, 1, DEFAULT_PER_PAGE, 1, 0);
        if (typeof majBulkActions === 'function') majBulkActions();
        return;
      }

      // Pagination
      const paged = paginerListe(livraisons, 'livraisons');

      // Rendu du slice via fonction orig (en remplaçant charger temporairement)
      // Approche plus simple : on rend directement avec la même logique que orig
      const escapeAttr = window.escapeAttr;
      const escapeHtml = window.escapeHtml;
      const formatClientLabel = v => {
        var raw = String(v || '').trim();
        if (!raw) return '—';
        return /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
      };
      const formatArchivedDriverHtml = v => {
        var raw = String(v || '').trim();
        if (!raw) return '<span class="livraison-cell-text livraison-driver-text">Non assigné</span>';
        var archived = /\s*\(archivé\)\s*$/i.test(raw);
        var clean = raw.replace(/\s*\(archivé\)\s*$/i, '').trim();
        var safeClean = escapeHtml(clean || raw);
        if (!archived) return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '</span>';
        return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '<span class="livraison-archived-badge">archivé</span></span>';
      };

      tb.innerHTML = paged.slice.map(l => {
        const ht = getMontantHTLivraison(l);
        const tva = (parseFloat(l.prix) || 0) - ht;
        const ttc = parseFloat(l.prix) || 0;
        const statutPaiement = l.statutPaiement || 'en-attente';
        const selectStatutPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('statut', l.statut) + '" onchange="changerStatutLivraison(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'statut\')"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>Livré</option></select>';
        const selectPaiementPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('paiement', statutPaiement) + '" onchange="changerStatutPaiement(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'paiement\')"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="payé" ' + (statutPaiement === 'payé' ? 'selected' : '') + '>Payé</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
        const client = formatClientLabel(l.client || '—');
        const clientText = escapeHtml(client);
        const depart = l.depart || '';
        const arrivee = l.arrivee || '';
        const zoneGeo = depart && arrivee && depart !== arrivee ? depart + ' → ' + arrivee : (arrivee || depart || '—');
        const zoneGeoText = escapeHtml(zoneGeo || '—');
        const chauffeur = l.chaufNom || 'Non assigné';
        const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
        return `<tr data-liv-id="${escapeAttr(l.id)}">
          <td class="bulk-col"><input type="checkbox" class="bulk-liv-check" data-liv-id="${escapeAttr(l.id)}" onchange="majBulkActions()" aria-label="Sélectionner" /></td>
          <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
          <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(client)}">${clientText}</strong></td>
          <td><span class="livraison-cell-text livraison-zone-text" title="${escapeAttr(zoneGeo || '—')}">${zoneGeoText}</span></td>
          <td class="livraison-number-cell">${l.distance ? formatKm(l.distance) : '—'}</td>
          <td class="livraison-number-cell">${euros(ht)}</td>
          <td class="livraison-number-cell livraison-muted-cell">${euros(tva)}</td>
          <td class="livraison-number-cell livraison-total-cell">${euros(ttc)}</td>
          <td>${formatArchivedDriverHtml(chauffeur)}</td>
          <td><div class="livraison-select-cell">${selectStatutPropre}</div></td>
          <td><div class="livraison-select-cell">${selectPaiementPropre}</div></td>
          <td class="livraison-number-cell">${datePaiement}</td>
          <td class="actions-cell">${buildInlineActionsDropdown('Actions', [
            { icon:'✏️', label:'Modifier', action:"ouvrirEditLivraison('" + l.id + "')" },
              { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
            { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
            { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
            { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
          ])}</td>
        </tr>`;
      }).join('');

      rendrerPagination('livraisons', paged.total, paged.page, paged.perPage, paged.totalPages, paged.start);
      if (typeof majBulkActions === 'function') majBulkActions();
    };

    patched.__paginated = true;
    window.renderLivraisonsAdminFinal = patched;
    if (typeof window.afficherLivraisons !== 'undefined') window.afficherLivraisons = patched;
  }

  /* ---------- Recherche instantanée (debounce 200ms) ---------- */
  function installSearchDebounce() {
    const input = document.getElementById('filtre-recherche-liv');
    if (!input || input.dataset.instantBound) return;
    let t;
    input.addEventListener('input', function() {
      clearTimeout(t);
      t = setTimeout(function() {
        // Reset page 1 quand on tape
        setPageState('livraisons', { page: 1 });
        if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
      }, 200);
    });
    input.dataset.instantBound = '1';
  }

  function init() {
    patchRender();
    installSearchDebounce();
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM déjà prêt — patch après micro-délai pour laisser les autres IIFE finir
    setTimeout(init, 0);
  }
})();

/* =========================================================================
   SPRINT 8 — Tri par colonne cliquable
   ========================================================================= */
(function() {
  'use strict';

  const LS_KEY = 'sort_state';

  function loadState() {
    try { return loadSafe(LS_KEY, {}); } catch (e) { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  }
  function getSortState(key) {
    const all = loadState();
    return all[key] || { col: null, dir: null };
  }
  function setSortState(key, col, dir) {
    const all = loadState();
    if (!col || !dir) delete all[key];
    else all[key] = { col, dir };
    saveState(all);
  }

  /**
   * Config des accesseurs + types par clé de tri, pour la table livraisons.
   * type: 'string' | 'number' | 'date' | 'enum'
   */
  const LIVRAISONS_SORT_CONFIG = {
    numLiv:       { type: 'string', get: l => l.numLiv || '' },
    client:       { type: 'string', get: l => l.client || '' },
    zone:         { type: 'string', get: l => ((l.depart || '') + ' ' + (l.arrivee || '')).trim() },
    distance:     { type: 'number', get: l => parseFloat(l.distance) || 0 },
    ht:           { type: 'number', get: l => (typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0)) },
    tva:          { type: 'number', get: l => {
      const ht = typeof getMontantHTLivraison === 'function' ? getMontantHTLivraison(l) : (parseFloat(l.prix) || 0);
      return (parseFloat(l.prix) || 0) - ht;
    }},
    ttc:          { type: 'number', get: l => parseFloat(l.prix) || 0 },
    chauffeur:    { type: 'string', get: l => l.chaufNom || '' },
    statut:       { type: 'enum',   get: l => l.statut || 'en-attente', order: ['en-attente','en-cours','livre'] },
    paiement:     { type: 'enum',   get: l => l.statutPaiement || 'en-attente', order: ['en-attente','litige','payé'] },
    datePaiement: { type: 'date',   get: l => l.datePaiement || '' }
  };

  /**
   * Trie un tableau selon la clé et direction demandées.
   * Retourne un nouveau tableau (ne modifie pas l'original).
   */
  function appliquerTri(arr, key, config, fallbackSort) {
    const st = getSortState(key);
    if (!st.col || !st.dir || !config[st.col]) {
      if (typeof fallbackSort === 'function') return arr.slice().sort(fallbackSort);
      return arr.slice();
    }
    const cfg = config[st.col];
    const dir = st.dir === 'desc' ? -1 : 1;
    const sorted = arr.slice().sort((a, b) => {
      const va = cfg.get(a);
      const vb = cfg.get(b);
      let cmp = 0;
      if (cfg.type === 'number') {
        cmp = (va || 0) - (vb || 0);
      } else if (cfg.type === 'date') {
        const da = va ? new Date(va).getTime() : 0;
        const db = vb ? new Date(vb).getTime() : 0;
        cmp = da - db;
      } else if (cfg.type === 'enum') {
        const ia = cfg.order.indexOf(va);
        const ib = cfg.order.indexOf(vb);
        cmp = (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      } else {
        cmp = String(va).localeCompare(String(vb), 'fr', { numeric: true, sensitivity: 'base' });
      }
      return cmp * dir;
    });
    return sorted;
  }

  /**
   * Met à jour l'indicateur visuel sur tous les th[data-sort-key] d'un table.
   */
  function majIndicateurs(tableEl, key) {
    if (!tableEl) return;
    const st = getSortState(key);
    tableEl.querySelectorAll('th[data-sort-key]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.getAttribute('data-sort-key') === st.col && st.dir) {
        th.classList.add(st.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  /**
   * Attache les listeners de clic sur les th triables d'une table donnée.
   * Cycle: null -> asc -> desc -> null
   */
  function bindSortableHeaders(tableSelector, key, rerender) {
    const table = document.querySelector(tableSelector);
    if (!table || table.dataset.sortBound) return;
    table.addEventListener('click', function(e) {
      const th = e.target.closest('th[data-sort-key]');
      if (!th || !table.contains(th)) return;
      const col = th.getAttribute('data-sort-key');
      const st = getSortState(key);
      let newDir;
      if (st.col !== col) newDir = 'asc';
      else if (st.dir === 'asc') newDir = 'desc';
      else newDir = null;
      setSortState(key, newDir ? col : null, newDir);
      // Reset page 1 quand on change de tri
      if (window.PAGINATION && typeof window.PAGINATION.setPageState === 'function') {
        window.PAGINATION.setPageState(key, { page: 1 });
      }
      if (typeof rerender === 'function') rerender();
    });
    table.dataset.sortBound = '1';
  }

  // Exposer API publique
  window.SORT = {
    getSortState: getSortState,
    setSortState: setSortState,
    appliquerTri: appliquerTri,
    majIndicateurs: majIndicateurs,
    bindSortableHeaders: bindSortableHeaders,
    LIVRAISONS_CONFIG: LIVRAISONS_SORT_CONFIG
  };

  /* ---------- Intégration livraisons ---------- */
  function init() {
    const rerender = function() {
      if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
    };
    bindSortableHeaders('table.livraisons-table', 'livraisons', rerender);

    // Wrap renderLivraisonsAdminFinal : appliquer tri avant pagination
    const orig = window.renderLivraisonsAdminFinal;
    if (typeof orig !== 'function' || orig.__sorted) return;

    // Hijack charger pour livraisons: appliquer le tri en amont
    // Approche propre : patch en wrappant pour post-process avant pagination
    // Plus simple: on intercepte via un patch global Array.sort ? Non.
    // Solution : surcharger Array.prototype.sort dans le contexte de orig? trop invasif.
    // Vraie solution : patch orig entièrement (déjà patché par Sprint 7). On re-patche.
    const wrapped = function() {
      // On doit appliquer le tri avant la pagination. Le render Sprint 7 fait déjà
      // filter -> sort par défaut (creeLe desc) -> paginerListe -> render.
      // On intercepte en remplaçant temporairement Array.prototype.sort ? Non.
      // → On va plutôt monkey-patcher charger('livraisons') pour ce seul call :
      // Trop compliqué. Approche pragmatique : on duplique le flux.

      let livraisons = charger('livraisons');
      const tb = document.getElementById('tb-livraisons');
      if (!tb) return;

      const filtreStatut = document.getElementById('filtre-statut')?.value || '';
      const filtreDateDeb = document.getElementById('filtre-date-debut')?.value || '';
      const filtreDateFin = document.getElementById('filtre-date-fin')?.value || '';
      const filtreRecherche = document.getElementById('filtre-recherche-liv')?.value?.toLowerCase().trim() || '';
      const filtrePaiement = document.getElementById('filtre-paiement')?.value || '';
      const filtreChauffeur = document.getElementById('filtre-chauffeur')?.value || '';

      const selChauf = document.getElementById('filtre-chauffeur');
      if (selChauf) {
        const currentValue = selChauf.value;
        selChauf.innerHTML = '<option value="">Tous les chauffeurs</option>';
        charger('salaries').forEach(s => { selChauf.innerHTML += `<option value="${s.id}">${s.nom}</option>`; });
        selChauf.value = currentValue;
      }

      if (filtreStatut) livraisons = livraisons.filter(l => l.statut === filtreStatut);
      if (filtreDateDeb) livraisons = livraisons.filter(l => l.date >= filtreDateDeb);
      if (filtreDateFin) livraisons = livraisons.filter(l => l.date <= filtreDateFin);
      if (filtrePaiement) livraisons = livraisons.filter(l => (l.statutPaiement || 'en-attente') === filtrePaiement);
      if (filtreChauffeur) livraisons = livraisons.filter(l => l.chaufId === filtreChauffeur);
      if (filtreRecherche) livraisons = livraisons.filter(l => [l.client, l.chaufNom, l.numLiv, l.depart, l.arrivee].filter(Boolean).join(' ').toLowerCase().includes(filtreRecherche));

      // Tri : si utilisateur a choisi une colonne, on applique. Sinon fallback creeLe desc.
      livraisons = appliquerTri(livraisons, 'livraisons', LIVRAISONS_SORT_CONFIG,
        (a, b) => new Date(b.creeLe) - new Date(a.creeLe));

      if (!livraisons.length) {
        tb.innerHTML = '<tr><td colspan="13" class="empty-row">Aucune livraison</td></tr>';
        if (window.PAGINATION) window.PAGINATION.rendrerPagination('livraisons', 0, 1, 25, 1, 0);
        if (typeof majBulkActions === 'function') majBulkActions();
        majIndicateurs(document.querySelector('table.livraisons-table'), 'livraisons');
        return;
      }

      const paged = window.PAGINATION.paginerListe(livraisons, 'livraisons');

      const escapeAttr = window.escapeAttr;
      const escapeHtml = window.escapeHtml;
      const formatClientLabel = v => {
        var raw = String(v || '').trim();
        if (!raw) return '—';
        return /^\d+$/.test(raw) ? ('Client #' + raw) : raw;
      };
      const formatArchivedDriverHtml = v => {
        var raw = String(v || '').trim();
        if (!raw) return '<span class="livraison-cell-text livraison-driver-text">Non assigné</span>';
        var archived = /\s*\(archivé\)\s*$/i.test(raw);
        var clean = raw.replace(/\s*\(archivé\)\s*$/i, '').trim();
        var safeClean = escapeHtml(clean || raw);
        if (!archived) return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '</span>';
        return '<span class="livraison-cell-text livraison-driver-text" title="' + escapeAttr(raw) + '">' + safeClean + '<span class="livraison-archived-badge">archivé</span></span>';
      };

      tb.innerHTML = paged.slice.map(l => {
        const ht = getMontantHTLivraison(l);
        const tva = (parseFloat(l.prix) || 0) - ht;
        const ttc = parseFloat(l.prix) || 0;
        const statutPaiement = l.statutPaiement || 'en-attente';
        const selectStatutPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('statut', l.statut) + '" onchange="changerStatutLivraison(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'statut\')"><option value="en-attente" ' + (l.statut === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="en-cours" ' + (l.statut === 'en-cours' ? 'selected' : '') + '>En cours</option><option value="livre" ' + (l.statut === 'livre' ? 'selected' : '') + '>Livré</option></select>';
        const selectPaiementPropre = '<select class="livraison-inline-select ' + getLivraisonInlineSelectClass('paiement', statutPaiement) + '" onchange="changerStatutPaiement(\'' + l.id + '\',this.value,this);styliserSelectLivraison(this,\'paiement\')"><option value="en-attente" ' + (statutPaiement === 'en-attente' ? 'selected' : '') + '>En attente</option><option value="payé" ' + (statutPaiement === 'payé' ? 'selected' : '') + '>Payé</option><option value="litige" ' + (statutPaiement === 'litige' ? 'selected' : '') + '>Litige</option></select>';
        const client = formatClientLabel(l.client || '—');
        const clientText = escapeHtml(client);
        const depart = l.depart || '';
        const arrivee = l.arrivee || '';
        const zoneGeo = depart && arrivee && depart !== arrivee ? depart + ' → ' + arrivee : (arrivee || depart || '—');
        const zoneGeoText = escapeHtml(zoneGeo || '—');
        const chauffeur = l.chaufNom || 'Non assigné';
        const datePaiement = l.datePaiement ? formatDateExport(String(l.datePaiement).slice(0, 10)) : '—';
        return `<tr data-liv-id="${escapeAttr(l.id)}">
          <td class="bulk-col"><input type="checkbox" class="bulk-liv-check" data-liv-id="${escapeAttr(l.id)}" onchange="majBulkActions()" aria-label="Sélectionner" /></td>
          <td class="livraison-ref-cell">${escapeHtml(l.numLiv || '—')}</td>
          <td><strong class="livraison-cell-text livraison-client-text" title="${escapeAttr(client)}">${clientText}</strong></td>
          <td><span class="livraison-cell-text livraison-zone-text" title="${escapeAttr(zoneGeo || '—')}">${zoneGeoText}</span></td>
          <td class="livraison-number-cell">${l.distance ? formatKm(l.distance) : '—'}</td>
          <td class="livraison-number-cell">${euros(ht)}</td>
          <td class="livraison-number-cell livraison-muted-cell">${euros(tva)}</td>
          <td class="livraison-number-cell livraison-total-cell">${euros(ttc)}</td>
          <td>${formatArchivedDriverHtml(chauffeur)}</td>
          <td><div class="livraison-select-cell">${selectStatutPropre}</div></td>
          <td><div class="livraison-select-cell">${selectPaiementPropre}</div></td>
          <td class="livraison-number-cell">${datePaiement}</td>
          <td class="actions-cell">${buildInlineActionsDropdown('Actions', [
            { icon:'✏️', label:'Modifier', action:"ouvrirEditLivraison('" + l.id + "')" },
              { icon:'📋', label:'Lettre de voiture', action:"genererLettreDeVoiture('" + l.id + "')" },
            { icon:'📋', label:'Dupliquer', action:"dupliquerLivraison('" + l.id + "')" },
            { icon:'🔁', label:'Récurrence', action:"ouvrirRecurrence('" + l.id + "')" },
            { icon:'🗑️', label:'Supprimer', action:"supprimerLivraison('" + l.id + "')", danger:true }
          ])}</td>
        </tr>`;
      }).join('');

      window.PAGINATION.rendrerPagination('livraisons', paged.total, paged.page, paged.perPage, paged.totalPages, paged.start);
      if (typeof majBulkActions === 'function') majBulkActions();
      majIndicateurs(document.querySelector('table.livraisons-table'), 'livraisons');
    };

    wrapped.__paginated = true;
    wrapped.__sorted = true;
    window.renderLivraisonsAdminFinal = wrapped;
    if (typeof window.afficherLivraisons !== 'undefined') window.afficherLivraisons = wrapped;

    // Re-render initial pour afficher l'indicateur si tri déjà mémorisé
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 50); });
  } else {
    setTimeout(init, 50);
  }
})();

/* =========================================================================
   SPRINT 9 — Empty states riches
   ========================================================================= */
(function() {
  'use strict';

  /**
   * Construit le HTML d'un empty state riche.
   * config: { icon, title, description, ctaLabel, ctaAction, variant }
   * variant: 'default' | 'filtered' | 'search' | 'success'
   */
  function buildHtml(config) {
    const variant = config.variant || 'default';
    const iconHtml = config.icon || '📦';
    const title = config.title || 'Rien à afficher';
    const description = config.description || '';
    let ctaHtml = '';
    if (config.ctaLabel && config.ctaAction) {
      const cls = variant === 'filtered' || variant === 'search' ? 'btn btn-secondary' : 'btn btn-primary';
      ctaHtml = '<button type="button" class="' + cls + ' empty-state-cta" onclick="' + config.ctaAction + '">' + config.ctaLabel + '</button>';
    }
    return (
      '<div class="empty-state empty-state-' + variant + '">' +
        '<div class="empty-state-icon" aria-hidden="true">' + iconHtml + '</div>' +
        '<div class="empty-state-title">' + title + '</div>' +
        (description ? '<div class="empty-state-description">' + description + '</div>' : '') +
        (ctaHtml ? '<div class="empty-state-actions">' + ctaHtml + '</div>' : '') +
      '</div>'
    );
  }

  /**
   * Injecte un empty state dans un container DOM.
   */
  function render(container, config) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML = buildHtml(config);
  }

  /**
   * Génère une <tr><td colspan=N> avec un empty state dedans (pour tables).
   */
  function renderTableRow(colspan, config) {
    return '<tr><td colspan="' + (colspan || 1) + '" class="empty-state-cell">' + buildHtml(config) + '</td></tr>';
  }

  /**
   * Détermine si des filtres sont actifs sur la page livraisons.
   */
  function hasActiveLivraisonsFilters() {
    const ids = ['filtre-statut', 'filtre-date-debut', 'filtre-date-fin', 'filtre-paiement', 'filtre-chauffeur'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.value) return true;
    }
    return false;
  }

  function hasActiveLivraisonsSearch() {
    const el = document.getElementById('filtre-recherche-liv');
    return !!(el && el.value && el.value.trim());
  }

  /**
   * Actions CTA pour les empty states livraisons.
   */
  window.resetFiltresLivraisons = function() {
    ['filtre-statut', 'filtre-date-debut', 'filtre-date-fin', 'filtre-paiement', 'filtre-chauffeur'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  };

  window.resetRechercheLivraisons = function() {
    const el = document.getElementById('filtre-recherche-liv');
    if (el) el.value = '';
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  };

  // Exposer
  window.EmptyState = {
    buildHtml: buildHtml,
    render: render,
    renderTableRow: renderTableRow,
    hasActiveLivraisonsFilters: hasActiveLivraisonsFilters,
    hasActiveLivraisonsSearch: hasActiveLivraisonsSearch
  };

  /* ---------- Patch final render livraisons pour empty state riche ---------- */
  function init() {
    const orig = window.renderLivraisonsAdminFinal;
    if (typeof orig !== 'function' || orig.__emptyStated) return;

    const patched = function() {
      orig.apply(this, arguments);
      // Après le render, si le tbody contient l'empty basique, on le remplace
      const tb = document.getElementById('tb-livraisons');
      if (!tb) return;
      const basicEmpty = tb.querySelector('.empty-row');
      if (!basicEmpty) return;

      // Détection du contexte
      const totalLivraisons = (typeof charger === 'function' ? charger('livraisons') : []).length;
      const hasSearch = hasActiveLivraisonsSearch();
      const hasFilters = hasActiveLivraisonsFilters();

      let config;
      if (totalLivraisons === 0) {
        config = {
          icon: '📦',
          title: 'Aucune livraison pour le moment',
          description: 'Commence par enregistrer ta première livraison pour suivre tes revenus, tes trajets et ton activité.',
          ctaLabel: '+ Nouvelle livraison',
          ctaAction: 'openModal(\'modal-livraison\')',
          variant: 'default'
        };
      } else if (hasSearch && !hasFilters) {
        config = {
          icon: '🔍',
          title: 'Aucun résultat pour cette recherche',
          description: 'Essaye avec un autre terme ou efface la recherche pour voir toutes tes livraisons.',
          ctaLabel: 'Effacer la recherche',
          ctaAction: 'resetRechercheLivraisons()',
          variant: 'search'
        };
      } else if (hasFilters || hasSearch) {
        config = {
          icon: '🔎',
          title: 'Aucune livraison ne correspond aux filtres',
          description: 'Modifie les critères ou réinitialise les filtres pour élargir la recherche.',
          ctaLabel: 'Réinitialiser les filtres',
          ctaAction: 'resetFiltresLivraisons()',
          variant: 'filtered'
        };
      } else {
        // Filtre de période actif (mois courant sans livraison)
        config = {
          icon: '📅',
          title: 'Aucune livraison sur cette période',
          description: 'Navigue vers un autre mois ou crée une livraison pour cette période.',
          ctaLabel: '+ Nouvelle livraison',
          ctaAction: 'openModal(\'modal-livraison\')',
          variant: 'default'
        };
      }

      tb.innerHTML = renderTableRow(13, config);
    };

    patched.__paginated = true;
    patched.__sorted = true;
    patched.__emptyStated = true;
    window.renderLivraisonsAdminFinal = patched;
    if (typeof window.afficherLivraisons !== 'undefined') window.afficherLivraisons = patched;

    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }
})();

/* =========================================================================
   SPRINT 10 — Toasts stackés + actions Undo
   ========================================================================= */
(function() {
  'use strict';

  const STACK_ID = 'toast-stack';
  const DEFAULT_DURATION = 4000;
  const UNDO_DURATION = 6000;
  let idCounter = 0;

  function ensureStack() {
    let stack = document.getElementById(STACK_ID);
    if (!stack) {
      stack = document.createElement('div');
      stack.id = STACK_ID;
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function iconForType(type) {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warning': return '⚠';
      case 'info':    return 'ℹ';
      default:        return '✓';
    }
  }

  function dismissToast(el) {
    if (!el || el.dataset.dismissing) return;
    el.dataset.dismissing = '1';
    el.classList.add('toast-out');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 250);
  }

  /**
   * Affiche un toast. Signature rétrocompatible :
   *   afficherToast(msg)
   *   afficherToast(msg, 'error')
   *   afficherToast(msg, 'success', { action: { label, onClick }, duration })
   */
  function stackedToast(message, type, options) {
    type = type || 'success';
    options = options || {};

    const stack = ensureStack();
    const id = ++idCounter;

    const duration = options.duration || (options.action ? UNDO_DURATION : DEFAULT_DURATION);
    const icon = options.icon || iconForType(type);

    const toast = document.createElement('div');
    toast.className = 'toast toast-stacked toast-' + type;
    toast.setAttribute('data-toast-id', String(id));

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icon;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';
    // message peut contenir des emojis/texte — on fait textContent pour sécurité
    bodyEl.textContent = String(message);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'toast-actions';

    if (options.action && options.action.label && typeof options.action.onClick === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action-btn';
      btn.textContent = options.action.label;
      btn.addEventListener('click', function() {
        try { options.action.onClick(); } catch (e) { console.error(e); }
        dismissToast(toast);
      });
      actionsEl.appendChild(btn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() { dismissToast(toast); });
    actionsEl.appendChild(closeBtn);

    const progress = document.createElement('div');
    progress.className = 'toast-progress';
    progress.style.animationDuration = duration + 'ms';

    toast.appendChild(iconEl);
    toast.appendChild(bodyEl);
    toast.appendChild(actionsEl);
    toast.appendChild(progress);

    stack.appendChild(toast);

    // Pause progress on hover
    let remaining = duration;
    let startedAt = Date.now();
    let timer = setTimeout(function() { dismissToast(toast); }, duration);

    toast.addEventListener('mouseenter', function() {
      remaining -= (Date.now() - startedAt);
      clearTimeout(timer);
      progress.style.animationPlayState = 'paused';
    });
    toast.addEventListener('mouseleave', function() {
      startedAt = Date.now();
      timer = setTimeout(function() { dismissToast(toast); }, Math.max(1000, remaining));
      progress.style.animationPlayState = 'running';
    });

    return id;
  }

  // Override global afficherToast — garder backward compatibility
  const oldAfficherToast = window.afficherToast;
  window.afficherToast = function(message, type, options) {
    try {
      return stackedToast(message, type, options);
    } catch (e) {
      // Fallback : ancien comportement si notre stack plante
      if (typeof oldAfficherToast === 'function') return oldAfficherToast(message, type);
      console.error(e);
    }
  };

  // Exposer dismissToast pour usage externe
  window.dismissToastById = function(id) {
    const el = document.querySelector('.toast-stacked[data-toast-id="' + id + '"]');
    dismissToast(el);
  };

  /* ---------- Undo pour supprimerLivraison ---------- */
  const origSupprimer = window.supprimerLivraison;
  if (typeof origSupprimer === 'function' && !origSupprimer.__hasUndo) {
    const wrapped = async function(id) {
      const ok = await confirmDialog('Supprimer cette livraison ?', { titre:'Supprimer', icone:'📦', btnLabel:'Supprimer' });
      if (!ok) return;

      const livraisons = charger('livraisons');
      const livraison = livraisons.find(l => l.id === id);
      if (!livraison) return;

      // Snapshot pour undo
      const snapshot = JSON.parse(JSON.stringify(livraison));

      // Suppression
      if (typeof annulerArchiveFactureLivraison === 'function') {
        try { annulerArchiveFactureLivraison(livraison); } catch (e) {}
      }
      sauvegarder('livraisons', livraisons.filter(l => l.id !== id));
      if (typeof ajouterEntreeAudit === 'function') {
        ajouterEntreeAudit('Suppression livraison', (livraison.numLiv || 'Livraison') + ' · ' + (livraison.client || 'Client'));
      }
      if (typeof afficherLivraisons === 'function') afficherLivraisons();

      // Toast avec Undo
      window.afficherToast('🗑️ Livraison ' + (livraison.numLiv || '') + ' supprimée', 'success', {
        action: {
          label: 'Annuler',
          onClick: function() {
            const current = charger('livraisons');
            current.push(snapshot);
            sauvegarder('livraisons', current);
            if (typeof ajouterEntreeAudit === 'function') {
              ajouterEntreeAudit('Restauration livraison', (snapshot.numLiv || 'Livraison') + ' · ' + (snapshot.client || 'Client'));
            }
            if (typeof afficherLivraisons === 'function') afficherLivraisons();
            window.afficherToast('↩️ Livraison restaurée', 'info');
          }
        }
      });
    };
    wrapped.__hasUndo = true;
    window.supprimerLivraison = wrapped;
  }

  /* ---------- Undo pour bulkSupprimer ---------- */
  function installBulkUndo() {
    const origBulk = window.bulkSupprimer;
    if (typeof origBulk !== 'function' || origBulk.__hasUndo) return;

    const wrapped = async function() {
      // Réutiliser getSelectedIds qui vit dans le scope Sprint 6 IIFE
      const checkedBoxes = document.querySelectorAll('.bulk-liv-check:checked');
      const ids = Array.prototype.map.call(checkedBoxes, cb => cb.getAttribute('data-liv-id')).filter(Boolean);
      if (!ids.length) return;

      const ok = await confirmDialog('Supprimer ' + ids.length + ' livraison(s) ?', {
        titre: 'Suppression en masse', icone: '🗑️', btnLabel: 'Supprimer'
      });
      if (!ok) return;

      const livraisons = charger('livraisons');
      const snapshots = livraisons.filter(l => ids.indexOf(l.id) !== -1).map(l => JSON.parse(JSON.stringify(l)));

      const restantes = livraisons.filter(function(l) {
        if (ids.indexOf(l.id) !== -1) {
          if (typeof annulerArchiveFactureLivraison === 'function') {
            try { annulerArchiveFactureLivraison(l); } catch (e) {}
          }
          if (typeof ajouterEntreeAudit === 'function') {
            try { ajouterEntreeAudit('Suppression livraison (bulk)', (l.numLiv || 'Livraison') + ' · ' + (l.client || 'Client')); } catch (e) {}
          }
          return false;
        }
        return true;
      });

      sauvegarder('livraisons', restantes);
      if (typeof afficherLivraisons === 'function') afficherLivraisons();
      if (typeof window.bulkClear === 'function') window.bulkClear();

      window.afficherToast('🗑️ ' + ids.length + ' livraison(s) supprimée(s)', 'success', {
        action: {
          label: 'Annuler',
          onClick: function() {
            const current = charger('livraisons');
            snapshots.forEach(s => current.push(s));
            sauvegarder('livraisons', current);
            if (typeof ajouterEntreeAudit === 'function') {
              ajouterEntreeAudit('Restauration (bulk)', snapshots.length + ' livraison(s)');
            }
            if (typeof afficherLivraisons === 'function') afficherLivraisons();
            window.afficherToast('↩️ ' + snapshots.length + ' livraison(s) restaurée(s)', 'info');
          }
        }
      });
    };
    wrapped.__hasUndo = true;
    window.bulkSupprimer = wrapped;
  }

  // bulkSupprimer est défini dans une IIFE qui tourne au load — on attend
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(installBulkUndo, 200); });
  } else {
    setTimeout(installBulkUndo, 200);
  }
})();

/* =========================================================================
   SPRINT 11 — Formulaires intelligents
   Validation live, auto-calc visible, progression, erreurs inline
   ========================================================================= */
(function() {
  'use strict';

  const FIELD_RULES = {
    'modal-livraison': {
      required: ['liv-client'],
      atLeastOne: [['liv-prix-ht', 'liv-prix']],
      numeric: { 'liv-distance': { min: 0 }, 'liv-prix-ht': { min: 0 }, 'liv-prix': { min: 0 } },
      labels: {
        'liv-client': 'Client',
        'liv-prix-ht': 'Prix HT',
        'liv-prix': 'Prix TTC',
        'liv-distance': 'Distance'
      }
    }
  };

  function getField(id) { return document.getElementById(id); }

  function ensureErrorSlot(input) {
    let slot = input.parentElement.querySelector('.field-error');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'field-error';
      slot.setAttribute('data-for', input.id);
      input.parentElement.appendChild(slot);
    }
    return slot;
  }

  function setFieldState(input, state, message) {
    input.classList.remove('field-invalid', 'field-ok');
    if (state === 'invalid') input.classList.add('field-invalid');
    else if (state === 'valid') input.classList.add('field-ok');
    const slot = ensureErrorSlot(input);
    slot.textContent = message || '';
    slot.style.display = message ? 'block' : 'none';
  }

  function validateField(modalId, fieldId, opts) {
    const rules = FIELD_RULES[modalId]; if (!rules) return true;
    const input = getField(fieldId); if (!input) return true;
    const label = (rules.labels && rules.labels[fieldId]) || fieldId;
    const val = input.value.trim();

    if (rules.required && rules.required.indexOf(fieldId) !== -1) {
      if (!val) { setFieldState(input, 'invalid', label + ' est requis'); return false; }
    }

    if (rules.numeric && rules.numeric[fieldId]) {
      const n = parseFloat(val);
      if (val !== '' && (isNaN(n) || n < (rules.numeric[fieldId].min ?? 0))) {
        setFieldState(input, 'invalid', label + ' doit être ≥ ' + (rules.numeric[fieldId].min ?? 0));
        return false;
      }
    }

    if (rules.atLeastOne) {
      for (const group of rules.atLeastOne) {
        if (group.indexOf(fieldId) !== -1) {
          const anyFilled = group.some(id => {
            const el = getField(id);
            return el && parseFloat(el.value) > 0;
          });
          if (!anyFilled && opts && opts.submitting) {
            setFieldState(input, 'invalid', 'Au moins un montant (HT ou TTC) est requis');
            return false;
          }
        }
      }
    }

    if (val) setFieldState(input, 'valid', '');
    else setFieldState(input, null, '');
    return true;
  }

  function validateAll(modalId) {
    const rules = FIELD_RULES[modalId]; if (!rules) return { ok: true };
    const toCheck = new Set([
      ...(rules.required || []),
      ...Object.keys(rules.numeric || {}),
      ...((rules.atLeastOne || []).flat())
    ]);
    let firstInvalid = null;
    toCheck.forEach(id => {
      const ok = validateField(modalId, id, { submitting: true });
      if (!ok && !firstInvalid) firstInvalid = getField(id);
    });
    return { ok: !firstInvalid, firstInvalid };
  }

  /* ---------- Auto-calc visible : HT + TVA = TTC ---------- */
  function updateCalcSummary() {
    const box = document.getElementById('liv-calc-summary'); if (!box) return;
    const ht = parseFloat(getField('liv-prix-ht')?.value) || 0;
    const taux = parseFloat(getField('liv-taux-tva')?.value) || 20;
    const ttc = parseFloat(getField('liv-prix')?.value) || 0;
    const tva = ht > 0 ? ht * (taux / 100) : Math.max(0, ttc - ttc / (1 + taux / 100));
    const ttcEff = ht > 0 ? ht * (1 + taux / 100) : ttc;
    if (ht <= 0 && ttc <= 0) { box.style.display = 'none'; return; }
    box.style.display = 'flex';
    const fmt = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €';
    box.innerHTML =
      '<span class="calc-piece">HT <strong>' + fmt(ht > 0 ? ht : (ttc - tva)) + '</strong></span>' +
      '<span class="calc-op">+</span>' +
      '<span class="calc-piece">TVA ' + taux + '% <strong>' + fmt(tva) + '</strong></span>' +
      '<span class="calc-op">=</span>' +
      '<span class="calc-piece calc-total">TTC <strong>' + fmt(ttcEff) + '</strong></span>';
  }

  /* ---------- Injection UI dans le modal ---------- */
  function installModalLivraison() {
    const modal = document.getElementById('modal-livraison'); if (!modal) return;
    if (modal.dataset.sprint11 === '1') return;
    modal.dataset.sprint11 = '1';

    const ttcField = getField('liv-prix');
    if (ttcField && !document.getElementById('liv-calc-summary')) {
      const box = document.createElement('div');
      box.id = 'liv-calc-summary';
      box.className = 'calc-summary';
      box.style.display = 'none';
      const grid = ttcField.closest('.form-grid');
      if (grid) grid.insertAdjacentElement('afterend', box);
    }

    const rules = FIELD_RULES['modal-livraison'];
    const allIds = new Set([...(rules.required || []), ...Object.keys(rules.numeric || {}), ...((rules.atLeastOne || []).flat())]);
    allIds.forEach(id => {
      const input = getField(id); if (!input) return;
      ensureErrorSlot(input);
      if ((rules.required || []).indexOf(id) !== -1) {
        const label = input.parentElement.querySelector('label');
        if (label && !label.classList.contains('field-required')) {
          label.innerHTML = label.innerHTML.replace(/\s*\*+\s*$/, '').trim();
          label.classList.add('field-required');
        }
      }
      if (input.dataset.s11Bound) return;
      input.dataset.s11Bound = '1';
      input.addEventListener('blur', () => validateField('modal-livraison', id));
      input.addEventListener('input', () => {
        if (input.classList.contains('field-invalid')) validateField('modal-livraison', id);
      });
    });

    const body = modal.querySelector('.modal-body');
    if (body && !body.dataset.s11Progress) {
      body.dataset.s11Progress = '1';
      body.addEventListener('input', updateCalcSummary);
      body.addEventListener('change', updateCalcSummary);
    }
  }

  /* ---------- Wrap openModal pour installer + reset ---------- */
  if (typeof window.openModal === 'function' && !window.openModal.__s11) {
    const origOpen = window.openModal;
    const wrapped = function(id) {
      origOpen.apply(this, arguments);
      if (id === 'modal-livraison') {
        setTimeout(() => {
          installModalLivraison();
          document.querySelectorAll('#modal-livraison .field-error').forEach(e => { e.textContent = ''; e.style.display = 'none'; });
          document.querySelectorAll('#modal-livraison .field-invalid, #modal-livraison .field-ok').forEach(e => e.classList.remove('field-invalid', 'field-ok'));
          updateCalcSummary();
        }, 20);
      }
    };
    wrapped.__s11 = true;
    window.openModal = wrapped;
  }

  /* ---------- Wrap ajouterLivraison : validation bloquante inline ---------- */
  if (typeof window.ajouterLivraison === 'function' && !window.ajouterLivraison.__s11) {
    const orig = window.ajouterLivraison;
    const wrapped = function() {
      const res = validateAll('modal-livraison');
      if (!res.ok) {
        if (res.firstInvalid) {
          res.firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => res.firstInvalid.focus(), 300);
        }
        window.afficherToast('⚠️ Corrige les champs en rouge avant d\'enregistrer', 'warning');
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped.__s11 = true;
    window.ajouterLivraison = wrapped;
  }

  window.FORM11 = { validateField, validateAll, updateCalcSummary, installModalLivraison };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installModalLivraison);
  } else {
    installModalLivraison();
  }
})();

/* ============================================================
   SPRINT 15 — Productivité PGI
   1. Auto-création client depuis facture
   2. Badge facture orpheline (sans LIV)
   3. Alerte échéance imminente dashboard (J-5/3/1)
   4. Bouton rappel préventif (niv 0, avant échéance)
   5. Copie rapide au clic (N° facture / SIREN / IBAN)
   6. Recherche globale Ctrl+K
   7. Historique modifications (factures / livraisons / clients)
   8. Export Z quotidien
   ============================================================ */
(function(){
  if (window.__s15Installed) return;
  window.__s15Installed = true;

  const LS = {
    clients: 'clients', livraisons: 'livraisons', factures: 'factures_emises',
    avoirs: 'avoirs_emis', paiements: 'paiements', params: 'params_entreprise',
    history: 'history_log'
  };

  /* ---------- Helpers ---------- */
  const load = (k) => { try { return loadSafe(k, []); } catch(e) { return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const escHtml = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
  const isoDate = (d) => { const x = new Date(d); return isNaN(x) ? '' : x.toLocalISODate(); };
  const genId = () => (typeof window.genId === 'function' ? window.genId() : 's15_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
  const toast = (msg, type) => { if (typeof window.afficherToast === 'function') window.afficherToast(msg, type||'info'); };
  const audit = (act, det) => { if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit(act, det); };

  /* ---------- Modal générique (utilisé par echeances, historique, Export Z) ---------- */
  window.modalInfo = window.modalInfo || function(htmlContent) {
    let modal = document.getElementById('s15-modal-info');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 's15-modal-info';
      modal.className = 's15-modal-info-overlay';
      modal.innerHTML = '<div class="s15-modal-info-box"><button class="s15-modal-info-close" aria-label="Fermer">✕</button><div class="s15-modal-info-body"></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
      modal.querySelector('.s15-modal-info-close').addEventListener('click', () => modal.classList.remove('open'));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) modal.classList.remove('open'); });
    }
    modal.querySelector('.s15-modal-info-body').innerHTML = htmlContent;
    modal.classList.add('open');
    return modal;
  };
  // closeModal compat pour 'modal-info'
  const _origCloseModal = window.closeModal;
  window.closeModal = function(id) {
    if (id === 'modal-info') { document.getElementById('s15-modal-info')?.classList.remove('open'); return; }
    if (typeof _origCloseModal === 'function') return _origCloseModal.apply(this, arguments);
  };

  /* ============================================================
     1. AUTO-CRÉATION CLIENT DEPUIS FACTURE
     Si une facture est émise et qu'aucun client DB ne correspond,
     propose de créer la fiche à la volée.
     ============================================================ */
  function findClientByName(nom) {
    if (!nom) return null;
    const k = nom.trim().toLowerCase();
    return load(LS.clients).find(c => (c.nom||'').trim().toLowerCase() === k) || null;
  }







  /* ============================================================
     5. COPIE RAPIDE AU CLIC (délégation sur [data-copy])
     ============================================================ */
  function copyToClipboard(text) {
    if (!text) return Promise.reject();
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    // Fallback textarea
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e){}
    ta.remove();
    return Promise.resolve();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-copy]');
    if (!el) return;
    const text = el.getAttribute('data-copy') || el.textContent.trim();
    copyToClipboard(text).then(() => {
      toast('📋 Copié : '+ (text.length > 40 ? text.slice(0,40)+'…' : text), 'success');
      el.classList.add('s15-copy-flash');
      setTimeout(() => el.classList.remove('s15-copy-flash'), 600);
    }).catch(() => toast('Impossible de copier', 'error'));
  });

  // Rend copiables les éléments correspondant à certains patterns

  /* ============================================================
     6. RECHERCHE GLOBALE Ctrl+K
     ============================================================ */
  function buildSearchIndex() {
    const clients = load(LS.clients).map(c => ({ type:'client', id:c.id, label:c.nom||'(sans nom)', sub: (c.siren||c.email||c.ville||''), obj:c }));
    const livs = load(LS.livraisons).map(l => ({ type:'livraison', id:l.id, label:l.numero||'(sans N°)', sub: (l.client||'')+' · '+fmtDate(l.date), obj:l }));
    const factures = load(LS.factures).map(f => ({ type:'facture', id:f.id, label:f.numero||'(sans N°)', sub: (f.client||'')+' · '+fmtEur(f.totalTTC||f.total||0), obj:f }));
    const paiements = load(LS.paiements).map(p => ({ type:'paiement', id:p.id, label:'Paiement '+(p.numero||p.id?.slice(-4)||''), sub: fmtEur(p.montant||0)+' · '+fmtDate(p.date), obj:p }));
    return [...clients, ...livs, ...factures, ...paiements];
  }

  function openPalette() {
    let modal = document.getElementById('s15-palette');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 's15-palette';
      modal.className = 's15-palette-overlay';
      modal.innerHTML = ''
        + '<div class="s15-palette-box" role="dialog" aria-label="Recherche globale">'
        + '  <div class="s15-palette-header">'
        + '    <span style="font-size:1.2rem">🔍</span>'
        + '    <input type="text" id="s15-palette-input" placeholder="Rechercher client, facture, livraison, paiement…" autocomplete="off" />'
        + '    <kbd class="s15-palette-kbd">Esc</kbd>'
        + '  </div>'
        + '  <div class="s15-palette-results" id="s15-palette-results"></div>'
        + '  <div class="s15-palette-footer"><kbd>↑↓</kbd> naviguer · <kbd>↵</kbd> ouvrir · <kbd>Ctrl+K</kbd> fermer</div>'
        + '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closePalette(); });
      const input = modal.querySelector('#s15-palette-input');
      input.addEventListener('input', refreshPaletteResults);
      input.addEventListener('keydown', handlePaletteKey);
    }
    modal.classList.add('open');
    const input = modal.querySelector('#s15-palette-input');
    input.value = '';
    refreshPaletteResults();
    setTimeout(()=>input.focus(), 30);
  }
  function closePalette() {
    const modal = document.getElementById('s15-palette');
    if (modal) modal.classList.remove('open');
  }
  let _paletteSel = 0;
  function refreshPaletteResults() {
    const q = (document.getElementById('s15-palette-input')?.value || '').toLowerCase().trim();
    const box = document.getElementById('s15-palette-results');
    if (!box) return;
    const idx = buildSearchIndex();
    const filt = !q ? idx.slice(0, 20) : idx.filter(r => (r.label+' '+r.sub).toLowerCase().includes(q)).slice(0, 30);
    _paletteSel = 0;
    if (!filt.length) { box.innerHTML = '<div class="s15-palette-empty">Aucun résultat pour "'+escHtml(q)+'"</div>'; return; }
    const icons = { client:'👤', livraison:'📦', facture:'📄', paiement:'💰' };
    box.innerHTML = filt.map((r,i) => '<div class="s15-palette-item'+(i===0?' selected':'')+'" data-idx="'+i+'" data-type="'+r.type+'" data-id="'+escHtml(r.id||'')+'">'
      + '<span class="s15-palette-icon">'+icons[r.type]+'</span>'
      + '<span class="s15-palette-lbl"><strong>'+escHtml(r.label)+'</strong>'
      + (r.sub ? '<span class="s15-palette-sub">'+escHtml(r.sub)+'</span>' : '')
      + '</span>'
      + '<span class="s15-palette-type">'+r.type+'</span>'
      + '</div>').join('');
    box.querySelectorAll('.s15-palette-item').forEach(it => {
      it.addEventListener('click', () => { _paletteSel = parseInt(it.dataset.idx, 10); activatePaletteItem(filt); });
      it.addEventListener('mouseenter', () => { _paletteSel = parseInt(it.dataset.idx, 10); updatePaletteSelection(); });
    });
    box.__filt = filt;
  }
  function updatePaletteSelection() {
    const box = document.getElementById('s15-palette-results');
    if (!box) return;
    box.querySelectorAll('.s15-palette-item').forEach((it,i) => it.classList.toggle('selected', i === _paletteSel));
    const sel = box.querySelector('.s15-palette-item.selected');
    sel?.scrollIntoView({ block:'nearest' });
  }
  function handlePaletteKey(e) {
    const box = document.getElementById('s15-palette-results');
    const filt = box?.__filt || [];
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); _paletteSel = Math.min(filt.length-1, _paletteSel+1); updatePaletteSelection(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _paletteSel = Math.max(0, _paletteSel-1); updatePaletteSelection(); }
    else if (e.key === 'Enter') { e.preventDefault(); activatePaletteItem(filt); }
  }
  function activatePaletteItem(filt) {
    const r = filt[_paletteSel]; if (!r) return;
    closePalette();
    const navTo = (page, cb) => { if (typeof window.naviguerVers === 'function') window.naviguerVers(page); if (cb) setTimeout(cb, 160); };
    if (r.type === 'client') navTo('clients', () => { if (typeof window.ouvrirHistoriqueClient === 'function') window.ouvrirHistoriqueClient(r.id); });
    else if (r.type === 'livraison') navTo('livraisons', () => { const row = document.querySelector('[data-livraison-id="'+r.id+'"]'); row?.scrollIntoView({behavior:'smooth',block:'center'}); row?.classList.add('s15-pulse'); setTimeout(()=>row?.classList.remove('s15-pulse'), 1500); });
    else if (r.type === 'facture') navTo('facturation', () => { toast('Facture '+r.label, 'info'); });
    else if (r.type === 'paiement') navTo('encaissements');
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const modal = document.getElementById('s15-palette');
      if (modal?.classList.contains('open')) closePalette(); else openPalette();
    }
  });

  /* ============================================================
     7. HISTORIQUE MODIFICATIONS (factures / livraisons / clients)
     ============================================================ */
  function logChange(entity, entityId, field, oldV, newV, label) {
    const log = load(LS.history);
    log.push({
      id: genId(), entity, entityId, field, oldValue: oldV, newValue: newV, label,
      date: new Date().toISOString()
    });
    // cap at 2000 entries
    if (log.length > 2000) log.splice(0, log.length - 2000);
    save(LS.history, log);
  }
  window.logChange = logChange;

  // Hook confirmerEditClient (Sprint 13)
  if (typeof window.confirmerEditClient === 'function' && !window.confirmerEditClient.__s15) {
    const orig = window.confirmerEditClient;
    const w = function() {
      const id = document.getElementById('edit-client-id')?.value || '';
      const before = load(LS.clients).find(c => c.id === id);
      const r = orig.apply(this, arguments);
      const after = load(LS.clients).find(c => c.id === id);
      if (before && after) {
        ['nom','siren','tvaIntra','email','emailFact','telephone','adresse','delaiPaiementJours','type'].forEach(k => {
          if (String(before[k]||'') !== String(after[k]||'')) logChange('client', id, k, before[k], after[k], after.nom||'Client');
        });
      }
      return r;
    };
    w.__s15 = true;
    window.confirmerEditClient = w;
  }




  /* ============================================================
     INIT
     ============================================================ */
  // Note : hookFacturationPostProcess et hookDashboardS15 supprimés —
  // ils patchaient afficherFacturation et afficherDashboard qui n'existent
  // pas (commit 09dc43e). Le typeof check rendait les hooks toujours no-op.
  function initS15() {
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initS15);
  else setTimeout(initS15, 90);
})();

/* ============================================================
   SPRINT 16 — Calendrier opérationnel
   Vue jour/semaine/mois/année · events agrégés (livraisons,
   factures, échéances, relances, paiements, jours fériés FR 2000-2100)
   · drag & drop livraisons · filtres · impression
   ============================================================ */
(function(){
  if (window.__s16Installed) return;
  window.__s16Installed = true;

  const LS = {
    clients:'clients', livraisons:'livraisons', factures:'factures_emises',
    avoirs:'avoirs_emis', paiements:'paiements', relances:'relances_log', params:'params_entreprise'
  };

  /* ---------- Helpers ---------- */
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const escHtml = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const pad = (n) => String(n).padStart(2,'0');
  const isoDate = (d) => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parseISO = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const toast = (msg, type) => { if (typeof window.afficherToast === 'function') window.afficherToast(msg, type||'info'); };

  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const JOURS_COURT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  /* ---------- Jours fériés FR (algo Pâques Meeus, 2000-2100) ---------- */
  function paquesDate(year) {
    const a = year % 19;
    const b = Math.floor(year/100), c = year % 100;
    const d = Math.floor(b/4), e = b % 4;
    const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3);
    const h = (19*a + b - d - g + 15) % 30;
    const i = Math.floor(c/4), k = c % 4;
    const L = (32 + 2*e + 2*i - h - k) % 7;
    const m = Math.floor((a + 11*h + 22*L)/451);
    const month = Math.floor((h + L - 7*m + 114) / 31);
    const day = ((h + L - 7*m + 114) % 31) + 1;
    return new Date(year, month-1, day);
  }
  const _feriesCache = {};
  function feriesDeLAnnee(year) {
    if (_feriesCache[year]) return _feriesCache[year];
    const paques = paquesDate(year);
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
    const list = [
      { date: new Date(year, 0, 1),   nom: 'Jour de l\'An' },
      { date: addDays(paques, 1),     nom: 'Lundi de Pâques' },
      { date: new Date(year, 4, 1),   nom: 'Fête du Travail' },
      { date: new Date(year, 4, 8),   nom: 'Victoire 1945' },
      { date: addDays(paques, 39),    nom: 'Ascension' },
      { date: addDays(paques, 50),    nom: 'Lundi de Pentecôte' },
      { date: new Date(year, 6, 14),  nom: 'Fête Nationale' },
      { date: new Date(year, 7, 15),  nom: 'Assomption' },
      { date: new Date(year, 10, 1),  nom: 'Toussaint' },
      { date: new Date(year, 10, 11), nom: 'Armistice 1918' },
      { date: new Date(year, 11, 25), nom: 'Noël' }
    ];
    _feriesCache[year] = list;
    return list;
  }
  function feriePourDate(d) {
    const list = feriesDeLAnnee(d.getFullYear());
    return list.find(f => sameDay(f.date, d)) || null;
  }

  /* ---------- Agrégation events ---------- */
  function getClientById(id) { return load(LS.clients).find(c => c.id === id) || null; }
  function echeanceFacture(f) {
    const client = f.clientId ? getClientById(f.clientId) : null;
    const delai = Number(client?.delaiPaiementJours) || 30;
    const base = parseISO(f.dateFacture || f.date || f.dateLivraison);
    if (!base) return null;
    const d = new Date(base); d.setDate(d.getDate() + delai); d.setHours(0,0,0,0);
    return d;
  }
  function soldeFacture(f) {
    if (f.statut === 'annulée') return 0;
    const ttc = Number(f.totalTTC || f.total || 0);
    const paid = load(LS.paiements).filter(p => p.factureId === f.id).reduce((s,p)=>s+Number(p.montant||0),0);
    const av = load(LS.avoirs).filter(a => a.factureId === f.id).reduce((s,a)=>s+Number(a.totalTTC||a.total||0),0);
    return Math.max(0, ttc - paid - av);
  }

  function getEventsForRange(start, end) {
    const events = [];
    const startT = start.getTime(), endT = end.getTime();
    // Livraisons
    load(LS.livraisons).forEach(l => {
      const d = parseISO(l.date); if (!d) return;
      d.setHours(0,0,0,0);
      if (d.getTime() < startT || d.getTime() > endT) return;
      events.push({ type:'livraisons', date:d, icon:'📦', label: (l.numero||'Liv')+' · '+(l.client||''), color:'#22c55e',
        id:l.id, draggable:true, onclick: () => navToLivraison(l.id) });
    });
    // Factures émises
    load(LS.factures).forEach(f => {
      if (f.statut === 'annulée') return;
      const d = parseISO(f.dateFacture || f.date || f.dateLivraison); if (!d) return;
      d.setHours(0,0,0,0);
      if (d.getTime() >= startT && d.getTime() <= endT) {
        events.push({ type:'factures', date:d, icon:'📄', label:(f.numero||'Fac')+' · '+(f.client||''), color:'#6366f1',
          id:f.id, onclick: () => navToFacture(f.id) });
      }
      // Échéance
      const ech = echeanceFacture(f);
      if (ech && ech.getTime() >= startT && ech.getTime() <= endT) {
        const solde = soldeFacture(f);
        if (solde > 0.01) {
          events.push({ type:'echeances', date:ech, icon:'⏰', label:'Éch. '+(f.numero||'')+' · '+fmtEur(solde), color:'#ef4444',
            id:'ech_'+f.id, onclick: () => navToFacture(f.id) });
        }
      }
    });
    // Relances
    load(LS.relances).forEach(r => {
      const d = parseISO(r.date); if (!d) return;
      d.setHours(0,0,0,0);
      if (d.getTime() < startT || d.getTime() > endT) return;
      events.push({ type:'relances', date:d, icon:'🔔', label:'Relance N'+r.niveau+' · '+(r.factureNumero||''), color:'#f97316',
        id:r.id, onclick: () => navToRelance(r.factureId) });
    });
    // Paiements
    load(LS.paiements).forEach(p => {
      const d = parseISO(p.date); if (!d) return;
      d.setHours(0,0,0,0);
      if (d.getTime() < startT || d.getTime() > endT) return;
      events.push({ type:'paiements', date:d, icon:'💰', label:fmtEur(p.montant||0)+' · '+(p.factureNumero||p.mode||''), color:'#eab308',
        id:p.id, onclick: () => navToEncaissements() });
    });
    return events;
  }

  function navToLivraison(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('livraisons');
    setTimeout(() => {
      const row = document.querySelector('[data-livraison-id="'+id+'"]');
      row?.scrollIntoView({behavior:'smooth',block:'center'});
      row?.classList.add('s15-pulse');
      setTimeout(()=>row?.classList.remove('s15-pulse'), 1500);
    }, 160);
  }
  function navToFacture(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('facturation');
  }
  function navToRelance(factureId) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('encaissements');
    setTimeout(() => { if (typeof window.switchEncTab === 'function') window.switchEncTab('relances'); }, 120);
  }
  function navToEncaissements() {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('encaissements');
  }

  /* ---------- State ---------- */
  const state = {
    vue: 'mois',
    curseur: startOfDay(new Date())
  };

  function getFiltresActifs() {
    const out = { livraisons:true, factures:true, echeances:true, relances:true, paiements:true, feries:true };
    document.querySelectorAll('[data-cal-filter]').forEach(c => {
      out[c.dataset.calFilter] = c.checked;
    });
    return out;
  }

  /* ---------- Bounds période ---------- */
  function getBounds() {
    const c = state.curseur;
    if (state.vue === 'jour') {
      const s = startOfDay(c), e = new Date(s); e.setHours(23,59,59,999);
      return { start:s, end:e };
    }
    if (state.vue === 'semaine') {
      const dow = (c.getDay()+6) % 7; // 0=lundi
      const s = startOfDay(new Date(c)); s.setDate(s.getDate()-dow);
      const e = new Date(s); e.setDate(e.getDate()+6); e.setHours(23,59,59,999);
      return { start:s, end:e };
    }
    if (state.vue === 'mois') {
      const s = new Date(c.getFullYear(), c.getMonth(), 1);
      const e = new Date(c.getFullYear(), c.getMonth()+1, 0, 23, 59, 59, 999);
      return { start:s, end:e };
    }
    // année
    const s = new Date(c.getFullYear(), 0, 1);
    const e = new Date(c.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start:s, end:e };
  }

  /* ---------- Label titre ---------- */
  function setLabels() {
    const { start, end } = getBounds();
    const lbl = document.getElementById('cal16-label');
    const sub = document.getElementById('cal16-sub');
    if (!lbl) return;
    if (state.vue === 'jour') {
      const d = start;
      lbl.textContent = JOURS[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
      sub.textContent = '';
    } else if (state.vue === 'semaine') {
      lbl.textContent = 'Semaine du ' + start.getDate() + ' ' + MOIS[start.getMonth()] + ' au ' + end.getDate() + ' ' + MOIS[end.getMonth()];
      sub.textContent = 'Semaine ' + numeroSemaine(start) + ' · ' + start.getFullYear();
    } else if (state.vue === 'mois') {
      lbl.textContent = MOIS[start.getMonth()] + ' ' + start.getFullYear();
      sub.textContent = '';
    } else {
      lbl.textContent = 'Année ' + start.getFullYear();
      sub.textContent = '';
    }
  }
  function numeroSemaine(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (t.getUTCDay()+6)%7;
    t.setUTCDate(t.getUTCDate()-dayNum+3);
    const firstThu = new Date(Date.UTC(t.getUTCFullYear(),0,4));
    return 1 + Math.round(((t-firstThu)/86400000 - 3 + ((firstThu.getUTCDay()+6)%7))/7);
  }

  /* ---------- KPI mois courant ---------- */
  function setKPIMoisCourant() {
    const c = state.curseur;
    const s = new Date(c.getFullYear(), c.getMonth(), 1);
    const e = new Date(c.getFullYear(), c.getMonth()+1, 0, 23,59,59,999);
    const events = getEventsForRange(s, e);
    const cntLiv = events.filter(ev => ev.type==='livraisons').length;
    const cntFac = events.filter(ev => ev.type==='factures').length;
    const cntEch = events.filter(ev => ev.type==='echeances').length;
    const pai = load(LS.paiements).filter(p => {
      const d = parseISO(p.date); if(!d) return false;
      return d >= s && d <= e;
    }).reduce((s,p)=>s+Number(p.montant||0),0);
    const set = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal16-kpi-liv', cntLiv);
    set('cal16-kpi-fac', cntFac);
    set('cal16-kpi-ech', cntEch);
    set('cal16-kpi-pai', fmtEur(pai));
  }

  /* ---------- Rendu vue mois ---------- */
  function renderMois() {
    const grid = document.getElementById('cal16-grid');
    if (!grid) return;
    const c = state.curseur;
    const firstDay = new Date(c.getFullYear(), c.getMonth(), 1);
    const dowStart = (firstDay.getDay()+6)%7;
    const gridStart = new Date(firstDay); gridStart.setDate(gridStart.getDate() - dowStart);
    const gridEnd = new Date(gridStart); gridEnd.setDate(gridEnd.getDate()+41); gridEnd.setHours(23,59,59,999);
    const events = getEventsForRange(gridStart, gridEnd);
    const filtres = getFiltresActifs();
    const today = startOfDay(new Date());

    let html = '<div class="cal16-mois">';
    // Header jours
    html += '<div class="cal16-mois-header">' + JOURS_COURT.map(j => '<div class="cal16-mois-hcell">'+j+'</div>').join('') + '</div>';
    html += '<div class="cal16-mois-body">';
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(d.getDate()+i);
      const isCurMonth = d.getMonth() === c.getMonth();
      const isToday = sameDay(d, today);
      const ferie = filtres.feries ? feriePourDate(d) : null;
      const evsJour = events.filter(ev => sameDay(ev.date, d) && filtres[ev.type]);
      const cls = ['cal16-day'];
      if (!isCurMonth) cls.push('cal16-day-other');
      if (isToday) cls.push('cal16-day-today');
      if (ferie) cls.push('cal16-day-ferie');
      if (d.getDay() === 0 || d.getDay() === 6) cls.push('cal16-day-weekend');
      html += '<div class="'+cls.join(' ')+'" data-date="'+isoDate(d)+'">';
      html += '<div class="cal16-day-head">'
        + '<span class="cal16-day-num">'+d.getDate()+'</span>'
        + '</div>';
      if (ferie) html += '<div class="cal16-day-ferie-row" title="'+escHtml(ferie.nom)+'">🎉 '+escHtml(ferie.nom)+'</div>';
      const maxShow = 4;
      evsJour.slice(0, maxShow).forEach(ev => {
        html += '<div class="cal16-event cal16-event-'+ev.type+'" '
          + (ev.draggable ? 'draggable="true" data-drag-id="'+escHtml(ev.id)+'" data-drag-type="'+ev.type+'"' : '')
          + ' data-ev-id="'+escHtml(ev.id)+'" title="'+escHtml(ev.label)+'">'
          + '<span class="cal16-event-icon">'+ev.icon+'</span>'
          + '<span class="cal16-event-lbl">'+escHtml(ev.label)+'</span>'
          + '</div>';
      });
      if (evsJour.length > maxShow) {
        html += '<div class="cal16-event-more" data-more-date="'+isoDate(d)+'">+'+(evsJour.length-maxShow)+' autres…</div>';
      }
      html += '</div>';
    }
    html += '</div></div>';
    grid.innerHTML = html;
    wireInteractions(grid, events);
  }

  /* ---------- Rendu vue semaine ---------- */
  function renderSemaine() {
    const grid = document.getElementById('cal16-grid');
    if (!grid) return;
    const { start, end } = getBounds();
    const events = getEventsForRange(start, end);
    const filtres = getFiltresActifs();
    const today = startOfDay(new Date());

    let html = '<div class="cal16-semaine">';
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate()+i);
      const isToday = sameDay(d, today);
      const ferie = filtres.feries ? feriePourDate(d) : null;
      const evsJour = events.filter(ev => sameDay(ev.date, d) && filtres[ev.type]);
      const cls = ['cal16-sem-col']; if (isToday) cls.push('cal16-day-today'); if (ferie) cls.push('cal16-day-ferie');
      if (d.getDay()===0 || d.getDay()===6) cls.push('cal16-day-weekend');
      html += '<div class="'+cls.join(' ')+'" data-date="'+isoDate(d)+'">';
      html += '<div class="cal16-sem-head"><strong>'+JOURS_COURT[(d.getDay()+6)%7]+' '+d.getDate()+'</strong>'
        + (ferie ? '<div class="cal16-day-ferie-tag" title="'+escHtml(ferie.nom)+'">'+escHtml(ferie.nom)+'</div>' : '')
        + '</div>';
      html += '<div class="cal16-sem-events">';
      evsJour.forEach(ev => {
        html += '<div class="cal16-event cal16-event-'+ev.type+'" '
          + (ev.draggable ? 'draggable="true" data-drag-id="'+escHtml(ev.id)+'" data-drag-type="'+ev.type+'"' : '')
          + ' data-ev-id="'+escHtml(ev.id)+'" title="'+escHtml(ev.label)+'">'
          + '<span class="cal16-event-icon">'+ev.icon+'</span>'
          + '<span class="cal16-event-lbl">'+escHtml(ev.label)+'</span>'
          + '</div>';
      });
      if (!evsJour.length) html += '<div class="cal16-empty">Aucun événement</div>';
      html += '</div></div>';
    }
    html += '</div>';
    grid.innerHTML = html;
    wireInteractions(grid, events);
  }

  /* ---------- Rendu vue jour ---------- */
  function renderJour() {
    const grid = document.getElementById('cal16-grid');
    if (!grid) return;
    const { start, end } = getBounds();
    const events = getEventsForRange(start, end);
    const filtres = getFiltresActifs();
    const ferie = filtres.feries ? feriePourDate(start) : null;

    let html = '<div class="cal16-jour" data-date="'+isoDate(start)+'">';
    html += '<div class="cal16-jour-back">'
      + '<button class="btn-secondary" onclick="window.cal16.retourMois()" title="Retour à la vue mois">← Retour au mois</button>'
      + '<button class="cal16-jour-close" onclick="window.cal16.retourMois()" title="Fermer" aria-label="Fermer">✕</button>'
      + '</div>';
    if (ferie) html += '<div class="cal16-jour-ferie">🎉 '+escHtml(ferie.nom)+' (jour férié)</div>';
    const groups = [['livraisons','📦 Livraisons'],['factures','📄 Factures émises'],['echeances','⏰ Échéances'],['relances','🔔 Relances'],['paiements','💰 Paiements']];
    groups.forEach(([t, titre]) => {
      if (!filtres[t]) return;
      const evs = events.filter(ev => ev.type === t);
      if (!evs.length) return;
      html += '<div class="cal16-jour-section"><h3>'+titre+' <span class="cal16-count">('+evs.length+')</span></h3>';
      evs.forEach(ev => {
        html += '<div class="cal16-event cal16-event-'+ev.type+' cal16-event-big" '
          + (ev.draggable ? 'draggable="true" data-drag-id="'+escHtml(ev.id)+'" data-drag-type="'+ev.type+'"' : '')
          + ' data-ev-id="'+escHtml(ev.id)+'">'
          + '<span class="cal16-event-icon">'+ev.icon+'</span>'
          + '<span class="cal16-event-lbl">'+escHtml(ev.label)+'</span>'
          + '</div>';
      });
      html += '</div>';
    });
    if (!events.length) html += '<div class="cal16-empty" style="padding:40px;text-align:center">Aucun événement ce jour</div>';
    html += '</div>';
    grid.innerHTML = html;
    wireInteractions(grid, events);
  }

  /* ---------- Rendu vue année ---------- */
  function renderAnnee() {
    const grid = document.getElementById('cal16-grid');
    if (!grid) return;
    const c = state.curseur;
    const filtres = getFiltresActifs();
    let html = '<div class="cal16-annee">';
    for (let m = 0; m < 12; m++) {
      const s = new Date(c.getFullYear(), m, 1);
      const e = new Date(c.getFullYear(), m+1, 0, 23,59,59,999);
      const events = getEventsForRange(s, e).filter(ev => filtres[ev.type]);
      const ecount = events.filter(ev => ev.type==='echeances').length;
      const lcount = events.filter(ev => ev.type==='livraisons').length;
      const fcount = events.filter(ev => ev.type==='factures').length;
      const feriesM = filtres.feries ? feriesDeLAnnee(c.getFullYear()).filter(f => f.date.getMonth() === m) : [];
      html += '<div class="cal16-annee-mois" onclick="window.cal16.allerA('+c.getFullYear()+','+m+')">';
      html += '<div class="cal16-annee-mois-title">'+MOIS[m]+'</div>';
      html += '<div class="cal16-annee-mini">' + renderMiniMois(c.getFullYear(), m, events, feriesM) + '</div>';
      html += '<div class="cal16-annee-kpis">'
        + '<span title="Livraisons">📦'+lcount+'</span>'
        + '<span title="Factures">📄'+fcount+'</span>'
        + '<span title="Échéances">⏰'+ecount+'</span>'
        + '</div>';
      html += '</div>';
    }
    html += '</div>';
    grid.innerHTML = html;
  }
  function renderMiniMois(year, month, events, feriesM) {
    const first = new Date(year, month, 1);
    const dow = (first.getDay()+6)%7;
    const daysInMonth = new Date(year, month+1, 0).getDate();
    let out = '<div class="cal16-mini-header">' + JOURS_COURT.map(j => '<span>'+j[0]+'</span>').join('') + '</div>';
    out += '<div class="cal16-mini-grid">';
    for (let i = 0; i < dow; i++) out += '<span class="cal16-mini-pad"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const hasEv = events.some(ev => sameDay(ev.date, date));
      const hasEch = events.some(ev => ev.type==='echeances' && sameDay(ev.date, date));
      const ferie = feriesM.some(f => sameDay(f.date, date));
      const today = sameDay(date, new Date());
      const cls = ['cal16-mini-day'];
      if (today) cls.push('t');
      if (hasEch) cls.push('ech');
      else if (hasEv) cls.push('ev');
      if (ferie) cls.push('fer');
      out += '<span class="'+cls.join(' ')+'">'+d+'</span>';
    }
    out += '</div>';
    return out;
  }

  /* ---------- Interactions (click events, drag/drop) ---------- */
  function wireInteractions(grid, events) {
    const byId = new Map();
    events.forEach(ev => byId.set(ev.id, ev));
    // Click sur event
    grid.querySelectorAll('.cal16-event').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.evId;
        const ev = byId.get(id);
        if (ev?.onclick) ev.onclick();
      });
    });
    // "voir plus" sur un jour
    grid.querySelectorAll('.cal16-event-more').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = el.dataset.moreDate;
        ouvrirDetailJour(date);
      });
    });
    // Drag & drop livraisons
    grid.querySelectorAll('[draggable="true"][data-drag-type="livraisons"]').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', el.dataset.dragId);
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('cal16-dragging');
      });
      el.addEventListener('dragend', () => el.classList.remove('cal16-dragging'));
    });
    // Zones drop
    grid.querySelectorAll('[data-date]').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cell.classList.add('cal16-drop-hover');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('cal16-drop-hover'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('cal16-drop-hover');
        const livId = e.dataTransfer.getData('text/plain');
        const newDate = cell.dataset.date;
        if (!livId || !newDate) return;
        deplacerLivraison(livId, newDate);
      });
    });
    // Click sur numéro du jour (mois) → vue jour filtrée sur ce jour
    grid.querySelectorAll('.cal16-day[data-date]').forEach(cell => {
      const num = cell.querySelector('.cal16-day-num');
      num?.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = cell.dataset.date;
        if (!d) return;
        state.curseur = parseISO(d);
        state.vue = 'jour';
        const s = document.getElementById('cal16-vue'); if (s) s.value = 'jour';
        render();
      });
    });
    // Click sur en-tête jour (semaine) → vue jour
    grid.querySelectorAll('.cal16-sem-col[data-date]').forEach(cell => {
      const head = cell.querySelector('.cal16-sem-head strong');
      head?.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = cell.dataset.date;
        if (!d) return;
        state.curseur = parseISO(d);
        state.vue = 'jour';
        const s = document.getElementById('cal16-vue'); if (s) s.value = 'jour';
        render();
      });
    });
  }

  function deplacerLivraison(livId, newDateISO) {
    const livs = load(LS.livraisons);
    const l = livs.find(x => x.id === livId);
    if (!l) return;
    const old = l.date;
    if ((old||'').slice(0,10) === newDateISO) return;
    l.date = newDateISO;
    save(LS.livraisons, livs);
    if (typeof window.logChange === 'function') window.logChange('livraison', livId, 'date', old, newDateISO, l.numero || 'Livraison');
    if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit('Déplacement livraison', (l.numero||'')+' : '+(old||'')+' → '+newDateISO);
    toast('📦 '+(l.numero||'Livraison')+' déplacée au '+new Date(newDateISO).toLocaleDateString('fr-FR'), 'success');
    render();
    if (typeof window.afficherLivraisons === 'function') window.afficherLivraisons();
    if (typeof window.__s14RefreshBanner === 'function') window.__s14RefreshBanner();
  }

  function ouvrirDetailJour(dateISO) {
    state.curseur = parseISO(dateISO);
    state.vue = 'jour';
    document.getElementById('cal16-vue').value = 'jour';
    render();
  }

  /* ---------- Navigation ---------- */
  function naviguer(delta) {
    const c = state.curseur;
    if (state.vue === 'jour') c.setDate(c.getDate()+delta);
    else if (state.vue === 'semaine') c.setDate(c.getDate()+delta*7);
    else if (state.vue === 'mois') c.setMonth(c.getMonth()+delta);
    else c.setFullYear(c.getFullYear()+delta);
    render();
  }
  function aujourdhui() { state.curseur = startOfDay(new Date()); render(); }
  function changerVue(v) { state.vue = v; render(); }
  function allerA(year, month, day) { state.curseur = new Date(year, month, day||1); state.vue = 'mois'; const s = document.getElementById('cal16-vue'); if (s) s.value = 'mois'; render(); }
  function retourMois() { state.vue = 'mois'; const s = document.getElementById('cal16-vue'); if (s) s.value = 'mois'; render(); }

  /* ---------- Impression ---------- */
  function imprimer() {
    const { start, end } = getBounds();
    const events = getEventsForRange(start, end);
    const filtres = getFiltresActifs();
    const params = (()=>{ try { return loadSafe(LS.params, {}); } catch(e){ return {}; } })();
    const evsFiltres = events.filter(ev => filtres[ev.type]);
    const titre = (state.vue === 'mois' ? MOIS[start.getMonth()]+' '+start.getFullYear()
      : state.vue === 'semaine' ? 'Semaine du '+start.toLocaleDateString('fr-FR')+' au '+end.toLocaleDateString('fr-FR')
      : state.vue === 'annee' ? 'Année '+start.getFullYear()
      : start.toLocaleDateString('fr-FR'));
    const w = ouvrirPopupSecure('','cal16_print','width=1100,height=820');
    if (!w) { toast('Popup bloquée','error'); return; }
    let body = '';
    if (state.vue === 'mois') {
      const firstDay = new Date(start);
      const dowStart = (firstDay.getDay()+6)%7;
      const gridStart = new Date(firstDay); gridStart.setDate(gridStart.getDate()-dowStart);
      body = '<table class="mois"><tr>' + JOURS_COURT.map(j => '<th>'+j+'</th>').join('') + '</tr>';
      for (let w2 = 0; w2 < 6; w2++) {
        body += '<tr>';
        for (let i = 0; i < 7; i++) {
          const d = new Date(gridStart); d.setDate(d.getDate()+w2*7+i);
          const inMonth = d.getMonth() === start.getMonth();
          const ferie = filtres.feries ? feriePourDate(d) : null;
          const evs = evsFiltres.filter(ev => sameDay(ev.date, d));
          body += '<td class="'+(inMonth?'':'other')+(ferie?' fer':'')+'">';
          body += '<div class="dn">'+d.getDate()+'</div>';
          if (ferie) body += '<div class="fer-lbl">'+escHtml(ferie.nom)+'</div>';
          evs.slice(0,5).forEach(ev => { body += '<div class="ev" style="border-left:3px solid '+ev.color+'">'+escHtml(ev.label)+'</div>'; });
          if (evs.length > 5) body += '<div class="more">+'+(evs.length-5)+' autres</div>';
          body += '</td>';
        }
        body += '</tr>';
      }
      body += '</table>';
    } else {
      body = evsFiltres.sort((a,b) => a.date-b.date).map(ev =>
        '<div class="ev-print" style="border-left:4px solid '+ev.color+'"><span>'+ev.date.toLocaleDateString('fr-FR')+'</span> '+ev.icon+' '+escHtml(ev.label)+'</div>'
      ).join('') || '<p style="text-align:center;color:#888">Aucun événement</p>';
    }
    var entreprise = (typeof getEntrepriseExportParams === 'function') ? getEntrepriseExportParams() : (params || {});
    var dateExp = new Date().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    var entete = (typeof construireEnteteExport === 'function')
      ? construireEnteteExport(entreprise, '🗓️ Calendrier opérationnel', titre, dateExp)
      : '<div><h1>🗓️ Calendrier — '+escHtml(titre)+'</h1></div>';
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Calendrier — '+titre+'</title><style>'
      + 'body{font-family:"Segoe UI",Arial,sans-serif;padding:24px;color:#111827;max-width:1080px;margin:0 auto}'
      + 'table.mois{width:100%;border-collapse:collapse;font-size:.76rem} table.mois th{background:#f9fafb;color:#374151;padding:7px 4px;text-align:center;font-weight:600;border-bottom:2px solid #d1d5db;border-right:1px solid #e5e7eb} table.mois th:last-child{border-right:none}'
      + 'table.mois td{border:1px solid #e5e7eb;vertical-align:top;padding:5px;height:92px;width:14.28%} td.other{background:#fafafa;color:#d1d5db} td.fer{background:#fafaf9}'
      + '.dn{font-weight:600;margin-bottom:2px;color:#374151;font-size:.82rem}'
      + '.fer-lbl{font-size:.62rem;color:#b91c1c;background:#fee2e2;padding:1px 4px;border-radius:3px;margin-bottom:2px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}'
      + '.ev{background:#f9fafb;padding:2px 5px;margin:2px 0;border-radius:3px;font-size:.68rem;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .more{font-size:.66rem;color:#9ca3af;font-style:italic;margin-top:2px}'
      + '.ev-print{padding:7px 12px;margin:5px 0;background:#f9fafb;border-radius:4px;font-size:.86rem;color:#374151} .ev-print span{color:#6b7280;font-weight:600;margin-right:10px;min-width:85px;display:inline-block}'
      + 'button.print-btn{margin-bottom:14px;padding:7px 14px;background:#374151;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:.85rem} button.print-btn:hover{background:#1f2937} @media print{button.print-btn{display:none}}'
      + '</style></head><body>'
      + '<button class="print-btn" onclick="window.print()">📄 Imprimer / PDF</button>'
      + entete
      + body + '</body></html>');
    w.document.close();
    if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit('Impression calendrier', titre);
  }

  /* ---------- Orchestration ---------- */
  function render() {
    setLabels();
    setKPIMoisCourant();
    if (state.vue === 'mois') renderMois();
    else if (state.vue === 'semaine') renderSemaine();
    else if (state.vue === 'jour') renderJour();
    else renderAnnee();
  }

  window.cal16 = { render, naviguer, aujourdhui, changerVue, allerA, retourMois, imprimer };

  /* ---------- Hook navigation ---------- */
  function hookNav() {
    if (typeof window.naviguerVers !== 'function' || window.naviguerVers.__s16) return;
    const orig = window.naviguerVers;
    const w = function(page) {
      const r = orig.apply(this, arguments);
      if (page === 'calendrier') setTimeout(render, 80);
      return r;
    };
    w.__s16 = true;
    // Preserver les marqueurs précédents
    ['__s12_1','__s14','__s15'].forEach(m => { if (orig[m]) w[m] = true; });
    window.naviguerVers = w;
  }

  function init() {
    hookNav();
    // Si déjà sur la page calendrier à l'init
    setTimeout(() => {
      const page = document.getElementById('page-calendrier');
      if (page && page.classList.contains('active')) render();
    }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 100);
})();

/* ============================================================
   SPRINT 18 — Tri universel par clic sur les <th>
   - Remplace tous les dropdowns "Trier par ..."
   - Détecte auto nombre/€/date/texte
   - Persiste le tri en mémoire par table
   - Re-applique le tri après chaque re-render (MutationObserver)
   ============================================================ */
(function installS18SortableHeaders(){
  if (window.__s18SortInstalled) return;
  window.__s18SortInstalled = true;

  const state = new Map();
  const EXCLUDE_LABELS = new Set(['actions','action','', 'menu', '…']);

  function cellText(tr, idx) {
    const td = tr.children[idx];
    if (!td) return '';
    return (td.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function parseDateMaybe(s) {
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    return null;
  }

  function parseNumMaybe(s) {
    if (!s) return null;
    const cleaned = s.replace(/[€$£%\s\u202f\u00a0]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return parseFloat(cleaned);
  }

  function compareValues(a, b) {
    const da = parseDateMaybe(a), db = parseDateMaybe(b);
    if (da !== null && db !== null) return da - db;
    const na = parseNumMaybe(a), nb = parseNumMaybe(b);
    if (na !== null && nb !== null) return na - nb;
    return a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });
  }

  function sortTable(table, colIdx, dir) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const allRows = Array.from(tbody.children);
    const dataRows = allRows.filter(tr => tr.tagName === 'TR' && !tr.querySelector('.empty-row') && !tr.classList.contains('pagination-row'));
    if (dataRows.length < 2) return;
    const paginationRows = allRows.filter(tr => tr.tagName === 'TR' && tr.classList.contains('pagination-row'));
    const factor = (dir === 'desc') ? -1 : 1;
    dataRows.sort(function(a, b){
      return compareValues(cellText(a, colIdx), cellText(b, colIdx)) * factor;
    });
    tbody.__s18Sorting = true;
    dataRows.forEach(r => tbody.appendChild(r));
    paginationRows.forEach(r => tbody.appendChild(r));
    tbody.__s18Sorting = false;
  }

  function updateIndicators(table, colIdx, dir) {
    const ths = table.querySelectorAll('thead th');
    ths.forEach(t => t.classList.remove('sort-asc','sort-desc'));
    if (colIdx != null && dir) {
      const th = ths[colIdx];
      if (th) th.classList.add('sort-' + dir);
    }
  }

  function onThClick(table, ths, idx) {
    const cur = state.get(table) || {};
    let dir;
    if (cur.colIdx !== idx) dir = 'asc';
    else if (cur.dir === 'asc') dir = 'desc';
    else if (cur.dir === 'desc') dir = null;
    else dir = 'asc';

    if (dir == null) {
      state.delete(table);
      updateIndicators(table, null, null);
    } else {
      state.set(table, { colIdx: idx, dir: dir });
      updateIndicators(table, idx, dir);
      sortTable(table, idx, dir);
    }
  }

  function makeSortable(table) {
    if (table.__s18Sortable) return;
    const ths = table.querySelectorAll('thead th');
    if (!ths.length) return;
    // Skip les tables qui utilisent déjà le module SORT Sprint 8 (data-sort-key) :
    // le tri data-based + re-render se chevaucherait avec le tri DOM-based ici,
    // créant une cascade MutationObserver ↔ re-render qui freeze la page.
    if (table.querySelector('thead th[data-sort-key]')) {
      table.__s18Sortable = true;
      return;
    }
    table.__s18Sortable = true;
    ths.forEach(function(th, idx){
      const label = (th.textContent || '').trim().toLowerCase();
      if (EXCLUDE_LABELS.has(label)) return;
      th.classList.add('th-sortable');
      th.setAttribute('title', 'Trier par ' + (th.textContent || '').trim());
      th.addEventListener('click', function(){ onThClick(table, ths, idx); });
    });
  }

  const reapplyObs = new MutationObserver(function(muts){
    const touchedTables = new Set();
    muts.forEach(function(m){
      if (m.type !== 'childList') return;
      const target = m.target;
      if (!target || target.__s18Sorting) return;
      const table = (target.closest && target.closest('table.data-table')) || null;
      if (table) touchedTables.add(table);
    });
    touchedTables.forEach(function(table){
      const cur = state.get(table);
      if (cur) {
        updateIndicators(table, cur.colIdx, cur.dir);
        sortTable(table, cur.colIdx, cur.dir);
      }
    });
  });

  function scan() {
    document.querySelectorAll('table.data-table').forEach(function(table){
      makeSortable(table);
      const tbody = table.querySelector('tbody');
      if (tbody && !tbody.__s18Observed) {
        tbody.__s18Observed = true;
        reapplyObs.observe(tbody, { childList: true });
      }
    });
  }

  function init() {
    scan();
    // PERF: remplacement du setInterval(scan, 2500) par MutationObserver
    // event-driven — ne scanne que lorsqu'un node est ajouté au DOM
    const domWatcher = new MutationObserver(function(muts) {
      for (let i = 0; i < muts.length; i++) {
        const added = muts[i].addedNodes;
        if (!added || !added.length) continue;
        for (let j = 0; j < added.length; j++) {
          const node = added[j];
          if (node && node.nodeType === 1 && (node.matches && node.matches('table.data-table') || node.querySelector && node.querySelector('table.data-table'))) {
            scan();
            return;
          }
        }
      }
    });
    domWatcher.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 250);
})();

/* ============================================================
   SPRINT 19 — Centre d'alertes unifié (Alertes ⊕ Incidents)
   - Agrège : alertes_admin (système), incidents, dérivées calculées
   - Timeline chronologique unique avec filtres source/gravité/statut
   - Auto-clôture quand la cause disparaît
   - Refresh auto toutes les 60s
   ============================================================ */
(function installS19Centre(){
  if (window.__s19Installed) return;
  window.__s19Installed = true;

  const loadJSON = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const saveJSON = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const fmtEuro = (n) => (typeof window.euros === 'function') ? window.euros(n) : ((parseFloat(n)||0).toFixed(2) + ' €');
  const esc = window.escapeHtml;
  const daysBetween = (d1, d2) => Math.floor((d2 - d1) / 86400000);

  /* ---------- Collectors : retourne un tableau unifié d'alertes ---------- */
  function collectSysteme() {
    const arr = loadJSON('alertes_admin');
    return arr.map(a => ({
      id: 'sys_' + a.id,
      rawId: a.id,
      source: 'systeme',
      sourceLabel: 'Système',
      sourceIcon: '🤖',
      type: a.type || 'autre',
      title: a.message || a.type || 'Alerte',
      sub: a.salNom || a.client || '',
      gravite: graviteFromType(a.type),
      statut: a.traitee ? 'traite' : 'ouvert',
      creeLe: a.creeLe || new Date().toISOString(),
      meta: a.meta || {},
      actions: [
        ...(a.traitee ? [] : [{ icon:'✅', label:'Marquer traité', handler:"window.s19MarquerTraitee('" + a.id + "')" }]),
        ...(a.traitee ? [{ icon:'↺', label:'Rouvrir', handler:"window.s19Rouvrir('" + a.id + "')" }] : []),
        { icon:'🗑️', label:'Supprimer', handler:"window.s19Supprimer('" + a.id + "')", danger:true }
      ]
    }));
  }

  function graviteFromType(type) {
    if (!type) return 'moyen';
    if (/_expire$|expire$/.test(type)) return 'critique';
    if (/_proche$|proche$/.test(type)) return 'haute';
    if (/prix_manquant/.test(type)) return 'haute';
    return 'moyen';
  }

  function collectIncidents() {
    const arr = loadJSON('incidents');
    return arr.map(i => ({
      id: 'inc_' + i.id,
      rawId: i.id,
      source: 'incident',
      sourceLabel: 'Incident',
      sourceIcon: '🚨',
      type: 'incident_' + (i.gravite || 'moyen'),
      title: 'Incident' + (i.client ? ' · ' + i.client : ''),
      sub: (i.description || '').slice(0, 140) + ((i.description||'').length > 140 ? '…' : ''),
      gravite: i.gravite === 'grave' ? 'critique' : (i.gravite === 'faible' ? 'basse' : 'moyen'),
      statut: i.statut === 'traite' ? 'traite' : (i.statut === 'encours' ? 'encours' : 'ouvert'),
      creeLe: i.creeLe || i.date || new Date().toISOString(),
      meta: { incidentId: i.id, salNom: i.salNom, chaufNom: i.chaufNom, client: i.client },
      actions: [
        { icon:'🟡', label:'En cours', handler:"window.s19IncidentStatut('" + i.id + "','encours')" },
        { icon:'✅', label:'Traité', handler:"window.s19IncidentStatut('" + i.id + "','traite')" },
        { icon:'🗑️', label:'Supprimer', handler:"window.s19IncidentSupprimer('" + i.id + "')", danger:true }
      ]
    }));
  }

  function collectFacturesRetard() {
    const factures = loadJSON('factures').filter(f => f.statut !== 'annulée');
    const paiements = loadJSON('paiements').filter(p => p.sens === 'in');
    const clients = loadJSON('clients');
    const today = new Date();
    const out = [];
    factures.forEach(f => {
      if (!f.dateLivraison && !f.dateEmission) return;
      const client = clients.find(c => c.id === f.clientId) || null;
      const delai = (client && client.delaiPaiementJours != null) ? parseInt(client.delaiPaiementJours, 10) : 30;
      const dBase = new Date(f.dateLivraison || f.dateEmission);
      const dEch = new Date(dBase); dEch.setDate(dEch.getDate() + delai);
      const payeSum = paiements.filter(p => p.factureId === f.id).reduce((s,p) => s + (parseFloat(p.montant)||0), 0);
      const restant = (parseFloat(f.montantTTC)||0) - payeSum;
      if (restant <= 0.01) return;
      const jRetard = daysBetween(dEch, today);
      if (jRetard <= 0) return;
      let grav = 'moyen';
      if (jRetard > 60) grav = 'critique';
      else if (jRetard > 30) grav = 'haute';
      out.push({
        id: 'fac_' + f.id,
        rawId: f.id,
        source: 'facture',
        sourceLabel: 'Facture impayée',
        sourceIcon: '💶',
        type: 'facture_retard',
        title: 'Facture ' + (f.numero || f.id.slice(0,6)) + ' en retard de ' + jRetard + ' j',
        sub: (client ? client.nom : (f.client || 'Client inconnu')) + ' · reste ' + fmtEuro(restant),
        gravite: grav,
        statut: 'ouvert',
        creeLe: dEch.toISOString(),
        meta: { factureId: f.id, clientId: f.clientId, restant: restant, jRetard: jRetard },
        actions: [
          { icon:'🔗', label:'Voir facture', handler:"window.s19GoFacture('" + f.id + "')" },
          { icon:'💳', label:'Encaisser', handler:"window.s19EncaisserFacture('" + f.id + "')" }
        ]
      });
    });
    return out;
  }

  function collectFournisseursDu() {
    const fourns = loadJSON('fournisseurs');
    const charges = loadJSON('charges');
    const carburants = loadJSON('carburant');
    const entretiens = loadJSON('entretiens');
    const paiements = loadJSON('paiements').filter(p => p.sens === 'out');
    const today = new Date();
    const out = [];
    fourns.forEach(f => {
      const ch = charges.filter(x => x.fournisseurId === f.id);
      const ca = carburants.filter(x => x.fournisseurId === f.id);
      const en = entretiens.filter(x => x.fournisseurId === f.id);
      const pa = paiements.filter(p => p.fournisseurId === f.id);
      const depense = ch.reduce((s,x)=>s+(parseFloat(x.montant)||0),0)
                    + ca.reduce((s,x)=>s+(parseFloat(x.montant)||0),0)
                    + en.reduce((s,x)=>s+(parseFloat(x.cout)||0),0);
      const paye = pa.reduce((s,x)=>s+(parseFloat(x.montant)||0),0);
      const solde = depense - paye;
      if (solde <= 0.01) return;
      const delai = (f.delaiPaiementJours != null) ? parseInt(f.delaiPaiementJours, 10) : 30;
      const items = [...ch, ...ca, ...en].sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
      const oldest = items[0];
      if (!oldest || !oldest.date) return;
      const dEch = new Date(oldest.date); dEch.setDate(dEch.getDate() + delai);
      const jRetard = daysBetween(dEch, today);
      if (jRetard <= 0) return;
      let grav = 'moyen';
      if (jRetard > 60) grav = 'critique';
      else if (jRetard > 15) grav = 'haute';
      out.push({
        id: 'frs_' + f.id,
        rawId: f.id,
        source: 'fournisseur',
        sourceLabel: 'Fournisseur à payer',
        sourceIcon: '🏭',
        type: 'fournisseur_du',
        title: f.nom + ' · dû depuis ' + jRetard + ' j',
        sub: 'Solde à régler ' + fmtEuro(solde),
        gravite: grav,
        statut: 'ouvert',
        creeLe: dEch.toISOString(),
        meta: { fournisseurId: f.id, solde: solde },
        actions: [
          { icon:'🔗', label:'Voir fournisseur', handler:"window.s19GoFournisseur('" + f.id + "')" }
        ]
      });
    });
    return out;
  }

  function collectLivraisonsSansPrix() {
    const livs = loadJSON('livraisons');
    const today = new Date();
    return livs.filter(l => {
      const prix = parseFloat(l.prix) || 0;
      const prixHT = parseFloat(l.prixHT) || 0;
      return prix === 0 && prixHT === 0;
    }).map(l => ({
      id: 'liv_' + l.id,
      rawId: l.id,
      source: 'livraison',
      sourceLabel: 'Livraison sans prix',
      sourceIcon: '📦',
      type: 'livraison_sans_prix',
      title: 'Livraison sans prix · ' + (l.client || 'Client inconnu'),
      sub: (l.date || '') + (l.chaufNom ? ' · ' + l.chaufNom : ''),
      gravite: 'haute',
      statut: 'ouvert',
      creeLe: l.creeLe || l.date || today.toISOString(),
      meta: { livId: l.id },
      actions: [
        { icon:'🔗', label:'Ouvrir livraison', handler:"window.s19GoLivraison('" + l.id + "')" }
      ]
    }));
  }

  /* ---------- Agrégation + filtres ---------- */
  function collectAll() {
    let list = [];
    try { list = list.concat(collectSysteme()); } catch(e){ console.warn('[S19] systeme', e); }
    try { list = list.concat(collectIncidents()); } catch(e){ console.warn('[S19] incidents', e); }
    try { list = list.concat(collectFacturesRetard()); } catch(e){ console.warn('[S19] factures', e); }
    try { list = list.concat(collectFournisseursDu()); } catch(e){ console.warn('[S19] fournisseurs', e); }
    try { list = list.concat(collectLivraisonsSansPrix()); } catch(e){ console.warn('[S19] livraisons', e); }
    list.sort((a,b) => new Date(b.creeLe) - new Date(a.creeLe));
    return list;
  }

  const GRAV_ORDER = { critique: 4, haute: 3, moyen: 2, basse: 1 };
  const GRAV_LABEL = { critique: '🔴 Critique', haute: '🟠 Haute', moyen: '🟡 Moyenne', basse: '🟢 Basse' };
  const SOURCE_LABELS = {
    systeme: '🤖 Système auto',
    incident: '🚨 Incidents',
    facture: '💶 Factures clients',
    fournisseur: '🏭 Fournisseurs',
    livraison: '📦 Livraisons'
  };

  function applyFilters(list) {
    const q = (document.getElementById('s19-search')?.value || '').trim().toLowerCase();
    const fSrc = document.getElementById('s19-filter-source')?.value || '';
    const fGrav = document.getElementById('s19-filter-gravite')?.value || '';
    const fStat = document.getElementById('s19-filter-statut')?.value || 'ouvert';
    return list.filter(a => {
      if (fStat === 'ouvert' && a.statut === 'traite') return false;
      if (fStat === 'traite' && a.statut !== 'traite') return false;
      if (fSrc && a.source !== fSrc) return false;
      if (fGrav && a.gravite !== fGrav) return false;
      if (q) {
        const hay = (a.title + ' ' + a.sub + ' ' + a.sourceLabel).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ---------- Render ---------- */
  function renderCentre() {
    const host = document.getElementById('s19-centre-body');
    if (!host) return;
    const all = collectAll();
    const filtered = applyFilters(all);

    // KPIs (basés sur TOUT, pas filtré)
    const actifs = all.filter(a => a.statut !== 'traite');
    const kCrit = actifs.filter(a => a.gravite === 'critique').length;
    const kHaute = actifs.filter(a => a.gravite === 'haute').length;
    const kMoyen = actifs.filter(a => a.gravite === 'moyen').length;
    const kTr = all.filter(a => a.statut === 'traite').length;
    const kpi = document.getElementById('s19-kpis');
    if (kpi) {
      kpi.innerHTML =
        '<div class="s19-kpi s19-kpi-critique"><div class="s19-kpi-val">' + kCrit + '</div><div class="s19-kpi-lbl">🔴 Critiques</div></div>' +
        '<div class="s19-kpi s19-kpi-haute"><div class="s19-kpi-val">' + kHaute + '</div><div class="s19-kpi-lbl">🟠 Hautes</div></div>' +
        '<div class="s19-kpi s19-kpi-moyen"><div class="s19-kpi-val">' + kMoyen + '</div><div class="s19-kpi-lbl">🟡 Moyennes</div></div>' +
        '<div class="s19-kpi s19-kpi-traitee"><div class="s19-kpi-val">' + kTr + '</div><div class="s19-kpi-lbl">✅ Traitées</div></div>';
    }

    // Badge nav
    const badgeNav = document.getElementById('badge-alertes');
    if (badgeNav) {
      const n = actifs.length;
      badgeNav.textContent = n > 0 ? n : '';
      badgeNav.style.display = n > 0 ? '' : 'none';
    }
    const badgeIncNav = document.getElementById('badge-incidents-nav');
    if (badgeIncNav) { badgeIncNav.style.display = 'none'; }

    if (!filtered.length) {
      host.innerHTML = '<div class="s19-empty">' +
        (all.length ? '<div class="s19-empty-ic">🔎</div><div><strong>Aucune alerte ne correspond</strong></div><div style="color:var(--text-muted);font-size:.86rem">Modifiez vos filtres pour voir d\'autres résultats.</div>'
                    : '<div class="s19-empty-ic">🎉</div><div><strong>Tout est nickel</strong></div><div style="color:var(--text-muted);font-size:.86rem">Aucune alerte active — le système surveille en continu.</div>') +
        '</div>';
      return;
    }

    host.innerHTML = filtered.map(a => {
      const rel = relTime(a.creeLe);
      const gravClass = 's19-card-' + a.gravite;
      const statutBadge = a.statut === 'traite' ? '<span class="s19-badge s19-badge-traite">✅ Traité</span>'
                        : a.statut === 'encours' ? '<span class="s19-badge s19-badge-encours">🟡 En cours</span>'
                        : '';
      const actions = (a.actions || []).map(act => {
        const cls = act.danger ? 's19-act s19-act-danger' : 's19-act';
        return '<button class="' + cls + '" onclick="' + act.handler + '" title="' + esc(act.label) + '">' + act.icon + ' ' + esc(act.label) + '</button>';
      }).join('');
      return '<div class="s19-card ' + gravClass + (a.statut === 'traite' ? ' s19-card-traite' : '') + '">' +
        '<div class="s19-card-icn">' + a.sourceIcon + '</div>' +
        '<div class="s19-card-body">' +
          '<div class="s19-card-head">' +
            '<strong>' + esc(a.title) + '</strong>' +
            '<span class="s19-card-src">' + esc(a.sourceLabel) + '</span>' +
            '<span class="s19-card-grav s19-grav-' + a.gravite + '">' + (GRAV_LABEL[a.gravite] || a.gravite) + '</span>' +
            statutBadge +
          '</div>' +
          (a.sub ? '<div class="s19-card-sub">' + esc(a.sub) + '</div>' : '') +
          '<div class="s19-card-foot">' +
            '<span class="s19-card-time">' + rel + '</span>' +
            '<div class="s19-card-acts">' + actions + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function relTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return 'il y a ' + Math.floor(diff/60) + ' min';
    if (diff < 86400) return 'il y a ' + Math.floor(diff/3600) + ' h';
    if (diff < 2592000) return 'il y a ' + Math.floor(diff/86400) + ' j';
    return d.toLocaleDateString('fr-FR');
  }

  /* ---------- Auto-clôture ---------- */
  function autoCloture() {
    let changed = false;
    const alertes = loadJSON('alertes_admin');
    const paiements = loadJSON('paiements').filter(p => p.sens === 'in');
    const livs = loadJSON('livraisons');
    alertes.forEach(a => {
      if (a.traitee) return;
      if (a.type === 'prix_manquant' && a.meta?.livId) {
        const l = livs.find(x => x.id === a.meta.livId);
        if (l && ((parseFloat(l.prix)||0) > 0 || (parseFloat(l.prixHT)||0) > 0)) {
          a.traitee = true; a.traiteLe = new Date().toISOString(); a.autoCloture = true;
          changed = true;
        }
      }
    });
    if (changed) saveJSON('alertes_admin', alertes);
    return changed;
  }

  /* ---------- Actions ---------- */
  window.s19MarquerTraitee = function(rawId) {
    const arr = loadJSON('alertes_admin');
    const a = arr.find(x => x.id === rawId);
    if (a) { a.traitee = true; a.traiteLe = new Date().toISOString(); saveJSON('alertes_admin', arr); }
    renderCentre();
    if (typeof window.afficherToast === 'function') window.afficherToast('✅ Marquée traitée','success');
  };
  window.s19Rouvrir = function(rawId) {
    const arr = loadJSON('alertes_admin');
    const a = arr.find(x => x.id === rawId);
    if (a) { a.traitee = false; delete a.traiteLe; saveJSON('alertes_admin', arr); }
    renderCentre();
  };
  window.s19Supprimer = async function(rawId) {
    const ok = await confirmDialog('Supprimer définitivement cette alerte ?', { titre:'Supprimer', icone:'🗑️', btnLabel:'Supprimer' });
    if (!ok) return;
    saveJSON('alertes_admin', loadJSON('alertes_admin').filter(x => x.id !== rawId));
    renderCentre();
  };
  window.s19IncidentStatut = function(rawId, statut) {
    const arr = loadJSON('incidents');
    const i = arr.find(x => x.id === rawId);
    if (i) { i.statut = statut; saveJSON('incidents', arr); }
    renderCentre();
    if (typeof window.afficherToast === 'function') window.afficherToast('✅ Statut incident mis à jour','success');
  };
  window.s19IncidentSupprimer = async function(rawId) {
    const ok = await confirmDialog('Supprimer cet incident ?', { titre:'Supprimer', icone:'🚨', btnLabel:'Supprimer' });
    if (!ok) return;
    saveJSON('incidents', loadJSON('incidents').filter(x => x.id !== rawId));
    renderCentre();
  };
  window.s19GoFacture = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('facturation');
    setTimeout(() => { if (typeof window.ouvrirFacture === 'function') window.ouvrirFacture(id); }, 300);
  };
  window.s19EncaisserFacture = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('encaissements');
    setTimeout(() => { if (typeof window.ouvrirModalEncaissement === 'function') window.ouvrirModalEncaissement(id); }, 300);
  };
  window.s19GoFournisseur = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('fournisseurs');
    setTimeout(() => { if (typeof window.ouvrirHistoriqueFournisseur === 'function') window.ouvrirHistoriqueFournisseur(id); }, 300);
  };
  window.s19GoLivraison = function(id) {
    if (typeof window.naviguerVers === 'function') window.naviguerVers('livraisons');
    setTimeout(() => { if (typeof window.ouvrirEditLivraison === 'function') window.ouvrirEditLivraison(id); }, 300);
  };
  window.s19RefreshNow = function() {
    autoCloture();
    renderCentre();
    if (typeof window.afficherToast === 'function') window.afficherToast('🔄 Centre d\'alertes rafraîchi','success');
  };
  window.s19RenderCentre = renderCentre;

  /* ---------- Injection UI au-dessus de page-alertes ---------- */
  function injecterUI() {
    const page = document.getElementById('page-alertes');
    if (!page || document.getElementById('s19-centre')) return;

    // Masquer l'ancienne UI
    const oldActions = page.querySelector('.page-actions');
    const oldFilters = page.querySelector('.filters');
    const oldCats = document.getElementById('alertes-categories');
    const oldTraitees = document.getElementById('card-alertes-traitees');
    [oldActions, oldFilters, oldCats, oldTraitees].forEach(el => { if (el) el.style.display = 'none'; });

    const el = document.createElement('div');
    el.id = 's19-centre';
    el.innerHTML =
      '<div class="page-actions">' +
        '<h2>🔔 Centre d\'alertes</h2>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<button class="btn-secondary" onclick="window.s19RefreshNow()">🔄 Rafraîchir</button>' +
          '<button class="btn-primary" onclick="openModal(\'modal-incident\')">+ Signaler un incident</button>' +
        '</div>' +
      '</div>' +
      '<div class="s19-kpi-grid" id="s19-kpis"></div>' +
      '<div class="filters" style="margin-bottom:16px;margin-top:14px">' +
        '<div class="searchbar"><span class="searchbar-icon">🔎</span><input type="search" id="s19-search" placeholder="Rechercher dans les alertes…" oninput="window.s19RenderCentre && window.s19RenderCentre()" /></div>' +
        '<select id="s19-filter-source" onchange="window.s19RenderCentre && window.s19RenderCentre()">' +
          '<option value="">Toutes sources</option>' +
          Object.entries(SOURCE_LABELS).map(([k,v]) => '<option value="' + k + '">' + v + '</option>').join('') +
        '</select>' +
        '<select id="s19-filter-gravite" onchange="window.s19RenderCentre && window.s19RenderCentre()">' +
          '<option value="">Toutes gravités</option>' +
          '<option value="critique">🔴 Critique</option>' +
          '<option value="haute">🟠 Haute</option>' +
          '<option value="moyen">🟡 Moyenne</option>' +
          '<option value="basse">🟢 Basse</option>' +
        '</select>' +
        '<select id="s19-filter-statut" onchange="window.s19RenderCentre && window.s19RenderCentre()">' +
          '<option value="ouvert" selected>🔓 Actives</option>' +
          '<option value="traite">✅ Traitées</option>' +
          '<option value="toutes">📋 Toutes</option>' +
        '</select>' +
        '<button class="btn-secondary" onclick="document.getElementById(\'s19-search\').value=\'\';document.getElementById(\'s19-filter-source\').value=\'\';document.getElementById(\'s19-filter-gravite\').value=\'\';document.getElementById(\'s19-filter-statut\').value=\'ouvert\';window.s19RenderCentre && window.s19RenderCentre();">Réinitialiser</button>' +
      '</div>' +
      '<div id="s19-centre-body" class="s19-timeline"></div>';

    page.insertBefore(el, page.firstChild);
  }

  /* ---------- Hook navigation incidents → centre alertes avec filtre ---------- */
  function hookNavigation() {
    if (typeof window.naviguerVers !== 'function') { setTimeout(hookNavigation, 300); return; }
    if (window.naviguerVers.__s19) return;
    const orig = window.naviguerVers;
    const wrapped = function(page) {
      // BUG-FIX : 'incidents' avait son propre onglet mais Sprint 19 redirigeait
      // vers Alertes (avec filtre source=incident). Le user veut un onglet
      // Incidents visuellement indépendant. → on laisse passer normalement.
      const ret = orig.apply(this, arguments);
      if (page === 'alertes') setTimeout(renderCentre, 100);
      return ret;
    };
    wrapped.__s19 = true;
    window.naviguerVers = wrapped;
  }

  /* ---------- Init + auto-refresh 60s ---------- */
  function init() {
    injecterUI();
    hookNavigation();
    autoCloture();
    renderCentre();
    setInterval(() => { autoCloture(); renderCentre(); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 300);
})();

/* ==========================================================================
   Sprint 20 — RH 360° : Fiche unifiée salarié + 3 auto-alertes RH
   ========================================================================== */
(function installS20RH360(){
  if (window.__s20Installed) return;
  window.__s20Installed = true;

  const loadJSON = (k, def='[]') => { try { return JSON.parse(localStorage.getItem(k) || def); } catch(e){ return JSON.parse(def); } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const esc = window.escapeHtml;
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('fr-FR'); } catch(e){ return ''; } };
  const fmtDateTime = (d) => { try { return new Date(d).toLocaleString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); } catch(e){ return ''; } };

  /* ---------- 1. Auto-alertes RH (alimentent alertes_admin → S19) ----------
     Stratégie : on ne purge PAS — on additionne, et on auto-clôt (traitee=true)
     les alertes dont la cause a disparu. Ça laisse l'admin rouvrir sans être écrasé. */
  function genererAlertesRH() {
    const salaries = loadJSON('salaries');
    const livraisons = loadJSON('livraisons');
    const alertes = loadJSON('alertes_admin');

    const nowMs = Date.now();
    const J14 = 14 * 86400000;
    const J2  = 2 * 86400000;
    const nouvelles = [];
    const causeToujoursActive = new Set(); // ids d'alertes rh_ dont la cause existe encore

    salaries.forEach(s => {
      if (s.actif === false) return;

      // 1a. Inactivité : pas de livraison et aucun message depuis 14j
      const livs = livraisons.filter(l => l.chaufId === s.id);
      const derniereLiv = livs.length ? Math.max(...livs.map(l => new Date(l.date || l.creeLe || 0).getTime())) : 0;
      const msgs = loadJSON('messages_' + s.id);
      const derniereMsg = msgs.length ? Math.max(...msgs.map(m => new Date(m.creeLe || 0).getTime())) : 0;
      const lastActiv = Math.max(derniereLiv, derniereMsg);
      const createdMs = s.creeLe ? new Date(s.creeLe).getTime() : 0;
      // on ne signale pas les salariés créés depuis moins de 14j s'ils n'ont jamais eu d'activité
      if (lastActiv > 0 && lastActiv < nowMs - J14) {
        const key = 'rh_inactivite_' + s.id;
        causeToujoursActive.add(key);
        if (!alertes.find(a => a.id === key)) {
          const jours = Math.floor((nowMs - lastActiv) / 86400000);
          nouvelles.push({
            id: key, type: 'rh_inactivite',
            message: `💤 ${s.nom} — aucune activité depuis ${jours}j`,
            salNom: s.nom, salId: s.id,
            creeLe: new Date().toISOString(), traitee: false
          });
        }
      } else if (lastActiv === 0 && createdMs && createdMs < nowMs - J14) {
        const key = 'rh_inactivite_' + s.id;
        causeToujoursActive.add(key);
        if (!alertes.find(a => a.id === key)) {
          nouvelles.push({
            id: key, type: 'rh_inactivite',
            message: `💤 ${s.nom} — aucune activité enregistrée`,
            salNom: s.nom, salId: s.id,
            creeLe: new Date().toISOString(), traitee: false
          });
        }
      }

      // 1b. Message salarié non répondu > 48h
      if (msgs.length) {
        const ordered = [...msgs].sort((a,b) => new Date(a.creeLe||0) - new Date(b.creeLe||0));
        const dernierMsgSal = [...ordered].reverse().find(m => m.auteur === 'salarie');
        if (dernierMsgSal) {
          const tSal = new Date(dernierMsgSal.creeLe || 0).getTime();
          const repApres = ordered.find(m => m.auteur === 'admin' && new Date(m.creeLe || 0).getTime() > tSal);
          if (!repApres && (nowMs - tSal) > J2) {
            const key = 'rh_msg_non_repondu_' + s.id;
            causeToujoursActive.add(key);
            if (!alertes.find(a => a.id === key)) {
              const h = Math.floor((nowMs - tSal) / 3600000);
              nouvelles.push({
                id: key, type: 'rh_msg_non_repondu',
                message: `💬 Message de ${s.nom} non répondu depuis ${h}h`,
                salNom: s.nom, salId: s.id,
                creeLe: new Date().toISOString(), traitee: false
              });
            }
          }
        }
      }

      // 1c. Heures hebdo excessives (> 48h)
      try {
        if (typeof window.construireContexteHeures === 'function'
            && typeof window.calculerHeuresSalarieSemaine === 'function'
            && typeof window.getHeuresPeriodeRange === 'function') {
          // On force semaine courante pour cette détection
          const oldVue = window._heuresVue;
          const oldOff = window._heuresSemaineOffset;
          window._heuresVue = 'semaine'; window._heuresSemaineOffset = 0;
          try {
            const range = window.getHeuresPeriodeRange();
            const ctx = window.construireContexteHeures(range);
            const r = window.calculerHeuresSalarieSemaine(s.id, ctx);
            const h = r && typeof r.planifiees === 'number' ? r.planifiees : 0;
            if (h > 48) {
              const key = 'rh_heures_excess_' + s.id;
              causeToujoursActive.add(key);
              if (!alertes.find(a => a.id === key)) {
                nouvelles.push({
                  id: key, type: 'rh_heures_excess',
                  message: `⏱️ ${s.nom} — ${h.toFixed(1)}h planifiées cette semaine (> 48h)`,
                  salNom: s.nom, salId: s.id,
                  creeLe: new Date().toISOString(), traitee: false
                });
              }
            }
          } finally {
            window._heuresVue = oldVue; window._heuresSemaineOffset = oldOff;
          }
        }
      } catch(e) { /* silencieux */ }
    });

    // Auto-clôture : alertes rh_* existantes non-traitées dont la cause a disparu
    let modifBase = false;
    alertes.forEach(a => {
      if (a.type && typeof a.type === 'string' && a.type.startsWith('rh_') && !a.traitee) {
        if (!causeToujoursActive.has(a.id)) {
          a.traitee = true;
          a.autoCloseLe = new Date().toISOString();
          modifBase = true;
        }
      }
    });

    if (nouvelles.length || modifBase) {
      saveJSON('alertes_admin', [...alertes, ...nouvelles]);
    }
    if (typeof window.renderCentre === 'function') { try { window.renderCentre(); } catch(e){} }
  }

  /* ---------- 2. Drawer 360° ---------- */
  function ensureDrawer() {
    if (document.getElementById('s20-drawer')) return;
    const overlay = document.createElement('div');
    overlay.className = 's20-drawer-overlay';
    overlay.id = 's20-drawer-overlay';
    overlay.onclick = () => window.fermerFiche360();

    const drawer = document.createElement('aside');
    drawer.className = 's20-drawer';
    drawer.id = 's20-drawer';
    drawer.innerHTML = `
      <div class="s20-drawer-header">
        <h3 id="s20-drawer-title">Fiche 360° salarié</h3>
        <button class="s20-drawer-close" onclick="window.fermerFiche360()" aria-label="Fermer">✕</button>
      </div>
      <div class="s20-drawer-content" id="s20-drawer-content"></div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    // ESC pour fermer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) window.fermerFiche360();
    });
  }

  window.ouvrirFiche360Salarie = function(salId) {
    const sal = loadJSON('salaries').find(s => s.id === salId);
    if (!sal) { if (typeof window.afficherToast === 'function') window.afficherToast('Salarié introuvable', 'error'); return; }
    ensureDrawer();
    const content = document.getElementById('s20-drawer-content');
    const title = document.getElementById('s20-drawer-title');
    if (title) title.textContent = `👤 ${sal.nom}`;
    if (content) content.innerHTML = renderFicheContent(sal);
    document.getElementById('s20-drawer').classList.add('open');
    document.getElementById('s20-drawer-overlay').classList.add('open');
    if (window.resolveStorageImages && content) window.resolveStorageImages(content);
  };

  window.fermerFiche360 = function() {
    const d = document.getElementById('s20-drawer');
    const o = document.getElementById('s20-drawer-overlay');
    if (d) d.classList.remove('open');
    if (o) o.classList.remove('open');
  };

  window.s20SwitchTab = function(tab) {
    document.querySelectorAll('.s20-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.s20-tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 's20-tab-' + tab));
  };

  function renderFicheContent(sal) {
    const livraisons = loadJSON('livraisons').filter(l => l.chaufId === sal.id);
    const vehicules = loadJSON('vehicules');
    const veh = vehicules.find(v => v.salId === sal.id);
    const messages = loadJSON('messages_' + sal.id);
    const incidents = loadJSON('incidents').filter(i => i.salId === sal.id || i.chaufId === sal.id);
    const alertes = loadJSON('alertes_admin').filter(a => a.salId === sal.id && !a.traitee);

    // KPIs
    const now = Date.now();
    const J30 = 30 * 86400000;
    const liv30 = livraisons.filter(l => now - new Date(l.date || 0).getTime() < J30);
    const ca30 = liv30.reduce((s, l) => s + (parseFloat(l.prixHT || l.prix || 0) || 0), 0);
    const msgNonLus = messages.filter(m => m.auteur === 'salarie' && !m.lu).length;

    // Heures semaine
    let heuresSem = 0;
    try {
      if (typeof window.construireContexteHeures === 'function' && typeof window.calculerHeuresSalarieSemaine === 'function' && typeof window.getHeuresPeriodeRange === 'function') {
        const range = window.getHeuresPeriodeRange();
        const ctx = window.construireContexteHeures(range);
        const r = window.calculerHeuresSalarieSemaine(sal.id, ctx);
        heuresSem = r && typeof r.planifiees === 'number' ? r.planifiees : 0;
      }
    } catch(e) {}

    const initial = (sal.nom || '?').trim().charAt(0).toUpperCase();
    const badgeActif = sal.actif !== false
      ? '<span class="badge badge-dispo">✅ Actif</span>'
      : '<span class="badge badge-inactif">⏸️ Inactif</span>';

    return `
      <div class="s20-fiche-id">
        <div class="s20-fiche-avatar">${esc(initial)}</div>
        <div>
          <div class="s20-fiche-nom">${esc(sal.nom)}</div>
          <div class="s20-fiche-meta">${esc(sal.poste || '—')} · ${esc(sal.numero || '')}${sal.tel ? ' · ' + esc(sal.tel) : ''}</div>
          ${veh ? `<div class="s20-fiche-veh">🚐 <button type="button" class="s21-btn-360" onclick="window.ouvrirFiche360Vehicule('${esc(veh.id)}')">${esc(veh.immat)}${veh.modele ? ' — ' + esc(veh.modele) : ''}</button></div>` : '<div class="s20-fiche-veh muted">Sans véhicule affecté</div>'}
        </div>
        <div class="s20-fiche-badges">
          ${badgeActif}
          ${alertes.length ? `<span class="s20-badge-alert">⚠️ ${alertes.length} alerte${alertes.length > 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>

      <div class="s20-kpi-row">
        <div class="s20-kpi"><div class="s20-kpi-val">${heuresSem.toFixed(1)} h</div><div class="s20-kpi-lbl">Semaine</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${liv30.length}</div><div class="s20-kpi-lbl">Livr. 30j</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${Math.round(ca30)} €</div><div class="s20-kpi-lbl">CA 30j</div></div>
        <div class="s20-kpi ${msgNonLus ? 's20-kpi-alert' : ''}"><div class="s20-kpi-val">${msgNonLus}</div><div class="s20-kpi-lbl">Msg non lus</div></div>
      </div>

      <div class="s20-tabs">
        <button class="s20-tab active" data-tab="activite" onclick="window.s20SwitchTab('activite')">📅 Activité</button>
        <button class="s20-tab" data-tab="livraisons" onclick="window.s20SwitchTab('livraisons')">📦 Livraisons (${livraisons.length})</button>
        <button class="s20-tab" data-tab="messages" onclick="window.s20SwitchTab('messages')">💬 Messages (${messages.length})</button>
        <button class="s20-tab" data-tab="conformite" onclick="window.s20SwitchTab('conformite')">🪪 Conformité</button>
        <button class="s20-tab" data-tab="incidents" onclick="window.s20SwitchTab('incidents')">🚨 Incidents (${incidents.length})</button>
      </div>

      <div class="s20-tab-content" id="s20-tab-activite">${renderActivite(livraisons, messages, incidents, alertes)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-livraisons">${renderLivraisons(livraisons)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-messages">${renderMessages(messages)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-conformite">${renderConformite(sal)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-incidents">${renderIncidentsList(incidents)}</div>

      <div class="s20-fiche-actions">
        <button class="btn-secondary" onclick="window.s20GoToHeures('${esc(sal.nom)}')">⏱️ Heures</button>
        <button class="btn-primary" onclick="window.s20GoToEdit('${sal.id}')">✏️ Modifier</button>
      </div>`;
  }

  function renderActivite(livraisons, messages, incidents, alertes) {
    const items = [];
    livraisons.forEach(l => {
      const t = new Date(l.date || l.creeLe || 0).getTime();
      if (!t) return;
      items.push({ t, icon:'📦', label: `Livraison · ${esc(l.client || '—')} · ${(parseFloat(l.prixHT || l.prix) || 0).toFixed(0)} €` + (l.statut ? ' <span class="s20-timeline-date" style="margin-left:6px">['+esc(l.statut)+']</span>' : '') });
    });
    messages.slice(-15).forEach(m => {
      const t = new Date(m.creeLe || 0).getTime();
      if (!t) return;
      const ic = m.auteur === 'salarie' ? '📩' : '📤';
      const extrait = String(m.texte || (m.photo ? '📷 Photo' : '') || '').slice(0, 100);
      items.push({ t, icon: ic, label: (m.auteur === 'salarie' ? '<em>Salarié : </em>' : '<em>Admin : </em>') + esc(extrait) });
    });
    incidents.forEach(i => {
      const t = new Date(i.creeLe || i.date || 0).getTime();
      if (!t) return;
      items.push({ t, icon:'🚨', label: `Incident (${esc(i.gravite || 'moyen')}) · ${esc(String(i.description || '').slice(0, 80))}` });
    });
    alertes.forEach(a => {
      const t = new Date(a.creeLe || 0).getTime();
      if (!t) return;
      items.push({ t, icon:'⚠️', label: esc(a.message || a.type || '') });
    });

    items.sort((a,b) => b.t - a.t);
    const recent = items.slice(0, 30);
    if (!recent.length) return '<div class="s20-empty">Aucune activité récente</div>';

    return `<div class="s20-timeline">${recent.map(it => `
      <div class="s20-timeline-item">
        <span class="s20-timeline-ic">${it.icon}</span>
        <div class="s20-timeline-body">
          <div class="s20-timeline-label">${it.label}</div>
          <div class="s20-timeline-date">${fmtDateTime(it.t)}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  function renderLivraisons(livraisons) {
    if (!livraisons.length) return '<div class="s20-empty">Aucune livraison</div>';
    const recent = [...livraisons].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20);
    return `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Client</th><th>Statut</th><th style="text-align:right">HT</th></tr></thead>
      <tbody>${recent.map(l => `<tr>
        <td>${esc(l.date || '—')}</td>
        <td>${esc(l.client || '—')}</td>
        <td>${esc(l.statut || '—')}</td>
        <td style="text-align:right">${(parseFloat(l.prixHT || l.prix) || 0).toFixed(2)} €</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderMessages(messages) {
    if (!messages.length) return '<div class="s20-empty">Aucun message</div>';
    const recent = [...messages].slice(-30);
    return `<div class="s20-msg-list">${recent.map(m => {
      const who = m.auteur === 'salarie' ? 'in' : 'out';
      let txt;
      if (m.photoPath) {
        txt = '<img data-photo-path="' + esc(m.photoPath) + '" data-photo-bucket="' + esc(m.photoBucket || 'messages-photos') + '" alt="📷 chargement..." style="max-width:180px;border-radius:6px;display:block;background:rgba(0,0,0,0.1);min-height:100px" />';
      } else if (m.photo) {
        txt = '<img src="' + esc(m.photo) + '" style="max-width:180px;border-radius:6px;display:block" />';
      } else {
        txt = esc(m.texte || '');
      }
      return `<div class="s20-msg s20-msg-${who}">
        <div class="s20-msg-txt">${txt}</div>
        <div class="s20-msg-date">${fmtDateTime(m.creeLe || '')}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderConformite(sal) {
    const now = Date.now();
    const row = (dateStr, label) => {
      if (!dateStr) return `<div class="s20-conf-row"><span>${label}</span><span class="muted">Non renseigné</span></div>`;
      const exp = new Date(dateStr).getTime();
      const jours = Math.floor((exp - now) / 86400000);
      let cl = 'ok', emoji = '✅';
      if (jours < 0) { cl = 'ko'; emoji = '❌'; }
      else if (jours < 30) { cl = 'warn'; emoji = '⚠️'; }
      const etat = jours >= 0 ? `J+${jours}` : `expiré depuis ${Math.abs(jours)}j`;
      return `<div class="s20-conf-row s20-conf-${cl}"><span>${label}</span><span>${emoji} ${esc(fmtDate(dateStr))} · ${etat}</span></div>`;
    };
    return `<div class="s20-conf-list">
      ${row(sal.datePermis, '🪪 Permis de conduire')}
      ${row(sal.dateAssurance, '🛡️ Assurance')}
      ${sal.visiteMedicale ? row(sal.visiteMedicale, '⚕️ Visite médicale') : ''}
    </div>`;
  }

  function renderIncidentsList(incidents) {
    if (!incidents.length) return '<div class="s20-empty">Aucun incident</div>';
    return [...incidents].sort((a,b) => new Date(b.creeLe || b.date || 0) - new Date(a.creeLe || a.date || 0)).slice(0, 10).map(i => `
      <div class="s20-incident">
        <div class="s20-incident-head">
          <strong>${esc(i.client || 'Incident')}</strong>
          <span class="s20-incident-grav s20-grav-${esc(i.gravite || 'moyen')}">${esc(i.gravite || 'moyen')}</span>
        </div>
        <div class="s20-incident-desc">${esc(i.description || '')}</div>
        <div class="s20-incident-date">${esc(i.date || fmtDate(i.creeLe) || '')}</div>
      </div>`).join('');
  }

  /* ---------- 3. Navigation raccourcis depuis drawer ---------- */
  window.s20GoToHeures = function(nom) {
    window.fermerFiche360();
    if (typeof window.naviguerVers === 'function') window.naviguerVers('heures');
    setTimeout(() => {
      const i = document.getElementById('filtre-heures-salarie');
      if (i) {
        i.value = nom;
        if (typeof window.afficherCompteurHeures === 'function') window.afficherCompteurHeures();
      }
    }, 200);
  };

  window.s20GoToEdit = function(salId) {
    window.fermerFiche360();
    if (typeof window.ouvrirEditSalarie === 'function') window.ouvrirEditSalarie(salId);
  };

  /* ---------- 4. Injection bouton 👁️ dans tableaux RH ---------- */
  function injecterBoutons360() {
    // Table salariés — hijack du nom : clic ouvre la fiche 360° au lieu des livraisons
    const tb = document.getElementById('tb-salaries');
    if (tb) {
      tb.querySelectorAll('tr').forEach(tr => {
        if (tr.__s20Hooked) return;
        const btnLink = tr.querySelector('td:first-child button.table-link-button[onclick*="ouvrirLivraisonsSalarie"]');
        if (!btnLink) return;
        const m = btnLink.getAttribute('onclick').match(/ouvrirLivraisonsSalarie\('([^']+)'\)/);
        if (!m) return;
        const salId = m[1];
        // Redirige le clic du nom vers la fiche 360°
        btnLink.setAttribute('onclick', `window.ouvrirFiche360Salarie('${salId}')`);
        btnLink.setAttribute('title', 'Ouvrir la fiche 360°');
        // Nettoyer tout ancien bouton 360° redondant ajouté par versions précédentes
        const oldBtn = tr.querySelector('.s20-btn-360');
        if (oldBtn) oldBtn.remove();
        tr.__s20Hooked = true;
      });
    }

    // Table heures — rendre le nom cliquable
    const tbh = document.getElementById('tb-heures');
    if (tbh) {
      const salaries = loadJSON('salaries');
      tbh.querySelectorAll('tr').forEach(tr => {
        if (tr.__s20Hooked) return;
        const strong = tr.querySelector('td:first-child strong');
        if (!strong) return;
        const nom = strong.textContent.trim();
        const sal = salaries.find(s => s.nom === nom);
        if (!sal) return;
        strong.style.cursor = 'pointer';
        strong.style.color = 'var(--accent)';
        strong.style.textDecoration = 'underline';
        strong.style.textDecorationStyle = 'dotted';
        strong.title = 'Ouvrir la fiche 360°';
        strong.onclick = () => window.ouvrirFiche360Salarie(sal.id);
        tr.__s20Hooked = true;
      });
    }

    // Table chauffeurs
    const tbc = document.getElementById('tb-chauffeurs');
    if (tbc) {
      tbc.querySelectorAll('tr').forEach(tr => {
        if (tr.__s20Hooked) return;
        const firstTd = tr.querySelector('td:first-child');
        if (!firstTd) return;
        // On ne cible que les lignes qui ont un salarié lié (via data-sal-id si présent)
        const salId = tr.getAttribute('data-sal-id') || tr.dataset.salId;
        if (!salId) { tr.__s20Hooked = true; return; }
        if (firstTd.querySelector('.s20-btn-360')) { tr.__s20Hooked = true; return; }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 's20-btn-360';
        b.textContent = '👁️';
        b.title = 'Fiche 360°';
        b.onclick = (ev) => { ev.stopPropagation(); window.ouvrirFiche360Salarie(salId); };
        firstTd.appendChild(b);
        tr.__s20Hooked = true;
      });
    }
  }

  function setupObservers() {
    ['tb-salaries', 'tb-heures', 'tb-chauffeurs'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.__s20Obs) return;
      const obs = new MutationObserver(() => setTimeout(injecterBoutons360, 40));
      obs.observe(el, { childList: true, subtree: true });
      el.__s20Obs = obs;
    });
  }

  /* ---------- Init ---------- */
  function init() {
    try { genererAlertesRH(); } catch(e) { console.warn('S20 alertes RH:', e); }
    setTimeout(() => {
      injecterBoutons360();
      setupObservers();
    }, 600);
    // Re-génération périodique (5 min)
    setInterval(() => { try { genererAlertesRH(); } catch(e){} }, 5 * 60 * 1000);
    // PERF: setInterval 3s retiré — setupObservers() via MutationObserver
    // couvre déjà l'injection des boutons sur insertions dynamiques (pagination incluse)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 900);
})();

/* ==========================================================================
   Sprint 21 — Parc 360° : Fiche unifiée véhicule + auto-alertes Parc
   Réutilise l'infrastructure drawer #s20-drawer de S20 (ouverture exclusive)
   ========================================================================== */
(function installS21Parc360(){
  if (window.__s21Installed) return;
  window.__s21Installed = true;

  const loadJSON = (k, def='[]') => { try { return JSON.parse(localStorage.getItem(k) || def); } catch(e){ return JSON.parse(def); } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const esc = window.escapeHtml;
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('fr-FR'); } catch(e){ return ''; } };
  const fmtDateTime = (d) => { try { return new Date(d).toLocaleString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); } catch(e){ return ''; } };
  const euro = (n) => (typeof window.euros === 'function') ? window.euros(n) : ((parseFloat(n)||0).toFixed(2) + ' €');

  /* ---------- 1. Auto-alertes Parc (alimentent alertes_admin → S19) ---------- */
  function genererAlertesParc() {
    const vehicules = loadJSON('vehicules');
    const carburants = loadJSON('carburant');
    const alertes = loadJSON('alertes_admin');
    const nowMs = Date.now();
    const causeActive = new Set();
    const nouvelles = [];

    vehicules.forEach(v => {
      // 1. Entretien dû (via helper existant)
      try {
        const pilotage = typeof window.getPilotageEntretienVehicule === 'function'
          ? window.getPilotageEntretienVehicule(v) : null;
        if (pilotage && pilotage.estEnRetard) {
          const key = 'parc_entretien_expire_' + v.id;
          causeActive.add(key);
          if (!alertes.find(a => a.id === key)) {
            const motif = pilotage.prochainKm && pilotage.kmActuel >= pilotage.prochainKm
              ? `km dépassés (${pilotage.kmActuel} / ${pilotage.prochainKm})`
              : `échéance dépassée (${pilotage.dateEcheance || '—'})`;
            nouvelles.push({
              id: key, type: 'parc_entretien_expire',
              message: `🔧 ${v.immat} — entretien en retard : ${motif}`,
              vehId: v.id, vehImmat: v.immat,
              creeLe: new Date().toISOString(), traitee: false
            });
          }
        } else if (pilotage && pilotage.estProche) {
          const key = 'parc_entretien_proche_' + v.id;
          causeActive.add(key);
          if (!alertes.find(a => a.id === key)) {
            const detail = pilotage.kmRestants !== null && pilotage.kmRestants > 0
              ? ` (reste ${Math.round(pilotage.kmRestants)} km)`
              : pilotage.dateEcheance ? ` (d’ici le ${fmtDate(pilotage.dateEcheance)})` : '';
            nouvelles.push({
              id: key, type: 'parc_entretien_proche',
              message: `🔧 ${v.immat} — entretien bientôt dû${detail}`,
              vehId: v.id, vehImmat: v.immat,
              creeLe: new Date().toISOString(), traitee: false
            });
          }
        }
      } catch(e) {}

      // 2. Conso anormale (conso réelle 60j vs théorique)
      if (v.conso && parseFloat(v.conso) > 0) {
        const pleinsVeh = carburants.filter(c => c.vehId === v.id);
        const J60 = 60 * 86400000;
        const recents = pleinsVeh.filter(c => c.date && (nowMs - new Date(c.date).getTime()) < J60);
        if (recents.length >= 3) {
          const kmVals = recents.map(c => parseFloat(c.kmCompteur)).filter(k => !isNaN(k) && k > 0);
          if (kmVals.length >= 2) {
            const deltaKm = Math.max(...kmVals) - Math.min(...kmVals);
            if (deltaKm > 100) {
              const totalL = recents.reduce((s, c) => s + (parseFloat(c.litres) || 0), 0);
              const consoReelle = (totalL / deltaKm) * 100;
              const seuil = parseFloat(v.conso) * 1.3;
              if (consoReelle > seuil) {
                const key = 'parc_conso_excess_' + v.id;
                causeActive.add(key);
                if (!alertes.find(a => a.id === key)) {
                  nouvelles.push({
                    id: key, type: 'parc_conso_excess',
                    message: `⛽ ${v.immat} — conso réelle ${consoReelle.toFixed(1)} L/100 (théo ${v.conso})`,
                    vehId: v.id, vehImmat: v.immat,
                    creeLe: new Date().toISOString(), traitee: false
                  });
                }
              }
            }
          }
        }
      }
    });

    // Auto-clôture : parc_* non-traitées dont cause a disparu
    let modif = false;
    alertes.forEach(a => {
      if (a.type && typeof a.type === 'string' && a.type.startsWith('parc_') && !a.traitee) {
        if (!causeActive.has(a.id)) {
          a.traitee = true;
          a.autoCloseLe = new Date().toISOString();
          modif = true;
        }
      }
    });

    if (nouvelles.length || modif) saveJSON('alertes_admin', [...alertes, ...nouvelles]);
    if (typeof window.renderCentre === 'function') { try { window.renderCentre(); } catch(e){} }
  }

  /* ---------- 2. Fiche 360° Véhicule (réutilise drawer S20) ---------- */
  function ensureDrawer() {
    // Le drawer est créé par S20. Si S20 pas encore initialisé, on le crée ici.
    if (document.getElementById('s20-drawer')) return;
    const overlay = document.createElement('div');
    overlay.className = 's20-drawer-overlay';
    overlay.id = 's20-drawer-overlay';
    overlay.onclick = () => window.fermerFiche360 && window.fermerFiche360();
    const drawer = document.createElement('aside');
    drawer.className = 's20-drawer';
    drawer.id = 's20-drawer';
    drawer.innerHTML = `
      <div class="s20-drawer-header">
        <h3 id="s20-drawer-title">Fiche</h3>
        <button class="s20-drawer-close" onclick="window.fermerFiche360()" aria-label="Fermer">✕</button>
      </div>
      <div class="s20-drawer-content" id="s20-drawer-content"></div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) window.fermerFiche360 && window.fermerFiche360();
    });
    // Fallback fermerFiche360 si S20 absent
    if (typeof window.fermerFiche360 !== 'function') {
      window.fermerFiche360 = function() {
        const d = document.getElementById('s20-drawer');
        const o = document.getElementById('s20-drawer-overlay');
        if (d) d.classList.remove('open');
        if (o) o.classList.remove('open');
      };
    }
  }

  window.ouvrirFiche360Vehicule = function(vehId) {
    const veh = loadJSON('vehicules').find(v => v.id === vehId);
    if (!veh) { if (typeof window.afficherToast === 'function') window.afficherToast('Véhicule introuvable', 'error'); return; }
    ensureDrawer();
    const content = document.getElementById('s20-drawer-content');
    const title = document.getElementById('s20-drawer-title');
    if (title) title.textContent = `🚐 ${veh.immat}`;
    if (content) content.innerHTML = renderFicheVehicule(veh);
    document.getElementById('s20-drawer').classList.add('open');
    document.getElementById('s20-drawer-overlay').classList.add('open');
  };

  function renderFicheVehicule(veh) {
    const salaries = loadJSON('salaries');
    const sal = veh.salId ? salaries.find(s => s.id === veh.salId) : null;
    const carburants = loadJSON('carburant').filter(c => c.vehId === veh.id);
    const entretiens = loadJSON('entretiens').filter(e => e.vehId === veh.id);
    const inspections = loadJSON('inspections').filter(i => i.vehId === veh.id);
    const livraisons = loadJSON('livraisons').filter(l => l.vehId === veh.id);
    const alertes = loadJSON('alertes_admin').filter(a => a.vehId === veh.id && !a.traitee);

    // KPIs
    const now = Date.now();
    const J30 = 30 * 86400000;
    const carb30 = carburants.filter(c => c.date && (now - new Date(c.date).getTime()) < J30);
    const totalCarb30 = carb30.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const liv30 = livraisons.filter(l => l.date && (now - new Date(l.date).getTime()) < J30);

    let pilotage = null, kmActuel = parseFloat(veh.km) || 0;
    try {
      if (typeof window.getPilotageEntretienVehicule === 'function') {
        pilotage = window.getPilotageEntretienVehicule(veh);
        if (pilotage) kmActuel = pilotage.kmActuel || kmActuel;
      }
    } catch(e) {}

    // Conso réelle
    let consoReelle = null;
    const kmVals = carb30.map(c => parseFloat(c.kmCompteur)).filter(k => !isNaN(k) && k > 0);
    if (kmVals.length >= 2) {
      const delta = Math.max(...kmVals) - Math.min(...kmVals);
      const totalL = carb30.reduce((s, c) => s + (parseFloat(c.litres) || 0), 0);
      if (delta > 100) consoReelle = (totalL / delta) * 100;
    }

    // CT statut
    let ctStatus = 'ok', ctLabel = 'OK';
    if (veh.dateCT) {
      const jours = Math.floor((new Date(veh.dateCT).getTime() - now) / 86400000);
      if (jours < 0) { ctStatus = 'ko'; ctLabel = `Expiré ${Math.abs(jours)}j`; }
      else if (jours <= 30) { ctStatus = 'warn'; ctLabel = `J-${jours}`; }
      else ctLabel = `J+${jours}`;
    } else { ctStatus = 'warn'; ctLabel = 'Non renseigné'; }

    const initial = (veh.modele || veh.immat || '?').trim().charAt(0).toUpperCase();

    return `
      <div class="s20-fiche-id">
        <div class="s20-fiche-avatar s21-fiche-avatar">${esc(initial)}</div>
        <div>
          <div class="s20-fiche-nom">${esc(veh.immat)} <span style="font-weight:400;color:var(--text-muted);font-size:.88rem">· ${esc(veh.modele || '')}</span></div>
          <div class="s20-fiche-meta">${Math.round(kmActuel).toLocaleString('fr-FR')} km · ${esc(veh.modeAcquisition || 'achat')}${veh.dateAcquisition ? ' depuis ' + fmtDate(veh.dateAcquisition) : ''}</div>
          ${sal
            ? `<div class="s20-fiche-veh">👤 Affecté à <button type="button" class="s20-btn-360" onclick="window.ouvrirFiche360Salarie('${esc(sal.id)}')">${esc(sal.nom)}</button></div>`
            : '<div class="s20-fiche-veh muted">Aucun salarié affecté</div>'}
        </div>
        <div class="s20-fiche-badges">
          ${alertes.length ? `<span class="s20-badge-alert">⚠️ ${alertes.length} alerte${alertes.length > 1 ? 's' : ''}</span>` : '<span class="badge badge-dispo">✅ OK</span>'}
        </div>
      </div>

      <div class="s20-kpi-row">
        <div class="s20-kpi ${ctStatus === 'ko' ? 's20-kpi-alert' : ''}"><div class="s20-kpi-val" style="font-size:.95rem">${esc(ctLabel)}</div><div class="s20-kpi-lbl">Contrôle tech.</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${liv30.length}</div><div class="s20-kpi-lbl">Livr. 30j</div></div>
        <div class="s20-kpi"><div class="s20-kpi-val">${Math.round(totalCarb30)} €</div><div class="s20-kpi-lbl">Carb. 30j</div></div>
        <div class="s20-kpi ${consoReelle && veh.conso && consoReelle > parseFloat(veh.conso) * 1.3 ? 's20-kpi-alert' : ''}">
          <div class="s20-kpi-val">${consoReelle !== null ? consoReelle.toFixed(1) + ' L' : '—'}</div>
          <div class="s20-kpi-lbl">Conso 30j</div>
        </div>
      </div>

      <div class="s20-tabs">
        <button class="s20-tab active" data-tab="specs" onclick="window.s20SwitchTab && window.s20SwitchTab('specs')">📋 Specs</button>
        <button class="s20-tab" data-tab="entretiens" onclick="window.s20SwitchTab && window.s20SwitchTab('entretiens')">🔧 Entretiens (${entretiens.length})</button>
        <button class="s20-tab" data-tab="carburant" onclick="window.s20SwitchTab && window.s20SwitchTab('carburant')">⛽ Carburant (${carburants.length})</button>
        <button class="s20-tab" data-tab="inspections" onclick="window.s20SwitchTab && window.s20SwitchTab('inspections')">🚗 Inspections (${inspections.length})</button>
        <button class="s20-tab" data-tab="livraisons" onclick="window.s20SwitchTab && window.s20SwitchTab('livraisons')">📦 Livraisons (${livraisons.length})</button>
      </div>

      <div class="s20-tab-content" id="s20-tab-specs">${renderSpecs(veh, pilotage)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-entretiens">${renderEntretiens(entretiens, pilotage)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-carburant">${renderCarburant(carburants, veh, consoReelle)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-inspections">${renderInspections(inspections)}</div>
      <div class="s20-tab-content hidden" id="s20-tab-livraisons">${renderLivraisonsVeh(livraisons)}</div>

      <div class="s20-fiche-actions">
        <button class="btn-secondary" onclick="window.s21GoToCarburant('${esc(veh.id)}')">⛽ Carburant</button>
        <button class="btn-secondary" onclick="window.s21GoToEntretiens('${esc(veh.id)}')">🔧 Entretiens</button>
        <button class="btn-primary" onclick="window.s21GoToEdit('${esc(veh.id)}')">✏️ Modifier</button>
      </div>`;
  }

  function renderSpecs(veh, pilotage) {
    const specs = [
      ['Immatriculation', esc(veh.immat || '—')],
      ['Modèle', esc(veh.modele || '—')],
      ['Kilométrage actuel', (parseFloat((pilotage && pilotage.kmActuel) || veh.km) || 0).toLocaleString('fr-FR') + ' km'],
      ['Km initial', (parseFloat(veh.kmInitial) || 0).toLocaleString('fr-FR') + ' km'],
      ['Conso théorique', veh.conso ? parseFloat(veh.conso).toFixed(1) + ' L/100' : 'Non définie'],
      ['Contrôle technique', veh.dateCT ? fmtDate(veh.dateCT) : 'Non renseigné'],
      ['Mode d’acquisition', esc(veh.modeAcquisition || 'achat')],
      ['Date d’acquisition', veh.dateAcquisition ? fmtDate(veh.dateAcquisition) : '—'],
      ['Intervalle entretien', veh.entretienIntervalKm ? veh.entretienIntervalKm + ' km' : '—'],
      ['TVA carburant déductible', (veh.tvaCarbDeductible || 80) + ' %']
    ];
    const html = specs.map(([l, v]) => `<div class="s21-spec"><div class="s21-spec-lbl">${l}</div><div class="s21-spec-val">${v}</div></div>`).join('');

    let pilotageHtml = '';
    if (pilotage) {
      if (pilotage.estEnRetard) pilotageHtml = `<div class="s20-conf-row s20-conf-ko"><span>🔧 Entretien</span><span>❌ En retard</span></div>`;
      else if (pilotage.estProche) {
        const detail = pilotage.kmRestants !== null && pilotage.kmRestants > 0
          ? `reste ${Math.round(pilotage.kmRestants)} km`
          : (pilotage.dateEcheance ? 'échéance ' + fmtDate(pilotage.dateEcheance) : '');
        pilotageHtml = `<div class="s20-conf-row s20-conf-warn"><span>🔧 Entretien</span><span>⚠️ ${detail}</span></div>`;
      } else pilotageHtml = `<div class="s20-conf-row s20-conf-ok"><span>🔧 Entretien</span><span>✅ À jour</span></div>`;
    }

    return `<div class="s21-spec-grid">${html}</div>${pilotageHtml ? '<div class="s20-conf-list">' + pilotageHtml + '</div>' : ''}`;
  }

  function renderEntretiens(entretiens, pilotage) {
    if (!entretiens.length) return '<div class="s20-empty">Aucun entretien enregistré</div>';
    const sorted = [...entretiens].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const prochain = pilotage && pilotage.prochainKm
      ? `<div class="s21-link-card" style="border-left:3px solid ${pilotage.estEnRetard ? '#ef4444' : (pilotage.estProche ? '#f59e0b' : '#10b981')}">
          <div class="s21-link-card-body">
            <div class="s21-link-card-lbl">Prochain entretien</div>
            <div class="s21-link-card-val">${pilotage.prochainKm.toLocaleString('fr-FR')} km${pilotage.dateEcheance ? ' · ' + fmtDate(pilotage.dateEcheance) : ''}</div>
          </div>
          <div style="font-size:.82rem;color:var(--text-muted)">${pilotage.kmRestants !== null && pilotage.kmRestants > 0 ? 'reste ' + Math.round(pilotage.kmRestants) + ' km' : (pilotage.estEnRetard ? 'En retard' : 'À jour')}</div>
        </div>` : '';
    return prochain + `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Km</th><th style="text-align:right">TTC</th></tr></thead>
      <tbody>${sorted.slice(0, 20).map(e => `<tr>
        <td>${esc(e.date || '')}</td>
        <td>${esc(e.type || '—')}</td>
        <td>${esc((e.description || '').slice(0, 60))}</td>
        <td style="text-align:right">${parseInt(e.km || 0, 10).toLocaleString('fr-FR')}</td>
        <td style="text-align:right">${euro(e.ttc || 0)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderCarburant(carburants, veh, consoReelle) {
    if (!carburants.length) return '<div class="s20-empty">Aucun plein enregistré</div>';
    const sorted = [...carburants].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 25);

    let consoBar = '';
    if (consoReelle !== null && veh.conso && parseFloat(veh.conso) > 0) {
      const ratio = consoReelle / parseFloat(veh.conso);
      const pct = Math.min(ratio * 100 / 1.5, 100);
      const cl = ratio > 1.3 ? 's21-conso-ko' : (ratio > 1.1 ? 's21-conso-warn' : 's21-conso-ok');
      consoBar = `
        <div class="s21-link-card">
          <div class="s21-link-card-body">
            <div class="s21-link-card-lbl">Conso réelle vs théorique (30j)</div>
            <div class="s21-link-card-val">${consoReelle.toFixed(1)} L / 100 <span style="color:var(--text-muted);font-weight:400">(théo ${parseFloat(veh.conso).toFixed(1)})</span></div>
            <div class="s21-conso-bar"><div class="s21-conso-fill ${cl}" style="width:${pct}%"></div></div>
          </div>
        </div>`;
    }

    return consoBar + `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Type</th><th style="text-align:right">L</th><th style="text-align:right">€/L</th><th style="text-align:right">Total</th><th style="text-align:right">Km</th></tr></thead>
      <tbody>${sorted.map(c => `<tr>
        <td>${esc(c.date || '')}</td>
        <td>${esc(c.typeCarburant || c.type || '—')}</td>
        <td style="text-align:right">${(parseFloat(c.litres) || 0).toFixed(1)}</td>
        <td style="text-align:right">${(parseFloat(c.prixLitre || c.prix) || 0).toFixed(3)}</td>
        <td style="text-align:right">${euro(c.total || 0)}</td>
        <td style="text-align:right">${c.kmCompteur ? parseInt(c.kmCompteur, 10).toLocaleString('fr-FR') : '—'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function renderInspections(inspections) {
    if (!inspections.length) return '<div class="s20-empty">Aucune inspection</div>';
    const sorted = [...inspections].sort((a, b) => new Date(b.creeLe || b.date || 0) - new Date(a.creeLe || a.date || 0)).slice(0, 8);
    return sorted.map(i => {
      const photos = (typeof window.getInspectionPhotoList === 'function') ? window.getInspectionPhotoList(i) : (i.photos || []);
      const thumbSrc = (p) => (typeof window.getInspectionPhotoThumb === 'function') ? window.getInspectionPhotoThumb(p) : (typeof p === 'string' ? p : (p.thumbUrl || p.url || ''));
      return `<div class="s21-link-card" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <strong>${esc(i.salNom || '—')}</strong>
          <span style="font-size:.78rem;color:var(--text-muted)">${esc(i.date || '')}${i.km ? ' · ' + parseInt(i.km, 10).toLocaleString('fr-FR') + ' km' : ''}</span>
        </div>
        ${photos.length ? `<div class="s21-photo-grid">${photos.slice(0, 6).map((p, idx) => `<img src="${esc(thumbSrc(p))}" onclick="window.voirPhotoAdmin && window.voirPhotoAdmin('${esc(i.id)}',${idx})" />`).join('')}</div>` : '<div style="color:var(--text-muted);font-size:.82rem">Aucune photo</div>'}
      </div>`;
    }).join('');
  }

  function renderLivraisonsVeh(livraisons) {
    if (!livraisons.length) return '<div class="s20-empty">Aucune livraison</div>';
    const sorted = [...livraisons].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20);
    return `<div style="overflow-x:auto"><table class="data-table" style="font-size:.82rem">
      <thead><tr><th>Date</th><th>Client</th><th>Chauffeur</th><th>Statut</th><th style="text-align:right">HT</th></tr></thead>
      <tbody>${sorted.map(l => `<tr>
        <td>${esc(l.date || '')}</td>
        <td>${esc(l.client || '—')}</td>
        <td>${esc(l.chaufNom || '—')}</td>
        <td>${esc(l.statut || '—')}</td>
        <td style="text-align:right">${euro(l.prixHT || l.prix || 0)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- 3. Navigation raccourcis ---------- */
  window.s21GoToCarburant = function(vehId) {
    if (typeof window.fermerFiche360 === 'function') window.fermerFiche360();
    if (typeof window.naviguerVers === 'function') window.naviguerVers('carburant');
    setTimeout(() => {
      const sel = document.getElementById('filtre-carb-vehicule');
      if (sel) { sel.value = vehId; if (typeof window.afficherCarburant === 'function') window.afficherCarburant(); }
    }, 200);
  };

  window.s21GoToEntretiens = function(vehId) {
    if (typeof window.fermerFiche360 === 'function') window.fermerFiche360();
    if (typeof window.naviguerVers === 'function') window.naviguerVers('entretiens');
    setTimeout(() => {
      const sel = document.getElementById('filtre-entr-vehicule');
      if (sel) { sel.value = vehId; if (typeof window.afficherEntretiens === 'function') window.afficherEntretiens(); }
    }, 200);
  };

  window.s21GoToEdit = function(vehId) {
    if (typeof window.fermerFiche360 === 'function') window.fermerFiche360();
    if (typeof window.ouvrirEditVehicule === 'function') window.ouvrirEditVehicule(vehId);
    else if (typeof window.ouvrirFicheVehiculeDepuisTableau === 'function') window.ouvrirFicheVehiculeDepuisTableau(vehId);
  };

  /* ---------- 4. Hijack du clic immat dans tb-vehicules → 360° ---------- */
  function injecterBoutons360() {
    const tb = document.getElementById('tb-vehicules');
    if (!tb) return;
    tb.querySelectorAll('tr').forEach(tr => {
      if (tr.__s21Hooked) return;
      const btnOld = tr.querySelector('button.table-link-button[onclick*="ouvrirFicheVehiculeDepuisTableau"]');
      if (!btnOld) return;
      const m = btnOld.getAttribute('onclick').match(/ouvrirFicheVehiculeDepuisTableau\('([^']+)'\)/);
      if (!m) return;
      const vehId = m[1];
      btnOld.setAttribute('onclick', `window.ouvrirFiche360Vehicule('${vehId}')`);
      btnOld.setAttribute('title', 'Ouvrir la fiche 360°');
      const oldBtn = tr.querySelector('.s21-btn-360');
      if (oldBtn) oldBtn.remove();
      tr.__s21Hooked = true;
    });
  }

  function setupObservers() {
    const el = document.getElementById('tb-vehicules');
    if (!el || el.__s21Obs) return;
    const obs = new MutationObserver(() => setTimeout(injecterBoutons360, 40));
    obs.observe(el, { childList: true, subtree: true });
    el.__s21Obs = obs;
  }

  /* ---------- Init ---------- */
  function init() {
    try { genererAlertesParc(); } catch(e) { console.warn('S21 alertes parc:', e); }
    setTimeout(() => {
      injecterBoutons360();
      setupObservers();
    }, 700);
    setInterval(() => { try { genererAlertesParc(); } catch(e){} }, 5 * 60 * 1000);
    // PERF: setInterval 3s retiré — setupObservers() via MutationObserver suffit
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1000);
})();

/* ==========================================================================
   Sprint 22+23 — Fusion Équipe (+Planning) + Parc auto + Comptabilité
   - Masque 16 anciens liens sidebar (5 Équipe + 4 Parc + 7 Finances)
   - Injecte 3 nouveaux liens (rh / parc / compta) — Calendrier reste standalone
   - Affiche un bandeau de sous-onglets quand on est dans une page du hub
   - Config data-driven (HUBS) — aucune manipulation destructive du DOM, réversible
   ========================================================================== */
(function installS22Fusion(){
  if (window.__s22Installed) return;
  window.__s22Installed = true;

  /* Config data-driven : 3 hubs (Équipe, Parc auto, Comptabilité) — Calendrier reste standalone */
  const HUBS = {
    rh: {
      alias: 'rh',
      title: '👥 Équipe',
      icon: '👥',
      label: 'Équipe',
      section: 'equipe',
      // Note : 'messagerie' retirée temporairement (page HTML supprimée par
      // commit 09dc43e). À ré-ajouter quand l'onglet Messagerie sera retravaillé.
      pages: ['salaries', 'heures', 'planning', 'incidents'],
      labels: { salaries: '👥 Salariés', heures: '⏱️ Heures & Km', planning: '📋 Planning', incidents: '🚨 Incidents' },
      defaultPage: 'salaries',
      storageKey: 's22_last_rh',
    },
    parc: {
      alias: 'parc',
      title: '🚐 Parc auto',
      icon: '🚐',
      label: 'Parc auto',
      section: 'flotte',
      pages: ['vehicules', 'carburant', 'entretiens', 'inspections'],
      labels: { vehicules: '🚐 Véhicules', carburant: '⛽ Carburant', entretiens: '🔧 Entretiens', inspections: '🚗 Inspections' },
      defaultPage: 'vehicules',
      storageKey: 's22_last_parc',
    },
    compta: {
      alias: 'compta',
      title: '💼 Comptabilité',
      icon: '💼',
      label: 'Finances',
      section: 'finances',
      pages: ['charges', 'tva', 'rentabilite', 'statistiques'],
      labels: {
        charges: '💸 Charges',
        tva: '🧾 TVA',
        rentabilite: '💰 Rentabilité',
        statistiques: '📈 Statistiques',
      },
      defaultPage: 'charges',
      storageKey: 's22_last_compta',
    },
  };
  const HUB_ALIASES = Object.keys(HUBS);
  const ALL_SUB_PAGES = HUB_ALIASES.flatMap(a => HUBS[a].pages);

  function hubFromPage(page) {
    if (!page) return null;
    for (const a of HUB_ALIASES) if (HUBS[a].pages.includes(page)) return a;
    return null;
  }

  /* Validation au boot : signale les incohérences de config (page absente du DOM,
     label manquant). Évite les "disparitions silencieuses" lorsqu'on ajoute une
     entrée à HUBS.<alias>.pages mais qu'on oublie la <section id="page-X"> ou
     le label associé. */
  function validateHubsConfig() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', validateHubsConfig);
      return;
    }
    HUB_ALIASES.forEach(function(alias) {
      var hub = HUBS[alias];
      hub.pages.forEach(function(page) {
        if (!document.getElementById('page-' + page)) {
          console.warn('[S22] Section DOM manquante : #page-' + page + ' (déclarée dans HUBS.' + alias + '.pages)');
        }
        if (!hub.labels[page]) {
          console.warn('[S22] Label manquant pour "' + page + '" dans HUBS.' + alias + '.labels');
        }
      });
    });
  }
  validateHubsConfig();

  /* Expose la config + helpers pour debug rapide en console DevTools.
     Usage : window.__s22Debug.HUBS.compta.pages, window.__s22Debug.hubFromPage('tva') */
  if (typeof window !== 'undefined') {
    window.__s22Debug = {
      HUBS: HUBS,
      HUB_ALIASES: HUB_ALIASES,
      ALL_SUB_PAGES: ALL_SUB_PAGES,
      hubFromPage: hubFromPage
    };
  }

  /* 1. Masquer tous les anciens liens sidebar (display:none — réversible) */
  function masquerAnciensLiens() {
    ALL_SUB_PAGES.forEach(p => {
      document.querySelectorAll('.nav-item[data-page="' + p + '"]').forEach(el => {
        el.style.display = 'none';
        el.dataset.s22Hidden = '1';
      });
    });
  }

  /* 2. Injecter les nouveaux liens sidebar (1 par hub) */
  function injecterNouveauxLiens() {
    HUB_ALIASES.forEach(alias => {
      const hub = HUBS[alias];
      const container = document.querySelector('[data-section="' + hub.section + '"] .nav-section-content');
      if (!container || container.querySelector('[data-page="' + alias + '"]')) return;
      const a = document.createElement('a');
      a.href = '#'; a.className = 'nav-item'; a.dataset.page = alias;
      a.innerHTML = '<span class="nav-icon">' + hub.icon + '</span><span class="nav-label">' + hub.label + '</span>';
      a.addEventListener('click', (e) => { e.preventDefault(); window.naviguerVers(alias); });
      container.insertBefore(a, container.firstChild);
    });
  }

  /* 3. Bandeau de sous-onglets */
  function ensureBandeau() {
    if (document.getElementById('s22-bandeau')) return;
    const main = document.getElementById('mainContent') || document.querySelector('.main-content');
    if (!main) return;
    const bandeau = document.createElement('div');
    bandeau.id = 's22-bandeau';
    bandeau.className = 's22-bandeau';
    bandeau.style.display = 'none';
    const topbar = main.querySelector('.topbar');
    if (topbar && topbar.parentNode === main) {
      topbar.insertAdjacentElement('afterend', bandeau);
    } else {
      main.insertBefore(bandeau, main.firstChild);
    }
  }

  function renderBandeau(hubAlias, currentPage) {
    const bandeau = document.getElementById('s22-bandeau');
    if (!bandeau) return;
    if (!hubAlias) { bandeau.style.display = 'none'; bandeau.innerHTML = ''; return; }
    const hub = HUBS[hubAlias];
    if (!hub) return;
    bandeau.innerHTML = `
      <div class="s22-bandeau-title">${hub.title}</div>
      <div class="s22-bandeau-tabs">
        ${hub.pages.map(p => `<button type="button" class="s22-bandeau-tab ${p === currentPage ? 'active' : ''}" data-page="${p}">${hub.labels[p]}</button>`).join('')}
      </div>`;
    bandeau.querySelectorAll('.s22-bandeau-tab').forEach(b => {
      b.onclick = () => window.naviguerVers(b.dataset.page);
    });
    bandeau.style.display = '';
  }

  /* 4. Mise à jour du lien actif sidebar (hub surligné au lieu de l'ancien) */
  function majLiensActifs(hubAlias) {
    document.querySelectorAll('.nav-item').forEach(el => {
      const p = el.dataset.page;
      if (HUB_ALIASES.includes(p)) el.classList.toggle('active', p === hubAlias);
    });
  }

  /* 5. Hook naviguerVers pour gérer les alias hub + bandeau auto */
  function hookNav() {
    const orig = window.naviguerVers;
    if (!orig || orig.__s22Hooked) return;
    const wrapped = function(page) {
      // Alias hub → ouvre TOUJOURS la page par défaut (reset au clic sur le hub)
      if (HUB_ALIASES.includes(page)) {
        const hub = HUBS[page];
        const defaultPage = hub.defaultPage;
        localStorage.removeItem(hub.storageKey);
        const ret = orig.call(this, defaultPage);
        setTimeout(() => { renderBandeau(page, defaultPage); majLiensActifs(page); }, 50);
        return ret;
      }
      // Navigation vers une page hors hub → reset storage des hubs précédents
      const hubAliasDest = hubFromPage(page);
      if (!hubAliasDest) {
        HUB_ALIASES.forEach(a => localStorage.removeItem(HUBS[a].storageKey));
      } else {
        // Changement de hub : clear les autres hubs (reset)
        HUB_ALIASES.forEach(a => { if (a !== hubAliasDest) localStorage.removeItem(HUBS[a].storageKey); });
      }
      const ret = orig.apply(this, arguments);
      const hubAlias = hubAliasDest;
      setTimeout(() => {
        if (hubAlias) {
          localStorage.setItem(HUBS[hubAlias].storageKey, page);
          renderBandeau(hubAlias, page);
          majLiensActifs(hubAlias);
        } else {
          renderBandeau(null);
          majLiensActifs(null);
        }
      }, 50);
      return ret;
    };
    wrapped.__s22Hooked = true;
    window.naviguerVers = wrapped;
  }

  /* Expose helper pour désactiver S22 en cas de souci */
  window.s22Desactiver = function() {
    document.querySelectorAll('.nav-item[data-s22-hidden="1"]').forEach(el => { el.style.display = ''; delete el.dataset.s22Hidden; });
    HUB_ALIASES.forEach(a => {
      const el = document.querySelector('.nav-item[data-page="' + a + '"]');
      if (el) el.remove();
    });
    const b = document.getElementById('s22-bandeau'); if (b) b.remove();
    if (typeof afficherToast === 'function') afficherToast('S22 désactivée — rechargez la page', 'success');
  };

  function init() {
    masquerAnciensLiens();
    injecterNouveauxLiens();
    ensureBandeau();
    hookNav();
    // Si déjà sur une sous-page au load → afficher bandeau
    const pageActiveEl = document.querySelector('.page.active') || document.querySelector('.page[style*="display: block"]');
    if (pageActiveEl) {
      const id = (pageActiveEl.id || '').replace('page-', '');
      const hubAlias = hubFromPage(id);
      if (hubAlias) { renderBandeau(hubAlias, id); majLiensActifs(hubAlias); }
    }
    // PERF: ancien setInterval 5s remplacé par MutationObserver sur la sidebar
    const sidebarEl = document.querySelector('.sidebar-nav') || document.querySelector('.sidebar');
    if (sidebarEl) {
      const sidebarObs = new MutationObserver(() => { masquerAnciensLiens(); injecterNouveauxLiens(); });
      sidebarObs.observe(sidebarEl, { childList: true, subtree: true });
    }
  }
  // PERF: exposé pour appel synchrone depuis le bootstrap principal (anti-FOUC sidebar)
  window.__s22InitSidebar = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else Promise.resolve().then(init);
})();

/* ==========================================================================
   Sprint 24 — Automatisations 16.1 + raccourcis clavier
   1. Rappel J-5 automatique sur échéances (crée alertes admin)
   2. Escalade relances niv 0→1→2→3 selon délai écoulé
   3. Clôture auto facture quand solde = 0 (100% payé)
   4. Décalage férié/weekend : fonction ajusterEcheance exposée
   5. Auto-facture à clôture livraison (si option activée dans Paramètres)
   6. Raccourcis clavier : Enter, Esc, N, E, Ctrl+S
   ========================================================================== */
(function installS24(){
  if (window.__s24Installed) return;
  window.__s24Installed = true;

  const LS = {
    factures: 'factures_emises',
    livraisons: 'livraisons',
    paiements: 'paiements',
    avoirs: 'avoirs_emis',
    clients: 'clients',
    relances: 'relances_log',
    alertes: 'alertes_admin',
    params: 'params_entreprise',
  };
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const loadObj = (k) => { try { return loadSafe(k, {}); } catch(e){ return {}; } };
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };
  const audit = (a, d) => { if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit(a, d); };
  const todayISO = () => new Date().toLocalISODate();
  const parseD = (s) => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
  const daysBetween = (a, b) => Math.floor((b - a) / 86400000);
  const genId = () => 's24_' + (typeof window.genId === 'function' ? window.genId() : Date.now()+'_'+Math.random().toString(36).slice(2,8));

  /* ----- Jours fériés FR (Meeus/Pâques) ----- */
  function paques(y) {
    const a = y%19, b = Math.floor(y/100), c = y%100, d = Math.floor(b/4), e = b%4;
    const f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3);
    const h = (19*a+b-d-g+15)%30, i = Math.floor(c/4), k = c%4;
    const L = (32+2*e+2*i-h-k)%7, m = Math.floor((a+11*h+22*L)/451);
    return new Date(y, Math.floor((h+L-7*m+114)/31)-1, ((h+L-7*m+114)%31)+1);
  }
  const _fcache = {};
  function feriesY(y) {
    if (_fcache[y]) return _fcache[y];
    const p = paques(y);
    const add = (d, n) => ({ d: new Date(d).toLocalISODate(), n });
    const lundiPq = new Date(p); lundiPq.setDate(p.getDate()+1);
    const ascension = new Date(p); ascension.setDate(p.getDate()+39);
    const lundiPent = new Date(p); lundiPent.setDate(p.getDate()+50);
    const list = [
      add(new Date(y,0,1), "Jour de l'An"),
      add(lundiPq, 'Lundi de Pâques'),
      add(new Date(y,4,1), 'Fête du Travail'),
      add(new Date(y,4,8), 'Victoire 1945'),
      add(ascension, 'Ascension'),
      add(lundiPent, 'Lundi de Pentecôte'),
      add(new Date(y,6,14), 'Fête nationale'),
      add(new Date(y,7,15), 'Assomption'),
      add(new Date(y,10,1), 'Toussaint'),
      add(new Date(y,10,11), 'Armistice 1918'),
      add(new Date(y,11,25), 'Noël'),
    ];
    _fcache[y] = list;
    return list;
  }
  function estFerie(isoDate) {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    return feriesY(d.getFullYear()).find(f => f.d === isoDate.slice(0,10)) || null;
  }
  function estWeekend(isoDate) {
    const d = new Date(isoDate);
    const j = d.getDay();
    return j === 0 || j === 6;
  }

  /* ----- API exposée : ajuster une échéance (reporte au prochain jour ouvré) ----- */
  window.ajusterEcheance = function(isoDate) {
    if (!isoDate) return isoDate;
    let d = new Date(isoDate + 'T00:00:00');
    let safety = 0;
    while (safety < 10) {
      const iso = d.toLocalISODate();
      if (!estFerie(iso) && !estWeekend(iso)) return iso;
      d.setDate(d.getDate() + 1);
      safety++;
    }
    return isoDate;
  };

  /* ----- Helpers factures ----- */
  function soldeFacture(f) {
    if (!f || f.statut === 'annulée') return 0;
    const pays = load(LS.paiements).filter(p => p.factureId === f.id && (p.sens==='in'||!p.sens)).reduce((s,p)=>s+(parseFloat(p.montant)||0),0);
    const avs = load(LS.avoirs).filter(a => a.factureId === f.id).reduce((s,a)=>s+(parseFloat(a.montantTTC)||0),0);
    return Math.max(0, (parseFloat(f.montantTTC||f.totalTTC||0)||0) - pays - avs);
  }
  function delaiPaiement(f) {
    const livs = load(LS.livraisons);
    const liv = livs.find(l => l.id === f.livId);
    const clients = load(LS.clients);
    let c = null;
    if (liv?.clientId) c = clients.find(x => x.id === liv.clientId);
    if (!c) c = clients.find(x => (x.nom||'').trim().toLowerCase() === (liv?.client||f.client||'').trim().toLowerCase());
    if (c && parseInt(c.delaiPaiementJours, 10) > 0) return parseInt(c.delaiPaiementJours, 10);
    return parseInt(localStorage.getItem('relance_delai'), 10) || 30;
  }
  function echeanceOf(f) {
    const base = f.dateEcheance || f.dateLivraison || f.dateFacture;
    if (!base) return null;
    const d = new Date(base + 'T00:00:00');
    if (!f.dateEcheance) d.setDate(d.getDate() + delaiPaiement(f));
    return d;
  }

  /* ----- 1. Rappels J-5 auto → alertes admin ----- */
  function autoRappelsJ5() {
    if (!getOption('auto_rappel_j5', true)) return;
    const auj = new Date();
    const factures = load(LS.factures).filter(f => f.statut !== 'annulée');
    const alertes = load(LS.alertes);
    let modif = false;
    factures.forEach(f => {
      const solde = soldeFacture(f);
      if (solde <= 0.01) return;
      const ech = echeanceOf(f); if (!ech) return;
      const jours = daysBetween(auj, ech);
      if (jours > 5 || jours < 0) return;
      const existing = alertes.find(a => a.type === 'fact_echeance_j5' && a.refId === f.id && !a.traitee);
      if (existing) return;
      alertes.push({
        id: genId(), type: 'fact_echeance_j5', refId: f.id,
        titre: '⏰ Facture ' + (f.numero||'—') + ' à échéance J-' + jours,
        message: 'Client ' + (f.client||'—') + ' · Solde dû : ' + (solde.toFixed(2)) + ' € · Échéance ' + ech.toLocalISODate(),
        gravite: jours <= 1 ? 'high' : (jours <= 3 ? 'medium' : 'low'),
        traitee: false, dateCreation: new Date().toISOString(), auto: true
      });
      modif = true;
    });
    if (modif) save(LS.alertes, alertes);
  }

  /* ----- 2. Escalade relances niv 0→1→2→3 ----- */
  function autoEscaladeRelances() {
    if (!getOption('auto_escalade_relances', true)) return;
    const delais = {
      0: parseInt(localStorage.getItem('escalade_j0_niv1'), 10) || 7,   // J+7 après échéance → niv 1
      1: parseInt(localStorage.getItem('escalade_niv1_niv2'), 10) || 7,  // +7j → niv 2
      2: parseInt(localStorage.getItem('escalade_niv2_niv3'), 10) || 10, // +10j → niv 3
      3: parseInt(localStorage.getItem('escalade_niv3_conten'), 10) || 15, // +15j → contentieux
    };
    const auj = new Date();
    const factures = load(LS.factures).filter(f => f.statut !== 'annulée');
    const relances = load(LS.relances);
    const alertes = load(LS.alertes);
    let modif = false;
    factures.forEach(f => {
      const solde = soldeFacture(f);
      if (solde <= 0.01) return;
      const ech = echeanceOf(f); if (!ech || ech > auj) return;
      const rf = relances.filter(r => r.factureId === f.id).sort((a,b) => new Date(b.date) - new Date(a.date));
      const niveauActuel = rf.length ? Math.max(...rf.map(r => parseInt(r.niveau, 10)||0)) : -1;
      const prochain = niveauActuel + 1;
      if (prochain > 4) return;
      const dateReference = niveauActuel < 0 ? ech : new Date(rf[0].date);
      const seuil = delais[Math.max(0, niveauActuel)] || 7;
      const joursDepuis = daysBetween(dateReference, auj);
      if (joursDepuis < seuil) return;
      // Crée alerte "escalade à lancer"
      const alertExist = alertes.find(a => a.type === 'relance_escalade' && a.refId === f.id && a.niveauCible === prochain && !a.traitee);
      if (!alertExist) {
        alertes.push({
          id: genId(), type: 'relance_escalade', refId: f.id, niveauCible: prochain,
          titre: '🔔 Relance niv. ' + prochain + ' à lancer — ' + (f.numero||'—'),
          message: 'Client ' + (f.client||'—') + ' · Solde ' + solde.toFixed(2) + ' € · ' + joursDepuis + 'j depuis ' + (niveauActuel<0?'échéance':'niv. '+niveauActuel),
          gravite: prochain >= 3 ? 'high' : 'medium',
          traitee: false, dateCreation: new Date().toISOString(), auto: true
        });
        modif = true;
      }
    });
    if (modif) save(LS.alertes, alertes);
  }

  /* ----- 3. Clôture auto facture si solde 0 ----- */
  function autoClotureFactures() {
    if (!getOption('auto_cloture_factures', true)) return;
    const factures = load(LS.factures);
    let modif = false;
    factures.forEach(f => {
      if (f.statut === 'annulée' || f.statut === 'payée' || f.statut === 'payee') return;
      const solde = soldeFacture(f);
      if (solde <= 0.01) {
        f.statut = 'payée';
        f.datePaiementComplet = f.datePaiementComplet || todayISO();
        modif = true;
        audit('Clôture auto facture', (f.numero||'—') + ' — solde atteint 0');
      }
    });
    if (modif) save(LS.factures, factures);
  }

  /* ----- 4. Auto-facture à clôture livraison ----- */
  function hookLivraisonStatut() {
    if (typeof window.genererFactureLivraison !== 'function') return;
    if (window.__s24HookedLiv) return;
    window.__s24HookedLiv = true;
    // Observer les changements de livraison statut='livre'
    setInterval(() => {
      if (!getOption('auto_facture_livraison', false)) return;
      const livs = load(LS.livraisons);
      const factures = load(LS.factures);
      let succes = 0;
      let dirty = false;
      livs.forEach(l => {
        if (l.statut !== 'livre' && l.statut !== 'livrée' && l.statut !== 'termine') return;
        if (l.factureId || factures.find(f => f.livId === l.id && f.statut !== 'annulée')) return;
        if (l.__s24AutoFactAttempted) return;
        try {
          window.genererFactureLivraison(l.id);
          l.__s24AutoFactAttempted = true;
          dirty = true;
          succes++;
        } catch(e) {
          // Marquer "tenté" même en cas d'échec pour stopper le retry loop infini (sinon spam egress 60s).
          l.__s24AutoFactAttempted = true;
          dirty = true;
        }
      });
      if (dirty) save(LS.livraisons, livs);
      if (succes) toast('📄 ' + succes + ' facture(s) auto-générée(s) depuis livraisons clôturées', 'success');
    }, 60000);
  }

  /* ----- Options Paramètres (lecture) ----- */
  function getOption(key, def) {
    const params = loadObj(LS.params);
    const optsS24 = params.s24 || {};
    return (optsS24[key] !== undefined) ? !!optsS24[key] : def;
  }
  window.s24GetOption = getOption;
  window.s24SetOption = function(key, val) {
    const params = loadObj(LS.params);
    params.s24 = params.s24 || {};
    params.s24[key] = val;
    localStorage.setItem(LS.params, JSON.stringify(params));
  };

  /* ----- 6. Raccourcis clavier globaux ----- */
  function setupKeyboardShortcuts() {
    if (window.__s24KeysBound) return;
    window.__s24KeysBound = true;

    document.addEventListener('keydown', function(e) {
      const tgt = e.target;
      const tag = (tgt.tagName||'').toUpperCase();
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tgt.isContentEditable;
      const openModal = findOpenModal();

      // Esc : ferme modal visible (ou drawer)
      if (e.key === 'Escape') {
        if (openModal) { e.preventDefault(); closeModal(openModal); return; }
        const drawer = document.querySelector('.s20-drawer.open, .s21-drawer.open, .s25-drawer.open');
        if (drawer) { e.preventDefault(); drawer.classList.remove('open'); return; }
      }

      // Enter dans input (hors textarea) d'un modal → submit
      if (e.key === 'Enter' && tag === 'INPUT' && tgt.type !== 'button' && tgt.type !== 'submit' && openModal && !e.shiftKey) {
        // Si le modal contient un bouton primary visible → clic
        const btnPrim = openModal.querySelector('.btn-primary:not([disabled])');
        if (btnPrim) { e.preventDefault(); btnPrim.click(); }
      }

      // Ignorer raccourcis globaux si focus input
      if (isInput) return;
      // Ctrl+S : sauvegarder export (déclenche bouton Export CSV de la page si présent)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const exportBtn = document.querySelector('.page.active .btn-secondary[onclick*="export"], .page[style*="block"] .btn-secondary[onclick*="export"]');
        if (exportBtn) { e.preventDefault(); exportBtn.click(); toast('💾 Export lancé (Ctrl+S)'); }
        return;
      }
      // N : Nouveau (contextuel — cherche bouton + sur la page active)
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pageActive = document.querySelector('.page.active, .page[style*="block"]');
        if (!pageActive) return;
        const btnNouv = pageActive.querySelector('.btn-primary[onclick*="ouvrir"], .btn-primary[onclick*="nouveau"], .btn-primary[onclick*="Nouveau"]');
        if (btnNouv) { e.preventDefault(); btnNouv.click(); }
      }
      // E : Éditer sélection (focus sur première ligne table, ouvre édition si bouton)
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pageActive = document.querySelector('.page.active, .page[style*="block"]');
        if (!pageActive) return;
        const rowSel = pageActive.querySelector('tr.selected, tr:focus');
        const btnEdit = rowSel?.querySelector('.btn-edit, button[onclick*="modifier"], button[onclick*="editer"]');
        if (btnEdit) { e.preventDefault(); btnEdit.click(); }
      }
    });
  }
  function findOpenModal() {
    return document.querySelector('.modal[style*="block"], .modal.open, #s15-modal-info.open');
  }
  function closeModal(m) {
    if (m.id === 's15-modal-info') { m.classList.remove('open'); return; }
    if (typeof window.closeModal === 'function') window.closeModal(m.id);
    else { m.style.display = 'none'; m.classList.remove('open'); }
  }

  /* ----- Cron tick ----- */
  function cronTick() {
    try { autoRappelsJ5(); } catch(e){ console.warn('S24 rappelsJ5', e); }
    try { autoEscaladeRelances(); } catch(e){ console.warn('S24 escalade', e); }
    try { autoClotureFactures(); } catch(e){ console.warn('S24 cloture', e); }
  }
  window.s24CronTick = cronTick;

  /* ----- UI Paramètres : injecter section Automatisations ----- */
  function injectParamsUI() {
    const pageParams = document.getElementById('page-parametres');
    if (!pageParams) return;
    if (pageParams.querySelector('#s24-params-section')) return;
    const container = pageParams.querySelector('.settings-content') || pageParams;
    const section = document.createElement('div');
    section.id = 's24-params-section';
    section.className = 'settings-section';
    section.innerHTML = `
      <h2 style="margin-top:32px">⚙️ Automatisations</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">Règles qui tournent en arrière-plan côté MCA. Les automatisations de facturation / relance / clôture sont gérées par Pennylane.</p>
      <h3 style="margin-top:24px">📅 Décalage férié / weekend</h3>
      <p style="color:var(--text-muted);font-size:.88rem">Les nouvelles échéances créées sont automatiquement repoussées au prochain jour ouvré (hors weekends et jours fériés FR).</p>
      <h3 style="margin-top:24px">⌨️ Raccourcis clavier</h3>
      <div class="s24-keyboard-help">
        <div><kbd>Enter</kbd> dans un champ → valider le modal</div>
        <div><kbd>Esc</kbd> → fermer modal / drawer</div>
        <div><kbd>N</kbd> → Nouveau (contextuel)</div>
        <div><kbd>E</kbd> → Éditer ligne sélectionnée</div>
        <div><kbd>Ctrl</kbd>+<kbd>S</kbd> → Exporter page active</div>
        <div><kbd>Ctrl</kbd>+<kbd>K</kbd> → Palette de recherche</div>
      </div>
    `;
    container.appendChild(section);
    section.querySelectorAll('input[type=checkbox][data-s24-key]').forEach(cb => {
      cb.addEventListener('change', () => {
        window.s24SetOption(cb.dataset.s24Key, cb.checked);
        toast(cb.checked ? '✅ Activé : '+cb.dataset.s24Label : '⏸️ Désactivé : '+cb.dataset.s24Label, 'success');
        if (cb.dataset.s24Key === 'auto_facture_livraison' && cb.checked) hookLivraisonStatut();
      });
    });
  }
  function renderToggle(key, label, desc, def) {
    const val = getOption(key, def);
    return `<label class="s24-toggle">
      <input type="checkbox" data-s24-key="${key}" data-s24-label="${label}" ${val?'checked':''} />
      <span class="s24-toggle-switch"></span>
      <span class="s24-toggle-body"><strong>${label}</strong><br><small>${desc}</small></span>
    </label>`;
  }

  function init() {
    setupKeyboardShortcuts();
    hookLivraisonStatut();
    setTimeout(cronTick, 3500);
    setInterval(cronTick, 5 * 60 * 1000);
    setTimeout(injectParamsUI, 800);
    setInterval(injectParamsUI, 4000); // re-injecte si params re-rendus
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1300);
})();

/* ==========================================================================
   Sprint 25 — Drawer 360° Client & Fournisseur + Règles d'alertes perso
   - ouvrirFiche360Client(id) / ouvrirFiche360Fournisseur(id)
   - Hijack clic sur nom dans tables → drawer 360°
   - 5 onglets : Vue, Factures/Commandes, Livraisons/Charges, Paiements, Historique
   - Règles alertes perso : UI Paramètres + évaluation dans cron S24
   ========================================================================== */
(function installS25(){
  if (window.__s25Installed) return;
  window.__s25Installed = true;

  const LS = {
    clients: 'clients', fournisseurs: 'fournisseurs', livraisons: 'livraisons',
    factures: 'factures_emises', avoirs: 'avoirs_emis', paiements: 'paiements',
    relances: 'relances_log', charges: 'charges', alertes: 'alertes_admin',
    rules: 's25_alert_rules',
  };
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
  const genId = () => 's25_' + (typeof window.genId === 'function' ? window.genId() : Date.now()+'_'+Math.random().toString(36).slice(2,8));
  const toast = (m,t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };

  function initials(nom) {
    return (nom||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('') || '?';
  }

  /* ---------- Drawer infrastructure ---------- */
  function ensureDrawer() {
    if (document.getElementById('s25-drawer')) return;
    const d = document.createElement('div');
    d.id = 's25-drawer-overlay'; d.className = 's25-drawer-overlay';
    d.innerHTML = '<div id="s25-drawer" class="s25-drawer"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) fermerDrawer(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && d.classList.contains('open')) fermerDrawer(); });
  }
  function fermerDrawer() {
    const o = document.getElementById('s25-drawer-overlay'); if (o) o.classList.remove('open');
  }
  window.s25FermerDrawer = fermerDrawer;

  function renderDrawer(html) {
    ensureDrawer();
    const o = document.getElementById('s25-drawer-overlay');
    const d = document.getElementById('s25-drawer');
    d.innerHTML = html;
    o.classList.add('open');
  }

  /* ---------- Calculs Client ---------- */
  function factClient(c) {
    const livs = load(LS.livraisons);
    return load(LS.factures).filter(f => {
      if (f.statut === 'annulée') return false;
      if (f.clientId === c.id) return true;
      const liv = livs.find(l => l.id === f.livId);
      if (liv?.clientId === c.id) return true;
      const nom = (c.nom||'').trim().toLowerCase();
      return (f.client||'').trim().toLowerCase() === nom || (liv?.client||'').trim().toLowerCase() === nom;
    });
  }
  function livsClient(c) {
    return load(LS.livraisons).filter(l => {
      if (l.clientId === c.id) return true;
      return (l.client||'').trim().toLowerCase() === (c.nom||'').trim().toLowerCase();
    });
  }
  function paiementsClient(c) {
    const fs = factClient(c).map(f => f.id);
    return load(LS.paiements).filter(p => fs.includes(p.factureId));
  }
  function relancesClient(c) {
    const fs = factClient(c).map(f => f.id);
    return load(LS.relances).filter(r => fs.includes(r.factureId));
  }
  function soldeFact(f) {
    if (f.statut === 'annulée') return 0;
    const pays = load(LS.paiements).filter(p => p.factureId === f.id && (p.sens==='in'||!p.sens)).reduce((s,p)=>s+(parseFloat(p.montant)||0),0);
    const avs = load(LS.avoirs).filter(a => a.factureId === f.id).reduce((s,a)=>s+(parseFloat(a.montantTTC)||0),0);
    return Math.max(0, (parseFloat(f.montantTTC||f.totalTTC||0)||0) - pays - avs);
  }

  /* ---------- Fiche 360° Client ---------- */
  window.ouvrirFiche360Client = function(clientId) {
    const c = load(LS.clients).find(x => x.id === clientId);
    if (!c) { toast('Client introuvable', 'error'); return; }
    const factures = factClient(c);
    const livs = livsClient(c);
    const paiements = paiementsClient(c);
    const relances = relancesClient(c);
    const totalFact = factures.reduce((s,f) => s + (parseFloat(f.montantTTC||f.totalTTC)||0), 0);
    const totalPaye = paiements.reduce((s,p) => s + (parseFloat(p.montant)||0), 0);
    const solde = factures.reduce((s,f) => s + soldeFact(f), 0);
    const ca12 = (() => {
      const il = new Date(); il.setMonth(il.getMonth()-12);
      return factures.filter(f => new Date(f.dateFacture||f.date||0) >= il).reduce((s,f) => s + (parseFloat(f.montantTTC||f.totalTTC)||0), 0);
    })();
    const retardJ = factures.filter(f => {
      if (soldeFact(f) <= 0.01) return false;
      const base = f.dateEcheance || f.dateLivraison || f.dateFacture;
      if (!base) return false;
      return new Date(base) < new Date();
    }).length;

    const tabs = [
      { k: 'vue', label: '📊 Vue d\'ensemble' },
      { k: 'fact', label: '📄 Factures ('+factures.length+')' },
      { k: 'livs', label: '📦 Livraisons ('+livs.length+')' },
      { k: 'pay', label: '💳 Paiements ('+paiements.length+')' },
      { k: 'com', label: '📨 Communications ('+relances.length+')' },
    ];

    const html = `
      <div class="s25-drawer-head">
        <button class="s25-close" onclick="window.s25FermerDrawer()" aria-label="Fermer">✕</button>
        <div class="s25-avatar">${esc(initials(c.nom))}</div>
        <div class="s25-head-body">
          <div class="s25-head-title">👤 ${esc(c.nom||'—')}</div>
          <div class="s25-head-meta">
            ${c.categorie ? '<span class="s25-badge">'+esc(c.categorie)+'</span>' : ''}
            ${c.email ? '<span>✉️ <a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a></span>' : ''}
            ${c.tel ? '<span>📞 '+esc(c.tel)+'</span>' : ''}
            ${c.siren ? '<span>🏢 SIREN '+esc(c.siren)+'</span>' : ''}
          </div>
        </div>
        <div class="s25-head-actions">
          <button class="btn-secondary" onclick="ouvrirEditClient('${c.id}');setTimeout(()=>window.s25FermerDrawer(),100)">✏️ Modifier</button>
        </div>
      </div>
      <div class="s25-kpi-row">
        <div class="s25-kpi"><div class="kpi-label">CA total</div><div class="kpi-val">${fmtEur(totalFact)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">CA 12 mois</div><div class="kpi-val">${fmtEur(ca12)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Encaissé</div><div class="kpi-val" style="color:#22c55e">${fmtEur(totalPaye)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Solde dû</div><div class="kpi-val" style="color:${solde>0?'#ef4444':'inherit'}">${fmtEur(solde)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Fact. en retard</div><div class="kpi-val" style="color:${retardJ>0?'#f97316':'inherit'}">${retardJ}</div></div>
      </div>
      <div class="s25-tabs">
        ${tabs.map(t => '<button class="s25-tab" data-tab="'+t.k+'">'+t.label+'</button>').join('')}
      </div>
      <div class="s25-tab-content">
        ${renderVueClient(c, factures, livs, paiements, relances)}
        ${renderFactTab(factures)}
        ${renderLivsTab(livs)}
        ${renderPayTab(paiements)}
        ${renderComTab(relances, c)}
      </div>`;
    renderDrawer(html);
    wireTabs();
  };

  function renderVueClient(c, factures, livs, paiements, relances) {
    const lastLiv = livs.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))[0];
    const lastFact = factures.sort((a,b) => new Date(b.dateFacture||0) - new Date(a.dateFacture||0))[0];
    const lastPay = paiements.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))[0];
    const lastRel = relances.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))[0];
    const delai = parseInt(c.delaiPaiementJours, 10) || 30;
    return `
      <div class="s25-tab-panel active" data-panel="vue">
        <div class="s25-section">
          <h4>📅 Dernières interactions</h4>
          <div class="s25-timeline">
            ${lastLiv ? '<div class="s25-tl-item">📦 <strong>Livraison</strong> '+esc(lastLiv.numero||'—')+' · '+fmtDate(lastLiv.date)+' · '+fmtEur(lastLiv.montant||lastLiv.totalHT||0)+'</div>' : ''}
            ${lastFact ? '<div class="s25-tl-item">📄 <strong>Facture</strong> '+esc(lastFact.numero||'—')+' · '+fmtDate(lastFact.dateFacture)+' · '+fmtEur(lastFact.montantTTC||lastFact.totalTTC||0)+'</div>' : ''}
            ${lastPay ? '<div class="s25-tl-item">💳 <strong>Paiement</strong> '+fmtDate(lastPay.date)+' · '+fmtEur(lastPay.montant||0)+' · '+esc(lastPay.mode||'—')+'</div>' : ''}
            ${lastRel ? '<div class="s25-tl-item">📨 <strong>Relance niv '+(lastRel.niveau||0)+'</strong> '+fmtDate(lastRel.date)+'</div>' : ''}
            ${!lastLiv && !lastFact && !lastPay && !lastRel ? '<div style="color:var(--text-muted);padding:12px;text-align:center">Aucune interaction</div>' : ''}
          </div>
        </div>
        <div class="s25-section">
          <h4>ℹ️ Infos clés</h4>
          <div class="s25-infos">
            <div><span>Délai paiement</span><strong>${delai} jours</strong></div>
            <div><span>Adresse</span><strong>${esc(c.adresse||'—')}</strong></div>
            <div><span>Code postal</span><strong>${esc(c.codePostal||'—')} ${esc(c.ville||'')}</strong></div>
            <div><span>Créé le</span><strong>${fmtDate(c.dateCreation)}</strong></div>
          </div>
        </div>
      </div>`;
  }

  function renderFactTab(factures) {
    if (!factures.length) return '<div class="s25-tab-panel" data-panel="fact"><div class="s25-empty">Aucune facture</div></div>';
    const rows = factures.sort((a,b) => new Date(b.dateFacture||0) - new Date(a.dateFacture||0))
      .map(f => {
        const s = soldeFact(f);
        const pillCls = f.statut === 'payée' || s <= 0.01 ? 'pill-ok' : (s > 0 ? 'pill-due' : 'pill-neutral');
        return '<tr><td>'+fmtDate(f.dateFacture)+'</td><td><strong>'+esc(f.numero||'—')+'</strong></td><td>'+fmtEur(f.montantTTC||f.totalTTC||0)+'</td><td style="color:'+(s>0?'#ef4444':'inherit')+'">'+fmtEur(s)+'</td><td><span class="s25-pill '+pillCls+'">'+esc(f.statut||'—')+'</span></td></tr>';
      }).join('');
    return '<div class="s25-tab-panel" data-panel="fact"><table class="s25-table"><thead><tr><th>Date</th><th>N°</th><th>Total TTC</th><th>Solde dû</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderLivsTab(livs) {
    if (!livs.length) return '<div class="s25-tab-panel" data-panel="livs"><div class="s25-empty">Aucune livraison</div></div>';
    const rows = livs.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(l => '<tr><td>'+fmtDate(l.date)+'</td><td><strong>'+esc(l.numero||'—')+'</strong></td><td>'+fmtEur(l.montant||l.totalHT||0)+'</td><td>'+esc(l.statut||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="livs"><table class="s25-table"><thead><tr><th>Date</th><th>N°</th><th>Montant</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderPayTab(paiements) {
    if (!paiements.length) return '<div class="s25-tab-panel" data-panel="pay"><div class="s25-empty">Aucun paiement</div></div>';
    const rows = paiements.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(p => '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.factureNumero||p.factureId||'—')+'</td><td>'+fmtEur(p.montant||0)+'</td><td>'+esc(p.mode||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="pay"><table class="s25-table"><thead><tr><th>Date</th><th>Facture</th><th>Montant</th><th>Mode</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderComTab(relances, c) {
    if (!relances.length) return '<div class="s25-tab-panel" data-panel="com"><div class="s25-empty">Aucune relance envoyée</div></div>';
    const rows = relances.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(r => '<div class="s25-tl-item">📨 <strong>Niv '+(r.niveau||0)+'</strong> '+fmtDate(r.date)+(r.statut === 'envoyee' ? ' · ✉️ envoyée' : ' · 📝 brouillon')+(r.email ? '<div style="font-size:.82rem;color:var(--text-muted)">→ '+esc(r.email)+'</div>' : '')+'</div>').join('');
    return '<div class="s25-tab-panel" data-panel="com"><div class="s25-timeline">'+rows+'</div></div>';
  }

  /* ---------- Calculs Fournisseur ---------- */
  function chargesFourn(f) {
    return load(LS.charges).filter(c => c.fournisseurId === f.id || (c.fournisseur||'').trim().toLowerCase() === (f.nom||'').trim().toLowerCase());
  }
  function paiementsFourn(f) {
    const cs = chargesFourn(f).map(c => c.id);
    return load(LS.paiements).filter(p => cs.includes(p.chargeId) || (p.beneficiaire||'').trim().toLowerCase() === (f.nom||'').trim().toLowerCase() || p.sens === 'out');
  }

  /* ---------- Fiche 360° Fournisseur ---------- */
  window.ouvrirFiche360Fournisseur = function(fournId) {
    const f = load(LS.fournisseurs).find(x => x.id === fournId);
    if (!f) { toast('Fournisseur introuvable', 'error'); return; }
    const charges = chargesFourn(f);
    const paiements = paiementsFourn(f).filter(p => {
      const cs = charges.map(c => c.id);
      return cs.includes(p.chargeId);
    });
    const totalDep = charges.reduce((s,c) => s + (parseFloat(c.montantTTC||c.montant)||0), 0);
    const totalPaye = paiements.reduce((s,p) => s + (parseFloat(p.montant)||0), 0);
    const solde = Math.max(0, totalDep - totalPaye);
    const dep12 = (() => {
      const il = new Date(); il.setMonth(il.getMonth()-12);
      return charges.filter(c => new Date(c.date||0) >= il).reduce((s,c) => s + (parseFloat(c.montantTTC||c.montant)||0), 0);
    })();

    const tabs = [
      { k: 'vue', label: '📊 Vue d\'ensemble' },
      { k: 'charges', label: '💸 Charges ('+charges.length+')' },
      { k: 'pay', label: '💳 Paiements ('+paiements.length+')' },
      { k: 'docs', label: '📎 Documents' },
    ];

    const html = `
      <div class="s25-drawer-head">
        <button class="s25-close" onclick="window.s25FermerDrawer()" aria-label="Fermer">✕</button>
        <div class="s25-avatar" style="background:rgba(245,166,35,0.18);color:#f5a623">${esc(initials(f.nom))}</div>
        <div class="s25-head-body">
          <div class="s25-head-title">🏭 ${esc(f.nom||'—')}</div>
          <div class="s25-head-meta">
            ${f.categorie ? '<span class="s25-badge">'+esc(f.categorie)+'</span>' : ''}
            ${f.email ? '<span>✉️ <a href="mailto:'+esc(f.email)+'">'+esc(f.email)+'</a></span>' : ''}
            ${f.tel ? '<span>📞 '+esc(f.tel)+'</span>' : ''}
            ${f.siren ? '<span>🏢 SIREN '+esc(f.siren)+'</span>' : ''}
          </div>
        </div>
      </div>
      <div class="s25-kpi-row">
        <div class="s25-kpi"><div class="kpi-label">Dépense totale</div><div class="kpi-val">${fmtEur(totalDep)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">12 derniers mois</div><div class="kpi-val">${fmtEur(dep12)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Payé</div><div class="kpi-val" style="color:#22c55e">${fmtEur(totalPaye)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Solde dû</div><div class="kpi-val" style="color:${solde>0?'#ef4444':'inherit'}">${fmtEur(solde)}</div></div>
        <div class="s25-kpi"><div class="kpi-label">Délai accordé</div><div class="kpi-val">${parseInt(f.delaiPaiementJours, 10)||30} j</div></div>
      </div>
      <div class="s25-tabs">
        ${tabs.map(t => '<button class="s25-tab" data-tab="'+t.k+'">'+t.label+'</button>').join('')}
      </div>
      <div class="s25-tab-content">
        <div class="s25-tab-panel active" data-panel="vue">
          <div class="s25-section"><h4>📅 Dernières charges</h4>
            ${charges.slice(0,5).map(c => '<div class="s25-tl-item">💸 '+fmtDate(c.date)+' · '+esc(c.description||c.categorie||'—')+' · '+fmtEur(c.montantTTC||c.montant||0)+'</div>').join('') || '<div class="s25-empty">Aucune charge enregistrée</div>'}
          </div>
          <div class="s25-section"><h4>ℹ️ Infos clés</h4>
            <div class="s25-infos">
              <div><span>Adresse</span><strong>${esc(f.adresse||'—')}</strong></div>
              <div><span>IBAN</span><strong>${esc(f.iban||'—')}</strong></div>
              <div><span>Créé le</span><strong>${fmtDate(f.dateCreation)}</strong></div>
            </div>
          </div>
        </div>
        ${renderChargesTab(charges)}
        ${renderPayTabF(paiements)}
        <div class="s25-tab-panel" data-panel="docs"><div class="s25-empty">Documents à venir (contrats, factures scannées)</div></div>
      </div>`;
    renderDrawer(html);
    wireTabs();
  };
  function renderChargesTab(charges) {
    if (!charges.length) return '<div class="s25-tab-panel" data-panel="charges"><div class="s25-empty">Aucune charge</div></div>';
    const rows = charges.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(c => '<tr><td>'+fmtDate(c.date)+'</td><td>'+esc(c.description||c.categorie||'—')+'</td><td>'+fmtEur(c.montantTTC||c.montant||0)+'</td><td>'+esc(c.statut||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="charges"><table class="s25-table"><thead><tr><th>Date</th><th>Libellé</th><th>Montant</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderPayTabF(paiements) {
    if (!paiements.length) return '<div class="s25-tab-panel" data-panel="pay"><div class="s25-empty">Aucun paiement</div></div>';
    const rows = paiements.sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
      .map(p => '<tr><td>'+fmtDate(p.date)+'</td><td>'+esc(p.reference||p.chargeId||'—')+'</td><td>'+fmtEur(p.montant||0)+'</td><td>'+esc(p.mode||'—')+'</td></tr>').join('');
    return '<div class="s25-tab-panel" data-panel="pay"><table class="s25-table"><thead><tr><th>Date</th><th>Réf</th><th>Montant</th><th>Mode</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }

  function wireTabs() {
    const drawer = document.getElementById('s25-drawer');
    if (!drawer) return;
    const tabs = drawer.querySelectorAll('.s25-tab');
    const panels = drawer.querySelectorAll('.s25-tab-panel');
    if (!tabs.length) return;
    tabs[0].classList.add('active');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        t.classList.add('active');
        const p = drawer.querySelector('.s25-tab-panel[data-panel="'+t.dataset.tab+'"]');
        if (p) p.classList.add('active');
      });
    });
  }

  /* ---------- Hijack tables : clic nom → drawer 360° ---------- */
  function injecterHijack() {
    const tbCli = document.getElementById('tb-clients');
    if (tbCli) {
      tbCli.querySelectorAll('tr').forEach(tr => {
        if (tr.__s25Hooked) return;
        const btn = tr.querySelector('button.btn-link-inline[onclick*="ouvrirHistoriqueClient"]');
        if (!btn) return;
        const m = btn.getAttribute('onclick').match(/ouvrirHistoriqueClient\('([^']+)'\)/);
        if (!m) return;
        btn.setAttribute('onclick', "window.ouvrirFiche360Client('"+m[1]+"')");
        btn.setAttribute('title', 'Ouvrir la fiche 360°');
        tr.__s25Hooked = true;
      });
    }
    const tbF = document.getElementById('tb-fournisseurs');
    if (tbF) {
      tbF.querySelectorAll('tr').forEach(tr => {
        if (tr.__s25Hooked) return;
        const btn = tr.querySelector('button.btn-link-inline[onclick*="ouvrirHistoriqueFournisseur"]');
        if (!btn) return;
        const m = btn.getAttribute('onclick').match(/ouvrirHistoriqueFournisseur\('([^']+)'\)/);
        if (!m) return;
        btn.setAttribute('onclick', "window.ouvrirFiche360Fournisseur('"+m[1]+"')");
        btn.setAttribute('title', 'Ouvrir la fiche 360°');
        tr.__s25Hooked = true;
      });
    }
  }

  /* ==========================================================================
     Règles d'alertes perso (S25 — volet B)
     Stockées dans localStorage 's25_alert_rules'
     Structure : { id, nom, actif, trigger:'facture|livraison|vehicule|salarie', condition:{field, op, value}, action:'alerte|toast', graviteOutput }
     Évaluées par s24CronTick toutes les 5 min
     ========================================================================== */
  const RULE_SCOPES = {
    facture: { key: LS.factures, label: '📄 Facture', fields: ['montantTTC','statut','dateFacture','dateEcheance','client'] },
    livraison: { key: LS.livraisons, label: '📦 Livraison', fields: ['montant','statut','date','client'] },
    charge: { key: LS.charges, label: '💸 Charge', fields: ['montantTTC','statut','date','fournisseur'] },
  };
  const OPS = {
    '>': (a,b) => parseFloat(a) > parseFloat(b),
    '>=': (a,b) => parseFloat(a) >= parseFloat(b),
    '<': (a,b) => parseFloat(a) < parseFloat(b),
    '<=': (a,b) => parseFloat(a) <= parseFloat(b),
    '==': (a,b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase(),
    '!=': (a,b) => String(a).trim().toLowerCase() !== String(b).trim().toLowerCase(),
    'contains': (a,b) => String(a||'').toLowerCase().includes(String(b||'').toLowerCase()),
    'jours_depuis': (a,b) => { if (!a) return false; return Math.floor((new Date() - new Date(a))/86400000) >= parseInt(b, 10); },
  };

  function evaluerRegles() {
    const rules = load(LS.rules).filter(r => r.actif);
    if (!rules.length) return;
    const alertes = load(LS.alertes);
    let modif = false;
    rules.forEach(rule => {
      const scope = RULE_SCOPES[rule.trigger];
      if (!scope) return;
      const items = load(scope.key);
      items.forEach(it => {
        const fn = OPS[rule.condition.op];
        if (!fn) return;
        const val = it[rule.condition.field];
        if (!fn(val, rule.condition.value)) return;
        const itemId = it.id || it.numero || JSON.stringify(it).slice(0,40);
        const exist = alertes.find(a => a.type === 'rule_'+rule.id && a.refId === itemId && !a.traitee);
        if (exist) return;
        alertes.push({
          id: 's25_rule_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
          type: 'rule_'+rule.id, refId: itemId,
          titre: '🔔 '+rule.nom,
          message: scope.label+' · '+(it.numero||it.nom||'—')+' · '+rule.condition.field+' '+rule.condition.op+' '+rule.condition.value+' (val: '+(val||'—')+')',
          gravite: rule.graviteOutput||'medium',
          traitee: false, dateCreation: new Date().toISOString(), auto: true, regleSource: rule.id
        });
        modif = true;
      });
    });
    if (modif) save(LS.alertes, alertes);
  }
  window.s25EvaluerRegles = evaluerRegles;

  /* ---------- UI Règles dans Paramètres ---------- */
  function injectRulesUI() {
    const pageParams = document.getElementById('page-parametres');
    if (!pageParams) return;
    if (pageParams.querySelector('#s25-rules-section')) return;
    const container = pageParams.querySelector('.settings-content') || pageParams;
    const section = document.createElement('div');
    section.id = 's25-rules-section'; section.className = 'settings-section';
    section.innerHTML = `
      <h2 style="margin-top:32px">🔔 Règles d'alertes personnalisées</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">Créez vos propres règles : quand une condition est vraie, une alerte est ajoutée au Centre d'alertes.</p>
      <div id="s25-rules-list"></div>
      <button class="btn-primary" onclick="window.s25NewRule()" style="margin-top:12px">+ Nouvelle règle</button>
    `;
    container.appendChild(section);
    renderRulesList();
  }
  function renderRulesList() {
    const list = document.getElementById('s25-rules-list');
    if (!list) return;
    const rules = load(LS.rules);
    if (!rules.length) { list.innerHTML = '<div style="padding:16px;color:var(--text-muted);text-align:center;border:1px dashed var(--border);border-radius:10px">Aucune règle pour le moment. Cliquez + Nouvelle règle</div>'; return; }
    list.innerHTML = rules.map(r => {
      const scope = RULE_SCOPES[r.trigger]?.label || r.trigger;
      return `<div class="s25-rule-card ${r.actif?'on':''}">
        <div class="s25-rule-head">
          <div><strong>${esc(r.nom)}</strong><div class="s25-rule-meta">${scope} · ${esc(r.condition.field)} ${esc(r.condition.op)} ${esc(r.condition.value)}</div></div>
          <div class="s25-rule-actions">
            <label class="s25-rule-toggle"><input type="checkbox" ${r.actif?'checked':''} onchange="window.s25ToggleRule('${r.id}',this.checked)"/><span class="s24-toggle-switch"></span></label>
            <button class="btn-icon" onclick="window.s25DelRule('${r.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  window.s25ToggleRule = function(id, val) {
    const rules = load(LS.rules);
    const r = rules.find(x => x.id === id); if (!r) return;
    r.actif = val; save(LS.rules, rules);
    toast(val ? '✅ Règle activée' : '⏸️ Règle désactivée', 'success');
    renderRulesList();
  };
  window.s25DelRule = async function(id) {
    const ok = await confirmDialog('Supprimer cette règle ?', { titre:'Supprimer la règle', icone:'🧩', btnLabel:'Supprimer' });
    if (!ok) return;
    save(LS.rules, load(LS.rules).filter(r => r.id !== id));
    toast('🗑️ Règle supprimée', 'success');
    renderRulesList();
  };
  window.s25NewRule = function() {
    const scopes = Object.keys(RULE_SCOPES);
    const html = `<div>
      <h3 style="margin:0 0 14px">🔔 Nouvelle règle d'alerte</h3>
      <div class="form-group"><label>Nom de la règle</label><input type="text" id="s25-rule-nom" placeholder="ex. Facture > 5000€ en retard"/></div>
      <div class="form-group"><label>Déclencheur</label><select id="s25-rule-trigger">${scopes.map(k => '<option value="'+k+'">'+RULE_SCOPES[k].label+'</option>').join('')}</select></div>
      <div class="form-group"><label>Champ</label><select id="s25-rule-field"></select></div>
      <div class="form-group"><label>Opérateur</label><select id="s25-rule-op">${Object.keys(OPS).map(o => '<option value="'+o+'">'+o+'</option>').join('')}</select></div>
      <div class="form-group"><label>Valeur</label><input type="text" id="s25-rule-value" placeholder="ex. 5000 ou payée"/></div>
      <div class="form-group"><label>Gravité de l'alerte</label><select id="s25-rule-grav"><option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option></select></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button class="btn-secondary" onclick="window.closeModal && window.closeModal('modal-info');document.getElementById('s15-modal-info')?.classList.remove('open')">Annuler</button>
        <button class="btn-primary" onclick="window.s25SaveRule()">Créer</button>
      </div>
    </div>`;
    if (typeof window.modalInfo === 'function') {
      const m = window.modalInfo(html);
      const b = m?.querySelector?.('.s15-modal-info-box'); if (b) b.classList.add('narrow');
      setTimeout(() => {
        const trig = document.getElementById('s25-rule-trigger');
        const fld = document.getElementById('s25-rule-field');
        function refreshFields() {
          const sc = RULE_SCOPES[trig.value];
          fld.innerHTML = sc.fields.map(f => '<option value="'+f+'">'+f+'</option>').join('');
        }
        trig.addEventListener('change', refreshFields);
        refreshFields();
      }, 40);
    }
  };
  window.s25SaveRule = function() {
    const nom = document.getElementById('s25-rule-nom').value.trim();
    const trigger = document.getElementById('s25-rule-trigger').value;
    const field = document.getElementById('s25-rule-field').value;
    const op = document.getElementById('s25-rule-op').value;
    const value = document.getElementById('s25-rule-value').value.trim();
    const grav = document.getElementById('s25-rule-grav').value;
    if (!nom || !value) { toast('Nom et valeur requis', 'warning'); return; }
    const rules = load(LS.rules);
    rules.push({ id: genId(), nom, trigger, condition: { field, op, value }, graviteOutput: grav, actif: true, dateCreation: new Date().toISOString() });
    save(LS.rules, rules);
    document.getElementById('s15-modal-info')?.classList.remove('open');
    toast('✅ Règle créée et activée', 'success');
    renderRulesList();
  };

  /* ---------- Init ---------- */
  function init() {
    setTimeout(injecterHijack, 800);
    setInterval(injecterHijack, 3000);
    setTimeout(injectRulesUI, 900);
    setInterval(injectRulesUI, 4000);
    // Hook cron S24
    const origTick = window.s24CronTick;
    if (typeof origTick === 'function' && !origTick.__s25Hooked) {
      const wrapped = function() { try { origTick(); } catch(e){} try { evaluerRegles(); } catch(e){} };
      wrapped.__s25Hooked = true;
      window.s24CronTick = wrapped;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1400);
})();

/* ==========================================================================
   Sprint 26 — Timeline globale + Stats comparées + Double-clic inline + Signature BL
   - Timeline consolide factures, livraisons, paiements, avoirs, charges, relances
   - Stats comparées : KPI mini-delta M vs M-1 injectés sur dashboard
   - Double-clic : édition inline sur cellules marquées data-s26-edit
   - Signature BL : toggle Paramètres ; si activé → canvas capture + archivage + audit + PDF
   ========================================================================== */
(function installS26(){
  if (window.__s26Installed) return;
  window.__s26Installed = true;

  const LS = {
    factures: 'factures_emises', livraisons: 'livraisons', paiements: 'paiements',
    avoirs: 'avoirs_emis', charges: 'charges', relances: 'relances_log',
    clients: 'clients', fournisseurs: 'fournisseurs', alertes: 'alertes_admin',
    params: 'params_entreprise', signatures: 's26_signatures_bl', audit: 'audit_log',
  };
  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const loadObj = (k) => { try { return loadSafe(k, {}); } catch(e){ return {}; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = window.escapeHtml;
  const fmtEur = (n) => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR'); };
  const fmtDateTime = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR')+' '+x.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); };
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };
  const audit = (a, d) => { if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit(a, d); };
  const todayISO = () => new Date().toLocalISODate();

  function getOpt(key, def) {
    const p = loadObj(LS.params); const o = p.s26 || {};
    return (o[key] !== undefined) ? !!o[key] : def;
  }
  function setOpt(key, val) {
    const p = loadObj(LS.params); p.s26 = p.s26 || {}; p.s26[key] = !!val; save(LS.params, p);
  }

  /* ================================================================
     BLOC 1 — TIMELINE GLOBALE (filtres acteur/type/date)
     ================================================================ */
  function collectTimelineEvents() {
    const evts = [];
    load(LS.factures).forEach(f => {
      evts.push({ date: f.dateFacture || f.dateCreation, type: 'facture', action: 'Facture émise',
        acteur: f.client||'—', acteurType: 'client',
        details: (f.numero||'')+' · '+fmtEur(f.montantTTC||f.totalTTC||0),
        ref: f.numero, statut: f.statut, icon: '📄', couleur: '#2563eb' });
    });
    load(LS.livraisons).forEach(l => {
      evts.push({ date: l.dateLivraison || l.dateCreation, type: 'livraison', action: 'Livraison '+(l.statut||'créée'),
        acteur: l.client||l.donneurOrdre||'—', acteurType: 'client',
        details: (l.referenceBL||l.bl||'')+' · '+(l.depart||'')+' → '+(l.arrivee||''),
        ref: l.referenceBL||l.id, statut: l.statut, icon: '🚚', couleur: '#16a34a' });
    });
    load(LS.paiements).forEach(p => {
      evts.push({ date: p.datePaiement || p.date, type: 'paiement', action: 'Encaissement',
        acteur: p.client||'—', acteurType: 'client',
        details: fmtEur(p.montant)+(p.mode?' · '+p.mode:''),
        ref: p.reference||p.id, icon: '💰', couleur: '#0891b2' });
    });
    load(LS.avoirs).forEach(a => {
      evts.push({ date: a.dateAvoir || a.dateCreation, type: 'avoir', action: 'Avoir émis',
        acteur: a.client||'—', acteurType: 'client',
        details: (a.numero||'')+' · '+fmtEur(a.montantTTC||0),
        ref: a.numero, icon: '↩️', couleur: '#f59e0b' });
    });
    load(LS.charges).forEach(c => {
      evts.push({ date: c.date || c.dateCreation, type: 'charge', action: 'Charge '+(c.categorie||''),
        acteur: c.fournisseur||'—', acteurType: 'fournisseur',
        details: (c.libelle||'')+' · '+fmtEur(c.montantTTC||c.montant||0),
        ref: c.id, icon: '💸', couleur: '#dc2626' });
    });
    load(LS.relances).forEach(r => {
      evts.push({ date: r.date, type: 'relance', action: 'Relance niv. '+(r.niveau||'1'),
        acteur: r.client||'—', acteurType: 'client',
        details: 'Facture '+(r.facture||'')+(r.canal?' ('+r.canal+')':''),
        ref: r.id, icon: '🔔', couleur: '#7c3aed' });
    });
    return evts
      .filter(e => e.date)
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  const TIMELINE_TYPES = [
    { k: 'facture', lbl: '📄 Factures' },
    { k: 'livraison', lbl: '🚚 Livraisons' },
    { k: 'paiement', lbl: '💰 Paiements' },
    { k: 'avoir', lbl: '↩️ Avoirs' },
    { k: 'charge', lbl: '💸 Charges' },
    { k: 'relance', lbl: '🔔 Relances' },
  ];

  function ouvrirTimelineGlobale() {
    const evts = collectTimelineEvents();
    const today = todayISO();
    const d30 = new Date(Date.now() - 30*86400000).toLocalISODate();
    const acteursUniques = Array.from(new Set(evts.map(e => e.acteur).filter(Boolean))).sort();
    const html = `
      <div class="s15-modal-info-box" style="max-width:1100px;width:96vw;max-height:92vh">
        <div class="s15-modal-info-header">
          <h2>📊 Timeline globale — activité consolidée</h2>
          <button class="btn-close" onclick="document.getElementById('s15-modal-info').classList.remove('open')">✕</button>
        </div>
        <div class="s15-modal-info-body" style="overflow:auto;max-height:calc(92vh - 70px)">
          <div class="s26-timeline-filters">
            <div class="s26-tlf-row">
              <label>Du <input type="date" id="s26-tl-du" value="${d30}"></label>
              <label>Au <input type="date" id="s26-tl-au" value="${today}"></label>
              <label>Acteur
                <select id="s26-tl-acteur">
                  <option value="">Tous</option>
                  ${acteursUniques.map(a => `<option>${esc(a)}</option>`).join('')}
                </select>
              </label>
              <label>Recherche <input type="text" id="s26-tl-search" placeholder="Réf, détail…"></label>
            </div>
            <div class="s26-tlf-types">
              ${TIMELINE_TYPES.map(t => `
                <label class="s26-tl-chip">
                  <input type="checkbox" data-s26-type="${t.k}" checked>
                  <span>${t.lbl}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="s26-timeline-summary" id="s26-tl-summary"></div>
          <div class="s26-timeline-list" id="s26-tl-list"></div>
        </div>
      </div>
    `;
    ouvrirModal(html);
    const refresh = () => renderTimeline(evts);
    document.querySelectorAll('#s26-tl-du, #s26-tl-au, #s26-tl-acteur, #s26-tl-search, [data-s26-type]')
      .forEach(el => el.addEventListener('input', refresh));
    refresh();
  }

  function renderTimeline(allEvts) {
    const du = document.getElementById('s26-tl-du')?.value;
    const au = document.getElementById('s26-tl-au')?.value;
    const acteur = document.getElementById('s26-tl-acteur')?.value || '';
    const search = (document.getElementById('s26-tl-search')?.value||'').toLowerCase();
    const typesActifs = new Set(
      Array.from(document.querySelectorAll('[data-s26-type]:checked')).map(cb => cb.dataset.s26Type)
    );
    const filtered = allEvts.filter(e => {
      const d = (e.date||'').slice(0,10);
      if (du && d < du) return false;
      if (au && d > au) return false;
      if (acteur && e.acteur !== acteur) return false;
      if (!typesActifs.has(e.type)) return false;
      if (search) {
        const hay = (e.action+' '+e.acteur+' '+e.details+' '+(e.ref||'')).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    const summary = document.getElementById('s26-tl-summary');
    if (summary) {
      const parType = {};
      filtered.forEach(e => { parType[e.type] = (parType[e.type]||0)+1; });
      summary.innerHTML = `
        <strong>${filtered.length}</strong> événement${filtered.length>1?'s':''}
        ${Object.entries(parType).map(([k,v]) => {
          const t = TIMELINE_TYPES.find(x => x.k===k);
          return `<span class="s26-tl-pill">${t?t.lbl:k} : ${v}</span>`;
        }).join('')}
      `;
    }
    const list = document.getElementById('s26-tl-list');
    if (!list) return;
    if (!filtered.length) {
      list.innerHTML = '<div class="s26-tl-empty">Aucun événement sur la période / les filtres choisis.</div>';
      return;
    }
    let grp = {};
    filtered.forEach(e => {
      const d = (e.date||'').slice(0,10);
      (grp[d] = grp[d] || []).push(e);
    });
    list.innerHTML = Object.entries(grp).map(([d, items]) => `
      <div class="s26-tl-day">
        <div class="s26-tl-date">${fmtDate(d)}</div>
        <div class="s26-tl-events">
          ${items.map(e => `
            <div class="s26-tl-evt" style="border-left-color:${e.couleur}">
              <div class="s26-tl-evt-icon">${e.icon}</div>
              <div class="s26-tl-evt-body">
                <div class="s26-tl-evt-head">
                  <strong>${esc(e.action)}</strong>
                  <span class="s26-tl-evt-acteur">${esc(e.acteur)}</span>
                  ${e.statut ? `<span class="s26-tl-evt-statut">${esc(e.statut)}</span>` : ''}
                </div>
                <div class="s26-tl-evt-details">${esc(e.details)}</div>
                ${e.ref ? `<div class="s26-tl-evt-ref">Réf : ${esc(e.ref)}</div>` : ''}
              </div>
              <div class="s26-tl-evt-time">${fmtDateTime(e.date).split(' ').slice(1).join(' ')||''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function ouvrirModal(html) {
    if (typeof window.modalInfo === 'function') {
      const m = window.modalInfo(html);
      // window.modalInfo wraps html in .s15-modal-info-body ; our html already provides its own box
      // so we override the inner structure:
      m.innerHTML = html;
      // re-bind close + backdrop
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }, { once: true });
      m.querySelectorAll('.btn-close, .s15-modal-info-close').forEach(btn => {
        btn.addEventListener('click', () => m.classList.remove('open'));
      });
      return m;
    }
    let m = document.getElementById('s15-modal-info');
    if (!m) {
      m = document.createElement('div');
      m.id = 's15-modal-info';
      m.className = 's15-modal-info-overlay';
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('open')) m.classList.remove('open'); });
    } else {
      m.className = 's15-modal-info-overlay';
    }
    m.innerHTML = html;
    m.querySelectorAll('.btn-close, .s15-modal-info-close').forEach(btn => {
      btn.addEventListener('click', () => m.classList.remove('open'));
    });
    m.classList.add('open');
    return m;
  }

  window.ouvrirTimelineGlobale = ouvrirTimelineGlobale;

  /* ================================================================
     BLOC 3 — DOUBLE-CLIC INLINE EDIT
     ================================================================ */
  function onDblClickCell(e) {
    const cell = e.target.closest('[data-s26-edit]');
    if (!cell) return;
    if (cell.querySelector('input, select, textarea')) return;
    const kind = cell.dataset.s26Edit; // 'text' | 'number' | 'date' | 'select'
    const orig = cell.textContent.trim();
    const raw = cell.dataset.s26Value != null ? cell.dataset.s26Value : orig;
    const saveFn = cell.dataset.s26Save; // name of global fn (id, newVal, cell) => bool
    let input;
    if (kind === 'select') {
      input = document.createElement('select');
      const opts = (cell.dataset.s26Options||'').split('|');
      opts.forEach(o => {
        const op = document.createElement('option');
        op.value = o; op.textContent = o;
        if (o === raw) op.selected = true;
        input.appendChild(op);
      });
    } else {
      input = document.createElement('input');
      input.type = kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text';
      if (kind === 'number') input.step = '0.01';
      input.value = raw;
    }
    input.className = 's26-inline-edit';
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    if (input.select) input.select();
    const commit = () => {
      const nv = input.value.trim();
      if (nv === raw) { cell.textContent = orig; return; }
      const id = cell.dataset.s26Id;
      const fn = saveFn && window[saveFn];
      let ok = false;
      if (typeof fn === 'function') {
        try { ok = !!fn(id, nv, cell); } catch(err) { console.warn('S26 inline save', err); }
      }
      if (ok) {
        cell.dataset.s26Value = nv;
        cell.textContent = nv;
        toast('✏️ Modifié', 'success');
        audit('edit_inline', { cell: cell.dataset.s26Field||'', id, nv });
      } else {
        cell.textContent = orig;
        toast('❌ Modification refusée', 'warning');
      }
    };
    const cancel = () => { cell.textContent = orig; };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); input.removeEventListener('blur', commit); cancel(); }
    });
  }

  // Savers de base pour les entités courantes
  window.s26SaveFactureMontant = function(id, nv) {
    const arr = load(LS.factures);
    const i = arr.findIndex(f => String(f.id)===String(id) || f.numero===id);
    if (i<0) return false;
    const n = parseFloat(nv); if (isNaN(n) || n < 0) return false;
    arr[i].montantTTC = n;
    save(LS.factures, arr);
    return true;
  };
  window.s26SaveFactureStatut = function(id, nv) {
    const arr = load(LS.factures);
    const i = arr.findIndex(f => String(f.id)===String(id) || f.numero===id);
    if (i<0) return false;
    arr[i].statut = nv;
    save(LS.factures, arr);
    return true;
  };
  window.s26SaveFactureEcheance = function(id, nv) {
    const arr = load(LS.factures);
    const i = arr.findIndex(f => String(f.id)===String(id) || f.numero===id);
    if (i<0) return false;
    arr[i].dateEcheance = nv;
    save(LS.factures, arr);
    return true;
  };
  window.s26SaveLivraisonStatut = function(id, nv) {
    const arr = load(LS.livraisons);
    const i = arr.findIndex(l => String(l.id)===String(id) || l.referenceBL===id);
    if (i<0) return false;
    arr[i].statut = nv;
    save(LS.livraisons, arr);
    return true;
  };

  /* ================================================================
     BLOC 4 — SIGNATURE BL (canvas, toggle Paramètres, automatisations)
     ================================================================ */
  function signatureActive() { return getOpt('signature_bl', false); }

  function ouvrirSignatureBL(livraisonId) {
    if (!signatureActive()) { toast('Signature désactivée dans Paramètres', 'warning'); return; }
    const liv = load(LS.livraisons).find(l => String(l.id)===String(livraisonId) || l.referenceBL===livraisonId);
    if (!liv) { toast('Livraison introuvable', 'error'); return; }
    const existing = load(LS.signatures).find(s => s.livraisonId === liv.id);
    const html = `
      <div class="s15-modal-info-box narrow" style="max-width:560px">
        <div class="s15-modal-info-header">
          <h2>✍️ Signature BL ${esc(liv.numLiv||liv.referenceBL||liv.id)}</h2>
          <button class="btn-close" onclick="document.getElementById('s15-modal-info').classList.remove('open')">✕</button>
        </div>
        <div class="s15-modal-info-body">
          <p style="font-size:.88rem;color:var(--text-muted);margin-bottom:10px">
            Destinataire : <strong>${esc(liv.client||liv.donneurOrdre||'—')}</strong><br>
            ${liv.arrivee ? 'Lieu : '+esc(liv.arrivee)+'<br>' : ''}
            Signataire requis : nom et prénom puis signature au stylet / doigt.
          </p>
          <label>Nom du signataire
            <input type="text" id="s26-sig-nom" value="${esc(existing?.signataire||'')}" placeholder="NOM Prénom">
          </label>
          <label>Qualité (optionnel)
            <input type="text" id="s26-sig-qualite" value="${esc(existing?.qualite||'')}" placeholder="Chef de dépôt, réceptionniste…">
          </label>
          <div class="s26-sig-canvas-wrap">
            <canvas id="s26-sig-canvas" width="500" height="180"></canvas>
            <div class="s26-sig-canvas-hint">Signez ci-dessus</div>
          </div>
          <div class="s26-sig-actions">
            <button class="btn btn-ghost" onclick="window.s26EffacerSig()">🗑️ Effacer</button>
            <button class="btn btn-primary" onclick="window.s26EnregistrerSig('${esc(liv.id)}')">✅ Valider & archiver</button>
          </div>
          ${existing ? `<div class="s26-sig-meta">Déjà signée le ${fmtDateTime(existing.date)} par ${esc(existing.signataire||'')}</div>` : ''}
        </div>
      </div>
    `;
    ouvrirModal(html);
    setTimeout(() => {
      initCanvas();
      if (existing?.dataUrl) restoreCanvas(existing.dataUrl);
    }, 50);
  }
  window.ouvrirSignatureBL = ouvrirSignatureBL;

  let sigCtx = null, sigDrawing = false, sigEmpty = true;
  function initCanvas() {
    const c = document.getElementById('s26-sig-canvas');
    if (!c) return;
    sigCtx = c.getContext('2d');
    sigCtx.lineWidth = 2.2; sigCtx.lineCap = 'round'; sigCtx.strokeStyle = '#111';
    sigEmpty = true;
    const pos = ev => {
      const r = c.getBoundingClientRect();
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      return { x: x * (c.width/r.width), y: y * (c.height/r.height) };
    };
    const start = ev => { ev.preventDefault(); sigDrawing = true; sigEmpty = false; const p = pos(ev); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
    const move = ev => { if (!sigDrawing) return; ev.preventDefault(); const p = pos(ev); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
    const end = () => { sigDrawing = false; };
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move); c.addEventListener('mouseup', end); c.addEventListener('mouseleave', end);
    c.addEventListener('touchstart', start); c.addEventListener('touchmove', move); c.addEventListener('touchend', end);
  }
  function restoreCanvas(dataUrl) {
    const c = document.getElementById('s26-sig-canvas');
    if (!c || !sigCtx) return;
    const img = new Image();
    img.onload = () => { sigCtx.drawImage(img, 0, 0, c.width, c.height); sigEmpty = false; };
    img.src = dataUrl;
  }
  window.s26EffacerSig = function() {
    const c = document.getElementById('s26-sig-canvas');
    if (!c || !sigCtx) return;
    sigCtx.clearRect(0, 0, c.width, c.height);
    sigEmpty = true;
  };
  // Hash SHA-256 hex (Web Crypto) — BUG-039
  async function sha256Hex(str) {
    try {
      const buf = new TextEncoder().encode(String(str||''));
      const dig = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch (e) { return ''; }
  }
  // Compression canvas → WebP 0.6 (BUG-042) — fallback JPEG puis PNG
  function canvasVersDataUrlCompresse(canvas) {
    return new Promise((resolve) => {
      try {
        if (canvas.toBlob) {
          canvas.toBlob((blob) => {
            if (!blob) { resolve(canvas.toDataURL('image/png')); return; }
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => resolve(canvas.toDataURL('image/png'));
            r.readAsDataURL(blob);
          }, 'image/webp', 0.6);
        } else {
          try { resolve(canvas.toDataURL('image/webp', 0.6)); }
          catch(_) { resolve(canvas.toDataURL('image/jpeg', 0.7)); }
        }
      } catch(_) { resolve(canvas.toDataURL('image/png')); }
    });
  }

  window.s26EnregistrerSig = async function(livId) {
    const nom = (document.getElementById('s26-sig-nom')?.value||'').trim();
    const qualite = (document.getElementById('s26-sig-qualite')?.value||'').trim();
    const c = document.getElementById('s26-sig-canvas');
    if (!nom) { toast('Nom du signataire requis', 'warning'); return; }
    if (sigEmpty) { toast('Signature manquante', 'warning'); return; }
    // BUG-042 : compression (WebP 0.6 → ~3-8 Ko vs 30-60 Ko PNG)
    const dataUrl = await canvasVersDataUrlCompresse(c);
    const sigs = load(LS.signatures);
    const idx = sigs.findIndex(s => s.livraisonId === livId);
    // BUG-039 : preuve infalsifiable (eIDAS + art. 1366 CC)
    // — snapshot de la livraison signée (preuve WHAT)
    // — hash SHA-256 du snapshot (preuve INTEGRITY)
    // — chaînage avec la signature précédente (preuve ORDER — horodatage immutable)
    const livs0 = load(LS.livraisons);
    const livSnap = livs0.find(l => String(l.id)===String(livId)) || { id: livId };
    const snapshotStr = JSON.stringify(livSnap);
    const documentHash = await sha256Hex(snapshotStr);
    const precedente = sigs.length ? sigs[sigs.length-1] : null;
    const previousHash = precedente ? (precedente.chainHash || '') : '';
    const date = new Date().toISOString();
    const chainPayload = [documentHash, previousHash, nom, qualite, date].join('|');
    const chainHash = await sha256Hex(chainPayload);
    const entry = {
      id: (typeof window.genId === 'function' ? window.genId() : 's26_sig_' + Date.now()),
      livraisonId: livId,
      signataire: nom, qualite, dataUrl,
      date,
      userAgent: navigator.userAgent.slice(0,80),
      documentSnapshot: snapshotStr,
      documentHash,
      previousHash,
      chainHash,
      hashAlgo: 'SHA-256',
      chainVersion: 1
    };
    if (idx >= 0) sigs[idx] = entry; else sigs.push(entry);
    save(LS.signatures, sigs);
    // Automatisations : met la livraison en livré, horodate, audit, alerte admin si config
    const livs = load(LS.livraisons);
    const li = livs.findIndex(l => String(l.id)===String(livId));
    if (li >= 0) {
      livs[li].statut = 'livré';
      livs[li].dateLivraisonEffective = new Date().toISOString();
      livs[li].signatureId = entry.id;
      livs[li].signataireNom = nom;
      livs[li].signatureDocumentHash = documentHash;
      save(LS.livraisons, livs);
    }
    audit('signature_bl', { livraisonId: livId, signataire: nom, qualite, horodatage: entry.date, documentHash, chainHash });
    toast('✅ Signature archivée & livraison clôturée', 'success');
    document.getElementById('s15-modal-info')?.classList.remove('open');
    if (typeof window.afficherLivraisons === 'function') try { window.afficherLivraisons(); } catch(e){}
    if (typeof window.s24CronTick === 'function') try { window.s24CronTick(); } catch(e){}
  };

  // Vérification d'intégrité de la chaîne (BUG-039) — utilisable pour audit / support
  window.s26VerifierChaineSignatures = async function() {
    const sigs = load(LS.signatures);
    const resultats = [];
    let prevHash = '';
    for (const s of sigs) {
      if (!s.chainHash) { resultats.push({ id:s.id, ok:false, raison:'Signature pré-BUG-039 (pas de hash)' }); prevHash = ''; continue; }
      if ((s.previousHash||'') !== prevHash) {
        resultats.push({ id:s.id, ok:false, raison:'Chaînage rompu (previousHash inattendu)' });
      } else {
        const recomputed = await sha256Hex([s.documentHash, s.previousHash, s.signataire, s.qualite, s.date].join('|'));
        resultats.push({ id:s.id, ok: recomputed === s.chainHash, raison: recomputed === s.chainHash ? 'OK' : 'chainHash ne correspond pas au contenu (falsification probable)' });
      }
      prevHash = s.chainHash;
    }
    return resultats;
  };

  // Injecte bouton Signer sur les drawers/livraisons si activé
  function injecterBoutonSignature() {
    if (!signatureActive()) return;
    document.querySelectorAll('[data-livraison-id]:not(.__s26SigBtn)').forEach(el => {
      const id = el.dataset.livraisonId;
      if (!id) return;
      el.classList.add('__s26SigBtn');
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost s26-btn-sig';
      btn.innerHTML = '✍️ Signer';
      btn.onclick = (e) => { e.stopPropagation(); ouvrirSignatureBL(id); };
      el.appendChild(btn);
    });
  }

  /* ================================================================
     BLOC 5 — PARAMÈTRES : section S26
     ================================================================ */
  function injectParamsUI() {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    if (page.querySelector('#s26-params-section')) return;
    const container = page.querySelector('.settings-content') || page;
    const section = document.createElement('div');
    section.id = 's26-params-section';
    section.className = 'settings-section';
    section.innerHTML = `
      <h2 style="margin-top:32px">📋 Pilotage & Traçabilité</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">
        Outils de vision transverse et options de capture.
      </p>
      <div class="s26-params-actions">
        <button class="btn btn-primary" onclick="window.ouvrirTimelineGlobale()">📊 Ouvrir la Timeline globale</button>
      </div>
      <h3 style="margin-top:24px">✍️ Signature BL sur tablette / mobile</h3>
      <p style="color:var(--text-muted);font-size:.88rem">Capture d'une signature manuscrite au moment de la livraison.</p>
      <div class="s26-toggles">
        ${renderToggle('signature_bl', '✍️ Signature BL (canvas)', 'Bouton Signer sur chaque livraison. À la validation : clôture auto + archive horodatée.', false)}
        ${renderToggle('signature_obligatoire', '🔒 Signature obligatoire pour clôturer', 'Bloque le passage au statut livré sans signature capturée.', false)}
      </div>
    `;
    container.appendChild(section);
    section.querySelectorAll('input[type=checkbox][data-s26-key]').forEach(cb => {
      cb.addEventListener('change', () => {
        setOpt(cb.dataset.s26Key, cb.checked);
        toast(cb.checked ? '✅ Activé : '+cb.dataset.s26Label : '⏸️ Désactivé : '+cb.dataset.s26Label, 'success');
        if (cb.dataset.s26Key === 'signature_bl' && cb.checked) injecterBoutonSignature();
      });
    });
  }
  function renderToggle(key, label, desc, def) {
    const val = getOpt(key, def);
    return `<label class="s24-toggle">
      <input type="checkbox" data-s26-key="${key}" data-s26-label="${label}" ${val?'checked':''} />
      <span class="s24-toggle-switch"></span>
      <span class="s24-toggle-body"><strong>${label}</strong><br><small>${desc}</small></span>
    </label>`;
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    document.addEventListener('dblclick', onDblClickCell);
    injectParamsUI();
    injecterBoutonSignature();
    // PERF: anciens setInterval injectParamsUI 4s + injecterBoutonSignature 2.5s
    // remplacés par MutationObserver — ne re-injecte que si le DOM mute vraiment
    const reinjectObs = new MutationObserver(() => {
      if (!document.getElementById('s26-params-card')) injectParamsUI();
      injecterBoutonSignature();
    });
    reinjectObs.observe(document.body, { childList: true, subtree: true });
  }
  window.__s26InitDashboard = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else Promise.resolve().then(init);
})();

/* ==========================================================================
   Sprint 28 — Bugs critiques & cleanup
   1. Extension drawer 360° à tous les onglets (liv, fact, paie, charges)
   2. MutationObserver pour re-injection instantanée dans Paramètres
   3. Bouton Signature BL sur rows page Livraisons (+ action inline)
   4. Nettoyage encarts légaux pédagogiques (centralisation Conformité)
   5. Amélioration visuelle drawer tabs (scroll fluide)
   ========================================================================== */
(function installS28(){
  if (window.__s28Installed) return;
  window.__s28Installed = true;

  const load = (k) => { try { return loadSafe(k, []); } catch(e){ return []; } };
  const loadObj = (k) => { try { return loadSafe(k, {}); } catch(e){ return {}; } };
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };

  /* ---------- 1. Extension drawer 360° à tous les onglets ---------- */
  function findClientByName(nom) {
    if (!nom) return null;
    const k = nom.trim().toLowerCase();
    return load('clients').find(c => (c.nom||'').trim().toLowerCase() === k) || null;
  }
  function findFournByName(nom) {
    if (!nom) return null;
    const k = nom.trim().toLowerCase();
    return load('fournisseurs').find(f => (f.nom||'').trim().toLowerCase() === k) || null;
  }

  // Délégation clic global : tout élément avec data-client-open ou data-fourn-open ouvre drawer
  document.addEventListener('click', function(e) {
    const cel = e.target.closest('[data-s28-client]');
    const fel = e.target.closest('[data-s28-fourn]');
    if (cel && typeof window.ouvrirFiche360Client === 'function') {
      e.preventDefault(); e.stopPropagation();
      const id = cel.dataset.s28Client;
      window.ouvrirFiche360Client(id);
      return;
    }
    if (fel && typeof window.ouvrirFiche360Fournisseur === 'function') {
      e.preventDefault(); e.stopPropagation();
      const id = fel.dataset.s28Fourn;
      window.ouvrirFiche360Fournisseur(id);
      return;
    }
  }, true);

  // Injection attribut data-s28-client sur les cellules nom client dans toutes les tables
  function hookClientCells() {
    // Table Livraisons (colonne client)
    const tbLiv = document.getElementById('tb-livraisons');
    const tbLivR = document.getElementById('tb-livraisons-recentes');
    [tbLiv, tbLivR].forEach(tb => {
      if (!tb) return;
      tb.querySelectorAll('tr').forEach(tr => {
        if (tr.__s28ClientHook) return;
        // Chercher cellule avec un nom client
        const tds = tr.querySelectorAll('td');
        tds.forEach(td => {
          const txt = (td.textContent||'').trim();
          if (!txt || txt === '—' || td.querySelector('select, input, button')) return;
          const c = findClientByName(txt);
          if (c) {
            td.setAttribute('data-s28-client', c.id);
            td.style.cursor = 'pointer';
            td.title = '👤 Ouvrir fiche client 360°';
            td.classList.add('s28-link-cell');
          }
        });
        tr.__s28ClientHook = true;
      });
    });
    // Table Factures émises
    const tbFact = document.getElementById('tb-factures');
    if (tbFact) {
      tbFact.querySelectorAll('tr').forEach(tr => {
        if (tr.__s28ClientHook) return;
        tr.querySelectorAll('td').forEach(td => {
          const txt = (td.textContent||'').trim();
          if (!txt || txt === '—' || td.querySelector('select, input, button')) return;
          const c = findClientByName(txt);
          if (c) {
            td.setAttribute('data-s28-client', c.id);
            td.style.cursor = 'pointer';
            td.title = '👤 Ouvrir fiche client 360°';
            td.classList.add('s28-link-cell');
          }
        });
        tr.__s28ClientHook = true;
      });
    }
    // Charges → fournisseur
    const tbCh = document.getElementById('tb-charges');
    if (tbCh) {
      tbCh.querySelectorAll('tr').forEach(tr => {
        if (tr.__s28FournHook) return;
        tr.querySelectorAll('td').forEach(td => {
          const txt = (td.textContent||'').trim();
          if (!txt || txt === '—' || td.querySelector('select, input, button')) return;
          const f = findFournByName(txt);
          if (f) {
            td.setAttribute('data-s28-fourn', f.id);
            td.style.cursor = 'pointer';
            td.title = '🏭 Ouvrir fiche fournisseur 360°';
            td.classList.add('s28-link-cell');
          }
        });
        tr.__s28FournHook = true;
      });
    }
  }

  /* ---------- 2. Bouton Signature BL sur rows livraisons ---------- */
  function signatureActive() {
    const p = loadObj('params_entreprise');
    const o = p.s26 || {};
    return !!o.signature_bl;
  }

  function hookSignatureLivraisons() {
    if (!signatureActive()) return;
    const tbLiv = document.getElementById('tb-livraisons');
    if (!tbLiv) return;
    tbLiv.querySelectorAll('tr').forEach(tr => {
      if (tr.__s28SigHook) return;
      // Cherche l'ID de la livraison dans la ligne
      const editBtn = tr.querySelector('button[onclick*="ouvrirEditLivraison"], button[onclick*="modifierLivraison"]');
      let livId = null;
      if (editBtn) {
        const m = editBtn.getAttribute('onclick').match(/['"]([a-zA-Z0-9_-]+)['"]/);
        if (m) livId = m[1];
      }
      if (!livId) {
        const anyBtn = tr.querySelector('button[onclick*="supprimerLivraison"], button[onclick*="imprimer"]');
        if (anyBtn) {
          const m = anyBtn.getAttribute('onclick').match(/['"]([a-zA-Z0-9_-]+)['"]/);
          if (m) livId = m[1];
        }
      }
      if (!livId) return;
      // Chercher le menu dropdown Actions (S27 pattern .inline-dropdown-menu)
      const menu = tr.querySelector('.inline-dropdown-menu');
      if (!menu) return;
      if (menu.querySelector('.s28-sig-item')) return;
      // Vérifier si déjà signée
      const sigs = load('s26_signatures_bl');
      const hasSig = sigs.some(s => String(s.livraisonId) === String(livId));
      // Créer un item cohérent avec la classe inline-dropdown-item
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'inline-dropdown-item s28-sig-item';
      item.innerHTML = (hasSig ? '✅ ' : '✍️ ') + (hasSig ? 'Voir signature BL' : 'Signer BL');
      item.title = hasSig ? 'Signature déjà archivée — ouvrir' : 'Capturer la signature du destinataire';
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.fermerInlineDropdowns === 'function') window.fermerInlineDropdowns();
        window.ouvrirSignatureBL(livId);
      });
      // Insérer en haut du menu (avant Modifier)
      menu.insertBefore(item, menu.firstChild);
      tr.__s28SigHook = true;
    });
  }

  /* ---------- 3. Garde anti-overlay résiduel (fix écran noir Paramètres) ---------- */
  // Si un modal .s15-modal-info-overlay reste en .open sans contenu visible
  // (peut arriver après écriture storage/re-render), on le ferme proprement.
  function gardeOverlay() {
    const m = document.getElementById('s15-modal-info');
    if (!m) return;
    if (!m.classList.contains('open')) return;
    const box = m.querySelector('.s15-modal-info-box, .s15-modal-info-body');
    const visible = box && box.offsetParent !== null && (box.textContent||'').trim().length > 0;
    if (!visible) m.classList.remove('open');
  }

  /* ---------- 4. Scan permanent ---------- */
  function tick() {
    hookClientCells();
    hookSignatureLivraisons();
    gardeOverlay();
  }

  function init() {
    setTimeout(tick, 1200);
    setInterval(tick, 2000);
    // Re-hook quand on change de page
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-page], .nav-item');
      if (navBtn) setTimeout(tick, 300);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1700);
})();

/* ==========================================================================
   Sprint 29 — Refonte Paramètres pro
   - Sidebar interne 8 sections (Entreprise, Facturation, Comptabilité,
     Transport, Automatisations, Sécurité & RGPD, Conformité, À propos)
   - Recherche live (Ctrl + /) qui filtre les cartes
   - Catégorisation auto des cartes existantes (par titre h2)
   - Section Conformité = seul endroit légal centralisé (RGPD / FEC / eIDAS /
     CMR / archivage), regroupe aussi pack fiscal S27 + signature BL S26
   - Mémorisation section active (localStorage : s29_section_active)
   ========================================================================== */
(function installS29(){
  if (window.__s29Installed) return;
  window.__s29Installed = true;

  const LS_SECTION = 's29_section_active';
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };

  const SECTIONS = [
    { id:'entreprise',    icon:'🏢', label:'Entreprise',      desc:'Identité, logo, postes' },
    { id:'comptabilite',  icon:'📊', label:'Comptabilité',    desc:'Délégation Pennylane (facturation, FEC, compta)' },
    { id:'transport',     icon:'🚚', label:'Transport',       desc:'Règles calculs, livraison' },
    { id:'automatisations', icon:'⚙️', label:'Automatisations', desc:'Cron, rappels, clôtures' },
    { id:'securite',      icon:'🔐', label:'Sécurité & RGPD', desc:'Mot de passe, sessions, audit' },
    { id:'conformite',    icon:'📋', label:'Conformité',      desc:'RGPD, transport, obligations légales' },
    { id:'apropos',       icon:'ℹ️', label:'À propos',        desc:'Version, support, mentions' },
  ];

  /* ---------- Catégorisation automatique par titre h2 ---------- */
  function categoriseCard(card) {
    if (card.dataset.s29Section) return card.dataset.s29Section;
    const h2 = card.querySelector('.card-header h2, h2');
    const title = h2 ? (h2.textContent||'').toLowerCase() : '';
    if (/entreprise|identit|poste|apparence|th[eè]me|logo/.test(title)) return 'entreprise';
    if (/tva|fiscalit|trésorerie|num[eé]rotation|facture|facturation/.test(title)) return 'facturation';
    if (/comptab|exercice|pcg|factur-x|amortis/.test(title)) return 'comptabilite';
    if (/transport|livraison|heure|km|cmr|lettre de voiture/.test(title)) return 'transport';
    if (/automatisation|cron|rappel|pilotage|tra[cç]abilit/.test(title)) return 'automatisations';
    if (/mot de passe|blocage|session|journal|audit|sauvegarde|restauration|s[eé]curit|rgpd/.test(title)) return 'securite';
    if (/conformit|pack fiscal|eidas|fec|signature bl|rgpd|mentions/.test(title)) return 'conformite';
    return 'entreprise'; // fallback
  }

  /* ---------- Encart Conformité centralisé ---------- */
  function buildConformiteCard() {
    const card = document.createElement('div');
    card.className = 'card params-card-wide s29-conformite-card';
    card.dataset.s29Section = 'conformite';
    card.innerHTML = `
      <div class="card-header"><h2>📋 Conformité & obligations légales</h2></div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:18px">
          Tableau de bord centralisé des obligations légales françaises applicables à votre activité transport/logistique.
          Cette page remplace les encarts pédagogiques éparpillés dans l'app.
        </p>
        <div class="s29-conformite-grid">
          <div class="s29-conf-item">
            <div class="s29-conf-title">🗄️ Archivage documents (Code de commerce art. L123-22 / CGI art. L102 B)</div>
            <ul class="s29-conf-list">
              <li><strong>Factures émises & reçues :</strong> 10 ans (support numérique ou papier)</li>
              <li><strong>Pièces comptables (livre journal, grand livre) :</strong> 10 ans</li>
              <li><strong>Bulletins de paie :</strong> 5 ans (50 ans côté salarié)</li>
              <li><strong>Contrats commerciaux :</strong> 5 ans après fin du contrat</li>
              <li><strong>Lettres de voiture (CMR, BL) :</strong> 5 ans (Code des transports art. L3222-1)</li>
              <li><strong>Journal d'audit des actions :</strong> 6 ans (preuve fiscale)</li>
            </ul>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">📘 Fichier des Écritures Comptables — FEC (CGI art. A47 A-1)</div>
            <p>Format normé 18 colonnes, obligatoire en cas de contrôle fiscal pour toute entreprise soumise à TVA.
            Le FEC officiel est produit par Pennylane depuis ses données comptables complètes. Ne pas produire un FEC depuis MCA Logistics :
            il serait incomplet (MCA n'ayant plus les factures) et risquerait un conflit avec la comptabilité officielle.</p>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">✍️ Signature électronique BL (Règlement eIDAS n°910/2014)</div>
            <p>La signature capturée via canvas tactile est une <strong>signature électronique simple</strong>.
            Elle constitue un commencement de preuve par écrit (art. 1366 C. civ.) mais sa valeur probante
            repose sur le faisceau d'indices : horodatage, IP, user-agent, hash du document associé.
            Pour une valeur probante renforcée, prévoir un prestataire de service de confiance qualifié (PSCo).</p>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">🛡️ RGPD — Règlement UE 2016/679</div>
            <ul class="s29-conf-list">
              <li><strong>Registre des traitements :</strong> art. 30 RGPD, obligatoire dès le premier salarié</li>
              <li><strong>Consentement signature/géoloc :</strong> à recueillir lors de la collecte (base légale)</li>
              <li><strong>Droit d'accès, rectification, effacement :</strong> procédure à documenter</li>
              <li><strong>DPO :</strong> obligatoire si traitement à grande échelle ou données sensibles</li>
              <li><strong>localStorage :</strong> aucun cookie de tracking dans cette app — consentement non requis</li>
            </ul>
            <button class="btn-secondary" onclick="genererRegistreRGPD()" style="margin-top:10px">📖 Générer le registre des traitements (art. 30)</button>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">👥 DSN — Déclaration Sociale Nominative</div>
            <ul class="s29-conf-list">
              <li><strong>Obligation :</strong> mensuelle dès le 1er salarié (net-entreprises.fr)</li>
              <li><strong>Périmètre :</strong> contrats, rémunérations, cotisations, arrêts, fins de contrat</li>
              <li><strong>Outillage MCA :</strong> non produite côté MCA. Transmission via votre logiciel de paie (Pennylane Paie, Silae, Payfit…) à partir de la base salariés MCA + bulletins du prestataire.</li>
            </ul>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">🚚 Transport routier (Code des transports)</div>
            <ul class="s29-conf-list">
              <li><strong>Lettre de voiture :</strong> obligatoire pour tout transport rémunéré (art. L3222-1)</li>
              <li><strong>CMR :</strong> convention applicable dès qu'il y a transport international</li>
              <li><strong>Temps de conduite/repos :</strong> Règlement CE 561/2006 (à tracer pour contrôles)</li>
              <li><strong>Contrats-types :</strong> décrets spécifiques selon type de marchandises</li>
            </ul>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">🧾 Réforme de la facturation électronique</div>
            <p>Généralisation de la facture électronique B2B en France : <strong>obligation de réception dès septembre 2026</strong>
            pour toutes les entreprises, obligation d'émission progressive jusqu'à septembre 2027.
            Format structuré attendu : Factur-X (PDF/A-3 + XML CII), UBL ou CII. Plateforme de dématérialisation partenaire (PDP) requise.
            MCA Logistics émet vos factures PDF avec mentions obligatoires CGI 242 nonies A complètes (forme juridique, RCS, capital, conditions de règlement, pénalités L441-10, indemnité 40 € D441-5).
            La transmission au format Factur-X est déléguée à votre logiciel comptable (Pennylane et autres PDP agréées DGFiP).</p>
          </div>
        </div>
        <div class="s29-conf-actions">
          <button class="btn btn-primary" onclick="window.ouvrirPackFiscal && window.ouvrirPackFiscal()">📦 Générer le pack fiscal (ZIP)</button>
          <button class="btn btn-ghost" onclick="window.ouvrirTimelineGlobale && window.ouvrirTimelineGlobale()">📊 Ouvrir la timeline d'audit</button>
        </div>
      </div>
    `;
    return card;
  }

  /* ---------- Encart À propos ---------- */
  function buildAproposCard() {
    const card = document.createElement('div');
    card.className = 'card s29-apropos-card';
    card.dataset.s29Section = 'apropos';
    card.innerHTML = `
      <div class="card-header"><h2>ℹ️ À propos de MCA Logistics</h2></div>
      <div class="modal-body">
        <p style="font-size:.92rem;margin-bottom:10px"><strong>MCA Logistics</strong> — ERP transport & logistique</p>
        <ul class="s29-apropos-list">
          <li><strong>Version :</strong> 29.0 (Sprint 29 — Paramètres pro)</li>
          <li><strong>Stockage :</strong> 100% local (localStorage) — aucune donnée envoyée</li>
          <li><strong>Synchronisation optionnelle :</strong> Supabase (désactivable)</li>
          <li><strong>Licence :</strong> Propriétaire — usage interne uniquement</li>
        </ul>
        <p style="font-size:.82rem;color:var(--text-muted);margin-top:14px">
          Support & documentation : contactez l'administrateur de votre instance.
        </p>
      </div>
    `;
    return card;
  }

  /* ---------- Encart Transport placeholder ---------- */
  function buildTransportCard() {
    const card = document.createElement('div');
    card.className = 'card s29-transport-card';
    card.dataset.s29Section = 'transport';
    card.innerHTML = `
      <div class="card-header"><h2>🚚 Règles transport & livraison</h2></div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:14px">
          Les règles de calcul (heures, km, indemnités) sont pilotées depuis les onglets Heures, KM et Chauffeurs.
          Les options de livraison (signature BL, clôture auto) sont dans Automatisations et Pilotage.
        </p>
        <ul class="s29-apropos-list">
          <li>Barème kilométrique → onglet <strong>Compteur KM</strong></li>
          <li>Temps de conduite → onglet <strong>Compteur heures</strong></li>
          <li>Lettre de voiture → généré à l'émission du BL</li>
        </ul>
      </div>
    `;
    return card;
  }

  /* ---------- Encart Comptabilité placeholder ---------- */
  function buildComptaCard() {
    const card = document.createElement('div');
    card.className = 'card s29-compta-card';
    card.dataset.s29Section = 'comptabilite';
    card.innerHTML = `
      <div class="card-header"><h2>📊 Comptabilité (déléguée)</h2></div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:14px">
          MCA Logistics se concentre sur l'opérationnel transport.
          La comptabilité complète — facturation, encaissements, TVA, amortissements,
          clôture d'exercice, FEC, Factur-X — est gérée par votre logiciel comptable
          (Pennylane ou PDP agréée DGFiP).
        </p>
        <ul class="s29-apropos-list">
          <li>Export des charges → onglet <strong>Charges</strong> (CSV pour import Pennylane)</li>
          <li>Livraisons exportables en CSV (base pour réconciliation Pennylane)</li>
          <li>Données entreprise synchronisées (SIRET, TVA intracom, RCS, capital)</li>
        </ul>
      </div>
    `;
    return card;
  }

  /* ---------- Refonte DOM : wrap params-grid dans sidebar + content ---------- */
  function buildShell(page) {
    if (page.querySelector('.s29-shell')) return null;
    const grid = page.querySelector('.params-grid');
    if (!grid) return null;

    const shell = document.createElement('div');
    shell.className = 's29-shell';

    const sidebar = document.createElement('aside');
    sidebar.className = 's29-sidebar';
    sidebar.innerHTML = `
      <div class="s29-search-wrap">
        <input type="text" class="s29-search" placeholder="🔍 Rechercher (Ctrl + /)…" autocomplete="off" />
      </div>
      <nav class="s29-nav">
        ${SECTIONS.map(s => `
          <button type="button" class="s29-nav-item" data-s29-target="${s.id}">
            <span class="s29-nav-icon">${s.icon}</span>
            <span class="s29-nav-body">
              <strong>${s.label}</strong>
              <small>${s.desc}</small>
            </span>
          </button>
        `).join('')}
      </nav>
    `;

    const content = document.createElement('div');
    content.className = 's29-content';
    content.appendChild(grid);

    shell.appendChild(sidebar);
    shell.appendChild(content);
    page.appendChild(shell);
    return { shell, sidebar, content, grid };
  }

  function ensureExtraCards(grid) {
    if (!grid.querySelector('[data-s29-section="conformite"]')) {
      grid.appendChild(buildConformiteCard());
    }
    if (!grid.querySelector('[data-s29-section="comptabilite"]')) {
      grid.appendChild(buildComptaCard());
    }
    if (!grid.querySelector('[data-s29-section="transport"]')) {
      grid.appendChild(buildTransportCard());
    }
    if (!grid.querySelector('[data-s29-section="apropos"]')) {
      grid.appendChild(buildAproposCard());
    }
  }

  function tagAllCards(grid) {
    grid.querySelectorAll('.card').forEach(card => {
      if (!card.dataset.s29Section) card.dataset.s29Section = categoriseCard(card);
    });
    // Aussi les sections S24/S26/S27 injectées
    const page = grid.closest('#page-parametres');
    if (page) {
      page.querySelectorAll('.settings-section').forEach(sec => {
        if (sec.dataset.s29Section) return;
        const id = sec.id || '';
        if (id === 's24-params-section') sec.dataset.s29Section = 'automatisations';
        else if (id === 's26-params-section') sec.dataset.s29Section = 'automatisations';
        else if (id === 's27-params-section') sec.dataset.s29Section = 'conformite';
        else sec.dataset.s29Section = categoriseCard(sec);
        // Déplacer ces sections dans la grille
        if (grid && sec.parentElement !== grid) grid.appendChild(sec);
      });
    }
  }

  function setActive(sectionId) {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    const grid = page.querySelector('.params-grid');
    if (!grid) return;
    if (localStorage.getItem(LS_SECTION) !== sectionId) {
      localStorage.setItem(LS_SECTION, sectionId);
    }
    page.querySelectorAll('.s29-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.s29Target === sectionId);
    });
    grid.querySelectorAll('[data-s29-section]').forEach(el => {
      el.style.display = (el.dataset.s29Section === sectionId) ? '' : 'none';
    });
    // Reset search
    const search = page.querySelector('.s29-search');
    if (search) search.value = '';
    const headerTitle = page.querySelector('.page-actions h2');
    const section = SECTIONS.find(s => s.id === sectionId);
    if (headerTitle && section) headerTitle.textContent = '⚙️ Paramètres · ' + section.label;
  }

  function applySearch(q) {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    const grid = page.querySelector('.params-grid');
    if (!grid) return;
    const needle = (q||'').trim().toLowerCase();
    if (!needle) {
      const active = localStorage.getItem(LS_SECTION) || 'entreprise';
      setActive(active);
      return;
    }
    // En mode recherche, on ignore la section active et on montre toutes les cartes matchant
    page.querySelectorAll('.s29-nav-item').forEach(b => b.classList.remove('active'));
    grid.querySelectorAll('[data-s29-section]').forEach(el => {
      const text = (el.textContent||'').toLowerCase();
      el.style.display = text.includes(needle) ? '' : 'none';
    });
    const headerTitle = page.querySelector('.page-actions h2');
    if (headerTitle) headerTitle.textContent = '⚙️ Paramètres · 🔍 ' + q;
  }

  function wireEvents(page) {
    if (page.__s29Wired) return;
    page.__s29Wired = true;
    page.addEventListener('click', (e) => {
      const btn = e.target.closest('.s29-nav-item');
      if (btn) { setActive(btn.dataset.s29Target); return; }
    });
    const search = page.querySelector('.s29-search');
    if (search) {
      search.addEventListener('input', () => applySearch(search.value));
      search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value=''; applySearch(''); } });
    }
    // Raccourci Ctrl+/
    document.addEventListener('keydown', (e) => {
      if (!page.classList.contains('active')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const s = page.querySelector('.s29-search');
        if (s) { s.focus(); s.select(); }
      }
    });
  }

  function render() {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    const built = buildShell(page);
    const grid = page.querySelector('.params-grid');
    if (!grid) return;
    ensureExtraCards(grid);
    tagAllCards(grid);
    wireEvents(page);
    // Restaurer section active
    if (built || !page.dataset.s29Booted) {
      page.dataset.s29Booted = '1';
      const saved = localStorage.getItem(LS_SECTION) || 'entreprise';
      setActive(saved);
    } else {
      // Juste garantir que les nouvelles cartes S24/S26/S27 sont correctement filtrées
      const current = localStorage.getItem(LS_SECTION) || 'entreprise';
      const search = page.querySelector('.s29-search');
      if (search && search.value) applySearch(search.value);
      else setActive(current);
    }
  }

  function init() {
    // Attendre que S24/S26/S27 aient injecté leurs sections (ils tournent à 800-1700ms)
    setTimeout(render, 2200);
    setInterval(render, 4000);
    // Re-render sur navigation vers la page
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-page="parametres"], .nav-item[data-page="parametres"], [onclick*="parametres"]');
      if (nav) setTimeout(render, 250);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 2000);
})();

/* ============================================================
   Form Nouvelle Livraison — progress + validation inline
   ============================================================ */
(function installFormLivraisonEnhancements() {
  // 12 champs "principaux" dont on suit la complétude
  const TRACKED_FIELDS = [
    'liv-client', 'liv-client-siren', 'liv-date', 'liv-heure-debut',
    'liv-distance', 'liv-prix-ht', 'liv-chauffeur', 'liv-vehicule',
    'liv-exp-nom', 'liv-dest-nom', 'liv-dest-adresse', 'liv-marchandise-nature'
  ];

  function setFieldState(input, ok, hintMsg) {
    if (!input) return;
    input.classList.remove('fp-invalid', 'fp-valid');
    if (input.value === '') {
      // vide = neutre
    } else if (ok) {
      input.classList.add('fp-valid');
    } else {
      input.classList.add('fp-invalid');
    }
    const hint = document.getElementById(input.id + '-hint');
    if (hint) {
      hint.classList.remove('fp-hint-ok', 'fp-hint-err');
      if (input.value === '') { hint.textContent = ''; }
      else if (ok) { hint.textContent = hintMsg || '✓ Valide'; hint.classList.add('fp-hint-ok'); }
      else { hint.textContent = hintMsg || '✗ Invalide'; hint.classList.add('fp-hint-err'); }
    }
  }

  function validateSiren(input) {
    const val = String(input.value || '').replace(/\s+/g, '');
    if (val === '') { setFieldState(input, true, ''); return;}
    if (!/^\d+$/.test(val)) { setFieldState(input, false, '✗ Uniquement des chiffres'); return;}
    if (val.length < 9) { setFieldState(input, false, val.length + '/9 chiffres'); return;}
    const ok = typeof validerSIREN === 'function' ? validerSIREN(val) : /^\d{9}$/.test(val);
    setFieldState(input, ok, ok ? '✓ SIREN valide' : '✗ Clé Luhn incorrecte');
  }

  // Pays ISO 3166-1 alpha-2 — liste étendue (cf. datalist pays-iso-list dans admin.html)
  const PAYS_ISO2 = new Set(['FR','BE','LU','CH','DE','IT','ES','PT','NL','GB','IE','AT','DK','SE','FI','NO','IS','PL','CZ','SK','HU','RO','BG','GR','SI','HR','RS','BA','AL','MK','ME','EE','LV','LT','MT','CY','MC','AD','SM','VA','LI','TR','MA','DZ','TN','EG','IL','SN','CI','US','CA','MX','BR','AR','CN','JP','KR','IN','AU','NZ']);

  function validatePays(input) {
    const val = String(input.value || '').toUpperCase();
    if (val === '') { setFieldState(input, true, ''); return; }
    if (val.length < 2) { setFieldState(input, false, 'Code à 2 lettres'); return; }
    const ok = PAYS_ISO2.has(val);
    setFieldState(input, ok, ok ? '' : '✗ Code inconnu');
  }

  function reset() {
    // Reset des états visuels à l'ouverture du form ou après submit
    TRACKED_FIELDS.concat(['liv-exp-pays','liv-dest-pays']).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('fp-invalid', 'fp-valid');
      const hint = document.getElementById(id + '-hint');
      if (hint) { hint.textContent = ''; hint.classList.remove('fp-hint-ok', 'fp-hint-err'); }
    });
  }

  // mcaLivForm : API exposée pour les oninput="..." du HTML.
  // onInput / updateProgress sont conservés en no-op : la barre de progression
  // a été supprimée mais les attributs HTML les appellent encore.
  window.mcaLivForm = {
    onInput: function() {},
    validateSiren: validateSiren,
    validatePays: validatePays,
    reset: reset
  };

  // Hook : quand la modale s'ouvre, reset + update progress
  if (typeof window.openModal === 'function') {
    const originalOpenModal = window.openModal;
    window.openModal = function(id) {
      const result = originalOpenModal.apply(this, arguments);
      if (id === 'modal-livraison') { setTimeout(function(){ try { reset(); } catch(_){} }, 60); }
      return result;
    };
  }
})();
