import React, { useMemo, useState } from 'react';
import { Member, PersonalCollection } from '../types';
import { parseJapaneseDate } from '../utils/dateParser';

interface PersonalCollectionSubmitData {
  date: string;
  memberId: string;
  purpose: string;
  amount: number;
  paymentMethod: string;
  notes: string;
}

interface PersonalCollectionFormProps {
  members: Member[];
  collections: PersonalCollection[];
  fiscalYear?: number;
  onSubmit: (data: PersonalCollectionSubmitData) => void;
  onCancel: (id: string) => void;
  onUpdate?: (updated: PersonalCollection) => void | Promise<void>;
}

const PRESET_PURPOSES = ['昇段・昇級試験受験料', '道着・帯代', '大会参加費', '記念品代', 'その他'];

export const PersonalCollectionForm: React.FC<PersonalCollectionFormProps> = ({
  members,
  collections,
  fiscalYear,
  onSubmit,
  onCancel,
  onUpdate
}) => {
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateError, setDateError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [purpose, setPurpose] = useState<string>(PRESET_PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('現金');
  const [notes, setNotes] = useState<string>('');

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [members]
  );

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return sortedMembers;
    const kw = memberSearch.trim();
    return sortedMembers.filter(m => m.name.includes(kw) || m.id.includes(kw) || (m.kana && m.kana.includes(kw)));
  }, [sortedMembers, memberSearch]);

  const memberName = (id: string) => members.find(m => m.id === id)?.name ?? id;

  // 入力誤り・打ち間違い防止のための確認ステップ。
  // 「記録する」を押した時点ではまだ確定させず、内容を要約した確認モーダルを
  // 一度挟んでから、明示的な「この内容で記録する」でようやくonSubmitを呼ぶ。
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDate, setPendingDate] = useState<string>('');
  const [pendingPurpose, setPendingPurpose] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !amount) return;

    const parsedDate = parseJapaneseDate(dateInput);
    if (!parsedDate) {
      setDateError(`「${dateInput}」の形式が認識できません。例：R7.4.20 / 2025/04/20 / 令和7年4月20日`);
      return;
    }
    setDateError(null);

    const finalPurpose = purpose === 'その他' ? (customPurpose.trim() || 'その他') : purpose;

    // ここではまだ記録せず、確認モーダルを表示するだけ
    setPendingDate(parsedDate);
    setPendingPurpose(finalPurpose);
    setShowConfirm(true);
  };

  const handleConfirmedSubmit = () => {
    onSubmit({
      date: pendingDate,
      memberId,
      purpose: pendingPurpose,
      amount: Number(amount),
      paymentMethod,
      notes: notes.trim()
    });

    setAmount('');
    setNotes('');
    setCustomPurpose('');
    setShowConfirm(false);
  };

  // ── 一覧（年度指定があれば絞り込み、無ければ全件） ────────
  const listRows = useMemo(() => {
    let rows = [...collections];
    if (fiscalYear) {
      const start = `${fiscalYear}-04-01`;
      const end = `${fiscalYear + 1}-03-31`;
      rows = rows.filter(c => c.date >= start && c.date <= end);
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [collections, fiscalYear]);

  const activeTotal = listRows.filter(c => !c.isCancelled).reduce((s, c) => s + c.amount, 0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number | ''>('');

  const handleEditClick = (c: PersonalCollection) => {
    setEditingId(c.id);
    setEditAmount(c.amount);
  };

  const handleSaveEdit = (c: PersonalCollection) => {
    if (editAmount !== '' && typeof editAmount === 'number' && editAmount !== c.amount && onUpdate) {
      onUpdate({ ...c, amount: editAmount });
    }
    setEditingId(null);
  };

  // ── 確認用一覧表（集計・印刷用。台帳・監査・仕訳帳には使わない参考資料） ──
  const [summaryGroupBy, setSummaryGroupBy] = useState<'purpose' | 'member'>('purpose');

  const activeRows = useMemo(() => listRows.filter(c => !c.isCancelled), [listRows]);

  const summaryGroups = useMemo(() => {
    const groups: Record<string, PersonalCollection[]> = {};
    activeRows.forEach(c => {
      const key = summaryGroupBy === 'purpose' ? c.purpose : memberName(c.memberId);
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups)
      .map(([key, rows]) => ({
        key,
        rows: [...rows].sort((a, b) => a.date.localeCompare(b.date)),
        subtotal: rows.reduce((s, r) => s + r.amount, 0)
      }))
      .sort((a, b) => a.key.localeCompare(b.key, 'ja'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRows, summaryGroupBy, members]);

  const handlePrintSummary = () => window.print();

  return (
    <>
    <div className="space-y-8">
      {/* ── 台帳外である旨の注意書き ─────────────────────── */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded shadow-sm">
        <p className="text-sm text-amber-800 font-bold">⚠️ この記録は台帳（会計）に一切含まれません</p>
        <p className="text-xs text-amber-700 mt-1">
          昇段試験受験料など、本来は団体（道院・スポ少）が支払う必要のない、拳士個人が負担すべきお金を
          便宜上まとめて集金した場合の「記録専用」の帳票です。監査・レポート、仕訳帳、予算計算などの
          台帳計算には一切反映されません。
        </p>
      </div>

      {/* ── 入力フォーム ─────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-6">個人徴収記録の入力</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象拳士</label>
            <input
              type="text"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="氏名・IDで絞り込み"
              className="w-full border border-gray-300 rounded-md py-1.5 px-3 mb-2 text-sm focus:ring-amber-500 focus:border-amber-500"
            />
            <select
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500"
              required
            >
              <option value="" disabled>拳士を選択してください</option>
              {filteredMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}（{m.organization} / ID:{m.id}）</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
              <input
                type="date"
                value={dateInput}
                onChange={e => { setDateInput(e.target.value); setDateError(null); }}
                className={`w-full border rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500 ${dateError ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {dateError && <p className="text-red-600 text-xs mt-1">{dateError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">支払方法</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500">
                <option value="現金">現金</option>
                <option value="銀行振込">銀行振込</option>
                <option value="電子マネー">電子マネー</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用途</label>
            <select value={purpose} onChange={e => setPurpose(e.target.value)}
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500">
              {PRESET_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {purpose === 'その他' && (
              <input
                type="text"
                value={customPurpose}
                onChange={e => setCustomPurpose(e.target.value)}
                placeholder="用途を入力"
                className="w-full border border-gray-300 rounded-md py-2 px-3 mt-2 focus:ring-amber-500 focus:border-amber-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">金額（円）</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              min="1" placeholder="例：3000"
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考（任意）</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="例：〇段審査分、本部へ送金予定"
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-amber-500 focus:border-amber-500" />
          </div>

          <button type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors text-sm">
            記録する
          </button>
        </form>
      </div>

      {/* ── 一覧 ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-gray-800">
            個人徴収記録一覧{fiscalYear ? `（${fiscalYear}年度）` : ''}
          </h3>
          <span className="text-sm font-semibold text-gray-700">
            集金合計（有効分）: <span className="text-lg text-amber-700 font-bold">¥{activeTotal.toLocaleString()}</span>
          </span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="py-2 px-3 text-left whitespace-nowrap">日付</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">拳士</th>
                <th className="py-2 px-3 text-left">用途</th>
                <th className="py-2 px-3 text-left">備考</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">支払方法</th>
                <th className="py-2 px-3 text-right">金額</th>
                <th className="py-2 px-3 text-center whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {listRows.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">記録がありません</td></tr>
              ) : listRows.map(c => (
                <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${c.isCancelled ? 'opacity-40 line-through' : ''}`}>
                  <td className="py-2 px-3 whitespace-nowrap">{c.date}</td>
                  <td className="py-2 px-3 whitespace-nowrap font-medium text-gray-700">{memberName(c.memberId)}</td>
                  <td className="py-2 px-3 text-gray-600">{c.purpose}</td>
                  <td className="py-2 px-3 max-w-xs truncate text-gray-500" title={c.notes}>{c.notes}</td>
                  <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{c.paymentMethod}</td>
                  <td className="py-2 px-3 text-right font-mono font-medium text-amber-700">
                    {editingId === c.id ? (
                      <div className="flex items-center justify-end space-x-1">
                        <input
                          type="number"
                          className="w-20 px-1 py-0.5 border rounded text-right text-sm"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          onBlur={() => handleSaveEdit(c)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEdit(c);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <span className="text-gray-500 text-xs">円</span>
                      </div>
                    ) : (
                      <div
                        className={`inline-block px-1 rounded ${onUpdate && !c.isCancelled ? 'cursor-pointer hover:bg-amber-50' : ''}`}
                        onClick={() => onUpdate && !c.isCancelled && handleEditClick(c)}
                        title={onUpdate && !c.isCancelled ? 'クリックして修正' : undefined}
                      >
                        ¥{c.amount.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {c.isCancelled ? (
                      <span className="text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">取消済</span>
                    ) : (
                      <button
                        onClick={() => {
                          if (window.confirm('この記録を取消しますか？')) onCancel(c.id);
                        }}
                        className="text-[11px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 font-medium py-1 px-2 rounded shadow-sm transition-colors"
                      >
                        取消
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 確認用一覧表（集計・印刷）─────────────────────── */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-3 no-print">
          <h3 className="text-lg font-bold text-gray-800">確認用一覧表（集計・印刷）</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
              <button
                type="button"
                onClick={() => setSummaryGroupBy('purpose')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${summaryGroupBy === 'purpose' ? 'bg-white shadow text-amber-700' : 'text-gray-500'}`}
              >
                用途ごと
              </button>
              <button
                type="button"
                onClick={() => setSummaryGroupBy('member')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${summaryGroupBy === 'member' ? 'bg-white shadow text-amber-700' : 'text-gray-500'}`}
              >
                拳士ごと
              </button>
            </div>
            <button
              type="button"
              onClick={handlePrintSummary}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-4 rounded-md shadow-sm transition-colors text-sm flex items-center"
            >
              🖨 印刷する
            </button>
          </div>
        </div>

        <div className="print-summary bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-summary, .print-summary * { visibility: visible; }
              .print-summary {
                position: absolute; left: 0; top: 0; width: 100%;
                padding: 0; border: none; box-shadow: none;
              }
              .no-print { display: none !important; }
              /* この一覧はシンプルな縦長リストのため、他の帳票(A4横)と異なりA4縦を使用 */
              @page { size: A4 portrait; margin: 15mm; }
              .avoid-break { break-inside: avoid; page-break-inside: avoid; }
            }
          `}</style>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-800">個人徴収記録 確認一覧</h1>
            <p className="text-[11px] text-gray-400 mt-1">
              ※台帳外の参考資料です。仕訳帳・監査報告など正式な会計書類には使用しません。
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {fiscalYear ? `${fiscalYear}年度　` : ''}
              {summaryGroupBy === 'purpose' ? '用途別' : '拳士別'}集計
            </p>
          </div>

          {summaryGroups.length === 0 ? (
            <p className="text-center text-gray-400 py-8">対象データがありません</p>
          ) : (
            <div className="space-y-6">
              {summaryGroups.map(group => (
                <div key={group.key} className="avoid-break">
                  <div className="flex justify-between items-center bg-amber-50 px-3 py-1.5 rounded border border-amber-100 mb-1">
                    <span className="font-bold text-amber-900">{group.key}</span>
                    <span className="text-sm font-semibold text-amber-800">
                      小計 ¥{group.subtotal.toLocaleString()}（{group.rows.length}件）
                    </span>
                  </div>
                  <table className="w-full text-sm border border-gray-200">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="py-1 px-2 text-left border-b border-gray-200 w-10">済</th>
                        <th className="py-1 px-2 text-left border-b border-gray-200 whitespace-nowrap">日付</th>
                        <th className="py-1 px-2 text-left border-b border-gray-200">
                          {summaryGroupBy === 'purpose' ? '拳士' : '用途'}
                        </th>
                        <th className="py-1 px-2 text-left border-b border-gray-200">備考</th>
                        <th className="py-1 px-2 text-right border-b border-gray-200">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(r => (
                        <tr key={r.id} className="border-b border-gray-100">
                          <td className="py-1 px-2 text-green-600 font-bold text-center">✓</td>
                          <td className="py-1 px-2 whitespace-nowrap">{r.date}</td>
                          <td className="py-1 px-2">
                            {summaryGroupBy === 'purpose' ? memberName(r.memberId) : r.purpose}
                          </td>
                          <td className="py-1 px-2 text-gray-500 max-w-[160px] truncate" title={r.notes}>{r.notes}</td>
                          <td className="py-1 px-2 text-right font-mono">¥{r.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="flex justify-between items-center bg-gray-800 text-white px-4 py-2 rounded font-bold avoid-break">
                <span>全体合計（{activeRows.length}件）</span>
                <span>¥{activeTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── 確認モーダル（入力誤り・打ち間違い防止） ─────────── */}
    {showConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            この内容でよろしいですか？
          </h3>
          <p className="text-xs text-gray-500 mb-4">打ち間違いがないか確認してから記録してください。</p>

          <div className="space-y-2 text-sm bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-500">対象拳士</span>
              <span className="font-bold text-gray-800">{memberName(memberId)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">日付</span>
              <span className="font-bold text-gray-800">{pendingDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">用途</span>
              <span className="font-bold text-gray-800">{pendingPurpose}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">支払方法</span>
              <span className="font-bold text-gray-800">{paymentMethod}</span>
            </div>
            {notes.trim() && (
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 shrink-0">備考</span>
                <span className="font-bold text-gray-800 text-right break-words">{notes.trim()}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
              <span className="text-gray-600 font-medium">金額</span>
              <span className="text-xl font-bold text-amber-700">¥{Number(amount).toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              修正する
            </button>
            <button
              type="button"
              onClick={handleConfirmedSubmit}
              className="px-4 py-2 rounded-md shadow-sm text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
            >
              この内容で記録する
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
