import React, { useState } from 'react';
import { Member, Transaction, Expense, Budget } from '../types/index';
import { PaymentStatusMatrix } from './PaymentStatusMatrix';
import { sortMembers } from '../utils/memberSort';

interface AuditReportProps {
  members: Member[];
  transactions: Transaction[];
  expenses: Expense[];
  budgets: Budget[];
  fiscalYear: number;
}

type ReportTab = 'report' | 'matrix';

export const AuditReport: React.FC<AuditReportProps> = ({
  members,
  transactions,
  expenses,
  budgets,
  fiscalYear
}) => {
  const [reportTab, setReportTab] = useState<ReportTab>('report');

  const handlePrint = () => {
    window.print();
  };

  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd = `${fiscalYear + 1}-03-31`;

  // 該当年度のデータに絞り込み、かつ未取消のもの
  const filterByFy = <T extends { date: string; isCancelled?: boolean }>(items: T[]): T[] => {
    return items.filter(item => item.date >= fyStart && item.date <= fyEnd && !item.isCancelled);
  };

  const currentTransactions = filterByFy(transactions);
  const currentExpenses = filterByFy(expenses);

  // ── 収入集計（組織別、按分なし） ─────────────────────────
  const incomeDoin = currentTransactions
    .filter(tx => tx.organization === '道院')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const incomeSpo = currentTransactions
    .filter(tx => tx.organization === 'スポ少')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // ── 支出集計（道院/スポ少のみ） ──────────────────────────
  const expenseDoin = currentExpenses
    .filter(ex => ex.organization === '道院')
    .reduce((sum, ex) => sum + ex.amount, 0);
  const expenseSpo = currentExpenses
    .filter(ex => ex.organization === 'スポ少')
    .reduce((sum, ex) => sum + ex.amount, 0);

  // ── 前年度繰越（M_Budgetsの当該年度のinitialBalanceから取得） ─
  const prevBalanceDoin = budgets
    .filter(b => b.organization === '道院' && b.year === fiscalYear)
    .reduce((sum, b) => sum + (b.initialBalance || 0), 0);
  const prevBalanceSpo = budgets
    .filter(b => b.organization === 'スポ少' && b.year === fiscalYear)
    .reduce((sum, b) => sum + (b.initialBalance || 0), 0);

  // ── 乖離チェック ──────────────────────────────────────────
  const calcDoinBalance = prevBalanceDoin + incomeDoin - expenseDoin;
  const calcSpoBalance = prevBalanceSpo + incomeSpo - expenseSpo;

  const hasFinalBalanceDoin = budgets.some(
    b => b.organization === '道院' && b.year === fiscalYear && b.finalBalance !== undefined
  );
  const finalDoinFromSheet = budgets
    .filter(b => b.organization === '道院' && b.year === fiscalYear)
    .reduce((sum, b) => sum + (b.finalBalance || 0), 0);

  const hasFinalBalanceSpo = budgets.some(
    b => b.organization === 'スポ少' && b.year === fiscalYear && b.finalBalance !== undefined
  );
  const finalSpoFromSheet = budgets
    .filter(b => b.organization === 'スポ少' && b.year === fiscalYear)
    .reduce((sum, b) => sum + (b.finalBalance || 0), 0);

  let discrepancyAlert: string | null = null;
  if (hasFinalBalanceDoin && finalDoinFromSheet !== calcDoinBalance) {
    discrepancyAlert = `【道院】計算残高(${calcDoinBalance.toLocaleString()}円)と台帳残高(${finalDoinFromSheet.toLocaleString()}円)が不一致です。`;
  }
  if (hasFinalBalanceSpo && finalSpoFromSheet !== calcSpoBalance) {
    const spoMsg = `【スポ少】計算残高(${calcSpoBalance.toLocaleString()}円)と台帳残高(${finalSpoFromSheet.toLocaleString()}円)が不一致です。`;
    discrepancyAlert = discrepancyAlert ? `${discrepancyAlert} / ${spoMsg}` : spoMsg;
  }

  // ── 人数サマリー（M_Membersの実データを使用） ─────────────
  const calculateHeadcount = (org: '道院' | 'スポ少') => {
    // 「両方」は道院・スポ少両方にカウント
    const orgMembers = members.filter(m => m.organization === org || m.organization === '両方');
    const opening = orgMembers.filter(m => m.joinDate < fyStart && (!m.leaveDate || m.leaveDate >= fyStart)).length;
    const joined  = orgMembers.filter(m => m.joinDate >= fyStart && m.joinDate <= fyEnd).length;
    const left    = orgMembers.filter(m => m.leaveDate && m.leaveDate >= fyStart && m.leaveDate <= fyEnd).length;
    const closing = opening + joined - left;
    return { opening, joined, left, closing };
  };

  const headcounts = {
    doin: calculateHeadcount('道院'),
    spo: calculateHeadcount('スポ少')
  };

  // ── 個人別年間納入明細表 ────────────────────────────────
  // ポイント：現在の所属が「道院のみ」でも「スポ少に入金実績があれば」その行を追加
  //           → 過去実績の隠蔽を防ぐ
  type MemberRow = {
    key: string;
    memberId: string;
    name: string;
    org: '道院' | 'スポ少';
    isBoth: boolean;
    isFirstRow: boolean;
  };

  // 在籍（退会前）メンバーを役職→ID順でソート
  const activeMembers = sortMembers(
    members.filter(m => !m.leaveDate || m.leaveDate > fyStart)
  );

  // メンバーIDごとに今年度の入金実績のある団体セットを作成
  const txOrgsByMember = new Map<string, Set<'道院' | 'スポ少'>>();
  currentTransactions.forEach(tx => {
    if (!txOrgsByMember.has(tx.memberId)) {
      txOrgsByMember.set(tx.memberId, new Set());
    }
    txOrgsByMember.get(tx.memberId)!.add(tx.organization);
  });

  const memberRows: MemberRow[] = [];

  activeMembers.forEach(m => {
    // 现在の所属から行うべき団体セット
    const orgsFromMembership = new Set<'道院' | 'スポ少'>();
    if (m.organization === '道院' || m.organization === '両方') orgsFromMembership.add('道院');
    if (m.organization === 'スポ少' || m.organization === '両方') orgsFromMembership.add('スポ少');

    // 入金実績がある団体も追加（過去実績隠蔽防止）
    const txOrgs = txOrgsByMember.get(m.id) || new Set<'道院' | 'スポ少'>();
    txOrgs.forEach(org => orgsFromMembership.add(org));

    const orgsArray = Array.from(orgsFromMembership).sort(); // ['スポ少','道院'] or single
    const isBoth = orgsArray.length >= 2;

    orgsArray.forEach((org, idx) => {
      const key = isBoth ? `${m.id}_${org}` : m.id;
      memberRows.push({
        key,
        memberId: m.id,
        name: m.name,
        org,
        isBoth,
        isFirstRow: idx === 0,
      });
    });
  });

  // 月番号（年度順）から YYYY-MM 形式を取得
  const monthToYM = (m: number): string => {
    const y = m >= 4 ? fiscalYear : fiscalYear + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  // 月別・組織別の支払額を集計
  const getMemberMonthAmount = (memberId: string, org: '道院' | 'スポ少', month: number): number => {
    const ym = monthToYM(month);
    return currentTransactions
      .filter(tx => {
        const txOrg = tx.organization === org;
        const txMonth = tx.targetMonth ? tx.targetMonth === ym : tx.date.startsWith(ym);
        return tx.memberId === memberId && txOrg && txMonth;
      })
      .reduce((s, tx) => s + tx.amount, 0);
  };

  // 各行の月別金額と合計
  const rowData = memberRows.map(row => {
    const monthAmounts = months.map(m => getMemberMonthAmount(row.memberId, row.org, m));
    const total = monthAmounts.reduce((s, v) => s + v, 0);
    return { ...row, monthAmounts, total };
  });

  // 月別縦計（各月の全メンバー合計）
  const monthTotals = months.map((_, mi) => rowData.reduce((s, row) => s + row.monthAmounts[mi], 0));
  const grandTotal = rowData.reduce((s, row) => s + row.total, 0);

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 printable-area">

      {/* ── タブ切り替え ───────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 no-print">
        <button
          onClick={() => setReportTab('report')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            reportTab === 'report'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 収支報告書
        </button>
        <button
          onClick={() => setReportTab('matrix')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            reportTab === 'matrix'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ✅ 月別納入チェック表
        </button>
      </div>

      {/* ── 月別納入チェック表タブ ──────────────────── */}
      {reportTab === 'matrix' && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            令和{fiscalYear - 2018}年度 月別納入チェック表
          </h3>
          <PaymentStatusMatrix
            members={members}
            transactions={transactions}
            fiscalYear={fiscalYear}
          />
        </div>
      )}

      {/* ── 収支報告書タブ ───────────────────────── */}
      {reportTab === 'report' && (
      <div>
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
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PDFで印刷・保存
        </button>
      </div>

      <div className="print-content space-y-16">

        {discrepancyAlert && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-center mb-6 no-print">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-bold text-red-700">{discrepancyAlert}</p>
          </div>
        )}

        {/* 人数サマリー（M_Members 実データ） */}
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

        {/* 個人別年間納入明細表（T_Transactions実データ） */}
        <section className="break-before-page">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold border-b-2 border-gray-800 pb-2 inline-block">
              令和{(fiscalYear - 2018)}年度 個人別年間納入明細表
            </h1>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            ※役職→ID順で並べています。「両方」所属・過去実績がある拳士は道院・スポ少の各行に表示。金額はT_Transactionsの実績値。
          </p>
          <table className="min-w-full text-center text-xs border border-gray-600">
            <thead className="bg-gray-100 border-b border-gray-600 font-bold">
              <tr>
                <th className="border-r border-gray-600 py-1 px-2 w-36 text-left">氏名</th>
                <th className="border-r border-gray-600 py-1 px-2 w-12">所属</th>
                {months.map(m => (
                  <th key={m} className="border-r border-gray-600 py-1 px-1">{m}月</th>
                ))}
                <th className="py-1 px-2 font-bold">合計</th>
              </tr>
            </thead>
            <tbody>
              {rowData.map((row, idx) => {
                // 「両方」の場合: isFirstRow=true（最初の組織行）のみ氏名セルを rowSpan=2 で描画
                const nameCellContent = row.isBoth && row.isFirstRow ? (
                  <td
                    rowSpan={2}
                    className="border border-gray-600 py-1 px-2 text-left font-medium align-middle"
                  >
                    {row.name}
                    <span className="block text-[10px] font-normal text-purple-600">両方</span>
                  </td>
                ) : !row.isBoth ? (
                  <td className="border border-gray-600 py-1 px-2 text-left font-medium">
                    {row.name}
                  </td>
                ) : null; // 「両方」2行目は氏名セルなし（rowSpanで結合済）

                return (
                  <tr key={row.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {nameCellContent}
                    <td className={`border border-gray-600 py-1 px-2 text-[10px] font-normal ${
                      row.org === '道院' ? 'text-blue-600' : 'text-emerald-600'
                    }`}>{row.org}</td>
                    {row.monthAmounts.map((amt, mi) => (
                      <td key={mi} className={`border border-gray-600 py-1 px-1 ${
                        amt > 0 ? 'text-gray-900 font-medium' : 'text-gray-300'
                      }`}>
                        {amt > 0 ? `¥${amt.toLocaleString()}` : '―'}
                      </td>
                    ))}
                    <td className="border border-gray-600 py-1 px-2 font-bold">
                      {row.total > 0 ? `¥${row.total.toLocaleString()}` : '―'}
                    </td>
                  </tr>
                );
              })}
              {/* 月別縦計行 */}
              <tr className="bg-gray-200 font-bold border-t-2 border-gray-600">
                <td className="border border-gray-600 py-1 px-2 text-left" colSpan={2}>各月 合計</td>
                {monthTotals.map((total, mi) => (
                  <td key={mi} className="border border-gray-600 py-1 px-1 text-gray-900">
                    {total > 0 ? `¥${total.toLocaleString()}` : '―'}
                  </td>
                ))}
                <td className="border border-gray-600 py-1 px-2 text-gray-900">
                  {grandTotal > 0 ? `¥${grandTotal.toLocaleString()}` : '―'}
                </td>
              </tr>
            </tbody>
          </table>
          {rowData.length === 0 && (
            <p className="text-sm text-gray-500 mt-4 text-center">対象期間の在籍拳士データがありません。</p>
          )}
        </section>

      </div>
      )}
    </div>
  );
};
