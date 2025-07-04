import fs from 'fs-extra';
import OpenAI from 'openai';
import fetch from 'node-fetch';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openaiModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

const cacheFile = './data/description-cache.json';
const toolsFile = './data/tools.json';

if (process.stdout._handle?.setBlocking) process.stdout._handle.setBlocking(true);
if (process.stderr._handle?.setBlocking) process.stderr._handle.setBlocking(true);

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
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Beschreibungscache ist kein Objekt');
    log(`Cache geladen: ${file}`);
    return parsed;
  } catch {
    log(`⚠️ Beschreibungscache ${file} ungültig oder leer – wird neu erstellt.`);
    return {};
  }
}

async function fetchToolDescriptions(tools) {
  const cache = await loadCache(cacheFile);
  const updatedTools = [];

  for (const tool of tools) {
    if (!tool.slug || typeof tool.slug !== 'string') {
      log(`⚠️ Tool ohne gültigen Slug übersprungen: ${tool.name}`);
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

Return as JSON:
{
  "short_description": "...",
  "long_description": "..."
}
`;

    let description = null;

    for (const model of openaiModels) {
      try {
        log(`→ Generiere Beschreibung mit ${model} für ${tool.name}`);
        const completion = await openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });

        description = JSON.parse(completion.choices[0].message.content.trim());
        log(`✅ Beschreibung erhalten für ${tool.name} mit ${model}`);
        break;
      } catch (e) {
        error(`⚠️ Fehler mit ${model} für ${tool.name}: ${e.message}`);
      }
    }

    if (!description) {
      try {
        log(`→ Versuche DeepSeek Fallback für ${tool.name}`);
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
        description = JSON.parse(data.choices?.[0]?.message?.content?.trim());
        log(`✅ Beschreibung mit DeepSeek erhalten für ${tool.name}`);
      } catch (e) {
        error(`❌ DeepSeek Fehler für ${tool.name}: ${e.message}`);
      }
    }

    if (!description) {
      error(`⚠️ Beschreibung fehlt, Standardtext verwendet für ${tool.name}`);
      description = {
        short_description: tool.short_description || 'No description available.',
        long_description: tool.long_description || 'No long description available.',
      };
    }

    cache[tool.slug] = description;
    updatedTools.push({ ...tool, ...description });

    try {
      await fs.writeJson(cacheFile, cache, { spaces: 2 });
      log(`💾 Beschreibungscache aktualisiert: ${tool.slug}`);
    } catch (e) {
      error(`⚠️ Fehler beim Schreiben des Beschreibungscaches: ${e.message}`);
    }
  }

  return updatedTools;
}

async function main() {
  try {
    const tools = await fs.readJson(toolsFile);
    if (!Array.isArray(tools) || !tools.length) {
      log('⚠️ Keine Tools gefunden, breche ab.');
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
