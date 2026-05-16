/**
 * MCA Logistics — consommerTicketAccesOnglet — déverrouillage onglet via tab_auth param URL (Phase X — extraction script.js)
 *
 * Extracted from script.js L527-546 (2026-05-16).
 */

function consommerTicketAccesOnglet() {
  if (window.__delivproTabUnlocked) return true;
  let url;
  try {
    url = new URL(window.location.href);
  } catch (_) {
    return false;
  }
  const ticketUrl = url.searchParams.get('tab_auth') || '';
  const ticketAttendu = sessionStorage.getItem(TAB_AUTH_PENDING_KEY) || '';
  if (!ticketUrl || !ticketAttendu || ticketUrl !== ticketAttendu) {
    return false;
  }
  sessionStorage.removeItem(TAB_AUTH_PENDING_KEY);
  window.__delivproTabUnlocked = true;
  url.searchParams.delete('tab_auth');
  const suffixe = url.search ? url.search : '';
  window.history.replaceState({}, document.title, url.pathname + suffixe + url.hash);
  return true;
}

if (typeof window !== 'undefined') {
  window.consommerTicketAccesOnglet = consommerTicketAccesOnglet;
}
