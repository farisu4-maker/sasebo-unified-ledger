import { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { MembersList } from './components/MembersList';
import { PaymentForm } from './components/PaymentForm';
import { ExpenseForm } from './components/ExpenseForm';
import { AuditReport } from './components/AuditReport';
import { HistoryList } from './components/HistoryList';
import { Settings } from './components/Settings';
import { sampleFeeItems } from './mocks/sampleData';
import { Member, Organization, Transaction, Expense, Budget } from './types';
import { OfflineQueueManager } from './services/OfflineQueueManager';
import { GoogleSheetsService } from './services/GoogleSheetsService';


// ── 通知バナー型定義 ─────────────────────────────────────
type NotificationKind = 'success' | 'error';
interface AppNotification {
  msg: string;
  kind: NotificationKind;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeOrgContext, setActiveOrgContext] = useState<Organization | '統合'>('統合');
  // 4月始まり（4月未満なら前年を年度とする）
  const [activeFiscalYear, setActiveFiscalYear] = useState<number>(() => {
    const now = new Date();
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  });

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // ── アプリの全データを管理するステート ─────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // ── 通知バナー（成功 / エラー）─────────────────────────
  const [notification, setNotification] = useState<AppNotification | null>(null);

  // ── 同期管理 ─────────────────────────────────────────
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  通知ヘルパー
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const showNotification = useCallback((msg: string, kind: NotificationKind = 'success') => {
    setNotification({ msg, kind });
    setTimeout(() => setNotification(null), kind === 'error' ? 5000 : 3000);
  }, []);

  const showSyncError = useCallback((msg: string) => showNotification(msg, 'error'), [showNotification]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  初期化（アプリ起動時に Sheets からデータ取得）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const syncOfflineData = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const queue = OfflineQueueManager.getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

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
        } else {
          failCount++;
        }
      } catch (e) {
        console.error('Sync failed for item', item, e);
        failCount++;
      }
    }

    setIsSyncing(false);
    if (successCount > 0) showNotification(`${successCount}件のオフラインデータを同期しました。`);
    if (failCount > 0) showSyncError(`${failCount}件の同期に失敗しました。通信環境を確認してください。`);
  }, [isSyncing, showNotification, showSyncError]);

  useEffect(() => {
    setPendingSyncCount(OfflineQueueManager.getPendingCount());
    const handleQueueUpdate = () => setPendingSyncCount(OfflineQueueManager.getPendingCount());
    window.addEventListener('offline-queue-updated', handleQueueUpdate);
    window.addEventListener('online', syncOfflineData);

    // ── アプリ起動時: Sheets から全データ取得 ──────────
    const initData = async () => {
      setIsSyncing(true);
      try {
        // 並列フェッチ（Members / Budgets / Transactions / Expenses）
        const [fetchedMembers, fetchedBudgets, fetchedTx, fetchedEx] = await Promise.all([
          GoogleSheetsService.fetchMembers(),
          GoogleSheetsService.fetchBudgets(),
          GoogleSheetsService.fetchTransactions(),
          GoogleSheetsService.fetchExpenses(),
        ]);

        // シートのデータを直接正とする（空なら空配列を設定し、ハードコードをフォールバックにしない）
        setMembers(fetchedMembers);
        setBudgets(fetchedBudgets);
        setTransactions(fetchedTx);
        setExpenses(fetchedEx);

        if (OfflineQueueManager.getPendingCount() > 0) await syncOfflineData();
      } catch (e) {
        console.error('Initialization failed:', e);
        showSyncError('起動時の初期データ取得に失敗しました。オフラインモードで動作しています。');
      } finally {
        setIsSyncing(false);
      }
    };
    initData();

    return () => {
      window.removeEventListener('offline-queue-updated', handleQueueUpdate);
      window.removeEventListener('online', syncOfflineData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  入金ハンドラ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handlePaymentSubmit = useCallback(async (data: {
    memberId: string; item: string; amount: number; paymentMethod: string; organization?: string; date: string; targetMonth: string;
  }) => {
    const now = new Date();
    const targetMember = members.find((m: Member) => m.id === data.memberId);
    const newTx: Transaction = {
      id: `T${Date.now()}`,
      date: data.date,
      memberId: data.memberId,
      organization: (data.organization as '道院' | 'スポ少') ||
        (targetMember?.organization === '道院' ? '道院' : 'スポ少'),
      item: data.item,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      enteredById: 'U001',
      timestamp: now.toISOString(),
      targetMonth: data.targetMonth,
      fiscalYear: activeFiscalYear,
    };

    // 1. UI を即時反映
    setTransactions((prev: Transaction[]) => [newTx, ...prev]);

    // 2. Google Sheets へリアルタイム書き込み（オフラインキュー経由）
    OfflineQueueManager.enqueue('TRANSACTION', newTx);
    const synced = await GoogleSheetsService.syncTransaction(newTx);
    if (synced) {
      OfflineQueueManager.dequeue(newTx.id, 'TRANSACTION');
      showNotification(`${targetMember?.name ?? data.memberId} の ${data.item}（${data.amount.toLocaleString()}円）を入金登録しました。`);
    } else {
      showSyncError(`Sheetsへの書き込みに失敗しました。オフラインキューに保持します。`);
    }

    // 3. Sheets から最新データを再フェッチしてUIを最新化
    try {
      const refreshed = await GoogleSheetsService.fetchTransactions();
      if (refreshed.length > 0) setTransactions(refreshed);
    } catch { /* シート未設定時はスキップ */ }

    setSelectedMember(null);
  }, [members, activeFiscalYear, showNotification, showSyncError]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  支出ハンドラ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleExpenseSubmit = useCallback(async (data: {
    date: string; organization: '道院' | 'スポ少'; category: string; description: string;
    amount: number; paymentMethod: string; receiptUrl?: string | null;
  }) => {
    const now = new Date();
    const newEx: Expense = {
      id: `E${Date.now()}`,
      date: data.date,
      organization: data.organization,
      category: data.category,
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      receiptUrl: data.receiptUrl ?? undefined,
      enteredById: 'U001',
      timestamp: now.toISOString(),
      fiscalYear: activeFiscalYear,
    };
    setExpenses((prev: Expense[]) => [newEx, ...prev]);

    OfflineQueueManager.enqueue('EXPENSE', newEx);
    const synced = await GoogleSheetsService.syncExpense(newEx);
    if (synced) {
      OfflineQueueManager.dequeue(newEx.id, 'EXPENSE');
      showNotification(`${data.category}（${data.amount.toLocaleString()}円）を支出登録しました。`);
    } else {
      showSyncError(`Sheetsへの書き込みに失敗しました。オフラインキューに保持します。`);
    }

    try {
      const refreshed = await GoogleSheetsService.fetchExpenses();
      if (refreshed.length > 0) setExpenses(refreshed);
    } catch { /* スキップ */ }

    setActiveTab('dashboard');
  }, [activeFiscalYear, showNotification, showSyncError]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  取消ハンドラ（論理削除）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleCancelTransaction = useCallback(async (id: string) => {
    if (!window.confirm('この入金記録を取り消しますか？\n（論理削除：集計から除外されます）')) return;
    // オプティミスティックUI
    setTransactions((prev: Transaction[]) => prev.map((t: Transaction) => t.id === id ? { ...t, isCancelled: true } : t));
    const ok = await GoogleSheetsService.cancelTransaction(id);
    if (ok) {
      showNotification(`入金履歴（ID: ${id}）を取消しました。`);
    } else {
      // ロールバック
      setTransactions((prev: Transaction[]) => prev.map((t: Transaction) => t.id === id ? { ...t, isCancelled: false } : t));
      showSyncError(`取消に失敗しました（ID: ${id}）。通信環境を確認してください。`);
    }
  }, [showNotification, showSyncError]);

  const handleCancelExpense = useCallback(async (id: string) => {
    if (!window.confirm('この支出記録を取り消しますか？\n（論理削除：集計から除外されます）')) return;
    setExpenses((prev: Expense[]) => prev.map((e: Expense) => e.id === id ? { ...e, isCancelled: true } : e));
    const ok = await GoogleSheetsService.cancelExpense(id);
    if (ok) {
      showNotification(`支出履歴（ID: ${id}）を取消しました。`);
    } else {
      setExpenses((prev: Expense[]) => prev.map((e: Expense) => e.id === id ? { ...e, isCancelled: false } : e));
      showSyncError(`取消に失敗しました（ID: ${id}）。通信環境を確認してください。`);
    }
  }, [showNotification, showSyncError]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  メンバー更新ハンドラ（加入日・脱退日・ステータス）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleMemberUpdate = useCallback(async (updated: Member) => {
    // 1. UI 即時反映
    setMembers((prev: Member[]) => prev.map((m: Member) => m.id === updated.id ? updated : m));
    // 2. Sheets へ書き込み
    const ok = await GoogleSheetsService.updateMember(updated);
    if (ok) {
      showNotification(`${updated.name} の情報を更新しました。`);
    } else {
      // ロールバック: 元の状態に戻す
      showSyncError(`${updated.name} の情報更新に失敗しました。通信環境を確認してください。`);
      // 最新を再フェッチしてロールバック
      try {
        const refreshed = await GoogleSheetsService.fetchMembers();
        if (refreshed.length > 0) setMembers(refreshed);
      } catch { /* スキップ */ }
    }
  }, [showNotification, showSyncError]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  表示用メンバー（組織コンテキストフィルタ）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const displayMembers = useMemo(() => {
    return activeOrgContext === '統合'
      ? members
      : members.filter((m: Member) => m.organization === activeOrgContext || m.organization === '両方');
  }, [members, activeOrgContext]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  レンダリング
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      {/* ── 通知バナー（成功 / エラー） ─────────────────── */}
      {notification && (
        <div className={`mb-4 border-l-4 p-4 rounded shadow-sm flex items-start gap-2 ${
          notification.kind === 'error'
            ? 'bg-red-50 border-red-500'
            : 'bg-green-50 border-green-500'
        }`}>
          {notification.kind === 'error' ? (
            <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          <p className={`text-sm font-medium ${notification.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>
            {notification.msg}
          </p>
        </div>
      )}

      {/* ── タブコンテンツ ───────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <Dashboard
          activeOrgContext={activeOrgContext}
          transactions={transactions}
          expenses={expenses}
          budgets={budgets}
          members={members}
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
            onMemberUpdate={handleMemberUpdate}
          />
        </div>
      )}

      {activeTab === 'expenses' && (
        <ExpenseForm
          onSubmit={handleExpenseSubmit}
          memberships={members}
          expenses={expenses}
          fiscalYear={activeFiscalYear}
        />
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
          members={members}
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

      {/* ── 入金モーダル ─────────────────────────────────── */}
      {selectedMember && (
        <PaymentForm
          member={selectedMember}
          allMembers={members}
          feeItems={sampleFeeItems}
          transactions={transactions}
          onClose={() => setSelectedMember(null)}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </Layout>
  );
}

export default App;
