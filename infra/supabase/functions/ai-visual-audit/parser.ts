// Parser des reponses Gemini pour l'audit visuel.
// On extrait du JSON structure (avec tolerance markdown / code fences) puis
// on normalise chaque issue : severity, location, description, fix_suggestion.
//
// Ce module est exporte sans dependance Deno pour pouvoir etre teste en Node
// (`node --test`). Le fichier index.ts importe simplement parseGeminiAudit().

export type Severity = "critical" | "major" | "minor";

export interface VisualIssue {
  severity: Severity;
  location: string;
  description: string;
  fix_suggestion: string;
}

const ALLOWED_SEVERITY: ReadonlySet<Severity> = new Set(["critical", "major", "minor"]);

// Strip ```json ... ``` au cas ou Gemini renvoie un fence malgre l'instruction
// JSON-only. On retourne aussi le 1er bloc { ... } trouve si du texte parasite
// le precede ("Voici l'analyse :"). Suffisant pour les JSON plats demandes.
export function extractJsonBlock(raw: string): unknown | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Tente directement (cas nominal, responseMimeType=application/json)
  try {
    return JSON.parse(s);
  } catch (_) { /* fallthrough */ }

  // Sinon cherche un objet ou un tableau a l'interieur
  const startObj = s.indexOf("{");
  const startArr = s.indexOf("[");
  let start = -1;
  let endChar = "";
  if (startArr !== -1 && (startObj === -1 || startArr < startObj)) {
    start = startArr;
    endChar = "]";
  } else if (startObj !== -1) {
    start = startObj;
    endChar = "}";
  }
  if (start === -1) return null;
  const end = s.lastIndexOf(endChar);
  if (end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function normSeverity(v: unknown): Severity {
  if (typeof v !== "string") return "minor";
  const s = v.trim().toLowerCase();
  // Tolerance synonymes : "high" -> critical, "medium" -> major, "low" -> minor
  if (s === "critical" || s === "high" || s === "blocker") return "critical";
  if (s === "major" || s === "medium" || s === "warning") return "major";
  if (ALLOWED_SEVERITY.has(s as Severity)) return s as Severity;
  return "minor";
}

function normString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

// Normalise une issue brute (potentiellement quelconque) en VisualIssue propre.
// Ignore les entries sans description (sinon le rapport est inutile).
export function normalizeIssue(raw: unknown): VisualIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const description = normString(r.description ?? r.issue ?? r.problem, 1000);
  if (!description) return null;
  return {
    severity: normSeverity(r.severity ?? r.level ?? r.priority),
    location: normString(r.location ?? r.area ?? r.zone ?? r.selector, 200),
    description,
    fix_suggestion: normString(r.fix_suggestion ?? r.fix ?? r.suggestion ?? r.recommendation, 500),
  };
}

// Parse une reponse Gemini complete et renvoie la liste des issues structurees.
// Tolere :
//   - { "issues": [...] }
//   - { "findings": [...] }
//   - directement un tableau [...]
// Plafonne a 50 issues par screenshot pour eviter qu'un modele bavard
// engorge le rapport.
export function parseGeminiAudit(raw: string): VisualIssue[] {
  const obj = extractJsonBlock(raw);
  if (!obj) return [];
  let arr: unknown[] = [];
  if (Array.isArray(obj)) {
    arr = obj;
  } else if (obj && typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (Array.isArray(o.issues)) arr = o.issues;
    else if (Array.isArray(o.findings)) arr = o.findings;
    else if (Array.isArray(o.results)) arr = o.results;
  }
  const out: VisualIssue[] = [];
  for (const item of arr.slice(0, 50)) {
    const norm = normalizeIssue(item);
    if (norm) out.push(norm);
  }
  return out;
}

// Retourne un map { critical, major, minor } pour les stats.
export function countBySeverity(issues: ReadonlyArray<VisualIssue>): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
  for (const i of issues) c[i.severity]++;
  return c;
}
