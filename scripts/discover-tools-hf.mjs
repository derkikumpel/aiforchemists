import fs from 'fs-extra';
import fetch from 'node-fetch';

const HF_MODEL_URL = 'https://derkikumpel-aiforchemists.hf.space/api/predict';
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
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN_AICHEMIST}`, 'Content-Type': 'application/json' },
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
Please list 10 current AI tools in the field of chemistry or cheminformatics or drug discovery that are NOT in the following list:

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
