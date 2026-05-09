// Dedup logic pour ai-brief — evite de re-proposer une decision deja mentionnee
// dans un des 3 derniers runs ai_brief_runs.
//
// Pourquoi un fichier .mjs (et pas .ts) :
// - Deno + Node lisent tous deux ce format ESM directement (crypto.subtle et
//   TextEncoder sont globaux dans Node >=20).
// - Permet d'importer cette logique depuis tests/ai-brief-dedup.test.js sans
//   avoir besoin d'un transpileur TS.
// - dedup.ts existe en parallele uniquement comme typing facade (re-exports).
//
// Format d'une decision (ai_brief_runs.decisions[] jsonb) :
//   { titre, description, priorite, actions: [{id,label,style}] }
// Format simple aussi tolere :
//   { type, entity_id, message }
//
// Hash canonique : SHA-1(`${type}|${entity_id}|${message_normalized}`).

/**
 * Normalise une string pour hashing stable :
 * - lowercase
 * - trim
 * - espaces multiples compactes en un seul
 */
export function normalizeForHash(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * SHA-1 d'une chaine UTF-8 -> hex.
 */
export async function sha1Hex(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash canonique d'une decision : `${type}|${entity_id}|${message_normalized}`.
 * - "type" : on prefere `priorite`, fallback `type` du format simple.
 * - "entity_id" : la 1re action.id (ex: "ouvrir_livraison") ou entity_id direct.
 * - "message" : si format simple -> d.message, sinon `${titre} ${description}`.
 */
export async function hashDecision(d) {
  if (!d || typeof d !== 'object') return '';
  const type = normalizeForHash(d.type ?? d.priorite ?? '');
  const entityId = normalizeForHash(
    d.entity_id ?? (Array.isArray(d.actions) && d.actions[0]?.id) ?? '',
  );
  const msgRaw = d.message != null
    ? d.message
    : `${d.titre ?? ''} ${d.description ?? ''}`;
  const message = normalizeForHash(msgRaw);
  const key = `${type}|${entityId}|${message}`;
  return sha1Hex(key);
}

/**
 * Construit un Set de hashs a partir des decisions des N derniers runs.
 */
export async function buildRecentlyMentioned(recentRuns) {
  const set = new Set();
  for (const run of recentRuns) {
    const decs = Array.isArray(run.decisions) ? run.decisions : [];
    for (const d of decs) {
      const h = await hashDecision(d);
      if (h) set.add(h);
    }
  }
  return set;
}

/**
 * Filtre une liste de decisions candidates contre un set de hashs deja vus.
 * Retourne { kept, skipped } ou skipped = nb de decisions filtrees.
 */
export async function dedupDecisions(candidates, recentlyMentioned) {
  const kept = [];
  let skipped = 0;
  for (const d of candidates) {
    const h = await hashDecision(d);
    if (h && recentlyMentioned.has(h)) {
      skipped++;
      continue;
    }
    kept.push(d);
  }
  return { kept, skipped };
}
