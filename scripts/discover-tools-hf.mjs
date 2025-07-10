// .github/scripts/generate_tools.mjs
import { promises as fs } from 'fs';
import { get } from 'https';

// Konfiguration
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1';
const HF_TOKEN = process.env.HF_TOKEN_AICHEMIST; // Als GitHub Secret setzen
const OUTPUT_FILE = 'data/tools.json';

// Prompt-Generator
function buildPrompt(exclusions = '') {
  return `
  List 10 current AI tools in chemistry/cheminformatics/drug discovery NOT in: ${exclusions}.
  Return STRICT JSON array with:
  - name
  - slug (lowercase, dash-separated)
  - url
  - short_description (30-50 words)
  - long_description (EXACTLY 150+ words, required!)
  - tags (max 6)
  - category
  Respond ONLY with the JSON array, no Markdown or commentary.`;
}

// API-Abfrage
async function queryHFAPI(prompt) {
  const data = JSON.stringify({ inputs: prompt });

  return new Promise((resolve, reject) => {
    const req = get(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => response += chunk);
      res.on('end', () => resolve(JSON.parse(response)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Hauptfunktion
async function main() {
  try {
    // 1. Exclusions einlesen (falls vorhanden)
    const exclusions = await fs.readFile('docs/_data/exclusions.json', 'utf8')
      .catch(() => '[]');

    // 2. Prompt generieren
    const prompt = buildPrompt(exclusions);

    // 3. API aufrufen
    const tools = await queryHFAPI(prompt);
    
    // 4. Validieren und speichern
    if (Array.isArray(tools)) {
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(tools, null, 2));
      console.log('✅ Tools erfolgreich generiert');
    } else {
      throw new Error('API antwortete nicht mit einem JSON-Array');
    }
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    // Fallback: Leeres Array schreiben
    await fs.writeFile(OUTPUT_FILE, '[]');
    process.exit(1);
  }
}

main();
