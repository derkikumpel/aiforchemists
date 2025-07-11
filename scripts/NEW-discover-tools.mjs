import fs from 'fs-extra';
import { InferenceClient } from '@huggingface/inference';

const HF_MODEL_NAME = 'mistralai/Mistral-7B-Instruct-v0.3';
const toolsFile = './data/tools.json';
const cacheFile = './data/discover-cache.json';
const outputFile = './data/gpt-output.txt';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}
function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function loadTools(file) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Tools-Datei ist kein Array');
    return parsed;
  } catch {
    log(`⚠️ Tools-Datei ${file} ungültig oder leer – wird als leeres Array behandelt.`);
    return [];
  }
}

async function loadCache(file) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Cache ist kein Array');
    return parsed;
  } catch {
    log(`⚠️ Cache ${file} ungültig oder leer – wird als leeres Array behandelt.`);
    return [];
  }
}

export async function discoverTools() {
  const prompt = process.env.HF_PROMPT;
  if (!prompt) throw new Error('HF_PROMPT Umgebungsvariable fehlt');

  const client = new InferenceClient(process.env.HF_TOKEN);
  const existingTools = await loadTools(toolsFile);
  const cache = await loadCache(cacheFile);
  const knownSlugs = new Set(existingTools.map(t => t.slug));

  try {
    const res = await client.chatCompletion({
      model: HF_MODEL_NAME,
      messages: [{ role: 'user', content: prompt }],
    });

    const message = res.choices?.[0]?.message?.content?.trim();
    if (!message) throw new Error('Leere Antwort vom Modell');

    await fs.writeFile(outputFile, message);
    log(`📝 Modell-Antwort gespeichert in ${outputFile}`);

    let parsed = JSON.parse(message);
    if (!Array.isArray(parsed)) throw new Error('Modellantwort ist kein Array');

    const newTools = parsed.filter(t => !knownSlugs.has(t.slug));
    const updatedTools = [...existingTools, ...newTools];
    const updatedCache = [...cache, ...newTools];

    await fs.writeJson(toolsFile, updatedTools, { spaces: 2 });
    await fs.writeJson(cacheFile, updatedCache, { spaces: 2 });

    log(`✅ Tools aktualisiert: ${newTools.length} neu, ${updatedTools.length} gesamt.`);
  } catch (e) {
    error('❌ Fehler beim Tool-Fetch:', e.message);
  }
}

if (import.meta.url === process.argv[1]) {
  discoverTools();
}
