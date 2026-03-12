import React, { useState } from 'react';
import { Organization, Transaction, Expense, Budget, Member } from '../types/index';

interface DashboardProps {
  activeOrgContext: Organization | '統合';
  transactions: Transaction[];
  expenses: Expense[];
  budgets: Budget[];
  members: Member[];
  fiscalYear: number;
}

/** YYYY-MM を「YYYY年M月分」に変換 */
function fmtTargetMonth(ym: string | undefined): string {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m)}月分`;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeOrgContext, transactions, expenses, budgets, members, fiscalYear
}) => {
  const [showBalanceDetail, setShowBalanceDetail] = useState(false);

  // ── 年度フィルタ（4月始まり） ──────────────────────────────
  const startDate = `${fiscalYear}-04-01`;
  const endDate   = `${fiscalYear + 1}-03-31`;

  const currentTransactions: Transaction[] = transactions.filter(
    t => t.date >= startDate && t.date <= endDate && !t.isCancelled
  );
  const currentExpenses: Expense[] = expenses.filter(
    e => e.date >= startDate && e.date <= endDate && !e.isCancelled
  );

  // ── 残高計算（組織別）─────────────────────────────────────
  //   公式: 期首繰越 + 当期収入計 − 当期支出計 = 現在残高
  //   支出は必ず「道院」または「スポ少」のどちらかに全額計上（按分なし）
  const initialDoin = budgets
    .filter(b => b.organization === '道院' && b.year === fiscalYear)
    .reduce((sum, b) => sum + (b.initialBalance || 0), 0);

  const initialSpo = budgets
    .filter(b => b.organization === 'スポ少' && b.year === fiscalYear)
    .reduce((sum, b) => sum + (b.initialBalance || 0), 0);

  const incomeDoin = currentTransactions
    .filter(t => t.organization === '道院')
    .reduce((sum, t) => sum + t.amount, 0);

  const incomeSpo = currentTransactions
    .filter(t => t.organization === 'スポ少')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenseDoin = currentExpenses
    .filter(e => e.organization === '道院')
    .reduce((sum, e) => sum + e.amount, 0);

  const expenseSpo = currentExpenses
    .filter(e => e.organization === 'スポ少')
    .reduce((sum, e) => sum + e.amount, 0);

  const balanceDoin = initialDoin + incomeDoin - expenseDoin;
  const balanceSpo  = initialSpo  + incomeSpo  - expenseSpo;

  // ── 乖離チェック ───────────────────────────────────────────
  const hasFinalDoin = budgets.some(b => b.organization === '道院' && b.year === fiscalYear && b.finalBalance !== undefined);
  const finalDoin    = budgets.filter(b => b.organization === '道院' && b.year === fiscalYear).reduce((s, b) => s + (b.finalBalance || 0), 0);

  const hasFinalSpo  = budgets.some(b => b.organization === 'スポ少' && b.year === fiscalYear && b.finalBalance !== undefined);
  const finalSpo     = budgets.filter(b => b.organization === 'スポ少' && b.year === fiscalYear).reduce((s, b) => s + (b.finalBalance || 0), 0);

  let alertMessage: string | null = null;
  if (hasFinalDoin && finalDoin !== balanceDoin) {
    alertMessage = `道院の計算残高（${balanceDoin.toLocaleString()}円）と台帳の確定額（${finalDoin.toLocaleString()}円）に乖離があります。`;
  }
  if (hasFinalSpo && finalSpo !== balanceSpo) {
    const msg = `スポ少の計算残高（${balanceSpo.toLocaleString()}円）と台帳の確定額（${finalSpo.toLocaleString()}円）に乖離があります。`;
    alertMessage = alertMessage ? `${alertMessage} / ${msg}` : msg;
  }

  // ── 表示フィルタ ──────────────────────────────────────────
  const displayTransactions = activeOrgContext === '統合'
    ? currentTransactions
    : currentTransactions.filter(t => t.organization === activeOrgContext);

  const displayExpenses = activeOrgContext === '統合'
    ? currentExpenses
    : currentExpenses.filter(e => e.organization === activeOrgContext);

  // ── 統合タイムライン（入金 + 支出 を日付降順で最新10件） ──
  type TimelineItem =
    | { kind: 'income';  date: string; timestamp: string; tx: Transaction;  memberName: string }
    | { kind: 'expense'; date: string; timestamp: string; ex: Expense };

  const memberMap = new Map(members.map(m => [m.id, m]));

  const timelineItems: TimelineItem[] = [
    ...displayTransactions.map(tx => ({
      kind: 'income' as const,
      date: tx.date,
      timestamp: tx.timestamp,
      tx,
      memberName: memberMap.get(tx.memberId)?.name ?? tx.memberId
    })),
    ...displayExpenses.map(ex => ({
      kind: 'expense' as const,
      date: ex.date,
      timestamp: ex.timestamp ?? ex.date,
      ex
    }))
  ]
    .sort((a, b) => {
      const dCmp = b.date.localeCompare(a.date);
      if (dCmp !== 0) return dCmp;
      return b.timestamp.localeCompare(a.timestamp);
    })
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
          <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('ja-JP')} 現在の状況</p>
        </div>
      </div>

      {/* 乖離警告 */}
      {alertMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-center">
          <svg className="h-5 w-5 text-red-500 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-bold text-red-700">{alertMessage}</p>
        </div>
      )}

      {/* ── 残高カード（道院／スポ少を独立表示）────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 道院残高 */}
        <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-60 pointer-events-none" />
          <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-1">道院 残高</h3>
          <p className="text-xs text-gray-400 mb-3">{fiscalYear}年度 ／ 期首繰越 ＋ 収入 − 支出</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-3xl md:text-4xl font-extrabold tracking-tight ${
              balanceDoin < 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              ¥{balanceDoin.toLocaleString()}
            </span>
            {balanceDoin < 0 && (
              <span className="bg-red-100 text-red-700 rounded-full text-xs font-bold px-2 py-0.5">残高マイナス</span>
            )}
          </div>
          <div className="space-y-0.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>① 期首繰越</span>
              <span className="font-mono">¥{initialDoin.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-blue-600">
              <span>② ＋ 当期収入</span>
              <span className="font-mono">¥{incomeDoin.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>③ − 当期支出</span>
              <span className="font-mono">¥{expenseDoin.toLocaleString()}</span>
            </div>
            <div className="pt-1 border-t border-gray-200 flex justify-between font-bold">
              <span className="text-gray-700">①＋②−③</span>
              <span className={`font-mono ${balanceDoin < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                ¥{balanceDoin.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* スポ少残高 */}
        <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 opacity-60 pointer-events-none" />
          <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-1">スポ少 残高</h3>
          <p className="text-xs text-gray-400 mb-3">{fiscalYear}年度 ／ 期首繰越 ＋ 収入 − 支出</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-3xl md:text-4xl font-extrabold tracking-tight ${
              balanceSpo < 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              ¥{balanceSpo.toLocaleString()}
            </span>
            {balanceSpo < 0 && (
              <span className="bg-red-100 text-red-700 rounded-full text-xs font-bold px-2 py-0.5">残高マイナス</span>
            )}
          </div>
          <div className="space-y-0.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>① 期首繰越</span>
              <span className="font-mono">¥{initialSpo.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-blue-600">
              <span>② ＋ 当期収入</span>
              <span className="font-mono">¥{incomeSpo.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>③ − 当期支出</span>
              <span className="font-mono">¥{expenseSpo.toLocaleString()}</span>
            </div>
            <div className="pt-1 border-t border-gray-200 flex justify-between font-bold">
              <span className="text-gray-700">①＋②−③</span>
              <span className={`font-mono ${balanceSpo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                ¥{balanceSpo.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 残高計算根拠（トグル式詳細表示） ─────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <button
          onClick={() => setShowBalanceDetail(v => !v)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showBalanceDetail ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          {fiscalYear}年度 2団体合計の残高根拠を{showBalanceDetail ? '非表示' : '表示'}
        </button>
        {showBalanceDetail && (
          <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
            <div className="bg-blue-50 rounded-lg p-3 space-y-1">
              <p className="font-bold text-blue-800 mb-1">道院</p>
              <div className="flex justify-between text-gray-600"><span>期首繰越</span><span className="font-mono">¥{initialDoin.toLocaleString()}</span></div>
              <div className="flex justify-between text-blue-600"><span>+ 収入</span><span className="font-mono">¥{incomeDoin.toLocaleString()}</span></div>
              <div className="flex justify-between text-rose-600"><span>− 支出</span><span className="font-mono">¥{expenseDoin.toLocaleString()}</span></div>
              <div className="pt-1 border-t border-blue-200 flex justify-between font-bold text-blue-900">
                <span>残高</span><span className="font-mono">¥{balanceDoin.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 space-y-1">
              <p className="font-bold text-emerald-800 mb-1">スポ少</p>
              <div className="flex justify-between text-gray-600"><span>期首繰越</span><span className="font-mono">¥{initialSpo.toLocaleString()}</span></div>
              <div className="flex justify-between text-blue-600"><span>+ 収入</span><span className="font-mono">¥{incomeSpo.toLocaleString()}</span></div>
              <div className="flex justify-between text-rose-600"><span>− 支出</span><span className="font-mono">¥{expenseSpo.toLocaleString()}</span></div>
              <div className="pt-1 border-t border-emerald-200 flex justify-between font-bold text-emerald-900">
                <span>残高</span><span className="font-mono">¥{balanceSpo.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 最近の動き（入金＋支出 統合タイムライン） ─────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          最近の動き
          <span className="text-xs font-normal text-gray-400">（入金・支出 時系列 最新10件）</span>
        </h3>

        <div className="relative border-l-2 border-gray-100 ml-3 md:ml-4 space-y-5">
          {timelineItems.length === 0 && (
            <p className="text-gray-500 text-sm ml-4">表示する履歴がありません</p>
          )}

          {timelineItems.map((item, idx) => {
            if (item.kind === 'income') {
              const { tx, memberName } = item;
              const targetMonthLabel = fmtTargetMonth(tx.targetMonth);
              return (
                <div key={`inc-${tx.id}-${idx}`} className="relative pl-6">
                  <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm ${
                    tx.organization === '道院' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                    <div>
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="text-sm font-bold text-gray-900">{memberName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          tx.organization === '道院' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {tx.organization}
                        </span>
                        {targetMonthLabel && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                            {targetMonthLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{tx.item} · {tx.paymentMethod}</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <p className="text-sm font-bold text-blue-600">+ ¥{tx.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{tx.date}</p>
                    </div>
                  </div>
                </div>
              );
            } else {
              const { ex } = item;
              return (
                <div key={`exp-${ex.id}-${idx}`} className="relative pl-6">
                  <div className="absolute w-4 h-4 rounded-full -left-[9px] top-1 border-2 border-white shadow-sm bg-rose-400" />
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                    <div>
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">支出</span>
                        <span className="text-sm font-bold text-gray-900">{ex.category}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{ex.organization}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{ex.description} · {ex.paymentMethod}</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <p className="text-sm font-bold text-rose-600">− ¥{ex.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{ex.date}</p>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
};
