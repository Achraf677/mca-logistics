/* Phase 91.63 — Polices globales dynamiques
   Permet à l'utilisateur de choisir la police body depuis Paramètres → Apparence.
   La valeur est persistée dans localStorage('app_state'.policeBody) et appliquée
   au boot AVANT le rendu (pour éviter le FOUC), en mettant à jour la variable CSS
   --ds-font-body sur :root. Les fonts non préchargées dans le <link> Google Fonts
   du HTML sont chargées dynamiquement à la demande. */
(function () {
  'use strict';

  // Map label visible → famille CSS + URL Google Fonts (optionnelle si déjà chargée)
  var FONT_MAP = {
    'DM Sans (défaut)': { family: "'DM Sans', system-ui, sans-serif",      gfont: null },
    'DM Sans':           { family: "'DM Sans', system-ui, sans-serif",      gfont: null },
    'Inter':             { family: "'Inter', system-ui, sans-serif",         gfont: 'Inter:wght@400;500;600;700' },
    'Roboto':            { family: "'Roboto', system-ui, sans-serif",        gfont: 'Roboto:wght@400;500;700' },
    'System':            { family: "system-ui, -apple-system, sans-serif",   gfont: null },
    'Système':           { family: "system-ui, -apple-system, sans-serif",   gfont: null }
  };

  var LOADED_GFONTS = {};

  function loadGoogleFont(spec) {
    if (!spec || LOADED_GFONTS[spec]) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(spec).replace(/%3A/g, ':').replace(/%3B/g, ';') + '&display=swap';
    link.setAttribute('data-policy-font', spec);
    document.head.appendChild(link);
    LOADED_GFONTS[spec] = true;
  }

  function getStoredPolice() {
    try {
      var raw = localStorage.getItem('app_state');
      if (!raw) return null;
      var st = JSON.parse(raw);
      return st && st.policeBody ? st.policeBody : null;
    } catch (_) { return null; }
  }

  function setStoredPolice(label) {
    try {
      var raw = localStorage.getItem('app_state');
      var st = raw ? JSON.parse(raw) : {};
      st.policeBody = label;
      localStorage.setItem('app_state', JSON.stringify(st));
    } catch (_) {}
  }

  function applyPolice(label) {
    var entry = FONT_MAP[label] || FONT_MAP['DM Sans (défaut)'];
    if (entry.gfont) loadGoogleFont(entry.gfont);
    document.documentElement.style.setProperty('--ds-font-body', entry.family);
    // Compat legacy : aussi --font-body au cas où certains styles legacy l'utilisent
    document.documentElement.style.setProperty('--font-body', entry.family);
  }

  // Boot : applique le choix persisté avant que l'UI ne s'affiche
  var initial = getStoredPolice();
  if (initial) applyPolice(initial);

  // Wire le <select> de Paramètres → Apparence quand il est dispo
  function wireSelect() {
    var sel = document.getElementById('param-police-body');
    if (!sel || sel.__policeWired) return false;
    sel.__policeWired = true;
    // Restaurer la valeur visible si elle a été persistée
    var stored = getStoredPolice();
    if (stored) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].text === stored || sel.options[i].value === stored) {
          sel.selectedIndex = i;
          break;
        }
      }
    }
    sel.addEventListener('change', function () {
      var label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : 'DM Sans (défaut)';
      applyPolice(label);
      setStoredPolice(label);
      if (typeof window.afficherToast === 'function') {
        try { window.afficherToast('Police appliquée : ' + label, 'success'); } catch (_) {}
      }
    });
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!wireSelect()) { var r = 0, iv = setInterval(function(){ if (wireSelect() || ++r > 20) clearInterval(iv); }, 400); }
    });
  } else {
    if (!wireSelect()) { var r = 0, iv = setInterval(function(){ if (wireSelect() || ++r > 20) clearInterval(iv); }, 400); }
  }

  window.appliquerPoliceBody = applyPolice;
})();
