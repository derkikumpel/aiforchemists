import fs from 'fs-extra';
import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary-Konfiguration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

async function captureScreenshot(tool) {
  let browser;
  try {
    console.log(`🌐 Öffne Browser für ${tool.name}: ${tool.url}`);
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });

    const response = await page.goto(tool.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Seite nicht erreichbar (Status: ${response?.status() || 'n/a'})`);
    }

    await page.waitForTimeout(3000); // etwas warten für visuelle Stabilität
    const screenshotBuffer = await page.screenshot({ fullPage: false });

    const base64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

    console.log(`📤 Lade Screenshot zu Cloudinary hoch...`);
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'chem-ai-tools',
      public_id: tool.slug,
      overwrite: true,
    });

    return result.secure_url;
  } catch (error) {
    console.error(`⚠️ Screenshot fehlgeschlagen für ${tool.name}: ${error.message || error}`);
    return 'assets/placeholder.png';
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  try {
    const tools = await fs.readJson('./data/tools.json');
    console.log(`📸 Starte Screenshots für ${tools.length} Tools.`);

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      console.log(`\n[${i + 1}/${tools.length}] Screenshot für ${tool.name} erstellen...`);
      const imageUrl = await captureScreenshot(tool);
      tools[i].screenshot = imageUrl;
      console.log(`✅ Screenshot gespeichert: ${imageUrl}`);
    }

    await fs.writeJson('./data/tools.json', tools, { spaces: 2 });
    console.log('\n✅ Alle Screenshots erfolgreich aktualisiert und gespeichert.');
  } catch (error) {
    console.error('❌ Fehler im Hauptprozess:', error.message || error);
  }
}

main();
