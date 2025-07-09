import fs from 'fs-extra';
import { Client } from '@gradio/client';

const HF_SPACE_URL = 'derkikumpel/aiforchemists';
const cacheFile = './data/discover-cache.json';
const toolsFile = './data/tools.json';

function log(...args) { console.log(new Date().toISOString(), ...args); }
function error(...args) { console.error(new Date().toISOString(), ...args); }

async function loadArr(file) {
  try {
    const json = JSON.parse(await fs.readFile(file));
    if (!Array.isArray(json)) throw new Error('File does not contain an array');
    return json;
  } catch {
    log('⚠️ Reset', file);
    return [];
  }
}

async function callHF(prompt) {
  log('🔄 Connecting to Gradio client...');
  const connectOptions = {};
  if (process.env.HF_TOKEN_AICHEMIST) {
    connectOptions.hf_token = process.env.HF_TOKEN_AICHEMIST;
  }

  const client = await Client.connect(HF_SPACE_URL, connectOptions);
  log('✅ Connected to HF Space');

  const dep = client.config.dependencies.find(d => d.api_name === 'predict');
  if (!dep) throw new Error("🔍 No 'predict' function found in Space");

  log(`🔄 Calling predict with fn_index = ${dep.id}`);
  const result = await client.predict(dep.id, [prompt]);

  if (!result?.data) throw new Error('❌ No data in response');

  log('✅ Received response text (length:', result.data.length, ')');
  return result.data;
}

async function main() {
  log('🚀 Start discover');

  const cache = await loadArr(cacheFile);
  const existing = await loadArr(toolsFile);

  const exclusion = existing.map(t => `- ${t.name} (${t.slug})`).slice(0, 50).join('\n');
  const prompt = `Please list 10 current AI tools in the field of chemistry or cheminformatics or drug discovery that are NOT in the following list:
${exclusion || '- (none listed)'}

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

Respond only with the JSON array:`;

  try {
    const raw = await callHF(prompt);

    const cleaned = raw.replace(/```json\n?|```\n?/g, '');
    const match = cleaned.match(/\[([\s\S]*?)\]/);
    if (!match) throw new Error('📐 No JSON array found in response');

    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) throw new Error('📐 Parsed result is not an array');

    log(`✅ Got ${arr.length} tools`);

    const valid = arr.filter(t =>
      t.name && t.slug && t.url &&
      t.short_description && t.long_description && t.long_description.length >= 150 &&
      Array.isArray(t.tags) && t.tags.length <= 6 &&
      t.category
    );
    log(`✅ ${valid.length} valid tools out of ${arr.length}`);

    const newTools = valid.filter(t => !existing.some(e => e.slug === t.slug));
    log(`📝 ${newTools.length} new tools (${valid.length - newTools.length} duplicates removed)`);

    const updated = existing.concat(newTools);
    await fs.writeJson(toolsFile, updated, { spaces: 2 });
    await fs.writeJson(cacheFile, cache.concat(newTools), { spaces: 2 });

    log('💾 Saved', updated.length, 'total tools');

    newTools.forEach((t, i) => log(`${i + 1}. ${t.name} (${t.category})`));
  } catch (e) {
    error('❌ Main error:', e.message);
    await fs.writeJson(toolsFile, await loadArr(toolsFile), { spaces: 2 });

    if (process.env.CI) {
      log('🔄 CI detected, skipping error');
    } else {
      throw e;
    }
  }
}

main().catch(e => {
  error('💥 Fatal error:', e);
  process.exit(1);
});
