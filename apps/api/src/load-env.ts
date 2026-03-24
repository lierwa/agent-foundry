import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function resolveEnvCandidates() {
  const currentFile = fileURLToPath(import.meta.url);
  const apiDir = path.resolve(path.dirname(currentFile), "..");
  const repoRoot = path.resolve(apiDir, "..", "..");

  return [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "apps/api/.env"),
    path.resolve(apiDir, ".env"),
    path.resolve(repoRoot, "apps/api/.env"),
  ];
}

export function loadLocalEnv() {
  for (const envPath of resolveEnvCandidates()) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const source = fs.readFileSync(envPath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.value;
      }
    }

    return envPath;
  }

  return null;
}
