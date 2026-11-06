export const cases = [
  { id: 'case-a', client: '範例客戶甲', matter: '侵權行為', folder: '民事_範例客戶甲_侵權行為' },
  { id: 'case-b', client: '範例客戶甲', matter: '返還借款', folder: '民事_範例客戶甲_返還借款' },
  { id: 'case-c', client: '範例客戶乙', matter: '租賃爭議', folder: '民事_範例客戶乙_租賃爭議' },
];

export function initialState() {
  return {
    tasks: [
      { id: 'file-1', caseId: 'case-a', file: '補充資料.pdf', time: '09:20', from: '範例客戶甲', subject: '侵權行為案件補充資料', body: '律師您好，附件是侵權行為案件的補充資料，請協助確認收件。', reason: '信件主旨與已登記案由一致。', pages: '4 頁' },
      { id: 'file-2', caseId: 'case-b', file: '範例客戶甲_返還借款案件_付款紀錄與對帳明細.pdf', time: '09:45', from: '範例客戶甲', subject: '返還借款案件付款紀錄', body: '律師您好，這封提供的是返還借款案件的付款紀錄，與另一件侵權行為案件不同，請協助歸檔。', reason: '同一客戶有兩個案件，請依主旨與原文核對。', pages: '8 頁' },
      { id: 'file-3', caseId: 'case-c', file: '租賃契約補件.pdf', time: '10:10', from: '範例客戶乙', subject: '租賃爭議案件契約補件', body: '律師您好，附件為租賃爭議案件的契約補件，請協助確認。', reason: '寄件人與主旨符合已登記案件。', pages: '3 頁' },
    ].map(task => ({ ...task, status: 'pending', version: 1, sourceVersion: 1, sourceValid: true, completedActionId: null, archivedAt: null })),
  };
}

const taskVerbs = new Set(['open', 'change', 'select', 'source', 'confirm']);

export function decide(state, command, now) {
  if (command.type === 'summary') return { view: 'summary' };
  const action = command.action;
  if (!action || action.owner !== command.actor) return { view: 'notice', text: '這個操作無法使用，請重新輸入「待處理」。' };
  if (action.expiresAt <= now) return { view: 'notice', text: '這張卡片已過期，請重新輸入「待處理」查詢最新狀態。' };
  if (action.verb === 'history' && action.taskId === null) return { view: 'history' };
  if (!taskVerbs.has(action.verb)) return { view: 'notice', text: '這個操作無法使用，請重新輸入「待處理」。' };
  const task = state.tasks.find(item => item.id === action.taskId);
  if (!task) return { view: 'notice', text: '找不到這筆待辦，請重新輸入「待處理」。' };
  if (task.status === 'archived' && action.verb === 'confirm' && task.completedActionId === action.id) {
    return { view: 'notice', text: '這筆附件已完成模擬歸檔，不會重複處理。' };
  }
  if (task.status !== 'pending' || task.version !== action.taskVersion || task.caseId !== action.caseId) {
    return { view: 'notice', text: '這張卡片已不是最新版本，請重新輸入「待處理」。' };
  }
  if (!task.sourceValid || task.sourceVersion !== action.sourceVersion) {
    return { view: 'notice', text: '來源已失效或變更，目前不能歸檔。請重新輸入「待處理」查看。' };
  }
  switch (action.verb) {
    case 'open': return { view: 'confirmation', task };
    case 'change': return { view: 'choices', task };
    case 'source': return { view: 'source', task };
    case 'select': {
      if (!cases.some(item => item.id === action.targetCaseId)) return { view: 'notice', text: '找不到案件，請重新輸入「待處理」。' };
      task.caseId = action.targetCaseId;
      task.version += 1;
      task.reason = '已由你改選案件，請對照來源確認。';
      return { view: 'confirmation', task };
    }
    case 'confirm':
      task.status = 'archived';
      task.version += 1;
      task.completedActionId = action.id;
      task.archivedAt = now;
      return { view: 'completed', task };
  }
}
