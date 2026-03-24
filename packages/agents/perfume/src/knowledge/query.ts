import type {
  PerfumeAgentCandidate,
  PerfumeAgentCandidatePoolRequest,
  PerfumeAgentCandidateSet,
} from "../schemas.js";
import { loadCategoryDefinitions, loadPerfumeNotes } from "./loaders.js";
import type { PerfumeNoteRecord } from "./types.js";

function materialId(note: PerfumeNoteRecord, category: "top" | "middle" | "base") {
  return `${note.global_id}_${note.name}_${category}`;
}

function candidateFromNote(
  note: PerfumeNoteRecord,
  category: "top" | "middle" | "base",
  reasoning: string,
): PerfumeAgentCandidate {
  return {
    id: materialId(note, category),
    name: note.name,
    category,
    families: [note.olfactory_family, note.sub_olfactory_family],
    volatility: note.volatility,
    impact_level: note.impact_level,
    structural_power: note.structural_power,
    reasoning,
  };
}

function tokenize(text: string) {
  return text
    .split(/[\s,，。；;、/]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHaystack(note: PerfumeNoteRecord) {
  return [
    note.name,
    note.pinyin,
    note.description,
    note.olfactory_family,
    note.sub_olfactory_family,
  ]
    .join(" ")
    .toLowerCase();
}

export function searchNotes(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return loadPerfumeNotes().filter((note) => normalizeHaystack(note).includes(normalized));
}

export function resolveCategoryCandidates(queryText: string) {
  const definitions = loadCategoryDefinitions();
  const matchedIds = new Set<string>();
  for (const [label, ids] of Object.entries(definitions)) {
    const readable = label.split("_")[0];
    const english = label.split("_").slice(1).join("_");
    if (queryText.includes(readable) || (english && queryText.toLowerCase().includes(english.toLowerCase()))) {
      ids.forEach((id) => matchedIds.add(id));
    }
  }
  return matchedIds;
}

function chooseCategory(note: PerfumeNoteRecord, preferred: "top" | "middle" | "base") {
  return note.category.includes(preferred) ? preferred : note.category[0];
}

function buildPreferenceSignals(request: PerfumeAgentCandidatePoolRequest) {
  const goal = request.goal.toLowerCase();
  const note = request.approval?.note?.toLowerCase() ?? "";
  const directSignals = [
    ...tokenize(goal),
    ...tokenize(note),
    ...(request.intention?.expressive_pool ?? []).map((item) => item.toLowerCase()),
    ...(request.approval?.selections ?? []).map((item) => item.toLowerCase()),
  ];

  const seasonalSignals =
    goal.includes("春")
      ? ["茶", "绿", "柑橘", "白花", "水感", "清新", "轻透"]
      : [];

  const themeSignals = (() => {
    switch (request.intention?.core_theme) {
      case "木质":
        return ["木", "wood", "cedar", "sand", "musk"];
      case "花香":
        return ["花", "白花", "rose", "floral", "jasmine"];
      case "柑橘":
        return ["柑橘", "citrus", "bergamot", "orange", "lemon"];
      case "水生海洋":
        return ["海", "水", "aquatic", "marine"];
      default:
        return [];
    }
  })();

  return [...new Set([...directSignals, ...seasonalSignals, ...themeSignals])];
}

function buildAvoidSignals(request: PerfumeAgentCandidatePoolRequest) {
  const goal = request.goal.toLowerCase();
  const avoid = request.intention?.avoid_notes ?? [];
  const tokens = [...avoid.flatMap((item) => tokenize(item))];
  if (goal.includes("不要太刺激") || goal.includes("不刺激")) {
    tokens.push("刺激", "辛辣", "spicy");
  }
  return [...new Set(tokens)];
}

function scoreNote(
  note: PerfumeNoteRecord,
  preferredCategory: "top" | "middle" | "base",
  request: PerfumeAgentCandidatePoolRequest,
  positiveSignals: string[],
  avoidSignals: string[],
) {
  const haystack = normalizeHaystack(note);
  let score = 0;

  positiveSignals.forEach((signal) => {
    if (haystack.includes(signal)) {
      score += 3;
    }
  });

  avoidSignals.forEach((signal) => {
    if (haystack.includes(signal)) {
      score -= 8;
    }
  });

  if (request.intention?.core_theme === "木质" && haystack.includes("木")) {
    score += 3;
  }
  if (request.goal.includes("春")) {
    score += note.freshness >= 6 ? 2 : 0;
    score -= note.dryness >= 8 ? 1 : 0;
  }
  if (request.goal.includes("不要太刺激") || request.goal.includes("不刺激")) {
    if (note.impact_level === "high") {
      score -= 5;
    }
    if (preferredCategory === "top" && note.impact_level === "low") {
      score += 2;
    }
  }
  if (request.intention?.impact_policy === "forbidden" && preferredCategory === "top") {
    score -= note.impact_level === "high" ? 6 : 0;
  }
  if (request.intention?.impact_policy === "limited" && preferredCategory === "top") {
    score -= note.impact_level === "high" ? 3 : 0;
  }
  if (request.intention?.dominant_layer === "Structure" && preferredCategory === "base") {
    score += note.structural_power >= 0.7 ? 3 : 0;
  }
  if (request.intention?.dominant_layer === "Body" && preferredCategory === "middle") {
    score += note.structural_power < 0.7 ? 2 : 0;
  }
  if (
    request.intention?.core_theme === "木质" &&
    request.goal.includes("春") &&
    ["top", "middle"].includes(preferredCategory)
  ) {
    if (haystack.includes("茶") || haystack.includes("柑橘") || haystack.includes("白花") || haystack.includes("绿")) {
      score += 3;
    }
  }
  if (preferredCategory === "base" && note.structural_power >= 0.7) {
    score += 2;
  }
  if (preferredCategory === "middle" && (request.intention?.expressive_pool ?? []).some((item) => haystack.includes(item.toLowerCase()))) {
    score += 4;
  }

  return score;
}

function pickCandidates(
  notes: PerfumeNoteRecord[],
  preferredCategory: "top" | "middle" | "base",
  request: PerfumeAgentCandidatePoolRequest,
  positiveSignals: string[],
  avoidSignals: string[],
  limit: number,
) {
  return notes
    .filter((note) => note.category.includes(preferredCategory))
    .map((note) => ({
      note,
      score: scoreNote(note, preferredCategory, request, positiveSignals, avoidSignals),
    }))
    .filter((entry) => entry.score > -4)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ note, score }) =>
      candidateFromNote(
        note,
        chooseCategory(note, preferredCategory),
        `结构化召回得分 ${score}，基于 goal/intention/approval 联合筛选`,
      ),
    );
}

