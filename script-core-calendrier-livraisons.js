/**
 * MCA Logistics — Vue calendrier livraisons mensuel + filtrer par jour (Phase X — extraction script.js)
 *
 * Extracted from script.js L2103-2206 (2026-05-16).
 */

/* ===== VUE CALENDRIER LIVRAISONS ===== */
// window._calMois partagé avec script-core-navigation.js (calNaviguer) → état global mutable
if (typeof window !== 'undefined' && !window._calMois) window._calMois = new Date();

function afficherCalendrier() {
  const livraisons = charger('livraisons');
  const annee = window._calMois.getFullYear();
  const mois  = window._calMois.getMonth();
  const label = window._calMois.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  const el = document.getElementById('cal-mois-label');
  if (el) el.textContent = label;

  const cal = document.getElementById('calendrier-grid');
  if (!cal) return;

  // Premier jour du mois et nombre de jours
  const premier = new Date(annee, mois, 1).getDay(); // 0=dim
  const offset  = (premier + 6) % 7; // lundi=0
  const nbJours = new Date(annee, mois+1, 0).getDate();
  const auj     = aujourdhui();

  // Grouper livraisons par date (exclut brouillon/annulee)
  const parDate = {};
  livraisons.forEach(l => {
    const st = String(l.statut || '').toLowerCase();
    if (st === 'brouillon' || st === 'draft' || st === 'annule' || st === 'annulee' || st === 'annulée') return;
    if (!parDate[l.date]) parDate[l.date] = [];
    parDate[l.date].push(l);
  });

  // Phase 91.47 — branche jours fériés depuis window.cal16.feriesDeLAnnee (sync avec Calendrier opérationnel)
  const feriesMap = {};
  try {
    if (window.cal16 && typeof window.cal16.feriesDeLAnnee === 'function') {
      window.cal16.feriesDeLAnnee(annee).forEach(f => {
        const k = f.date.getFullYear() + '-' + String(f.date.getMonth()+1).padStart(2,'0') + '-' + String(f.date.getDate()).padStart(2,'0');
        feriesMap[k] = f.nom;
      });
    }
  } catch (_) {}

  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function renderCell(d, ds, livs, isAutreMois) {
    const isAuj = ds === auj;
    const ferieNom = feriesMap[ds];
    const cls = ['cal-day'];
    if (isAutreMois) cls.push('autre-mois');
    if (isAuj) cls.push('today');
    if (livs.length) cls.push('has-livraisons');
    if (ferieNom) cls.push('has-ferie');
    const items = livs.slice(0, 3).map(l => {
      const statutCls = l.statut === 'livre' ? 'livre' : l.statut === 'en-cours' ? 'cours' : '';
      return `<div class="cal-liv-item ${statutCls}" title="${escHtml(l.client||'')}">${escHtml((l.client||'').substring(0,12))}</div>`;
    }).join('');
    const extra = livs.length > 3 ? `<div class="cal-liv-item more">+${livs.length-3}</div>` : '';
    const ferieTag = ferieNom ? `<div class="cal-day-ferie-tag" title="${escHtml(ferieNom)}">☆ ${escHtml(ferieNom)}</div>` : '';
    return `<div class="${cls.join(' ')}" onclick="filtrerCalJour('${ds}')">
      <div class="cal-day-num">${d}</div>
      ${ferieTag}
      <div class="cal-liv-dot">${items}${extra}</div>
    </div>`;
  }

  const joursEnTete = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let html = joursEnTete.map(j => `<div class="cal-header-day">${j}</div>`).join('');

  // Cases vides avant le 1er
  for (let i = 0; i < offset; i++) {
    const d = new Date(annee, mois, -offset+i+1);
    const ds = d.toLocalISODate();
    html += renderCell(d.getDate(), ds, parDate[ds]||[], true);
  }

  // Jours du mois
  for (let d = 1; d <= nbJours; d++) {
    const ds = `${annee}-${String(mois+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    html += renderCell(d, ds, parDate[ds]||[], false);
  }

  // Cases vides après le dernier
  const total = offset + nbJours;
  const reste = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= reste; i++) {
    const d = new Date(annee, mois+1, i);
    const ds = d.toLocalISODate();
    html += renderCell(i, ds, [], true);
  }

  cal.innerHTML = html;
}

// MOVED -> script-core-navigation.js : calNaviguer

function filtrerCalJour(date) {
  changerVueLivraisons('tableau');
  const deb = document.getElementById('filtre-date-debut');
  const fin = document.getElementById('filtre-date-fin');
  if (deb) deb.value = date;
  if (fin) fin.value = date;
  afficherLivraisons();
  document.getElementById('barre-recherche-univ')?.blur();
  afficherToast(`Livraisons du ${new Date(date).toLocaleDateString('fr-FR', {day:'numeric',month:'long'})}`);
}

if (typeof window !== 'undefined') {
  window.afficherCalendrier = afficherCalendrier;
  window.filtrerCalJour = filtrerCalJour;
}
