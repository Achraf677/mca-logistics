/**
 * MCA Logistics — Tests system prompt chatbot ai-chat
 *
 * Garde-fou contre la regression "chatbot hallucine ses lacunes" : verifie que
 * prompts.ts contient bien les sections cles ajoutees lors de la refonte (PR
 * claude/chatbot-prompts-refonte). Si l'une de ces sections disparait ou est
 * videe, le test echoue.
 *
 * Lancer : node --test tests/ai-chat-prompts.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROMPTS_PATH = path.join(__dirname, '..', 'infra/supabase/functions/ai-chat/prompts.ts');
const src = fs.readFileSync(PROMPTS_PATH, 'utf8');

test('prompts.ts : section "Identite MCA" + division Pennylane/Qonto presente', () => {
  assert.ok(src.includes('Identite MCA'), 'header "Identite MCA" manquant');
  assert.ok(src.includes('Pennylane') && src.includes('Qonto'), 'mentions Pennylane/Qonto manquantes');
  assert.ok(src.includes('NE DUPLIQUE PAS'), 'rappel NE DUPLIQUE PAS Pennylane/Qonto manquant');
});

test('prompts.ts : inventaire pages PC + mobile', () => {
  for (const page of [
    'Dashboard', 'Livraisons', 'Charges', 'Carburant', 'Entretiens',
    'Inspections', 'Clients', 'Vehicules', 'Salaries', 'Planning',
    'Heures', 'Rentabilite', 'TVA', 'Encaissement', 'Statistiques',
    'Brouillons IA', 'Audit', 'Parametres', 'Setup wizard',
  ]) {
    assert.ok(src.includes(page), `page "${page}" absente du systeme prompt`);
  }
});

test('prompts.ts : integrations actives listees', () => {
  for (const tag of [
    'Pennylane : import FEC',
    'Qonto : sync quotidien',
    'OCR Gemini Flash',
    'OpenRouteService',
    'Bug report in-app',
    'Visual agent quotidien',
  ]) {
    assert.ok(src.includes(tag), `integration "${tag}" absente`);
  }
});

test('prompts.ts : tools listes par categories (lecture / ecriture / memoire)', () => {
  assert.ok(src.includes('LECTURE / ANALYSE'), 'section LECTURE manquante');
  assert.ok(src.includes('ECRITURE'), 'section ECRITURE manquante');
  for (const tool of [
    'rentabilite_tournee', 'get_rentabilite_par_vehicule', 'get_rentabilite_par_client',
    'qonto_proposer_rapprochement', 'get_inventaire_capacites',
    'propose_provision_salarie', 'propose_bulk_livraisons',
    'propose_clone_livraison', 'propose_split_charge', 'propose_import_planning',
    'audit_coherence_donnees', 'get_dso_global', 'get_kpi_dashboard',
  ]) {
    assert.ok(src.includes(tool), `tool "${tool}" non mentionne dans prompts.ts`);
  }
});

test('prompts.ts : REGLE D\'OR anti-hallucination presente', () => {
  assert.ok(src.includes("REGLE D'OR"), 'header REGLE D\'OR manquant');
  assert.ok(
    src.includes('VERIFIE D\'ABORD ta liste de tools')
    || src.includes('VERIFIE D’ABORD ta liste de tools'),
    'consigne VERIFIE D\'ABORD ta liste de tools manquante',
  );
  assert.ok(src.includes('NE DIS JAMAIS'), 'consigne NE DIS JAMAIS qu\'une feature manque manquante');
});

test('prompts.ts : pieges historiques documentes (anti-hallucination)', () => {
  for (const piege of [
    'rapprochement bancaire',
    'rentabilite par trajet',
    'PDF facture',
    'tableaux de bord visuels',
    'gestion utilisateurs',
    'DSO',
    'audit',
  ]) {
    assert.ok(
      src.toLowerCase().includes(piege.toLowerCase()),
      `piege historique "${piege}" non documente comme exemple anti-hallucination`,
    );
  }
});

test('prompts.ts : section V2 ECRITURE + provision_salarie cite', () => {
  assert.ok(src.includes('V2 ECRITURE'), 'section V2 ECRITURE manquante');
  assert.ok(src.includes('propose_provision_salarie'), 'COMPTE CHAUFFEUR (provision_salarie) non documente');
});

test('prompts.ts : conventions semantiques (rapprochement Qonto)', () => {
  assert.ok(
    src.includes('qonto_proposer_rapprochement'),
    'qonto_proposer_rapprochement non mentionne dans conventions semantiques',
  );
  assert.ok(
    src.includes('match_factures_pennylane_mca'),
    'match_factures_pennylane_mca non mentionne',
  );
});
