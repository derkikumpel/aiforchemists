import fs from 'fs-extra';
import fetch from 'node-fetch';

const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/derkikumpel/aiforchemists';
const toolsFile = './data/tools.json';
const cacheFile = './data/description-cache.json';

function log(...a) { console.log(new Date().toISOString(), ...a) }
function error(...a) { console.error(new Date().toISOString(), ...a) }

async function loadDesc() {
  try { const j = JSON.parse(await fs.readFile(cacheFile)); if (typeof j==='object'&& !Array.isArray(j)) return j; throw 1 }
  catch { log('⚠️ Reset desc cache'); return {} }
}

async function callHF(prompt) {
  const res = await fetch(HF_MODEL_URL, {
    method:'POST',
    headers:{ Authorization:`Bearer ${process.env.HF_TOKEN}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ inputs: prompt, parameters: { temperature:0.7 } })
  });
  const j = await res.json();
  const text = j.generated_text || (j[0] && j[0].generated_text);
  if (!text) throw new Error('No generated_text');
  return text;
}

async function main() {
  log('Start fetch descriptions');
  const tools = await fs.readJson(toolsFile);
  const cache = await loadDesc();
  const updated = [];

  for (const t of tools) {
    if (cache[t.slug]) {
      log('✔ Cached', t.slug);
      updated.push({...t,...cache[t.slug]});
      continue;
    }
    const prompt = `Write JSON with:
"short_description":"30-50 words"
"long_description":"150-250 words"
for AI tool "${t.name}". Only return JSON.`;
    try {
      const raw = await callHF(prompt);
      const desc = JSON.parse(raw);
      updated.push({...t,...desc});
      cache[t.slug] = desc;
      log('✅ Fetched', t.slug);
    } catch (e) {
      error(`⚠ Use fallback:`,t.slug,e);
      updated.push(t);
    }
  }

  await fs.writeJson(toolsFile, updated, {spaces:2});
  await fs.writeJson(cacheFile, cache, {spaces:2});
  log('Done descriptions', updated.length);
}

main().catch(e=>{error(e); process.exit(1)});
