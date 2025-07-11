import fs from 'fs-extra';
import fetch from 'node-fetch';

const toolsFile = './data/tools.json';
const resultsDir = './data/tool-pages';
const failedLog = './data/fetch-failed.log';

function log(...args) {
  console.log(new Date().toISOString(), 'LOG:', ...args);
}

function error(...args) {
  console.error(new Date().toISOString(), 'ERROR:', ...args);
}

async function fetchTool(tool) {
  const filename = `${resultsDir}/${tool.slug}.html`;
  try {
    log(`🌐 Hole ${tool.url} → ${filename}`);
    const res = await fetch(tool.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ToolFetcher/1.0)',
      },
      timeout: 10000,
    });

    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }

    const html = await res.text();
    await fs.outputFile(filename, html);
    log(`✅ Gespeichert: ${tool.slug}`);
  } catch (e) {
    error(`❌ Fehler bei ${tool.slug}: ${e.message}`);
    await fs.appendFile(failedLog, `${tool.slug} (${tool.url}) – ${e.message}\n`);
  }
}

async function main() {
  log('📦 fetch-tools gestartet...');
  log('📁 Tools-Quelle:', toolsFile);
  log('📁 Ergebnisverzeichnis:', resultsDir);

  const tools = await fs.readJson(toolsFile);
  log(`🔍 Tools geladen: ${tools.length}`);

  await fs.ensureDir(resultsDir);
  await fs.remove(failedLog); // Clear old log

  for (const tool of tools) {
    await fetchTool(tool);
  }

  log('✅ Alle Tools verarbeitet');
}

main().catch((e) => {
  error(`❌ Fehler: ${e.message}`);
  process.exit(1);
});
