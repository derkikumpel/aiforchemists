import fs from 'fs-extra';
import { Client } from '@gradio/client';

const HF_SPACE_URL = 'derkikumpel/aiforchemists';
const cacheFile = './data/discover-cache.json';
const toolsFile = './data/tools.json';

function log(...args) { console.log(new Date().toISOString(), ...args); }
function error(...args) { console.error(new Date().toISOString(), ...args); }

async function loadArr(file) {
  try {
    const j = JSON.parse(await fs.readFile(file));
    if (!Array.isArray(j)) throw new Error('Invalid array');
    return j;
  } catch {
    log('⚠️ Reset', file);
    return [];
  }
}

async function callHF(prompt) {
  log('🔄 Connecting to Gradio client...');
  const opts = {};
  if (process.env.HF_TOKEN_AICHEMIST) opts.hf_token = process.env.HF_TOKEN_AICHEMIST;

  const client = await Client.connect(HF_SPACE_URL, opts);
  log('✅ Connected');

  const dep = client.config.dependencies.find(d => d.api_name === 'predict');
  if (!dep) throw new Error("No 'predict' function found");
  log('🔁 Will use fn_index =', dep.id);

  log('🔄 Sending prompt...');
  const result = await client.predict(dep.id, [prompt]);
  log('▶️ Raw result:', result);

  if (!result || !('data' in result)) throw new Error('Result missing .data');
  if (result.data == null) throw new Error('Result data is null');

  log('✅ Got response (length:', result.data.length, ')');
  return result.data;
}
