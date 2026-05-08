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

// Badge prioritaire (parite mobile M.priorityBadge)
function priorityBadgeAgent(p) {
  if (p === 'haute') return '<span style="background:rgba(231,76,60,0.18);color:#ff8b80;padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:700">HAUTE</span>';
  if (p === 'opportunite') return '<span style="background:rgba(46,204,113,0.18);color:#7ed8a3;padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:700">OPPORTUNITÉ</span>';
  return '<span style="background:rgba(52,152,219,0.18);color:#7ec0ff;padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:700">INFO</span>';
}

// L2007 — design aligne avec la sheet mobile (M.openBriefSheet)
function afficherDecisionsAgent() {
  const decisions = loadSafe('agent_decisions', []);
  const container = document.getElementById('agent-decisions-list');
  if (!container) return;
  if (!decisions.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#7c8299">
        <div style="font-size:2.5rem;margin-bottom:12px">✨</div>
        <div style="font-size:.95rem;margin-bottom:6px;font-weight:600;color:#e8eaf0">Aucune décision en attente</div>
        <div style="font-size:.8rem">Le brief Gemini scanne tes données automatiquement à chaque session.</div>
      </div>`;
    return;
  }
  const couleurs = { haute: 'rgba(231,76,60,0.45)', opportunite: 'rgba(46,204,113,0.4)', info: 'rgba(52,152,219,0.35)' };
  container.innerHTML = decisions.map(d => {
    const couleurBord = couleurs[d.priorite] || '#2a2d3d';
    const lu = d.lu ? '' : 'border-left:3px solid #e63946;';
    const sourceTag = d.source === 'ai-brief' ? ' · IA' : '';
    const actions = (d.actions || []).map(a => `<button onclick="executerActionAgent('${d.id}','${a.id}')" style="background:${a.style === 'primary' ? '#f5a623' : 'rgba(255,255,255,0.08)'};color:${a.style === 'primary' ? '#000' : '#e8eaf0'};border:1px solid ${a.style === 'primary' ? '#f5a623' : '#2a2d3d'};border-radius:8px;padding:6px 12px;font-size:.78rem;font-weight:600;cursor:pointer">${a.label}</button>`).join('');
    // Bouton "Discuter avec l'IA" (parite mobile) — ouvre le chatbot avec un
    // message pre-rempli construit a partir de la decision. Permet a Achraf
    // de creuser une decision sans retaper le contexte.
    const btnDiscuter = `<button type="button" onclick="discuterDecisionAvecIA('${d.id}')" style="background:rgba(255,255,255,0.08);color:#e8eaf0;border:1px solid #2a2d3d;border-radius:8px;padding:6px 12px;font-size:.78rem;font-weight:600;cursor:pointer">💬 Discuter</button>`;
    return `
      <div style="background:#2a2f37;border:1px solid ${couleurBord};${lu}border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
          <div style="font-size:.88rem;font-weight:700;color:#f1f3f5;flex:1">${d.titre}</div>
          ${priorityBadgeAgent(d.priorite)}
        </div>
        <div style="font-size:.82rem;color:#adb5bd;line-height:1.5;margin-bottom:10px">${d.description}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">${actions}${btnDiscuter}</div>
        <div style="font-size:.7rem;color:#7c8299;opacity:0.7">${new Date(d.creeLe).toLocaleString('fr-FR')}${sourceTag}</div>
      </div>`;
  }).join('');
}

// Ouvre le chatbot IA (window.AIChat.open) avec un message pre-rempli a partir
// d'une decision agent, et auto-soumet. Utilise pour le bouton "Discuter avec l'IA"
// dans le panneau-agent.
function discuterDecisionAvecIA(decisionId) {
  try {
    const decisions = loadSafe('agent_decisions', []);
    const d = decisions.find(x => x.id === decisionId);
    if (!d) { afficherToast('⚠️ Décision introuvable'); return; }
    const message = `[Décision agent : ${d.priorite || 'info'}]\n${d.titre}\n\n${d.description}\n\nQue me conseilles-tu de faire ?`;
    if (!window.AIChat || typeof window.AIChat.open !== 'function') {
      afficherToast('⚠️ Chatbot indisponible'); return;
    }
    window.AIChat.open();
    // Ferme le panneau-agent pour focus sur le chat (panneau-agent flotte au-dessus du chat sinon)
    try { togglePanneauAgent(); } catch (_) { /* ignore */ }
    // Injecte le message dans la textarea et auto-soumet apres l'animation d'ouverture (~300ms)
    setTimeout(() => {
      const input = document.getElementById('ai-chat-input');
      const form = document.getElementById('ai-chat-form');
      if (!input || !form) return;
      input.value = message;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
      form.requestSubmit();
    }, 360);
  } catch (e) {
    console.warn('[discuterDecisionAvecIA]', e);
    if (typeof afficherToast === 'function') afficherToast('⚠️ Erreur ouverture chat');
  }
}

if (typeof window !== 'undefined') {
  window.discuterDecisionAvecIA = discuterDecisionAvecIA;
}

// Marque toutes les decisions comme lues (parite mobile sheet "Tout marquer lu")
function marquerToutesDecisionsLues() {
  const decisions = loadSafe('agent_decisions', []);
  let modif = false;
  decisions.forEach(d => { if (!d.lu) { d.lu = true; modif = true; } });
  if (!modif) { afficherToast('Aucune nouvelle decision a marquer lue'); return; }
  localStorage.setItem('agent_decisions', JSON.stringify(decisions));
  afficherDecisionsAgent();
  majBadgeAgent();
  afficherToast('✓ Toutes les decisions marquees lues');
}

// Efface toutes les decisions (parite mobile sheet "Tout effacer")
function effacerToutesDecisions() {
  const decisions = loadSafe('agent_decisions', []);
  if (!decisions.length) return;
  if (!confirm('Effacer toutes les decisions ?')) return;
  localStorage.setItem('agent_decisions', JSON.stringify([]));
  afficherDecisionsAgent();
  majBadgeAgent();
  afficherToast('🗑 Decisions effacees');
}

if (typeof window !== 'undefined') {
  window.marquerToutesDecisionsLues = marquerToutesDecisionsLues;
  window.effacerToutesDecisions = effacerToutesDecisions;
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

// =============================================================
// PR C — Brief automatique IA (panneau-agent)
// Appelle l'edge function ai-brief, parse les decisions et les
// pousse dans agent_decisions via ajouterDecisionAgent().
// Triggers : on_login (1x/jour/session), manual (bouton refresh).
// =============================================================
const AI_BRIEF_LAST_RUN_KEY = 'ai_brief_last_run';
const AI_BRIEF_PENDING_KEY = '__delivproAiBriefPending';

async function lancerBriefAuto(trigger) {
  if (window[AI_BRIEF_PENDING_KEY]) return { skipped: 'pending' };
  window[AI_BRIEF_PENDING_KEY] = true;
  try {
    if (trigger === 'manual') {
      afficherToast('🔄 Brief IA en cours…');
    }
    const client = window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
    const config = window.DelivProSupabase && window.DelivProSupabase.getConfig
      ? window.DelivProSupabase.getConfig()
      : null;
    if (!client || !config?.url) {
      console.warn('[ai-brief] Supabase pas pret');
      return { error: 'supabase_not_ready' };
    }
    let token = null;
    try {
      const { data: sessionData } = await client.auth.getSession();
      const sess = sessionData && sessionData.session;
      const expAt = sess && sess.expires_at ? sess.expires_at * 1000 : 0;
      if (sess && expAt && expAt - Date.now() < 60000) {
        try {
          const { data: refreshed } = await client.auth.refreshSession();
          token = refreshed && refreshed.session ? refreshed.session.access_token : sess.access_token;
        } catch (_) { token = sess.access_token; }
      } else {
        token = sess ? sess.access_token : null;
      }
    } catch (_) { /* fail-soft */ }
    if (!token) {
      console.warn('[ai-brief] pas de token utilisateur');
      return { error: 'no_token' };
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    let r;
    try {
      r = await fetch(config.url + '/functions/v1/ai-brief', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: trigger || 'manual' }),
        signal: ctrl.signal,
      });
    } catch (e) {
      console.warn('[ai-brief] reseau', e);
      if (trigger === 'manual') afficherToast('⚠️ Brief IA : réseau indisponible');
      return { error: 'network' };
    } finally { clearTimeout(t); }
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.warn('[ai-brief] HTTP ' + r.status, body);
      if (trigger === 'manual') afficherToast('⚠️ Brief IA : ' + (body.message || body.error || ('HTTP ' + r.status)));
      return { error: 'http', status: r.status, body };
    }
    const decisions = Array.isArray(body.decisions) ? body.decisions : [];
    let added = 0;
    for (const d of decisions) {
      if (!d || !d.titre || !d.description) continue;
      // Dedup : evite de re-pousser une decision strictement identique pendant
      // les 24h precedentes (titre + description identique = meme alerte que
      // hier matin). On supprime l'ancienne si elle existe et n'a pas eu
      // d'action pour la rafraichir avec la version d'aujourd'hui.
      const existantes = loadSafe('agent_decisions', []);
      const dejaPresente = existantes.find(
        e => e.titre === d.titre && e.description === d.description && !e.actionPrise
      );
      if (dejaPresente) continue;
      ajouterDecisionAgent({
        titre: d.titre,
        description: d.description,
        priorite: d.priorite || 'info',
        actions: Array.isArray(d.actions) ? d.actions : [],
        source: 'ai-brief',
        run_id: body.run_id || null,
      });
      added++;
    }
    // Gate session : 1x par session de login (sessionStorage). Avant on stockait
    // la date dans localStorage : un manuel le matin bloquait l'auto-trigger
    // jusqu'au lendemain meme apres logout/login.
    try {
      sessionStorage.setItem(AI_BRIEF_LAST_RUN_KEY, '1');
    } catch (_) {}
    // MAJ libelle "derniere analyse"
    const lastEl = document.getElementById('agent-last-check');
    if (lastEl) {
      const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      lastEl.textContent = `Dernière analyse : ${heure} (${decisions.length} décision${decisions.length > 1 ? 's' : ''})`;
    }
    if (trigger === 'manual') {
      afficherToast(added > 0 ? `✅ Brief IA : ${added} nouvelle(s) décision(s)` : '✅ Brief IA : rien de nouveau');
    }
    return { ok: true, added, total: decisions.length };
  } catch (e) {
    console.warn('[ai-brief] erreur', e);
    if (trigger === 'manual') afficherToast('⚠️ Brief IA : erreur (voir console)');
    return { error: 'exception', message: String(e) };
  } finally {
    window[AI_BRIEF_PENDING_KEY] = false;
  }
}

// Auto-trigger au boot admin : 1x par chargement de page.
// Gate runtime (window flag) pour eviter le double-fire au sein du meme
// boot. Le flag se reset naturellement a chaque F5 ou reload, ce qui
// re-declenche le brief — comportement attendu par Achraf.
function declencherBriefAutoLoginSiNecessaire() {
  try {
    // Reservé admin : le panneau-agent n'existe que sur admin.html.
    if (!document.getElementById('panneau-agent')) return;
    if (window.__briefAutoTriggered) return; // deja fait dans ce boot
    // Attend que l'auth soit pretes — peut arriver apres DOMContentLoaded
    // car la session Supabase est resolue en async. On poll toutes les 500ms
    // pendant max 10s en attendant role=admin.
    const start = Date.now();
    const tick = () => {
      const role = sessionStorage.getItem('role') || '';
      if (role === 'admin') {
        window.__briefAutoTriggered = true;
        setTimeout(() => { lancerBriefAuto('on_login'); }, 1000);
        return;
      }
      if (Date.now() - start > 10000) return; // timeout : pas admin, on abandonne
      setTimeout(tick, 500);
    };
    tick();
  } catch (_) { /* fail-soft */ }
}

// Bouton refresh manuel (cable depuis admin.html via onclick).
function rafraichirBriefAgent() {
  return lancerBriefAuto('manual');
}

window.lancerBriefAuto = lancerBriefAuto;
window.rafraichirBriefAgent = rafraichirBriefAgent;
window.declencherBriefAutoLoginSiNecessaire = declencherBriefAutoLoginSiNecessaire;

// Auto-boot : declenche au DOMContentLoaded si admin.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Petit delai pour laisser DelivProSupabase s'initialiser.
      setTimeout(declencherBriefAutoLoginSiNecessaire, 1500);
    });
  } else {
    setTimeout(declencherBriefAutoLoginSiNecessaire, 1500);
  }
}

