(function () {
  var HASH_PREFIX = 'sha256:';
  var DEFAULT_TIMEOUT_MIN = 30;
  var MIN_TIMEOUT_MIN = 5;
  var MAX_TIMEOUT_MIN = 240;

  function legacyBtoa(value) {
    try {
      return btoa(String(value || ''));
    } catch (_) {
      return btoa(unescape(encodeURIComponent(String(value || ''))));
    }
  }

  async function sha256Hex(value) {
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) {
      return '';
    }
    var bytes = new TextEncoder().encode(String(value || ''));
    var digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function hashPassword(password) {
    var hash = await sha256Hex(password);
    if (hash) return HASH_PREFIX + hash;
    return legacyBtoa(password);
  }

  async function verifyPassword(password, storedValue) {
    var stored = String(storedValue || '').trim();
    if (!stored) return false;
    if (stored.indexOf(HASH_PREFIX) === 0) {
      var hash = await sha256Hex(password);
      return !!hash && stored === HASH_PREFIX + hash;
    }
    return stored === String(password || '') || stored === legacyBtoa(password);
  }

  function evaluatePassword(password, options) {
    var pwd = String(password || '');
    var settings = options && typeof options === 'object' ? options : {};
    var minLength = Number(settings.minLength || 8);
    var checks = {
      length: pwd.length >= minLength,
      lower: /[a-z]/.test(pwd),
      upper: /[A-Z]/.test(pwd),
      digit: /\d/.test(pwd)
    };
    var ok = checks.length && checks.lower && checks.upper && checks.digit;
    var score = Object.keys(checks).reduce(function (sum, key) {
      return sum + (checks[key] ? 1 : 0);
    }, 0);
    if (!pwd) {
      return {
        ok: false,
        score: 0,
        message: 'Utilisez au moins 8 caractères avec majuscule, minuscule et chiffre.',
        color: 'var(--text-muted)',
        checks: checks
      };
    }
    if (ok) {
      return {
        ok: true,
        score: score,
        message: pwd.length >= Math.max(minLength + 2, 10) ? 'Mot de passe solide.' : 'Mot de passe conforme.',
        color: 'var(--green)',
        checks: checks
      };
    }
    var missing = [];
    if (!checks.length) missing.push(minLength + ' caractères');
    if (!checks.lower) missing.push('une minuscule');
    if (!checks.upper) missing.push('une majuscule');
    if (!checks.digit) missing.push('un chiffre');
    return {
      ok: false,
      score: score,
      message: 'Ajoutez ' + missing.join(', ') + '.',
      color: score >= 2 ? 'var(--accent)' : 'var(--red)',
      checks: checks
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getSessionTimeoutMinutes() {
    try {
      var raw = parseInt(window.localStorage.getItem('session_timeout_min') || String(DEFAULT_TIMEOUT_MIN), 10);
      return clamp(Number.isFinite(raw) ? raw : DEFAULT_TIMEOUT_MIN, MIN_TIMEOUT_MIN, MAX_TIMEOUT_MIN);
    } catch (_) {
      return DEFAULT_TIMEOUT_MIN;
    }
  }

  function getSessionTimeoutMs() {
    return getSessionTimeoutMinutes() * 60 * 1000;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(false);
    return navigator.serviceWorker.register('./sw.js').then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  window.DelivProSecurity = {
    HASH_PREFIX: HASH_PREFIX,
    legacyBtoa: legacyBtoa,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    evaluatePassword: evaluatePassword,
    getSessionTimeoutMinutes: getSessionTimeoutMinutes,
    getSessionTimeoutMs: getSessionTimeoutMs,
    registerServiceWorker: registerServiceWorker
  };
})();
