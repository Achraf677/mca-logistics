/**
 * MCA Logistics — Releve km admin (récap périodique tous chauffeurs/véhicules) (Phase X — extraction script.js)
 *
 * Extracted from script.js L1163-1204 (2026-05-16).
 */

function afficherReleveKm() {
  const salaries = charger('salaries');
  const vehicules = charger('vehicules');
  const tb = document.getElementById('tb-releve-km');
  const range = getHeuresPeriodeRange();
  const tous = [];
  salaries.forEach(s => {
    charger('km_sal_'+s.id)
      .filter(e => (e.date || '') >= range.debut && (e.date || '') <= range.fin)
      .forEach(e => {
        const veh = vehicules.find(v => v.salId === s.id) || null;
        tous.push({ ...e, salNom: s.nom, salNumero: s.numero, vehId: veh?.id || '', vehNom: veh?.immat || '—' });
      });
  });
  tous.sort((a,b) => new Date(b.creeLe)-new Date(a.creeLe));
  if (!tous.length) {
    tb.innerHTML = emptyState('🛣️','Aucun relevé km',`Aucun relevé kilométrique sur ${range.label.toLowerCase()} (${range.datesLabel}).`);
    return;
  }
  tb.innerHTML = tous.map(e => {
    const modTag = e.modifie
      ? '<span style="font-size:.72rem;background:rgba(231,76,60,.12);color:#e74c3c;padding:1px 6px;border-radius:12px;margin-left:4px">✏️ Modifié</span>'
      : '';
    const kmDepart = e.kmDepart != null ? e.kmDepart.toLocaleString('fr-FR')+' km' : '—';
    const kmArrivee = e.kmArrivee != null ? e.kmArrivee.toLocaleString('fr-FR')+' km' : '—';
    const distance = e.kmArrivee != null
      ? ((e.distance || (e.kmArrivee - e.kmDepart)) || 0).toFixed(0)+' km'
      : 'En attente';
    return `<tr>
      <td><strong>${e.salNom}</strong> <span style="color:var(--text-muted);font-size:0.8rem">${e.salNumero||''}</span></td>
      <td>${e.vehId ? `<button type="button" class="table-link-button" onclick="ouvrirFicheVehiculeDepuisTableau('${e.vehId}')" title="Ouvrir le véhicule">${e.vehNom}</button>` : e.vehNom}</td>
      <td>${e.date}</td>
      <td>${kmDepart}</td>
      <td>${kmArrivee}</td>
      <td><strong style="color:var(--accent)">${distance}</strong>${modTag}</td>
      <td>
        <button class="btn-icon" onclick="ouvrirEditKmAdmin('${e.salId}','${e.id}')">✏️</button>
        <button class="btn-icon danger" onclick="supprimerKmAdmin('${e.salId}','${e.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

if (typeof window !== 'undefined') {
  window.afficherReleveKm = afficherReleveKm;
}
