import React, { useState } from 'react';
import { Organization, Expense } from '../types';

interface ExpenseFormProps {
  onSubmit: (expense: any) => void;
  memberships?: any;
  expenses?: Expense[];
  fiscalYear?: number;
}

const PRESET_CATEGORIES = ['保険料', '交際費', '会場費', '備品代', '消耗品費', '通信費', '水道光熱費', 'その他'];

type OrgTab = '全て' | '道院' | 'スポ少';

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit, expenses = [], fiscalYear }) => {
  // ── 入力フォーム state ──────────────────────────────────
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [organization, setOrganization] = useState<Organization>('道院');
  const [category, setCategory] = useState<string>('備品代');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('現金');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // ── 一覧タブ state ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState<OrgTab>('全て');

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setReceiptUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    onSubmit({ date, organization, category, description, amount: Number(amount), paymentMethod, receiptUrl });
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
  );

  const filteredExpenses = activeTab === '全て'
    ? baseExpenses
    : baseExpenses.filter(e => e.organization === activeTab);

  // タブ別合計
  const tabTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const orgBadgeColor = (org: string) => {
    if (org === '道院') return 'bg-blue-100 text-blue-800';
    if (org === 'スポ少') return 'bg-emerald-100 text-emerald-800';
    return 'bg-purple-100 text-purple-800';
  };

  const tabs: OrgTab[] = ['全て', '道院', 'スポ少'];

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
              <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">対象団体</label>
              <select value={organization} onChange={e => setOrganization(e.target.value as Organization)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">金額 (円)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-md py-2 px-3 font-bold text-rose-600 focus:ring-rose-500 focus:border-rose-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">摘要（支払先・内容）</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="支払先名や購入品の具体名・用途"
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">決済手段</label>
            <div className="flex gap-4 flex-wrap">
              {['現金', '銀行振込', 'カード・立替'].map(m => (
                <label key={m} className="inline-flex items-center">
                  <input type="radio" name="paymentMethodEx" value={m} checked={paymentMethod === m}
                    onChange={e => setPaymentMethod(e.target.value)} className="form-radio text-rose-600" />
                  <span className="ml-2 text-sm">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">証憑（領収書）の撮影・アップロード</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="space-y-1 text-center">
                {receiptUrl ? (
                  <div className="relative">
                    <img src={receiptUrl} alt="Receipt preview" className="mx-auto h-32 object-contain rounded" />
                    <button type="button" onClick={() => setReceiptUrl(null)}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 transform translate-x-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-rose-600 hover:text-rose-500 p-1">
                        <span>カメラ起動 / 画像選択</span>
                        <input id="file-upload" name="file-upload" type="file" accept="image/*" capture="environment"
                          className="sr-only" onChange={handleImageCapture} />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 text-right">
            <button type="submit"
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium py-2 px-6 rounded-md shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-rose-500">
              支出を登録する
            </button>
          </div>
        </form>
      </div>

      {/* ── 支出一覧（団体別タブ・監査用） ────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {currentYear}年度 支出一覧
            <span className="text-sm font-normal text-gray-400">（監査用・取消除外）</span>
          </h3>
          {/* タブ */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">該当する支出データがありません</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50 border-b-2 text-gray-600 uppercase tracking-wider font-medium">
                  <tr>
                    <th className="px-4 py-3 border-x">支払日</th>
                    <th className="px-4 py-3 border-x">団体</th>
                    <th className="px-4 py-3 border-x">勘定科目</th>
                    <th className="px-4 py-3 border-x">摘要（支払先・内容）</th>
                    <th className="px-4 py-3 border-x text-right">金額</th>
                    <th className="px-4 py-3 border-x">決済手段</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(e => (
                      <tr key={e.id} className="border-b hover:bg-rose-50 transition-colors">
                        <td className="px-4 py-3 border-x font-medium text-gray-700 whitespace-nowrap">{e.date}</td>
                        <td className="px-4 py-3 border-x">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${orgBadgeColor(e.organization)}`}>
                            {e.organization}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-x text-gray-700">{e.category}</td>
                        <td className="px-4 py-3 border-x text-gray-600 max-w-xs">{e.description}</td>
                        <td className="px-4 py-3 border-x text-right font-bold text-rose-600 whitespace-nowrap">
                          {e.amount.toLocaleString()} 円
                        </td>
                        <td className="px-4 py-3 border-x text-gray-500">{e.paymentMethod}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {/* 合計行 */}
            <div className="mt-3 flex justify-end">
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-5 py-2 flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">
                  {activeTab === '全て' ? '合計' : `${activeTab} 合計`}（{filteredExpenses.length}件）
                </span>
                <span className="text-lg font-extrabold text-rose-700">
                  {tabTotal.toLocaleString()} 円
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
