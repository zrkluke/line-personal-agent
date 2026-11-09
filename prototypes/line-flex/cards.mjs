import { cases } from './commands.mjs';

const text = (value, extra = {}) => ({ type: 'text', text: value, wrap: true, size: 'sm', ...extra });
const button = (label, data, style = 'secondary') => ({ type: 'button', style, height: 'sm', action: { type: 'postback', label, data } });
const matter = task => cases.find(item => item.id === task.caseId);
const title = task => `${matter(task).client}｜${matter(task).matter}`;
const flex = (altText, contents) => ({ type: 'flex', altText, contents });
const bubble = contents => ({ type: 'bubble', size: 'mega', body: { type: 'box', layout: 'vertical', spacing: 'md', contents } });
const heading = value => text(value, { weight: 'bold', size: 'lg', color: '#087F46' });
const simulation = () => text('合成資料・僅模擬歸檔', { size: 'xs', color: '#666666' });

export function summaryCard(state, issue) {
  const pending = state.tasks.filter(task => task.status === 'pending');
  const done = state.tasks.length - pending.length;
  const contents = [simulation(), heading(`待處理 ${pending.length} 件`)];
  for (const task of pending) {
    contents.push({ type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: 'md', backgroundColor: '#F0F7F2', contents: [text(title(task), { weight: 'bold' }), text(task.file, { size: 'xs' }), button('處理這筆附件', issue('open', task))] });
  }
  if (!pending.length) contents.push(text('這三筆附件都已完成模擬歸檔。'));
  contents.push(text(`已完成 ${done} 件`, { size: 'xs', color: '#666666' }));
  if (done) contents.push(button('查看完成紀錄', issue('history')));
  return flex(`模擬歸檔・待處理 ${pending.length} 件`, bubble(contents));
}

export function confirmationCard(task, issue) {
  const contents = [simulation(), heading('歸檔確認'), text(title(task), { weight: 'bold' }), text(task.file), text(`範例時間 ${task.time}・${task.pages}`, { size: 'xs' })];
  if (!task.sourceValid) {
    contents.push(text('來源目前已失效，待辦仍保留，暫時不能歸檔。'));
  } else {
    contents.push(text(task.reason, { size: 'xs', color: '#666666' }), button('確認模擬歸檔', issue('confirm', task), 'primary'), button('改選案件', issue('change', task)), button('查看來源', issue('source', task)));
  }
  return flex(`模擬歸檔確認・${title(task)}`, bubble(contents));
}

export function messagesFor(state, result, issue) {
  const summary = () => {
    const first = state.tasks.find(task => task.status === 'pending');
    return [summaryCard(state, issue), ...(first ? [confirmationCard(first, issue)] : [])];
  };
  switch (result.view) {
    case 'summary': return summary();
    case 'confirmation': return [confirmationCard(result.task, issue)];
    case 'notice': return [{ type: 'text', text: "模擬測試\n" + result.text }];
    case 'choices': return [flex('模擬歸檔・改選案件', bubble([simulation(), heading('改選案件'), text(result.task.file), text('選好後會再顯示確認卡，尚未歸檔。'), ...cases.map(item => button(`${item.client}｜${item.matter}`, issue('select', result.task, item.id)))]))];
    case 'source': return [{ type: 'text', text: `合成來源信件\n寄件人：${result.task.from}\n範例時間：${result.task.time}\n主旨：${result.task.subject}\n附件：${result.task.file}（${result.task.pages}）\n\n${result.task.body}\n\n以上均為合成資料。` }];
    case 'completed': return [{ type: 'text', text: `模擬歸檔完成\n${result.task.file}\n歸入 ${matter(result.task).folder}\n沒有寫入外部服務。` }, ...summary()];
    case 'history': {
      const done = state.tasks.filter(task => task.status === 'archived');
      return [{ type: 'text', text: `合成資料・模擬完成紀錄 ${done.length} 件\n${done.map(task => `${task.file}\n歸入 ${matter(task).folder}\n範例完成時間 ${new Date(task.archivedAt).toISOString()}`).join('\n\n')}` }];
    }
  }
}
