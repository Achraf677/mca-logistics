/**
 * MCA Logistics — Module Core-audit
 *
 * Extrait de script.js (decomposition modulaire).
 * Toutes les fonctions restent au scope global (window.*) pour conserver la
 * compatibilite avec les onclick="X()" du HTML.
 *
 * A charger AVANT script.js dans admin.html.
 */

// L304 (script.js d'origine)
function getAuditActorLabel() {
  const sessionAdmin = typeof getAdminSession === 'function' ? getAdminSession() : {};
  return sessionAdmin.nom || sessionAdmin.identifiant || sessionAdmin.email || 'Admin';
}

// L308 (script.js d'origine)
function ajouterEntreeAudit(action, detail, meta) {
  const logs = charger('audit_log');
  logs.push({
    id: genId(),
    date: new Date().toISOString(),
    admin: getAuditActorLabel(),
    action: action || 'Action',
    detail: detail || '—',
    meta: meta || {}
  });
  while (logs.length > 400) logs.shift();
  sauvegarder('audit_log', logs);
  if (typeof afficherJournalAudit === 'function' && window.__delivproCurrentPage === 'parametres') afficherJournalAudit();
}

// L322 (script.js d'origine)
function afficherJournalAudit() {
  const tb = document.getElementById('tb-audit-log');
  if (!tb) return;
  const logs = charger('audit_log').slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 40);
  if (!logs.length) {
    tb.innerHTML = '<tr><td colspan="4" class="empty-row">Aucune action journalisée</td></tr>';
    return;
  }
  tb.innerHTML = logs.map(function(log) {
    return '<tr>'
      + '<td style="white-space:nowrap">' + formatDateHeureExport(log.date) + '</td>'
      + '<td>' + (log.admin || 'Admin') + '</td>'
      + '<td><strong>' + (log.action || 'Action') + '</strong></td>'
      + '<td style="font-size:.84rem;color:var(--text-muted)">' + (log.detail || '—') + '</td>'
      + '</tr>';
  }).join('');
}

// L340 (script.js d'origine)
async function viderJournalAudit() {
  const ok = await confirmDialog('Vider le journal d’audit ? Cette action supprime l’historique local enregistré.', { titre:'Journal d’audit', icone:'📜', btnLabel:'Vider' });
  if (!ok) return;
  sauvegarder('audit_log', []);
  afficherJournalAudit();
  afficherToast('🗑️ Journal d’audit vidé');
}

// L1975 (script.js d'origine)
function togglePanneauAgent() {
  const panneau = document.getElementById('panneau-agent');
  const overlay = document.getElementById('panneau-agent-overlay');
  if (!panneau) return;
  const isOpen = panneau.style.right === '0px';
  panneau.style.right = isOpen ? '-420px' : '0px';
  overlay.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const decisions = loadSafe('agent_decisions', []);
    decisions.forEach(d => d.lu = true);
    localStorage.setItem('agent_decisions', JSON.stringify(decisions));
    majBadgeAgent();
  }
}

// L1990 (script.js d'origine)
function majBadgeAgent() {
  const decisions = loadSafe('agent_decisions', []);
  const nonLues = decisions.filter(d => !d.lu).length;
  const badge = document.getElementById('ai-decisions-badge');
  if (!badge) return;
  badge.textContent = nonLues;
  badge.style.display = nonLues > 0 ? 'inline-block' : 'none';
}

// L1999 (script.js d'origine)
function ajouterDecisionAgent(decision) {
  const decisions = loadSafe('agent_decisions', []);
  decisions.unshift({ ...decision, id: genId(), creeLe: new Date().toISOString(), lu: false });
  localStorage.setItem('agent_decisions', JSON.stringify(decisions));
  majBadgeAgent();
  afficherDecisionsAgent();
}

// L2007 (script.js d'origine)
function afficherDecisionsAgent() {
  const decisions = loadSafe('agent_decisions', []);
  const container = document.getElementById('agent-decisions-list');
  if (!container) return;
  if (!decisions.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#7c8299"><div style="font-size:2rem;margin-bottom:12px">✅</div><div style="font-size:.88rem">Aucune décision en attente</div></div>';
    return;
  }
  const couleurs = { haute: 'rgba(231,76,60,0.4)', opportunite: 'rgba(46,204,113,0.4)', info: 'rgba(52,152,219,0.3)' };
  container.innerHTML = decisions.map(d => `
    <div style="background:rgba(255,255,255,0.04);border:1px solid ${couleurs[d.priorite] || '#2a2d3d'};border-radius:12px;padding:16px;margin-bottom:12px;${!d.lu ? 'border-left:3px solid #f5a623' : ''}">
      <div style="font-size:.82rem;font-weight:700;margin-bottom:6px;color:#e8eaf0">${d.titre}</div>
      <div style="font-size:.78rem;color:#7c8299;margin-bottom:12px;line-height:1.5">${d.description}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(d.actions || []).map(a => `<button onclick="executerActionAgent('${d.id}','${a.id}')" style="background:${a.style === 'primary' ? '#f5a623' : 'rgba(255,255,255,0.08)'};color:${a.style === 'primary' ? '#000' : '#e8eaf0'};border:1px solid ${a.style === 'primary' ? '#f5a623' : '#2a2d3d'};border-radius:8px;padding:6px 12px;font-size:.78rem;font-weight:600;cursor:pointer">${a.label}</button>`).join('')}
      </div>
      <div style="font-size:.7rem;color:#7c8299;margin-top:10px">${new Date(d.creeLe).toLocaleString('fr-FR')}</div>
    </div>
  `).join('');
}

// L2028 (script.js d'origine)
function executerActionAgent(decisionId, actionId) {
  const decisions = loadSafe('agent_decisions', []);
  const idx = decisions.findIndex(d => d.id === decisionId);
  if (idx === -1) return;
  decisions[idx].lu = true;
  decisions[idx].actionPrise = actionId;
  decisions[idx].actionLe = new Date().toISOString();
  localStorage.setItem('agent_decisions', JSON.stringify(decisions));
  afficherDecisionsAgent();
  majBadgeAgent();
  afficherToast('✅ Action enregistrée');
}

