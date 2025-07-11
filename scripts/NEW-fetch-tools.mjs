import fs from 'fs-extra';
import { InferenceClient } from '@huggingface/inference';

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
    return await fs.readJson(file);
  } catch {
    return fallback;
  }
}

export async function fetchToolDescriptions() {
  const tools = await loadJSON(toolsFile, []);
  const cache = await loadJSON(cacheFile, {});
  const client = new InferenceClient(process.env.HF_TOKEN);

  const updated = [];

  for (const tool of tools) {
    if (!tool.slug || cache[tool.slug]) {
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
      const parsed = JSON.parse(message);

      cache[tool.slug] = parsed;
      updated.push({ ...tool, ...parsed });

      await fs.writeJson(cacheFile, cache, { spaces: 2 });
    } catch (e) {
      error(`⚠️ ${tool.name} fehlgeschlagen: ${e.message}`);
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
  fetchToolDescriptions();
}
