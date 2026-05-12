/**
 * MCA Logistics — Panneau "Cout IA" (Sprint 2B)
 *
 * Ajoute dans Parametres admin (PC) un sous-panneau de suivi de la consommation
 * Gemini : cout du mois en cours, cap budget, requetes, mini-graph 30 jours,
 * liens monitoring + procedure de desactivation d'urgence.
 *
 * Source de donnees : table Supabase `public.ai_quota_daily` (RLS admin only).
 * Calcul cout (USD -> EUR ~0.92) :
 *   cost_eur = (pro_count * 0.0125 + flash_count * 0.0008) * 0.92
 *
 * Tarifs Gemini Tier 1 (moyens approximatifs mix in/out) :
 *   - Gemini 2.5 Pro   : ~$0.0125 / requete
 *   - Gemini 2.5 Flash : ~$0.0008 / requete
 *
 * Module front pur, pas de framework. Toutes fonctions exposees via window.*
 * Parite mobile dans script-mobile.js (route 'parametres').
 */
(function() {
  'use strict';

  // ---- Constantes prix ----
  var PRICE_PRO_USD   = 0.0125;
  var PRICE_FLASH_USD = 0.0008;
  var USD_TO_EUR      = 0.92;
  var BUDGET_CAP_EUR  = 5.00;

  // ---- Liens monitoring (cf. docs/access-tokens.md "Suivi consommation") ----
  var LINK_AI_STUDIO = 'https://aistudio.google.com/app/apikey';
  var LINK_BILLING   = 'https://console.cloud.google.com/billing/reports?project=budget-achraf';
  var LINK_QUOTAS    = 'https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=budget-achraf';
  var LINK_BUDGETS   = 'https://console.cloud.google.com/billing/budgets';

  // Liens procedure desactivation d'urgence
  var LINK_DISABLE_API     = 'https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/overview?project=budget-achraf';
  var LINK_DISABLE_BILLING = 'https://console.cloud.google.com/billing/linkedaccount?project=budget-achraf';
  var LINK_REVOKE_KEY      = 'https://aistudio.google.com/app/apikey';

  // ---- Helpers ----
  function fmtEur(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '0,00 €';
    return n.toFixed(2).replace('.', ',') + ' €';
  }
  function fmtInt(n) {
    if (typeof n !== 'number' || !isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('fr-FR');
  }
  function ymd(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var j = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + j;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d; }

  function calcCostEur(pro, flash) {
    return ((pro || 0) * PRICE_PRO_USD + (flash || 0) * PRICE_FLASH_USD) * USD_TO_EUR;
  }

  // Recupere le client Supabase (PC) en testant plusieurs entry points selon
  // l'ordre de boot : getSupabaseClientSafe (script-clients.js) puis fallback.
  function getClient() {
    try {
      if (typeof getSupabaseClientSafe === 'function') return getSupabaseClientSafe();
    } catch(_) {}
    try {
      if (window.DelivProSupabase && typeof window.DelivProSupabase.getClient === 'function') {
        return window.DelivProSupabase.getClient();
      }
    } catch(_) {}
    return null;
  }

  /**
   * Charge les donnees ai_quota_daily des 30 derniers jours (mini-graph) +
   * mois courant. Retourne { rows, monthRows, daysMap30 }.
   * En cas d'echec (RLS, reseau) : tableaux vides + flag erreur.
   */
  async function fetchQuotaData() {
    var client = getClient();
    if (!client) return { rows: [], monthRows: [], daysMap30: {}, error: 'Supabase indisponible' };

    var now = new Date();
    var since30 = ymd(daysAgo(30));
    var sinceMonth = ymd(startOfMonth(now));
    // On prend la borne la plus ancienne pour une seule requete
    var since = since30 < sinceMonth ? since30 : sinceMonth;

    try {
      var resp = await client
        .from('ai_quota_daily')
        .select('date, requests_pro, requests_flash')
        .gte('date', since)
        .order('date', { ascending: true });
      if (resp.error) return { rows: [], monthRows: [], daysMap30: {}, error: resp.error.message || 'Erreur SQL' };
      var rows = resp.data || [];

      // Index par date
      var daysMap30 = {};
      rows.forEach(function(r) { daysMap30[r.date] = r; });

      var monthRows = rows.filter(function(r) { return r.date >= sinceMonth; });
      return { rows: rows, monthRows: monthRows, daysMap30: daysMap30, error: null };
    } catch (e) {
      return { rows: [], monthRows: [], daysMap30: {}, error: (e && e.message) || 'Erreur reseau' };
    }
  }

  /**
   * Calcule les agregats mois courant + serie 30 jours.
   * Retourne { costMonth, proMonth, flashMonth, totalReqMonth, series30 }.
   */
  function aggregate(data) {
    var proMonth = 0, flashMonth = 0;
    data.monthRows.forEach(function(r) {
      proMonth   += (+r.requests_pro)   || 0;
      flashMonth += (+r.requests_flash) || 0;
    });
    var costMonth = calcCostEur(proMonth, flashMonth);
    var totalReqMonth = proMonth + flashMonth;

    // Serie 30 jours : on remplit les jours manquants avec 0 pour un graph propre
    var series30 = [];
    for (var i = 29; i >= 0; i--) {
      var d = daysAgo(i);
      var key = ymd(d);
      var row = data.daysMap30[key];
      var pro = row ? (+row.requests_pro || 0) : 0;
      var fl  = row ? (+row.requests_flash || 0) : 0;
      series30.push({ date: key, pro: pro, flash: fl, cost: calcCostEur(pro, fl) });
    }
    return {
      costMonth: costMonth,
      proMonth: proMonth,
      flashMonth: flashMonth,
      totalReqMonth: totalReqMonth,
      series30: series30
    };
  }

  // ---- HTML helpers ----
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function tileHtml(label, value, sub, color) {
    return '<div class="cout-ia-tile" style="background:var(--bg-dark);border:1px solid var(--border);border-radius:12px;padding:14px 16px;flex:1;min-width:160px">' +
      '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">' + escHtml(label) + '</div>' +
      '<div style="font-size:' + (color ? '1.5rem' : '1.15rem') + ';font-weight:700;color:' + (color || 'var(--text-primary)') + ';line-height:1.1">' + value + '</div>' +
      (sub ? '<div style="font-size:.74rem;color:var(--text-muted);margin-top:4px">' + sub + '</div>' : '') +
      '</div>';
  }

  /**
   * Rendu du mini-graph 30 jours en SVG inline (barres). Hauteur barre =
   * proportionnelle au cout journalier. Tooltip natif via <title>.
   */
  function renderGraph30(series30) {
    var maxCost = 0;
    series30.forEach(function(d) { if (d.cost > maxCost) maxCost = d.cost; });
    if (maxCost === 0) maxCost = 0.01; // evite division par 0

    var W = 600, H = 110, pad = 6;
    var n = series30.length;
    var barW = (W - pad * 2) / n;
    var bars = series30.map(function(d, i) {
      var h = Math.max(1, Math.round(((H - pad * 2) * d.cost) / maxCost));
      var x = pad + i * barW;
      var y = H - pad - h;
      var label = d.date + ' — ' + fmtEur(d.cost) + ' (' + (d.pro + d.flash) + ' req.)';
      return '<rect x="' + x.toFixed(2) + '" y="' + y + '" width="' + (barW - 1).toFixed(2) + '" height="' + h + '" rx="2" fill="var(--accent, #e63946)" opacity="' + (d.cost === 0 ? 0.18 : 0.85) + '"><title>' + escHtml(label) + '</title></rect>';
    }).join('');

    return '<div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:12px;padding:14px 16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">' +
      '<div style="font-size:.85rem;font-weight:600">Coût quotidien (30 derniers jours)</div>' +
      '<div style="font-size:.74rem;color:var(--text-muted)">Max ' + fmtEur(maxCost) + '/j</div>' +
      '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:110px;display:block">' +
      bars +
      '</svg>' +
      '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-top:4px">' +
      '<span>' + escHtml(series30[0].date) + '</span>' +
      '<span>' + escHtml(series30[series30.length - 1].date) + '</span>' +
      '</div>' +
      '</div>';
  }

  function renderLinks() {
    var btn = function(href, icon, label) {
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;font-size:.82rem">' +
        '<span aria-hidden="true">' + icon + '</span><span>' + escHtml(label) + '</span></a>';
    };
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      btn(LINK_AI_STUDIO, '📊', 'Voir détail AI Studio') +
      btn(LINK_BILLING,   '€',  'Rapports facturation') +
      btn(LINK_QUOTAS,    '⚡', 'Quotas API temps réel') +
      btn(LINK_BUDGETS,   '🔔', 'Configurer alertes budget') +
      '</div>';
  }

  function renderEmergencyBlock() {
    return '<details class="cout-ia-emergency" style="margin-top:16px;background:var(--bg-dark);border:1px solid var(--border);border-radius:12px;padding:0">' +
      '<summary style="cursor:pointer;padding:12px 16px;font-weight:600;font-size:.9rem;color:#dc3545;list-style:none;display:flex;align-items:center;gap:8px">' +
      '<span aria-hidden="true">🚨</span>' +
      '<span>Désactivation d\'urgence (en cas de surfacturation suspecte)</span>' +
      '<span style="margin-left:auto;font-size:.78rem;color:var(--text-muted);font-weight:400">▾</span>' +
      '</summary>' +
      '<div style="padding:0 16px 16px;font-size:.85rem;line-height:1.55">' +
      '<p style="margin:8px 0;color:var(--text-muted)">Si tu reçois une alerte budget anormale ou une facture surprise, choisis l\'option la moins radicale d\'abord :</p>' +

      '<div style="margin-top:10px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">' +
      '<div style="font-weight:600;margin-bottom:4px">Option A — Désactiver l\'API Gemini uniquement <span style="color:#28a745;font-weight:400;font-size:.78rem">(recommandé en premier)</span></div>' +
      '<div style="color:var(--text-muted);font-size:.82rem;margin-bottom:6px">Effet immédiat : les requêtes Gemini renvoient 403, le chatbot tombe en erreur mais le reste du site continue. Pas de coût supplémentaire à partir de cette seconde.</div>' +
      '<a href="' + LINK_DISABLE_API + '" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration:none;display:inline-block;padding:6px 12px;font-size:.8rem">→ Console GCP : Désactiver l\'API</a>' +
      '</div>' +

      '<div style="margin-top:10px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">' +
      '<div style="font-weight:600;margin-bottom:4px">Option B — Désactiver la facturation du projet <span style="color:#dc3545;font-weight:400;font-size:.78rem">(plus radical)</span></div>' +
      '<div style="color:var(--text-muted);font-size:.82rem;margin-bottom:6px">Tout le projet <code>budget-achraf</code> ne facture plus rien, mais les services se figent (downgrade free tier ou suspension). Réactivable à tout moment.</div>' +
      '<a href="' + LINK_DISABLE_BILLING + '" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration:none;display:inline-block;padding:6px 12px;font-size:.8rem">→ Console GCP : Désactiver la facturation</a>' +
      '</div>' +

      '<div style="margin-top:10px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">' +
      '<div style="font-weight:600;margin-bottom:4px">Option C — Révoquer la clé API <span style="color:#f59e0b;font-weight:400;font-size:.78rem">(si suspicion de fuite)</span></div>' +
      '<div style="color:var(--text-muted);font-size:.82rem;margin-bottom:6px">Supprime la clé existante puis re-crée une nouvelle clé dans le même projet. Mets ensuite à jour le secret Supabase <code>GEMINI_API_KEY</code>.</div>' +
      '<a href="' + LINK_REVOKE_KEY + '" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration:none;display:inline-block;padding:6px 12px;font-size:.8rem">→ AI Studio : Gérer les clés</a>' +
      '</div>' +

      '</div>' +
      '</details>';
  }

  // ---- Construction du panneau PC ----
  function buildPanelPC(state) {
    var costColor = state.costMonth >= BUDGET_CAP_EUR ? '#dc3545'
                  : state.costMonth >= BUDGET_CAP_EUR * 0.5 ? '#f59e0b'
                  : '#28a745';
    var capLink = '<a href="' + LINK_BUDGETS + '" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted)">Configurer ↗</a>';
    var requestsSub = state.proMonth + ' Pro · ' + state.flashMonth + ' Flash';

    var content =
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">' +
        tileHtml('Coût mois courant',
                 fmtEur(state.costMonth),
                 'Estimation Gemini · ' + new Date().toLocaleDateString('fr-FR', {month:'long',year:'numeric'}),
                 costColor) +
        tileHtml('Cap budget Google Cloud',
                 fmtEur(BUDGET_CAP_EUR) + ' / mois',
                 capLink) +
        tileHtml('Requêtes mois courant',
                 fmtInt(state.totalReqMonth),
                 requestsSub) +
      '</div>' +
      renderGraph30(state.series30) +
      renderLinks() +
      renderEmergencyBlock() +
      '<div style="font-size:.74rem;color:var(--text-muted);margin-top:10px;line-height:1.5">' +
      'Estimation basée sur les compteurs internes <code>ai_quota_daily</code> · Tarifs Gemini Tier 1 (Pro ≈ $' +
      PRICE_PRO_USD + ' / req., Flash ≈ $' + PRICE_FLASH_USD + ' / req., USD→EUR ' + USD_TO_EUR +
      '). Source officielle : rapport facturation GCP.' +
      '</div>';
    return content;
  }

  function buildErrorPanel(message) {
    return '<div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:12px;padding:18px">' +
      '<div style="color:#dc3545;font-weight:600;margin-bottom:8px">⚠️ Données indisponibles</div>' +
      '<div style="color:var(--text-muted);font-size:.85rem;line-height:1.55">' +
      escHtml(message || 'Impossible de charger ai_quota_daily.') +
      '<br>Vérifie que tu es connecté en admin (RLS) et que la table existe.' +
      '</div>' +
      renderLinks() +
      '</div>';
  }

  /**
   * Injecte la card "Cout IA" dans #page-parametres .params-grid si absente,
   * puis remplit son contenu (loader + fetch + render).
   */
  async function injectAndRenderPC() {
    var pageParams = document.getElementById('page-parametres');
    if (!pageParams) return;
    var grid = pageParams.querySelector('.params-grid');
    if (!grid) return;

    var card = grid.querySelector('#cout-ia-card');
    var body;
    if (!card) {
      card = document.createElement('div');
      card.id = 'cout-ia-card';
      card.className = 'card params-card-wide';
      card.innerHTML =
        '<div class="card-header"><h2>🤖 Coût IA</h2></div>' +
        '<div class="modal-body">' +
        '<p style="color:var(--text-muted);font-size:.85rem;margin:0 0 14px">' +
        'Consommation chatbot Gemini (estimation €). Donnees internes <code>ai_quota_daily</code>, croisees avec le rapport facturation Google Cloud.' +
        '</p>' +
        '<div id="cout-ia-content" style="min-height:120px"><div style="color:var(--text-muted);font-size:.85rem">Chargement…</div></div>' +
        '</div>';
      // On insere apres "Apparence" si possible, sinon en fin
      var apparence = Array.prototype.find.call(grid.querySelectorAll('.card .card-header h2'), function(h){
        return /Apparence/i.test(h.textContent || '');
      });
      if (apparence) {
        var apparenceCard = apparence.closest('.card');
        if (apparenceCard && apparenceCard.nextSibling) {
          grid.insertBefore(card, apparenceCard.nextSibling);
        } else {
          grid.appendChild(card);
        }
      } else {
        grid.appendChild(card);
      }
    }
    body = card.querySelector('#cout-ia-content');
    if (!body) return;

    var data = await fetchQuotaData();
    if (data.error) {
      body.innerHTML = buildErrorPanel(data.error);
      return;
    }
    var state = aggregate(data);
    body.innerHTML = buildPanelPC(state);
  }

  // ---- Hook de declenchement (PC) ----
  // 1) Au chargement initial si on est deja sur la page parametres.
  // 2) Sur navigation ulterieure : on patche naviguerVers (defensif, sans casser).
  function setupHooks() {
    // Re-render quand la page parametres devient active
    document.addEventListener('click', function(e) {
      var item = e.target && e.target.closest && e.target.closest('.nav-item[data-page="parametres"]');
      if (item) setTimeout(injectAndRenderPC, 200);
    }, true);

    // Si on landit deja sur parametres
    if (document.getElementById('page-parametres') && document.getElementById('page-parametres').classList.contains('active')) {
      setTimeout(injectAndRenderPC, 400);
    }

    // Re-injecte periodiquement si la card a ete arrachee par un re-render
    setInterval(function() {
      var page = document.getElementById('page-parametres');
      if (page && page.classList.contains('active') && !page.querySelector('#cout-ia-card')) {
        injectAndRenderPC();
      }
    }, 3000);
  }

  // Expose pour debug + re-render manuel
  window.renderCoutIAPC = injectAndRenderPC;
  window.calculerCoutGeminiEUR = calcCostEur;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHooks);
  } else {
    setupHooks();
  }
})();
