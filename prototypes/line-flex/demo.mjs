import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createStore } from './store.mjs';
import { createWebhookServer } from './server.mjs';

const owner = 'synthetic-demo-owner';
const secret = 'synthetic-demo-secret-not-a-real-credential';
const replies = [];
const store = createStore({ owner });
const server = createWebhookServer({ store, ownerUserId: owner, channelSecret: secret, channelAccessToken: 'synthetic-demo-token', fetchImpl: async (url, options) => { replies.push(JSON.parse(options.body)); return { ok: true }; } });
const findAction = (value, label) => {
  if (value && typeof value === 'object') {
    if (value.type === 'postback' && value.label === label) return value.data;
    for (const child of Object.values(value)) { const found = findAction(child, label); if (found) return found; }
  }
};
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let serial = 0;
  const deliver = async actionId => {
    const event = { webhookEventId: `synthetic-demo-event-${++serial}`, replyToken: `synthetic-demo-reply-${serial}`, source: { type: 'user', userId: owner }, ...(actionId ? { type: 'postback', postback: { data: actionId } } : { type: 'message', message: { type: 'text', text: '卡片測試' } }) };
    const body = JSON.stringify({ events: [event] });
    const signature = createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('base64');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': signature }, body });
    if (response.status !== 200) throw new Error('Offline webhook failed');
    return replies.at(-1).messages;
  };
  let messages = await deliver();
  console.log('本機驗簽與假 LINE 傳輸，不代表官方格式驗證或真 LINE 已通過。');
  console.log('可複製的初始 FlexMessage JSON：');
  console.log(JSON.stringify(messages, null, 2));
  console.log('待處理 3 件');
  for (let remaining = 2; remaining >= 0; remaining--) {
    messages = await deliver(findAction(messages, '確認模擬歸檔'));
    const actual = store.snapshot().tasks.filter(task => task.status === 'pending').length;
    if (actual !== remaining) throw new Error('Unexpected pending count');
    console.log(`待處理 ${actual} 件`);
  }
  console.log('已完成三筆模擬歸檔，沒有連線 LINE、Gmail 或 Drive。');
} finally { await new Promise(resolve => server.close(resolve)); store.close(); }
