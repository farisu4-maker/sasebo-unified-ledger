import React from 'react';
import { Member, Transaction, Expense, Budget, OpeningBalance } from '../types';

interface SettingsProps {
  members: Member[];
  transactions: Transaction[];
  expenses: Expense[];
  budgets: Budget[];
  openingBalances: OpeningBalance[];
}

export const Settings: React.FC<SettingsProps> = ({ 
  members, transactions, expenses, budgets, openingBalances 
}) => {

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      members,
      transactions,
      expenses,
      budgets,
      openingBalances
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `sasebo-ledger-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">システム設定</h2>
      
      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            データ・バックアップ
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            現在のシステムに登録されているすべてのデータ（拳士情報、入出金履歴、予算設定、繰越金など）をJSONファイルとしてダウンロードします。<br />
            定期的なバックアップを推奨します。
          </p>
          <button 
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md shadow-sm transition-colors text-sm flex items-center"
          >
            全データをエクスポート (JSON)
          </button>
        </section>

        <section className="pt-6 border-t border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            期首設定（開発中）
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            次期バージョンでは、ここで各団体の前年度繰越金や、勘定科目ごとの予算額を直接編集できるようになります。現在は `sampleData.ts` の内容が適用されています。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50 pointer-events-none">
            {/* モックプレビュー */}
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <h4 className="font-bold text-sm mb-2">道院 繰越金設定</h4>
              <input type="number" defaultValue={openingBalances.find(b => b.organization === '道院')?.amount} className="w-full border p-2 rounded text-sm bg-white" disabled />
            </div>
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <h4 className="font-bold text-sm mb-2">スポ少 繰越金設定</h4>
              <input type="number" defaultValue={openingBalances.find(b => b.organization === 'スポ少')?.amount} className="w-full border p-2 rounded text-sm bg-white" disabled />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
