/**
 * MCA Logistics — TCO Véhicule UI (Phase X.D — extraction script.js)
 *
 * Helpers d'affichage du Total Cost of Ownership véhicule :
 * - ouvrirTCO(vehId) : ouvre la modal #modal-tco et déclenche le rendu
 * - afficherTCO(vehId) : peuple #tco-detail avec la grille KPI
 *
 * Le calcul est délégué à calculerTCO() (déjà dans script-core-utils.js).
 *
 * Dependencies (globals) : charger, calculerTCO, openModal, euros.
 *
 * Extracted from script.js L2678-2684 + L3491-3506 (Phase X.D, 2026-05-16).
 */

function ouvrirTCO(vehId) {
  const veh = charger('vehicules').find(v => v.id === vehId);
  if (!veh) return;
  const lbl = document.getElementById('tco-veh-nom');
  if (lbl) lbl.textContent = `${veh.immat} — ${veh.modele || ''}`;
  afficherTCO(vehId);
  openModal('modal-tco');
}

function afficherTCO(vehId) {
  const veh = charger('vehicules').find(v => v.id === vehId);
  const tco = calculerTCO(vehId);
  const cont = document.getElementById('tco-detail');
  if (!cont || !veh) return;

  cont.innerHTML = `
    <div style="font-size:.9rem;font-weight:600;margin-bottom:12px">TCO — ${veh.immat} ${veh.modele || ''}</div>
    <div class="tco-grid">
      <div class="tco-item"><div class="tco-label">Acquisition HT</div><div class="tco-value" style="color:#4f8ef7">${euros(tco.achatHT)}</div></div>
      <div class="tco-item"><div class="tco-label">⛽ Carburant</div><div class="tco-value" style="color:#e74c3c">${euros(tco.totalCarb)}</div></div>
      <div class="tco-item"><div class="tco-label">Entretiens</div><div class="tco-value" style="color:var(--accent)">${euros(tco.totalEntr)}</div></div>
      <div class="tco-item"><div class="tco-label">Autres charges</div><div class="tco-value" style="color:#9b59b6">${euros(tco.totalCharg)}</div></div>
      <div class="tco-item" style="border:1px solid var(--border)"><div class="tco-label">Total TCO</div><div class="tco-value" style="color:var(--text-primary)">${euros(tco.total)}</div></div>
    </div>`;
}

if (typeof window !== 'undefined') {
  window.ouvrirTCO = ouvrirTCO;
  window.afficherTCO = afficherTCO;
}
