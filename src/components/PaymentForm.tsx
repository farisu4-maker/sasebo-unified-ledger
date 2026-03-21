import React, { useState, useEffect } from 'react';
import { Member, FeeItem, Transaction } from '../types/index';
import { calculateFoundationFeeForMember } from '../utils/feeCalculator';

interface PaymentFormProps {
  member: Member;
  allMembers: Member[];
  feeItems: FeeItem[];
  transactions: Transaction[];
  onClose: () => void;
  onSubmit: (data: { memberId: string; item: string; amount: number; paymentMethod: string; organization?: string; date: string; targetMonth: string }) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ member, allMembers, feeItems, transactions, onClose, onSubmit }) => {
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [selectedOrg] = useState<string>(
    member.organization === '両方' ? '道院' : member.organization
  );
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('現金');
  const [suggestedFeeMessage, setSuggestedFeeMessage] = useState<string>('');

  // 家族割引の動的判定（Representative_ID, 現役, 加入・脱退日）
  const today = new Date().toISOString().split('T')[0];
  const familyMembers = member.representativeId 
    ? allMembers.filter((m: Member) => 
        m.representativeId === member.representativeId &&
        m.status === '現役' &&
        m.joinDate <= today &&
        (!m.leaveDate || m.leaveDate >= today)
      ) 
    : [];
  const isFamilyDiscountEligible = familyMembers.length >= 3;

  useEffect(() => {
    // 費目が選択されたときの自動金額サジェスト
    if (selectedItem === '財団年費') {
      const calculatedFee = calculateFoundationFeeForMember(member);
      setAmount(calculatedFee);
      setSuggestedFeeMessage(`年度末年齢に基づく自動計算: ${calculatedFee.toLocaleString()}円`);
    } else if (selectedItem === '宗教年費') {
      const fee = feeItems.find((item: FeeItem) => item.name === '宗教年費');
      if (fee) setAmount(fee.amount);
      setSuggestedFeeMessage('');
    } else if (selectedItem === '信徒香資（月）') {
      if (member.role) {
        setAmount(1500);
        setSuggestedFeeMessage('✨ 役職者特典: 1,500円');
      } else if (member.organization === '両方') {
        setAmount(2500);
        setSuggestedFeeMessage('✨ 両方所属割引: 2,500円');
      } else if (isFamilyDiscountEligible) {
        const discountItem = feeItems.find((item: FeeItem) => item.name === '信徒香資（月・家族割引）');
        if (discountItem) {
          setAmount(discountItem.amount);
          setSuggestedFeeMessage(`✨ 世帯内現役3名以上：家族割引適用中 (${discountItem.amount.toLocaleString()}円)`);
        } else {
          const fee = feeItems.find((item: FeeItem) => item.name === '信徒香資（月）');
          if (fee) setAmount(fee.amount);
        }
      } else {
        const fee = feeItems.find((item: FeeItem) => item.name === '信徒香資（月）');
        if (fee) setAmount(fee.amount);
        setSuggestedFeeMessage('');
      }
    } else if (selectedItem === 'スポ少会費（月）') {
      if (member.organization === '両方') {
        setAmount(1000);
        setSuggestedFeeMessage('✨ 両方所属割引: 1,000円');
      } else {
        const fee = feeItems.find((item: FeeItem) => item.name === selectedItem);
        if (fee) setAmount(fee.amount);
        setSuggestedFeeMessage('');
      }
    } else {
      setAmount(0);
      setSuggestedFeeMessage('');
    }
  }, [selectedItem, member, feeItems, isFamilyDiscountEligible]);

  const submitTargetRef = React.useRef<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || amount <= 0) return;
    
    // 過納・重複チェックロジック
    if (selectedItem === '信徒香資（月）' || selectedItem === 'スポ少会費（月）') {
      const targetAmount = 
        selectedItem === '信徒香資（月）' 
          ? (member.role ? 1500 : (member.organization === '両方' ? 2500 : feeItems.find(f => f.name === '信徒香資（月）')?.amount || 3000))
          : (member.organization === '両方' ? 1000 : feeItems.find(f => f.name === 'スポ少会費（月）')?.amount || 1500);
          
      const pastTotal = transactions
        .filter(t => !t.isCancelled && t.memberId === member.id && t.item === selectedItem && t.targetMonth === targetMonth)
        .reduce((sum, t) => sum + t.amount, 0);
        
      if (pastTotal + amount > targetAmount) {
        alert(`${targetMonth}月の調定額（${targetAmount}円）を超過しています。\n既に${pastTotal}円が納入済みです。重複入力または過納になっていないか確認してください。`);
        return;
      }
    }
    
    const targetOrg = member.organization === '両方' && submitTargetRef.current 
      ? submitTargetRef.current 
      : member.organization === '両方' ? selectedOrg : member.organization;

    onSubmit({
      memberId: member.id,
      item: selectedItem,
      amount,
      paymentMethod,
      organization: targetOrg,
      date: paymentDate,
      targetMonth
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="relative p-8 bg-white w-full max-w-md m-auto flex-col flex rounded-lg shadow-xl">
        <div className="flex justify-between items-center pb-3 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">入金入力</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="py-4">
          <div className="bg-indigo-50 p-4 rounded-md mb-4 border border-indigo-100">
            <p className="text-sm text-indigo-800 mb-1">対象拳士</p>
            <p className="font-bold text-lg text-indigo-900">{member.name}</p>
            <p className="text-sm text-indigo-600">所属: {member.organization} / ID: {member.id}</p>
            {member.organization === '両方' && (
              <div className="mt-2 text-xs bg-purple-100 text-purple-800 p-2 rounded flex flex-col gap-1 border border-purple-200 font-bold">
                <p className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" clipRule="evenodd" /></svg>
                  二重所属（道院・スポ少）の拳士です。
                </p>
                <p className="text-red-600">🚨 他団体で未納がないか一元的に状況をご確認ください。</p>
              </div>
            )}
            
            {isFamilyDiscountEligible && (
              <div className="mt-2 text-xs bg-green-100 text-green-800 p-2 rounded flex items-center border border-green-200">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                代表世帯(ID: {member.representativeId})で{familyMembers.length}名が現役・在籍中です（家族割引適用可能）
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">入金処理日</label>
                <input 
                  type="date" 
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">対象月</label>
                <input 
                  type="month" 
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">費目</label>
              <select 
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="" disabled>費目を選択してください</option>
                <option value="財団年費">財団年費</option>
                <option value="宗教年費">宗教年費</option>
                <option value="信徒香資（月）">信徒香資（月）</option>
                <option value="スポ少会費（月）">スポ少会費（月）</option>
                <optgroup label="── 過年度分回収 ──">
                  <option value="前年度未納分回収（道院）">前年度未納分回収（道院）</option>
                  <option value="前年度未納分回収（スポ少）">前年度未納分回収（スポ少）</option>
                </optgroup>
                <option value="その他">その他</option>
              </select>
            </div>

            {/* Radio buttons for organization have been replaced by separate submit buttons below */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金額 (円)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                required
              />
              {suggestedFeeMessage && (
                <p className="mt-1 text-xs text-green-600 font-medium">✨ {suggestedFeeMessage}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">決済手段</label>
              <div className="flex gap-4">
                <label className="inline-flex items-center">
                  <input type="radio" className="form-radio text-indigo-600" name="payment" value="現金" checked={paymentMethod === '現金'} onChange={(e) => setPaymentMethod(e.target.value)} />
                  <span className="ml-2">現金</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="radio" className="form-radio text-indigo-600" name="payment" value="振込" checked={paymentMethod === '振込'} onChange={(e) => setPaymentMethod(e.target.value)} />
                  <span className="ml-2">振込・その他</span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 flex-wrap">
              <button 
                type="button" 
                onClick={onClose}
                className="bg-white border border-gray-300 rounded-md py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                キャンセル
              </button>
              {member.organization === '両方' ? (
                <>
                  <button 
                    type="submit"
                    onClick={() => submitTargetRef.current = '道院'}
                    className="bg-indigo-600 border border-transparent rounded-md py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
                  >
                    道院分として登録
                  </button>
                  <button 
                    type="submit"
                    onClick={() => submitTargetRef.current = 'スポ少'}
                    className="bg-orange-600 border border-transparent rounded-md py-2 px-4 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors shadow-sm"
                  >
                    スポ少分として登録
                  </button>
                </>
              ) : (
                <button 
                  type="submit"
                  className="bg-indigo-600 border border-transparent rounded-md py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
                >
                  登録する
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
