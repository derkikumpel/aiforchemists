import fs from 'fs-extra';
import fetch from 'node-fetch';

const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/your-username/your-hf-model';
const cacheFile = './data/discover-cache.json';
const toolsFile = './data/tools.json';

function log(...a) { console.log(new Date().toISOString(), ...a) }
function error(...a) { console.error(new Date().toISOString(), ...a) }

async function loadArr(file) {
  try { const j = JSON.parse(await fs.readFile(file)); if (!Array.isArray(j)) throw 1; return j }
  catch { log('⚠️ Reset', file); return [] }
}

async function callHF(prompt) {
  const res = await fetch(HF_MODEL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, parameters: { temperature: 0.7 } })
  });
  const j = await res.json();
  const text = j.generated_text || (j[0] && j[0].generated_text);
  if (!text) throw new Error('No generated_text');
  return text;
}

async function main() {
  log('Start discover');
  const cache = await loadArr(cacheFile);
  const existing = await loadArr(toolsFile);
  const exclusion = existing.map(t => `- ${t.name} (${t.slug})`).slice(0,50).join('\n');
  const prompt = `
Please list 10 current AI tools in cheminformatics or drug discovery not in:
${exclusion||'-'}
Return JSON array with name,slug,url,short_description(30–50w),long_description>=150w,tags(≤6),category.
Respond only JSON array.
`;

  let raw;
  try {
    raw = await callHF(prompt);
    const arr = JSON.parse(raw.match(/\[([\s\S]*?)\]/)[0]);
    log(`✅ Got ${arr.length}`);
    const newTools = arr.filter(t=>!existing.find(e=>e.slug===t.slug));
    const updated = existing.concat(newTools);
    await fs.writeJson(toolsFile, updated, {spaces:2});
    await fs.writeJson(cacheFile, cache.concat(newTools), {spaces:2});
    log('Saved',updated.length,'tools');
  } catch(e) {
    error('❌',e);
    await fs.writeJson(toolsFile, existing, {spaces:2});
  }
}

main().catch(e=>{ error(e); process.exit(1) });
