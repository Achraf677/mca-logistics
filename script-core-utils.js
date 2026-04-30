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

// L1257 (script.js d'origine)
function calculerTTCDepuisHT(prefix) {
  const ht   = parseFloat(document.getElementById(prefix+'-prix-ht')?.value || document.getElementById(prefix+'-montant-ht')?.value || document.getElementById(prefix+'-cout-ht')?.value) || 0;
  const taux = parseFloat(document.getElementById(prefix+'-taux-tva')?.value) || 0;
  const ttc  = ht * (1 + taux / 100);
  const tvaM = ttc - ht;
  const elTTC = document.getElementById(prefix+'-prix') || document.getElementById(prefix+'-montant') || document.getElementById(prefix+'-cout');
  if (elTTC) elTTC.value = ttc.toFixed(2);
  const elTVA = document.getElementById(prefix+'-montant-tva');
  if (elTVA) elTVA.textContent = ht > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' €' : '';
  if (prefix === 'liv') alerteRentabilite();
}

// L1268 (script.js d'origine)
function calculerHTDepuisTTC(prefix) {
  const ttc  = parseFloat(document.getElementById(prefix+'-prix')?.value || document.getElementById(prefix+'-montant')?.value || document.getElementById(prefix+'-cout')?.value) || 0;
  const taux = parseFloat(document.getElementById(prefix+'-taux-tva')?.value) || 0;
  const ht   = ttc / (1 + taux / 100);
  const tvaM = ttc - ht;
  const elHT = document.getElementById(prefix+'-prix-ht') || document.getElementById(prefix+'-montant-ht') || document.getElementById(prefix+'-cout-ht');
  if (elHT) elHT.value = ht.toFixed(2);
  const elTVA = document.getElementById(prefix+'-montant-tva');
  if (elTVA) elTVA.textContent = ttc > 0 ? 'Montant TVA : ' + tvaM.toFixed(2) + ' €' : '';
  if (prefix === 'liv') alerteRentabilite();
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
          backgroundColor:'rgba(245,166,35,0.3)', borderColor:'rgba(245,166,35,0.9)', borderWidth:2, borderRadius:6, borderDash:[5,5] },
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
    afficherToast(`📍 Distance estimée : ${distRoute} km (via OSM)`);
  } catch(e) {
    afficherToast('⚠️ Erreur de calcul — vérifiez votre connexion', 'error');
  } finally {
    if (btn) { btn.classList.remove('maps-loading'); btn.textContent = '📍 Calculer distance'; }
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

