import fs from 'fs-extra';
import { Client } from '@gradio/client';
import path from 'path';

const HF_SPACE_URL = 'derkikumpel/aiforchemists';
const toolsFile = './data/tools.json';
const cacheFile = './data/description-cache.json';
const screenshotDir = './tools'; // hier liegt z. B. slug.html oder slug.png

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

function hasScreenshot(slug) {
  const htmlPath = path.join(screenshotDir, `${slug}.html`);
  const pngPath = path.join('./screenshots', `${slug}.png`);
  return fs.existsSync(htmlPath) || fs.existsSync(pngPath);
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

      const fullTool = { ...t, ...desc };

      if (!hasScreenshot(t.slug)) {
        log(`🚫 Skipped (no screenshot): ${t.slug}`);
        continue;
      }

      updated.push(fullTool);
      cache[t.slug] = desc;
      log('✅ Fetched + Screenshot OK:', t.slug);

    } catch (e) {
      error(`⚠️ Skipped (error):`, t.slug, e.message);
      // Tool wird nicht übernommen
    }
  }

  await fs.writeJson(toolsFile, updated, { spaces: 2 });
  await fs.writeJson(cacheFile, cache, { spaces: 2 });
  log('✅ Final valid tools:', updated.length);
}

main().catch(e => { error(e); process.exit(1); });
