/**
 * MCA Logistics — Fiche de tournée journalière PDF (Phase X.J — extraction script.js)
 *
 * Génère un PDF imprimable d'une tournée chauffeur pour un jour donné :
 * - en-tête entreprise + date
 * - bloc chauffeur + véhicule (auto-résolu via vehicules.salId)
 * - 2 KPIs (nb livraisons, km estimés)
 * - tableau détail livraisons (statut emoji)
 * - zone observations / signature
 *
 * Ouvre fenêtre popup avec window.print() après 400ms.
 *
 * Dependencies (globals) : aujourdhui, charger, getEntrepriseExportParams,
 * formatDateExport, formatDateHeureExport, renderBlocInfosEntreprise,
 * ouvrirPopupSecure, afficherToast.
 *
 * Extracted from script.js L2858-2947 (Phase X.J, 2026-05-16).
 */

function genererFicheTournee(salId, date) {
  date = date || aujourdhui();
  const salaries   = charger('salaries');
  const sal        = salaries.find(s => s.id === salId);
  if (!sal) return;
  const livraisons = charger('livraisons').filter(l => l.chaufId === salId && l.date === date);
  const params     = getEntrepriseExportParams();
  const nom        = params.nom;
  const dateLabel  = formatDateExport(date);
  const veh        = charger('vehicules').find(v => v.salId === salId);
  const dateExp    = formatDateHeureExport();
  const totalKm    = livraisons.reduce((s,l)=>s+(l.distance||0),0);

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:0 auto;padding:32px;color:#1a1d27">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #e63946;margin-bottom:24px">
      <div>
        <div style="font-size:1.4rem;font-weight:800;color:#e63946">${nom}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.8rem;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Fiche de tournée</div>
        <div style="font-size:1rem;font-weight:700">${dateLabel}</div>
      </div>
    </div>
    ${renderBlocInfosEntreprise(params)}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:#f8f9fc;border-radius:10px;padding:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Chauffeur</div>
        <div style="font-size:1rem;font-weight:700">${sal.nom}</div>
        ${sal.tel?`<div style="font-size:.82rem;color:#6b7280">${sal.tel}</div>`:''}
      </div>
      <div style="background:#f8f9fc;border-radius:10px;padding:14px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Véhicule</div>
        <div style="font-size:1rem;font-weight:700">${veh?.immat||'Non affecté'}</div>
        <div style="font-size:.82rem;color:#6b7280">${veh?.modele||''}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px">
      ${[
        ['Livraisons', livraisons.length],
        ['Km estimés', totalKm+' km'],
      ].map(([l,v])=>`<div style="background:#f8f9fc;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:.72rem;color:#9ca3af;margin-bottom:4px">${l}</div>
        <div style="font-size:1.2rem;font-weight:800">${v}</div>
      </div>`).join('')}
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:10px">Détail des livraisons</div>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">#</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Client</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#6b7280">Adresse</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600;color:#6b7280">Km</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#6b7280">Statut</th>
        </tr></thead>
        <tbody>${livraisons.length === 0
          ? `<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af">Aucune livraison assignée</td></tr>`
          : livraisons.map((l,i)=>`
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:8px 12px;color:#9ca3af">${i+1}</td>
            <td style="padding:8px 12px;font-weight:600">${l.client}</td>
            <td style="padding:8px 12px;color:#6b7280;font-size:.82rem">${l.arrivee||l.depart||'—'}</td>
            <td style="padding:8px 12px;text-align:right">${l.distance?l.distance+' km':'—'}</td>
            <td style="padding:8px 12px;text-align:center">${l.statut==='livre'?'✅':l.statut==='en-cours'?'🚐':'⏳'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:20px;min-height:60px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Observations / Signature chauffeur</div>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:.72rem;color:#9ca3af">
      <span>${nom} — Page 1/1</span><span>${dateExp}</span><span>${params.tel || params.email || ''}</span>
    </div>
  </div>`;

  const win = ouvrirPopupSecure('', '_blank', 'width=850,height=950');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Tournée ${sal.nom} — ${date}</title>
    <style>body{margin:0;padding:20px;background:#fff} @page{margin:12mm}</style>
    </head><body>${html}<script>setTimeout(()=>{window.print();},400)<\/script></body></html>`);
  win.document.close();
  afficherToast('Fiche de tournée générée');
}

if (typeof window !== "undefined") {
  window.genererFicheTournee = genererFicheTournee;
}
