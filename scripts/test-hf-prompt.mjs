import fs from 'fs-extra';
import fetch from 'node-fetch';

const HF_API_URL = 'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-alpha';
const rawOutputFile = './data/gpt-output.txt';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}
function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function checkModelAvailability() {
  log('🔍 Überprüfe Modellverfügbarkeit...');

  try {
    const res = await fetch(HF_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP Fehler ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const tag = data?.pipeline_tag || 'unbekannt';
    log(`✅ Modell verfügbar: ${data?.modelId || '(kein Name)'} (${tag})`);

    if (tag !== 'text-generation') {
      error(`⚠️ Achtung: Modell unterstützt keine text-generation (pipeline_tag = ${tag})`);
    }
  } catch (e) {
    error(`❌ Modell-Check fehlgeschlagen: ${e.message}`);
    process.exit(1);
  }
}

async function main() {
  const prompt = process.env.HF_PROMPT;
  if (!prompt) {
    error('⚠️ Kein Prompt gefunden in HF_PROMPT');
    process.exit(1);
  }

  await checkModelAvailability(); // <-- Neu eingebaut

  log('🚀 Starte Anfrage an Hugging Face Inference API...');
  log('📥 Prompt:');
  log(prompt);

  try {
    const res = await fetch(HF_API_URL, {
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

    if (!res.ok) {
      throw new Error(`HTTP Fehler ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    await fs.writeFile(rawOutputFile, JSON.stringify(data, null, 2));
    log(`📝 Roh-Antwort gespeichert in ${rawOutputFile}`);

    const rawText = (data?.[0]?.generated_text || data?.generated_text || '').trim();

    if (!rawText) {
      throw new Error('Keine generierte Textantwort von der API erhalten');
    }

    log('📄 Generierter Text (erste 500 Zeichen):');
    log(rawText.substring(0, 500));

    const jsonStart = rawText.indexOf('[');
    const jsonEnd = rawText.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Kein JSON-Array im generierten Text gefunden');
    }

    const jsonString = rawText.substring(jsonStart, jsonEnd + 1);
    let tools;
    try {
      tools = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Fehler beim Parsen des JSON-Arrays: ' + e.message);
    }

    log(`✅ JSON-Array mit ${tools.length} Tools erfolgreich geparst.`);

  } catch (e) {
    error(`❌ Fehler: ${e.message}`);
    process.exit(1);
  }
}

main();
