/**
 * MCA Logistics — Tests couverture tools chatbot (V2 ECRITURE)
 *
 * Couvre la coherence du contrat tools-defs.ts <-> tools-impl.ts <-> write-execute :
 *   - Pas de doublon de noms dans TOOLS
 *   - Chaque tool def a un schema valide (parameters.type='object')
 *   - Chaque propose_* mentionne dans tools-defs a un handler dans tools-impl
 *   - Les nouvelles actions bulk/clone/split/import_planning sont presentes
 *   - Les nouveaux read tools (dso, kpi, brouillons, recurrentes, anomalies) presents
 *   - Whitelist colonnes update reproduit dans write-execute pour les 12 entites
 *
 * Note : on parse les fichiers en regex au lieu de les require() directement
 * (les sources Deno utilisent jsr: / Deno.env qui ne fonctionnent pas en Node).
 *
 * Lancer : node --test tests/ai-chat-tools-coverage.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DEFS_PATH = path.join(ROOT, 'infra/supabase/functions/ai-chat/tools-defs.ts');
const IMPL_PATH = path.join(ROOT, 'infra/supabase/functions/ai-chat/tools-impl.ts');
const EXEC_PATH = path.join(ROOT, 'infra/supabase/functions/ai-chat-write-execute/index.ts');

const defsSrc = fs.readFileSync(DEFS_PATH, 'utf8');
const implSrc = fs.readFileSync(IMPL_PATH, 'utf8');
const execSrc = fs.readFileSync(EXEC_PATH, 'utf8');

// Helper : extrait tous les noms de tools (pattern `name: "X"`).
function extractToolNames(src) {
  const names = [];
  const re = /name:\s*"([a-z_][a-z0-9_]*)"/gi;
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  return names;
}

test('tools-defs : pas de doublon de nom', () => {
  const names = extractToolNames(defsSrc);
  // makeUpdateTool genere les 12 noms via interpolation, le regex literal "name:" les loupe.
  // On filtre les makeUpdateTool en parsant le tableau UPDATE_TOOLS.
  const updateMatches = [...defsSrc.matchAll(/makeUpdateTool\("([a-z_]+)"/g)].map((m) => m[1]);
  const all = [...names, ...updateMatches];
  const seen = new Set();
  const dups = [];
  for (const n of all) {
    if (seen.has(n)) dups.push(n);
    seen.add(n);
  }
  assert.deepEqual(dups, [], `doublons detectes : ${dups.join(', ')}`);
});

test('tools-defs : chaque nom a parameters.type=object au moins une fois', () => {
  // On verifie qu'il y a "parameters" + "type: \"object\"" suffisamment souvent
  const nbParameters = (defsSrc.match(/parameters:\s*\{/g) || []).length;
  const nbObjectTypes = (defsSrc.match(/type:\s*"object"/g) || []).length;
  // Chaque tool def a au moins parameters et type:object dedans
  assert.ok(nbParameters >= 40, `seulement ${nbParameters} blocs parameters trouves`);
  assert.ok(nbObjectTypes >= nbParameters, `parameters.type=object insuffisant`);
});

test('tools-impl : chaque propose_* declare dans defs a un handler', () => {
  // Liste les noms en defs (literaux + makeUpdateTool)
  const literals = extractToolNames(defsSrc).filter((n) =>
    n.startsWith('propose_') || n.startsWith('search_') || n.startsWith('get_')
    || n.startsWith('list_') || n.startsWith('add_') || n.startsWith('delete_')
    || n.startsWith('top_') || n.startsWith('livraisons_') || n.startsWith('vehicules_')
    || n.startsWith('inspections_') || n.startsWith('rentabilite_')
    || n.startsWith('match_') || n.startsWith('pennylane_') || n.startsWith('qonto_')
    || n.startsWith('ors_') || n.startsWith('sentry_') || n.startsWith('audit_'),
  );
  const updateNames = [...defsSrc.matchAll(/makeUpdateTool\("([a-z_]+)"/g)].map((m) => m[1]);
  const expected = [...new Set([...literals, ...updateNames])];

  // Liste les handlers exportes dans TOOL_HANDLERS
  const handlersBlock = implSrc.split('TOOL_HANDLERS:')[1] || '';
  const handlerKeys = [...handlersBlock.matchAll(/^\s*([a-z_][a-z0-9_]*):/gm)].map((m) => m[1]);
  const handlerSet = new Set(handlerKeys);

  const missing = expected.filter((n) => !handlerSet.has(n));
  assert.deepEqual(missing, [], `Handlers manquants : ${missing.join(', ')}`);
});

test('tools-defs : nouveaux tools bulk presents', () => {
  const names = extractToolNames(defsSrc);
  for (const expected of ['propose_bulk_livraisons', 'propose_bulk_charges', 'propose_bulk_paiements']) {
    assert.ok(names.includes(expected), `${expected} absent de tools-defs`);
  }
});

test('tools-defs : nouveaux tools metier complexes presents', () => {
  const names = extractToolNames(defsSrc);
  for (const expected of ['propose_clone_livraison', 'propose_split_charge', 'propose_import_planning']) {
    assert.ok(names.includes(expected), `${expected} absent de tools-defs`);
  }
});

test('tools-defs : nouveaux read tools presents', () => {
  const names = extractToolNames(defsSrc);
  for (const expected of [
    'get_dso_global', 'get_dso_par_client', 'list_brouillons_en_attente',
    'list_charges_recurrentes', 'get_kpi_dashboard', 'get_anomalies_synthese',
  ]) {
    assert.ok(names.includes(expected), `${expected} absent de tools-defs`);
  }
});

test('tools-defs : self-mgmt brouillons presents', () => {
  const names = extractToolNames(defsSrc);
  for (const expected of ['propose_validate_brouillon', 'propose_reject_brouillon']) {
    assert.ok(names.includes(expected), `${expected} absent de tools-defs`);
  }
});

test('tools-defs : Phase 9 anti-hallucination tools presents', () => {
  const names = extractToolNames(defsSrc);
  for (const expected of [
    'get_rentabilite_par_vehicule',
    'get_rentabilite_par_client',
    'qonto_proposer_rapprochement',
    'get_inventaire_capacites',
    'propose_provision_salarie',
  ]) {
    assert.ok(names.includes(expected), `${expected} absent de tools-defs`);
  }
});

test('tools-impl : handlers bulk/metier presents', () => {
  for (const expected of [
    'propose_bulk_livraisons', 'propose_bulk_charges', 'propose_bulk_paiements',
    'propose_clone_livraison', 'propose_split_charge', 'propose_import_planning',
    'get_dso_global', 'get_dso_par_client', 'list_brouillons_en_attente',
    'list_charges_recurrentes', 'get_kpi_dashboard', 'get_anomalies_synthese',
    'propose_validate_brouillon', 'propose_reject_brouillon',
    // Phase 9 anti-hallucination
    'get_rentabilite_par_vehicule', 'get_rentabilite_par_client',
    'qonto_proposer_rapprochement', 'get_inventaire_capacites',
    'propose_provision_salarie',
  ]) {
    assert.ok(
      implSrc.includes(`${expected}:`),
      `Handler ${expected} absent de TOOL_HANDLERS`,
    );
  }
});

test('write-execute : action provision_salarie supportee', () => {
  assert.ok(
    execSrc.includes('case "provision_salarie"'),
    'case "provision_salarie" manquant dans write-execute',
  );
  assert.ok(
    execSrc.includes('execProvisionSalarie'),
    'fonction execProvisionSalarie manquante',
  );
});

test('write-execute : action bulk_execute supportee', () => {
  assert.ok(
    execSrc.includes('case "bulk_execute"'),
    'case "bulk_execute" manquant dans le switch action',
  );
  assert.ok(execSrc.includes('execBulk'), 'fonction execBulk manquante');
});

test('write-execute : whitelist UPDATE couvre les 12 entites', () => {
  const updateBlock = execSrc.split('UPDATE_WHITELISTS:')[1] || '';
  for (const entity of [
    'livraison', 'charge', 'paiement', 'client', 'fournisseur', 'vehicule',
    'salarie', 'carburant', 'entretien', 'incident', 'planning_creneau', 'inspection',
  ]) {
    assert.ok(
      updateBlock.includes(`${entity}:`),
      `entite ${entity} absente de UPDATE_WHITELISTS dans write-execute`,
    );
  }
});

test('write-execute : revert mecanism present pour bulk atomique', () => {
  // Le revert est best-effort via insertedRows.reverse() + delete
  assert.ok(execSrc.includes('insertedRows'), 'mecanisme revert insertedRows manquant');
  assert.ok(execSrc.includes('reverted'), 'flag reverted manquant');
});
