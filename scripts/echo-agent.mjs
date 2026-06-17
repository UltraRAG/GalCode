const prompt = process.argv.slice(2).join(" ") || (await readStdin());

console.log("GalCode Echo Agent");
console.log(`Prompt: ${prompt.trim() || "(empty)"}`);
console.log("Status: ok");

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}
