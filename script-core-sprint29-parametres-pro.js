/**
 * MCA Logistics — Sprint 29 — Refonte Paramètres pro (sidebar 8 sections + recherche live) (Phase X — extraction script.js)
 *
 * Extracted from script.js L4930-5297 (2026-05-16).
 */

/* ==========================================================================
   Sprint 29 — Refonte Paramètres pro
   - Sidebar interne 8 sections (Entreprise, Facturation, Comptabilité,
     Transport, Automatisations, Sécurité & RGPD, Conformité, À propos)
   - Recherche live (Ctrl + /) qui filtre les cartes
   - Catégorisation auto des cartes existantes (par titre h2)
   - Section Conformité = seul endroit légal centralisé (RGPD / FEC / eIDAS /
     CMR / archivage), regroupe aussi pack fiscal S27 + signature BL S26
   - Mémorisation section active (localStorage : s29_section_active)
   ========================================================================== */
(function installS29(){
  if (window.__s29Installed) return;
  window.__s29Installed = true;

  const LS_SECTION = 's29_section_active';
  const toast = (m, t) => { if (typeof window.afficherToast === 'function') window.afficherToast(m, t||'info'); };

  const SECTIONS = [
    { id:'entreprise',    icon:'🏢', label:'Entreprise',      desc:'Identité, logo, postes' },
    { id:'comptabilite',  icon:'📊', label:'Comptabilité',    desc:'Délégation Pennylane (facturation, FEC, compta)' },
    { id:'transport',     icon:'🚚', label:'Transport',       desc:'Règles calculs, livraison' },
    { id:'automatisations', icon:'⚙️', label:'Automatisations', desc:'Cron, rappels, clôtures' },
    { id:'securite',      icon:'🔐', label:'Sécurité & RGPD', desc:'Mot de passe, sessions, audit' },
    { id:'conformite',    icon:'📋', label:'Conformité',      desc:'RGPD, transport, obligations légales' },
    { id:'apropos',       icon:'ℹ️', label:'À propos',        desc:'Version, support, mentions' },
  ];

  /* ---------- Catégorisation automatique par titre h2 ---------- */
  function categoriseCard(card) {
    if (card.dataset.s29Section) return card.dataset.s29Section;
    const h2 = card.querySelector('.card-header h2, h2');
    const title = h2 ? (h2.textContent||'').toLowerCase() : '';
    if (/entreprise|identit|poste|apparence|th[eè]me|logo/.test(title)) return 'entreprise';
    if (/tva|fiscalit|trésorerie|num[eé]rotation|facture|facturation/.test(title)) return 'facturation';
    if (/comptab|exercice|pcg|factur-x|amortis/.test(title)) return 'comptabilite';
    if (/transport|livraison|heure|km|cmr|lettre de voiture/.test(title)) return 'transport';
    if (/automatisation|cron|rappel|pilotage|tra[cç]abilit/.test(title)) return 'automatisations';
    if (/mot de passe|blocage|session|journal|audit|sauvegarde|restauration|s[eé]curit|rgpd/.test(title)) return 'securite';
    if (/conformit|pack fiscal|eidas|fec|signature bl|rgpd|mentions/.test(title)) return 'conformite';
    return 'entreprise'; // fallback
  }

  /* ---------- Encart Conformité centralisé ---------- */
  function buildConformiteCard() {
    const card = document.createElement('div');
    card.className = 'card params-card-wide s29-conformite-card';
    card.dataset.s29Section = 'conformite';
    card.innerHTML = `
      <div class="card-header"><h2>Conformité & obligations légales</h2></div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:18px">
          Tableau de bord centralisé des obligations légales françaises applicables à votre activité transport/logistique.
          Cette page remplace les encarts pédagogiques éparpillés dans l'app.
        </p>
        <div class="s29-conformite-grid">
          <div class="s29-conf-item">
            <div class="s29-conf-title">Archivage documents (Code de commerce art. L123-22 / CGI art. L102 B)</div>
            <ul class="s29-conf-list">
              <li><strong>Factures émises & reçues :</strong> 10 ans (support numérique ou papier)</li>
              <li><strong>Pièces comptables (livre journal, grand livre) :</strong> 10 ans</li>
              <li><strong>Bulletins de paie :</strong> 5 ans (50 ans côté salarié)</li>
              <li><strong>Contrats commerciaux :</strong> 5 ans après fin du contrat</li>
              <li><strong>Lettres de voiture (CMR, BL) :</strong> 5 ans (Code des transports art. L3222-1)</li>
              <li><strong>Journal d'audit des actions :</strong> 6 ans (preuve fiscale)</li>
            </ul>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">Fichier des Écritures Comptables — FEC (CGI art. A47 A-1)</div>
            <p>Format normé 18 colonnes, obligatoire en cas de contrôle fiscal pour toute entreprise soumise à TVA.
            Le FEC officiel est produit par Pennylane depuis ses données comptables complètes. Ne pas produire un FEC depuis MCA Logistics :
            il serait incomplet (MCA n'ayant plus les factures) et risquerait un conflit avec la comptabilité officielle.</p>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">✍️ Signature électronique BL (Règlement eIDAS n°910/2014)</div>
            <p>La signature capturée via canvas tactile est une <strong>signature électronique simple</strong>.
            Elle constitue un commencement de preuve par écrit (art. 1366 C. civ.) mais sa valeur probante
            repose sur le faisceau d'indices : horodatage, IP, user-agent, hash du document associé.
            Pour une valeur probante renforcée, prévoir un prestataire de service de confiance qualifié (PSCo).</p>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">RGPD — Règlement UE 2016/679</div>
            <ul class="s29-conf-list">
              <li><strong>Registre des traitements :</strong> art. 30 RGPD, obligatoire dès le premier salarié</li>
              <li><strong>Consentement signature/géoloc :</strong> à recueillir lors de la collecte (base légale)</li>
              <li><strong>Droit d'accès, rectification, effacement :</strong> procédure à documenter</li>
              <li><strong>DPO :</strong> obligatoire si traitement à grande échelle ou données sensibles</li>
              <li><strong>localStorage :</strong> aucun cookie de tracking dans cette app — consentement non requis</li>
            </ul>
            <button class="btn-secondary" onclick="genererRegistreRGPD()" style="margin-top:10px">Générer le registre des traitements (art. 30)</button>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">DSN — Déclaration Sociale Nominative</div>
            <ul class="s29-conf-list">
              <li><strong>Obligation :</strong> mensuelle dès le 1er salarié (net-entreprises.fr)</li>
              <li><strong>Périmètre :</strong> contrats, rémunérations, cotisations, arrêts, fins de contrat</li>
              <li><strong>Outillage MCA :</strong> non produite côté MCA. Transmission via votre logiciel de paie (Pennylane Paie, Silae, Payfit…) à partir de la base salariés MCA + bulletins du prestataire.</li>
            </ul>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">Transport routier (Code des transports)</div>
            <ul class="s29-conf-list">
              <li><strong>Lettre de voiture :</strong> obligatoire pour tout transport rémunéré (art. L3222-1)</li>
              <li><strong>CMR :</strong> convention applicable dès qu'il y a transport international</li>
              <li><strong>Temps de conduite/repos :</strong> Règlement CE 561/2006 (à tracer pour contrôles)</li>
              <li><strong>Contrats-types :</strong> décrets spécifiques selon type de marchandises</li>
            </ul>
          </div>
          <div class="s29-conf-item">
            <div class="s29-conf-title">Réforme de la facturation électronique</div>
            <p>Généralisation de la facture électronique B2B en France : <strong>obligation de réception dès septembre 2026</strong>
            pour toutes les entreprises, obligation d'émission progressive jusqu'à septembre 2027.
            Format structuré attendu : Factur-X (PDF/A-3 + XML CII), UBL ou CII. Plateforme de dématérialisation partenaire (PDP) requise.
            MCA Logistics émet vos factures PDF avec mentions obligatoires CGI 242 nonies A complètes (forme juridique, RCS, capital, conditions de règlement, pénalités L441-10, indemnité 40 € D441-5).
            La transmission au format Factur-X est déléguée à votre logiciel comptable (Pennylane et autres PDP agréées DGFiP).</p>
          </div>
        </div>
        <div class="s29-conf-actions">
          <button class="btn btn-ghost" onclick="window.ouvrirTimelineGlobale && window.ouvrirTimelineGlobale()">Ouvrir la timeline d'audit</button>
        </div>
      </div>
    `;
    return card;
  }

  /* ---------- Encart À propos ---------- */
  function buildAproposCard() {
    const card = document.createElement('div');
    card.className = 'card s29-apropos-card';
    card.dataset.s29Section = 'apropos';
    card.innerHTML = `
      <div class="card-header"><h2>ℹ️ À propos de MCA Logistics</h2></div>
      <div class="modal-body">
        <p style="font-size:.92rem;margin-bottom:10px"><strong>MCA Logistics</strong> — ERP transport & logistique</p>
        <ul class="s29-apropos-list">
          <li><strong>Version :</strong> 29.0 (Sprint 29 — Paramètres pro)</li>
          <li><strong>Stockage :</strong> 100% local (localStorage) — aucune donnée envoyée</li>
          <li><strong>Synchronisation optionnelle :</strong> Supabase (désactivable)</li>
          <li><strong>Licence :</strong> Propriétaire — usage interne uniquement</li>
        </ul>
        <p style="font-size:.82rem;color:var(--text-muted);margin-top:14px">
          Support & documentation : contactez l'administrateur de votre instance.
        </p>
      </div>
    `;
    return card;
  }

  /* ---------- Encart Transport placeholder ---------- */
  function buildTransportCard() {
    const card = document.createElement('div');
    card.className = 'card s29-transport-card';
    card.dataset.s29Section = 'transport';
    card.innerHTML = `
      <div class="card-header"><h2>Règles transport & livraison</h2></div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:14px">
          Les règles de calcul (heures, km, indemnités) sont pilotées depuis les onglets Heures, KM et Chauffeurs.
          Les options de livraison (signature BL, clôture auto) sont dans Automatisations et Pilotage.
        </p>
        <ul class="s29-apropos-list">
          <li>Barème kilométrique → onglet <strong>Compteur KM</strong></li>
          <li>Temps de conduite → onglet <strong>Compteur heures</strong></li>
          <li>Lettre de voiture → généré à l'émission du BL</li>
        </ul>
      </div>
    `;
    return card;
  }

  /* ---------- Encart Comptabilité placeholder ---------- */
  function buildComptaCard() {
    const card = document.createElement('div');
    card.className = 'card s29-compta-card';
    card.dataset.s29Section = 'comptabilite';
    card.innerHTML = `
      <div class="card-header"><h2>Comptabilité (déléguée)</h2></div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:14px">
          MCA Logistics se concentre sur l'opérationnel transport.
          La comptabilité complète — facturation, encaissements, TVA, amortissements,
          clôture d'exercice, FEC, Factur-X — est gérée par votre logiciel comptable
          (Pennylane ou PDP agréée DGFiP).
        </p>
        <ul class="s29-apropos-list">
          <li>Export des charges → onglet <strong>Charges</strong> (CSV pour import Pennylane)</li>
          <li>Livraisons exportables en CSV (base pour réconciliation Pennylane)</li>
          <li>Données entreprise synchronisées (SIRET, TVA intracom, RCS, capital)</li>
        </ul>
      </div>
    `;
    return card;
  }

  /* ---------- Refonte DOM : wrap params-grid dans sidebar + content ---------- */
  function buildShell(page) {
    if (page.querySelector('.s29-shell')) return null;
    const grid = page.querySelector('.params-grid');
    if (!grid) return null;

    const shell = document.createElement('div');
    shell.className = 's29-shell';

    const sidebar = document.createElement('aside');
    sidebar.className = 's29-sidebar';
    sidebar.innerHTML = `
      <div class="s29-search-wrap">
        <input type="text" class="s29-search" placeholder="Rechercher (Ctrl + /)…" autocomplete="off" />
      </div>
      <nav class="s29-nav">
        ${SECTIONS.map(s => `
          <button type="button" class="s29-nav-item" data-s29-target="${s.id}">
            <span class="s29-nav-icon">${s.icon}</span>
            <span class="s29-nav-body">
              <strong>${s.label}</strong>
              <small>${s.desc}</small>
            </span>
          </button>
        `).join('')}
      </nav>
    `;

    const content = document.createElement('div');
    content.className = 's29-content';
    content.appendChild(grid);

    shell.appendChild(sidebar);
    shell.appendChild(content);
    page.appendChild(shell);
    return { shell, sidebar, content, grid };
  }

  function ensureExtraCards(grid) {
    if (!grid.querySelector('[data-s29-section="conformite"]')) {
      grid.appendChild(buildConformiteCard());
    }
    if (!grid.querySelector('[data-s29-section="comptabilite"]')) {
      grid.appendChild(buildComptaCard());
    }
    if (!grid.querySelector('[data-s29-section="transport"]')) {
      grid.appendChild(buildTransportCard());
    }
    if (!grid.querySelector('[data-s29-section="apropos"]')) {
      grid.appendChild(buildAproposCard());
    }
  }

  function tagAllCards(grid) {
    grid.querySelectorAll('.card').forEach(card => {
      if (!card.dataset.s29Section) card.dataset.s29Section = categoriseCard(card);
    });
    // Aussi les sections S24/S26/S27 injectées
    const page = grid.closest('#page-parametres');
    if (page) {
      page.querySelectorAll('.settings-section').forEach(sec => {
        if (sec.dataset.s29Section) return;
        const id = sec.id || '';
        if (id === 's24-params-section') sec.dataset.s29Section = 'automatisations';
        else if (id === 's26-params-section') sec.dataset.s29Section = 'automatisations';
        else if (id === 's27-params-section') sec.dataset.s29Section = 'conformite';
        else sec.dataset.s29Section = categoriseCard(sec);
        // Déplacer ces sections dans la grille
        if (grid && sec.parentElement !== grid) grid.appendChild(sec);
      });
    }
  }

  function setActive(sectionId) {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    const grid = page.querySelector('.params-grid');
    if (!grid) return;
    if (localStorage.getItem(LS_SECTION) !== sectionId) {
      localStorage.setItem(LS_SECTION, sectionId);
    }
    page.querySelectorAll('.s29-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.s29Target === sectionId);
    });
    grid.querySelectorAll('[data-s29-section]').forEach(el => {
      el.style.display = (el.dataset.s29Section === sectionId) ? '' : 'none';
    });
    // Reset search
    const search = page.querySelector('.s29-search');
    if (search) search.value = '';
    const headerTitle = page.querySelector('.page-actions h2');
    const section = SECTIONS.find(s => s.id === sectionId);
    if (headerTitle && section) headerTitle.textContent = 'Paramètres · ' + section.label;
  }

  function applySearch(q) {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    const grid = page.querySelector('.params-grid');
    if (!grid) return;
    const needle = (q||'').trim().toLowerCase();
    if (!needle) {
      const active = localStorage.getItem(LS_SECTION) || 'entreprise';
      setActive(active);
      return;
    }
    // En mode recherche, on ignore la section active et on montre toutes les cartes matchant
    page.querySelectorAll('.s29-nav-item').forEach(b => b.classList.remove('active'));
    grid.querySelectorAll('[data-s29-section]').forEach(el => {
      const text = (el.textContent||'').toLowerCase();
      el.style.display = text.includes(needle) ? '' : 'none';
    });
    const headerTitle = page.querySelector('.page-actions h2');
    if (headerTitle) headerTitle.textContent = 'Paramètres · ' + q;
  }

  function wireEvents(page) {
    if (page.__s29Wired) return;
    page.__s29Wired = true;
    page.addEventListener('click', (e) => {
      const btn = e.target.closest('.s29-nav-item');
      if (btn) { setActive(btn.dataset.s29Target); return; }
    });
    const search = page.querySelector('.s29-search');
    if (search) {
      search.addEventListener('input', () => applySearch(search.value));
      search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value=''; applySearch(''); } });
    }
    // Raccourci Ctrl+/
    document.addEventListener('keydown', (e) => {
      if (!page.classList.contains('active')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const s = page.querySelector('.s29-search');
        if (s) { s.focus(); s.select(); }
      }
    });
  }

  function render() {
    const page = document.getElementById('page-parametres');
    if (!page) return;
    const built = buildShell(page);
    const grid = page.querySelector('.params-grid');
    if (!grid) return;
    ensureExtraCards(grid);
    tagAllCards(grid);
    wireEvents(page);
    // Restaurer section active
    if (built || !page.dataset.s29Booted) {
      page.dataset.s29Booted = '1';
      const saved = localStorage.getItem(LS_SECTION) || 'entreprise';
      setActive(saved);
    } else {
      // Juste garantir que les nouvelles cartes S24/S26/S27 sont correctement filtrées
      const current = localStorage.getItem(LS_SECTION) || 'entreprise';
      const search = page.querySelector('.s29-search');
      if (search && search.value) applySearch(search.value);
      else setActive(current);
    }
  }

  function init() {
    // Attendre que S24/S26/S27 aient injecté leurs sections (ils tournent à 800-1700ms)
    setTimeout(render, 2200);
    setInterval(render, 4000);
    // Re-render sur navigation vers la page
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-page="parametres"], .nav-item[data-page="parametres"], [onclick*="parametres"]');
      if (nav) setTimeout(render, 250);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 2000);
})();
