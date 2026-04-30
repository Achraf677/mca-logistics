/**
 * MCA Logistics — Module Core-recherche
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L3020 (script.js d'origine)
function ouvrirRechercheGlobale() {
  var modal = document.getElementById('modal-recherche-globale');
  var input = document.getElementById('barre-recherche-univ');
  if (!modal || !input) return;
  modal.classList.add('open');
  setTimeout(function() { input.focus(); input.select(); }, 30);
}

// L3027 (script.js d'origine)
function fermerRechercheGlobale() {
  var modal = document.getElementById('modal-recherche-globale');
  if (modal) modal.classList.remove('open');
  fermerRecherche();
}

// L3034 (script.js d'origine)
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

// L3062 (script.js d'origine)
function fermerRecherche() {
  const el = document.getElementById('recherche-resultats');
  if (el) el.style.display='none';
  const input = document.getElementById('barre-recherche-univ');
  if (input) input.value = '';
}

