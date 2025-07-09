import fs from 'fs-extra';
import { Client } from '@gradio/client';

const HF_SPACE_URL = 'derkikumpel/aiforchemists';
const toolsFile = './data/tools.json';
const cacheFile = './data/description-cache.json';

function log(...a) { console.log(new Date().toISOString(), ...a); }
function error(...a) { console.error(new Date().toISOString(), ...a); }

async function loadDesc() {
  try {
    const j = JSON.parse(await fs.readFile(cacheFile));
    if (typeof j === 'object' && !Array.isArray(j)) return j;
    throw new Error('Invalid cache format');
  } catch {
    log('⚠️ Reset desc cache');
    return {};
  }
}

async function callHF(prompt) {
  try {
    const connectOptions = {};
    if (process.env.HF_TOKEN_AICHEMIST) {
      connectOptions.hf_token = process.env.HF_TOKEN_AICHEMIST;
    }

    const client = await Client.connect(HF_SPACE_URL, connectOptions);

    const result = await client.predict("/predict", { prompt });
    const text = result.data;

    if (!text) {
      throw new Error('No generated text in response');
    }

    return text;
  } catch (err) {
    error('❌ Gradio API Error:', err.message);
    throw err;
  }
}

async function main() {
  log('🚀 Start fetch descriptions');
  const tools = await fs.readJson(toolsFile);
  const cache = await loadDesc();
  const updated = [];

  for (const t of tools) {
    if (cache[t.slug]) {
      log('✔ Cached', t.slug);
      updated.push({ ...t, ...cache[t.slug] });
      continue;
    }

    const prompt = `Write JSON with:
"short_description":"30-50 words"
"long_description":"150-250 words"
for AI tool "${t.name}". Only return JSON.`;

    try {
      const raw = await callHF(prompt);

      const jsonText = raw.replace(/```json\n?|```\n?/g, '');
      const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
      const desc = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

      updated.push({ ...t, ...desc });
      cache[t.slug] = desc;
      log('✅ Fetched', t.slug);

    } catch (e) {
      error(`⚠️ Use fallback:`, t.slug, e.message);
      updated.push(t);
    }
  }

  await fs.writeJson(toolsFile, updated, { spaces: 2 });
  await fs.writeJson(cacheFile, cache, { spaces: 2 });
  log('✅ Done descriptions:', updated.length);
}

main().catch(e => { error(e); process.exit(1); });
