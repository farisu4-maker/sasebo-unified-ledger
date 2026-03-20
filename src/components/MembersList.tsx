import React, { useState } from 'react';
import { Member, Organization } from '../types';
import { parseJapaneseDate } from '../utils/dateParser';
import { sortMembers } from '../utils/memberSort';
import { GoogleSheetsService } from '../services/GoogleSheetsService';

interface MembersListProps {
  members: Member[];
  onSelectMember: (member: Member) => void;
  onMemberUpdate: (member: Member) => void;
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
  members, onSelectMember, onMemberUpdate
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJoinDate, setEditJoinDate] = useState('');
  const [editLeaveDate, setEditLeaveDate] = useState('');
  const [editOrg, setEditOrg] = useState<Organization>('道院');
  const [dateError, setDateError] = useState<string | null>(null);

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
                    <th scope="col" className="px-3 py-2 border border-gray-300">ID</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">氏名 / 年齢</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">役職</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">所属</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">加入日 / 脱退日</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">ステータス</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300">備考</th>
                    <th scope="col" className="px-3 py-2 border border-gray-300 no-print">アクション</th>
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
                  {/* ID */}
                  <td className="px-3 py-2 border border-gray-300 text-gray-900 font-medium">{member.id}</td>

                  {/* 氏名 + ヨミガナ + 年齢 */}
                  <td className="px-3 py-2 border border-gray-300">
                    <div className={`font-bold text-base ${!isActive ? 'text-gray-400' : 'text-gray-900'}`}>{member.name}</div>
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
                  <td className="px-3 py-2 border border-gray-300 text-xs">
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
                          className="border border-gray-300 rounded px-2 py-1 w-44 text-xs focus:ring-rose-500 focus:border-rose-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-0.5 text-gray-600">
                        <div>加入: <span className="font-medium">{member.joinDate}</span></div>
                        {member.leaveDate && (
                          <div className="text-rose-600">脱退: <span className="font-medium">{member.leaveDate}</span></div>
                        )}
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

                  {/* アクション */}
                  <td className="px-3 py-2 border border-gray-300 no-print">
                    {isEditing ? (
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => commitEdit(member)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-1 px-2 rounded shadow-sm transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium py-1 px-2 rounded shadow-sm transition-colors"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
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
                          onClick={() => startEdit(member)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-1 px-2 rounded-md shadow-sm transition-colors text-xs flex items-center"
                          title="加入日・脱退日・所属を編集"
                        >
                          <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          編集
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
