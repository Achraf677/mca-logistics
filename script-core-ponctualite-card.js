/**
 * MCA Logistics — Card taux ponctualité dashboard (bar + 3 KPIs) (Phase X — extraction script.js)
 *
 * Extracted from script.js L2016-2039 (2026-05-16).
 */

function afficherPonctualite() {
  const cont = document.getElementById('ponctualite-container');
  if (!cont) return;
  const { taux, livrees, total } = calculerPonctualite();
  const color = taux>=90?'var(--green)':taux>=70?'var(--accent)':'var(--red)';
  cont.innerHTML = `
    <div class="card mt-20">
      <div class="card-header"><h2>Taux de ponctualité</h2><span style="font-size:1.3rem;font-weight:800;color:${color}">${taux}%</span></div>
      <div style="padding:16px">
        <div class="ponctualite-bar"><div class="ponctualite-fill" style="width:${taux}%;background:${color}"></div></div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:6px">${livrees} livrées sur ${total} assignées</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px">
          ${[
            ['✅ Livrées', livrees, 'var(--green)'],
            ['⏳ En attente', total-livrees, 'var(--accent)'],
            ['Taux', taux+'%', color]
          ].map(([l,v,c])=>`<div style="background:rgba(255,255,255,.03);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:${c}">${v}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${l}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

if (typeof window !== 'undefined') {
  window.afficherPonctualite = afficherPonctualite;
}
