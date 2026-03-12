import React, { useState } from 'react';
import { Member, Transaction, Expense, Budget } from '../types';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

interface SettingsProps {
  members: Member[];
  transactions: Transaction[];
  expenses: Expense[];
  budgets: Budget[];
  fiscalYear: number;
  onCloseFiscalYear: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  members, transactions, expenses, budgets, fiscalYear, onCloseFiscalYear
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [closeMessage, setCloseMessage] = useState<string | null>(null);

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      members,
      transactions,
      expenses,
      budgets,
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

  const handleYearEndClose = async () => {
    if (!window.confirm(`${fiscalYear}年度の決算処理（Rollover）を実行しますか？\nこの操作は元に戻せません。`)) {
      return;
    }

    setIsClosing(true);
    setCloseMessage(null);

    try {
      const startDate = `${fiscalYear}-04-01`;
      const endDate = `${fiscalYear + 1}-03-31`;

      const currentTransactions = transactions.filter((t: Transaction) => t.date >= startDate && t.date <= endDate && !t.isCancelled);
      const currentExpenses = expenses.filter((e: Expense) => e.date >= startDate && e.date <= endDate && !e.isCancelled);

      const orgs: ('道院' | 'スポ少')[] = ['道院', 'スポ少'];
      const finalBalancesUpdates: { rowNumber: number, finalBalance: number }[] = [];
      const newBudgets: Budget[] = [];

      let hasError = false;

      for (const org of orgs) {
        // Calculate initial balance
        const initialBalance = budgets
          .filter((b: Budget) => b.organization === org && b.year === fiscalYear)
          .reduce((sum: number, b: Budget) => sum + (b.initialBalance || 0), 0);
        
        // Calculate income & expense
        const income = currentTransactions.filter((t: Transaction) => t.organization === org).reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        const expense = currentExpenses
          .filter((e: Expense) => e.organization === org)
          .reduce((sum: number, e: Expense) => sum + e.amount, 0);
        
        const computedFinalBalance = initialBalance + income - expense;

        // Find existing budget rows for this org for the current year
        const currentYearBudgets = budgets.filter((b: Budget) => b.organization === org && b.year === fiscalYear);
        
        if (currentYearBudgets.length > 0) {
          // Update the first budget row with the final balance (or specific representation if multiple rows)
          // As per requirement, final_balance is added to M_Budgets
          if (currentYearBudgets[0].rowNumber) {
            finalBalancesUpdates.push({
              rowNumber: currentYearBudgets[0].rowNumber,
              finalBalance: computedFinalBalance
            });
          }
          
          // Create new record for next fiscal year setting initial_balance
          newBudgets.push({
            id: `B_NEW_${Date.now()}_${org}`,
            organization: org,
            category: '次年度繰越（システム生成）',
            amount: 0,
            initialBalance: computedFinalBalance,
            year: fiscalYear + 1
          });
        }
      }

      if (!hasError && (finalBalancesUpdates.length > 0 || newBudgets.length > 0)) {
        const success = await GoogleSheetsService.closeFiscalYear(finalBalancesUpdates, newBudgets);
        if (success) {
          setCloseMessage(`${fiscalYear}年度の決算処理が完了しました。${fiscalYear + 1}年度の初期データが作成されました。`);
          // Callback to refresh data in App.tsx
          onCloseFiscalYear();
        } else {
          setCloseMessage('決算処理の通信中にエラーが発生しました。');
        }
      } else {
        setCloseMessage('更新対象の予算データが見つかりませんでした。');
      }

    } catch (e) {
      console.error(e);
      setCloseMessage('決算処理中に想定外のエラーが発生しました。');
    } finally {
      setIsClosing(false);
    }
  };

