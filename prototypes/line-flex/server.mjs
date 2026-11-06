import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createStore } from './store.mjs';

const replyUrl = 'https://api.line.me/v2/bot/message/reply';
const maxBodyBytes = 1024 * 1024;

function authorizedEvents(body, owner) {
  if (!body || !Array.isArray(body.events) || body.events.length > 100) throw new Error('Invalid events');
  return body.events.flatMap(event => {
    if (!event || typeof event !== 'object') throw new Error('Invalid event');
    const source = event.source;
    if (source?.type !== 'user' || source.userId !== owner || source.groupId || source.roomId) return [];
    let command;
    if (event.type === 'message' && event.message?.type === 'text') {
      if (!['卡片測試', '待處理'].includes(event.message.text?.trim())) return [];
      command = { type: 'summary' };
    } else if (event.type === 'postback') {
      if (typeof event.postback?.data !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(event.postback.data)) throw new Error('Invalid postback');
      command = { type: 'action', actionId: event.postback.data };
    } else return [];
    if (typeof event.webhookEventId !== 'string' || !event.webhookEventId || event.webhookEventId.length > 256 || typeof event.replyToken !== 'string' || !event.replyToken || event.replyToken.length > 256) throw new Error('Missing event identity');
    return [{ actor: source.userId, eventId: event.webhookEventId, replyToken: event.replyToken, command }];
  });
}

export function createWebhookServer({ store, channelSecret, channelAccessToken, ownerUserId, fetchImpl = fetch, now = Date.now }) {
  if (![channelSecret, channelAccessToken, ownerUserId].every(value => typeof value === 'string' && value.trim())) throw new Error('LINE configuration is required');
  return createServer(async (request, response) => {
    const send = status => { response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }); response.end(status === 200 ? 'OK' : 'Request rejected'); };
    if (request.method !== 'POST' || request.url !== '/webhook') return send(404);
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > maxBodyBytes) return send(413);
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      const header = request.headers['x-line-signature'];
      const expected = createHmac('sha256', channelSecret).update(raw).digest();
      const received = typeof header === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(header) ? Buffer.from(header, 'base64') : Buffer.alloc(0);
      if (received.length !== expected.length || !timingSafeEqual(expected, received)) return send(401);
      let events;
      try { events = authorizedEvents(JSON.parse(raw.toString('utf8')), ownerUserId); } catch { return send(400); }
      for (const event of events) {
        const result = store.apply(event.actor, event.eventId, event.command, now());
        if (result.duplicate) continue;
        try {
          const reply = await fetchImpl(replyUrl, { method: 'POST', headers: { authorization: `Bearer ${channelAccessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ replyToken: event.replyToken, messages: result.messages }), signal: AbortSignal.timeout(10_000) });
          if (!reply.ok) continue;
        } catch {}
      }
      send(200);
    } catch { send(500); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const local = fileURLToPath(new URL('./.local/', import.meta.url));
  const ownerUserId = process.env.LINE_OWNER_USER_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (![ownerUserId, channelSecret, channelAccessToken].every(value => value?.trim())) throw new Error('請先設定 .env 中三個 LINE 欄位。');
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必須是 1 到 65535。');
  mkdirSync(local, { recursive: true });
  const store = createStore({ filename: join(local, 'state.sqlite'), owner: ownerUserId });
  const server = createWebhookServer({ store, ownerUserId, channelSecret, channelAccessToken });
  server.listen(port, '127.0.0.1', () => console.log(`本機模擬入口 http://127.0.0.1:${port}/webhook`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { store.close(); }));
}
