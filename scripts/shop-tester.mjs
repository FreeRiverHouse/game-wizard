import { setTimeout } from 'node:timers/promises';

const BASE_URL = process.env.SHOP_URL || 'http://localhost:3000';

const testScenarios = [
  'Ciao Emilio, cosa vendi qui?',
  'Voglio un gioco platform 2D con un gatto astronauta',
  'Il protagonista raccoglie stelle e schiva meteoriti',
  'Aggiungi un boss finale gigante',
  'Perfetto, crea il gioco!'
];

let passCount = 0;
let failCount = 0;

async function sendRequest(url, options) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.log('\x1b[31m❌ SERVER DOWN: ' + error.message + '\x1b[0m');
    process.exit(1);
  }
}

async function runTests() {
  console.log('Starting Emilio shopkeeper API tests...\n');

  // Reset conversation
  await sendRequest(`${BASE_URL}/api/shop/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '__reset__' })
  });

  for (const message of testScenarios) {
    const response = await sendRequest(`${BASE_URL}/api/shop/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const { reply, emotion, action, gameDescription } = response;

    if (typeof reply === 'string' && typeof emotion === 'string') {
      console.log(`\x1b[32m✅ [${emotion}] ${reply}\x1b[0m`);
      passCount++;
    } else {
      console.log('\x1b[31m❌ FAIL: missing reply/emotion\x1b[0m');
      failCount++;
    }

    if (action === 'create_game') {
      console.log(`\x1b[32m🎮 CREATE_GAME triggered! desc: ${gameDescription}\x1b[0m`);
    }

    await setTimeout(500);
  }

  console.log('\n--- Test Summary ---');
  console.log(`\x1b[32mPassed: ${passCount}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failCount}\x1b[0m`);
}

runTests();

