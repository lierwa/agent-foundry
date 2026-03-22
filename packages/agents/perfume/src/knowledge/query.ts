import type { PerfumeAgentCandidate, PerfumeAgentCandidateSet } from "../schemas.js";
import { loadCategoryDefinitions, loadPerfumeNotes } from "./loaders.js";
import type { PerfumeNoteRecord } from "./types.js";

function materialId(note: PerfumeNoteRecord, category: "top" | "middle" | "base") {
  return `${note.global_id}_${note.name}_${category}`;
}

function candidateFromNote(note: PerfumeNoteRecord, category: "top" | "middle" | "base", reasoning: string): PerfumeAgentCandidate {
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

export function searchNotes(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return loadPerfumeNotes().filter((note) => {
    const haystack = [
      note.name,
      note.pinyin,
      note.description,
      note.olfactory_family,
      note.sub_olfactory_family,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
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

export function buildCandidatePool(queryText: string): PerfumeAgentCandidateSet {
  const notes = loadPerfumeNotes();
  const directMatches = queryText
    .split(/[\s,，。；;、]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((token) => searchNotes(token));

  const categoryMatches = resolveCategoryCandidates(queryText);
  const selected = new Map<number, PerfumeNoteRecord>();
  for (const note of directMatches) {
    selected.set(note.global_id, note);
  }
  for (const rawId of categoryMatches) {
    const noteId = Number(rawId.split("_")[0]);
    const note = notes.find((entry) => entry.global_id === noteId);
    if (note) {
      selected.set(note.global_id, note);
    }
  }

  if (selected.size === 0) {
    for (const note of notes.slice(0, 18)) {
      selected.set(note.global_id, note);
    }
  }

  const pool: PerfumeAgentCandidateSet = { top: [], middle: [], base: [] };
  for (const note of selected.values()) {
    if (note.category.includes("top") && pool.top.length < 6) {
      pool.top.push(candidateFromNote(note, chooseCategory(note, "top"), "来自查询与分类召回"));
    }
    if (note.category.includes("middle") && pool.middle.length < 9) {
      pool.middle.push(candidateFromNote(note, chooseCategory(note, "middle"), "来自查询与分类召回"));
    }
    if (note.category.includes("base") && pool.base.length < 6) {
      pool.base.push(candidateFromNote(note, chooseCategory(note, "base"), "来自查询与分类召回"));
    }
  }
  return pool;
}
