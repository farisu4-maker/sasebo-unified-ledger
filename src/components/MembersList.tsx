import React, { useState } from 'react';
import { Member, Organization, Transaction } from '../types';
import { parseJapaneseDate } from '../utils/dateParser';
import { sortMembers } from '../utils/memberSort';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

interface MembersListProps {
  members: Member[];
  transactions: Transaction[];
  fiscalYear: number;
  onSelectMember: (member: Member) => void;
  onMemberUpdate: (member: Member) => void;
  onTransactionUpdate?: (id: string, newAmount: number) => void;
}

/** birthDate (YYYY-MM-DD) → 本日時点の満年齢 */
function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * ステータス判定：leaveDate に過去の日付があれば「退会」、それ以外は「現役」
 */
function calcStatus(member: Member): { label: string; color: string } {
  if (member.leaveDate && member.leaveDate.trim() !== '') {
    const today = new Date().toISOString().split('T')[0];
    if (member.leaveDate <= today) {
      return { label: '退会', color: 'bg-gray-200 text-gray-600' };
    }
    return { label: '現役', color: 'bg-green-100 text-green-800' };
  }
  return { label: '現役', color: 'bg-green-100 text-green-800' };
}

const ORG_OPTIONS: Organization[] = ['道院', 'スポ少', '両方'];

