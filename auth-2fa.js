/**
 * MCA Logistics — Helpers 2FA (TOTP) via Supabase Auth MFA
 *
 * Supabase supporte nativement le 2FA TOTP (Time-based One-Time Password,
 * compatible Google Authenticator / Authy / 1Password).
 *
 * Pour activer le 2FA pour les admins :
 *  1. Dashboard Supabase : Authentication > Providers > activer "Multi-Factor Authentication"
 *     https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/auth/providers
 *  2. Optionnel : forcer le 2FA via une RLS policy AAL2 (Authentication Assurance Level 2)
 *  3. Chaque admin (Achraf + Mohammed) appelle MCA.auth2FA.enroll() pour scanner le QR
 *
 * API exposee :
 *   MCA.auth2FA.listFactors()       -> { ok, factors }
 *   MCA.auth2FA.enroll()            -> { ok, qrCode, secret, factorId }
 *   MCA.auth2FA.verifyEnrollment(factorId, code) -> { ok }
 *   MCA.auth2FA.challenge(code)     -> { ok }
 *   MCA.auth2FA.unenroll(factorId)  -> { ok }
 */

(function () {
  'use strict';

  function getClient() {
    return window.DelivProSupabase && window.DelivProSupabase.getClient
      ? window.DelivProSupabase.getClient()
      : null;
  }

  async function listFactors() {
    var client = getClient();
    if (!client) return { ok: false, error: 'no client' };
    try {
      var r = await client.auth.mfa.listFactors();
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true, factors: (r.data && r.data.totp) || [] };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function enroll() {
    var client = getClient();
    if (!client) return { ok: false, error: 'no client' };
    try {
      var r = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MCA Logistics' });
      if (r.error) return { ok: false, error: r.error.message };
      return {
        ok: true,
        factorId: r.data.id,
        qrCode: r.data.totp.qr_code, // SVG/dataURL pour afficher dans l'UI
        secret: r.data.totp.secret,  // backup manuel
        uri: r.data.totp.uri
      };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function verifyEnrollment(factorId, code) {
    var client = getClient();
    if (!client) return { ok: false, error: 'no client' };
    try {
      var c = await client.auth.mfa.challenge({ factorId: factorId });
      if (c.error) return { ok: false, error: c.error.message };
      var v = await client.auth.mfa.verify({ factorId: factorId, challengeId: c.data.id, code: code });
      if (v.error) return { ok: false, error: v.error.message };
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function challenge(factorId, code) {
    var client = getClient();
    if (!client) return { ok: false, error: 'no client' };
    try {
      var c = await client.auth.mfa.challenge({ factorId: factorId });
      if (c.error) return { ok: false, error: c.error.message };
      var v = await client.auth.mfa.verify({ factorId: factorId, challengeId: c.data.id, code: code });
      if (v.error) return { ok: false, error: v.error.message };
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function unenroll(factorId) {
    var client = getClient();
    if (!client) return { ok: false, error: 'no client' };
    try {
      var r = await client.auth.mfa.unenroll({ factorId: factorId });
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function getAal() {
    var client = getClient();
    if (!client) return { ok: false, error: 'no client' };
    try {
      var r = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error) return { ok: false, error: r.error.message };
      return { ok: true, current: r.data.currentLevel, next: r.data.nextLevel };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  window.MCA = window.MCA || {};
  window.MCA.auth2FA = {
    listFactors: listFactors,
    enroll: enroll,
    verifyEnrollment: verifyEnrollment,
    challenge: challenge,
    unenroll: unenroll,
    getAal: getAal
  };
})();
