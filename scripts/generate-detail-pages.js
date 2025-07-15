import fs from 'fs-extra';
import path from 'path';
import handlebars from 'handlebars';

const toolsFile = './data/tools.json';
const templateFile = './templates/tool-template.html';
const outputDir = './tools';

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}

function warn(...args) {
  process.stderr.write(new Date().toISOString() + ' WARN: ' + args.map(String).join(' ') + '\n');
}

function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function generateDetailPages() {
  log('🚀 Starte Generierung der Detailseiten...');

  let tools;
  try {
    tools = await fs.readJson(toolsFile);
    if (!Array.isArray(tools)) throw new Error('tools.json ist kein Array');
    log(`📦 ${tools.length} Tools geladen.`);
  } catch (err) {
    error(`❌ Fehler beim Lesen von ${toolsFile}:`, err.message);
    process.exit(1);
  }

  let rawTemplate;
  try {
    rawTemplate = await fs.readFile(templateFile, 'utf8');
    log(`🧩 Template geladen: ${templateFile}`);
  } catch (err) {
    error(`❌ Fehler beim Laden des Templates:`, err.message);
    process.exit(1);
  }

  const template = handlebars.compile(rawTemplate);

  try {
    await fs.ensureDir(outputDir);
  } catch (err) {
    error(`❌ Fehler beim Erstellen des Output-Ordners "${outputDir}":`, err.message);
    process.exit(1);
  }

  // Filter nur Tools mit validem Screenshot
  const toolsWithScreenshots = tools.filter(tool => tool.hasScreenshot === true);

  if (toolsWithScreenshots.length === 0) {
    warn('⚠️ Keine Tools mit gültigen Screenshots gefunden. Keine Seiten generiert.');
    return;
  }

  let successCount = 0;

  for (const tool of toolsWithScreenshots) {
    if (!tool.slug) {
      warn(`⚠️ Übersprungen: Tool ohne "slug": ${tool.name || 'Unbenanntes Tool'}`);
      continue;
    }

    try {
      const html = template({
        name: tool.name,
        url: tool.url,
        image: tool.screenshot,
        long_description: tool.long_description,
        tags: tool.tags || [],
      });

      const filePath = path.join(outputDir, `${tool.slug}.html`);
      await fs.writeFile(filePath, html, 'utf8');
      log(`✅ Generiert: ${filePath}`);
      successCount++;
    } catch (err) {
      warn(`⚠️ Fehler beim Generieren von ${tool.slug}:`, err.message);
    }
  }

  log(`🎉 Fertig: ${successCount} Seiten erfolgreich generiert.`);
}

generateDetailPages().catch(err => {
  error('❌ Unerwarteter Fehler bei der Seitengenerierung:', err);
  process.exit(1);
});
