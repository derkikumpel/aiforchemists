import fs from 'fs-extra';
import OpenAI from 'openai';
import fetch from 'node-fetch';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openaiModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

const cacheFile = './data/discover-cache.json';
const toolsFile = './data/tools.json';

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

  const cache = await loadCache(cacheFile);
  const existingTools = await loadCache(toolsFile);
  const knownSlugs = new Set(existingTools.map(t => t.slug));

  const exclusionList = existingTools.map(t => `- ${t.name} (${t.slug})`).slice(0, 50).join('\n');

  const prompt = `
Please list 10 current AI tools in the field of cheminformatics or drug discovery that are NOT in the following list:

${exclusionList || '- (none listed)'}

For each tool, return a JSON object with the following fields:
- name
- slug (lowercase, dash-separated)
- url
- short_description (30–50 words)
- long_description (must be at least 150 words – this is required and will be checked)
- tags (maximum of 6 relevant tags)
- category (e.g., synthesis, analysis, database, etc.)

⚠️ IMPORTANT:
- Ensure the long_description has a minimum of 150 words. Do not summarize or skip this requirement.
- Return only a valid JSON array of tool objects. No commentary, no code block syntax.

Respond only with the JSON array.
`;

  let tools = null;

  for (const model of openaiModels) {
    try {
      log(`→ Versuche OpenAI Modell: ${model}`);
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const raw = completion.choices[0].message.content.trim();
      const jsonStart = raw.indexOf('[');
      const jsonEnd = raw.lastIndexOf(']');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('Kein JSON erkannt');

      tools = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
      log(`✅ Tools gefunden mit ${model} (${tools.length} Tools)`);
      break;
    } catch (e) {
      error(`⚠️ OpenAI-Fehler (${model}): ${e.message}`);
    }
  }

  // DeepSeek Fallback
  if (!tools) {
    try {
      log('→ Versuche DeepSeek Fallback');

      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '';

      if (!raw) {
        throw new Error(`DeepSeek-Antwort enthält kein content-Feld. Vollständige Antwort:\n${JSON.stringify(data, null, 2)}`);
      }

      const jsonStart = raw.indexOf('[');
      const jsonEnd = raw.lastIndexOf(']');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('DeepSeek: Kein JSON erkannt');

      tools = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
      log(`✅ Tools gefunden mit DeepSeek (${tools.length} Tools)`);
    } catch (e) {
      error(`❌ DeepSeek-Fehler: ${e.message}`);
    }
  }

  if (!tools) {
    error('❌ Keine neuen Tools entdeckt. Benutze nur Cache.');
    await fs.writeJson(toolsFile, existingTools, { spaces: 2 });
    return existingTools;
  }

  const newTools = tools.filter(t => !knownSlugs.has(t.slug));
  const updatedTools = [...existingTools, ...newTools];
  const updatedCache = [...cache, ...newTools];

  await fs.writeJson(toolsFile, updatedTools, { spaces: 2 });
  await fs.writeJson(cacheFile, updatedCache, { spaces: 2 });

  log(`💾 Tools gespeichert: ${updatedTools.length} Einträge (davon neu: ${newTools.length})`);
  return updatedTools;
}

if (import.meta.url === process.argv[1] || process.argv[1].endsWith('discover-tools-gpt.mjs')) {
  discoverTools().catch(e => {
    error('Uncaught Error:', e);
    process.exit(1);
  });
}
