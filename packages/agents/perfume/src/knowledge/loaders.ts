import fs from "node:fs";
import path from "node:path";
import type { PerfumeNoteRecord } from "./types.js";

type CategoryDefinitions = Record<string, string[]>;

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../../..");
const notesPath = path.resolve(repoRoot, "perfume-knowledge/notes_info_with_profile_enriched.json");
const definitionsPath = path.resolve(repoRoot, "perfume-knowledge/definitions.ts");

let notesCache: PerfumeNoteRecord[] | null = null;
let definitionsCache: CategoryDefinitions | null = null;

export function loadPerfumeNotes() {
  if (!notesCache) {
    notesCache = JSON.parse(fs.readFileSync(notesPath, "utf8")) as PerfumeNoteRecord[];
  }
  return notesCache;
}

function parseEnumMap(source: string) {
  const match = source.match(/export enum SurveyCategoryKey\s*{([\s\S]*?)}/);
  if (!match) {
    throw new Error("Unable to parse SurveyCategoryKey enum.");
  }

  const entries = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => line.replace(/,$/, ""));

  return Object.fromEntries(
    entries.map((line) => {
      const [left, right] = line.split("=");
      return [left.trim(), right.trim().replace(/^"|"$/g, "")];
    }),
  ) as Record<string, string>;
}

function parseCategoryDefinitions(source: string, enumMap: Record<string, string>) {
  const match = source.match(/export const category_definitions = ({[\s\S]*?^});/m);
  if (!match) {
    throw new Error("Unable to parse category_definitions.");
  }

  let objectLiteral = match[1];
  objectLiteral = objectLiteral.replace(/\/\/.*$/gm, "");
  objectLiteral = objectLiteral.replace(/\[SurveyCategoryKey\.([^\]]+)\]/g, (_segment, key: string) => {
    const resolved = enumMap[key.trim()];
    return `"${resolved ?? key.trim()}"`;
  });

  return Function(`"use strict"; return (${objectLiteral});`)() as CategoryDefinitions;
}

export function loadCategoryDefinitions() {
  if (!definitionsCache) {
    const source = fs.readFileSync(definitionsPath, "utf8");
    definitionsCache = parseCategoryDefinitions(source, parseEnumMap(source));
  }
  return definitionsCache;
}
