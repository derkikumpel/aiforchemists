import fs from 'fs-extra';
import { InferenceClient } from '@huggingface/inference';
import YAML from 'yaml';

const HF_MODEL_NAME = 'mistralai/Mistral-7B-Instruct-v0.3';
const HF_TOKEN = process.env.HF_TOKEN;

const cacheFile = './data/discover-cache.json';
const toolsFile = './data/tools.json';
const rawOutputFile = './data/gpt-output.txt';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}
function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function loadCache(file) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Cache ist kein Array');
    log(`Cache geladen: ${file} (${parsed.length} Einträge)`);
    return parsed;
  } catch {
    log(`⚠️ Cache ${file} ungültig oder leer – wird neu erstellt.`);
    return [];
  }
}

export async function discoverTools() {
  log('🚀 Starte GPT-basierte Tool-Suche...');

  const client = new InferenceClient(HF_TOKEN);
  const cache = await loadCache(cacheFile);
  const existingTools = await loadCache(toolsFile);
  const knownSlugs = new Set(existingTools.map(t => t.slug));

  const exclusionList = existingTools.map(t => `- ${t.name} (${t.slug})`).slice(0, 50).join('\n');

  const prompt = `
Please list 10 current AI tools in the field of cheminformatics or drug discovery that are NOT in the following list:

${exclusionList || '- (none listed)'}

For each tool, return:
- name
- slug (lowercase, dash-separated)
- url
- short_description (30–50 words)
- long_description (min. 150 words – required)
- tags (max. 6 relevant)
- category

Return either a valid JSON array or valid YAML list. No extra text, no commentary.
`;

  const chatCompletion = await client.chatCompletion({
    model: HF_MODEL_NAME,
    messages: [{ role: 'user', content: prompt }],
  });

  const message = chatCompletion.choices?.[0]?.message?.content || '';
  if (!message) {
    throw new Error('Keine Antwort vom Modell erhalten');
  }

  await fs.writeFile(rawOutputFile, message);
  log(`📝 Roh-Antwort gespeichert in ${rawOutputFile}`);
  log('📄 Generierter Text (erste 500 Zeichen):');
  log(message.substring(0, 500));

  let tools;
  const jsonStart = message.indexOf('[');
  const jsonEnd = message.lastIndexOf(']');

  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      const jsonString = message.substring(jsonStart, jsonEnd + 1);
      tools = JSON.parse(jsonString);
      log(`✅ JSON erfolgreich geparst mit ${tools.length} Tools.`);
    } catch (e) {
      error('❌ Fehler beim JSON-Parsing: ' + e.message);
    }
  }

  if (!tools) {
    log('⚠️ Kein JSON gefunden – versuche YAML');
    try {
      const parsed = YAML.parse(message);
      if (Array.isArray(parsed)) {
        tools = parsed;
        log(`✅ YAML erfolgreich geparst mit ${tools.length} Tools.`);
      } else {
        throw new Error('YAML enthält kein Array.');
      }
    } catch (e) {
      throw new Error('Fehler beim YAML-Parsing: ' + e.message);
    }
  }

  tools = tools.map(tool => ({
    ...tool,
    name: tool.name?.replace(/^\d+[\.\)]?\s*/, '').trim(),
  }));

  const newTools = tools.filter(t => !knownSlugs.has(t.slug));
  const updatedTools = [...existingTools, ...newTools];
  const updatedCache = [...cache, ...newTools];

  await fs.writeJson(toolsFile, updatedTools, { spaces: 2 });
  await fs.writeJson(cacheFile, updatedCache, { spaces: 2 });

  log(`💾 Tools gespeichert: ${updatedTools.length} (neu: ${newTools.length})`);
  return updatedTools;
}

if (import.meta.url === process.argv[1] || process.argv[1].endsWith('discover-tools-gpt.mjs')) {
  discoverTools().catch(e => {
    error('Uncaught Error:', e.message || e);
    process.exit(1);
  });
}
