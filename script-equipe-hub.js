/**
 * MCA Logistics — Hub Équipe (Sprint 22 / H2.4)
 *
 * Wrapper qui agrege les 4 sous-domaines RH :
 *   - Salaries
 *   - Planning
 *   - Heures & Km
 *   - Incidents
 *
 * Affiche un dashboard global equipe (4 KPIs sticky) + 4 onglets internes
 * qui deeplink vers les pages existantes (anti-regression : routes
 * individuelles continuent de marcher pour brouillons IA, audit log, etc.).
 *
 * Inspiration UX : hub Finances (PR #44) qui regroupe Charges/Encaissement/
 * TVA/Rentabilite avec des sous-tabs.
 *
 * Module dual-purpose :
 *   - Charge dans admin.html (browser) : expose window.EquipeHub.{...}
 *   - Charge dans tests Node : module.exports.{...}
 *
 * Toutes les fonctions de calcul sont pures (pas d'effet de bord DOM/storage)
 * pour faciliter les tests unitaires.
 */

(function () {
  'use strict';

  // ============================================================
  // KPIs — 4 calculs purs reutilisables PC + mobile + tests
  // ============================================================

  /**
   * KPI 1 : Effectif equipe.
   * Renvoie { actifs, total, label } ou actifs = !archive && statut!='inactif'.
   */
  function calculerEffectif(salaries) {
    const arr = Array.isArray(salaries) ? salaries : [];
    const total = arr.filter(s => s && !s.archive).length;
    const actifs = arr.filter(s => s && !s.archive && s.actif !== false && s.statut !== 'inactif').length;
    return {
      actifs,
      total,
      label: `${actifs} actif${actifs > 1 ? 's' : ''} / ${total} contrat${total > 1 ? 's' : ''}`
    };
  }

  /**
   * KPI 2 : Heures cette semaine (somme equipe).
   * Strategie : pour chaque salarie actif, somme les heures reelles saisies
   * sur la semaine ; si aucune, fallback sur les heures planifiees.
   * Necessite range = { debut, fin } (ISO YYYY-MM-DD inclusif).
   */
  function calculerHeuresSemaineEquipe(salaries, heuresSaisies, range, planifieesParSalarie) {
    const sals = Array.isArray(salaries) ? salaries : [];
    const heures = Array.isArray(heuresSaisies) ? heuresSaisies : [];
    const planMap = planifieesParSalarie || {};
    let totalReelles = 0;
    let totalPlanifiees = 0;
    let salariesAvecHeures = 0;

    sals.filter(s => s && !s.archive && s.actif !== false && s.statut !== 'inactif').forEach(s => {
      const reellesSalarie = heures
        .filter(h =>
          (h.salId === s.id || h.salarieId === s.id) &&
          h.date >= range.debut &&
          h.date <= range.fin
        )
        .reduce((sum, h) => sum + (parseFloat(String(h.heures || '').replace(',', '.')) || 0), 0);
      const planifSalarie = parseFloat(planMap[s.id] || 0) || 0;
      const effectif = reellesSalarie > 0 ? reellesSalarie : planifSalarie;
      totalReelles += reellesSalarie;
      totalPlanifiees += planifSalarie;
      if (effectif > 0) salariesAvecHeures++;
    });

    return {
      total: totalReelles + Math.max(0, totalPlanifiees - totalReelles),
      reelles: totalReelles,
      planifiees: totalPlanifiees,
      salariesAvecHeures
    };
  }

  /**
   * KPI 3 : Livraisons 30 derniers jours.
   * Renvoie { nb, ca } : nombre + CA HT total des livraisons livrees sur 30j.
   */
  function calculerLivraisons30j(livraisons, refDate) {
    // #109 audit Chrome : filtre etait restreint statut === 'livre' (pas
    // d'inclusion 'en_attente'/'en_cours'/'a_facturer'). Resultat: une LDV creee
    // mais non encore livree etait invisible -> KPI = 0 alors que livraison
    // existe. Fix : compter toutes les livraisons sauf 'annule'. CA = HT
    // (label dit "CA HT", on lit donc prixHT au lieu de prix=TTC).
    const arr = Array.isArray(livraisons) ? livraisons : [];
    const ref = refDate instanceof Date ? refDate : new Date();
    const limite = new Date(ref);
    limite.setDate(limite.getDate() - 30);
    const limiteStr = limite.toISOString().slice(0, 10);
    const refStr = ref.toISOString().slice(0, 10);
    const eligibles = arr.filter(l =>
      l && l.statut !== 'annule' &&
      l.date && l.date >= limiteStr && l.date <= refStr
    );
    const ca = eligibles.reduce(function (sum, l) {
      var ht = parseFloat(l.prixHT);
      if (Number.isFinite(ht) && ht > 0) return sum + ht;
      var ttc = parseFloat(l.prix);
      var taux = parseFloat(l.tauxTVA);
      if (Number.isFinite(ttc) && Number.isFinite(taux) && taux > 0) {
        return sum + (ttc / (1 + taux / 100));
      }
      return sum + (Number.isFinite(ttc) ? ttc : 0);
    }, 0);
    return { nb: eligibles.length, ca: Math.round(ca * 100) / 100 };
  }

  /**
   * KPI 4 : Conformite globale equipe.
   * Renvoie { niveau:'ok'|'warn'|'critical', label, items:[...] }.
   *   - critical : 1+ doc expire (permis, assurance, visite med)
   *   - warn     : 1+ doc qui expire dans <30j OU 1+ incident ouvert
   *   - ok       : rien
   */
  function calculerConformite(salaries, incidents, refDate) {
    const sals = Array.isArray(salaries) ? salaries : [];
    const incs = Array.isArray(incidents) ? incidents : [];
    const ref = refDate instanceof Date ? refDate : new Date();
    ref.setHours(0, 0, 0, 0);
    const items = [];
    const actifs = sals.filter(s => s && !s.archive && s.actif !== false && s.statut !== 'inactif');

    actifs.forEach(s => {
      const checkDate = (label, dateStr, seuilWarnDays) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return;
        d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d - ref) / (1000 * 60 * 60 * 24));
        if (diff < 0) {
          items.push({ niveau: 'critical', label: `${label} expiré (${s.nom || ''})`, salId: s.id });
        } else if (diff <= seuilWarnDays) {
          items.push({ niveau: 'warn', label: `${label} expire dans ${diff}j (${s.nom || ''})`, salId: s.id });
        }
      };
      checkDate('Permis', s.datePermis, 60);
      checkDate('Assurance', s.dateAssurance, 30);
      checkDate('Visite médicale', s.visiteMedicale && s.visiteMedicale.dateExpiration, 60);
    });

    const incidentsOuverts = incs.filter(i => i && (i.statut || 'ouvert') === 'ouvert').length;
    if (incidentsOuverts > 0) {
      items.push({ niveau: 'warn', label: `${incidentsOuverts} incident${incidentsOuverts > 1 ? 's' : ''} ouvert${incidentsOuverts > 1 ? 's' : ''}` });
    }

    let niveau = 'ok';
    if (items.some(i => i.niveau === 'critical')) niveau = 'critical';
    else if (items.length > 0) niveau = 'warn';

    const labels = { ok: 'Conforme', warn: 'À surveiller', critical: 'Action requise' };
    return { niveau, label: labels[niveau], items };
  }

  // ============================================================
  // Render PC (admin.html)
  // ============================================================

  /**
   * Calcule un range "semaine en cours" (lundi -> dimanche) ISO.
   */
  function rangeSemaineCourante(refDate) {
    const ref = refDate instanceof Date ? new Date(refDate) : new Date();
    ref.setHours(0, 0, 0, 0);
    const day = ref.getDay(); // 0=dim, 1=lun
    const offset = day === 0 ? -6 : 1 - day;
    const lundi = new Date(ref);
    lundi.setDate(lundi.getDate() + offset);
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    // Fix TZ : utiliser les composantes locales pour éviter le décalage UTC.
    // Avec toISOString() sur une date locale (TZ+x), on perdait 1 jour.
    const fmt = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return { debut: fmt(lundi), fin: fmt(dimanche), lundi, dimanche };
  }

  /**
   * Construit la map { salId: heures_planifiees_semaine } pour un range donne.
   * Utilise la convention plannings.semaine[].travaille / heureDebut / heureFin.
   */
  function calculerPlanifieesParSalarie(salaries, plannings, range) {
    const sals = Array.isArray(salaries) ? salaries : [];
    const plans = Array.isArray(plannings) ? plannings : [];
    const map = {};
    const planBySal = new Map();
    plans.forEach(p => { if (p && p.salId) planBySal.set(p.salId, p); });

    sals.forEach(s => {
      const plan = planBySal.get(s.id);
      if (!plan || !Array.isArray(plan.semaine)) { map[s.id] = 0; return; }
      let total = 0;
      plan.semaine.forEach(j => {
        if (!j || !j.travaille || (j.typeJour && j.typeJour !== 'travail')) return;
        if (!j.heureDebut || !j.heureFin) return;
        const [h1, m1] = String(j.heureDebut).split(':').map(Number);
        const [h2, m2] = String(j.heureFin).split(':').map(Number);
        if ([h1, m1, h2, m2].some(x => Number.isNaN(x))) return;
        const min = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (min > 0) total += min / 60;
      });
      map[s.id] = total;
    });
    return map;
  }

  /**
   * Render du header KPIs PC (#equipe-kpis-row).
   * Lecture safe-guard : fonctionne meme si les helpers globaux (charger,
   * naviguerVers) ne sont pas encore prets.
   */
  function renderKpisPC() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const ct = document.getElementById('equipe-kpis-row');
    if (!ct) return;
    const charger = window.charger;
    if (typeof charger !== 'function') return;

    const salaries = charger('salaries');
    const heures = charger('heures');
    const livraisons = charger('livraisons');
    const incidents = charger('incidents');
    const plannings = charger('plannings');

    const range = rangeSemaineCourante();
    const planifMap = calculerPlanifieesParSalarie(salaries, plannings, range);

    const eff = calculerEffectif(salaries);
    const heuresSem = calculerHeuresSemaineEquipe(salaries, heures, range, planifMap);
    const liv30 = calculerLivraisons30j(livraisons);
    const conf = calculerConformite(salaries, incidents);

    const fmtEur = n => (Math.round(n) || 0).toLocaleString('fr-FR') + ' €';

    ct.innerHTML = `
      <div class="kpi-card green">
        <div class="kpi-label">Effectif</div>
        <div class="kpi-value">${eff.actifs}</div>
        <div class="kpi-sub">${eff.label}</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">Heures cette semaine</div>
        <div class="kpi-value">${heuresSem.total.toFixed(1)} h</div>
        <div class="kpi-sub">prévues ${heuresSem.planifiees.toFixed(1)} h · réelles ${heuresSem.reelles.toFixed(1)} h</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">Livraisons 30j</div>
        <div class="kpi-value">${liv30.nb}</div>
        <div class="kpi-sub">${fmtEur(liv30.ca)} CA HT</div>
      </div>
      <div class="kpi-card" style="border-top:3px solid ${conf.niveau === 'critical' ? '#dc3545' : conf.niveau === 'warn' ? '#e67e22' : '#28a745'}">
        <div class="kpi-label">Conformité</div>
        <div class="kpi-value" style="font-size:1.1rem">${conf.label}</div>
        <div class="kpi-sub">${conf.items.length === 0 ? 'Tout est à jour' : conf.items.length + ' point' + (conf.items.length > 1 ? 's' : '') + ' à traiter'}</div>
      </div>
    `;
    // Marker pour test e2e / debug
    ct.dataset.equipeKpisRendered = '1';
    ct.dataset.equipeNiveauConformite = conf.niveau;
  }

  /**
   * Active un onglet (PC) en deeplinkant vers la page existante via naviguerVers,
   * tout en mettant a jour la state UI du hub (titre, onglet actif).
   */
  function ouvrirOnglet(target) {
    if (typeof window === 'undefined') return;
    if (typeof window.naviguerVers !== 'function') return;
    const validTargets = ['salaries', 'heures', 'planning', 'incidents'];
    const t = validTargets.includes(target) ? target : 'salaries';
    // Stocke la cible pour qu'au retour sur "equipe" on remette le focus dessus
    try { sessionStorage.setItem('equipe_last_tab', t); } catch (_) { /* fail silent */ }
    window.naviguerVers(t);
  }

  // ============================================================
  // Hook navigation : refresh KPIs quand on ouvre la page Equipe
  // ============================================================

  function hookNavigation() {
    if (typeof window === 'undefined') return;
    if (window.EquipeHub && window.EquipeHub.__navHooked) return;
    const orig = window.naviguerVers;
    if (typeof orig !== 'function') return;
    window.naviguerVers = function (page) {
      const r = orig.apply(this, arguments);
      if (page === 'equipe') {
        // Rendu apres que naviguerVers ait active la page (lazy via rAF)
        requestAnimationFrame(() => renderKpisPC());
      }
      return r;
    };
    if (window.EquipeHub) window.EquipeHub.__navHooked = true;
  }

  // ============================================================
  // Exports : browser + Node (tests)
  // ============================================================
  const api = {
    calculerEffectif,
    calculerHeuresSemaineEquipe,
    calculerLivraisons30j,
    calculerConformite,
    rangeSemaineCourante,
    calculerPlanifieesParSalarie,
    renderKpisPC,
    ouvrirOnglet,
    hookNavigation
  };

  if (typeof window !== 'undefined') {
    window.EquipeHub = api;
    // Auto-hook au chargement (dispatchee via DOMContentLoaded ou direct si deja pret)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hookNavigation);
    } else {
      // setTimeout pour laisser script-core-navigation.js s'enregistrer en premier
      setTimeout(hookNavigation, 0);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
