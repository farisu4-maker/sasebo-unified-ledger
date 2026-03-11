import React from 'react';
import { Organization, Transaction, Expense, Budget, OpeningBalance } from '../types';

interface DashboardProps {
  activeOrgContext: Organization | '統合';
  transactions: Transaction[];
  expenses: Expense[];
  budgets: Budget[];
  openingBalances: OpeningBalance[];
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  activeOrgContext, transactions, expenses, budgets, openingBalances 
}) => {
  // 残高計算: (前年度繰越) + トランザクション合計 - 支出合計
  const initialDoin = openingBalances.find(b => b.organization === '道院')?.amount || 0;
  const initialSpo = openingBalances.find(b => b.organization === 'スポ少')?.amount || 0;

  const incomeDoin = transactions.filter(t => t.organization === '道院').reduce((sum, t) => sum + t.amount, 0);
  const incomeSpo = transactions.filter(t => t.organization === 'スポ少').reduce((sum, t) => sum + t.amount, 0);

  // 両方の組織の支出は半分ずつ按分
  const expenseDoin = expenses.filter(e => e.organization === '道院' || e.organization === '両方')
                              .reduce((sum, e) => sum + (e.organization === '両方' ? e.amount / 2 : e.amount), 0);
  const expenseSpo = expenses.filter(e => e.organization === 'スポ少' || e.organization === '両方')
                              .reduce((sum, e) => sum + (e.organization === '両方' ? e.amount / 2 : e.amount), 0);

  const balanceDoin = initialDoin + incomeDoin - expenseDoin;
  const balanceSpo = initialSpo + incomeSpo - expenseSpo;
  const totalBalanceAll = balanceDoin + balanceSpo;
  
  const displayBalance = activeOrgContext === '道院' ? balanceDoin :
                         activeOrgContext === 'スポ少' ? balanceSpo :
                         totalBalanceAll;

  // ダミー回収率
  const collectionRateDoin = 85;
  const collectionRateSpo = 92;

  // 表示用トランザクション絞り込み
  const displayTransactions = activeOrgContext === '統合' 
    ? transactions
    : transactions.filter(t => t.organization === activeOrgContext);

  const recentTransactions = displayTransactions.slice(0, 5); // 直近5件

  // 予算情報の計算
  const displayBudgets = activeOrgContext === '統合' 
    ? budgets 
    : budgets.filter(b => b.organization === activeOrgContext || b.organization === '両方');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
          <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('ja-JP')} 現在の状況</p>
        </div>
      </div>

      {/* 残高ハイライト */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
          {activeOrgContext === '統合' ? '2団体合算 残高' : `${activeOrgContext} 残高`}
          <span className="ml-2 text-xs font-normal text-gray-400 normal-case">(繰越金 + 当期入金 - 当期支出)</span>
        </h3>
        <div className="flex items-baseline">
          <span className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            ¥{displayBalance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 回収率サマリー (統合モード時または各団体表示時) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(activeOrgContext === '統合' || activeOrgContext === '道院') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700 flex items-center">
                <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                道院 当月会費回収率
              </h3>
              <span className="text-2xl font-bold text-blue-600">{collectionRateDoin}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${collectionRateDoin}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-right">34/40名 納入済</p>
          </div>
        )}

        {(activeOrgContext === '統合' || activeOrgContext === 'スポ少') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700 flex items-center">
                <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
                スポ少 当月会費回収率
              </h3>
              <span className="text-2xl font-bold text-emerald-600">{collectionRateSpo}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-emerald-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${collectionRateSpo}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-right">46/50名 納入済</p>
          </div>
        )}
      </div>

      {/* 予実管理 (Budget vs Actual) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          予実管理状況（勘定科目別）
        </h3>
        <div className="space-y-5">
          {displayBudgets.map(budget => {
            // 対象となる科目の支出を集計
            let conditionOrg = [budget.organization];
            if (activeOrgContext === '統合') conditionOrg = [budget.organization];
            // その予算に対する現在の支出額
            const relevantExpenses = expenses.filter(e => e.category === budget.category && (e.organization === budget.organization || e.organization === '両方'));
            const actualExpense = relevantExpenses.reduce((sum, e) => sum + (e.organization === '両方' && budget.organization !== '両方' ? e.amount / 2 : e.amount), 0);
            
            const ratio = budget.amount > 0 ? (actualExpense / budget.amount) * 100 : 0;
            const overBudget = ratio > 100;
            
            return (
              <div key={budget.id}>
                <div className="flex justify-between items-end mb-1">
                  <div>
                    <span className="text-sm font-bold text-gray-700">{budget.category}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{budget.organization}</span>
                  </div>
                  <div className="text-sm">
                    <span className={`font-bold ${overBudget ? 'text-red-600' : 'text-gray-900'}`}>¥{actualExpense.toLocaleString()}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-gray-500">¥{budget.amount.toLocaleString()}</span>
                    <span className={`ml-2 font-bold ${overBudget ? 'text-red-600' : 'text-gray-600'}`}>({ratio.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`${overBudget ? 'bg-red-500' : 'bg-indigo-500'} h-2 rounded-full transition-all duration-1000`} 
                    style={{ width: `${Math.min(ratio, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
          {displayBudgets.length === 0 && (
            <p className="text-sm text-gray-500">予算が設定されていません</p>
          )}
        </div>
      </div>

      {/* 直近の入金履歴 (タイムライン) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6">直近の入金履歴</h3>
        <div className="relative border-l-2 border-gray-100 ml-3 md:ml-4 space-y-6">
          {recentTransactions.map((tx, index) => (
            <div key={tx.id} className="relative pl-6">
              <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm ${
                tx.organization === '道院' ? 'bg-blue-500' : 'bg-emerald-500'
              }`}></div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                <div>
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-gray-900">{tx.memberId}</span>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tx.organization === '道院' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {tx.organization}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{tx.item} ({tx.paymentMethod})</p>
                </div>
                <div className="mt-2 sm:mt-0 text-left sm:text-right">
                  <p className="text-base font-bold text-gray-900">+ ¥{tx.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.timestamp).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <p className="text-gray-500 text-sm ml-4">表示する履歴がありません</p>
          )}
        </div>
      </div>
    </div>
  );
};
