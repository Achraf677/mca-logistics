/**
 * MCA Logistics — BUG-022 Date.prototype.toLocalISODate + toLocalISOMonth (anti-UTC drift) (Phase X — extraction script.js)
 *
 * Extracted from script.js L6-24 (2026-05-16).
 */

// BUG-022 fix : toISOString() convertit en UTC → décalage d'un jour si fuseau != UTC.
// toLocalISODate() retourne YYYY-MM-DD dans le fuseau local (utilisé partout à la place de toISOString().slice(0,10)).
if (!Date.prototype.toLocalISODate) {
  Date.prototype.toLocalISODate = function() {
    if (isNaN(this.getTime())) return '';
    const y = this.getFullYear();
    const m = String(this.getMonth() + 1).padStart(2, '0');
    const d = String(this.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
}
if (!Date.prototype.toLocalISOMonth) {
  Date.prototype.toLocalISOMonth = function() {
    if (isNaN(this.getTime())) return '';
    const y = this.getFullYear();
    const m = String(this.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  };
}
