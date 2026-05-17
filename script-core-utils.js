/**
 * MCA Logistics — Module Core-utils
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

/**
 * Echappe les caracteres speciaux HTML pour eviter les XSS quand on insere
 * du texte utilisateur dans innerHTML.
 * @param {*} s - Chaine ou valeur a echapper.
 * @returns {string} Chaine avec &<>"' echappes.
 */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, function(c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

/**
 * Echappe les caracteres dangereux pour les attributs HTML (=").
 * @param {*} s - Valeur a echapper.
 * @returns {string}
 */
function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/[&"<>]/g, function(c) {
    return ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'})[c];
  });
}

/**
 * Sanitize les inputs utilisateur avant stockage en base. Filet de défense
 * en profondeur contre le XSS stocké (#51 audit Chrome 2026-05-10) :
 * - strip <script>, <iframe>, <object>, <embed>
 * - strip handlers on*= ("onclick", "onerror", etc.)
 * - strip javascript: et data:text/html dans les attributs
 * Le rendu front utilise déjà escapeHtml/escapeAttr — cette fn est une
 * 2e ligne pour éviter qu'un futur renderer innerHTML expose une faille.
 * @param {*} s - Texte utilisateur libre
 * @returns {string}
 */
function sanitizeUserInput(s) {
  if (s == null) return '';
  return String(s)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*\/?>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');
}
if (typeof window !== 'undefined') window.sanitizeUserInput = sanitizeUserInput;
if (typeof module !== 'undefined' && module.exports) module.exports.sanitizeUserInput = sanitizeUserInput;

/**
 * Genere un identifiant unique au format UUID v4 (RFC 4122).
 * Utilise crypto.randomUUID si disponible (HTTPS uniquement), fallback
 * sur crypto.getRandomValues, ou en dernier recours timestamp + random.
 * @returns {string} UUID v4 (ex: "6c10b71d-8d2f-4de0-bf09-29abe101ccd1").
 */
function genId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40; // version 4
      b[8] = (b[8] & 0x3f) | 0x80; // variant 10
      const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    }
  } catch(e) {}
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
}

/**
 * Formate un nombre de kilometres en notation francaise + suffixe " km".
 * @param {number|string} n - Valeur (peut etre une string).
 * @returns {string} Ex: "12 345 km"
 */
function formatKm(n) { return new Intl.NumberFormat('fr-FR').format(Math.round(parseFloat(n||0)))+' km'; }

/**
 * Formate une date ISO ou Date en JJ/MM/YYYY.
 * @param {string|Date} val - Date ISO ou objet Date.
 * @returns {string} Ex: "29/04/2026" ou "—" si invalide.
 */
function formatDateExport(val) {
  if (!val) return '—';
  const source = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) ? val + 'T00:00:00' : val;
  const d = new Date(source);
  if (Number.isNaN(d.getTime())) return val;
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

/**
 * Formate un nombre en euros avec 2 decimales en francais.
 * @param {number|string} n
 * @returns {string} Ex: "1 234,56 €" ou "" si invalide.
 */
