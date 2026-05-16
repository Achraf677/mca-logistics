/**
 * MCA Logistics — Module Core-postes (Phase X.A — extraction script.js)
 *
 * Gestion des postes / fonctions (CRUD localStorage + UI Paramètres).
 * Toutes les fonctions exposées au scope global via `window.X = X` pour préserver
 * la compat avec les onclick="X()" du HTML.
 *
 * À charger APRÈS script-core-storage.js (qui définit loadSafe + sauvegarderPostes)
 * et AVANT script.js (qui appelait ces fns en interne — désormais ré-exposées globalement).
 *
 * Extracted from script.js L3404-3454 (Phase X.A, 2026-05-16).
 */

function getPostes() { return loadSafe('postes', ["Livreur", "Dispatcher"]); }

function afficherPostes() {
  const postes = getPostes();
  const cont = document.getElementById('liste-postes');
  if (!cont) return;
  cont.innerHTML = postes.map((p, i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(230,57,70,.1);border:1px solid rgba(230,57,70,.25);color:var(--accent);padding:5px 12px;border-radius:20px;font-size:.82rem;font-weight:600">
      ${p}
      <button onclick="supprimerPoste(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:.9rem;padding:0;line-height:1" title="Supprimer">✕</button>
    </span>`).join('');
  // Mettre à jour les selects de poste partout
  majSelectsPostes();
}

function ajouterPoste() {
  const input = document.getElementById('nouveau-poste');
  const nom = input?.value.trim();
  if (!nom) { afficherToast('⚠️ Nom du poste vide', 'error'); return; }
  const postes = getPostes();
  if (postes.find(p => p.toLowerCase() === nom.toLowerCase())) { afficherToast('⚠️ Ce poste existe déjà', 'error'); return; }
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
  afficherToast('Poste supprimé');
}

function majSelectsPostes() {
  const postes = getPostes();
  ['nsal-poste', 'edit-sal-poste'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const v = sel.value;
    if (sel.tagName === 'SELECT') {
      sel.innerHTML = '<option value="">-- Choisir un poste --</option>';
      postes.forEach(p => { sel.innerHTML += `<option value="${p}">${p}</option>`; });
      sel.value = v;
    }
  });
}

// Exposition globale (compat onclick HTML)
if (typeof window !== 'undefined') {
  window.getPostes = getPostes;
  window.afficherPostes = afficherPostes;
  window.ajouterPoste = ajouterPoste;
  window.supprimerPoste = supprimerPoste;
  window.majSelectsPostes = majSelectsPostes;
}
