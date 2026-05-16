/**
 * MCA Logistics — Vue Kanban livraisons (drag & drop entre statuts) (Phase X — extraction script.js)
 *
 * Extracted from script.js L2101-2182 (2026-05-16).
 */

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
  // Phase 91.55 Bug B — chip "Brouillons" doit aussi matcher les livraisons legacy `statut === 'en-attente'`
  if (filtreStatut) livraisons = livraisons.filter(l => filtreStatut === 'brouillon'
    ? (l.statut === 'brouillon' || l.statut === 'en-attente' || l.brouillon === true)
    : l.statut === filtreStatut);
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

  const labels = { 'en-attente': '⏳ En attente', 'en-cours': 'En cours', 'livre': '✅ Livré' };
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
          : items.map(l => {
              // Phase 91.40 — escape pour éviter XSS via client/numLiv/chaufNom/arrivee (agent kanban #XSS)
              const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
              return `
            <div class="kanban-card" draggable="true"
              ondragstart="dragKanban(event,'${esc(l.id)}')"
              ondragend="document.querySelectorAll('.kanban-col-body').forEach(c=>c.classList.remove('drag-over'))"
              onclick="ouvrirEditLivraison('${esc(l.id)}')">
              <div class="kanban-card-client">${esc(l.client)}</div>
              <div class="kanban-card-sub">${esc(l.numLiv||'—')} · ${esc(l.date)}</div>
              ${l.chaufNom ? `<div class="kanban-card-sub">${esc(l.chaufNom)}</div>` : ''}
              ${l.arrivee  ? `<div class="kanban-card-sub">${esc(l.arrivee)}</div>` : ''}
              <div class="kanban-card-prix">${l.prix ? euros(l.prix) : 'Prix manquant'}</div>
            </div>`;
            }).join('')}
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

if (typeof window !== 'undefined') {
  window.afficherKanban = afficherKanban;
  window.dragKanban = dragKanban;
  window.dropKanban = dropKanban;
}
