import readline from 'readline';
import fs from 'fs-extra';
import fetch from 'node-fetch';

const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
const outputFile = './data/debug-raw-response.txt';

function log(...args) {
  console.log(new Date().toISOString(), 'LOG:', ...args);
}
function error(...args) {
  console.error(new Date().toISOString(), 'ERROR:', ...args);
}

function readPromptFromStdin() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lines = [];
    log('🧠 Prompt eingeben (mehrzeilig beenden mit Strg+D):');

    rl.on('line', (line) => lines.push(line));
    rl.on('close', () => resolve(lines.join('\n')));
  });
}

async function main() {
  try {
    const prompt = await readPromptFromStdin();

    if (!prompt.trim()) {
      error('⚠️ Kein Prompt eingegeben.');
      process.exit(1);
    }

    log('→ Sende Anfrage an HF...');
    const res = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      error(`❌ HF-Fehler: ${res.status} ${res.statusText}\n${text}`);
      process.exit(1);
    }

    const data = await res.json();
    const output =
      data?.[0]?.generated_text || data?.generated_text || JSON.stringify(data, null, 2);

    await fs.outputFile(outputFile, output);
    log(`✅ Antwort gespeichert in: ${outputFile}`);
  } catch (e) {
    error('❌ Unbekannter Fehler:', e);
    process.exit(1);
  }
}

main();