export const MembersList: React.FC<MembersListProps> = ({
  members, transactions, fiscalYear, onSelectMember, onMemberUpdate, onTransactionUpdate
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJoinDate, setEditJoinDate] = useState('');
  const [editLeaveDate, setEditLeaveDate] = useState('');
  const [editOrg, setEditOrg] = useState<Organization>('道院');
  const [dateError, setDateError] = useState<string | null>(null);

  const [historyModalMember, setHistoryModalMember] = useState<Member | null>(null);
  const [txEditingId, setTxEditingId] = useState<string | null>(null);
  const [txEditAmount, setTxEditAmount] = useState<number | ''>('');

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditJoinDate(member.joinDate || '');
    setEditLeaveDate(member.leaveDate || '');
    setEditOrg(member.organization as Organization);
    setDateError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDateError(null);
  };

  const commitEdit = async (member: Member) => {
    // 日付を自動変換
    const parsedJoin = parseJapaneseDate(editJoinDate);
    if (!parsedJoin) {
      setDateError(`加入日「${editJoinDate}」の形式が認識できません。例：R7.4.20 / 2025/04/20`);
      return;
    }

    let parsedLeave: string | undefined = undefined;
    if (editLeaveDate.trim() !== '') {
      const pl = parseJapaneseDate(editLeaveDate);
      if (!pl) {
        setDateError(`脱退日「${editLeaveDate}」の形式が認識できません。例：R7.4.20 / 2025/04/20`);
        return;
      }
      parsedLeave = pl;
    }

    const updated: Member = {
      ...member,
      joinDate: parsedJoin,
      leaveDate: parsedLeave,
      organization: editOrg,
      status: parsedLeave ? '退会' : '現役',
    };
    onMemberUpdate(updated);
    await GoogleSheetsService.updateMember(updated);
    setEditingId(null);
    setDateError(null);
  };

  const sorted = sortMembers(members);

  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd = `${fiscalYear + 1}-03-31`;
  const memberTransactions = historyModalMember
    ? transactions.filter(t => t.memberId === historyModalMember.id && !t.isCancelled && t.date >= fyStart && t.date <= fyEnd).sort((a,b) => b.date.localeCompare(a.date))
    : [];

  const handleTxEditClick = (tx: Transaction) => {
    setTxEditingId(tx.id);
    setTxEditAmount(tx.amount);
  };
  
  const handleTxSave = (tx: Transaction) => {
    if (txEditAmount !== '' && typeof txEditAmount === 'number' && txEditAmount !== tx.amount && onTransactionUpdate) {
      onTransactionUpdate(tx.id, txEditAmount);
    }
    setTxEditingId(null);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4 no-print">
        <h2 className="text-xl font-bold text-gray-800">拳士一覧</h2>
        <button
          onClick={() => window.print()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-4 rounded-md shadow-sm transition-colors text-sm flex items-center justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PDFで印刷・保存
        </button>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-members, .printable-members * { visibility: visible; }
          .printable-members { position: absolute; left: 0; top: 0; width: 100%; padding: 0; border: none; box-shadow: none; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
      <div className="printable-members space-y-12">
        {(['道院', 'スポ少'] as const).map((org, orgIdx) => (
          <div key={org} className={orgIdx > 0 ? "print:break-before-page break-before-page" : ""}>
            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-gray-300 pb-1 inline-block">拳士一覧（{org === '道院' ? '少林寺拳法佐世保道院' : '佐世保西スポーツ少年団'}）</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs md:text-sm whitespace-nowrap bg-white border border-gray-300">
                <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 border border-gray-300">氏名 / 年齢 / ID</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300 no-print">アクション</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">役職</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">所属</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">加入日 / 脱退日</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">ステータス</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.filter(m => m.organization === org || m.organization === '両方').map((member) => {
              const age = member.birthDate ? calcAge(member.birthDate) : null;
              const status = calcStatus(member);
              const isEditing = editingId === member.id;
              const isActive = status.label === '現役';

              return (
                <tr
                  key={member.id}
                  className={`border-b transition-colors print:break-inside-avoid ${
                    isActive ? 'hover:bg-indigo-50' : 'bg-gray-50 opacity-80 hover:bg-gray-100'
                  }`}
                >
                  {/* 氏名 + ID + ヨミガナ + 年齢 */}
                  <td className="px-3 py-2 border border-gray-300">
                    <div className="flex items-baseline gap-2">
                      <div className={`font-bold text-base ${!isActive ? 'text-gray-400' : 'text-gray-900'}`}>{member.name}</div>
                      <span className="text-xs text-gray-500 font-mono">ID: {member.id}</span>
                    </div>
                    {(member.yomigana || member.kana) && (
                      <span className="block text-xs font-normal text-gray-400 tracking-wider">
                        {member.yomigana || member.kana}
                      </span>
                    )}
                    {age !== null && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 text-sm text-indigo-600 font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {age}歳（本日時点）
                      </span>
                    )}
                  </td>

                  {/* アクション */}
                  <td className="px-3 py-2 border border-gray-300 no-print">
                      <div className="flex gap-1 flex-wrap">
                        {isActive && (
                          <button
                            onClick={() => onSelectMember(member)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-2 rounded-md shadow-sm transition-colors text-xs"
                          >
                            入金
                          </button>
                        )}
                        <button
                          onClick={() => setHistoryModalMember(member)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-2 rounded-md shadow-sm transition-colors text-xs flex items-center"
                        >
                          入金履歴
                        </button>
                      </div>
                  </td>

                  {/* 役職 */}
                  <td className="px-3 py-2 border border-gray-300 text-xs">
                    {member.role ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        {member.role}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">―</span>
                    )}
                  </td>

                  {/* 所属（編集時はドロップダウン） */}
                  <td className="px-3 py-2 border border-gray-300">
                    {isEditing ? (
                      <select
                        value={editOrg}
                        onChange={e => setEditOrg(e.target.value as Organization)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {ORG_OPTIONS.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          member.organization === '道院'   ? 'bg-blue-100 text-blue-800' :
                          member.organization === 'スポ少'  ? 'bg-emerald-100 text-emerald-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {member.organization}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* 加入日 / 脱退日（インライン編集） */}
                  <td className="px-3 py-2 border border-gray-300 text-xs text-gray-600 relative">
                    {isEditing ? (
                      <div className="space-y-1">
                        {dateError && (
                          <p className="text-red-600 text-xs font-bold mb-1">{dateError}</p>
                        )}
                        <label className="block text-gray-500">加入日</label>
                        <input
                          type="text"
                          value={editJoinDate}
                          onChange={e => setEditJoinDate(e.target.value)}
                          placeholder="R7.4.20 / 2025/04/20 / 2025-04-20"
                          className="border border-gray-300 rounded px-2 py-1 w-44 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <label className="block text-gray-500 mt-1">脱退日</label>
                        <input
                          type="text"
                          value={editLeaveDate}
                          onChange={e => setEditLeaveDate(e.target.value)}
                          placeholder="脱退なしは空欄"
                          className="border border-gray-300 rounded px-2 py-1 w-44 text-xs focus:ring-rose-500 focus:border-rose-500 mb-2"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => commitEdit(member)} className="bg-indigo-600 text-white px-2 py-1 rounded">保存</button>
                          <button onClick={cancelEdit} className="bg-gray-200 text-gray-700 px-2 py-1 rounded">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div>加入: <span className="font-medium">{member.joinDate}</span></div>
                          {member.leaveDate && (
                            <div className="text-rose-600">脱退: <span className="font-medium">{member.leaveDate}</span></div>
                          )}
                        </div>
                        <button
                          onClick={() => startEdit(member)}
                          className="text-amber-600 hover:text-amber-800 p-1 no-print"
                          title="編集"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>

                  {/* ステータス */}
                  <td className="px-3 py-2 border border-gray-300">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
                      {status.label}
                    </span>
                    {member.exemptionFlag && (
                      <span className="ml-1 text-red-500 text-xs font-bold border border-red-400 rounded px-1">免除</span>
                    )}
                  </td>

                  {/* 備考 */}
                  <td className="px-3 py-2 border border-gray-300 text-xs text-gray-500 max-w-xs truncate" title={member.notes}>
                    {member.notes}
                  </td>

                  {/* 備考 ends here, Action previously was here */}
                </tr>
              );
            })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* 入金履歴モーダル */}
      {historyModalMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg text-gray-800">
                {historyModalMember.name} さんの入金履歴 ({fiscalYear}年度)
              </h3>
              <button
                onClick={() => setHistoryModalMember(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              {memberTransactions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">今年度の入金履歴はありません。</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="py-2 px-3 text-left">日付</th>
                      <th className="py-2 px-3 text-left">対象月</th>
                      <th className="py-2 px-3 text-left">費目</th>
                      <th className="py-2 px-3 text-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberTransactions.map(tx => (
                      <tr key={tx.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 whitespace-nowrap">{tx.date}</td>
                        <td className="py-2 px-3">{tx.targetMonth || '-'}</td>
                        <td className="py-2 px-3">{tx.item}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-indigo-700">
                          {txEditingId === tx.id ? (
                            <div className="flex justify-end gap-1">
                              <input
                                type="number"
                                className="w-20 border rounded px-1 text-right text-sm"
                                value={txEditAmount}
                                onChange={e => setTxEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                onBlur={() => handleTxSave(tx)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleTxSave(tx);
                                  if (e.key === 'Escape') setTxEditingId(null);
                                }}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span 
                              className="cursor-pointer hover:bg-indigo-50 px-1 rounded transition-colors"
                              onClick={() => handleTxEditClick(tx)}
                              title="クリックで編集"
                            >
                              ¥{tx.amount.toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
