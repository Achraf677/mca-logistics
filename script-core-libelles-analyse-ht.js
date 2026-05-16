/**
 * MCA Logistics — Appliquer libellés Analyse HT sur cards KPIs (rent + stats) (Phase X — extraction script.js)
 *
 * Extracted from script.js L982-1010 (2026-05-16).
 */

function appliquerLibellesAnalyseHT() {
  const rent = {
    'rent-ca': "Chiffre d'affaires HT",
    'rent-carb': 'Dépenses carburant HT',
    'rent-entretien': 'Dépenses entretien HT',
    'rent-cout-km': 'Coût HT par kilomètre',
    'rent-profit': 'Profit net estimé HT'
  };
  Object.entries(rent).forEach(([id, label]) => {
    const card = document.getElementById(id)?.closest('.kpi-card');
    const target = card?.querySelector('.kpi-label');
    if (target) target.textContent = label;
  });
  const stats = {
    'stats-ca-periode': 'CA période HT',
    'stats-panier-moyen': 'Panier moyen HT'
  };
  Object.entries(stats).forEach(([id, label]) => {
    const card = document.getElementById(id)?.closest('.kpi-card');
    const target = card?.querySelector('.kpi-label');
    if (target) target.textContent = label;
  });
  const rentTitle = document.getElementById('chartRentabilite')?.closest('.card')?.querySelector('.card-header h2');
  if (rentTitle) rentTitle.textContent = 'Répartition des dépenses HT';
  const statsTitle = document.getElementById('chartCA')?.closest('.card')?.querySelector('.card-header h2');
  if (statsTitle) statsTitle.textContent = 'Évolution du CA HT';
  const statsDriverTitle = document.getElementById('chartCAParChauffeur')?.closest('.card')?.querySelector('.card-header h2');
  if (statsDriverTitle) statsDriverTitle.textContent = 'CA HT par chauffeur (détail)';
}

if (typeof window !== 'undefined') {
  window.appliquerLibellesAnalyseHT = appliquerLibellesAnalyseHT;
}
