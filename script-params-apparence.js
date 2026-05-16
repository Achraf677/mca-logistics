/* Phase 91.64 — Handlers Paramètres → Apparence (selects légers)
   Wire les <select> de l'onglet Apparence (mode thème, langue, devise, fuseau,
   format date) qui étaient affichés mais sans handler → "boutons morts".
   Persistance app_state.<clé> + toast confirmation. */
(function () {
  'use strict';

  var FIELDS = [
    { id: 'param-theme-mode',  key: 'themeMode',  label: 'Mode',          onApply: applyThemeMode },
    { id: 'param-langue',      key: 'langue',     label: 'Langue',        onApply: applyLangue },
    { id: 'param-devise',      key: 'devise',     label: 'Devise',        onApply: null },
    { id: 'param-fuseau',      key: 'fuseau',     label: 'Fuseau',        onApply: null },
    { id: 'param-format-date', key: 'formatDate', label: 'Format date',   onApply: applyFormatDate }
  ];

  function getState() {
    try { return JSON.parse(localStorage.getItem('app_state') || '{}'); } catch (_) { return {}; }
  }
  function setState(st) {
    try { localStorage.setItem('app_state', JSON.stringify(st)); } catch (_) {}
  }

  function applyThemeMode(value) {
    // Aligne sur toggleTheme() existant. Valeurs : "Sombre…", "Clair…", "Auto…"
    var html = document.documentElement;
    if (/clair/i.test(value)) {
      html.setAttribute('data-theme', 'light');
      try { localStorage.setItem('theme', 'light'); } catch (_) {}
    } else if (/sombre/i.test(value)) {
      html.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('theme', 'dark'); } catch (_) {}
    } else {
      // Auto = supprime override, suit prefers-color-scheme
      html.removeAttribute('data-theme');
      try { localStorage.removeItem('theme'); } catch (_) {}
    }
  }

  function applyLangue(value) {
    if (!/français/i.test(value)) {
      // English non implémenté — informer l'utilisateur
      if (typeof window.afficherToast === 'function') {
        try { window.afficherToast('Anglais : à venir (i18n PR-V2)', 'info'); } catch (_) {}
      }
    }
  }

  function applyFormatDate(value) {
    // Stocké pour usage futur par les helpers d'affichage de date.
    // Pour l'instant, la majorité du code utilise toLocaleDateString('fr-FR'). On expose
    // la préférence globale pour permettre une migration progressive.
    window.__userFormatDate = /AAAA-MM-JJ/i.test(value) ? 'iso' : 'fr';
  }

  function wireField(f) {
    var sel = document.getElementById(f.id);
    if (!sel || sel.__apparenceWired) return false;
    sel.__apparenceWired = true;
    var st = getState();
    if (st[f.key]) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].text === st[f.key] || sel.options[i].value === st[f.key]) {
          sel.selectedIndex = i;
          break;
        }
      }
      if (typeof f.onApply === 'function') {
        try { f.onApply(sel.options[sel.selectedIndex].text); } catch (_) {}
      }
    }
    sel.addEventListener('change', function () {
      var v = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
      var current = getState();
      current[f.key] = v;
      setState(current);
      if (typeof f.onApply === 'function') {
        try { f.onApply(v); } catch (_) {}
      }
      if (typeof window.afficherToast === 'function') {
        try { window.afficherToast(f.label + ' : ' + v, 'success'); } catch (_) {}
      }
    });
    return true;
  }

  function wireAll() {
    var anyMissing = false;
    FIELDS.forEach(function (f) { if (!wireField(f)) anyMissing = true; });
    return !anyMissing;
  }

  // Appliquer themeMode persisté au boot AVANT le rendu pour éviter le flash
  (function applyBoot() {
    var st = getState();
    if (st.themeMode) {
      try { applyThemeMode(st.themeMode); } catch (_) {}
    }
    if (st.formatDate) {
      try { applyFormatDate(st.formatDate); } catch (_) {}
    }
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!wireAll()) { var r = 0, iv = setInterval(function(){ if (wireAll() || ++r > 20) clearInterval(iv); }, 400); }
    });
  } else {
    if (!wireAll()) { var r = 0, iv = setInterval(function(){ if (wireAll() || ++r > 20) clearInterval(iv); }, 400); }
  }
})();
