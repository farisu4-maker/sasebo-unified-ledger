import { Member, FeeItem, Transaction, Expense, Budget, Organization } from '../types';
import { getValidToken } from '../utils/googleAuth';

const SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SPREADSHEET_ID;

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
      
      return data.values.map((row: any[]) => ({
        id: row[0],
        name: row[1],
        kana: row[2],
        birthDate: row[3],
        joinDate: row[4],
        organization: row[5] as Organization | '両方',
        representativeId: row[6] || undefined,
        status: (row[7] as '現役' | '休眠') || '現役',
        leaveDate: row[8] || undefined,
        exemptionFlag: row[9] === 'TRUE' || row[9] === 'true'
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
      const res = await this.fetchApi('M_Budgets!A2:C');
      const data = await res.json();
      if (!data.values) return [];
      
      return data.values.map((row: any[], index: number) => ({
        id: `B${index}`,
        organization: row[0] as Organization | '両方',
        category: row[1],
        amount: parseInt(row[2] || '0', 10),
        fiscalYear: new Date().getFullYear() // 簡易対応
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
        tx.enteredById
      ]];

      const res = await this.fetchApi('T_Transactions!A:I:append?valueInputOption=USER_ENTERED', {
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
        expense.enteredById
      ]];

      const res = await this.fetchApi('T_Expenses!A:J:append?valueInputOption=USER_ENTERED', {
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

}
