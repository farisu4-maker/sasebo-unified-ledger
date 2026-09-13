import React, { useState } from 'react';
import { Member } from '../types';
import { parseJapaneseDate } from '../utils/dateParser';

interface PersonalCollectionQuickModalProps {
  member: Member;
  onClose: () => void;
  onSubmit: (data: {
    date: string; memberId: string; purpose: string; amount: number; paymentMethod: string; notes: string;
  }) => void;
}

const PRESET_PURPOSES = ['昇段・昇級試験受験料', '道着・帯代', '大会参加費', '記念品代', 'その他'];

/**
 * 拳士一覧の各行から開く、個人徴収記録（台帳外）のクイック入力モーダル。
 * 対象拳士はすでに確定しているため、検索・選択の手間がない。
 */
export const PersonalCollectionQuickModal: React.FC<PersonalCollectionQuickModalProps> = ({
  member,
  onClose,
  onSubmit
}) => {
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateError, setDateError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>(PRESET_PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('現金');
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    const parsedDate = parseJapaneseDate(dateInput);
    if (!parsedDate) {
      setDateError(`「${dateInput}」の形式が認識できません。例：R7.4.20 / 2025/04/20`);
      return;
    }

    const finalPurpose = purpose === 'その他' ? (customPurpose.trim() || 'その他') : purpose;

    onSubmit({
      date: parsedDate,
      memberId: member.id,
      purpose: finalPurpose,
      amount: Number(amount),
      paymentMethod,
      notes: notes.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
      <div className="relative p-6 bg-white w-full max-w-md m-auto flex-col flex rounded-lg shadow-xl">
        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">個人徴収記録（台帳外）</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 my-4">
          <p className="text-xs text-amber-700 mb-1">対象拳士</p>
          <p className="font-bold text-amber-900">{member.name}（ID: {member.id}）</p>
          <p className="text-[11px] text-amber-700 mt-1">⚠️ この記録は台帳（会計）に一切含まれません</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
              <input
                type="date"
                value={dateInput}
                onChange={e => { setDateInput(e.target.value); setDateError(null); }}
                className={`w-full border rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500 ${dateError ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {dateError && <p className="text-red-600 text-xs mt-1">{dateError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">支払方法</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500">
                <option value="現金">現金</option>
                <option value="銀行振込">銀行振込</option>
                <option value="電子マネー">電子マネー</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用途</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_PURPOSES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-transform active:scale-95 ${
                    purpose === p
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {purpose === 'その他' && (
              <input
                type="text"
                value={customPurpose}
                onChange={e => setCustomPurpose(e.target.value)}
                placeholder="用途を入力"
                className="w-full border border-gray-300 rounded-md py-2 px-3 mt-2 focus:ring-amber-500 focus:border-amber-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">金額（円）</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              min="1"
              placeholder="例：3000"
              className="w-full border border-gray-300 rounded-md py-3 px-3 text-lg font-bold focus:ring-amber-500 focus:border-amber-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="例：〇段審査分"
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500" />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="bg-white border border-gray-300 rounded-md py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
            <button type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors text-sm">
              記録する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
