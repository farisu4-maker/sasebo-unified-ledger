import React, { useState } from 'react';
import { Transaction, Expense, Member } from '../types';

interface HistoryListProps {
  transactions: Transaction[];
  expenses: Expense[];
  fiscalYear: number;
  members: Member[];
  onCancelTransaction: (id: string) => void;
  onCancelExpense: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  transactions,
  expenses,
  fiscalYear,
  members,
  onCancelTransaction,
  onCancelExpense
}) => {
  // ── 年度フィルター（内部 state で管理） ─────────────────
  const currentFY = fiscalYear;
  const [viewYear, setViewYear] = useState<number>(currentFY);

  // 選択肢: 2020 〜 現在年度+1
  const yearOptions: number[] = [];
  for (let y = 2020; y <= currentFY + 1; y++) yearOptions.push(y);

  const startDate = `${viewYear}-04-01`;
  const endDate   = `${viewYear + 1}-03-31`;

  // 該当年度のデータに絞り込み
  const currentTransactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);
  const currentExpenses     = expenses.filter(e => e.date >= startDate && e.date <= endDate);

  // 氏名解決ヘルパー
  const memberName = (memberId: string) =>
    members.find(m => m.id === memberId)?.name ?? memberId;

  // 統合された履歴データを作成して降順でソート
  type HistoryItem = {
    id: string;
    type: 'transaction' | 'expense';
    date: string;
    organization: string;
    categoryOrItem: string;
    amount: number;
    paymentMethod: string;
    isCancelled: boolean;
    memberId?: string;
  };

  const historyData: HistoryItem[] = [
    ...(currentTransactions.map(t => ({
      id: t.id,
      type: 'transaction' as const,
      date: t.date,
      organization: t.organization,
      categoryOrItem: t.item,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      isCancelled: !!t.isCancelled,
      memberId: t.memberId,
    }))),
    ...(currentExpenses.map(e => ({
      id: e.id,
      type: 'expense' as const,
      date: e.date,
      organization: e.organization,
      categoryOrItem: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      isCancelled: !!e.isCancelled,
    })))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {/* ── ヘッダー + 年度セレクター ──────────────────── */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-3 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">入出金履歴一覧</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="viewYear" className="text-sm font-medium text-gray-600">表示年度:</label>
          <select
            id="viewYear"
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}年度（{y}/4〜{y+1}/3）</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">現在の管理年度: {currentFY}年度</span>
        </div>
      </div>

      {historyData.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{viewYear}年度の履歴データはありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 border-x text-center">区分</th>
                <th scope="col" className="px-4 py-3 border-x">日付</th>
                <th scope="col" className="px-4 py-3 border-x">所属</th>
                <th scope="col" className="px-4 py-3 border-x">納入者 / 摘要</th>
                <th scope="col" className="px-4 py-3 border-x">項目 / 勘定科目</th>
                <th scope="col" className="px-4 py-3 border-x text-right">金額</th>
                <th scope="col" className="px-4 py-3 border-x">支払方法</th>
                <th scope="col" className="px-4 py-3 border-x text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((item) => (
                <tr
                  key={`${item.type}-${item.id}`}
                  className={`border-b hover:bg-gray-50 transition-colors ${item.isCancelled ? 'bg-gray-100 opacity-60' : ''}`}
                >
                  {/* 区分バッジ */}
                  <td className="px-4 py-3 border-x text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      item.type === 'transaction' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.type === 'transaction' ? '入金' : '支出'}
                    </span>
                  </td>

                  {/* 日付 */}
                  <td className={`px-4 py-3 border-x font-medium ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.date}
                  </td>

                  {/* 所属 */}
                  <td className={`px-4 py-3 border-x ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                      item.organization === '道院' ? 'bg-blue-100 text-blue-800' :
                      item.organization === 'スポ少' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.organization}
                    </span>
                  </td>

                  {/* 納入者 / 摘要 */}
                  <td className={`px-4 py-3 border-x ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
                    {item.type === 'transaction' && item.memberId
                      ? memberName(item.memberId)
                      : <span className="text-gray-300">―</span>}
                  </td>

                  {/* 項目 */}
                  <td className={`px-4 py-3 border-x ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                    {item.categoryOrItem}
                  </td>

                  {/* 金額 */}
                  <td className={`px-4 py-3 border-x text-right font-semibold ${
                    item.isCancelled ? 'line-through text-gray-400' :
                    item.type === 'transaction' ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {item.type === 'transaction' ? '+' : '-'}{item.amount.toLocaleString()}円
                  </td>

                  {/* 支払方法 */}
                  <td className={`px-4 py-3 border-x text-gray-500 ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                    {item.paymentMethod}
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3 border-x text-center">
                    {item.isCancelled ? (
                      <span className="text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-2 py-1 rounded">取消済</span>
                    ) : (
                      <button
                        onClick={() => {
                          if (window.confirm('この履歴を取消（論理削除）しますか？金額の集計から除外されます。')) {
                            if (item.type === 'transaction') {
                              onCancelTransaction(item.id);
                            } else {
                              onCancelExpense(item.id);
                            }
                          }
                        }}
                        className="text-xs bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 font-medium py-1 px-3 rounded shadow-sm transition-colors"
                      >
                        取消
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