  /**
   * 決算取り消し（Undo Rollover）
   *   1. 対象年度の final_balance をクリア
   *   2. 次年度の「次年度繰越（システム生成）」行を空白で上書き
   */
  const handleUndoRollover = async () => {
    if (!window.confirm(
      `${fiscalYear}年度の決算処理を取り消しますか？\n年度確定残高がクリアされ、${fiscalYear + 1}年度の期首繰越レコードが削除されます。`
    )) return;

    setIsUndoing(true);
    setCloseMessage(null);

    try {
      const success = await GoogleSheetsService.undoFiscalYear(fiscalYear);
      if (success) {
        setCloseMessage(`${fiscalYear}年度の決算取り消しが完了しました。予算データを再確認してください。`);
        onCloseFiscalYear();
      } else {
        setCloseMessage(`取り消し対象の決算データが見つかりませんでした（決算未実行の可能性）。`);
      }
    } catch (e) {
      console.error(e);
      setCloseMessage('処理中に想定外のエラーが発生しました。');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">システム設定</h2>
      
      {closeMessage && (
        <div className={`mb-6 p-4 rounded-md ${closeMessage.includes('完了') ? 'bg-green-50 text-green-800 border-l-4 border-green-500' : 'bg-red-50 text-red-800 border-l-4 border-red-500'}`}>
          {closeMessage}
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            データ・バックアップ
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            現在のシステムに登録されているすべてのデータ（拳士情報、入出金履歴、予算設定など）をJSONファイルとしてダウンロードします。<br />
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
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            年度決算処理（Rollover）
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            {fiscalYear}年度の帳簿を締め、計算された「期末残高」を台帳に確定記録し、{fiscalYear + 1}年度の「期首残高」として引き継ぎます。<br/>
            <strong>※この操作は1年度につき1回のみ実行してください。</strong>実行後、数秒でデータが同期されます。
          </p>
          
          <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-4">
            <h4 className="font-bold text-orange-800 text-sm mb-2">{fiscalYear}年度 決算プレビュー</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded border border-orange-100">
                <div className="text-xs text-gray-500 mb-1">道院 次期繰越予定額</div>
                <div className="font-mono text-lg font-semibold">
                  {((budgets.filter((b: Budget) => b.organization === '道院' && b.year === fiscalYear).reduce((sum: number, b: Budget) => sum + (b.initialBalance || 0), 0)) +
                   (transactions.filter((t: Transaction) => t.organization === '道院' && t.date >= `${fiscalYear}-04-01` && t.date <= `${fiscalYear + 1}-03-31` && !t.isCancelled).reduce((sum: number, t: Transaction) => sum + t.amount, 0)) -
                   (expenses.filter((e: Expense) => e.organization === '道院' && e.date >= `${fiscalYear}-04-01` && e.date <= `${fiscalYear + 1}-03-31` && !e.isCancelled).reduce((sum: number, e: Expense) => sum + e.amount, 0))
                  ).toLocaleString()} 円
                </div>
              </div>
              <div className="bg-white p-3 rounded border border-orange-100">
                <div className="text-xs text-gray-500 mb-1">スポ少 次期繰越予定額</div>
                <div className="font-mono text-lg font-semibold">
                  {((budgets.filter((b: Budget) => b.organization === 'スポ少' && b.year === fiscalYear).reduce((sum: number, b: Budget) => sum + (b.initialBalance || 0), 0)) +
                   (transactions.filter((t: Transaction) => t.organization === 'スポ少' && t.date >= `${fiscalYear}-04-01` && t.date <= `${fiscalYear + 1}-03-31` && !t.isCancelled).reduce((sum: number, t: Transaction) => sum + t.amount, 0)) -
                   (expenses.filter((e: Expense) => e.organization === 'スポ少' && e.date >= `${fiscalYear}-04-01` && e.date <= `${fiscalYear + 1}-03-31` && !e.isCancelled).reduce((sum: number, e: Expense) => sum + e.amount, 0))
                  ).toLocaleString()} 円
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={handleYearEndClose}
            disabled={isClosing}
            className={`font-medium py-2 px-6 rounded-md shadow-sm transition-colors text-sm flex items-center ${isClosing ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}
          >
            {isClosing && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            決算処理を実行して次年度へ繰越
          </button>

          {/* 決算取り消し（誤操作防止） */}
          <div className="mt-6 pt-4 border-t border-red-100">
            <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              決算取り消し（Undo Rollover）
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              誤って決算処理を実行した場合はここから元に戻せます。<br />
              「{fiscalYear}年度 final_balance」をクリアし、「{fiscalYear + 1}年度の期首繰越レコード」を削除します。
            </p>
            <button
              onClick={handleUndoRollover}
              disabled={isUndoing}
              className={`font-medium py-2 px-6 rounded-md shadow-sm transition-colors text-sm flex items-center ${
                isUndoing ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100'
              }`}
            >
              {isUndoing && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              ↺ {fiscalYear}年度の決算を取り消す
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
