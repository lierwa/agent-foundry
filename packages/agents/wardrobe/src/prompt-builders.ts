import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function promptPath(name: string) {
  const candidates = [
    path.resolve(moduleDir, "prompts", name),
    path.resolve(moduleDir, "..", "prompts", name),
    path.resolve(moduleDir, "..", "src", "prompts", name),
    path.resolve(moduleDir, "..", "dist", "src", "prompts", name),
  ];

  let current = moduleDir;

  for (let depth = 0; depth < 8; depth += 1) {
    candidates.push(
      path.resolve(current, "packages", "agents", "wardrobe", "src", "prompts", name),
      path.resolve(current, "packages", "agents", "wardrobe", "dist", "src", "prompts", name),
    );

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing prompt file: ${name}`);
}

export function loadWardrobePrompt(name: string) {
  return fs.readFileSync(promptPath(name), "utf8").trim();
}
