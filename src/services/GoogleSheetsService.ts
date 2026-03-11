import { Member, Transaction, Expense, Budget, Organization } from '../types';
import { getValidToken } from '../utils/googleAuth';

const SPREADSHEET_ID = (import.meta as any).env.VITE_GOOGLE_SPREADSHEET_ID;

export class GoogleSheetsService {
  
  private static async fetchApi(range: string, config: RequestInit = {}) {
    if (!SPREADSHEET_ID) throw new Error('VITE_GOOGLE_SPREADSHEET_ID is not defined');
    const token = await getValidToken();
    
    return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
      ...config,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...config.headers
      }
    });
  }

  /**
   * メンバー情報をスプレッドシート(M_Members)から取得します
   * A: ID, B: 氏名, C: カナ, D: 生年月日, E: 入会日, F: 所属区分, G: 代表者ID, H: 状態, I: 脱退日, J: 免除フラグ
   */
  static async fetchMembers(): Promise<Member[]> {
    try {
      const res = await this.fetchApi('M_Members!A2:J');
      const data = await res.json();
      if (!data.values) return [];
      
      return data.values.map((row: string[]) => ({
        id: row[0],
        name: row[1],
        kana: row[2],
        birthDate: row[3],
        joinDate: row[4],
        organization: row[5] as Organization | '両方',
        representativeId: row[6] || undefined,
        status: (row[7] as '現役' | '休眠') || '現役',
        leaveDate: row[8] || undefined,
        exemptionFlag: row[9] === 'TRUE' || row[9] === 'true',
        notes: row[10] || ''
      }));
    } catch (e) {
      console.error('Failed to fetch M_Members', e);
      return []; // オフライン時などは空配列（App.tsxでキャッシュを使う考慮が必要）
    }
  }

  /**
   * 予算情報をスプレッドシート(M_Budgets)から取得します
   * A: 組織, B: 勘定科目, C: 年間予算額
   */
  static async fetchBudgets(): Promise<Budget[]> {
    try {
      const res = await this.fetchApi('M_Budgets!A2:F');
      const data = await res.json();
      if (!data.values) return [];
      
      return data.values.map((row: string[], index: number) => ({
        id: `B${index}`,
        rowNumber: index + 2, // 2行目から始まるため
        organization: row[0] as Organization | '両方',
        category: row[1],
        amount: parseInt(row[2] || '0', 10),
        initialBalance: parseInt(row[3] || '0', 10),
        finalBalance: row[4] !== undefined && row[4] !== '' ? parseInt(row[4], 10) : undefined,
        year: parseInt(row[5] || String(new Date().getFullYear()), 10)
      }));
    } catch (e) {
      console.error('Failed to fetch M_Budgets', e);
      return [];
    }
  }

  /**
   * 既存トランザクションIDが存在するかチェックします（冪等性用）
   */
  private static async checkExists(range: string, id: string): Promise<boolean> {
    try {
      const res = await this.fetchApi(range);
      const data = await res.json();
      if (!data.values) return false;
      // 1列目 (A列) が ID の想定
      return data.values.some((row: string[]) => row[0] === id);
    } catch (e) {
      return false; // 通信エラーなどは安全を見てfalse（この後Appendでコケることでキューに残す）
    }
  }

  /**
   * トランザクション（入金）を同期します（冪等性を担保）
   */
  static async syncTransaction(tx: Transaction): Promise<boolean> {
    try {
      // 1. スプレッドシート側のT_Transactionsから指定IDが存在するか確認（二重書き込み防止）
      // 注意: 件数が多い場合はAPI制限を考慮して一括取得＆キャッシュする設計が望ましいが今回要件優先
      const exists = await this.checkExists('T_Transactions!A:A', tx.id);
      if (exists) {
        console.log(`Transaction ${tx.id} already exists in Sheet, skipping append.`);
        return true; 
      }

      // 2. T_Transactions へ追記
      const values = [[
        tx.id,
        tx.timestamp,
        tx.date,
        tx.organization,
        tx.memberId,
        tx.item,
        tx.amount,
        tx.paymentMethod,
        tx.enteredById,
        tx.isCancelled ? 'TRUE' : 'FALSE', // J列
        tx.fiscalYear || new Date().getFullYear() // K列: fiscalYear
      ]];

      const res = await this.fetchApi('T_Transactions!A:K:append?valueInputOption=USER_ENTERED', {
        method: 'POST',
        body: JSON.stringify({ values })
      });

      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (e) {
      console.error('Failed to sync transaction', e);
      return false; // オフラインエラーやサーバー障害の場合はfalseを返し、キューに残す
    }
  }

  /**
   * 支出を同期します（冪等性を担保）
   */
  static async syncExpense(expense: Expense): Promise<boolean> {
    try {
      const exists = await this.checkExists('T_Expenses!A:A', expense.id);
      if (exists) {
        return true; 
      }

      const values = [[
        expense.id,
        expense.timestamp,
        expense.date,
        expense.organization,
        expense.category,
        expense.description || '',
        expense.amount,
        expense.paymentMethod,
        expense.receiptUrl || '',
        expense.enteredById,
        expense.isCancelled ? 'TRUE' : 'FALSE', // 11列目 (K列)
        expense.fiscalYear || new Date().getFullYear() // 12列目 (L列)
      ]];

      const res = await this.fetchApi('T_Expenses!A:L:append?valueInputOption=USER_ENTERED', {
        method: 'POST',
        body: JSON.stringify({ values })
      });

      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (e) {
      console.error('Failed to sync expense', e);
      return false;
    }
  }

  /**
   * トランザクション（入金履歴）を取得します
   */
  static async fetchTransactions(): Promise<Transaction[]> {
    try {
      const res = await this.fetchApi('T_Transactions!A2:K');
      const data = await res.json();
      if (!data.values) return [];
      
      return data.values.map((row: string[]) => ({
        id: row[0],
        timestamp: row[1],
        date: row[2],
        organization: row[3] as '道院' | 'スポ少',
        memberId: row[4],
        item: row[5],
        amount: parseInt(row[6] || '0', 10),
        paymentMethod: row[7],
        enteredById: row[8],
        isCancelled: row[9] === 'TRUE' || row[9] === 'true', // J列
        fiscalYear: parseInt(row[10] || String(new Date().getFullYear()), 10) // K列
      }));
    } catch (e) {
      console.error('Failed to fetch T_Transactions', e);
      return [];
    }
  }

  /**
   * 支出履歴を取得します
   */
  static async fetchExpenses(): Promise<Expense[]> {
    try {
      const res = await this.fetchApi('T_Expenses!A2:L');
      const data = await res.json();
      if (!data.values) return [];
      
      return data.values.map((row: string[]) => ({
        id: row[0],
        timestamp: row[1],
        date: row[2],
        organization: row[3] as '道院' | 'スポ少' | '両方',
        category: row[4],
        description: row[5],
        amount: parseInt(row[6] || '0', 10),
        paymentMethod: row[7],
        receiptUrl: row[8],
        enteredById: row[9],
        isCancelled: row[10] === 'TRUE' || row[10] === 'true', // K列
        fiscalYear: parseInt(row[11] || String(new Date().getFullYear()), 10) // L列
      }));
    } catch (e) {
      console.error('Failed to fetch T_Expenses', e);
      return [];
    }
  }

  static async batchUpdateValues(data: {range: string, values: any[][]}[]) {
    if (!SPREADSHEET_ID) throw new Error('VITE_GOOGLE_SPREADSHEET_ID is not defined');
    const token = await getValidToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data
      })
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
  }

  /**
   * 年度決算処理（Rollover）
   * - 現在の年度の予算に finalBalance を記録
   * - 次の年度の予算枠（initialBalance を設定）を新設
   */
  static async closeFiscalYear(
    finalBalancesUpdates: { rowNumber: number, finalBalance: number }[],
    newBudgets: Budget[]
  ): Promise<boolean> {
    try {
      // 1. Update final balances
      if (finalBalancesUpdates.length > 0) {
        const data = finalBalancesUpdates.map(u => ({
          range: `M_Budgets!E${u.rowNumber}`,
          values: [[u.finalBalance]]
        }));
        await this.batchUpdateValues(data);
      }

      // 2. Append new budgets for next year
      if (newBudgets.length > 0) {
        const values = newBudgets.map(b => [
          b.organization,
          b.category,
          b.amount,
          b.initialBalance || 0,
          '', // finalBalance is empty for new year
          b.year
        ]);
        const appendRes = await this.fetchApi('M_Budgets!A:F:append?valueInputOption=USER_ENTERED', {
          method: 'POST',
          body: JSON.stringify({ values })
        });
        if (!appendRes.ok) throw new Error(await appendRes.text());
      }
      return true;
    } catch (e) {
      console.error('Failed to close fiscal year', e);
      return false;
    }
  }

  /**
   * 取消フラグを更新するための汎用メソッド
   */
  private static async updateCancelFlag(range: string, id: string, cancelColumnIndex: number): Promise<boolean> {
    try {
      // 1. 全件取得してIDの行番号を特定する
      const res = await this.fetchApi(range);
      const data = await res.json();
      if (!data.values) return false;

      const rowIndex = data.values.findIndex((row: string[]) => row[0] === id);
      if (rowIndex === -1) {
        console.error(`ID ${id} not found in ${range} for cancellation.`);
        return false;
      }

      // 2. 該当行の取消フラグ列だけを更新する (rowIndexは0始まり、シート行番号は2始まりを想定)
      // 例: range が T_Transactions!A:A の場合、シート上の行は rowIndex + 1。
      // ただし A:A でヘッダー込みの場合、ヘッダーが0行目でデータが1行目なので、シート行は rowIndex + 1。
      const sheetRow = rowIndex + 1; 
      
      // cancelColumnIndexから列のアルファベットを決定
      const colLetter = String.fromCharCode(65 + cancelColumnIndex);
      // テーブル名を取り出す ('T_Transactions!A:A' -> 'T_Transactions')
      const tableName = range.split('!')[0];
      const updateRange = `${tableName}!${colLetter}${sheetRow}`;

      const updateRes = await this.fetchApi(`${updateRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [['TRUE']]
        })
      });

      if (!updateRes.ok) throw new Error(await updateRes.text());
      return true;

    } catch (e) {
      console.error(`Failed to cancel ${id}`, e);
      return false;
    }
  }

  /**
   * トランザクションを論理削除（取消）します
   */
  static async cancelTransaction(id: string): Promise<boolean> {
    // T_TransactionsのA列でID検索、J列（インデックス9）にフラグ
    return this.updateCancelFlag('T_Transactions!A:A', id, 9);
  }

  /**
   * 支出を論理削除（取消）します
   */
  static async cancelExpense(id: string): Promise<boolean> {
    // T_ExpensesのA列でID検索、K列（インデックス10）にフラグ
    return this.updateCancelFlag('T_Expenses!A:A', id, 10);
  }

}
