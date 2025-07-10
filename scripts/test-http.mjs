import fetch from 'node-fetch';

const SPACE = 'derkikumpel/aiforchemists';
const PROMPT = 'Hello';
const ENDPOINTS = [
  `/run/predict`,
  `/run/predict2`,
  `/run/api/predict`,
  `/api/predict`,
  `/predict`
];

async function testEndpoints() {
  for (const ep of ENDPOINTS) {
    const url = `https://${SPACE.replace('/', '-')}.hf.space${ep}`;
    console.log('🔍 Testing', ep);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.HF_TOKEN_AICHEMIST && { Authorization: `Bearer ${process.env.HF_TOKEN_AICHEMIST}` }) },
        body: JSON.stringify({ data: [PROMPT], fn_index: 2 })
      });
      const j = await res.text();
      console.log('✅ Status', res.status);
      console.log('Response:', j.slice(0, 200), '...');
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    console.log('—'.repeat(40));
  }
}

testEndpoints().catch(e => console.error(e));
