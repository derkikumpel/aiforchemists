import fs from 'fs-extra';
import { HfInference } from '@huggingface/inference';
import YAML from 'yaml';

const HF_MODEL_NAME = 'HuggingFaceTB/SmolLM3-3B'; // mistralai/Mistral-7B-Instruct-v0.3 
const rawOutputFile = './data/gpt-output.txt';
const toolsFile = './data/tools.json';
const cacheFile = './data/discover-cache.json';

function log(...args) {
  console.log(new Date().toISOString(), 'LOG:', ...args);
}

function error(...args) {
  console.error(new Date().toISOString(), 'ERROR:', ...args);
}

async function main() {
  log('🛠️  discover-tools gestartet...');
  log('📦 Modell:', HF_MODEL_NAME);
  log('📁 Tools-Datei:', toolsFile);
  log('📁 Cache-Datei:', cacheFile);

  const prompt = process.env.HF_PROMPT;
  if (!prompt) {
    throw new Error('⚠️ Kein Prompt gefunden in HF_PROMPT');
  }

  log('📨 Prompt wird an HF gesendet...');
  log(prompt);

  const client = new HfInference(process.env.HF_TOKEN);

  const response = await client.textGeneration({
    model: HF_MODEL_NAME,
    inputs: prompt,
  });

  const message = response.generated_text;
  if (!message) throw new Error('❌ Keine Antwort vom Modell erhalten');

  await fs.writeFile(rawOutputFile, message);
  log('📬 Antwort erhalten. Gespeichert in:', rawOutputFile);
  log('📄 Vorschau (erste 500 Zeichen):');
  log(message.substring(0, 500));

  let tools;
  const jsonStart = message.indexOf('[');
  const jsonEnd = message.lastIndexOf(']');

  if (jsonStart !== -1 && jsonEnd !== -1) {
    const jsonString = message.substring(jsonStart, jsonEnd + 1);
    try {
      tools = JSON.parse(jsonString);
      log(`✅ JSON erfolgreich! Anzahl Tools: ${tools.length}`);
    } catch (e) {
      log('⚠️ JSON-Parsing fehlgeschlagen, versuche YAML...');
      tools = null;
    }
  }

  if (!tools) {
    try {
      const parsed = YAML.parse(message);
      if (Array.isArray(parsed)) {
        tools = parsed;
        log(`✅ YAML erfolgreich geparst mit ${tools.length} Tools`);
      } else {
        throw new Error('YAML enthält kein Array.');
      }
    } catch (e) {
      throw new Error('Fehler beim YAML-Parsing: ' + e.message);
    }
  }

  // Bereinige Tool-Namen
  tools = tools.map(tool => ({
    ...tool,
    name: tool.name.replace(/^\d+[\.\)]?\s*/, '').trim(),
  }));

  let existing = [];
  try {
    existing = await fs.readJson(toolsFile);
  } catch {
    log('📄 tools.json nicht gefunden, wird neu erstellt.');
  }

  const newTools = tools.filter(t => !existing.find(e => e.slug === t.slug));
  if (newTools.length === 0) {
    log('ℹ️  Keine neuen Tools gefunden');
  } else {
    const updated = [...existing, ...newTools];
    await fs.writeJson(toolsFile, updated, { spaces: 2 });
    log(`💾 Neue Tools gespeichert: ${newTools.length}`);
  }
}

main().catch((e) => {
  error(`❌ Fehler: ${e.message}`);
  process.exit(1);
});
