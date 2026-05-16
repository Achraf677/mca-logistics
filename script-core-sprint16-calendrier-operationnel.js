/**
 * MCA Logistics — Sprint 16 — Calendrier opérationnel (jour/semaine/mois/année + drag-drop + fériés FR 2000-2100) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4912-5745 (2026-05-16).
 */

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
    // Livraisons — Phase 91.50 : exclut brouillons et annulées (cohérence avec Cal Livraisons)
    load(LS.livraisons).forEach(l => {
      const st = String(l.statut || '').toLowerCase();
      if (st === 'brouillon' || st === 'draft' || st === 'annule' || st === 'annulee' || st === 'annulée') return;
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
    // Paiements — Phase 91.50 : filtre sens:'in' pour exclure les paiements charges (Qonto sens:'out')
    load(LS.paiements).forEach(p => {
      if (p.sens && p.sens !== 'in') return; // exclure paiements charges/fournisseurs
      const d = parseISO(p.date); if (!d) return;
      d.setHours(0,0,0,0);
      if (d.getTime() < startT || d.getTime() > endT) return;
      events.push({ type:'paiements', date:d, icon:'💰', label:fmtEur(p.montant||0)+' · '+(p.client||p.factureNumero||p.mode||p.moyen||''), color:'#eab308',
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
    const cntEch = events.filter(ev => ev.type==='echeances').length;
    // KPI Encaissé : somme réelle des paiements du mois affiché
    // Phase 91.50 : filtre sens:'in' pour exclure paiements charges (Qonto sens:'out')
    const pai = load(LS.paiements).filter(p => {
      if (p.sens && p.sens !== 'in') return false; // exclure paiements fournisseurs/charges
      const d = parseISO(p.date); if(!d) return false;
      return d >= s && d <= e;
    }).reduce((acc,p)=>acc+Number(p.montant||0),0);
    // KPI Jours fériés : compte les fériés dans le mois affiché
    const cntFeries = feriesDeLAnnee(c.getFullYear()).filter(f => f.date.getMonth() === c.getMonth()).length;
    const set = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cal16-kpi-liv', cntLiv);
    set('cal16-kpi-ech', cntEch);
    set('cal16-kpi-pai', pai > 0 ? fmtEur(pai) : '—');
    set('cal16-kpi-feries', cntFeries || '—');
    // Mettre à jour le sub-meta H1 avec les comptages du mois
    const subMeta = document.querySelector('#page-calendrier .sub-meta');
    if (subMeta) {
      const cntPai = load(LS.paiements).filter(p => { if (p.sens && p.sens !== 'in') return false; const d = parseISO(p.date); return d && d >= s && d <= e; }).length;
      subMeta.textContent = cntLiv + ' livraison' + (cntLiv !== 1 ? 's' : '') + ' · '
        + cntEch + ' échéance' + (cntEch !== 1 ? 's' : '') + ' · '
        + cntPai + ' paiement' + (cntPai !== 1 ? 's' : '') + ' · '
        + cntFeries + ' jour' + (cntFeries !== 1 ? 's' : '') + ' fériés';
    }
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

    // Phase 91.52 — cap à 35 cellules si le mois tient sur 5 lignes (évite ligne grisâtre vide en bas)
    const daysInMonth = new Date(c.getFullYear(), c.getMonth()+1, 0).getDate();
    const totalCells = (dowStart + daysInMonth) <= 35 ? 35 : 42;
    const gridRows = totalCells / 7;

    let html = '<div class="cal16-mois">';
    // Header jours
    html += '<div class="cal16-mois-header">' + JOURS_COURT.map(j => '<div class="cal16-mois-hcell">'+j+'</div>').join('') + '</div>';
    html += '<div class="cal16-mois-body" style="grid-template-rows: repeat('+gridRows+', 1fr)">';
    for (let i = 0; i < totalCells; i++) {
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
      if (ferie) html += '<div class="cal16-day-ferie-row" title="'+escHtml(ferie.nom)+'">☆ '+escHtml(ferie.nom)+'</div>';
      // Phase 91.51 : maxShow réduit (était 4, débordait) ; container cal16-day-events pour clip strict
      const maxShow = ferie ? 1 : 2;
      html += '<div class="cal16-day-events">';
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
      html += '</div>'; // cal16-day-events
      html += '</div>'; // cal16-day
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

  /* ---------- Rendu vue jour (Phase 91.49 — refonte vue Jour : KPIs + lanes enrichies) ---------- */
  function renderJour() {
    const grid = document.getElementById('cal16-grid');
    if (!grid) return;
    const { start, end } = getBounds();
    const events = getEventsForRange(start, end);
    const filtres = getFiltresActifs();
    const ferie = filtres.feries ? feriePourDate(start) : null;

    // Index par type pour lookups
    const livIndex = {}; load(LS.livraisons).forEach(l => { if (l && l.id) livIndex[l.id] = l; });
    const factIndex = {}; load(LS.factures).forEach(f => { if (f && f.id) factIndex[f.id] = f; });
    const paieIndex = {}; load(LS.paiements).forEach(p => { if (p && p.id) paieIndex[p.id] = p; });

    // KPIs du jour
    const livsJour = events.filter(ev => ev.type === 'livraisons');
    const echJour = events.filter(ev => ev.type === 'echeances');
    const paieJour = events.filter(ev => ev.type === 'paiements');
    const relJour = events.filter(ev => ev.type === 'relances');
    const totalEncaisse = paieJour.reduce((s, ev) => s + Number(paieIndex[ev.id]?.montant || 0), 0);
    const totalEcheances = echJour.reduce((s, ev) => {
      const fId = ev.id.replace(/^ech_/, '');
      const f = factIndex[fId];
      if (!f) return s;
      const solde = typeof soldeFacture === 'function' ? soldeFacture(f) : 0;
      return s + (solde > 0 ? solde : 0);
    }, 0);

    let html = '<div class="cal16-jour" data-date="'+isoDate(start)+'">';

    // Header + retour
    html += '<div class="cal16-jour-back">'
      + '<button class="btn-secondary" onclick="window.cal16.retourMois()" title="Retour à la vue mois">← Retour au mois</button>'
      + '<button class="cal16-jour-close" onclick="window.cal16.retourMois()" title="Fermer" aria-label="Fermer">✕</button>'
      + '</div>';

    // Banner férié
    if (ferie) html += '<div class="cal16-jour-ferie">☆ '+escHtml(ferie.nom)+' — jour férié</div>';

    // KPI strip de la journée
    html += '<div class="cal16-jour-kpis">'
      + '<div class="cal16-jour-kpi"><div class="cal16-jour-kpi-lbl">Livraisons</div><div class="cal16-jour-kpi-val">'+livsJour.length+'</div></div>'
      + '<div class="cal16-jour-kpi"><div class="cal16-jour-kpi-lbl">Échéances</div><div class="cal16-jour-kpi-val">'+(totalEcheances > 0 ? fmtEur(totalEcheances) : echJour.length)+'</div></div>'
      + '<div class="cal16-jour-kpi"><div class="cal16-jour-kpi-lbl">Encaissé</div><div class="cal16-jour-kpi-val">'+(totalEncaisse > 0 ? fmtEur(totalEncaisse) : '—')+'</div></div>'
      + '<div class="cal16-jour-kpi"><div class="cal16-jour-kpi-lbl">Relances</div><div class="cal16-jour-kpi-val">'+(relJour.length || '—')+'</div></div>'
      + '</div>';

    // Lanes par catégorie (grid responsive)
    html += '<div class="cal16-jour-lanes">';
    const groups = [
      ['livraisons','Livraisons','📦'],
      ['echeances','Échéances','⏰'],
      ['paiements','Paiements','💰'],
      ['relances','Relances','🔔'],
      ['factures','Factures émises','📄']
    ];
    let hasAny = false;
    groups.forEach(([t, titre, emoji]) => {
      if (!filtres[t]) return;
      const evs = events.filter(ev => ev.type === t);
      if (!evs.length) return;
      hasAny = true;
      html += '<div class="cal16-jour-lane cal16-jour-lane-'+t+'">';
      html += '<div class="cal16-jour-lane-head"><span class="cal16-jour-lane-emoji">'+emoji+'</span><h4>'+titre+'</h4><span class="cal16-jour-lane-count">'+evs.length+'</span></div>';
      html += '<div class="cal16-jour-lane-body">';
      evs.forEach(ev => {
        let subline = '';
        let badge = '';
        if (t === 'livraisons') {
          const l = livIndex[ev.id];
          if (l) {
            const route = [l.depart, l.arrivee].filter(Boolean).join(' → ');
            const prix = parseFloat(l.prix) || 0;
            subline = (route || '—') + (prix > 0 ? ' · ' + fmtEur(prix) : '');
            const statut = String(l.statut || '').toLowerCase();
            const statutLbl = statut === 'livre' ? 'Livré' : statut === 'en-cours' ? 'En cours' : statut === 'brouillon' ? 'Brouillon' : statut === 'annule' || statut === 'annulee' ? 'Annulé' : 'À faire';
            badge = '<span class="cal16-jour-event-badge cal16-jour-event-badge-'+statut+'">'+statutLbl+'</span>';
          }
        } else if (t === 'echeances') {
          const fId = ev.id.replace(/^ech_/, '');
          const f = factIndex[fId];
          if (f) {
            const solde = typeof soldeFacture === 'function' ? soldeFacture(f) : 0;
            subline = (f.client || '—') + (solde > 0 ? ' · solde ' + fmtEur(solde) : '');
            const today = new Date(); today.setHours(0,0,0,0);
            const enRetard = ev.date < today;
            badge = enRetard ? '<span class="cal16-jour-event-badge cal16-jour-event-badge-retard">En retard</span>' : '<span class="cal16-jour-event-badge cal16-jour-event-badge-attente">À échoir</span>';
          }
        } else if (t === 'paiements') {
          const p = paieIndex[ev.id];
          if (p) {
            subline = (p.client || p.factureNumero || '—') + ' · ' + (p.mode || p.moyen || 'virement');
            badge = '<span class="cal16-jour-event-badge cal16-jour-event-badge-paye">Encaissé</span>';
          }
        } else if (t === 'relances') {
          subline = 'Niveau ' + (ev.label.match(/N(\d)/)?.[1] || '?');
          badge = '<span class="cal16-jour-event-badge cal16-jour-event-badge-relance">Envoyée</span>';
        } else if (t === 'factures') {
          const f = factIndex[ev.id];
          if (f) {
            subline = (f.client || '—') + (f.montantTTC ? ' · ' + fmtEur(f.montantTTC) : '');
            badge = '<span class="cal16-jour-event-badge">'+escHtml(f.statut || 'émise')+'</span>';
          }
        }
        html += '<button class="cal16-jour-event cal16-event-'+t+'" '
          + (ev.draggable ? 'draggable="true" data-drag-id="'+escHtml(ev.id)+'" data-drag-type="'+t+'"' : '')
          + ' data-ev-id="'+escHtml(ev.id)+'" type="button">'
          + '<span class="cal16-jour-event-icon">'+ev.icon+'</span>'
          + '<span class="cal16-jour-event-body">'
            + '<span class="cal16-jour-event-title">'+escHtml(ev.label)+'</span>'
            + (subline ? '<span class="cal16-jour-event-sub">'+escHtml(subline)+'</span>' : '')
          + '</span>'
          + badge
          + '</button>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    // Empty state amélioré
    if (!hasAny && !ferie) {
      html += '<div class="cal16-jour-empty">'
        + '<div class="cal16-jour-empty-icon">📅</div>'
        + '<div class="cal16-jour-empty-title">Journée vide</div>'
        + '<div class="cal16-jour-empty-sub">Aucune livraison, échéance ou paiement enregistré pour cette date.</div>'
        + '</div>';
    }

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
    // Phase 91.47 : afficherToast() utilise textContent (anti-XSS) — pas de SVG inline. Emoji simple.
    toast('📦 ' + (l.numero || 'Livraison') + ' déplacée au ' + new Date(newDateISO + 'T00:00:00').toLocaleDateString('fr-FR'), 'success');
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
      ? construireEnteteExport(entreprise, 'Calendrier opérationnel', titre, dateExp)
      : '<div><h1>Calendrier — '+escHtml(titre)+'</h1></div>';
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
      + '<button class="print-btn" onclick="window.print()">Imprimer / PDF</button>'
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

  /* ---------- Export CSV (Phase 91.45) ---------- */
  function exporterCSV() {
    const { start, end } = getBounds();
    const events = getEventsForRange(start, end);
    const filtres = getFiltresActifs();
    const evsFiltres = events.filter(ev => filtres[ev.type]);
    if (!evsFiltres.length) { toast('Aucun événement à exporter pour cette période', 'info'); return; }
    const titre = (state.vue === 'mois' ? MOIS[start.getMonth()]+' '+start.getFullYear()
      : state.vue === 'annee' ? 'Année '+start.getFullYear()
      : start.toLocaleDateString('fr-FR')+' - '+end.toLocaleDateString('fr-FR'));
    let csv = '﻿' + 'Date;Type;Libellé\n';
    evsFiltres.sort((a,b) => a.date - b.date).forEach(ev => {
      csv += isoDate(ev.date) + ';' + ev.type + ';' + (ev.label || '').replace(/;/g,'|') + '\n';
    });
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'calendrier-' + titre.replace(/\s/g,'-') + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof window.ajouterEntreeAudit === 'function') window.ajouterEntreeAudit('Export CSV calendrier', titre);
  }

  // Phase 91.52 — Imprimer calendrier vierge (grille sans events, fond blanc, pour notes manuscrites)
  function imprimerVierge() {
    const { start } = getBounds();
    const titre = MOIS[start.getMonth()] + ' ' + start.getFullYear();
    const firstDay = new Date(start.getFullYear(), start.getMonth(), 1);
    const dowStart = (firstDay.getDay()+6)%7;
    const gridStart = new Date(firstDay); gridStart.setDate(gridStart.getDate()-dowStart);
    const daysInMonth = new Date(start.getFullYear(), start.getMonth()+1, 0).getDate();
    const totalCells = (dowStart + daysInMonth) <= 35 ? 35 : 42;
    const gridRows = totalCells / 7;
    const w = ouvrirPopupSecure('','cal16_print_vierge','width=1100,height=820');
    if (!w) { toast('Popup bloquée','error'); return; }
    let body = '<table class="mois"><tr>' + JOURS_COURT.map(j => '<th>'+j+'</th>').join('') + '</tr>';
    for (let r = 0; r < gridRows; r++) {
      body += '<tr>';
      for (let i = 0; i < 7; i++) {
        const d = new Date(gridStart); d.setDate(d.getDate()+r*7+i);
        const inMonth = d.getMonth() === start.getMonth();
        const ferie = feriePourDate(d);
        body += '<td class="'+(inMonth?'':'other')+(ferie?' fer':'')+'">';
        body += '<div class="dn">'+d.getDate()+'</div>';
        if (ferie) body += '<div class="fer-lbl">'+escHtml(ferie.nom)+'</div>';
        body += '</td>';
      }
      body += '</tr>';
    }
    body += '</table>';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>'+escHtml(titre)+' — calendrier vierge</title><style>'
      + 'body{font-family:"DM Sans",system-ui,sans-serif;color:#1a1d22;margin:0;padding:24px}'
      + 'h1{font-family:"Syne",sans-serif;font-size:22px;margin:0 0 8px;letter-spacing:-0.02em}'
      + '.sub{font-size:12px;color:#6b7280;margin-bottom:16px}'
      + 'table.mois{width:100%;border-collapse:collapse;table-layout:fixed}'
      + 'table.mois th{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:700;padding:6px;border-bottom:2px solid #1a1d22;text-align:left}'
      + 'table.mois td{border:1px solid #d1d5db;height:90px;vertical-align:top;padding:4px 6px;background:#fff}'
      + 'table.mois td.other{background:#f9fafb;color:#9ca3af}'
      + 'table.mois td.fer{background:rgba(167,139,250,0.08)}'
      + '.dn{font-weight:700;font-size:13px}'
      + '.fer-lbl{font-size:10px;color:#7c3aed;margin-top:2px}'
      + '@page{size:A4 landscape;margin:12mm}'
      + '</style></head><body>'
      + '<h1>'+escHtml(titre)+'</h1>'
      + '<div class="sub">Calendrier vierge — '+daysInMonth+' jours · zone de notes par cellule</div>'
      + body
      + '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>'
      + '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.cal16 = { render, naviguer, aujourdhui, changerVue, allerA, retourMois, imprimer, imprimerVierge, feriesDeLAnnee, feriePourDate };
  window.cal16ImprimerVierge = imprimerVierge;
  window.cal16ExportCSV = exporterCSV;

  /* WRAPPER S16 — Hook naviguerVers : déclencher render() du calendrier
     mensuel quand l'utilisateur navigue vers la page 'calendrier'. Pattern
     chaîne propre : capture l'ancienne version, marqueur __s16 idempotent,
     préserve les marqueurs des wrappers antérieurs (S12_1, S14, S15). H2.1. */
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
