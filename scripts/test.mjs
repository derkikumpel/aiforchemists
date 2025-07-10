import { Client } from "@gradio/client";

// Hole Token aus ENV
const token = process.env.HF_TOKEN_AICHEMIST;

if (!token) {
  console.error("❌ Kein HF_TOKEN_AICHEMIST gefunden!");
  process.exit(1);
}

console.log("🔐 Token gefunden, verbinde...");

try {
  const client = await Client.connect("derkikumpel/aiforchemists", {
    hf_token: token,
  });

  console.log("✅ Verbunden");

  const result = await client.predict("/predict", {
    prompt: "Hallo Welt",
  });

  console.log("📦 Ergebnis:", result.data);
} catch (err) {
  console.error("❌ Fehler beim Zugriff:", err);
}
