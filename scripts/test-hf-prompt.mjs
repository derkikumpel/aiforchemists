import fs from 'fs-extra';
import { InferenceClient } from '@huggingface/inference';

const HF_MODEL_NAME = 'mistralai/Mistral-7B-Instruct-v0.3';
const rawOutputFile = './data/gpt-output.txt';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}
function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function checkModelAvailability(client, modelName) {
  log('🔍 Überprüfe Modellverfügbarkeit...');
  try {
    // Nutze die offizielle Models API ohne Auth, HF API liefert hier genug Infos
    const res = await fetch(`https://huggingface.co/api/models/${modelName}`, {
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Modell-Check fehlgeschlagen: HTTP Fehler ${res.status} ${res.statusText}`);
    }

    const info = await res.json();
    const tag = info?.pipeline_tag || 'unbekannt';
    log(`✅ Modell "${modelName}" gefunden. Pipeline: ${tag}, SHA: ${info?.sha || 'unbekannt'}`);

    if (tag !== 'text-generation' && tag !== 'text2text-generation' && tag !== 'text-to-text') {
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

  const client = new InferenceClient(process.env.HF_TOKEN);

  await checkModelAvailability(client, HF_MODEL_NAME);

  log('🚀 Starte Anfrage an Hugging Face Inference API...');
  log('📥 Prompt:');
  log(prompt);

  try {
    // Nutze chatCompletion, falls das Modell das unterstützt, sonst textGeneration
    // Hier probieren wir textGeneration (für Flan-T5, Zephyr etc.)
    const data = await client.textGeneration({
      model: HF_MODEL_NAME,
      inputs: prompt,
      parameters: {
        max_new_tokens: 1024,
        temperature: 0.7,
      },
    });

    await fs.writeFile(rawOutputFile, JSON.stringify(data, null, 2));
    log(`📝 Roh-Antwort gespeichert in ${rawOutputFile}`);

    // data ist ein Array mit Texten, je nach API Response
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
