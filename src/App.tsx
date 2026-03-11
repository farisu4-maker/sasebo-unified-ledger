import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { MembersList } from './components/MembersList';
import { PaymentForm } from './components/PaymentForm';
import { ExpenseForm } from './components/ExpenseForm';
import { AuditReport } from './components/AuditReport';
import { HistoryList } from './components/HistoryList';
import { Settings } from './components/Settings';
import { sampleMembers as initialMembers, sampleFeeItems, sampleTransactions, sampleExpenses, sampleBudgets as initialBudgets } from './mocks/sampleData';
import { Member, Organization, Transaction, Expense, Budget } from './types';
import { OfflineQueueManager } from './services/OfflineQueueManager';
import { GoogleSheetsService } from './services/GoogleSheetsService';

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeOrgContext, setActiveOrgContext] = useState<Organization | '統合'>('統合');
  const [activeFiscalYear, setActiveFiscalYear] = useState<number>(new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear()); // 4月始まり想定
  
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // ステート管理
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);

  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions);
  const [expenses, setExpenses] = useState<Expense[]>(sampleExpenses);
  
  // オフライン・同期状態
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 初期化とキュー監視
  useEffect(() => {
    // 初回マウント時に未送信件数を取得
    setPendingSyncCount(OfflineQueueManager.getPendingCount());

    // イベントリスナーでキューの更新を監視
    const handleQueueUpdate = () => setPendingSyncCount(OfflineQueueManager.getPendingCount());
    window.addEventListener('offline-queue-updated', handleQueueUpdate);
    window.addEventListener('online', syncOfflineData);

    // アプリ起動時のデータフェッチ (Google Sheets)
    const initData = async () => {
      setIsSyncing(true);
      try {
        const fetchedMembers = await GoogleSheetsService.fetchMembers();
        const fetchedBudgets = await GoogleSheetsService.fetchBudgets();
        
        if (fetchedMembers.length > 0) setMembers(fetchedMembers);
        if (fetchedBudgets.length > 0) setBudgets(fetchedBudgets);

        // オフラインキューにデータがあれば同期を試みる
        if (OfflineQueueManager.getPendingCount() > 0) {
           await syncOfflineData();
        }
      } catch (e) {
        console.error("Initialization failed:", e);
      } finally {
        setIsSyncing(false);
      }
    };
    initData();

    return () => {
      window.removeEventListener('offline-queue-updated', handleQueueUpdate);
      window.removeEventListener('online', syncOfflineData);
    };
  }, []);

  // オフラインデータの同期処理
  const syncOfflineData = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    
    const queue = OfflineQueueManager.getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const item of queue) {
      try {
        let success = false;
        if (item.type === 'TRANSACTION') {
          success = await GoogleSheetsService.syncTransaction(item.payload);
        } else if (item.type === 'EXPENSE') {
          success = await GoogleSheetsService.syncExpense(item.payload);
        }

        if (success) {
          OfflineQueueManager.dequeue(item.id, item.type);
          successCount++;
        }
      } catch (e) {
        console.error('Sync failed for item', item, e);
        // エラー時はキューに残すため何もしない
      }
    }
    
    setIsSyncing(false);
    if (successCount > 0) {
      showNotification(`${successCount}件のオフラインデータを同期しました。`);
    }
  }, [isSyncing]); // isSyncingを依存配列に追加

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handlePaymentSubmit = useCallback((data: { memberId: string; item: string; amount: number; paymentMethod: string; }) => {
    const newTx: Transaction = {
      id: `T${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      memberId: data.memberId,
      organization: members.find((m: Member) => m.id === data.memberId)?.organization === '道院' ? '道院' : 'スポ少',
      item: data.item,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      enteredById: 'U001',
      timestamp: new Date().toISOString()
    };
    setTransactions((prev: Transaction[]) => [newTx, ...prev]);
    
    // オフラインキューに追加（背後で同期処理を呼び出す）
    OfflineQueueManager.enqueue('TRANSACTION', newTx);
    syncOfflineData();
    
    showNotification(`${members.find((m: Member) => m.id === data.memberId)?.name} の ${data.item}（${data.amount.toLocaleString()}円）を入金登録しました。`);
    setSelectedMember(null);
  }, [members, syncOfflineData, showNotification]);

  const handleQuickEntry = useCallback((targetMember: Member) => {
    const today = new Date().toISOString().split('T')[0];
    const itemsToPay: {item: string, amount: number, org: '道院'|'スポ少'}[] = [];
    
    // 家族割引判定
    const familyMembers = targetMember.representativeId 
      ? members.filter((m: Member) => 
          m.representativeId === targetMember.representativeId &&
          m.status === '現役' &&
          m.joinDate <= today &&
          (!m.leaveDate || m.leaveDate >= today)
        ) 
      : [];
    const isFamilyDiscountEligible = familyMembers.length >= 3;

    if (targetMember.organization === '道院' || targetMember.organization === '両方') {
      const conditionName = isFamilyDiscountEligible ? '信徒香資（月・家族割引）' : '信徒香資（月）';
      const fee = sampleFeeItems.find(f => f.name === conditionName);
      if (fee) itemsToPay.push({ item: '信徒香資（月）', amount: fee.amount, org: '道院' });
    }
    
    if (targetMember.organization === 'スポ少' || targetMember.organization === '両方') {
      const fee = sampleFeeItems.find(f => f.name === 'スポ少会費（月）');
      if (fee) itemsToPay.push({ item: 'スポ少会費（月）', amount: fee.amount, org: 'スポ少' });
    }

    if (itemsToPay.length === 0) return;

    const newTxs: Transaction[] = itemsToPay.map((it, idx) => ({
      id: `TQ${Date.now()}${idx}`,
      date: today,
      memberId: targetMember.id,
      organization: it.org,
      item: it.item,
      amount: it.amount,
      paymentMethod: '現金', // クイック時のデフォルト
      enteredById: 'U001',
      timestamp: new Date().toISOString()
    }));

    setTransactions((prev: Transaction[]) => [...newTxs, ...prev]);
    
    // オフラインキューに追加
    newTxs.forEach(tx => OfflineQueueManager.enqueue('TRANSACTION', tx));
    syncOfflineData();

    const totalAmount = itemsToPay.reduce((sum, i) => sum + i.amount, 0);
    showNotification(`${targetMember.name}の当月分会費 (${totalAmount.toLocaleString()}円) をクイック登録しました ⚡`);
  }, [members, syncOfflineData, showNotification]);

  const handleExpenseSubmit = useCallback((data: { date: string; organization: Organization; category: string; description: string; amount: number; paymentMethod: string; receiptUrl?: string; }) => {
    const newEx: Expense = {
      id: `E${Date.now()}`,
      date: data.date,
      organization: data.organization,
      category: data.category,
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      receiptUrl: data.receiptUrl,
      enteredById: 'U001',
      timestamp: new Date().toISOString()
    };
    setExpenses([newEx, ...expenses]);
    
    // オフラインキューに追加
    OfflineQueueManager.enqueue('EXPENSE', newEx);
    syncOfflineData();

    showNotification(`${data.category}（${data.amount.toLocaleString()}円）を支出登録しました。`);
    setActiveTab('dashboard'); // 登録後にダッシュボードに戻る
  }, [expenses, syncOfflineData, showNotification]);

  const handleCancelTransaction = useCallback(async (id: string) => {
    if (window.confirm('この入金記録を取り消しますか？\n（物理削除ではなく、取消フラグが立ちます）')) {
      try {
        // 1. UIを即時反映（オプティミスティックUI）
        setTransactions((prev: Transaction[]) => prev.map((t: Transaction) => t.id === id ? { ...t, isCancelled: true } : t));
        // 2. Google Sheetsを更新
        const success = await GoogleSheetsService.cancelTransaction(id);
        if (success) {
          showNotification(`入金履歴（ID: ${id}）を取消しました。`);
        } else {
          // 失敗時はUIを元に戻す
          setTransactions((prev: Transaction[]) => prev.map((t: Transaction) => t.id === id ? { ...t, isCancelled: false } : t));
          showNotification(`取消に失敗しました（ID: ${id}）。通信環境等を確認してください。`);
        }
      } catch (e) {
        setTransactions((prev: Transaction[]) => prev.map((t: Transaction) => t.id === id ? { ...t, isCancelled: false } : t));
        console.error('Failed to cancel transaction:', e);
        showNotification(`取消中にエラーが発生しました（ID: ${id}）。`);
      }
    }
  }, [showNotification]);

  const handleCancelExpense = useCallback(async (id: string) => {
    if (window.confirm('この支出記録を取り消しますか？\n（物理削除ではなく、取消フラグが立ちます）')) {
      try {
        setExpenses((prev: Expense[]) => prev.map((e: Expense) => e.id === id ? { ...e, isCancelled: true } : e));
        const success = await GoogleSheetsService.cancelExpense(id);
        if (success) {
          showNotification(`支出履歴（ID: ${id}）を取消しました。`);
        } else {
          setExpenses((prev: Expense[]) => prev.map((e: Expense) => e.id === id ? { ...e, isCancelled: false } : e));
          showNotification(`取消に失敗しました（ID: ${id}）。通信環境等を確認してください。`);
        }
      } catch (e) {
        setExpenses((prev: Expense[]) => prev.map((e: Expense) => e.id === id ? { ...e, isCancelled: false } : e));
        console.error('Failed to cancel expense:', e);
        showNotification(`取消中にエラーが発生しました（ID: ${id}）。`);
      }
    }
  }, [showNotification]);

  // 組織コンテキストでメンバーをフィルタリング
  const displayMembers = useMemo(() => {
    return activeOrgContext === '統合' 
      ? members 
      : members.filter((m: Member) => m.organization === activeOrgContext || m.organization === '両方');
  }, [members, activeOrgContext]);

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      activeOrgContext={activeOrgContext}
      onOrgContextChange={setActiveOrgContext}
      activeFiscalYear={activeFiscalYear}
      onFiscalYearChange={setActiveFiscalYear}
      pendingSyncCount={pendingSyncCount}
      isSyncing={isSyncing}
    >
      {notification && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm flex items-center animate-pulse">
          <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
          </svg>
          <p className="text-sm text-green-700 font-medium">{notification}</p>
        </div>
      )}

      {/* タブコンテンツの切り替え */}
      {activeTab === 'dashboard' && (
        <Dashboard 
          activeOrgContext={activeOrgContext} 
          transactions={transactions} 
          expenses={expenses} 
          budgets={budgets}
          fiscalYear={activeFiscalYear}
        />
      )}

      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">拳士・入金管理</h2>
          </div>
          <MembersList 
            members={displayMembers} 
            onSelectMember={setSelectedMember} 
            onQuickEntry={handleQuickEntry}
          />
        </div>
      )}

      {activeTab === 'expenses' && (
        <ExpenseForm onSubmit={handleExpenseSubmit} memberships={members} />
      )}

      {activeTab === 'reports' && (
        <AuditReport 
          members={members} 
          transactions={transactions} 
          expenses={expenses} 
          budgets={budgets}
          fiscalYear={activeFiscalYear}
        />
      )}
      
      {activeTab === 'history' && (
        <HistoryList 
          transactions={transactions}
          expenses={expenses}
          fiscalYear={activeFiscalYear}
          onCancelTransaction={handleCancelTransaction}
          onCancelExpense={handleCancelExpense}
        />
      )}

      {activeTab === 'settings' && (
        <Settings
          members={members}
          transactions={transactions}
          expenses={expenses}
          budgets={budgets}
          fiscalYear={activeFiscalYear}
          onCloseFiscalYear={async () => {
            setIsSyncing(true);
            try {
              const fetchedBudgets = await GoogleSheetsService.fetchBudgets();
              if (fetchedBudgets.length > 0) setBudgets(fetchedBudgets);
            } finally {
              setIsSyncing(false);
            }
          }}
        />
      )}

      {/* モーダル */}
      {selectedMember && (
        <PaymentForm 
          member={selectedMember} 
          allMembers={members}
          feeItems={sampleFeeItems}
          onClose={() => setSelectedMember(null)}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </Layout>
  );
}

export default App;
