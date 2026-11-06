import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createStore } from './store.mjs';
import { createWebhookServer } from './server.mjs';

const owner = 'synthetic-test-owner';
const secret = 'synthetic-test-secret';
const fixedNow = Date.parse('2026-11-06T01:20:00.000Z');
function actions(value, label) {
  const found = [];
  function walk(item) {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'postback' && (!label || item.label === label)) found.push(item.data);
    for (const child of Object.values(item)) walk(child);
  }
  walk(value);
  return found;
}
const firstAction = (messages, label) => {
  const found = actions(messages, label)[0];
  assert.ok(found, `Expected visible action ${label}`);
  return found;
};
const pending = store => store.snapshot().tasks.filter(task => task.status === 'pending').length;
const asText = messages => JSON.stringify(messages);

async function harness(t, { filename, failReply = false, ttl = 900_000 } = {}) {
  let clock = fixedNow;
  let serial = 0;
  const replies = [];
  const store = createStore({ filename, owner, actionTtlMs: ttl });
  const server = createWebhookServer({ store, ownerUserId: owner, channelSecret: secret, channelAccessToken: 'synthetic-access-token', now: () => clock, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.line.me/v2/bot/message/reply');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer synthetic-access-token');
    const reply = JSON.parse(options.body);
    assert.ok(reply.messages.length >= 1 && reply.messages.length <= 5);
    replies.push(reply);
    if (failReply) throw new Error('Synthetic transport failure');
    return { ok: true };
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let closed = false;
  const close = async () => { if (closed) return; closed = true; await new Promise(resolve => server.close(resolve)); store.close(); };
  t.after(close);
  const event = (actionId, overrides = {}) => ({ webhookEventId: `synthetic-event-${++serial}`, replyToken: `synthetic-reply-${serial}`, source: { type: 'user', userId: owner }, ...(actionId ? { type: 'postback', postback: { data: actionId } } : { type: 'message', message: { type: 'text', text: '卡片測試' } }), ...overrides });
  const raw = async (body, signature = createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('base64')) => fetch(`http://127.0.0.1:${server.address().port}/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-line-signature': signature }, body });
  const deliver = async input => {
    const before = replies.length;
    const response = await raw(JSON.stringify({ events: Array.isArray(input) ? input : [input] }));
    return { status: response.status, replies: replies.slice(before), messages: replies.at(-1)?.messages };
  };
  return { store, replies, event, raw, deliver, close, advance: milliseconds => { clock += milliseconds; } };
}

function temporaryDatabase(t) {
  const directory = mkdtempSync(join(tmpdir(), 'line-flex-test-'));

  return join(directory, 'state.sqlite');
}

test('原始中文 bytes 驗簽；變更 body 與錯簽都不執行', async t => {
  const h = await harness(t);
  const body = '{ "events": [' + JSON.stringify(h.event()) + '] }\n';
  const signature = createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('base64');
  assert.equal((await h.raw(body, signature)).status, 200);
  assert.equal(h.replies.length, 1);
  assert.equal((await h.raw(body.replace('卡片測試', '待處理'), signature)).status, 401);
  assert.equal((await h.raw(body, Buffer.alloc(32).toString('base64'))).status, 401);
  assert.equal(h.replies.length, 1);
  assert.equal(pending(h.store), 3);
});

test('非 owner、群組、room、缺 userId 都不回覆；缺 eventId 或 replyToken 拒絕', async t => {
  const h = await harness(t);
  for (const source of [{ type: 'user', userId: 'synthetic-other-user' }, { type: 'group', groupId: 'synthetic-group', userId: owner }, { type: 'room', roomId: 'synthetic-room', userId: owner }, { type: 'user' }, { type: 'user', userId: owner, groupId: 'synthetic-group' }]) {
    assert.equal((await h.deliver(h.event(null, { source }))).status, 200);
  }
  assert.equal((await h.deliver(h.event(null, { webhookEventId: undefined }))).status, 400);
  assert.equal((await h.deliver(h.event(null, { replyToken: undefined }))).status, 400);
  assert.equal(h.replies.length, 0);
  assert.equal(pending(h.store), 3);
});

test('每筆摘要可開啟，來源為合成信件；確認三筆使摘要 3→2→1→0', async t => {
  const h = await harness(t);
  let response = await h.deliver(h.event());
  assert.equal(actions(response.messages, '處理這筆附件').length, 3);
  const initialOpenActions = actions(response.messages, '處理這筆附件');
  for (const [index, openAction] of initialOpenActions.entries()) {
    const opened = await h.deliver(h.event(openAction));
    const source = await h.deliver(h.event(firstAction(opened.messages, '查看來源')));
    assert.match(asText(source.messages), /合成來源信件/);
    assert.match(asText(source.messages), [/侵權行為/, /返還借款/, /租賃爭議/][index]);
    response = await h.deliver(h.event(firstAction(opened.messages, '確認模擬歸檔')));
    assert.equal(pending(h.store), 2 - index);
    assert.match(asText(response.messages), new RegExp(`待處理 ${2 - index} 件`));
  }
  const history = await h.deliver(h.event(firstAction(response.messages, '查看完成紀錄')));
  assert.match(asText(history.messages), /模擬完成紀錄 3 件/);
  assert.equal(h.store.snapshot().tasks.filter(task => task.status === 'archived').length, 3);
});

test('所有實際 postback 只有隨機 opaque actionId，不含案件或附件資料', async t => {
  const h = await harness(t);
  const response = await h.deliver(h.event());
  const ids = actions(response.messages);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{32}$/);
  const another = await h.deliver(h.event());
  assert.ok(actions(another.messages).every(id => !ids.includes(id)));
});

test('改選案件先出新確認卡；原確認與原來源卡失效，再確認才歸檔', async t => {
  const h = await harness(t);
  const first = await h.deliver(h.event());
  const oldConfirm = firstAction(first.messages, '確認模擬歸檔');
  const oldSource = firstAction(first.messages, '查看來源');
  const choices = await h.deliver(h.event(firstAction(first.messages, '改選案件')));
  const changed = await h.deliver(h.event(firstAction(choices.messages, '範例客戶甲｜返還借款')));
  assert.equal(pending(h.store), 3);
  assert.match(asText(changed.messages), /範例客戶甲｜返還借款/);
  for (const stale of [oldConfirm, oldSource]) {
    assert.match(asText((await h.deliver(h.event(stale))).messages), /不是最新版本/);
  }
  const result = await h.deliver(h.event(firstAction(changed.messages, '確認模擬歸檔')));
  assert.equal(pending(h.store), 2);
  assert.equal(h.store.snapshot().tasks[0].caseId, 'case-b');
  assert.match(asText(result.messages), /歸入 民事_範例客戶甲_返還借款/);
});

test('來源失效拒絕歸檔且不輸出舊信件；恢復後重查可繼續', async t => {
  const h = await harness(t);
  const first = await h.deliver(h.event());
  const confirm = firstAction(first.messages, '確認模擬歸檔');
  const source = firstAction(first.messages, '查看來源');
  h.store.replaceSourceForSimulation('file-1', { valid: false });
  for (const action of [confirm, source]) {
    const rejected = await h.deliver(h.event(action));
    assert.match(asText(rejected.messages), /來源已失效或變更/);
    assert.doesNotMatch(asText(rejected.messages), /律師您好/);
  }
  const query = await h.deliver(h.event());
  assert.match(asText(query.messages), /來源目前已失效/);
  assert.equal(actions(query.messages, '確認模擬歸檔').length, 0);
  assert.equal(pending(h.store), 3);
  h.store.replaceSourceForSimulation('file-1', { valid: true });
  const refreshed = await h.deliver(h.event());
  await h.deliver(h.event(firstAction(refreshed.messages, '確認模擬歸檔')));
  assert.equal(pending(h.store), 2);
});

test('卡片到期不刪除待辦，重新查詢產生可用操作', async t => {
  const h = await harness(t, { ttl: 1000 });
  const first = await h.deliver(h.event());
  h.advance(1000);
  assert.match(asText((await h.deliver(h.event(firstAction(first.messages, '確認模擬歸檔')))).messages), /卡片已過期/);
  assert.equal(pending(h.store), 3);
  const refreshed = await h.deliver(h.event());
  await h.deliver(h.event(firstAction(refreshed.messages, '確認模擬歸檔')));
  assert.equal(pending(h.store), 2);
});

test('已完成附件在卡片過期後提示查詢最新狀態，歸檔結果不變', async t => {
  const h = await harness(t, { ttl: 1000 });
  const first = await h.deliver(h.event());
  const confirm = firstAction(first.messages, '確認模擬歸檔');
  await h.deliver(h.event(confirm));
  assert.equal(pending(h.store), 2);
  h.advance(1000);
  const expired = await h.deliver(h.event(confirm));
  assert.deepEqual(expired.messages, [{ type: 'text', text: '模擬測試\n這張卡片已過期，請重新輸入「待處理」查詢最新狀態。' }]);
  assert.equal(pending(h.store), 2);
  const refreshed = await h.deliver(h.event());
  assert.match(asText(refreshed.messages), /待處理 2 件/);
  const history = await h.deliver(h.event(firstAction(refreshed.messages, '查看完成紀錄')));
  assert.match(asText(history.messages), /模擬完成紀錄 1 件/);
  assert.match(asText(history.messages), /補充資料.pdf/);
});

test('相同 event 不重回覆；不同 event 重按完成確認可辨識，其他舊 action 拒絕', async t => {
  const h = await harness(t);
  const first = await h.deliver(h.event());
  const confirm = firstAction(first.messages, '確認模擬歸檔');
  const oldOpen = firstAction(first.messages, '處理這筆附件');
  const event = h.event(confirm);
  await h.deliver(event);
  assert.equal((await h.deliver(event)).replies.length, 0);
  assert.match(asText((await h.deliver(h.event(confirm))).messages), /不會重複處理/);
  assert.match(asText((await h.deliver(h.event(oldOpen))).messages), /不是最新版本/);
  assert.equal(pending(h.store), 2);
});

test('服務重開保留進度、完成 action 與 receipt，舊卡仍遵守版本', async t => {
  const filename = temporaryDatabase(t);
  const firstServer = await harness(t, { filename });
  const initial = await firstServer.deliver(firstServer.event());
  const confirm = firstAction(initial.messages, '確認模擬歸檔');
  const oldSource = firstAction(initial.messages, '查看來源');
  const completedEvent = firstServer.event(confirm, { webhookEventId: 'synthetic-persisted-confirm' });
  await firstServer.deliver(completedEvent);
  await firstServer.close();
  const restarted = await harness(t, { filename });
  t.after(() => rmSync(dirname(filename), { recursive: true, force: true }));
  assert.equal(pending(restarted.store), 2);
  assert.equal((await restarted.deliver(completedEvent)).replies.length, 0);
  assert.match(asText((await restarted.deliver(restarted.event(confirm, { webhookEventId: 'synthetic-restarted-repeat' }))).messages), /不會重複處理/);
  assert.match(asText((await restarted.deliver(restarted.event(oldSource, { webhookEventId: 'synthetic-restarted-old-source' }))).messages), /不是最新版本/);
  const current = await restarted.deliver(restarted.event(null, { webhookEventId: 'synthetic-restarted-query' }));
  assert.match(asText(current.messages), /待處理 2 件/);
});

test('回覆失敗仍保存已提交結果；重送不再使用 replyToken', async t => {
  const h = await harness(t, { failReply: true });
  const first = await h.deliver(h.event());
  const event = h.event(firstAction(first.messages, '確認模擬歸檔'));
  assert.equal((await h.deliver(event)).status, 200);
  assert.equal(pending(h.store), 2);
  assert.equal((await h.deliver(event)).replies.length, 0);
  assert.equal(pending(h.store), 2);
});

test('未知或跨 owner 的 action 不執行；缺少 id 不能冒充操作', async t => {
  const filename = temporaryDatabase(t);
  const h = await harness(t, { filename });
  t.after(() => rmSync(dirname(filename), { recursive: true, force: true }));
  const otherStore = createStore({ filename, owner: 'synthetic-other-owner' });
  let foreignAction;
  try {
    foreignAction = firstAction(otherStore.apply('synthetic-other-owner', 'synthetic-foreign-summary', { type: 'summary' }, fixedNow).messages, '確認模擬歸檔');
  } finally { otherStore.close(); }
  const foreign = await h.deliver(h.event(foreignAction));
  assert.match(asText(foreign.messages), /操作無法使用/);
  const unknown = await h.deliver(h.event('unknown_action_0000000000000000'));
  assert.match(asText(unknown.messages), /操作無法使用/);
  assert.equal((await h.deliver(h.event('confirm:file-1:case-a'))).status, 400);
  assert.equal((await h.deliver(h.event(null, { type: 'postback', postback: {} }))).status, 400);
  const state = h.store.apply('synthetic-other-owner', 'synthetic-forbidden-event', { type: 'summary' }, fixedNow);
  assert.match(asText(state.messages), /操作無法使用/);
  assert.equal(pending(h.store), 3);
});

test('交易提交前中斷會回滾，重開後同 event 仍可成功一次', t => {
  const filename = temporaryDatabase(t);
  let interrupt = false;
  const store = createStore({ filename, owner, beforeCommit: () => { if (interrupt) throw new Error('Synthetic interruption'); } });
  const initial = store.apply(owner, 'synthetic-before-interrupt', { type: 'summary' }, fixedNow);
  const confirm = firstAction(initial.messages, '確認模擬歸檔');
  interrupt = true;
  assert.throws(() => store.apply(owner, 'synthetic-interrupted-event', { type: 'action', actionId: confirm }, fixedNow), /Synthetic interruption/);
  assert.equal(pending(store), 3);
  store.close();
  const reopened = createStore({ filename, owner });
  try {
    const result = reopened.apply(owner, 'synthetic-interrupted-event', { type: 'action', actionId: confirm }, fixedNow);
    assert.equal(result.duplicate, false);
    assert.match(asText(result.messages), /模擬歸檔完成/);
    assert.equal(pending(reopened), 2);
    assert.equal(reopened.apply(owner, 'synthetic-interrupted-event', { type: 'action', actionId: confirm }, fixedNow).duplicate, true);
  } finally { reopened.close(); rmSync(dirname(filename), { recursive: true, force: true }); }
});

test('兩個獨立 SQLite 連線真正同時確認，只有一筆歸檔結果', async t => {
  const filename = temporaryDatabase(t);
  const initialStore = createStore({ filename, owner });
  const initial = initialStore.apply(owner, 'synthetic-race-summary', { type: 'summary' }, fixedNow);
  const actionId = firstAction(initial.messages, '確認模擬歸檔');
  initialStore.close();
  const gate = new SharedArrayBuffer(4);
  const source = `
    import { parentPort, workerData } from 'node:worker_threads';
    const { createStore } = await import(workerData.moduleUrl);
    const store = createStore({ filename: workerData.filename, owner: workerData.owner });
    parentPort.postMessage({ ready: true });
    Atomics.wait(new Int32Array(workerData.gate), 0, 0);
    try {
      const result = store.apply(workerData.owner, workerData.eventId, { type: 'action', actionId: workerData.actionId }, workerData.now);
      parentPort.postMessage({ result });
    } finally { store.close(); }
  `;
  const contenders = [1, 2].map(number => {
    const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`), { workerData: { filename, owner, gate, actionId, moduleUrl: new URL('./store.mjs', import.meta.url).href, eventId: `synthetic-race-${number}`, now: fixedNow } });
    t.after(() => worker.terminate());
    let readyResolve, readyReject, resultResolve, resultReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const result = new Promise((resolve, reject) => { resultResolve = resolve; resultReject = reject; });
    worker.on('message', message => { if (message.ready) readyResolve(); else resultResolve(message.result); });
    worker.on('error', error => { readyReject(error); resultReject(error); });
    return { ready, result };
  });
  await Promise.all(contenders.map(item => item.ready));
  Atomics.store(new Int32Array(gate), 0, 1);
  Atomics.notify(new Int32Array(gate), 0, 2);
  const results = await Promise.all(contenders.map(item => item.result));
  assert.equal(results.filter(result => asText(result.messages).includes('模擬歸檔完成')).length, 1);
  assert.equal(results.filter(result => asText(result.messages).includes('不會重複處理')).length, 1);
  t.after(() => rmSync(dirname(filename), { recursive: true, force: true }));
  const finalStore = createStore({ filename, owner });
  try { assert.equal(pending(finalStore), 2); assert.equal(finalStore.snapshot().tasks[0].version, 2); } finally { finalStore.close(); }
});

test('匯出的 FlexMessage 與 Simulator bubble 可解析，皆為合成預覽', () => {
  for (const name of ['summary', 'confirmation']) {
    const message = JSON.parse(readFileSync(new URL(`./exports/${name}.flex.json`, import.meta.url), 'utf8'));
    const contents = JSON.parse(readFileSync(new URL(`./exports/${name}.bubble.json`, import.meta.url), 'utf8'));
    assert.equal(message.type, 'flex');
    assert.equal(contents.type, 'bubble');
    assert.deepEqual(message.contents, contents);
    assert.match(asText(message), /合成資料/);
    assert.ok(actions(message).every(id => id.startsWith('synthetic_action_')));
  }
});
