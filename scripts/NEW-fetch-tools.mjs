import fs from 'fs-extra';
import { HfInference } from '@huggingface/inference';
import YAML from 'yaml';

const HF_MODEL_NAME = 'mistralai/Mistral-7B-Instruct-v0.3';
const HF_TOKEN = process.env.HF_TOKEN;

const cacheFile = './data/description-cache.json';
const toolsFile = './data/tools.json';

function log(...args) {
  console.log(new Date().toISOString(), 'LOG:', ...args);
}
function error(...args) {
  console.error(new Date().toISOString(), 'ERROR:', ...args);
}

async function loadCache(file) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Beschreibungscache ist kein Objekt');
    log(`Cache geladen: ${file}`);
    return parsed;
  } catch {
    log(`⚠️ Beschreibungscache ${file} ungültig oder leer – wird neu erstellt.`);
    return {};
  }
}

async function fetchToolDescriptions(tools) {
  const client = new InferenceClient(HF_TOKEN);
  const cache = await loadCache(cacheFile);
  const updatedTools = [];

  for (const tool of tools) {
    if (!tool.slug) {
      log(`⚠️ Ungültiges Tool: ${tool.name}`);
      updatedTools.push(tool);
      continue;
    }

    if (cache[tool.slug]) {
      log(`✔️ ${tool.name} bereits im Cache.`);
      updatedTools.push({ ...tool, ...cache[tool.slug] });
      continue;
    }

    const prompt = `Write two descriptions for the AI tool "${tool.name}" used in chemistry:

1. Short description (30–50 words)
2. Long description (150–250 words)

Return as JSON or YAML with fields "short_description" and "long_description". No other text.`;

    let description = null;

    try {
      log(`→ Anfrage an HF/Mistral für ${tool.name}`);
      const completion = await client.chatCompletion({
        model: HF_MODEL_NAME,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const raw = completion.choices?.[0]?.message?.content?.trim() || '';
      let parsed = null;

      if (raw.startsWith('{')) {
        parsed = JSON.parse(raw);
      } else {
        parsed = YAML.parse(raw);
      }

      if (!parsed?.short_description || !parsed?.long_description) {
        throw new Error('Unvollständige Beschreibung');
      }

      description = parsed;
      log(`✅ Beschreibung erhalten für ${tool.name}`);
    } catch (e) {
      error(`❌ Fehler für ${tool.name}: ${e.message}`);
      description = {
        short_description: tool.short_description || 'No description available.',
        long_description: tool.long_description || 'No long description available.',
      };
    }

    cache[tool.slug] = description;
    updatedTools.push({ ...tool, ...description });

    try {
      await fs.writeJson(cacheFile, cache, { spaces: 2 });
      log(`💾 Cache aktualisiert: ${tool.slug}`);
    } catch (e) {
      error(`⚠️ Fehler beim Cache-Schreiben: ${e.message}`);
    }
  }

  return updatedTools;
}

async function main() {
  try {
    const tools = await fs.readJson(toolsFile);
    if (!Array.isArray(tools) || !tools.length) {
      log('⚠️ Keine Tools gefunden.');
      return;
    }

    const updatedTools = await fetchToolDescriptions(tools);
    await fs.writeJson(toolsFile, updatedTools, { spaces: 2 });
    log(`💾 Alle Beschreibungen aktualisiert (${updatedTools.length} Tools).`);
  } catch (e) {
    error('❌ Fehler:', e.message || e);
    process.exit(1);
  }
}

if (import.meta.url === process.argv[1] || process.argv[1].endsWith('fetch-tools-gpt.mjs')) {
  main();
}
