import fs from 'fs-extra';
import { InferenceClient } from '@huggingface/inference';
import YAML from 'yaml';

const HF_MODEL_NAME = 'mistralai/Mistral-7B-Instruct-v0.3';
const rawOutputFile = './data/gpt-output.txt';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}

function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function main() {
  const prompt = process.env.HF_PROMPT;
  if (!prompt) {
    error('⚠️ Kein Prompt gefunden in HF_PROMPT');
    process.exit(1);
  }

  log('🚀 Starte ChatCompletion Anfrage an Hugging Face Inference API...');
  log('📥 Prompt:');
  log(prompt);

  try {
    const client = new InferenceClient(process.env.HF_TOKEN);

    const chatCompletion = await client.chatCompletion({
      model: HF_MODEL_NAME,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const message = chatCompletion.choices?.[0]?.message?.content || '';
    if (!message) {
      throw new Error('Keine Antwort vom Modell erhalten');
    }

    await fs.writeFile(rawOutputFile, message);
    log(`📝 Roh-Antwort gespeichert in ${rawOutputFile}`);

    log('📄 Generierter Text (erste 500 Zeichen):');
    log(message.substring(0, 500));

    // JSON-Array im Text suchen und parsen
const jsonStart = message.indexOf('[');
const jsonEnd = message.lastIndexOf(']');
let tools;

if (jsonStart !== -1 && jsonEnd !== -1) {
  const jsonString = message.substring(jsonStart, jsonEnd + 1);
  try {
    tools = JSON.parse(jsonString);
    log(`✅ JSON-Array mit ${tools.length} Tools erfolgreich geparst.`);
  } catch (e) {
    throw new Error('Fehler beim Parsen des JSON-Arrays: ' + e.message);
  }
} else {
  log('⚠️ Kein JSON-Array gefunden – versuche stattdessen YAML zu parsen');
  try {
    const parsed = YAML.parse(message);
    if (Array.isArray(parsed)) {
      tools = parsed;
      log(`✅ YAML erfolgreich geparst mit ${tools.length} Tools.`);
    } else {
      throw new Error('YAML enthält kein Array.');
    }
  } catch (e) {
    throw new Error('Fehler beim YAML-Parsing: ' + e.message);
  }
}

// Optional: name-Feld bereinigen
tools = tools.map((tool) => ({
  ...tool,
  name: tool.name.replace(/^\d+[\.\)]?\s*/, '').trim(),
}));

// Tools speichern
const toolsFile = './data/tools.json';
await fs.writeJson(toolsFile, tools, { spaces: 2 });
log(`💾 Tools-Daten gespeichert in ${toolsFile}`);
}

main();
