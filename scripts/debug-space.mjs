import { Client } from '@gradio/client';

const HF_SPACE_URL = 'derkikumpel/aiforchemists';

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function fmt(obj) {
  return JSON.stringify(obj, null, 2);
}

async function debugGradioSpace() {
  const connectOptions = {};
  if (process.env.HF_TOKEN_AICHEMIST) {
    connectOptions.hf_token = process.env.HF_TOKEN_AICHEMIST;
  }

  log(`🔍 Connecting to ${HF_SPACE_URL}...`);
  const client = await Client.connect(HF_SPACE_URL, connectOptions);
  log(`✅ Connected`);

  const config = client.config;

  console.log('\n=== 🔧 Space Configuration ===');
  console.log(fmt(config));

  for (const fn of config.dependencies) {
    const fnIndex = fn.fn_index;
    const inputs = fn.inputs?.map(i => ({
      label: i.label,
      type: i.type,
      component: i.component,
    }));

    console.log(`\n🔎 Function fn_index = ${fnIndex}`);
    console.log(`➡️  Expected Inputs:`);
    inputs.forEach((input, idx) => {
      console.log(`  [${idx}] ${input.label || '(no label)'} - ${input.type} (${input.component})`);
    });

    console.log(`💡 Predict call should look like:`);
    const example = inputs.map((_, idx) => `input${idx + 1}`);
    console.log(`  await client.predict("/predict", [${example.join(', ')}], { fn_index: ${fnIndex} });`);
  }

  console.log('\n✅ Done.');
}

debugGradioSpace().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