function __formatEurFR(n) {
  const val = parseFloat(n);
  if (!Number.isFinite(val)) return '';
  return val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Calcule la duree en heures entre deux horaires "HH:MM".
 * @param {string} heureDebut - Format "HH:MM".
 * @param {string} heureFin - Format "HH:MM".
 * @returns {number} Duree en heures (decimal). 0 si invalide.
 */
function calculerDureeJour(heureDebut, heureFin) {
  if (!heureDebut || !heureFin) return 0;
  const [hd, md] = heureDebut.split(':').map(Number);
  const [hf, mf] = heureFin.split(':').map(Number);
  const duree = (hf * 60 + mf) - (hd * 60 + md);
  return duree > 0 ? duree / 60 : 0;
}

// Flag global "TVA saisie manuellement" (cas facture mixte type 150€ TTC dont
// 30€ HT seulement soumis a TVA 20% = 6€ TVA, taux non standard). Quand actif,
// les fonctions calculer* respectent le champ TVA et n'auto-calculent que la
// 3e valeur (HT ou TTC selon le dernier edite). Reset au changement de taux.
var _chargeTvaManuelle = false;
function setChargeTvaManuelle(val) { _chargeTvaManuelle = !!val; }

// L1257 (script.js d'origine)
function calculerTTCDepuisHT(prefix) {
  // Reset du mode manuel quand l'user change le taux explicitement
  if (prefix === 'charge') _chargeTvaManuelle = false;
  const ht   = parseFloat(document.getElementById(prefix+'-prix-ht')?.value || document.getElementById(prefix+'-montant-ht')?.value || document.getElementById(prefix+'-cout-ht')?.value) || 0;
  const taux = parseFloat(document.getElementById(prefix+'-taux-tva')?.value) || 0;
  const ttc  = ht * (1 + taux / 100);
  const tvaM = ttc - ht;
  const elTTC = document.getElementById(prefix+'-prix') || document.getElementById(prefix+'-montant') || document.getElementById(prefix+'-cout');
  if (elTTC) elTTC.value = ttc.toFixed(2);
  // Charge : nouveau champ input editable (#charge-tva). Autres : ancien div.
  const elTVAInput = document.getElementById(prefix+'-tva');
  if (elTVAInput) elTVAInput.value = ht > 0 ? tvaM.toFixed(2) : '';
  const elTVADiv = document.getElementById(prefix+'-montant-tva');
  if (elTVADiv) elTVADiv.textContent = ht > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' €' : '';
  if (prefix === 'liv') alerteRentabilite();
}

// L1268 (script.js d'origine)
function calculerHTDepuisTTC(prefix) {
  const ttc  = parseFloat(document.getElementById(prefix+'-prix')?.value || document.getElementById(prefix+'-montant')?.value || document.getElementById(prefix+'-cout')?.value) || 0;
  const taux = parseFloat(document.getElementById(prefix+'-taux-tva')?.value) || 0;
  // Mode TVA manuelle (charge uniquement) : on respecte le champ TVA, on en
  // deduit HT = TTC - TVA. Sinon comportement historique (TVA = TTC × taux).
  const elTVAInput = document.getElementById(prefix+'-tva');
  let ht, tvaM;
  if (prefix === 'charge' && _chargeTvaManuelle && elTVAInput && elTVAInput.value) {
    tvaM = parseFloat(elTVAInput.value) || 0;
    ht = ttc - tvaM;
  } else {
    ht = ttc / (1 + taux / 100);
    tvaM = ttc - ht;
  }
  const elHT = document.getElementById(prefix+'-prix-ht') || document.getElementById(prefix+'-montant-ht') || document.getElementById(prefix+'-cout-ht');
  if (elHT) elHT.value = ht.toFixed(2);
  if (elTVAInput && !_chargeTvaManuelle) elTVAInput.value = ttc > 0 ? tvaM.toFixed(2) : '';
  const elTVADiv = document.getElementById(prefix+'-montant-tva');
  if (elTVADiv) elTVADiv.textContent = ttc > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' €' : '';
  if (prefix === 'liv') alerteRentabilite();
}

// L1268bis : appele quand l'user edite directement le champ TVA (#charge-tva).
// Recalcule TTC = HT + TVA (si HT renseigne) ou HT = TTC - TVA (si TTC).
function calculerTTCDepuisTVA(prefix) {
  const tvaM = parseFloat(document.getElementById(prefix+'-tva')?.value) || 0;
  const ht   = parseFloat(document.getElementById(prefix+'-montant-ht')?.value) || 0;
  const ttcEl = document.getElementById(prefix+'-montant');
  const ttcCurrent = parseFloat(ttcEl?.value) || 0;
  if (ht > 0) {
    if (ttcEl) ttcEl.value = (ht + tvaM).toFixed(2);
  } else if (ttcCurrent > 0) {
    const elHT = document.getElementById(prefix+'-montant-ht');
    if (elHT) elHT.value = (ttcCurrent - tvaM).toFixed(2);
  }
  const elTVADiv = document.getElementById(prefix+'-montant-tva');
  if (elTVADiv) elTVADiv.textContent = tvaM > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' €' : '';
}

// L2798 (script.js d'origine)
function calculerPrevision() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(calculerPrevision).catch(() => {}); return; }
  const livraisons = charger('livraisons');
  const carburant  = charger('carburant');
  const charges    = charger('charges');

  // ── Calcul basé sur les 3 derniers mois réels ──
  const moisReels = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const moisStr = d.toLocalISOMonth();
    const livsM   = livraisons.filter(l=>(l.date||'').startsWith(moisStr));
    const caM     = livsM.reduce((s,l)=>s+(l.prix||0),0);
    const carbM   = carburant.filter(p=>(p.date||'').startsWith(moisStr)).reduce((s,p)=>s+(p.total||0),0);
    const chargM  = charges.filter(c=>(c.date||'').startsWith(moisStr)).reduce((s,c)=>s+(c.montant||0),0);
    moisReels.push({ mois:moisStr, ca:caM, depenses:carbM+chargM, livraisons:livsM.length });
  }

  const nbMoisDonnees = moisReels.filter(m=>m.ca>0||m.livraisons>0).length;
  const avertissement = nbMoisDonnees < 3
    ? `⚠️ Prévision basée sur ${nbMoisDonnees} mois de données — résultats peu fiables en dessous de 3 mois.`
    : `✅ Prévision basée sur ${nbMoisDonnees} mois de données réelles.`;

  // Moyennes réelles
  const moyCA    = nbMoisDonnees > 0 ? moisReels.slice(0,nbMoisDonnees).reduce((s,m)=>s+m.ca,0) / nbMoisDonnees : 0;
  const moyDep   = nbMoisDonnees > 0 ? moisReels.slice(0,nbMoisDonnees).reduce((s,m)=>s+m.depenses,0) / nbMoisDonnees : 0;
  const moyLivs  = nbMoisDonnees > 0 ? moisReels.slice(0,nbMoisDonnees).reduce((s,m)=>s+m.livraisons,0) / nbMoisDonnees : 0;

  // Tendance (mois 1 vs mois 3)
  const tendanceCA  = moisReels[2]?.ca > 0 ? ((moisReels[0].ca - moisReels[2].ca) / moisReels[2].ca * 100) : 0;
  const prevCA      = moyCA * (1 + tendanceCA/100 * 0.5); // Lissage tendance à 50%
  const prevDep     = moyDep;
  const prevBen     = prevCA - prevDep;
  const prevMarge   = prevCA > 0 ? (prevBen/prevCA*100) : 0;

  // Afficher les prévisions
  const elCA  = document.getElementById('prev-ca');
  const elDep = document.getElementById('prev-depenses');
  const elBen = document.getElementById('prev-benefice');
  const elMrg = document.getElementById('prev-marge');
  const elLiv = document.getElementById('prev-livraisons-calc');
  const elAvt = document.getElementById('prev-avertissement');
  const elTend= document.getElementById('prev-tendance');

  if (elCA)   elCA.textContent   = euros(prevCA);
  if (elDep)  elDep.textContent  = euros(prevDep);
  if (elBen)  elBen.textContent  = euros(prevBen);
  if (elMrg)  elMrg.textContent  = prevMarge.toFixed(1)+' %';
  if (elLiv)  elLiv.textContent  = Math.round(moyLivs)+' liv.';
  if (elAvt)  { elAvt.textContent = avertissement; elAvt.style.color = nbMoisDonnees<3?'var(--accent)':'var(--green)'; }
  if (elTend) {
    const signe = tendanceCA > 0 ? '+' : '';
    elTend.textContent = `Tendance : ${signe}${tendanceCA.toFixed(1)}% vs mois précédent`;
    elTend.style.color = tendanceCA >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // Historique 6 derniers mois pour le graphique
  const labels = [], dataCA = [], dataBen = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const mStr = d.toLocalISOMonth();
    const caM  = livraisons.filter(l=>(l.date||'').startsWith(mStr)).reduce((s,l)=>s+(l.prix||0),0);
    const depM = carburant.filter(p=>(p.date||'').startsWith(mStr)).reduce((s,p)=>s+(p.total||0),0)
               + charges.filter(c=>(c.date||'').startsWith(mStr)).reduce((s,c)=>s+(c.montant||0),0);
    labels.push(d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}));
    dataCA.push(caM);
    dataBen.push(caM - depM);
  }
  // Ajouter prévision mois prochain
  const dNext = new Date(); dNext.setMonth(dNext.getMonth()+1);
  labels.push(dNext.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})+' *');
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
        { label:'CA réel (€)', data:dataCA.slice(0,-1).concat([null]),
          backgroundColor:'rgba(79,142,247,0.4)', borderColor:'rgba(79,142,247,0.9)', borderWidth:2, borderRadius:6 },
        { label:'CA prévu (€)', data:Array(6).fill(null).concat([dataCA[6]]),
          backgroundColor:'rgba(255,214,10,0.3)', borderColor:'rgba(255,214,10,0.9)', borderWidth:2, borderRadius:6, borderDash:[5,5] },
        { label:'Bénéfice net (€)', data:dataBen.slice(0,-1).concat([null]),
          type:'line', borderColor:'#2ecc71', backgroundColor:'rgba(46,204,113,0.1)', fill:true, tension:0.4, pointRadius:4 },
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ labels:{ color:'#e8eaf0' } },
        tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${euros(ctx.parsed.y||0)}` } } },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299'} },
        y:{ grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#7c8299', callback:v=>euros(v)} }
      }
    }
  });
}

// L3594 (script.js d'origine)
async function calculerDistanceMaps(depart, arrivee, inputId) {
  if (!depart || !arrivee) { afficherToast('⚠️ Saisissez départ et arrivée d\'abord', 'error'); return; }
  const btn = document.getElementById('maps-calc-btn');
  if (btn) { btn.classList.add('maps-loading'); btn.textContent = '⏳ Calcul...'; }

  try {
    // Utiliser l'API Nominatim (OSM) pour géocoder + calcul à vol d'oiseau
    const encD = encodeURIComponent(depart);
    const encA = encodeURIComponent(arrivee);
    const [resD, resA] = await Promise.all([
      fetch(`https://nominatim.openstreetmap.org/search?q=${encD}&format=json&limit=1`).then(r=>r.json()),
      fetch(`https://nominatim.openstreetmap.org/search?q=${encA}&format=json&limit=1`).then(r=>r.json())
    ]);
    if (!resD.length || !resA.length) { afficherToast('⚠️ Adresse introuvable — saisissez manuellement', 'error'); return; }

    const lat1 = parseFloat(resD[0].lat), lon1 = parseFloat(resD[0].lon);
    const lat2 = parseFloat(resA[0].lat), lon2 = parseFloat(resA[0].lon);

    // Formule Haversine (distance à vol d'oiseau)
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    const distVol = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    // Facteur routier ~1.3
    const distRoute = Math.round(distVol * 1.3);

    const input = document.getElementById(inputId);
    if (input) { input.value = distRoute; input.dispatchEvent(new Event('input')); }
    afficherToast(`Distance estimée : ${distRoute} km (via OSM)`);
  } catch(e) {
    afficherToast('⚠️ Erreur de calcul — vérifiez votre connexion', 'error');
  } finally {
    if (btn) { btn.classList.remove('maps-loading'); btn.textContent = 'Calculer distance'; }
  }
}

