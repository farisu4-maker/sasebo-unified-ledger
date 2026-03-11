import React from 'react';
import { Member, Transaction, Expense, Budget } from '../types/index';

interface AuditReportProps {
  members: Member[];
  transactions: Transaction[];
  expenses: Expense[];
  budgets: Budget[];
  fiscalYear: number;
}

export const AuditReport: React.FC<AuditReportProps> = ({ 
  members, 
  transactions, 
  expenses, 
  budgets, 
  fiscalYear 
}) => {

  const handlePrint = () => {
    window.print();
  };

  // 個人別納入一覧のダミー年データの生成
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd = `${fiscalYear + 1}-03-31`;

  // 該当年度のデータに絞り込み、かつ未取消のもの
  const filterByFy = <T extends { date: string; isCancelled?: boolean }>(items: T[]): T[] => {
    return items.filter(item => item.date >= fyStart && item.date <= fyEnd && !item.isCancelled);
  };


  
  const currentTransactions = filterByFy(transactions);
  const currentExpenses = filterByFy(expenses);
  
  // 今年度の収入の計算
  const incomeDoin = currentTransactions.filter(tx => tx.organization === '道院').reduce((sum, tx) => sum + tx.amount, 0);
  const incomeSpo = currentTransactions.filter(tx => tx.organization === 'スポ少').reduce((sum, tx) => sum + tx.amount, 0);

  // 支出の計算 (両方所属の支出は按分)
  const expenseDoin = currentExpenses.filter(ex => ex.organization === '道院' || ex.organization === '両方').reduce((sum, ex) => sum + (ex.organization === '両方' ? ex.amount / 2 : ex.amount), 0);
  const expenseSpo = currentExpenses.filter(ex => ex.organization === 'スポ少' || ex.organization === '両方').reduce((sum, ex) => sum + (ex.organization === '両方' ? ex.amount / 2 : ex.amount), 0);

  // 前年度繰越（M_Budgetsの当該年度のinitialBalanceから取得）
  const prevBalanceDoin = budgets.filter((b) => (b.organization === '道院' || b.organization === '両方') && b.year === fiscalYear).reduce((sum, b) => sum + (b.initialBalance || 0), 0);
  const prevBalanceSpo = budgets.filter((b) => (b.organization === 'スポ少' || b.organization === '両方') && b.year === fiscalYear).reduce((sum, b) => sum + (b.initialBalance || 0), 0);

  // 乖離チェック
  const calcDoinBalance = prevBalanceDoin + incomeDoin - expenseDoin;
  const calcSpoBalance = prevBalanceSpo + incomeSpo - expenseSpo;

  const hasFinalBalanceDoin = budgets.some(b => (b.organization === '道院' || b.organization === '両方') && b.year === fiscalYear && b.finalBalance !== undefined);
  const finalDoinFromSheet = budgets.filter(b => (b.organization === '道院' || b.organization === '両方') && b.year === fiscalYear).reduce((sum, b) => sum + (b.finalBalance || 0), 0);

  const hasFinalBalanceSpo = budgets.some(b => (b.organization === 'スポ少' || b.organization === '両方') && b.year === fiscalYear && b.finalBalance !== undefined);
  const finalSpoFromSheet = budgets.filter(b => (b.organization === 'スポ少' || b.organization === '両方') && b.year === fiscalYear).reduce((sum, b) => sum + (b.finalBalance || 0), 0);

  let discrepancyAlert = null;
  if (hasFinalBalanceDoin && finalDoinFromSheet !== calcDoinBalance) {
    discrepancyAlert = `【道院】計算残高(${calcDoinBalance.toLocaleString()}円)と台帳残高(${finalDoinFromSheet.toLocaleString()}円)が不一致です。`;
  }
  if (hasFinalBalanceSpo && finalSpoFromSheet !== calcSpoBalance) {
    const spoMsg = `【スポ少】計算残高(${calcSpoBalance.toLocaleString()}円)と台帳残高(${finalSpoFromSheet.toLocaleString()}円)が不一致です。`;
    discrepancyAlert = discrepancyAlert ? `${discrepancyAlert} / ${spoMsg}` : spoMsg;
  }

  // （監査用集計エリア用データ等）


  // 人数サマリーの計算（年度）
  const calculateHeadcount = (org: '道院' | 'スポ少') => {
    const orgMembers = members.filter(m => m.organization === org || m.organization === '両方');
    
    // 期首人数：期首より前に加入し、かつ期首時点で脱退していない
    const opening = orgMembers.filter(m => m.joinDate < fyStart && (!m.leaveDate || m.leaveDate >= fyStart)).length;
    // 加入数：当期中に加入
    const joined = orgMembers.filter(m => m.joinDate >= fyStart && m.joinDate <= fyEnd).length;
    // 脱退数：当期中に脱退
    const left = orgMembers.filter(m => m.leaveDate && m.leaveDate >= fyStart && m.leaveDate <= fyEnd).length;
    // 期末人数：期末時点で在籍
    const closing = opening + joined - left;
    
    return { opening, joined, left, closing };
  };

  const headcounts = {
    doin: calculateHeadcount('道院'),
    spo: calculateHeadcount('スポ少')
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 printable-area">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; border: none; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>

      <div className="flex justify-between items-center mb-8 no-print">
        <h2 className="text-2xl font-bold text-gray-800">監査用レポート</h2>
        <button 
          onClick={handlePrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors text-sm flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          PDFで印刷・保存
        </button>
      </div>

      <div className="print-content space-y-16">
        
        {discrepancyAlert && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-center mb-6 no-print">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-bold text-red-700">{discrepancyAlert}</p>
          </div>
        )}

        {/* 人数サマリー */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="font-bold text-lg mb-4 text-gray-800">令和{(fiscalYear - 2018)}年度 拳士在籍概況</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-blue-800 mb-2 border-b border-blue-200">道院</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">期首人数: {headcounts.doin.opening}名</span>
                <span className="text-gray-600">当期加入: +{headcounts.doin.joined}名</span>
                <span className="text-gray-600">当期脱退: -{headcounts.doin.left}名</span>
                <span className="font-bold">期末（現在）人数: {headcounts.doin.closing}名</span>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-emerald-800 mb-2 border-b border-emerald-200">スポ少</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">期首人数: {headcounts.spo.opening}名</span>
                <span className="text-gray-600">当期加入: +{headcounts.spo.joined}名</span>
                <span className="text-gray-600">当期脱退: -{headcounts.spo.left}名</span>
                <span className="font-bold">期末（現在）人数: {headcounts.spo.closing}名</span>
              </div>
            </div>
          </div>
        </section>

        {/* 団体別収支報告書 */}
        <section>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold border-b-2 border-gray-800 pb-2 inline-block">令和{(fiscalYear - 2018)}年度 団体別収支報告書</h1>
          </div>
          <div className="grid grid-cols-2 gap-8">
            {/* 道院 */}
            <div>
              <h3 className="font-bold bg-blue-100 text-blue-900 p-2 text-center border border-blue-200">少林寺拳法佐世保道院</h3>
              <table className="w-full text-sm border-collapse border border-gray-400 mt-2">
                <tbody>
                  <tr><th className="border border-gray-400 p-1 bg-blue-50 w-1/2 text-left">前年度繰越金 (A)</th><td className="border border-gray-400 p-1 text-right font-bold">¥{prevBalanceDoin.toLocaleString()}</td></tr>
                  <tr><th className="border border-gray-400 p-1 bg-gray-50 text-left">本年度入金合計 (B)</th><td className="border border-gray-400 p-1 text-right">¥{incomeDoin.toLocaleString()}</td></tr>
                  <tr><th className="border border-gray-400 p-1 bg-gray-50 text-left">本年度支出合計 (C)</th><td className="border border-gray-400 p-1 text-right">¥{expenseDoin.toLocaleString()}</td></tr>
                  <tr><th className="border border-gray-400 p-1 bg-blue-100 text-left font-bold border-t-2">次年度繰越金 (A+B-C)</th><td className="border border-gray-400 p-1 text-right font-bold border-t-2 text-lg text-blue-900">¥{(prevBalanceDoin + incomeDoin - expenseDoin).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            
            {/* スポ少 */}
            <div>
              <h3 className="font-bold bg-emerald-100 text-emerald-900 p-2 text-center border border-emerald-200">佐世保西スポーツ少年団</h3>
              <table className="w-full text-sm border-collapse border border-gray-400 mt-2">
                <tbody>
                  <tr><th className="border border-gray-400 p-1 bg-emerald-50 w-1/2 text-left">前年度繰越金 (A)</th><td className="border border-gray-400 p-1 text-right font-bold">¥{prevBalanceSpo.toLocaleString()}</td></tr>
                  <tr><th className="border border-gray-400 p-1 bg-gray-50 text-left">本年度入金合計 (B)</th><td className="border border-gray-400 p-1 text-right">¥{incomeSpo.toLocaleString()}</td></tr>
                  <tr><th className="border border-gray-400 p-1 bg-gray-50 text-left">本年度支出合計 (C)</th><td className="border border-gray-400 p-1 text-right">¥{expenseSpo.toLocaleString()}</td></tr>
                  <tr><th className="border border-gray-400 p-1 bg-emerald-100 text-left font-bold border-t-2">次年度繰越金 (A+B-C)</th><td className="border border-gray-400 p-1 text-right font-bold border-t-2 text-lg text-emerald-900">¥{(prevBalanceSpo + incomeSpo - expenseSpo).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-16 flex justify-end space-x-16 pr-8">
            <div className="text-center">
              <p className="mb-8">上記のとおり相違ありません。</p>
              <p className="border-t border-gray-800 pt-1 w-48 mx-auto">道院長・代表者</p>
            </div>
            <div className="text-center">
              <p className="mb-8">上記を監査し、適正と認めます。</p>
              <p className="border-t border-gray-800 pt-1 w-48 mx-auto">監査役</p>
            </div>
          </div>
        </section>

        {/* 個人別年間納入明細表 */}
        <section className="break-before-page">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold border-b-2 border-gray-800 pb-2 inline-block">令和{(fiscalYear - 2018)}年度 個人別年間納入明細表</h1>
          </div>
          <table className="min-w-full text-center text-xs border border-gray-600">
            <thead className="bg-gray-100 border-b border-gray-600 font-bold">
              <tr>
                <th className="border-r border-gray-600 py-1 px-2 w-32">氏名 / 所属</th>
                <th className="border-r border-gray-600 py-1 px-1">年費</th>
                {months.map(m => (
                  <th key={m} className="border-r border-gray-600 py-1 px-1">{m}月</th>
                ))}
                <th className="py-1 px-2 font-bold">合計</th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 10).map((member, idx) => (
                <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-600 py-1 px-2 text-left font-medium">
                    {member.name} <span className="text-[10px] text-gray-500">({member.organization})</span>
                  </td>
                  <td className="border border-gray-600 py-1 px-1 text-gray-700">済</td>
                  {months.map(m => (
                    <td key={m} className={`border border-gray-600 py-1 px-1 text-gray-700 ${Math.random() > 0.8 ? 'text-red-500 font-bold' : ''}`}>
                      {Math.random() > 0.8 ? '未' : '済'}
                    </td>
                  ))}
                  <td className="border border-gray-600 py-1 px-2 font-bold">
                    ¥{(40000 + Math.floor(Math.random() * 10) * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
};
