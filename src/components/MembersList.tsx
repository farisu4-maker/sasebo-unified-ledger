import React, { useState, useMemo } from 'react';
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
  onMemberAdd: (member: Member) => void;
  onTransactionUpdate?: (updated: Transaction) => void | Promise<void>;
}

/** birthDate (YYYY-MM-DD) → 本日時点の満年齢 */
function calcAge(birthDate: string): number {
  if (!birthDate) return NaN;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * ステータス判定：leaveDate に過去の日付があれば「退会」、それ以外は member.status を優先
 */
function calcStatus(member: Member): { label: string; color: string } {
  if (member.status === '休眠') {
    return { label: '休眠', color: 'bg-amber-100 text-amber-800' };
  }
  if (member.leaveDate && member.leaveDate.trim() !== '') {
    const today = new Date().toISOString().split('T')[0];
    if (member.leaveDate <= today || member.status === '退会') {
      return { label: '退会', color: 'bg-gray-200 text-gray-600' };
    }
  }
  if (member.status === '退会') {
    return { label: '退会', color: 'bg-gray-200 text-gray-600' };
  }
  return { label: '現役', color: 'bg-green-100 text-green-800' };
}

const ORG_OPTIONS: Organization[] = ['道院', 'スポ少', '両方'];
const STATUS_OPTIONS = ['現役', '休眠', '退会'];

export const MembersList: React.FC<MembersListProps> = ({
  members, transactions, fiscalYear, onSelectMember, onMemberUpdate, onMemberAdd, onTransactionUpdate
}) => {
  // 絞り込みフィルター状態
  const [showActive, setShowActive] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // 編集・追加モーダル状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Partial<Member> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 履歴モーダル・インライン編集状態
  type SortConfig = { key: 'date' | 'targetMonth' | 'item' | 'amount'; direction: 'asc' | 'desc' } | null;
  const [historyModalMember, setHistoryModalMember] = useState<Member | null>(null);
  const [txEditingId, setTxEditingId] = useState<string | null>(null);
  const [txEditAmount, setTxEditAmount] = useState<number | ''>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // === メンバー編集・追加処理 ===
  const handleOpenAddModal = () => {
    setEditingMember({
      id: `M${Date.now()}`,
      name: '',
      kana: '',
      yomigana: '',
      role: '',
      birthDate: '',
      joinDate: new Date().toISOString().split('T')[0],
      leaveDate: '',
      organization: '道院',
      status: '現役',
      exemptionFlag: false,
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setEditingMember({ ...member });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;
    
    // 必須入力チェック
    if (!editingMember.name?.trim()) {
      setFormError('氏名は必須です。');
      return;
    }

    // 日付変換（和暦等の自動変換）
    const parsedJoin = parseJapaneseDate(editingMember.joinDate || '');
    if (!parsedJoin) {
      setFormError(`加入日の形式が認識できません。`);
      return;
    }

    let parsedLeave: string | undefined = undefined;
    if (editingMember.leaveDate && editingMember.leaveDate.trim() !== '') {
      const pl = parseJapaneseDate(editingMember.leaveDate);
      if (!pl) {
        setFormError(`脱退日の形式が認識できません。`);
        return;
      }
      parsedLeave = pl;
    }

    const memberToSave = {
      ...editingMember,
      joinDate: parsedJoin,
      leaveDate: parsedLeave,
      // 自動ステータス補正: 脱退日があれば退会（ユーザーが手動で退会にした場合も尊重）
      status: (parsedLeave && parsedLeave <= new Date().toISOString().split('T')[0]) ? '退会' : (editingMember.status || '現役'),
    } as Member;

    // 新規か更新かの判定
    const isNew = !members.find(m => m.id === memberToSave.id);
    
    if (isNew) {
      onMemberAdd(memberToSave);
      // Sheets同期はApp.tsx側で行う
    } else {
      onMemberUpdate(memberToSave);
      await GoogleSheetsService.updateMember(memberToSave);
    }
    
    handleCloseModal();
  };

  // === 論理削除（退会処理） ===
  const handleDeleteMember = async (member: Member) => {
    if (!window.confirm(`${member.name} さんを退会処理しますか？\n（脱退日として本日の日付がセットされます）`)) return;

    const todayDate = new Date().toISOString().split('T')[0];
    const updated: Member = {
      ...member,
      leaveDate: todayDate,
      status: '退会'
    };
    onMemberUpdate(updated);
    await GoogleSheetsService.updateMember(updated);
  };

  // === 一覧のフィルタリングとソート ===
  const filteredAndSorted = useMemo(() => {
    let filtered = members.filter(m => {
      const st = calcStatus(m).label;
      if (st === '現役' && !showActive) return false;
      if ((st === '退会' || st === '休眠') && !showInactive) return false;
      return true;
    });
    return sortMembers(filtered);
  }, [members, showActive, showInactive]);

  // === 履歴モーダル関連処理 ===
  const fyStart = `${fiscalYear}-04-01`;
  const fyEnd = `${fiscalYear + 1}-03-31`;
  const baseTransactions = historyModalMember
    ? transactions.filter(t => t.memberId === historyModalMember.id && !t.isCancelled && t.date >= fyStart && t.date <= fyEnd)
    : [];

  const memberTransactions = [...baseTransactions].sort((a, b) => {
    if (sortConfig) {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.targetMonth || '').localeCompare(b.targetMonth || '');
  });

  const handleSort = (key: 'date' | 'targetMonth' | 'item' | 'amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleTxEditClick = (tx: Transaction) => {
    setTxEditingId(tx.id);
    setTxEditAmount(tx.amount);
  };
  
  const handleTxSave = (tx: Transaction) => {
    if (txEditAmount !== '' && typeof txEditAmount === 'number' && txEditAmount !== tx.amount && onTransactionUpdate) {
      onTransactionUpdate({ ...tx, amount: txEditAmount });
    }
    setTxEditingId(null);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      {/* 画面ヘッダ・コントロール */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800">拳士一覧</h2>
          
          {/* 追加ボタン */}
          <button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors text-sm flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規拳士を追加
          </button>
        </div>

        {/* フィルタと印刷 */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <span className="text-sm font-bold text-gray-600">表示対象:</span>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showActive} 
                onChange={e => setShowActive(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500" 
              />
              <span className="text-sm text-gray-700">現役</span>
            </label>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showInactive} 
                onChange={e => setShowInactive(e.target.checked)}
                className="rounded text-gray-600 focus:ring-gray-500" 
              />
              <span className="text-sm text-gray-700">退会・休眠</span>
            </label>
          </div>

          <button
            onClick={() => window.print()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-4 rounded-md shadow-sm transition-colors text-sm flex items-center border border-gray-300"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF印刷
          </button>
        </div>
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

      {/* テーブル本体 */}
      <div className="printable-members space-y-12">
        {(['道院', 'スポ少'] as const).map((org, orgIdx) => {
          const orgMembers = filteredAndSorted.filter(m => m.organization === org || m.organization === '両方');
          if (orgMembers.length === 0) return null;

          return (
            <div key={org} className={orgIdx > 0 ? "print:break-before-page break-before-page" : ""}>
              <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-gray-300 pb-1 inline-block">
                拳士一覧（{org === '道院' ? '少林寺拳法佐世保道院' : '佐世保西スポーツ少年団'}）
              </h3>
              <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
                <table className="min-w-full text-left text-xs md:text-sm whitespace-nowrap bg-white">
                  <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50 bg-opacity-75 backdrop-blur">
                    <tr>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200">氏名 / 年齢 / ID</th>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200 no-print text-center w-48">アクション</th>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200">役職</th>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200">所属</th>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200">加入日 / 脱退日</th>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200">ステータス</th>
                      <th scope="col" className="px-3 py-3 border-b border-gray-200">備考</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orgMembers.map((member) => {
                      const age = member.birthDate ? calcAge(member.birthDate) : null;
                      const status = calcStatus(member);
                      const isActive = status.label === '現役';

                      return (
                        <tr
                          key={member.id}
                          className={`transition-colors print:break-inside-avoid ${
                            isActive ? 'hover:bg-indigo-50/50' : 'bg-gray-50/70 hover:bg-gray-100/70'
                          }`}
                        >
                          {/* 氏名 + ID + ヨミガナ + 年齢 */}
                          <td className="px-3 py-2">
                            <div className="flex items-baseline gap-2">
                              <div className={`font-bold text-base ${!isActive ? 'text-gray-400' : 'text-gray-900'}`}>{member.name}</div>
                              <span className="text-xs text-gray-400 font-mono">ID: {member.id}</span>
                            </div>
                            {(member.yomigana || member.kana) && (
                              <span className="block text-xs font-normal text-gray-400 tracking-wider">
                                {member.yomigana || member.kana}
                              </span>
                            )}
                            {!Number.isNaN(age) && age !== null && (
                              <span className={`mt-0.5 inline-flex items-center gap-0.5 text-sm font-medium ${!isActive ? 'text-gray-400' : 'text-indigo-600'}`}>
                                {age}歳（本日時点）
                              </span>
                            )}
                          </td>

                          {/* アクション */}
                          <td className="px-3 py-2 no-print align-middle">
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {isActive && (
                                <button
                                  onClick={() => onSelectMember(member)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-2.5 rounded shadow-sm transition-colors text-xs flex-1 text-center"
                                  title="入金登録"
                                >
                                  入金
                                </button>
                              )}
                              <button
                                onClick={() => setHistoryModalMember(member)}
                                className={`${isActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'} text-white font-medium py-1 px-2.5 rounded shadow-sm transition-colors text-xs flex-1 text-center`}
                                title="入金履歴確認"
                              >
                                履歴
                              </button>
                              
                              <button
                                onClick={() => handleOpenEditModal(member)}
                                className="bg-amber-500 hover:bg-amber-600 text-white p-1.5 rounded shadow-sm transition-colors flex-none"
                                title="編集"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              
                              {isActive && (
                                <button
                                  onClick={() => handleDeleteMember(member)}
                                  className="bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded shadow-sm transition-colors flex-none"
                                  title="退会処理（削除）"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 役職 */}
                          <td className="px-3 py-2 text-xs">
                            {member.role ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${!isActive ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-800'}`}>
                                {member.role}
                              </span>
                            ) : (
                              <span className="text-gray-300">―</span>
                            )}
                          </td>

                          {/* 所属 */}
                          <td className="px-3 py-2">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              !isActive ? 'bg-gray-100 text-gray-500' :
                              member.organization === '道院'   ? 'bg-blue-100 text-blue-800' :
                              member.organization === 'スポ少'  ? 'bg-emerald-100 text-emerald-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {member.organization}
                            </span>
                          </td>

                          {/* 加入日 / 脱退日 */}
                          <td className={`px-3 py-2 text-xs ${!isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                            <div className="space-y-0.5">
                              <div>加入: <span className="font-medium">{member.joinDate || '―'}</span></div>
                              {member.leaveDate && (
                                <div className={!isActive ? 'text-gray-500' : 'text-rose-600'}>脱退: <span className="font-medium">{member.leaveDate}</span></div>
                              )}
                            </div>
                          </td>

                          {/* ステータス */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
                                {status.label}
                              </span>
                              {member.exemptionFlag && (
                                <span className={`text-xs font-bold border rounded px-1 ${!isActive ? 'text-gray-400 border-gray-300' : 'text-red-500 border-red-400'}`}>免除</span>
                              )}
                            </div>
                          </td>

                          {/* 備考 */}
                          <td className={`px-3 py-2 text-xs max-w-xs truncate ${!isActive ? 'text-gray-400' : 'text-gray-500'}`} title={member.notes}>
                            {member.notes || '―'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 一括編集・追加モーダル ── */}
      {isModalOpen && editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {members.some(m => m.id === editingMember.id) ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  )}
                </svg>
                {members.some(m => m.id === editingMember.id) ? '拳士情報の編集' : '新規拳士の追加'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto min-h-0 bg-white">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-sm text-red-700 rounded shadow-sm">
                  {formError}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 氏名 */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingMember.name || ''}
                      onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                      placeholder="例: 佐世保 太郎"
                    />
                  </div>

                  {/* ヨミガナ */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">ヨミガナ</label>
                    <input
                      type="text"
                      value={editingMember.yomigana || editingMember.kana || ''}
                      onChange={e => setEditingMember({...editingMember, yomigana: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                      placeholder="例: サセボ タロウ"
                    />
                  </div>

                  {/* 生年月日 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">生年月日</label>
                    <input
                      type="date"
                      value={editingMember.birthDate || ''}
                      onChange={e => setEditingMember({...editingMember, birthDate: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                    />
                  </div>

                  {/* 加入日 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">加入日 <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editingMember.joinDate || ''}
                      onChange={e => setEditingMember({...editingMember, joinDate: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                    />
                  </div>

                  {/* 脱退日 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">脱退日</label>
                    <input
                      type="date"
                      value={editingMember.leaveDate || ''}
                      onChange={e => setEditingMember({...editingMember, leaveDate: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2 border"
                    />
                    <p className="text-xs text-gray-500 mt-1">※設定すると自動でステータスが「退会」になります</p>
                  </div>

                  {/* 所属 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">所属</label>
                    <select
                      value={editingMember.organization || '道院'}
                      onChange={e => setEditingMember({...editingMember, organization: e.target.value as Organization})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                    >
                      {ORG_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* ステータス */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">ステータス</label>
                    <select
                      value={editingMember.status || '現役'}
                      onChange={e => setEditingMember({...editingMember, status: e.target.value as any})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* 役職 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">役職</label>
                    <input
                      type="text"
                      value={editingMember.role || ''}
                      onChange={e => setEditingMember({...editingMember, role: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                      placeholder="例: 支部長"
                    />
                  </div>

                  {/* 会費免除 */}
                  <div className="flex items-center pt-6">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingMember.exemptionFlag || false}
                        onChange={e => setEditingMember({...editingMember, exemptionFlag: e.target.checked})}
                        className="rounded text-red-500 focus:ring-red-500 w-5 h-5"
                      />
                      <span className="ml-2 text-sm font-bold text-gray-700">会費免除対象</span>
                    </label>
                  </div>
                  
                  {/* 備考 */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">備考</label>
                    <textarea
                      value={editingMember.notes || ''}
                      onChange={e => setEditingMember({...editingMember, notes: e.target.value})}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button 
                onClick={handleCloseModal}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSaveMember}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 入金履歴モーダル ── */}
      {historyModalMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">
                {historyModalMember.name} さんの入金履歴 ({fiscalYear}年度)
              </h3>
              <button
                onClick={() => setHistoryModalMember(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="閉じる"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-0 flex-1 overflow-auto bg-white min-h-[200px]">
              {memberTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>今年度の入金履歴はありません。</p>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('date')}>
                        日付 <span className="text-gray-400">{sortConfig?.key === 'date' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                      </th>
                      <th className="py-2.5 px-4 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('targetMonth')}>
                        対象月 <span className="text-gray-400">{sortConfig?.key === 'targetMonth' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                      </th>
                      <th className="py-2.5 px-4 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('item')}>
                        費目 <span className="text-gray-400">{sortConfig?.key === 'item' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                      </th>
                      <th className="py-2.5 px-4 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('amount')}>
                        金額 <span className="text-gray-400">{sortConfig?.key === 'amount' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {memberTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-gray-700">{tx.date}</td>
                        <td className="py-3 px-4 text-gray-700">{tx.targetMonth || '-'}</td>
                        <td className="py-3 px-4 text-gray-700">{tx.item}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-indigo-700">
                          {txEditingId === tx.id ? (
                            <div className="flex justify-end gap-1">
                              <input
                                type="number"
                                className="w-24 border-indigo-300 rounded px-2 py-1 text-right text-sm focus:ring-indigo-500 focus:border-indigo-500"
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
                              className="cursor-pointer hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors inline-block text-right w-full"
                              onClick={() => handleTxEditClick(tx)}
                              title="クリックで金額を直接編集"
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
            <div className="p-3 border-t bg-gray-50 flex justify-end">
               <button 
                  onClick={() => setHistoryModalMember(null)}
                  className="px-4 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  閉じる
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