// L3632 (script.js d'origine)
function formatPrixAvecHT(prix) {
  if (!prix) return '—';
  const taux = getTauxTVA();
  const ht   = prixHT(prix, taux);
  return `<div><strong>${euros(prix)}</strong></div><div style="font-size:.72rem;color:var(--text-muted)">${euros(ht)} HT</div>`;
}

// L3658 (script.js d'origine)
function calculerPonctualite() {
  const livraisons = charger('livraisons').filter(l=>l.statut==='livre'||l.statut==='en-attente');
  if (!livraisons.length) return { taux:0, livrees:0, total:0 };
  const livrees = livraisons.filter(l=>l.statut==='livre').length;
  return { taux: Math.round(livrees/livraisons.length*100), livrees, total: livraisons.length };
}

// L4836 (script.js d'origine)
function calculerSoldeTresorerie() {
  const mois      = aujourdhui().slice(0,7);
  const livraisons= charger('livraisons').filter(l => (l.date||'').startsWith(mois));
  const carburant = charger('carburant').filter(p => (p.date||'').startsWith(mois));
  const charges   = charger('charges').filter(c => (c.date||'').startsWith(mois));

  const encaisse  = livraisons.filter(l => l.statutPaiement==='payé').reduce((s,l)=>s+(l.prix||0), 0);
  const depenses  = carburant.reduce((s,p)=>s+(p.total||0), 0)
                  + charges.reduce((s,c)=>s+(c.montant||0), 0);
  return { encaisse, depenses, solde: encaisse - depenses };
}

