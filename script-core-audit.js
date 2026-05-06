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
  let logs = charger('audit_log');
  logs = purgerLogsAuditAnciens(logs);
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

// Purge RGPD : on retire les entrees plus vieilles que SEUIL_MOIS (12 par
// defaut). Conformite : conserver indefiniment des logs nominatifs n'est
// pas justifie hors obligation legale specifique. Pour les logs > 12 mois,
// considerer un archivage hors-ligne si besoin metier.
const AUDIT_LOG_RETENTION_MOIS = 12;
function purgerLogsAuditAnciens(logs) {
  if (!Array.isArray(logs) || !logs.length) return logs || [];
  const limite = new Date();
  limite.setMonth(limite.getMonth() - AUDIT_LOG_RETENTION_MOIS);
  return logs.filter(function(l) {
    if (!l || !l.date) return false;
    const d = new Date(l.date);
    return !isNaN(d) && d >= limite;
  });
}

// Boot : purge une fois au chargement (au cas ou l'app reste fermee
// longtemps et qu'aucune nouvelle action ne declenche la purge via
// ajouterEntreeAudit).
(function purgeAuditAuBoot() {
  if (typeof window === 'undefined') return;
  try {
    const before = (charger('audit_log') || []).length;
    if (before === 0) return;
    const apres = purgerLogsAuditAnciens(charger('audit_log'));
    if (apres.length < before) {
      sauvegarder('audit_log', apres);
      console.info('[audit] purge boot : ' + (before - apres.length) + ' entrees > ' + AUDIT_LOG_RETENTION_MOIS + ' mois supprimees');
    }
  } catch (_) { /* fail silent : non bloquant */ }
})();

// State pagination journal d'audit (memoire process)
// Note : le journal d'audit est stocke en localStorage (cle 'audit_log'),
// capacite limitee a 400 entrees (cf ajouterEntreeAudit). La pagination
// reste donc strictement client-side mais permet de naviguer la totalite
// au lieu d'etre coupee a 40 lignes comme avant.
window.__auditLogPageState = window.__auditLogPageState || { page: 1, pageSize: 50 };

// L322 (script.js d'origine)
function afficherJournalAudit() {
  const tb = document.getElementById('tb-audit-log');
  if (!tb) return;
  const allLogs = charger('audit_log').slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  if (!allLogs.length) {
    tb.innerHTML = '<tr><td colspan="4" class="empty-row">Aucune action journalisée</td></tr>';
    const navEl0 = document.getElementById('audit-log-pagination');
    if (navEl0) navEl0.innerHTML = '';
    return;
  }
  const st = window.__auditLogPageState;
  const pageSize = Math.max(1, parseInt(st.pageSize, 10) || 50);
  const totalPages = Math.max(1, Math.ceil(allLogs.length / pageSize));
  if (st.page > totalPages) st.page = totalPages;
  if (st.page < 1) st.page = 1;
  const start = (st.page - 1) * pageSize;
  const slice = allLogs.slice(start, start + pageSize);

  tb.innerHTML = slice.map(function(log) {
    return '<tr>'
      + '<td style="white-space:nowrap">' + formatDateHeureExport(log.date) + '</td>'
      + '<td>' + (log.admin || 'Admin') + '</td>'
      + '<td><strong>' + (log.action || 'Action') + '</strong></td>'
      + '<td style="font-size:.84rem;color:var(--text-muted)">' + (log.detail || '—') + '</td>'
      + '</tr>';
  }).join('');

  // Barre de pagination (cree si absente, reutilise si presente)
  let navEl = document.getElementById('audit-log-pagination');
  if (!navEl) {
    const tbl = tb.closest('table');
    const wrap = (tbl && tbl.parentElement) || tb.parentElement;
    if (wrap) {
      navEl = document.createElement('div');
      navEl.id = 'audit-log-pagination';
      navEl.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;padding:8px 12px;background:var(--card,#1c1f2b);border-radius:8px;flex-wrap:wrap';
      wrap.appendChild(navEl);
    }
  }
  if (navEl) {
    const end = Math.min(start + pageSize, allLogs.length);
    const sizeOpts = [25, 50, 100, 250].map(n =>
      '<option value="' + n + '"' + (n === pageSize ? ' selected' : '') + '>' + n + ' / page</option>'
    ).join('');
    navEl.innerHTML =
      '<div style="font-size:.82rem;color:var(--text-muted)">Affichage <strong>' + (start + 1) + '–' + end + '</strong> sur <strong>' + allLogs.length + '</strong> · Page <strong>' + st.page + '</strong> / ' + totalPages + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
        + '<button type="button" data-audit-go="first" ' + (st.page <= 1 ? 'disabled' : '') + ' style="padding:5px 9px;border-radius:6px;background:var(--bg-dark,#14161f);border:1px solid var(--border,#2a2d3d);color:var(--text,#e8eaf0);cursor:pointer">«</button>'
        + '<button type="button" data-audit-go="prev"  ' + (st.page <= 1 ? 'disabled' : '') + ' style="padding:5px 9px;border-radius:6px;background:var(--bg-dark,#14161f);border:1px solid var(--border,#2a2d3d);color:var(--text,#e8eaf0);cursor:pointer">‹</button>'
        + '<button type="button" data-audit-go="next"  ' + (st.page >= totalPages ? 'disabled' : '') + ' style="padding:5px 9px;border-radius:6px;background:var(--bg-dark,#14161f);border:1px solid var(--border,#2a2d3d);color:var(--text,#e8eaf0);cursor:pointer">›</button>'
        + '<button type="button" data-audit-go="last"  ' + (st.page >= totalPages ? 'disabled' : '') + ' style="padding:5px 9px;border-radius:6px;background:var(--bg-dark,#14161f);border:1px solid var(--border,#2a2d3d);color:var(--text,#e8eaf0);cursor:pointer">»</button>'
        + '<select id="audit-page-size" style="padding:5px 7px;border-radius:6px;background:var(--bg-dark,#14161f);border:1px solid var(--border,#2a2d3d);color:var(--text,#e8eaf0);margin-left:6px">' + sizeOpts + '</select>'
      + '</div>';
    if (!navEl.dataset.bound) {
      navEl.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-audit-go]');
        if (!btn || btn.disabled) return;
        const act = btn.getAttribute('data-audit-go');
        const cur = window.__auditLogPageState;
        const total = Math.max(1, Math.ceil(charger('audit_log').length / Math.max(1, cur.pageSize)));
        if (act === 'first') cur.page = 1;
        else if (act === 'prev') cur.page = Math.max(1, cur.page - 1);
        else if (act === 'next') cur.page = Math.min(total, cur.page + 1);
        else if (act === 'last') cur.page = total;
        afficherJournalAudit();
      });
      navEl.addEventListener('change', function (e) {
        const sel = e.target.closest('#audit-page-size');
        if (!sel) return;
        window.__auditLogPageState.pageSize = parseInt(sel.value, 10) || 50;
        window.__auditLogPageState.page = 1;
        afficherJournalAudit();
      });
      navEl.dataset.bound = '1';
    }
  }
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

