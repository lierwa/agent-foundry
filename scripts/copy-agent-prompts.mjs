import fs from "node:fs";
import path from "node:path";

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source prompts directory not found: ${sourceDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

const packageDir = process.argv[2];

if (!packageDir) {
  throw new Error("Package directory argument is required.");
}

const sourceDir = path.resolve(packageDir, "src", "prompts");
const targetDir = path.resolve(packageDir, "dist", "src", "prompts");

copyDirectory(sourceDir, targetDir);

console.log(`Copied prompts to ${targetDir}`);
