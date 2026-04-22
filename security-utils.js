(function () {
  var SHA256_PREFIX = 'sha256:';
  var PBKDF2_PREFIX = 'pbkdf2:';
  var PBKDF2_ITERATIONS = 210000;
  var PBKDF2_SALT_BYTES = 16;
  var PBKDF2_KEY_BITS = 256;
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

  function hasSubtleCrypto() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  }

  function bytesToBase64(bytes) {
    var bin = '';
    var arr = new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    var bin = atob(String(b64 || ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function sha256Hex(value) {
    if (!hasSubtleCrypto()) return '';
    var bytes = new TextEncoder().encode(String(value || ''));
    var digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function pbkdf2DeriveBits(password, saltBytes, iterations) {
    var enc = new TextEncoder();
    var keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']
    );
    return window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: iterations,
      hash: 'SHA-256'
    }, keyMaterial, PBKDF2_KEY_BITS);
  }

  async function hashPasswordPBKDF2(password, saltBase64) {
    if (!hasSubtleCrypto()) return '';
    var salt = saltBase64
      ? base64ToBytes(saltBase64)
      : window.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
    var derived = await pbkdf2DeriveBits(password, salt, PBKDF2_ITERATIONS);
    return PBKDF2_PREFIX + PBKDF2_ITERATIONS + ':' + bytesToBase64(salt) + ':' + bytesToBase64(derived);
  }

  async function hashPassword(password) {
    var pbkdf2 = await hashPasswordPBKDF2(password);
    if (pbkdf2) return pbkdf2;
    var hash = await sha256Hex(password);
    if (hash) return SHA256_PREFIX + hash;
    return legacyBtoa(password);
  }

  async function verifyPassword(password, storedValue) {
    var stored = String(storedValue || '').trim();
    if (!stored) return false;
    if (stored.indexOf(PBKDF2_PREFIX) === 0) {
      var parts = stored.split(':');
      if (parts.length < 4) return false;
      var iters = parseInt(parts[1], 10);
      if (!Number.isFinite(iters) || iters < 1000) return false;
      try {
        var saltBytes = base64ToBytes(parts[2]);
        var derived = await pbkdf2DeriveBits(password, saltBytes, iters);
        var computed = PBKDF2_PREFIX + iters + ':' + parts[2] + ':' + bytesToBase64(derived);
        return computed === stored;
      } catch (_) {
        return false;
      }
    }
    if (stored.indexOf(SHA256_PREFIX) === 0) {
      var legacy = await sha256Hex(password);
      var match = !!legacy && stored === SHA256_PREFIX + legacy;
      if (match) {
        return { ok: true, rehash: await hashPassword(password) };
      }
      return false;
    }
    // Legacy btoa ou plaintext
    var plainMatch = stored === String(password || '') || stored === legacyBtoa(password);
    if (plainMatch) {
      return { ok: true, rehash: await hashPassword(password) };
    }
    return false;
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

  window.DelivProSecurity = {
    HASH_PREFIX: SHA256_PREFIX,
    SHA256_PREFIX: SHA256_PREFIX,
    PBKDF2_PREFIX: PBKDF2_PREFIX,
    legacyBtoa: legacyBtoa,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    evaluatePassword: evaluatePassword,
    getSessionTimeoutMinutes: getSessionTimeoutMinutes,
    getSessionTimeoutMs: getSessionTimeoutMs
  };
})();
