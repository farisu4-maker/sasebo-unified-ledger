import React from 'react';
import { Transaction, Expense } from '../types';

interface HistoryListProps {
  transactions: Transaction[];
  expenses: Expense[];
  fiscalYear: number;
  onCancelTransaction: (id: string) => void;
  onCancelExpense: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ 
  transactions, 
  expenses, 
  fiscalYear,
  onCancelTransaction,
  onCancelExpense
}) => {
  // 指定された年度の開始・終了日付を取得（4月始まり）
  const startDate = `${fiscalYear}-04-01`;
  const endDate = `${fiscalYear + 1}-03-31`;

  // 該当年度のデータに絞り込み
  const currentTransactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);
  const currentExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);

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
  };

  const historyData: HistoryItem[] = [
    ...(currentTransactions?.map(t => ({
      id: t.id,
      type: 'transaction' as const,
      date: t.date,
      organization: t.organization,
      categoryOrItem: t.item,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      isCancelled: !!t.isCancelled
    })) || []),
    ...(currentExpenses?.map(e => ({
      id: e.id,
      type: 'expense' as const,
      date: e.date,
      organization: e.organization,
      categoryOrItem: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      isCancelled: !!e.isCancelled
    })) || [])
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2 flex justify-between items-center">
        <span>{fiscalYear}年度 入出金履歴一覧</span>
      </h2>

      {historyData.length === 0 ? (
        <p className="text-gray-500 text-center py-8">該当年度の履歴データはありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 border-x text-center">区分</th>
                <th scope="col" className="px-6 py-3 border-x">日付</th>
                <th scope="col" className="px-6 py-3 border-x">所属</th>
                <th scope="col" className="px-6 py-3 border-x">項目 / 勘定科目</th>
                <th scope="col" className="px-6 py-3 border-x text-right">金額</th>
                <th scope="col" className="px-6 py-3 border-x">支払方法</th>
                <th scope="col" className="px-6 py-3 border-x text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((item) => (
                <tr key={`${item.type}-${item.id}`} className={`border-b hover:bg-gray-50 transition-colors ${item.isCancelled ? 'bg-gray-100 opacity-60' : ''}`}>
                  <td className="px-6 py-4 border-x text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      item.type === 'transaction' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {item.type === 'transaction' ? '入金' : '支出'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 border-x font-medium ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.date}
                  </td>
                  <td className={`px-6 py-4 border-x ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                    {item.organization}
                  </td>
                  <td className={`px-6 py-4 border-x ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                    {item.categoryOrItem}
                  </td>
                  <td className={`px-6 py-4 border-x text-right font-semibold ${item.isCancelled ? 'line-through text-gray-400' : (item.type === 'transaction' ? 'text-blue-600' : 'text-red-600')}`}>
                    {item.type === 'transaction' ? '+' : '-'}{item.amount.toLocaleString()}円
                  </td>
                  <td className={`px-6 py-4 border-x text-gray-500 ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                    {item.paymentMethod}
                  </td>
                  <td className="px-6 py-4 border-x text-center">
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
