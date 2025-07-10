import { Client } from "@gradio/client";

const client = await Client.connect("derkikumpel/aiforchemists", {
  hf_token: process.env.HF_TOKEN_AICHEMIST
});

const result = await client.predict("/generate", {
  prompt: "Was ist KI?"
});

console.log(result.data);
