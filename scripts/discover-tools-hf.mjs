import { promises as fs } from 'fs';
import https from 'https';

const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1';
const OUTPUT_FILE = 'data/tools.json';

function buildPrompt(exclusions = []) {
  return `List 10 current AI tools in chemistry NOT in: ${JSON.stringify(exclusions)}.
  Return JSON array with: name, slug, url, short_description (30-50 words),
  long_description (≥150 words), tags (max 6), category.
  Respond ONLY with valid JSON array:`;
}

async function queryHFAPI(prompt) {
  const data = JSON.stringify({ inputs: prompt });

  return new Promise((resolve, reject) => {
    const req = https.request(
      HF_API_URL,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN_AICHEMIST}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      },
      (res) => {
        let response = '';
        res.on('data', (chunk) => response += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(response));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(data); // Wichtig: Daten VOR req.end() schreiben
    req.end();
  });
}

async function main() {
  try {
    const exclusions = await fs.readFile('data/exclusions.json', 'utf8')
      .then(JSON.parse)
      .catch(() => []);

    const response = await queryHFAPI(buildPrompt(exclusions));
    
    if (!Array.isArray(response)) {
      throw new Error('API returned non-array response');
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(response, null, 2));
    console.log('✅ Tools saved to', OUTPUT_FILE);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await fs.writeFile(OUTPUT_FILE, '[]');
    process.exit(1);
  }
}

main();