// L4896 (script.js d'origine)
function calculerTCO(vehId) {
  const veh = charger('vehicules').find(v=>v.id===vehId) || {};
  const carburant  = charger('carburant').filter(p=>p.vehId===vehId);
  const charges    = charger('charges').filter(c=>c.vehId===vehId);
  const entretiens = charger('entretiens').filter(e=>e.vehId===vehId);

  const totalCarb  = carburant.reduce((s,p)=>s+(p.total||0),0);
  const totalCharg = charges.reduce((s,c)=>s+(c.montant||0),0);
  const totalEntr  = entretiens.reduce((s,e)=>s+(e.cout||0),0);
  const achatHT    = parseFloat(veh.prixAchatHT) || 0;
  const total      = achatHT + totalCarb + totalCharg + totalEntr;

  return { totalCarb, totalCharg, totalEntr, total, achatHT };
}

// L4985 (script.js d'origine)
function formatNumeroFacture(annee, sequence) {
  return 'FAC-' + annee + '-' + String(sequence || 0).padStart(4, '0');
}

// L5279 (script.js d'origine)
function formatPrixComplet(l) {
  if (!l.prix) return '—';
  const taux = l.tauxTVA || parseFloat(localStorage.getItem('taux_tva')||'20');
  const ht   = l.prixHT || (l.prix / (1 + taux/100));
  const tvaM = l.prix - ht;
  return `<div><strong>${euros(l.prix)} TTC</strong></div><div style="font-size:.72rem;color:var(--text-muted)">${euros(ht)} HT · TVA ${euros(tvaM)}</div>`;
}

