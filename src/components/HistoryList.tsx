import React, { useState, useRef } from 'react';
import { Transaction, Expense, Member } from '../types';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

interface HistoryListProps {
  transactions: Transaction[];
  expenses: Expense[];
  fiscalYear: number;
  members: Member[];
  onCancelTransaction: (id: string) => void;
  onCancelExpense: (id: string) => void;
  onUpdateTransaction?: (updated: Transaction) => void | Promise<void>;
  onUpdateExpense?: (updated: Expense) => void | Promise<void>;
}

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
  targetMonth?: string;
  receiptUrl?: string;
  originalTx?: Transaction;
  originalEx?: Expense;
};

export const HistoryList: React.FC<HistoryListProps> = ({
  transactions,
  expenses,
  fiscalYear,
  members,
  onCancelTransaction,
  onCancelExpense,
  onUpdateTransaction,
  onUpdateExpense
}) => {
  const currentFY = fiscalYear;
  const [viewYear, setViewYear] = useState<number>(currentFY);

  const yearOptions: number[] = [];
  for (let y = 2020; y <= currentFY + 1; y++) yearOptions.push(y);

  const startDate = `${viewYear}-04-01`;
  const endDate   = `${viewYear + 1}-03-31`;

  const currentTransactions = transactions.filter(t => t.date >= startDate && t.date <= endDate);
  const currentExpenses     = expenses.filter(e => e.date >= startDate && e.date <= endDate);

  const memberName = (memberId: string) =>
    members.find(m => m.id === memberId)?.name ?? memberId;

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
      targetMonth: t.targetMonth,
      receiptUrl: t.receiptUrl,
      originalTx: t
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
      receiptUrl: e.receiptUrl,
      originalEx: e
    })))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 編集モーダルのState
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTargetMonth, setEditTargetMonth] = useState('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');

  const openEditModal = (item: HistoryItem) => {
    setEditingItem(item);
    setEditDate(item.date);
    setEditTargetMonth(item.targetMonth || '');
    setEditAmount(item.amount);
    setEditPaymentMethod(item.paymentMethod);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (editingItem.type === 'transaction' && onUpdateTransaction && editingItem.originalTx) {
      const updated: Transaction = {
        ...editingItem.originalTx,
        date: editDate,
        targetMonth: editTargetMonth || undefined,
        amount: Number(editAmount),
        paymentMethod: editPaymentMethod
      };
      onUpdateTransaction(updated);
    } else if (editingItem.type === 'expense' && onUpdateExpense && editingItem.originalEx) {
      const updated: Expense = {
        ...editingItem.originalEx,
        date: editDate,
        amount: Number(editAmount),
        paymentMethod: editPaymentMethod
      };
      onUpdateExpense(updated);
    }
    setEditingItem(null);
  };

  // 領収書再アップロードのState
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadTargetItem, setUploadTargetItem] = useState<HistoryItem | null>(null);

  const triggerUpload = (item: HistoryItem) => {
    setUploadTargetItem(item);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetItem) return;

    setUploadingId(uploadTargetItem.id);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const fileName = `${uploadTargetItem.id}_${Date.now()}_${file.name}`;
          const newUrl = await GoogleSheetsService.uploadReceiptImage(base64Data, fileName);
          
          if (uploadTargetItem.type === 'transaction' && onUpdateTransaction && uploadTargetItem.originalTx) {
            const updated: Transaction = {
              ...uploadTargetItem.originalTx,
              receiptUrl: newUrl
            };
            await onUpdateTransaction(updated);
          } else if (uploadTargetItem.type === 'expense' && onUpdateExpense && uploadTargetItem.originalEx) {
            const updated: Expense = {
              ...uploadTargetItem.originalEx,
              receiptUrl: newUrl
            };
            await onUpdateExpense(updated);
          }
        } catch (error) {
          console.error('Upload error', error);
          alert('画像のアップロードに失敗しました。');
        } finally {
          setUploadingId(null);
          setUploadTargetItem(null);
        }
      };
    } catch (error) {
      console.error('File read error', error);
      setUploadingId(null);
      setUploadTargetItem(null);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 relative">
      <input 
        type="file" 
        accept="image/*,application/pdf" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
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
        <div className="overflow-x-auto pb-24">
          <table className="min-w-full text-left text-xs whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-1 border-x text-center whitespace-nowrap">区分</th>
                <th scope="col" className="px-2 py-1 border-x text-center whitespace-nowrap min-w-[140px]">操作</th>
                <th scope="col" className="px-2 py-1 border-x whitespace-nowrap">日付</th>
                <th scope="col" className="px-2 py-1 border-x text-center whitespace-nowrap">対象月</th>
                <th scope="col" className="px-2 py-1 border-x whitespace-nowrap">所属</th>
                <th scope="col" className="px-2 py-1 border-x min-w-[100px]">納入者 / 摘要</th>
                <th scope="col" className="px-2 py-1 border-x min-w-[120px]">項目 / 勘定科目</th>
                <th scope="col" className="px-2 py-1 border-x text-right whitespace-nowrap">金額</th>
                <th scope="col" className="px-2 py-1 border-x whitespace-nowrap">支払方法</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((item) => (
                <tr
                  key={`${item.type}-${item.id}`}
                  className={`border-b hover:bg-gray-50 transition-colors ${item.isCancelled ? 'bg-gray-100 opacity-60' : ''}`}
                >
                  <td className="px-2 py-1 border-x text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      item.type === 'transaction' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.type === 'transaction' ? '入金' : '支出'}
                    </span>
                  </td>

                  <td className="px-2 py-1 border-x text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      {item.receiptUrl && (
                        <div className="flex items-center gap-0.5">
                          <a
                            href={item.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 font-medium py-1 px-1.5 rounded shadow-sm transition-colors flex items-center justify-center"
                            title="領収書を表示"
                          >
                            📸
                          </a>
                          {!item.isCancelled && (
                            <button
                              onClick={() => triggerUpload(item)}
                              disabled={uploadingId === item.id}
                              className="text-[10px] bg-gray-50 text-gray-600 hover:bg-gray-200 border border-gray-200 font-medium py-1 px-1.5 rounded shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
                              title="画像を差し替え（再アップロード）"
                            >
                              {uploadingId === item.id ? '⌛' : '🔄'}
                            </button>
                          )}
                        </div>
                      )}
                      {!item.receiptUrl && !item.isCancelled && (
                        <button
                          onClick={() => triggerUpload(item)}
                          disabled={uploadingId === item.id}
                          className="text-[10px] bg-gray-50 text-gray-600 hover:bg-gray-200 border border-gray-200 font-medium py-1 px-1.5 rounded shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
                          title="画像をアップロード"
                        >
                           {uploadingId === item.id ? '⌛' : '📸UP'}
                        </button>
                      )}
                      
                      {!item.isCancelled && (
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-[10px] bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white border border-amber-200 font-medium py-1 px-2 rounded shadow-sm transition-colors"
                        >
                          編集
                        </button>
                      )}
                      
                      {item.isCancelled ? (
                        <span className="text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-1 py-0.5 rounded ml-1">取消済</span>
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
                          className="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 font-medium py-1 px-2 rounded shadow-sm transition-colors ml-1"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </td>

                  <td className={`px-2 py-1 border-x font-medium whitespace-nowrap ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.date}
                  </td>

                  <td className={`px-2 py-1 border-x text-center font-medium whitespace-nowrap ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.type === 'transaction' && item.targetMonth ? item.targetMonth : <span className="text-gray-300">―</span>}
                  </td>

                  <td className={`px-2 py-1 border-x whitespace-nowrap ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      item.organization === '道院' ? 'bg-blue-100 text-blue-800' :
                      item.organization === 'スポ少' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.organization}
                    </span>
                  </td>

                  <td className={`px-2 py-1 border-x ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
                    {item.type === 'transaction' && item.memberId
                      ? memberName(item.memberId)
                      : <span className="text-gray-300">―</span>}
                  </td>

                  <td className={`px-2 py-1 border-x ${item.isCancelled ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                    {item.categoryOrItem}
                  </td>

                  <td className={`px-2 py-1 border-x text-right font-semibold whitespace-nowrap ${
                    item.isCancelled ? 'line-through text-gray-400' :
                    item.type === 'transaction' ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {item.type === 'transaction' ? '+' : '-'}{item.amount.toLocaleString()}円
                  </td>

                  <td className={`px-2 py-1 border-x text-gray-500 whitespace-nowrap ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>
                    {item.paymentMethod}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 編集モーダル */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
            <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">履歴の編集</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 border"
                />
              </div>
              {editingItem.type === 'transaction' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">対象月</label>
                  <input
                    type="month"
                    value={editTargetMonth}
                    onChange={(e) => setEditTargetMonth(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 border"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">金額 (円)</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 border"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">支払方法</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 border"
                >
                  <option value="現金">現金</option>
                  <option value="振込">振込</option>
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
