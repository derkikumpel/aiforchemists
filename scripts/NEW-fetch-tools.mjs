import fs from 'fs-extra';
import YAML from 'yaml';
import { HfInference } from '@huggingface/inference';

const HF_MODEL_NAME = 'mistralai/Mistral-7B-Instruct-v0.3';
const toolsFile = './data/tools.json';
const cacheFile = './data/description-cache.json';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}
function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function loadJSON(file, fallback) {
  try {
    const data = await fs.readJson(file);
    log(`📂 Datei geladen: ${file} (${Array.isArray(data) ? data.length : Object.keys(data).length} Einträge)`);
    return data;
  } catch {
    log(`⚠️ Datei ${file} nicht gefunden oder ungültig, verwende Fallback.`);
    return fallback;
  }
}

export async function fetchToolDescriptions() {
  const tools = await loadJSON(toolsFile, []);
  const cache = await loadJSON(cacheFile, {});
  const client = new HfInference(process.env.HF_TOKEN);
  const updated = [];

  for (const tool of tools) {
    if (!tool.slug) {
      log(`⚠️ Tool ohne slug übersprungen: ${tool.name}`);
      updated.push(tool);
      continue;
    }

    if (cache[tool.slug]) {
      log(`ℹ️ Beschreibung aus Cache für Tool: ${tool.slug} (${tool.name})`);
      updated.push({ ...tool, ...cache[tool.slug] });
      continue;
    }

    const prompt = `Write two descriptions for the AI tool "${tool.name}" used in chemistry:\n\n1. Short description (30–50 words)\n2. Long description (150–250 words)\n\nReturn JSON with:\n{\n  "short_description": "...",\n  "long_description": "..." \n}`;

    try {
      log(`🔎 Hole Beschreibung für: ${tool.name}`);

      const res = await client.chatCompletion({
        model: HF_MODEL_NAME,
        messages: [{ role: 'user', content: prompt }],
      });

      const message = res.choices?.[0]?.message?.content?.trim();
      log(`📝 Antwort erhalten (${message.length} Zeichen)`);

      const jsonStart = message.indexOf('{');
      const jsonEnd = message.lastIndexOf('}');
      let parsed;

      try {
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = message.substring(jsonStart, jsonEnd + 1);
          parsed = JSON.parse(jsonString);
          log(`✅ JSON erfolgreich geparst für: ${tool.slug}`);
        } else {
          throw new Error('Kein JSON-Objekt gefunden');
        }
      } catch (jsonErr) {
        log(`⚠️ JSON Parsing fehlgeschlagen, versuche YAML für: ${tool.slug}`);
        parsed = YAML.parse(message);
        log(`✅ YAML erfolgreich geparst für: ${tool.slug}`);
      }

      if (!parsed?.short_description || !parsed?.long_description) {
        throw new Error('Antwort enthält keine gültige Beschreibung');
      }

      cache[tool.slug] = parsed;
      updated.push({ ...tool, ...parsed });

      await fs.writeJson(cacheFile, cache, { spaces: 2 });
      log(`💾 Cache gespeichert für: ${tool.slug}`);
    } catch (e) {
      error(`⚠️ Beschreibung für ${tool.name} fehlgeschlagen: ${e.message}`);
      updated.push({
        ...tool,
        short_description: tool.short_description || 'No description available.',
        long_description: tool.long_description || 'No long description available.',
      });
    }
  }

  await fs.writeJson(toolsFile, updated, { spaces: 2 });
  log(`✅ ${updated.length} Toolbeschreibungen aktualisiert.`);
}

if (import.meta.url === process.argv[1]) {
  fetchToolDescriptions().catch((e) => {
    error(`❌ Fehler: ${e.message}`);
    process.exit(1);
  });
}
