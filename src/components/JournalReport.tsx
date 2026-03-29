import React, { useMemo } from 'react';
import { Transaction, Expense } from '../types';
import { Printer } from 'lucide-react';

interface JournalReportProps {
  transactions: Transaction[];
  expenses: Expense[];
  fiscalYear: number;
  activeOrgContext: string;
}

export const JournalReport: React.FC<JournalReportProps> = ({
  transactions,
  expenses,
  fiscalYear,
  activeOrgContext,
}) => {
  const { incomeGroups, expenseGroups, totalIncome, totalExpense } = useMemo(() => {
    // 期間計算 (4/1 ~ 翌年3/31)
    const startDate = `${fiscalYear}-04-01`;
    const endDate = `${fiscalYear + 1}-03-31`;

    const filteredTransactions = transactions.filter(t => {
      const matchOrg = activeOrgContext === '統合' ? true : (t.organization === activeOrgContext || t.organization === '両方');
      return !t.isCancelled && t.date >= startDate && t.date <= endDate && matchOrg;
    });

    const filteredExpenses = expenses.filter(e => {
      const matchOrg = activeOrgContext === '統合' ? true : (e.organization === activeOrgContext || e.organization === '両方');
      return e.date >= startDate && e.date <= endDate && matchOrg;
    });

    // 収入グループ化
    const iGroups: Record<string, Transaction[]> = {};
    let tIncome = 0;
    filteredTransactions.forEach(t => {
      const item = t.item || 'その他';
      if (!iGroups[item]) iGroups[item] = [];
      iGroups[item].push(t);
      tIncome += t.amount;
    });

    // 支出グループ化
    const eGroups: Record<string, Expense[]> = {};
    let tExpense = 0;
    filteredExpenses.forEach(e => {
      const cat = e.category || 'その他';
      if (!eGroups[cat]) eGroups[cat] = [];
      eGroups[cat].push(e);
      tExpense += e.amount;
    });

    return {
      incomeGroups: iGroups,
      expenseGroups: eGroups,
      totalIncome: tIncome,
      totalExpense: tExpense
    };
  }, [transactions, expenses, fiscalYear, activeOrgContext]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-lg shadow-md max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h2 className="text-2xl font-bold text-gray-800">仕訳帳 (科目別明細表)</h2>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow transition-colors"
        >
          <Printer size={18} />
          <span>印刷する</span>
        </button>
      </div>

      <div className="print-area">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .page-break {
              page-break-before: always;
            }
            .break-inside-avoid {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}</style>
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{activeOrgContext} 仕訳帳</h1>
          <p className="text-gray-600 text-lg">令和{fiscalYear - 2018}年度 ({fiscalYear}年4月 〜 {fiscalYear + 1}年3月)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 収入の部 */}
          <div>
            <h3 className="text-xl font-bold text-blue-800 border-b-2 border-blue-800 pb-2 mb-4">収入の部</h3>
            {Object.keys(incomeGroups).length === 0 ? (
              <p className="text-gray-500 italic">収入データがありません</p>
            ) : (
              Object.entries(incomeGroups).sort().map(([item, txs]) => {
                const itemTotal = txs.reduce((sum, t) => sum + t.amount, 0);
                return (
                  <div key={item} className="mb-6 break-inside-avoid shadow-sm border border-gray-100 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 flex justify-between font-bold text-blue-900 border-b border-blue-100">
                      <span>{item}</span>
                      <span>¥{itemTotal.toLocaleString()}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-1 text-left font-normal w-1/4">日付</th>
                          <th className="px-4 py-1 text-left font-normal w-1/2">対象/備考</th>
                          <th className="px-4 py-1 text-right font-normal w-1/4">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txs.sort((a,b) => a.date.localeCompare(b.date)).map(t => (
                          <tr key={t.id} className="border-t border-gray-100">
                            <td className="px-4 py-1.5">{t.date}</td>
                            <td className="px-4 py-1.5 truncate max-w-[150px]">{t.targetMonth ? `${t.targetMonth}月分 ` : ''}{t.paymentMethod}</td>
                            <td className="px-4 py-1.5 text-right">{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
            
            <div className="mt-4 bg-blue-100 font-bold text-lg px-4 py-3 flex justify-between rounded shadow-sm break-inside-avoid">
              <span>収入合計</span>
              <span>¥{totalIncome.toLocaleString()}</span>
            </div>
          </div>

          {/* 支出の部 */}
          <div>
            <h3 className="text-xl font-bold text-red-800 border-b-2 border-red-800 pb-2 mb-4">支出の部</h3>
            {Object.keys(expenseGroups).length === 0 ? (
              <p className="text-gray-500 italic">支出データがありません</p>
            ) : (
              Object.entries(expenseGroups).sort().map(([category, exps]) => {
                const catTotal = exps.reduce((sum, e) => sum + e.amount, 0);
                return (
                  <div key={category} className="mb-6 break-inside-avoid shadow-sm border border-gray-100 rounded-lg overflow-hidden">
                    <div className="bg-red-50 px-4 py-2 flex justify-between font-bold text-red-900 border-b border-red-100">
                      <span>{category}</span>
                      <span>¥{catTotal.toLocaleString()}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-1 text-left font-normal w-1/4">日付</th>
                          <th className="px-4 py-1 text-left font-normal w-1/2">摘要</th>
                          <th className="px-4 py-1 text-right font-normal w-1/4">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exps.sort((a,b) => a.date.localeCompare(b.date)).map(e => (
                          <tr key={e.id} className="border-t border-gray-100">
                            <td className="px-4 py-1.5">{e.date}</td>
                            <td className="px-4 py-1.5">{e.description}</td>
                            <td className="px-4 py-1.5 text-right">{e.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
            
            <div className="mt-4 bg-red-100 font-bold text-lg px-4 py-3 flex justify-between rounded shadow-sm break-inside-avoid">
              <span>支出合計</span>
              <span>¥{totalExpense.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-6 border-t-2 border-gray-800 flex justify-between items-center break-inside-avoid">
          <span className="text-xl font-bold text-gray-800">差引残高 (次年度繰越金)</span>
          <span className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            ¥{(totalIncome - totalExpense).toLocaleString()}
          </span>
        </div>

      </div>
    </div>
  );
};
