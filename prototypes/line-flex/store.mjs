import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { initialState, decide } from './commands.mjs';
import { messagesFor } from './cards.mjs';

export function createStore({ filename = ':memory:', owner, actionTtlMs = 15 * 60_000, newActionId = () => randomBytes(24).toString('base64url'), beforeCommit = () => {} }) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS aggregates (owner TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, binding TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts (owner TEXT NOT NULL, event_id TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY (owner, event_id));
  `);
  const load = () => JSON.parse(db.prepare('SELECT state FROM aggregates WHERE owner = ?').get(owner).state);
  const save = state => db.prepare('UPDATE aggregates SET state = ? WHERE owner = ?').run(JSON.stringify(state), owner);
  db.prepare('INSERT OR IGNORE INTO aggregates (owner, state) VALUES (?, ?)').run(owner, JSON.stringify(initialState()));

  return {
    apply(actor, eventId, command, now = Date.now()) {
      if (actor !== owner) return { duplicate: false, messages: [{ type: 'text', text: '模擬測試：這個操作無法使用。' }] };
      if (!eventId || !['summary', 'action'].includes(command.type)) throw new TypeError('Invalid command boundary');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT 1 FROM receipts WHERE owner = ? AND event_id = ?').get(owner, eventId)) {
          db.exec('COMMIT');
          return { duplicate: true, messages: [] };
        }
        const state = load();
        const binding = command.type === 'action' ? db.prepare('SELECT binding FROM actions WHERE id = ?').get(command.actionId) : null;
        const action = binding ? JSON.parse(binding.binding) : null;
        const result = decide(state, command.type === 'summary' ? command : { type: 'action', actor, action }, now);
        const issue = (verb, task = null, targetCaseId = null) => {
          const id = newActionId();
          const issued = { id, owner, verb, taskId: task?.id ?? null, taskVersion: task?.version ?? null, sourceVersion: task?.sourceVersion ?? null, caseId: task?.caseId ?? null, targetCaseId, expiresAt: now + actionTtlMs };
          db.prepare('INSERT INTO actions (id, binding) VALUES (?, ?)').run(id, JSON.stringify(issued));
          return id;
        };
        const messages = messagesFor(state, result, issue);
        save(state);
        db.prepare('INSERT INTO receipts (owner, event_id, result) VALUES (?, ?, ?)').run(owner, eventId, JSON.stringify(messages));
        beforeCommit();
        db.exec('COMMIT');
        return { duplicate: false, messages };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    snapshot() { return load(); },
    replaceSourceForSimulation(taskId, { valid }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const state = load();
        const task = state.tasks.find(item => item.id === taskId);
        if (!task) throw new RangeError('Unknown synthetic task');
        task.sourceVersion += 1;
        task.sourceValid = valid;
        save(state);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() { db.close(); },
  };
}
