import fs from 'fs-extra';
import YAML from 'yaml';
import { HfInference } from '@huggingface/inference';

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
    const parsed = await fs.readJson(file);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    log(`⚠️ Tools-Datei ${file} ungültig oder leer – wird als leeres Array behandelt.`);
    return [];
  }
}

async function loadCache(file) {
  try {
    const parsed = await fs.readJson(file);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    log(`⚠️ Cache-Datei ${file} ungültig oder leer – wird als leeres Array behandelt.`);
    return [];
  }
}

export async function discoverTools() {
  const prompt = process.env.HF_PROMPT;
  if (!prompt) throw new Error('HF_PROMPT Umgebungsvariable fehlt');

  const client = new HfInference(process.env.HF_TOKEN);
  const existingTools = await loadTools(toolsFile);
  const cache = await loadCache(cacheFile);
  const knownSlugs = new Set(existingTools.map(t => t.slug));

  log('🧠 Anfrage an Mistral-Modell wird gesendet...');
  const response = await client.chatCompletion({
    model: HF_MODEL_NAME,
    messages: [{ role: 'user', content: prompt }],
  });

  const message = response.choices?.[0]?.message?.content?.trim();
  if (!message) throw new Error('Leere Antwort vom Modell');

  await fs.writeFile(outputFile, message);
  log(`📝 Modellantwort gespeichert in ${outputFile}`);

  let parsed;
  const jsonStart = message.indexOf('[');
  const jsonEnd = message.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      parsed = JSON.parse(message.substring(jsonStart, jsonEnd + 1));
      log(`✅ JSON erfolgreich geparst mit ${parsed.length} Tools.`);
    } catch (e) {
      error('❌ JSON-Parsing fehlgeschlagen:', e.message);
    }
  }

  if (!parsed) {
    try {
      parsed = YAML.parse(message);
      if (!Array.isArray(parsed)) throw new Error('Kein Array in YAML');
      log(`✅ YAML erfolgreich geparst mit ${parsed.length} Tools.`);
    } catch (e) {
      throw new Error('Fehler beim Parsen von YAML: ' + e.message);
    }
  }

  parsed = parsed.map(tool => ({
    ...tool,
    name: tool.name.replace(/^\d+[\.\)]?\s*/, '').trim(),
  }));

  const newTools = parsed.filter(t => !knownSlugs.has(t.slug));
  const updatedTools = [...existingTools, ...newTools];
  const updatedCache = [...cache, ...newTools];

  await fs.writeJson(toolsFile, updatedTools, { spaces: 2 });
  await fs.writeJson(cacheFile, updatedCache, { spaces: 2 });

  log(`✅ Tools aktualisiert: ${newTools.length} neu, ${updatedTools.length} gesamt.`);
}

if (import.meta.url === process.argv[1]) {
  discoverTools().catch((e) => {
    error(`❌ Fehler: ${e.message}`);
    process.exit(1);
  });
}

