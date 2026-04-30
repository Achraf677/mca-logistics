/**
 * MCA Logistics — Lazy Loader pour modules a chargement differe
 *
 * Charge un script JS a la demande (premiere utilisation) et execute un
 * callback une fois charge. Reduit le temps de boot de l'app en n'incluant
 * pas au demarrage les modules rarement utilises (exports, rentabilite, stats).
 *
 * Usage :
 *   await lazyLoadModule('script-stats')
 *   ou
 *   lazyLoadModule('script-exports').then(() => exporterCSV(...))
 *
 * IMPORTANT : a charger en debut de page, avant les autres scripts qui
 * pourraient referencer lazyLoadModule.
 */

(function () {
  'use strict';
  if (window.lazyLoadModule) return;

  var loadedModules = new Set();
  var loadingPromises = new Map();
  var DEFAULT_VERSION = '20260430-2';

  // Modules deja charges au boot par <script defer> : pas besoin de les recharger
  // (la page admin.html peut indiquer ce qui est deja la via window.__bootedModules)
  window.__bootedModules = window.__bootedModules || new Set();

  function lazyLoadModule(name, version) {
    if (loadedModules.has(name) || window.__bootedModules.has(name)) {
      return Promise.resolve();
    }
    if (loadingPromises.has(name)) {
      return loadingPromises.get(name);
    }

    var p = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = name + '.js?v=' + (version || DEFAULT_VERSION);
      script.async = false; // preserve l'ordre d'execution
      script.onload = function () {
        loadedModules.add(name);
        if (window.MCA && window.MCA.log) window.MCA.log('lazy', 'loaded', name);
        resolve();
      };
      script.onerror = function (e) {
        if (window.MCA && window.MCA.captureException) {
          window.MCA.captureException(new Error('[lazy-loader] failed to load ' + name), { module: name });
        }
        reject(new Error('Failed to load ' + name));
      };
      document.head.appendChild(script);
    });

    loadingPromises.set(name, p);
    return p;
  }

  // Cree un stub pour une fonction d'un module differe : a la premiere
  // utilisation, charge le module puis appelle la vraie fonction.
  function createStub(moduleName, functionName) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var self = this;
      return lazyLoadModule(moduleName).then(function () {
        var realFn = window[functionName];
        if (typeof realFn === 'function' && realFn !== window[functionName + '__stub']) {
          return realFn.apply(self, args);
        }
        console.warn('[lazy-loader] ' + functionName + ' non disponible apres chargement de ' + moduleName);
      });
    };
  }

  window.lazyLoadModule = lazyLoadModule;
  window.lazyCreateStub = createStub;
})();
