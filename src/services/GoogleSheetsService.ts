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

  // ============================================================
  //  M_Members
  //  A: ID, B: 氏名, C: カナ, D: 生年月日, E: 入会日,
  //  F: 所属区分, G: 代表者ID, H: 状態, I: 脱退日,
  //  J: 免除フラグ, K: 備考
  // ============================================================

  static async fetchMembers(): Promise<Member[]> {
    try {
      const res = await this.fetchApi('M_Members!A2:K');
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
        status: (row[7] as '現役' | '休眠' | '退会') || '現役',
        leaveDate: row[8] || undefined,
        exemptionFlag: row[9] === 'TRUE' || row[9] === 'true',
        notes: row[10] || ''
      }));
    } catch (e) {
      console.error('Failed to fetch M_Members', e);
      return [];
    }
  }

  /**
   * メンバー情報を更新します（M_Membersの該当行を全列UPDATE）
   * ID検索 → 行番号特定 → batchUpdate
   */
  static async updateMember(member: Member): Promise<boolean> {
    try {
      // A列でID検索（ヘッダー込み）
      const res = await this.fetchApi('M_Members!A:A');
      const data = await res.json();
      if (!data.values) return false;

      // row[0] = ヘッダー "ID", row[1] 以降がデータ → シート行番号 = index + 1
      const rowIndex = data.values.findIndex((row: string[]) => row[0] === member.id);
      if (rowIndex === -1) {
        console.error(`Member ID ${member.id} not found in M_Members`);
        return false;
      }
      const sheetRow = rowIndex + 1; // 1-indexed

      const values = [[
        member.id,
        member.name,
        member.kana,
        member.birthDate,
        member.joinDate,
        member.organization,
        member.representativeId || '',
        member.status,
        member.leaveDate || '',
        member.exemptionFlag ? 'TRUE' : 'FALSE',
        member.notes || ''
      ]];

      const updateRes = await this.batchUpdateValues([{
        range: `M_Members!A${sheetRow}:K${sheetRow}`,
        values
      }]);

      return updateRes.ok;
    } catch (e) {
      console.error('Failed to update member', e);
      return false;
    }
  }

  // ============================================================
  //  M_Budgets
  //  A: 組織, B: 勘定科目, C: 年間予算額, D: 期首繰越,
  //  E: 期末確定額, F: 年度
  // ============================================================

  static async fetchBudgets(): Promise<Budget[]> {
    try {
      const res = await this.fetchApi('M_Budgets!A2:F');
      const data = await res.json();
      if (!data.values) return [];

      return data.values.map((row: string[], index: number) => ({
        id: `B${index}`,
        rowNumber: index + 2,
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

  // ============================================================
  //  T_Transactions
  //  A: ID, B: timestamp, C: 日付, D: 組織, E: メンバーID,
  //  F: 費目, G: 金額, H: 支払方法, I: 入力者ID,
  //  J: 取消フラグ, K: 年度, L: 対象月(YYYY-MM)
  // ============================================================

  static async fetchTransactions(): Promise<Transaction[]> {
    try {
      const res = await this.fetchApi('T_Transactions!A2:L');
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
        isCancelled: row[9] === 'TRUE' || row[9] === 'true',
        fiscalYear: parseInt(row[10] || String(new Date().getFullYear()), 10),
        targetMonth: row[11] || undefined
      }));
    } catch (e) {
      console.error('Failed to fetch T_Transactions', e);
      return [];
    }
  }

  /**
   * トランザクション（入金）を同期します（冪等性を担保）
   */
  static async syncTransaction(tx: Transaction): Promise<boolean> {
    try {
      const exists = await this.checkExists('T_Transactions!A:A', tx.id);
      if (exists) {
        console.log(`Transaction ${tx.id} already exists in Sheet, skipping append.`);
        return true;
      }

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
        tx.isCancelled ? 'TRUE' : 'FALSE',      // J列
        tx.fiscalYear || new Date().getFullYear(), // K列
        tx.targetMonth || ''                       // L列: 対象月
      ]];

      const res = await this.fetchApi('T_Transactions!A:L:append?valueInputOption=USER_ENTERED', {
        method: 'POST',
        body: JSON.stringify({ values })
      });

      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (e) {
      console.error('Failed to sync transaction', e);
      return false;
    }
  }

  /**
   * トランザクションを論理削除（取消）します
   * J列（インデックス9）の取消フラグを TRUE に
   */
  static async cancelTransaction(id: string): Promise<boolean> {
    return this.updateCancelFlag('T_Transactions!A:A', id, 9);
  }

  // ============================================================
  //  T_Expenses
  //  A: ID, B: timestamp, C: 日付, D: 組織, E: 勘定科目,
  //  F: 摘要, G: 金額, H: 支払方法, I: 領収書URL,
  //  J: 入力者ID, K: 取消フラグ, L: 年度
  // ============================================================

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
        isCancelled: row[10] === 'TRUE' || row[10] === 'true',
        fiscalYear: parseInt(row[11] || String(new Date().getFullYear()), 10)
      }));
    } catch (e) {
      console.error('Failed to fetch T_Expenses', e);
      return [];
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
        expense.isCancelled ? 'TRUE' : 'FALSE',      // K列
        expense.fiscalYear || new Date().getFullYear() // L列
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
   * 支出を論理削除（取消）します
   * K列（インデックス10）の取消フラグを TRUE に
   */
  static async cancelExpense(id: string): Promise<boolean> {
    return this.updateCancelFlag('T_Expenses!A:A', id, 10);
  }

  // ============================================================
  //  年度決算処理（Rollover）
  // ============================================================

  static async closeFiscalYear(
    finalBalancesUpdates: { rowNumber: number, finalBalance: number }[],
    newBudgets: Budget[]
  ): Promise<boolean> {
    try {
      if (finalBalancesUpdates.length > 0) {
        const data = finalBalancesUpdates.map(u => ({
          range: `M_Budgets!E${u.rowNumber}`,
          values: [[u.finalBalance]]
        }));
        await this.batchUpdateValues(data);
      }

      if (newBudgets.length > 0) {
        const values = newBudgets.map(b => [
          b.organization,
          b.category,
          b.amount,
          b.initialBalance || 0,
          '',
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
   * 決算取り消し（Undo Rollover）
   *  1. 対象年度（fiscalYear）の final_balance 列（E列）を空白にクリア
   *  2. 次年度（fiscalYear+1）の「次年度繰越（システム生成）」行を空白行で上書き（論理削除）
   */
  static async undoFiscalYear(fiscalYear: number): Promise<boolean> {
    try {
      const res = await this.fetchApi('M_Budgets!A:F');
      const data = await res.json();
      if (!data.values) return false;

      const rows: string[][] = data.values;
      const clearRanges: { range: string; values: string[][] }[] = [];

      rows.forEach((row, idx) => {
        const rowNum = idx + 1; // 1-indexed sheet row
        const rowYear = parseInt(row[5] ?? '', 10);
        const org     = row[0] ?? '';
        const cat     = row[1] ?? '';

        // ① 対象年度の final_balance（E列）をクリア
        if (rowYear === fiscalYear && (org === '道院' || org === 'スポ少') && row[4] !== '') {
          clearRanges.push({ range: `M_Budgets!E${rowNum}`, values: [['']] });
        }

        // ② 次年度の「次年度繰越（システム生成）」行を空白で上書き（削除相当）
        if (rowYear === fiscalYear + 1 && cat === '次年度繰越（システム生成）') {
          clearRanges.push({
            range: `M_Budgets!A${rowNum}:F${rowNum}`,
            values: [['', '', '', '', '', '']]
          });
        }
      });

      if (clearRanges.length === 0) {
        // 取り消し対象なし（決算未実行）
        return false;
      }

      await this.batchUpdateValues(clearRanges);
      return true;
    } catch (e) {
      console.error('Failed to undo fiscal year', e);
      return false;
    }
  }

  // ============================================================
  //  共通ユーティリティ
  // ============================================================

  /**
   * 既存IDが存在するかチェック（冪等性用）
   * A列のみ取得しIDを検索する
   */
  private static async checkExists(range: string, id: string): Promise<boolean> {
    try {
      const res = await this.fetchApi(range);
      const data = await res.json();
      if (!data.values) return false;
      return data.values.some((row: string[]) => row[0] === id);
    } catch (e) {
      return false;
    }
  }

  /**
   * 取消フラグを TRUE に更新する汎用メソッド
   * range: 例 'T_Transactions!A:A'（ヘッダー込みで取得）
   * cancelColumnIndex: 0始まりの列インデックス（J=9, K=10 など）
   *
   * 【行番号の計算】
   *  fetchApi で A:A を取得すると values[0] がヘッダー行になる。
   *  データ先頭は values[1]。シート上での行番号 = findIndex の結果 + 1
   */
  private static async updateCancelFlag(range: string, id: string, cancelColumnIndex: number): Promise<boolean> {
    try {
      const res = await this.fetchApi(range);
      const data = await res.json();
      if (!data.values) return false;

      const rowIndex = data.values.findIndex((row: string[]) => row[0] === id);
      if (rowIndex === -1) {
        console.error(`ID ${id} not found in ${range} for cancellation.`);
        return false;
      }

      // values[0] がヘッダー行なので、rowIndex=1 → シート2行目
      const sheetRow = rowIndex + 1;
      const colLetter = String.fromCharCode(65 + cancelColumnIndex);
      const tableName = range.split('!')[0];
      const updateRange = `${tableName}!${colLetter}${sheetRow}`;

      const updateRes = await this.fetchApi(`${updateRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({ values: [['TRUE']] })
      });

      if (!updateRes.ok) throw new Error(await updateRes.text());
      return true;
    } catch (e) {
      console.error(`Failed to cancel ${id}`, e);
      return false;
    }
  }

  /**
   * batchUpdate 共通メソッド
   */
  static async batchUpdateValues(data: { range: string, values: any[][] }[]) {
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
}
