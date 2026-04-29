/**
 * MCA Logistics — Module Stats
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L1177 (script.js d'origine)
function getSalarieStatsMois(salId) {
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  var debut = planningDateToLocalISO(monthStart);
  var fin = planningDateToLocalISO(monthEnd);
  var livraisons = charger('livraisons').filter(function(item) {
    return item.chaufId === salId && item.date >= debut && item.date <= fin;
  });
  var contexte = construireContexteHeures({ mode: 'mois', debut: debut, fin: fin, label: '', datesLabel: '' });
  var heures = calculerHeuresSalarieSemaine(salId, contexte).planifiees || 0;
  return {
    livraisons: livraisons.length,
    ca: livraisons.reduce(function(sum, item) { return sum + (parseFloat(item.prix || item.prixTTC) || 0); }, 0),
    heures: heures
  };
}

// L4318 (script.js d'origine)
function getStatsMoisRange() {
  var range = getPeriodeRange(_statsPeriode.mode, _statsPeriode.offset);
  return { debut: range.debut, fin: range.fin, label: range.label, dates: range.datesLabel };
}

// L4322 (script.js d'origine)
function navStatsMois(delta) {
  _statsPeriode.mode = 'mois';
  _statsPeriode.offset = delta === 0 ? 0 : _statsPeriode.offset + delta;
  afficherStatistiques();
}

// L4327 (script.js d'origine)
function changerVueStats(mode) { changeSimplePeriode(_statsPeriode, mode, afficherStatistiques, 'stats-mois-label', 'stats-mois-dates', 'vue-stats-select'); }

// L4328 (script.js d'origine)
function navStatsPeriode(delta) { navSimplePeriode(_statsPeriode, delta, afficherStatistiques, 'stats-mois-label', 'stats-mois-dates', 'vue-stats-select'); }

// L4329 (script.js d'origine)
function reinitialiserStatsPeriode() { resetSimplePeriode(_statsPeriode, afficherStatistiques, 'stats-mois-label', 'stats-mois-dates', 'vue-stats-select'); }

// L4330 (script.js d'origine)
function afficherStatistiques() {
  if (typeof Chart === 'undefined') { ensureChartJs().then(afficherStatistiques).catch(() => {}); return; }
  const isLight = document.body.classList.contains('light-mode');
  const tickColor = isLight ? '#555' : '#7c8299';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const legendColor = isLight ? '#1a1d27' : '#e8eaf0';
  const range = getStatsMoisRange();
  const periodSelect = document.getElementById('vue-stats-select');
  if (periodSelect) periodSelect.value = _statsPeriode.mode;
  const dateMinStr = range.debut;
  const dateMaxStr = range.fin;
  const livraisons = charger('livraisons');
  const lbl = document.getElementById('stats-mois-label'); if (lbl) lbl.textContent = range.label;
  const dates = document.getElementById('stats-mois-dates'); if (dates) dates.textContent = range.dates;
  const livsFiltrees = livraisons.filter(l => l.date >= dateMinStr && l.date <= dateMaxStr);

  // KPIs période
  const caPeriode = livsFiltrees.reduce((s,l)=>s+(l.prix||0),0);
  const nbLivs    = livsFiltrees.length;
  const panierMoy = nbLivs > 0 ? caPeriode / nbLivs : 0;
  const kmTotal   = livsFiltrees.reduce((s,l)=>s+(l.distance||0),0);
  const el1=document.getElementById('stats-ca-periode'); if(el1) el1.textContent=euros(caPeriode);
  const el2=document.getElementById('stats-livraisons-periode'); if(el2) el2.textContent=nbLivs;
  const el3=document.getElementById('stats-panier-moyen'); if(el3) el3.textContent=euros(panierMoy);
  const el4=document.getElementById('stats-km-total'); if(el4) el4.textContent=Math.round(kmTotal)+' km';

  // Graphique CA — adaptatif
  const labels=[],donnees=[];
  const nbJours = Math.max(1, Math.round((new Date(dateMaxStr) - new Date(dateMinStr)) / (1000*60*60*24)));
  if (nbJours <= 31) {
    for(let i=nbJours-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toLocalISODate();labels.push(d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));donnees.push(livraisons.filter(l=>l.date===ds).reduce((s,l)=>s+(l.prix||0),0));}
  } else {
    // Par semaine
    for(let i=Math.floor(nbJours/7)-1;i>=0;i--){
      const fin=new Date(); fin.setDate(fin.getDate()-i*7);
      const debut=new Date(fin); debut.setDate(debut.getDate()-6);
      const dStr=debut.toLocalISODate(), fStr=fin.toLocalISODate();
      labels.push(debut.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));
      donnees.push(livraisons.filter(l=>l.date>=dStr&&l.date<=fStr).reduce((s,l)=>s+(l.prix||0),0));
    }
  }
  if(chartCA)chartCA.destroy();
  const _cvCA = document.getElementById('chartCA');
  chartCA = new Chart(_cvCA, {
    type:'line',
    data:{ labels, datasets:[{
      label:'CA (€)', data:donnees,
      borderColor:'#4f8ef7',
      backgroundColor: mcaChartGradient(_cvCA, '#4f8ef7', 0.35, 0),
      fill:true, tension:0.35,
      pointRadius:4, pointHoverRadius:7,
      pointBackgroundColor:'#4f8ef7', pointBorderColor:'#fff', pointBorderWidth:2,
      borderWidth:3
    }]},
    options: mcaChartBaseOptions(isLight, {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + euros(ctx.parsed.y || 0) } } },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, maxTicksLimit: 12, font: { size: 11 } } },
        y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, callback: v => euros(v) } }
      }
    })
  });

  // Chauffeurs — horizontal bar
  const ch=charger('chauffeurs');
  if(chartChauff)chartChauff.destroy();
  const chData = ch.length ? ch.map(c=>({nom:c.nom, nb:livsFiltrees.filter(l=>l.chaufId===c.id).length})).sort((a,b)=>b.nb-a.nb) : [{nom:'Aucun',nb:0}];
  const _cvChauff = document.getElementById('chartChauffeurs');
  chartChauff = new Chart(_cvChauff, {
    type:'bar',
    data:{ labels:chData.map(c=>c.nom), datasets:[{
      label:'Livraisons', data:chData.map(c=>c.nb),
      backgroundColor: mcaChartGradient(_cvChauff, '#9b59b6', 0.9, 0.25),
      borderColor:'rgba(155,89,182,1)', borderWidth:0, borderRadius:8, borderSkipped:false
    }] },
    options: mcaChartBaseOptions(isLight, {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, precision: 0 } },
        y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } } }
      }
    })
  });

  // Véhicules
  const veh=charger('vehicules');
  if(chartVeh)chartVeh.destroy();
  const vehData = veh.length ? veh.map(v=>({nom:v.immat,nb:livsFiltrees.filter(l=>l.vehId===v.id).length})).sort((a,b)=>b.nb-a.nb) : [{nom:'Aucun',nb:0}];
  const _cvVeh = document.getElementById('chartVehicules');
  chartVeh = new Chart(_cvVeh, {
    type:'bar',
    data:{ labels:vehData.map(v=>v.nom), datasets:[{
      label:'Livraisons', data:vehData.map(v=>v.nb),
      backgroundColor: mcaChartGradient(_cvVeh, '#e67e22', 0.9, 0.25),
      borderColor:'rgba(230,126,34,1)', borderWidth:0, borderRadius:8, borderSkipped:false
    }] },
    options: mcaChartBaseOptions(isLight, {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor, drawBorder: false }, ticks: { color: tickColor, font: { size: 11 }, precision: 0 } },
        y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } } }
      }
    })
  });

  // CA par chauffeur (nouveau graphique)
  if(chartCAParChauff)chartCAParChauff.destroy();
  const caChData = ch.length ? ch.map(c=>({nom:c.nom, ca:livsFiltrees.filter(l=>l.chaufId===c.id).reduce((s,l)=>s+(l.prix||0),0)})).sort((a,b)=>b.ca-a.ca) : [{nom:'Aucun',ca:0}];
  const ctxCA = document.getElementById('chartCAParChauffeur');
  if (ctxCA) {
    chartCAParChauff=new Chart(ctxCA,{
      type:'doughnut',
      data:{labels:caChData.map(c=>c.nom),datasets:[{data:caChData.map(c=>c.ca),backgroundColor:['rgba(79,142,247,0.7)','rgba(245,166,35,0.7)','rgba(46,204,113,0.7)','rgba(155,89,182,0.7)','rgba(231,76,60,0.7)','rgba(52,152,219,0.7)','rgba(230,126,34,0.7)'],borderColor:isLight?'#fff':'#1a1d27',borderWidth:3}]},
      options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{labels:{color:legendColor}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${euros(ctx.parsed||0)}`}}}}
    });
  }
}

// L10616 (script.js d'origine)
function exporterStatsPDF() {
  const params = getEntrepriseExportParams();
  const nom = params.nom;
  const range = getStatsMoisRange();
  const ca = document.getElementById('stats-ca-periode')?.textContent||'0 €';
  const livs = document.getElementById('stats-livraisons-periode')?.textContent||'0';
  const panier = document.getElementById('stats-panier-moyen')?.textContent||'0 €';
  const km = document.getElementById('stats-km-total')?.textContent||'0 km';
  const dateExp = formatDateHeureExport();
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #f5a623;margin-bottom:24px">
      <div><div style="font-size:1.4rem;font-weight:800;color:#f5a623">${nom}</div></div>
      <div style="text-align:right"><div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase">Rapport statistiques</div><div style="font-size:.9rem;font-weight:700">${range.label}</div><div style="font-size:.78rem;color:#9ca3af">${range.dates}</div></div>
    </div>
    ${renderBlocInfosEntreprise(params)}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:24px">
      ${[['CA période',ca,'#2ecc71'],['Livraisons',livs,'#4f8ef7'],['Panier moyen',panier,'#f5a623'],['Km total',km,'#9b59b6']].map(([l,v,c])=>`<div style="background:#f8f9fc;border-radius:10px;padding:16px;text-align:center;border-top:3px solid ${c}"><div style="font-size:.72rem;color:#9ca3af;margin-bottom:6px">${l}</div><div style="font-size:1.2rem;font-weight:800;color:${c}">${v}</div></div>`).join('')}
    </div>
    ${renderFooterEntreprise(params, dateExp)}
  </div>`;
  const win = ouvrirPopupSecure('','_blank','width=800,height=600');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Statistiques — ${nom}</title><style>body{margin:0;padding:20px;background:#fff}@page{margin:12mm}</style></head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('📄 Rapport statistiques généré');
}

// L11343 (script.js d'origine)
function buildSimplePeriodeState(defaultMode) {
  return { mode: defaultMode || 'mois', offset: 0 };
}

