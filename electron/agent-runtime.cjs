const fs = require("node:fs");
const path = require("node:path");

function parseArgs(input) {
  if (!input.trim()) return [];
  const matches = input.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) || [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ""));
}

function buildCommand(agent, prompt) {
  const args = parseArgs(agent.args || "");
  if (agent.mode === "oneshot") {
    const hasPromptPlaceholder = args.some((arg) => arg.includes("{prompt}"));
    const nextArgs = args.map((arg) => arg.replaceAll("{prompt}", prompt));
    return {
      command: agent.command,
      args: hasPromptPlaceholder ? nextArgs : [...nextArgs, prompt]
    };
  }
  return { command: agent.command, args };
}

function isImageFile(filePath) {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"].includes(path.extname(filePath).toLowerCase());
}

function listImages(root, maxDepth = 4) {
  const images = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && isImageFile(fullPath)) {
        images.push(fullPath);
      }
    }
  }
  walk(root, 0);
  return images;
}

function scoreImageForQuery(filePath, queryParts) {
  const normalized = filePath.toLowerCase();
  return queryParts.reduce((score, part) => {
    const query = part.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!query) return score;
    const compactPath = normalized.replace(/[^a-z0-9]+/g, "");
    return compactPath.includes(query) ? score + 1 : score;
  }, 0);
}

function pickBestImage(images, queryParts) {
  return images
    .map((filePath) => ({ filePath, score: scoreImageForQuery(filePath, queryParts) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.filePath.length - b.filePath.length)[0]?.filePath;
}

module.exports = {
  buildCommand,
  isImageFile,
  listImages,
  parseArgs,
  pickBestImage,
  scoreImageForQuery
};
