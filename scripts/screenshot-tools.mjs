import fs from 'fs-extra';
import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (process.stdout._handle && process.stdout._handle.setBlocking) {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle && process.stderr._handle.setBlocking) {
  process.stderr._handle.setBlocking(true);
}

function log(...args) {
  process.stdout.write(new Date().toISOString() + ' LOG: ' + args.map(String).join(' ') + '\n');
}

function error(...args) {
  process.stderr.write(new Date().toISOString() + ' ERROR: ' + args.map(String).join(' ') + '\n');
}

async function captureScreenshot(tool) {
  let browser;
  try {
    log(`🌐 Öffne Browser für ${tool.name}: ${tool.url}`);
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });

    const response = await page.goto(tool.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Seite nicht erreichbar (Status: ${response?.status() || 'n/a'})`);
    }

    await page.waitForTimeout(3000);
    const screenshotBuffer = await page.screenshot({ fullPage: false });

    const base64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

    log(`📤 Lade Screenshot zu Cloudinary hoch für ${tool.slug}...`);
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'chem-ai-tools',
      public_id: tool.slug,
      overwrite: true,
    });

    log(`✅ Screenshot hochgeladen: ${result.secure_url}`);
    return { url: result.secure_url, success: true };
  } catch (e) {
    error(`⚠️ Screenshot fehlgeschlagen für ${tool.name}: ${e.message || e}`);
    return { url: 'assets/placeholder.png', success: false };
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  try {
    const tools = await fs.readJson('./data/tools.json');
    log(`📸 Starte Screenshots für ${tools.length} Tools.`);

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      log(`\n[${i + 1}/${tools.length}] Screenshot für ${tool.name} erstellen...`);
      const { url, success } = await captureScreenshot(tool);
      tools[i].screenshot = url;
      tools[i].hasScreenshot = success;  // NEU: Status speichern
      log(`✅ Screenshot gespeichert: ${url} (Erfolg: ${success})`);
    }

    await fs.writeJson('./data/tools.json', tools, { spaces: 2 });
    log('\n✅ Alle Screenshots erfolgreich aktualisiert und gespeichert.');
  } catch (e) {
    error('❌ Fehler im Hauptprozess:', e.message || e);
    process.exit(1);
  }
}

if (import.meta.url === process.argv[1] || process.argv[1].endsWith('screenshot-tools.mjs')) {
  main();
}
