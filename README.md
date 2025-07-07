# 🧪 AI Tools for Chemists

Ein automatisch gepflegtes Verzeichnis moderner AI-Tools für die Chemie – erstellt mit GPT, DeepSeek, Playwright und GitHub Actions.

🌐 **Live Website**: [https://aiforchemists.info](https://aiforchemists.info)

---

## 🔧 Features

- Automatisch generierte Startseite mit Filterfunktionen
- Tool-Daten in `data/tools.json`
- Jedes Tool hat:
  - individuelle Detailseite
  - Live-Screenshot der Website
  - Tags, Kategorien & Beschreibung
- Vollständig statische Seite, gehostet via GitHub Pages
- Automatischer Fallback bei API-Limits (OpenAI → DeepSeek)
- Automatische Ausführung per CI (GitHub Actions)

---

## ⚙️ Lokales Setup

> Voraussetzungen: **Node.js ≥ v20**

```bash
# Repository klonen und starten
npm install
npm run update-data
