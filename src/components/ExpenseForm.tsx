import React, { useState } from 'react';
import { Organization } from '../types';

interface ExpenseFormProps {
  onSave: (expense: any) => void;
}

const PRESET_CATEGORIES = ['保険料', '交際費', '会場費', '備品代', '消耗品費', '通信費', '水道光熱費', 'その他'];

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSave }) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [organization, setOrganization] = useState<Organization | '両方'>('道院');
  const [category, setCategory] = useState<string>('備品代');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('現金');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 簡易的なプレビュー表示用
      const url = URL.createObjectURL(file);
      setReceiptUrl(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    onSave({
      date,
      organization,
      category,
      description,
      amount: Number(amount),
      paymentMethod,
      receiptUrl
    });
    
    // フォームリセット
    setDescription('');
    setAmount('');
    setReceiptUrl(null);
  };

  return (
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
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象団体</label>
            <select 
              value={organization}
              onChange={(e) => setOrganization(e.target.value as Organization | '両方')}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="道院">道院</option>
              <option value="スポ少">スポ少</option>
              <option value="両方">両方（按分など）</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">勘定科目</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500"
            >
              {PRESET_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">金額 (円)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full border border-gray-300 rounded-md py-2 px-3 font-bold text-rose-600 focus:ring-rose-500 focus:border-rose-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
          <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="購入品の具体名や用途"
            className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-rose-500 focus:border-rose-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">決済手段</label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input type="radio" name="paymentMethodEx" value="現金" checked={paymentMethod === '現金'} onChange={(e) => setPaymentMethod(e.target.value)} className="form-radio text-rose-600 focus:ring-rose-500" />
              <span className="ml-2">現金</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name="paymentMethodEx" value="銀行振込" checked={paymentMethod === '銀行振込'} onChange={(e) => setPaymentMethod(e.target.value)} className="form-radio text-rose-600 focus:ring-rose-500" />
              <span className="ml-2">銀行振込</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name="paymentMethodEx" value="カード・立替" checked={paymentMethod === 'カード・立替'} onChange={(e) => setPaymentMethod(e.target.value)} className="form-radio text-rose-600 focus:ring-rose-500" />
              <span className="ml-2">カード・立替等</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">証憑（領収書）の撮影・アップロード</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="space-y-1 text-center">
              {receiptUrl ? (
                <div className="relative">
                  <img src={receiptUrl} alt="Receipt preview" className="mx-auto h-32 object-contain rounded" />
                  <button type="button" onClick={() => setReceiptUrl(null)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 transform translate-x-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-rose-600 hover:text-rose-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-rose-500 p-1">
                      <span>カメラ起動 / 画像選択</span>
                      <input id="file-upload" name="file-upload" type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleImageCapture} />
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 text-right">
          <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-medium py-2 px-6 rounded-md shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-rose-500">
            支出を登録する
          </button>
        </div>
      </form>
    </div>
  );
};
