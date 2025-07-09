import { Client } from '@gradio/client';

(async () => {
  const client = await Client.connect('derkikumpel/aiforchemists', {
    hf_token: process.env.HF_TOKEN_AICHEMIST
  });
  const dep = client.config.dependencies.find(d => d.api_name === 'predict');
  console.log('fn_index:', dep.id);

  for (const inp of [["Hello world"], "Hello world", ["Hello",""]]) {
    try {
      console.log("Sende:", inp);
      const res = await client.predict(dep.id, inp);
      console.log("Antwort:", res.data);
    } catch (e) {
      console.error("Error bei input", inp, e);
    }
  }
})();
