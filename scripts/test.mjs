import { Client } from "@gradio/client";

const space = "derkikumpel/aiforchemists";

try {
  console.log("🔄 Connecting to", space);
  const client = await Client.connect(space);

  const prompt = "Hello world";
  console.log("📤 Sending prompt:", prompt);

  const result = await client.predict("/predict", {
    prompt
  });

  console.log("✅ Received result:");
  console.log(result.data);
} catch (err) {
  console.error("❌ Error occurred:", err);
}
