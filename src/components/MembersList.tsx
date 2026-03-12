import React, { useState } from 'react';
import { Member } from '../types';

interface MembersListProps {
  members: Member[];
  onSelectMember: (member: Member) => void;
  onQuickEntry: (member: Member) => void;
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

/** joinDate / leaveDate から表示ステータスを動的計算 */
function calcStatus(member: Member): { label: string; color: string } {
  const today = new Date().toISOString().split('T')[0];
  if (member.leaveDate && member.leaveDate <= today) {
    return { label: '退会済', color: 'bg-gray-200 text-gray-600' };
  }
  if (member.leaveDate && member.leaveDate > today) {
    return { label: `退会予定 (${member.leaveDate})`, color: 'bg-yellow-100 text-yellow-800' };
  }
  if (member.status === '休眠') {
    return { label: '休眠', color: 'bg-orange-100 text-orange-700' };
  }
  return { label: '現役', color: 'bg-green-100 text-green-800' };
}

export const MembersList: React.FC<MembersListProps> = ({
  members, onSelectMember, onQuickEntry, onMemberUpdate
}) => {
  // インライン編集中のメンバーID管理
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJoinDate, setEditJoinDate] = useState('');
  const [editLeaveDate, setEditLeaveDate] = useState('');

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditJoinDate(member.joinDate || '');
    setEditLeaveDate(member.leaveDate || '');
  };

  const cancelEdit = () => setEditingId(null);

  const commitEdit = (member: Member) => {
    const updated: Member = {
      ...member,
      joinDate: editJoinDate,
      leaveDate: editLeaveDate || undefined,
      // 日付から status を自動補正
      status: editLeaveDate && editLeaveDate <= new Date().toISOString().split('T')[0]
        ? '退会'
        : member.status === '退会'
          ? '現役'   // leaveDate を消した場合は現役に戻す
          : member.status
    };
    onMemberUpdate(updated);
    setEditingId(null);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">拳士一覧</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 border-x">ID</th>
              <th scope="col" className="px-4 py-3 border-x">氏名 / 年齢</th>
              <th scope="col" className="px-4 py-3 border-x">所属</th>
              <th scope="col" className="px-4 py-3 border-x">加入日 / 脱退日</th>
              <th scope="col" className="px-4 py-3 border-x">ステータス</th>
              <th scope="col" className="px-4 py-3 border-x">備考</th>
              <th scope="col" className="px-4 py-3 border-x">アクション</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const age = member.birthDate ? calcAge(member.birthDate) : null;
              const status = calcStatus(member);
              const isEditing = editingId === member.id;
              const isActive = status.label === '現役';

              return (
                <tr
                  key={member.id}
                  className={`border-b transition-colors ${
                    isActive ? 'hover:bg-indigo-50' : 'bg-gray-50 opacity-80 hover:bg-gray-100'
                  }`}
                >
                  {/* ID */}
                  <td className="px-4 py-3 border-x text-gray-500 text-xs">{member.id}</td>

                  {/* 氏名 + 年齢 */}
                  <td className="px-4 py-3 border-x font-semibold text-gray-800">
                    <div className={!isActive ? 'line-through text-gray-400' : ''}>{member.name}</div>
                    <span className="block text-xs font-normal text-gray-400">{member.kana}</span>
                    {age !== null && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-indigo-600 font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {age}歳（本日時点）
                      </span>
                    )}
                  </td>

                  {/* 所属 */}
                  <td className="px-4 py-3 border-x">
                    <div className="flex items-center space-x-1">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.organization === '道院'   ? 'bg-blue-100 text-blue-800' :
                        member.organization === 'スポ少'  ? 'bg-emerald-100 text-emerald-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {member.organization}
                      </span>
                    </div>
                  </td>

                  {/* 加入日 / 脱退日（インライン編集） */}
                  <td className="px-4 py-3 border-x text-xs">
                    {isEditing ? (
                      <div className="space-y-1">
                        <label className="block text-gray-500">加入日</label>
                        <input
                          type="date"
                          value={editJoinDate}
                          onChange={e => setEditJoinDate(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-36 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <label className="block text-gray-500 mt-1">脱退日</label>
                        <input
                          type="date"
                          value={editLeaveDate}
                          onChange={e => setEditLeaveDate(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-36 text-xs focus:ring-rose-500 focus:border-rose-500"
                          placeholder="脱退予定なし"
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
                  <td className="px-4 py-3 border-x">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
                      {status.label}
                    </span>
                    {member.exemptionFlag && (
                      <span className="ml-1 text-red-500 text-xs font-bold border border-red-400 rounded px-1">免除</span>
                    )}
                  </td>

                  {/* 備考 */}
                  <td className="px-4 py-3 border-x text-xs text-gray-500 max-w-xs truncate" title={member.notes}>
                    {member.notes}
                  </td>

                  {/* アクション */}
                  <td className="px-4 py-3 border-x">
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
                            onClick={() => onQuickEntry(member)}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-2 rounded-md shadow-sm transition-colors text-xs flex items-center"
                            title="当月分の基本会費をワンタップで現金納入記録"
                          >
                            <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            クイック
                          </button>
                        )}
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
                          title="加入日・脱退日を編集"
                        >
                          <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          日付編集
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
  );
};