// L5360 (script.js d'origine)
function formatPeriodeDateFr(dateLike) {
  if (!dateLike) return '';
  var d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================================
// Normalisation des schemas data (PC <-> Mobile)
//
// Historiquement le form PC ecrivait en NESTED (`liv.expediteur.nom`,
// `vehicule.assurance.dateExpiration`...) et le form mobile en FLAT
// (`liv.expNom`, `vehicule.dateAssurance`...). Resultat: data invisible
// d'un cote ou de l'autre, alertes manquees, KPIs faux.
//
// Strategie : NESTED = schema canonique. Les helpers ci-dessous detectent
// les valeurs flat orphelines et les hissent en nested. Idempotents (rerun
// safe). Utilises en READ par tous les readers (LDV PDF, drawer 360,
// search, alertes...) et en MIGRATION boot pour fixer les anciennes
// donnees in-place.
// ============================================================

/**
 * Normalise une livraison vers le schema NESTED canonique pour la lettre
 * de voiture (LDV). Detecte les anciens champs flat (expNom, destNom,
 * marchNature, adrEst...) et les copie dans liv.expediteur / liv.destinataire
 * / liv.marchandise / liv.adr si absents.
 *
 * IMPORTANT : ne supprime pas les champs flat (compat lectures legacy
 * tierces). Idempotent : rerun safe.
 *
 * @param {Object} liv - Une livraison (mutable).
 * @returns {Object} La meme livraison, mutee si necessaire.
 */
function normalizeLDV(liv) {
  if (!liv || typeof liv !== 'object') return liv;

  // Expediteur : flat -> nested
  var expFlat = {
    nom: liv.expNom || '',
    contact: liv.expContact || '',
    adresse: liv.expAdresse || '',
    cp: liv.expCp || '',
    ville: liv.expVille || '',
    pays: liv.expPays || ''
  };
  var expNested = liv.expediteur && typeof liv.expediteur === 'object' ? liv.expediteur : null;
  var expHasFlat = !!(expFlat.nom || expFlat.adresse || expFlat.ville);
  var expHasNested = !!(expNested && (expNested.nom || expNested.adresse || expNested.ville));
  if (expHasFlat && !expHasNested) {
    liv.expediteur = {
      nom: expFlat.nom,
      contact: expFlat.contact,
      adresse: expFlat.adresse,
      cp: expFlat.cp,
      ville: expFlat.ville,
      pays: expFlat.pays || 'FR'
    };
  } else if (expHasNested && !expHasFlat) {
    // mirror nested -> flat (compat lecture readers mobile non encore migres)
    liv.expNom = expNested.nom || '';
    liv.expContact = expNested.contact || '';
    liv.expAdresse = expNested.adresse || '';
    liv.expCp = expNested.cp || '';
    liv.expVille = expNested.ville || '';
    liv.expPays = expNested.pays || 'FR';
  }

  // Destinataire : flat -> nested
  var destFlat = {
    nom: liv.destNom || '',
    contact: liv.destContact || '',
    adresse: liv.destAdresse || '',
    cp: liv.destCp || '',
    ville: liv.destVille || '',
    pays: liv.destPays || ''
  };
  var destNested = liv.destinataire && typeof liv.destinataire === 'object' ? liv.destinataire : null;
  var destHasFlat = !!(destFlat.nom || destFlat.adresse || destFlat.ville);
  var destHasNested = !!(destNested && (destNested.nom || destNested.adresse || destNested.ville));
  if (destHasFlat && !destHasNested) {
    liv.destinataire = {
      nom: destFlat.nom,
      contact: destFlat.contact,
      adresse: destFlat.adresse,
      cp: destFlat.cp,
      ville: destFlat.ville,
      pays: destFlat.pays || 'FR'
    };
  } else if (destHasNested && !destHasFlat) {
    liv.destNom = destNested.nom || '';
    liv.destContact = destNested.contact || '';
    liv.destAdresse = destNested.adresse || '';
    liv.destCp = destNested.cp || '';
    liv.destVille = destNested.ville || '';
    liv.destPays = destNested.pays || 'FR';
  }

  // Marchandise : flat -> nested. NB poidsKg/marchPoids, volumeM3/marchVolume,
  // nbColis/marchColis. On garde 0 comme valeur valide.
  var merchFlat = {
    nature: liv.marchNature || '',
    poidsKg: liv.marchPoids,
    volumeM3: liv.marchVolume,
    nbColis: liv.marchColis
  };
  var merchNested = liv.marchandise && typeof liv.marchandise === 'object' ? liv.marchandise : null;
  var merchHasFlat = !!(merchFlat.nature || (merchFlat.poidsKg != null && merchFlat.poidsKg !== '') || (merchFlat.volumeM3 != null && merchFlat.volumeM3 !== '') || (merchFlat.nbColis != null && merchFlat.nbColis !== ''));
  var merchHasNested = !!(merchNested && (merchNested.nature || merchNested.poidsKg || merchNested.volumeM3 || merchNested.nbColis));
  if (merchHasFlat && !merchHasNested) {
    liv.marchandise = {
      nature: merchFlat.nature,
      poidsKg: parseFloat(merchFlat.poidsKg) || 0,
      volumeM3: parseFloat(merchFlat.volumeM3) || 0,
      nbColis: parseInt(merchFlat.nbColis, 10) || 0
    };
  } else if (merchHasNested && !merchHasFlat) {
    liv.marchNature = merchNested.nature || '';
    liv.marchPoids = merchNested.poidsKg || 0;
    liv.marchVolume = merchNested.volumeM3 || 0;
    liv.marchColis = merchNested.nbColis || 0;
  }

  // ADR : flat -> nested. adrEst (mobile) <-> adr.estADR (PC). adrEstADR alias
  // (un reader mobile l'utilise). Idempotent : ecrit dans les 3 cas.
  var adrFlat = {
    estADR: !!(liv.adrEst || liv.adrEstADR),
    codeONU: liv.adrOnu || liv.adrCodeONU || '',
    classe: liv.adrClasse || '',
    groupeEmballage: liv.adrGroupe || liv.adrGroupeEmballage || ''
  };
  var adrNested = liv.adr && typeof liv.adr === 'object' ? liv.adr : null;
  var adrHasFlat = adrFlat.estADR || !!adrFlat.codeONU || !!adrFlat.classe || !!adrFlat.groupeEmballage;
  var adrHasNested = !!(adrNested && (adrNested.estADR || adrNested.codeONU || adrNested.classe || adrNested.groupeEmballage));
  if (adrHasFlat && !adrHasNested) {
    liv.adr = {
      estADR: adrFlat.estADR,
      codeONU: adrFlat.codeONU,
      classe: adrFlat.classe,
      groupeEmballage: adrFlat.groupeEmballage
    };
  } else if (adrHasNested && !adrHasFlat) {
    liv.adrEst = !!adrNested.estADR;
    liv.adrEstADR = !!adrNested.estADR;
    liv.adrOnu = adrNested.codeONU || '';
    liv.adrCodeONU = adrNested.codeONU || '';
    liv.adrClasse = adrNested.classe || '';
    liv.adrGroupe = adrNested.groupeEmballage || '';
    liv.adrGroupeEmballage = adrNested.groupeEmballage || '';
  }

  return liv;
}

/**
 * Normalise un vehicule vers le schema NESTED canonique pour l'assurance.
 * Mobile ecrivait `vehicule.dateAssurance` (flat), PC ecrit
 * `vehicule.assurance.{compagnie, numeroContrat, dateExpiration}` (nested).
 * Sans ce helper, les alertes "carte verte" PC ne se declenchaient pas
 * pour vehicules saisis mobile.
 *
 * Idempotent : rerun safe. Mirror dans les 2 sens pour rendre la donnee
 * lisible par tous les readers existants pendant la phase dual-read.
 *
 * @param {Object} v - Un vehicule (mutable).
 * @returns {Object} Le meme vehicule, mute si necessaire.
 */
function normalizeVehicule(v) {
  if (!v || typeof v !== 'object') return v;

  var nested = v.assurance && typeof v.assurance === 'object' ? v.assurance : null;
  var nestedHasDate = !!(nested && nested.dateExpiration);
  var flatDate = v.dateAssurance || '';

  if (flatDate && !nestedHasDate) {
    // Flat -> nested. Pas de compagnie/numero (mobile n'avait pas ces champs)
    // mais on conserve toute info nested existante (compagnie/numero saisis
    // PC sur un veh dont mobile aurait ecrase la date a part).
    v.assurance = {
      compagnie: (nested && nested.compagnie) || '',
      numeroContrat: (nested && nested.numeroContrat) || '',
      dateExpiration: flatDate
    };
  } else if (nestedHasDate && !flatDate) {
    // Mirror nested -> flat (lecture mobile alertes/drawer 360)
    v.dateAssurance = nested.dateExpiration;
  }
  return v;
}

/**
 * Normalise une absence vers le schema CANONIQUE (debut/fin/salId/heureDebut/heureFin).
 *
 * Contexte : 3 schemas coexistent historiquement :
 *   - Admin local (canonique adapter Supabase) : `debut`, `fin`, `salId`,
 *     `heureDebut`, `heureFin` (cf. legacy-entity-adapters.js absenceDbToJs)
 *   - Mobile local (script-mobile.js) : `dateDebut`, `dateFin`
 *   - Supabase brut (public.absences_periodes) : `date_debut`, `date_fin`,
 *     `salarie_id`, `heure_debut`, `heure_fin` (mappe par l'adapter au pull)
 *
 * Sans ce helper, les drawers PC affichaient parfois une absence vide pour
 * une absence saisie cote mobile (et inversement). Pattern dual-read :
 * on lit l'une des 3 variantes et on mirror dans toutes pendant la phase
 * de transition.
 *
 * Idempotent : rerun safe.
 *
 * @param {Object} a - Une absence (mutable).
 * @returns {Object} La meme absence, mutee pour exposer toutes les variantes.
 */
function normalizeAbsence(a) {
  if (!a || typeof a !== 'object') return a;
  // debut / fin canoniques
  if (!a.debut) a.debut = a.dateDebut || a.date_debut || '';
  if (!a.fin) a.fin = a.dateFin || a.date_fin || '';
  // Mirror inverse (lecture mobile + DB)
  if (a.debut && !a.dateDebut) a.dateDebut = a.debut;
  if (a.fin && !a.dateFin) a.dateFin = a.fin;
  // salId canonique
  if (!a.salId) a.salId = a.sal_id || a.salarie_id || '';
  // Heures (creneaux partiels conge demi-journee)
  if (!a.heureDebut) a.heureDebut = a.heure_debut || '';
  if (!a.heureFin) a.heureFin = a.heure_fin || '';
  return a;
}

/**
 * Renomme une cle localStorage legacy vers la cle canonique.
 * - Si la cle cible existe deja et n'est pas vide : on garde la cible,
 *   on supprime juste la source legacy (pour ne pas detruire des donnees
 *   plus recentes).
 * - Sinon : on copie la source vers la cible puis on supprime la source.
 *
 * Idempotent : si la source n'existe plus, no-op.
 *
 * Use case : nettoyage des anciennes installations qui avaient une
 * mauvaise cle (ex : 'plannings_hebdo' au lieu de 'plannings').
 *
 * @param {string} oldKey - Cle legacy a migrer.
 * @param {string} newKey - Cle canonique cible.
 * @returns {boolean} true si une migration a eu lieu, false sinon.
 */
function migrerCleLegacy(oldKey, newKey) {
  try {
    if (typeof localStorage === 'undefined') return false;
    var oldRaw = localStorage.getItem(oldKey);
    if (oldRaw === null) return false;
    var newRaw = localStorage.getItem(newKey);
    var hasNewData = false;
    if (newRaw) {
      try {
        var parsed = JSON.parse(newRaw);
        hasNewData = Array.isArray(parsed) ? parsed.length > 0 : (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0);
      } catch (_) { hasNewData = false; }
    }
    if (!hasNewData) {
      localStorage.setItem(newKey, oldRaw);
    }
    localStorage.removeItem(oldKey);
    console.info('[migrerCleLegacy]', oldKey, '->', newKey, hasNewData ? '(cible conservee, source legacy supprimee)' : '(source legacy migree)');
    return true;
  } catch (e) {
    console.warn('[migrerCleLegacy] erreur', oldKey, '->', newKey, e);
    return false;
  }
}

/**
 * Trouve un fournisseur par nom (insensible a la casse + trim).
 * Helper partage entre PC et mobile pour la resolution FK des charges.
 * @param {string} nom - Nom recherche.
 * @param {Array} fournisseurs - Liste a parcourir.
 * @returns {Object|null} Le fournisseur ou null.
 */
function findFournisseurByNom(nom, fournisseurs) {
  if (!nom || !Array.isArray(fournisseurs)) return null;
  var target = String(nom).trim().toLowerCase();
  if (!target) return null;
  return fournisseurs.find(function(f) {
    return f && (f.nom || '').toLowerCase().trim() === target;
  }) || null;
}

/**
 * Trouve une livraison par identifiant lisible (numLiv ou client+date)
 * pour les imports/migrations historiques.
 * @param {string} numOuClient - numLiv ou nom client.
 * @param {Array} livraisons
 * @returns {Object|null}
 */
function findLivraisonByRef(numOuClient, livraisons) {
  if (!numOuClient || !Array.isArray(livraisons)) return null;
  var target = String(numOuClient).trim().toLowerCase();
  return livraisons.find(function(l) {
    return l && ((l.numLiv || '').toLowerCase() === target || (l.client || '').toLowerCase() === target);
  }) || null;
}

// #65 #85 audit Chrome : helper unique pour eviter les bugs timezone J-1
// quand on saisit une date entre minuit local et 02h. Utilise dateToLocalISO
// (defini dans script.js) si dispo, sinon fallback inline.
function todayLocalISO() {
  if (typeof window !== 'undefined' && typeof window.dateToLocalISO === 'function') {
    return window.dateToLocalISO(new Date());
  }
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dateLocalISO(date) {
  if (typeof window !== 'undefined' && typeof window.dateToLocalISO === 'function') {
    return window.dateToLocalISO(date);
  }
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Expose au scope global (parite onclick + acces depuis script-mobile.js)
if (typeof window !== 'undefined') {
  window.normalizeLDV = normalizeLDV;
  window.normalizeVehicule = normalizeVehicule;
  window.normalizeAbsence = normalizeAbsence;
  window.migrerCleLegacy = migrerCleLegacy;
  window.findFournisseurByNom = findFournisseurByNom;
  window.findLivraisonByRef = findLivraisonByRef;
  window.todayLocalISO = todayLocalISO;
  window.dateLocalISO = dateLocalISO;
}

// Export Node (tests unitaires uniquement)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeLDV: normalizeLDV,
    normalizeVehicule: normalizeVehicule,
    normalizeAbsence: normalizeAbsence,
    migrerCleLegacy: migrerCleLegacy,
    findFournisseurByNom: findFournisseurByNom,
    findLivraisonByRef: findLivraisonByRef,
    calculerDureeJour: calculerDureeJour
  };
}

