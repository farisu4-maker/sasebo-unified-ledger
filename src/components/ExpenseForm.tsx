import React, { useState } from 'react';
import { Expense, Member } from '../types';
import { parseJapaneseDate } from '../utils/dateParser';
interface ExpenseFormSubmitData {
  date: string;
  organization: '道院' | 'スポ少';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  receiptUrl: string | null;
}

interface ExpenseFormProps {
  onSubmit: (expense: ExpenseFormSubmitData) => void;
  memberships?: Member[];
  expenses?: Expense[];
  fiscalYear?: number;
}

const PRESET_CATEGORIES = ['保険料', '交際費', '会場費', '備品代', '消耗品費', '通信費', '水道光熱費', 'その他'];

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit, expenses = [], fiscalYear }) => {
  // ── 入力フォーム state ──────────────────────────────────
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateError, setDateError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<'道院' | 'スポ少'>('道院');
  const [category, setCategory] = useState<string>('備品代');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('現金');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setReceiptUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    // 日付を自動パース（和暦・スラッシュ等に対応）
    const parsedDate = parseJapaneseDate(dateInput);
    if (!parsedDate) {
      setDateError(`「${dateInput}」の形式が認識できません。例：R7.4.20 / 2025/04/20 / 令和7年4月20日`);
      return;
    }
    setDateError(null);

    onSubmit({ date: parsedDate, organization, category, description, amount: Number(amount), paymentMethod, receiptUrl });
    setDescription('');
    setAmount('');
    setReceiptUrl(null);
  };

  // ── 支出一覧フィルタリング ────────────────────────────
  const currentYear = fiscalYear ?? new Date().getFullYear();
  const startDate = `${currentYear}-04-01`;
  const endDate   = `${currentYear + 1}-03-31`;

  const baseExpenses = expenses.filter(e =>
    !e.isCancelled && e.date >= startDate && e.date <= endDate
  ).sort((a, b) => b.date.localeCompare(a.date)); // 日付降順

  const doinExpenses = baseExpenses.filter(e => e.organization === '道院');
  const spoExpenses  = baseExpenses.filter(e => e.organization === 'スポ少');
  const doinTotal    = doinExpenses.reduce((sum, e) => sum + e.amount, 0);
  const spoTotal     = spoExpenses.reduce((sum, e) => sum + e.amount, 0);

  const orgBadgeColor = (org: string) => {
    if (org === '道院') return 'bg-blue-100 text-blue-800';
    if (org === 'スポ少') return 'bg-emerald-100 text-emerald-800';
    return 'bg-purple-100 text-purple-800';
  };

  const ExpenseTable = ({
    title, rows, total, accentClass
  }: { title: string; rows: Expense[]; total: number; accentClass: string }) => (
    <div className={`bg-white rounded-xl shadow-sm border ${accentClass} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-3 ${accentClass.replace('border-', 'bg-').replace('-300', '-50')}`}>
        <h3 className="font-bold text-base text-gray-800">{title}</h3>
        <span className="text-sm font-semibold text-gray-700">
          合計: <span className="text-lg text-rose-600 font-bold">¥{total.toLocaleString()}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
            <tr>
              <th className="py-2 px-3 text-left whitespace-nowrap">日付</th>
              <th className="py-2 px-3 text-left whitespace-nowrap">科目</th>
              <th className="py-2 px-3 text-left">説明</th>
              <th className="py-2 px-3 text-left">支払方法</th>
              <th className="py-2 px-3 text-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">支出記録がありません</td></tr>
            ) : rows.map(ex => (
              <tr key={ex.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${ex.isCancelled ? 'opacity-40 line-through' : ''}`}>
                <td className="py-2 px-3 whitespace-nowrap">{ex.date}</td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${orgBadgeColor(ex.organization)}`}>
                    {ex.category}
                  </span>
                </td>
                <td className="py-2 px-3 max-w-xs truncate text-gray-600" title={ex.description}>{ex.description}</td>
                <td className="py-2 px-3 text-gray-500">{ex.paymentMethod}</td>
                <td className="py-2 px-3 text-right font-mono font-medium text-rose-700">¥{ex.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* ── 支出入力フォーム ────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <svg className="w-5 h-5 mr-2 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          支出入力
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日付
              </label>
              <input
                type="date"
                value={dateInput}
                onChange={e => { setDateInput(e.target.value); setDateError(null); }}
                className={`w-full border rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500 ${dateError ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {dateError && <p className="text-red-600 text-xs mt-1">{dateError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">対象団体</label>
              <select
                value={organization}
                onChange={e => setOrganization(e.target.value as '道院' | 'スポ少')}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500"
              >
                <option value="道院">道院</option>
                <option value="スポ少">スポ少</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">勘定科目</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500">
                {PRESET_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">支払方法</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500">
                <option value="現金">現金</option>
                <option value="銀行振込">銀行振込</option>
                <option value="電子マネー">電子マネー</option>
                <option value="クレジットカード">クレジットカード</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">摘要・説明</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="例：3月分武道館使用料"
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">金額（円）</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              min="1" placeholder="例：15000"
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">領収書画像（任意）</label>
            <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100" />
            {receiptUrl && (
              <img src={receiptUrl} alt="領収書プレビュー" className="mt-2 h-24 object-cover rounded border border-gray-200" />
            )}
          </div>

          <button type="submit"
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors text-sm">
            支出を登録する
          </button>
        </form>
      </div>

      {/* ── 支出一覧（道院・スポ少 上下並列） ─────────────── */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
          {currentYear}年度 支出一覧
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ExpenseTable
            title="■ 道院 支出一覧"
            rows={doinExpenses}
            total={doinTotal}
            accentClass="border-blue-300"
          />
          <ExpenseTable
            title="■ スポ少 支出一覧"
            rows={spoExpenses}
            total={spoTotal}
            accentClass="border-emerald-300"
          />
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-sm text-gray-600 text-right">
          合計支出（道院 + スポ少）：
          <span className="text-base font-bold text-rose-700 ml-2">¥{(doinTotal + spoTotal).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
