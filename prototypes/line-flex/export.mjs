import { mkdirSync, writeFileSync } from 'node:fs';
import { createStore } from './store.mjs';

let serial = 0;
const store = createStore({ owner: 'synthetic-preview-owner', newActionId: () => `synthetic_action_${String(++serial).padStart(16, '0')}` });
try {
  const { messages } = store.apply('synthetic-preview-owner', 'synthetic-preview-event', { type: 'summary' }, Date.parse('2026-11-06T01:20:00.000Z'));
  const directory = new URL('./exports/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  for (const [index, name] of ['summary', 'confirmation'].entries()) {
    writeFileSync(new URL(`${name}.flex.json`, directory), `${JSON.stringify(messages[index], null, 2)}\n`);
    writeFileSync(new URL(`${name}.bubble.json`, directory), `${JSON.stringify(messages[index].contents, null, 2)}\n`);
  }
  console.log('已匯出兩張 FlexMessage 與兩張 Simulator bubble，僅供合成預覽。');
} finally { store.close(); }
