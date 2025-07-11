import fs from 'fs-extra';
import fetch from 'node-fetch';

const HF_API_URL = 'https://api-inference.huggingface.co/models/google/flan-t5-xxl';
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
  log('🚀 Starte HF GPT-basierte Tool-Suche...');

  const cache = await loadCache(cacheFile);
  const existingTools = await loadCache(toolsFile);
  const knownSlugs = new Set(existingTools.map(t => t.slug));

  const exclusionList = existingTools
    .map(t => `- ${t.name} (${t.slug})`)
    .slice(0, 100)
    .join('\n');

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

  try {
    log(`→ Anfrage an Hugging Face Inference API...`);
    const res = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.7,
        },
      }),
    });

    log(`HTTP-Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    await fs.writeFile('./data/api-raw.txt', text);

    let data;
    try {
      data = JSON.parse(text);
      await fs.writeFile('./data/api-response.json', JSON.stringify(data, null, 2));
    } catch (e) {
      throw new Error('Antwort ist kein JSON: ' + text.slice(0, 200) + '...');
    }

    if (!Array.isArray(data) && !data?.generated_text && !data?.[0]?.generated_text) {
      throw new Error(`HF-Antwort ist kein gültiges JSON:\n${JSON.stringify(data, null, 2)}`);
    }

    const raw = (data?.[0]?.generated_text || data?.generated_text || '').trim();
    await fs.writeFile(rawOutputFile, raw);
    log(`📝 GPT-Rohantwort gespeichert unter ${rawOutputFile}`);

    const jsonStart = raw.indexOf('[');
    const jsonEnd = raw.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('❌ Kein JSON erkannt');

    const rawJson = raw.substring(jsonStart, jsonEnd + 1);
    tools = JSON.parse(rawJson);
    log(`✅ Tools gefunden via Hugging Face API (${tools.length} Tools insgesamt)`);
  } catch (e) {
    error(`❌ HF-Fehler: ${e.message}`);
  }

  if (!tools) {
    error('❌ Keine neuen Tools entdeckt. Benutze nur Cache.');
    await fs.writeJson(toolsFile, existingTools, { spaces: 2 });
    return existingTools;
  }

  const newTools = tools.filter(t => !knownSlugs.has(t.slug));
  log(`📊 Neue Tools entdeckt: ${newTools.length} von ${tools.length}`);

  const updatedTools = [...existingTools, ...newTools];
  const updatedCache = [...cache, ...newTools];

  await fs.writeJson(toolsFile, updatedTools, { spaces: 2 });
  await fs.writeJson(cacheFile, updatedCache, { spaces: 2 });

  log(`💾 Tools gespeichert: ${updatedTools.length} gesamt (neu: ${newTools.length})`);
  return updatedTools;
}

if (import.meta.url === process.argv[1] || process.argv[1].endsWith('query_model.mjs')) {
  discoverTools().catch(e => {
    error('Uncaught Error:', e);
    process.exit(1);
  });
}
