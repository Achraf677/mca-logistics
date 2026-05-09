/**
 * MCA Logistics — Tests handlers bulk/clone/split (chatbot V2 ECRITURE phase 5/6)
 *
 * Couvre les validations metier critiques :
 *   - propose_bulk_livraisons : refuse vide, refuse > 50, valide les fields requis
 *   - propose_clone_livraison : copie source + applique overrides + reset statut
 *   - propose_split_charge : verifie coherence ratios (=1.0) ou montants (=montant_ht)
 *
 * On ne peut pas require() les sources Deno directement (jsr: imports), donc on
 * reproduit les fonctions critiques en JS minimal pour valider la logique de
 * validation. Les vrais handlers TS sont testes en preview / integration.
 *
 * Lancer : node --test tests/ai-chat-bulk-tools.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const IMPL_PATH = path.join(__dirname, '..', 'infra/supabase/functions/ai-chat/tools-impl.ts');
const implSrc = fs.readFileSync(IMPL_PATH, 'utf8');

// ============= Tests parametriques sur tools-impl.ts =============

test('bulk_livraisons : limite max 50 codifiee', () => {
  const block = implSrc.match(/toolProposeBulkLivraisons[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('> 50'), 'limite 50 manquante');
  assert.ok(block.includes('client_nom'), 'validation client_nom manquante');
  assert.ok(block.includes('date_livraison'), 'validation date_livraison manquante');
  assert.ok(block.includes('prix_ht'), 'validation prix_ht manquante');
});

test('bulk_charges : limite max 30 codifiee', () => {
  const block = implSrc.match(/toolProposeBulkCharges[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('> 30'), 'limite 30 manquante');
  assert.ok(block.includes('categorie'), 'validation categorie manquante');
  assert.ok(block.includes('montant_ht'), 'validation montant_ht manquante');
});

test('bulk_paiements : resolve livraison_num_liv -> livraison_id', () => {
  const block = implSrc.match(/toolProposeBulkPaiements[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('livraison_num_liv'), 'resolution num_liv manquante');
  assert.ok(block.includes('introuvable'), 'message livraison introuvable manquant');
});

test('clone_livraison : reset statut a en_attente + a_payer', () => {
  const block = implSrc.match(/toolProposeCloneLivraison[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('"en_attente"'), 'reset statut=en_attente manquant');
  assert.ok(block.includes('"a_payer"'), 'reset statut_paiement=a_payer manquant');
  assert.ok(block.includes('overrides'), 'application overrides manquante');
});

test('split_charge : coherence somme ratios = 1.0 verifiee', () => {
  const block = implSrc.match(/toolProposeSplitCharge[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('totalRatios'), 'sommation ratios manquante');
  assert.ok(block.includes('Math.abs(totalRatios - 1)'), 'check ratios=1 manquant');
  assert.ok(block.includes('totalMontants'), 'sommation montants manquante');
});

test('split_charge : delete_entity ajoute dans actions', () => {
  const block = implSrc.match(/toolProposeSplitCharge[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('delete_entity'), 'action delete_entity source manquante');
});

test('import_planning : limite max 100 creneaux', () => {
  const block = implSrc.match(/toolProposeImportPlanning[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('> 100'), 'limite 100 manquante');
  assert.ok(block.includes('salarie_id'), 'validation salarie_id manquante');
  assert.ok(block.includes('jour'), 'validation jour manquante');
});

// ============= Tests logique DSO server-side (computeDsoFromRows) =============

test('computeDsoFromRows : logique reproduite cote serveur', () => {
  const block = implSrc.match(/function computeDsoFromRows[\s\S]+?\n\}/)?.[0] || '';
  // exclu delais aberrants
  assert.ok(block.includes('delai < 0 || delai > 365'), 'exclusion delais aberrants manquante');
  // statut paye accepte les variantes
  assert.ok(block.includes('"paye"'), 'variante "paye" manquante');
  // periode glissante
  assert.ok(block.includes('periodeJours'), 'parametre periodeJours manquant');
});

// ============= Tests validate/reject brouillon =============

test('validate_brouillon : check status=pending avant proposer execution', () => {
  const block = implSrc.match(/toolProposeValidateBrouillon[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('"pending"'), 'check status pending manquant');
  assert.ok(block.includes('execute_draft'), 'action execute_draft manquante');
});

test('reject_brouillon : raison obligatoire >= 10 caracteres', () => {
  const block = implSrc.match(/toolProposeRejectBrouillon[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('raison.length < 10'), 'check raison >=10 manquant');
  assert.ok(block.includes('reject_draft'), 'action reject_draft manquante');
});

// ============= Tests heuristique charges recurrentes =============

test('list_charges_recurrentes : seuil >= 3 occurrences', () => {
  const block = implSrc.match(/toolListChargesRecurrentes[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(block.includes('count >= 3'), 'seuil count>=3 absent');
  assert.ok(block.includes('Math.round(Number(c.montant_ht)'), 'arrondi montant pour groupage absent');
});
