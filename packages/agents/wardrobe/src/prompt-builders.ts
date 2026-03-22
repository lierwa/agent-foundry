import fs from "node:fs";
import path from "node:path";

function promptPath(name: string) {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "prompts", name);
}

export function loadWardrobePrompt(name: string) {
  return fs.readFileSync(promptPath(name), "utf8").trim();
}
