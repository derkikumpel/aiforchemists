import fs from 'fs-extra';
import fetch from 'node-fetch';
import readline from 'readline';

const MODEL_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
const OUTPUT_FILE = './data/debug-output.txt';
const RAW_FILE = './data/debug-raw-response.txt';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}
function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function run() {
  const prompt = await ask('\n🧠 Prompt eingeben (mehrzeilig beenden mit Strg+D):\n\n');
  rl.close();

  log('📡 Sende Prompt an HF...');
  let responseText = '';
  try {
    const res = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
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

    log(`HTTP ${res.status} ${res.statusText}`);
    responseText = await res.text();

    await fs.outputFile(RAW_FILE, responseText);
    log(`📝 Rohantwort gespeichert unter ${RAW_FILE}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error('Antwort ist kein JSON. Inhalt siehe debug-raw-response.txt');
    }

    const output = data?.[0]?.generated_text || data?.generated_text || '';
    await fs.outputFile(OUTPUT_FILE, output);
    log(`✅ Antwort gespeichert unter ${OUTPUT_FILE}\n`);
    console.log('\n🧾 Antwort:\n' + output + '\n');

  } catch (e) {
    error('❌ Fehler bei der Anfrage:', e.message);
  }
}

run();
