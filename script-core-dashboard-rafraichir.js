/**
 * MCA Logistics — Dashboard rafraichirDashboard — gros render dashboard (chartActivite + KPIs) (Phase X — extraction script.js)
 *
 * Extracted from script.js L992-1361 (2026-05-16).
 */

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
  // Bug #6 audit Chrome : KPIs PC + mobile alignes via MCAKpis (script-core-dashboard-kpis.js).
  // Single source of truth pour CA HT / CA TTC / Benefice / Alertes / Charges.
  const _kpiCAMois = (window.MCAKpis && window.MCAKpis.calcCAMois)
    ? window.MCAKpis.calcCAMois(livraisons, mois, charger('avoirs_emis'))
    : null;
  const caJour   = livsAuj.reduce((s,l)=>s+getMontantHTLivraison(l),0);
  const caSem    = livraisons.filter(l=>(l.date || '')>=sem).reduce((s,l)=>s+getMontantHTLivraison(l),0);
  const caMois    = _kpiCAMois ? _kpiCAMois.caHT : (function () {
    var brut = livraisonsMois.reduce((s,l)=>s+getMontantHTLivraison(l),0);
    var av = charger('avoirs_emis').filter(a => (a.date || '').startsWith(mois)).reduce((s, a) => s + (parseFloat(a.montantHT) || 0), 0);
    return Math.max(0, brut - av);
  })();
  const caMoisTTC = _kpiCAMois ? _kpiCAMois.caTTC : (function () {
    var brut = livraisonsMois.reduce((s,l)=>s+(parseFloat(l.prix) || 0),0);
    var av = charger('avoirs_emis').filter(a => (a.date || '').startsWith(mois)).reduce((s, a) => s + (parseFloat(a.montantTTC) || 0), 0);
    return Math.max(0, brut - av);
  })();
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
  // PGI : charges impayees (toutes periodes confondues, statut != paye)
  const chargesImpayees = charges.filter(function(c) {
    var st = c.statutPaiement || 'a_payer';
    return st !== 'paye';
  });
  const totalChargesImpayees = chargesImpayees.reduce(function(s, c) {
    var st = c.statutPaiement || 'a_payer';
    return s + (st === 'partiel' ? (c.montant || 0) / 2 : (c.montant || 0));
  }, 0);
  const nbChargesEnRetard = chargesImpayees.filter(function(c) {
    return typeof getChargeStatutEffectif === 'function' && getChargeStatutEffectif(c) === 'en_retard';
  }).length;
  setText('kpi-charges-impayees', euros(totalChargesImpayees));
  setText('kpi-charges-impayees-sub', nbChargesEnRetard > 0
    ? (nbChargesEnRetard + ' en retard')
    : (chargesImpayees.length + ' à payer'));

  // KPI Encaissements du mois — Phase 91.50 : aligné sur script-encaissement-counts.js (Phase 91.42)
  // Source A : table paiements[] (sens:'in' uniquement, date paiement stricte)
  // Source B : livraisons.statutPaiement='payé' sans entrée paiements (legacy)
  // Évolution vs mois précédent en %.
  (function () {
    var now = new Date();
    var moisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var moisEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
    var prevStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
    var prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
    var paiementsAll = charger('paiements');
    function isPaieInRange(p, debut, fin) {
      if (!p || !p.date) return false;
      if (p.sens && p.sens !== 'in') return false; // exclure paiements charges
      var d = new Date(p.date);
      return !isNaN(d.getTime()) && d >= debut && d <= fin;
    }
    function isPaye(l) { var s = l && l.statutPaiement; return s === 'paye' || s === 'payé' || s === 'payee' || s === 'payée'; }
    function ttc(l) { return parseFloat(l.prixTTC) || parseFloat(l.prix) || 0; }
    // Source A : paiements réels du mois
    var encMoisA = paiementsAll.filter(function(p) { return isPaieInRange(p, moisStart, moisEnd); }).reduce(function(s,p){ return s+(parseFloat(p.montant)||0); }, 0);
    var encPrecA = paiementsAll.filter(function(p) { return isPaieInRange(p, prevStart, prevEnd); }).reduce(function(s,p){ return s+(parseFloat(p.montant)||0); }, 0);
    // Source B : livraisons marquées payées sans entrée paiements (legacy sans modal-paiement)
    var paidLivIds = new Set(); paiementsAll.forEach(function(p){ if (p && p.livraisonId) paidLivIds.add(p.livraisonId); if (p && p.livraison_id) paidLivIds.add(p.livraison_id); });
    var encMoisB = livraisons.filter(function(l){
      if (!l || !isPaye(l) || paidLivIds.has(l.id)) return false;
      var dp = l.datePaiement || l.date_paiement; if (!dp) return false;
      var d = new Date(dp); return !isNaN(d.getTime()) && d >= moisStart && d <= moisEnd;
    }).reduce(function(s,l){ return s+ttc(l); }, 0);
    var encPrecB = livraisons.filter(function(l){
      if (!l || !isPaye(l) || paidLivIds.has(l.id)) return false;
      var dp = l.datePaiement || l.date_paiement; if (!dp) return false;
      var d = new Date(dp); return !isNaN(d.getTime()) && d >= prevStart && d <= prevEnd;
    }).reduce(function(s,l){ return s+ttc(l); }, 0);
    var encMois = encMoisA + encMoisB;
    var encPrec = encPrecA + encPrecB;
    var sub = '—';
    if (encPrec > 0) {
      var pct = Math.round(((encMois - encPrec) / encPrec) * 100);
      var arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '=';
      sub = arrow + ' ' + (pct > 0 ? '+' : '') + pct + '% vs mois préc.';
    } else if (encMois > 0) {
      sub = '▲ démarrage ce mois';
    } else {
      sub = 'aucun encaissement';
    }
    setText('kpi-encaissements-mois', euros(encMois));
    setText('kpi-encaissements-mois-sub', sub);
  })();
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
  // #87 audit Chrome : libelle et signe du KPI TVA Dashboard. Si solde > 0 on
  // doit "reverser" (dette envers Tresor), si solde < 0 c'est un "credit" TVA
  // (creance). Avant le fix le label restait "TVA a reverser" meme en credit
  // -> piege comptable (admin pourrait verser au lieu de demander remboursement).
  var tvaLabelEl = document.getElementById('kpi-tva-label');
  if (tvaLabelEl) {
    tvaLabelEl.textContent = soldeTva >= 0
      ? 'TVA à reverser'
      : 'Crédit TVA (à reporter)';
  }
  setText('kpi-tva-solde', euros(Math.abs(soldeTva)));
  const depDetailEl = document.getElementById('kpi-depenses-detail');
  if (depDetailEl) depDetailEl.innerHTML = `
    <div class="kpi-depenses-line"><span class="kpi-depenses-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 14h14"/><path d="M17 9l4 4v6a2 2 0 0 1-2 2"/></svg></span><span class="kpi-depenses-label">Carburant</span><strong>${euros(carbMois)}</strong></div>
    <div class="kpi-depenses-line"><span class="kpi-depenses-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg></span><span class="kpi-depenses-label">Entretien</span><strong>${euros(entretienChargesMois)}</strong></div>
    <div class="kpi-depenses-line"><span class="kpi-depenses-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M16 14h4"/></svg></span><span class="kpi-depenses-label">Charges</span><strong>${euros(autresChargesMois)}</strong></div>
    <div class="kpi-depenses-line"><span class="kpi-depenses-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg></span><span class="kpi-depenses-label">Salaires</span><strong>${euros(chargesSalarialesMois)}</strong></div>
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
      etat = 'Excellente santé'; couleur = 'rgba(39,174,96,0.35)'; etatClass = 'etat-bon';
      detail = `Marge positive · Aucune alerte · Aucun impayé`;
    } else if (beneficeVal > 0 && (alertesVal > 0 || impayes > 0)) {
      etat = 'Santé correcte'; couleur = 'rgba(46,204,113,0.15)'; etatClass = 'etat-bon';
      detail = `Bénéfice positif${alertesVal > 0 ? ` · ${alertesVal} alerte(s) à traiter` : ''}${impayes > 0 ? ` · ${euros(impayes)} impayés` : ''}`;
    } else if (beneficeVal <= 0 && caMoisVal > 0) {
      etat = 'Attention requise'; couleur = 'rgba(231,76,60,0.2)'; etatClass = 'etat-mauvais';
      detail = `Bénéfice négatif ce mois · Vérifiez vos charges`;
    } else {
      etat = 'En attente de données'; couleur = 'rgba(255,255,255,0.05)'; etatClass = 'etat-vide';
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
      seuilLabel.style.color = pct >= 100 ? '#2ecc71' : pct >= 70 ? '#ffd60a' : '#e74c3c';
    } else if (seuilLabel) {
      seuilLabel.textContent = 'Objectif non défini';
      seuilLabel.style.color = '#7c8299';
    }
  })();
}

if (typeof window !== 'undefined') {
  window.rafraichirDashboard = rafraichirDashboard;
}
