import React, { useState } from 'react';
import { Member, Transaction } from '../types';
import { sortMembers } from '../utils/memberSort';

interface PaymentStatusMatrixProps {
  members: Member[];
  transactions: Transaction[];
  fiscalYear: number;
  org: '道院' | 'スポ少';
  onTransactionUpdate?: (updated: Transaction) => void | Promise<void>;
}

/** 月別 YYYY-MM 文字列を生成（4月始まり） */
function ym(fiscalYear: number, month: number): string {
  const y = month >= 4 ? fiscalYear : fiscalYear + 1;
  return `${y}-${String(month).padStart(2, '0')}`;
}

const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

/** 会費として集計対象とする費目キーワード */
const FEE_KEYWORDS = ['信徒香資', 'スポ少会費', '前年度未納分回収'];

function isFeeItem(item: string): boolean {
  return FEE_KEYWORDS.some(kw => item.includes(kw));
}



export const PaymentStatusMatrix: React.FC<PaymentStatusMatrixProps> = ({
  members,
  transactions,
  fiscalYear,
  org,
  onTransactionUpdate
}) => {
  const activeOrg = org;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number | ''>('');

  const handleEditClick = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditAmount(tx.amount);
  };

  const handleSave = (tx: Transaction) => {
    if (editAmount !== '' && typeof editAmount === 'number' && editAmount !== tx.amount && onTransactionUpdate) {
      onTransactionUpdate({ ...tx, amount: editAmount });
    }
    setEditingId(null);
  };

  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd   = `${fiscalYear + 1}-03-31`;

  // 当年度かつ未取消の入金だけ
  const fyTx = transactions.filter(
    tx => !tx.isCancelled && tx.date >= fyStart && tx.date <= fyEnd
  );

  // 現役かつ対象組織の拳士（退会者は除外、「両方」は両方に含める）
  const targetMembers = sortMembers(
    members.filter(m => {
      if (m.leaveDate && m.leaveDate <= fyEnd) return false; // 年度中に退会済みは表示しない
      return m.organization === activeOrg || m.organization === '両方';
    })
  );

  // member × month → 入金情報を取得
  const getPayment = (memberId: string, month: number) => {
    const targetYm = ym(fiscalYear, month);
    return fyTx.find(tx =>
      tx.memberId === memberId &&
      tx.organization === activeOrg &&
      isFeeItem(tx.item) &&
      (tx.targetMonth ? tx.targetMonth === targetYm : tx.date.startsWith(targetYm))
    );
  };

  // 各行の合計納入額
  const rowTotal = (memberId: string) =>
    MONTHS.reduce((sum, m) => {
      const tx = getPayment(memberId, m);
      return sum + (tx ? tx.amount : 0);
    }, 0);

  const orgLabel = activeOrg === '道院' ? '道院（信徒香資）' : 'スポ少（会費）';

  return (
    <div className="space-y-4">


      <div className="text-xs text-gray-500 mb-1">
        ※ 費目「{orgLabel}」および「前年度未納分回収」が対象。
        <span className="ml-3">
          <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-500 mr-1 align-middle" />済
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300 mr-1 ml-2 align-middle" />未納
          <span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300 mr-1 ml-2 align-middle" />対象外
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className={`${activeOrg === '道院' ? 'bg-blue-50' : 'bg-emerald-50'} border-b border-gray-300`}>
              <th className="py-2 px-3 text-left font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-inherit z-10 min-w-[130px]">
                氏名（役職）
              </th>
              {MONTHS.map(m => (
                <th key={m} className="py-2 px-2 text-center font-bold text-gray-600 border-r border-gray-200 min-w-[52px]">
                  {m}月
                </th>
              ))}
              <th className="py-2 px-3 text-right font-bold text-gray-700 min-w-[80px]">合計</th>
            </tr>
          </thead>
          <tbody>
            {targetMembers.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-8 text-center text-gray-400">
                  対象拳士がいません。
                </td>
              </tr>
            ) : targetMembers.map((member, idx) => (
              <tr
                key={member.id}
                className={`border-b border-gray-100 print:break-inside-avoid ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                {/* 氏名列 */}
                <td className="py-2 px-3 border-r border-gray-200 sticky left-0 bg-inherit z-10">
                  <div className="font-medium text-gray-800">{member.name}</div>
                  {member.role && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded">
                      {member.role}
                    </span>
                  )}
                  <div className="text-[10px] text-gray-400">{member.id}</div>
                </td>

                {/* 月別セル */}
                {MONTHS.map(m => {
                  const tx = getPayment(member.id, m);
                  const targetYm = ym(fiscalYear, m);
                  // その月が年度範囲内かどうか
                  const inFy = targetYm >= `${fiscalYear}-04` && targetYm <= `${fiscalYear + 1}-03`;
                  if (!inFy) {
                    return (
                      <td key={m} className="py-2 px-1 text-center border-r border-gray-100 bg-gray-100 text-gray-300">
                        ―
                      </td>
                    );
                  }
                  if (tx) {
                    if (editingId === tx.id) {
                      return (
                        <td key={m} className="py-1 px-1 text-center border-r border-gray-100 bg-green-50">
                          <input
                            type="number"
                            className="w-full min-w-[40px] text-center text-[10px] border border-green-400 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            onBlur={() => handleSave(tx)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSave(tx);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={m}
                        className="py-1 px-1 text-center border-r border-gray-100 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                        title={`${tx.date} 入金: ¥${tx.amount.toLocaleString()} (クリックで修正)`}
                        onClick={() => handleEditClick(tx)}
                      >
                        <span className="inline-flex items-center justify-center w-full">
                          <span className="bg-green-200 text-green-800 font-bold text-[10px] px-1.5 py-0.5 rounded-full border border-green-400">
                            済
                          </span>
                        </span>
                        <div className="text-[9px] text-green-700 mt-1 leading-none font-mono tracking-tighter">
                          ¥{tx.amount.toLocaleString()}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={m}
                      className="py-2 px-1 text-center border-r border-gray-100 bg-red-50"
                    >
                      <span className="text-red-400 font-bold text-[11px]">✕</span>
                    </td>
                  );
                })}

                {/* 合計 */}
                <td className="py-2 px-3 text-right font-mono font-semibold text-gray-700">
                  {rowTotal(member.id) > 0
                    ? `¥${rowTotal(member.id).toLocaleString()}`
                    : <span className="text-gray-300 text-[10px]">未納</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <p className="text-[10px] text-gray-400">
        ※ 対象月は targetMonth（何月分会費か）を優先し、未設定の場合は入金日の月で判定します。
      </p>
    </div>
  );
};