export function buildCandidatePool(request: PerfumeAgentCandidatePoolRequest): PerfumeAgentCandidateSet {
  const notes = loadPerfumeNotes();
  const positiveSignals = buildPreferenceSignals(request);
  const avoidSignals = buildAvoidSignals(request);

  const pool: PerfumeAgentCandidateSet = {
    top: pickCandidates(notes, "top", request, positiveSignals, avoidSignals, 6),
    middle: pickCandidates(notes, "middle", request, positiveSignals, avoidSignals, 9),
    base: pickCandidates(notes, "base", request, positiveSignals, avoidSignals, 6),
  };

  if (pool.top.length === 0 || pool.middle.length === 0 || pool.base.length === 0) {
    const fallbackText = [
      request.goal,
      request.intention?.core_theme,
      ...(request.intention?.expressive_pool ?? []),
      ...(request.approval?.selections ?? []),
      request.approval?.note ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    const categoryMatches = resolveCategoryCandidates(fallbackText);
    for (const rawId of categoryMatches) {
      const noteId = Number(rawId.split("_")[0]);
      const note = notes.find((entry) => entry.global_id === noteId);
      if (!note) {
        continue;
      }
      if (pool.top.length < 6 && note.category.includes("top")) {
        pool.top.push(candidateFromNote(note, chooseCategory(note, "top"), "由分类定义回填补足 top 候选"));
      }
      if (pool.middle.length < 9 && note.category.includes("middle")) {
        pool.middle.push(candidateFromNote(note, chooseCategory(note, "middle"), "由分类定义回填补足 middle 候选"));
      }
      if (pool.base.length < 6 && note.category.includes("base")) {
        pool.base.push(candidateFromNote(note, chooseCategory(note, "base"), "由分类定义回填补足 base 候选"));
      }
    }
  }

  return {
    top: [...new Map(pool.top.map((item) => [item.id, item])).values()],
    middle: [...new Map(pool.middle.map((item) => [item.id, item])).values()],
    base: [...new Map(pool.base.map((item) => [item.id, item])).values()],
  };
}
