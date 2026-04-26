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
   * 数値文字列をパースする（カンマや円マーク等を除去、全角対応）
   */
  private static parseNumber(val: string | undefined | null): number {
    if (!val) return 0;
    let numStr = val.toString();
    // 全角数字を半角に変換
    numStr = numStr.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    numStr = numStr.replace(/[¥,，、]/g, '').trim();
    const parsed = parseInt(numStr, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * 日付文字列を YYYY-MM-DD 形式に標準化する
   * Google Sheets から 'YYYY/M/D' 等で返ってくる場合や和暦(R7.4.20)を考慮
   * 年が省略されている場合（例: '6月25日'）は fallbackYear を補完する
   */
  private static standardizeDate(dateStr: string | undefined, fallbackYear?: number): string {
    if (!dateStr) return '';
    let trimmed = dateStr.trim();
    
    // 全角英数字を半角に変換
    trimmed = trimmed.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    trimmed = trimmed.replace(/　/g, ' ').trim();
    
    // 和暦変換 R: 令和, H: 平成, S: 昭和
    const eraMatch = trimmed.match(/^([RHS])(\d{1,2})\s*[\.\/]\s*(\d{1,2})\s*[\.\/]\s*(\d{1,2})$/i);
    if (eraMatch) {
      const era = eraMatch[1].toUpperCase();
      let year = parseInt(eraMatch[2], 10);
      const m = eraMatch[3].padStart(2, '0');
      const d = eraMatch[4].padStart(2, '0');
      if (era === 'R') year += 2018;
      else if (era === 'H') year += 1988;
      else if (era === 'S') year += 1925;
      return `${year}-${m}-${d}`;
    }

    // YYYY/M/D または YYYY-M-D
    const parts = trimmed.replace(/\//g, '-').split('-');
    if (parts.length >= 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].substring(0, 2).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // M月D日 または M/D（年が省略されているケース）、オプションで時刻 (HH:mm または HH:mm:ss)
    const monthDayMatch = trimmed.match(/^(\d{1,2})\s*[月\/]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?$/);
    if (monthDayMatch) {
      let y = fallbackYear || new Date().getFullYear();
      const mNum = parseInt(monthDayMatch[1], 10);
      const m = String(mNum).padStart(2, '0');
      const d = monthDayMatch[2].padStart(2, '0');
      
      // 年度（4月始まり）の補正: 1〜3月はカレンダー年では翌年となる
      if (mNum >= 1 && mNum <= 3 && fallbackYear) {
        y += 1;
      }
      
      const time = monthDayMatch[3] ? ` ${monthDayMatch[3]}` : '';
      return `${y}-${m}-${d}${time}`;
    }

    return trimmed;
  }

  /**
   * 対象月文字列を YYYY-MM 形式に標準化する
   */
  private static formatTargetMonth(monthStr: string | undefined): string | undefined {
    if (!monthStr || monthStr.trim() === '') return undefined;
    let trimmed = monthStr.trim();
    
    trimmed = trimmed.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    trimmed = trimmed.replace(/　/g, ' ').trim();
    
    // 和暦変換 例: R7.4, H30/12
    const eraMatch = trimmed.match(/^([RHS])(\d{1,2})\s*[\.\/]\s*(\d{1,2})/i);
    if (eraMatch) {
      const era = eraMatch[1].toUpperCase();
      let year = parseInt(eraMatch[2], 10);
      const m = eraMatch[3].padStart(2, '0');
      if (era === 'R') year += 2018;
      else if (era === 'H') year += 1988;
      else if (era === 'S') year += 1925;
      return `${year}-${m}`;
    }
    
    const parts = trimmed.replace(/\//g, '-').split('-');
    if (parts.length >= 2) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      return `${y}-${m}`;
    }
    
    return trimmed;
  }

  // ============================================================
  //  M_Members
  //  A: ID, B: 氏名, C: カナ, D: 生年月日, E: 入会日,
  //  F: 所属区分, G: 代表者ID, H: 状態, I: 脱退日,
  //  J: 免除フラグ, K: 備考, L: ヨミガナ, M: 役職
  // ============================================================

  static async fetchMembers(): Promise<Member[]> {
    try {
      const res = await this.fetchApi('M_Members!A2:M');
      const data = await res.json();
      if (!data.values) return [];

      return data.values.map((row: string[]) => ({
        id: row[0],
        name: row[1],
        kana: row[2],
        birthDate: this.standardizeDate(row[3]),
        joinDate: this.standardizeDate(row[4]),
        organization: row[5] as Organization | '両方',
        representativeId: row[6] || undefined,
        status: (row[7] as '現役' | '休眠' | '退会') || '現役',
        leaveDate: row[8] ? this.standardizeDate(row[8]) : undefined,
        exemptionFlag: row[9] === 'TRUE' || row[9] === 'true',
        notes: row[10] || '',
        yomigana: row[11] || undefined,
        role: row[12] || undefined,        // M列：役職
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
      const res = await this.fetchApi('M_Members!A:A');
      const data = await res.json();
      if (!data.values) return false;

      const rowIndex = data.values.findIndex((row: string[]) => row[0] === member.id);
      if (rowIndex === -1) {
        console.error(`Member ID ${member.id} not found in M_Members`);
        return false;
      }
      const sheetRow = rowIndex + 1;

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
        member.notes || '',
        member.yomigana || '',  // L列：ヨミガナ
        member.role || '',      // M列：役職
      ]];

      const updateRes = await this.batchUpdateValues([{
        range: `M_Members!A${sheetRow}:M${sheetRow}`,
        values
      }]);

      return updateRes.ok;
    } catch (e) {
      console.error('Failed to update member', e);
      return false;
    }
  }

  /**
   * メンバーを新規追加します（M_Membersに新しい行をAPPEND）
   */
  static async appendMember(member: Member): Promise<boolean> {
    try {
      const exists = await this.checkExists('M_Members!A:A', member.id);
      if (exists) {
        console.log(`Member ${member.id} already exists`);
        return true;
      }

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
        member.notes || '',
        member.yomigana || '',
        member.role || '',
      ]];

      const res = await this.fetchApi('M_Members!A:M:append?valueInputOption=USER_ENTERED', {
        method: 'POST',
        body: JSON.stringify({ values })
      });

      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (e) {
      console.error('Failed to append member', e);
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
        amount: this.parseNumber(row[2]),
        initialBalance: this.parseNumber(row[3]),
        finalBalance: row[4] !== undefined && row[4] !== '' ? this.parseNumber(row[4]) : undefined,
        year: this.parseNumber(row[5]) || new Date().getFullYear()
      }));
    } catch (e) {
      console.error('Failed to fetch M_Budgets', e);
      return [];
    }
  }

  // ============================================================
  //  T_Transactions
  //  A: ID, B: timestamp, C: 日付, D: 組織, E: メンバーID,
  //  F: 費目, G: 金額, H: 支払方法, I: 領収書URL, J: 入力者ID,
  //  K: 取消フラグ, L: 年度, M: 対象月(YYYY-MM)
  // ============================================================

  static async fetchTransactions(): Promise<Transaction[]> {
    try {
      const res = await this.fetchApi('T_Transactions!A2:M');
      const data = await res.json();
      if (!data.values) return [];

      return data.values.map((row: string[]) => {
        const fiscalYear = this.parseNumber(row[11]) || new Date().getFullYear();
        return {
          id: row[0],
          timestamp: this.standardizeDate(row[1], fiscalYear) || row[1],
          date: this.standardizeDate(row[2], fiscalYear),
          organization: row[3] as '道院' | 'スポ少',
          memberId: row[4],
          item: row[5],
          amount: this.parseNumber(row[6]),
          paymentMethod: row[7],
          receiptUrl: row[8],
          enteredById: row[9],
          isCancelled: row[10] === 'TRUE' || row[10] === 'true',
          fiscalYear,
          targetMonth: this.formatTargetMonth(row[12]) || undefined
        };
      });
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
        tx.receiptUrl || '',
        tx.enteredById,
        tx.isCancelled ? 'TRUE' : 'FALSE',      // K列
        tx.fiscalYear || new Date().getFullYear(), // L列
        tx.targetMonth || ''                       // M列: 対象月
      ]];

      const res = await this.fetchApi('T_Transactions!A:M:append?valueInputOption=USER_ENTERED', {
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
   * トランザクション情報を更新します（T_Transactionsの該当行を全列UPDATE）
   */
  static async updateTransaction(tx: Transaction): Promise<boolean> {
    try {
      const res = await this.fetchApi('T_Transactions!A:A');
      const data = await res.json();
      if (!data.values) return false;

      const rowIndex = data.values.findIndex((row: string[]) => row[0] === tx.id);
      if (rowIndex === -1) {
        console.error(`Transaction ID ${tx.id} not found in T_Transactions`);
        return false;
      }
      const sheetRow = rowIndex + 1;

      const values = [[
        tx.id,
        tx.timestamp,
        tx.date,
        tx.organization,
        tx.memberId,
        tx.item,
        tx.amount,
        tx.paymentMethod,
        tx.receiptUrl || '',
        tx.enteredById,
        tx.isCancelled ? 'TRUE' : 'FALSE',
        tx.fiscalYear || new Date().getFullYear(),
        tx.targetMonth || ''
      ]];

      const updateRes = await this.batchUpdateValues([{
        range: `T_Transactions!A${sheetRow}:M${sheetRow}`,
        values
      }]);

      return updateRes.ok;
    } catch (e) {
      console.error('Failed to update transaction', e);
      return false;
    }
  }

  /**
   * トランザクションを論理削除（取消）します
   * J列（インデックス9）の取消フラグを TRUE に
   */
  static async cancelTransaction(id: string): Promise<boolean> {
    return this.updateCancelFlag('T_Transactions!A:A', id, 10);
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

      return data.values.map((row: string[]) => {
        const fiscalYear = this.parseNumber(row[11]) || new Date().getFullYear();
        return {
          id: row[0],
          timestamp: this.standardizeDate(row[1], fiscalYear) || row[1],
          date: this.standardizeDate(row[2], fiscalYear),
          organization: row[3] as '道院' | 'スポ少' | '両方',
          category: row[4],
          description: row[5],
          amount: this.parseNumber(row[6]),
          paymentMethod: row[7],
          receiptUrl: row[8],
          enteredById: row[9],
          isCancelled: row[10] === 'TRUE' || row[10] === 'true',
          fiscalYear
        };
      });
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
   * 支出情報を更新します（T_Expensesの該当行を全列UPDATE）
   */
  static async updateExpense(expense: Expense): Promise<boolean> {
    try {
      const res = await this.fetchApi('T_Expenses!A:A');
      const data = await res.json();
      if (!data.values) return false;

      const rowIndex = data.values.findIndex((row: string[]) => row[0] === expense.id);
      if (rowIndex === -1) {
        console.error(`Expense ID ${expense.id} not found in T_Expenses`);
        return false;
      }
      const sheetRow = rowIndex + 1;

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
        expense.isCancelled ? 'TRUE' : 'FALSE',
        expense.fiscalYear || new Date().getFullYear()
      ]];

      const updateRes = await this.batchUpdateValues([{
        range: `T_Expenses!A${sheetRow}:L${sheetRow}`,
        values
      }]);

      return updateRes.ok;
    } catch (e) {
      console.error('Failed to update expense', e);
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

  /**
   * JSONバックアップからデータを復元（既存データを全消去して上書き）
   */
  static async restoreData(data: { members: Member[], budgets: Budget[], transactions: Transaction[], expenses: Expense[] }): Promise<boolean> {
    try {
      if (!SPREADSHEET_ID) throw new Error('VITE_GOOGLE_SPREADSHEET_ID is not defined');
      const token = await getValidToken();

      // 1. Clear existing data (keeping headers)
      const batchClearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchClear`;
      await fetch(batchClearUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ranges: [
            'M_Members!A2:Z',
            'M_Budgets!A2:Z',
            'T_Transactions!A2:Z',
            'T_Expenses!A2:Z'
          ]
        })
      });

      // 2. Prepare data for batchUpdate
      const membersData = data.members.map(m => [
          m.id, m.name, m.kana, m.birthDate, m.joinDate, m.organization,
          m.representativeId || '', m.status, m.leaveDate || '', m.exemptionFlag ? 'TRUE' : 'FALSE',
          m.notes || '', m.yomigana || '', m.role || ''
      ]);
      const budgetsData = data.budgets.map(b => [
          b.organization, b.category, b.amount, b.initialBalance || 0, b.finalBalance !== undefined ? b.finalBalance : '', b.year
      ]);
      const txData = data.transactions.map(t => [
          t.id, t.timestamp, t.date, t.organization, t.memberId, t.item, t.amount, t.paymentMethod, t.receiptUrl || '', t.enteredById,
          t.isCancelled ? 'TRUE' : 'FALSE', t.fiscalYear || new Date().getFullYear(), t.targetMonth || ''
      ]);
      const expData = data.expenses.map(e => [
          e.id, e.timestamp, e.date, e.organization, e.category, e.description || '', e.amount, e.paymentMethod, e.receiptUrl || '', e.enteredById,
          e.isCancelled ? 'TRUE' : 'FALSE', e.fiscalYear || new Date().getFullYear()
      ]);

      const updates: { range: string, values: any[][] }[] = [];
      if (membersData.length > 0) updates.push({ range: 'M_Members!A2', values: membersData });
      if (budgetsData.length > 0) updates.push({ range: 'M_Budgets!A2', values: budgetsData });
      if (txData.length > 0) updates.push({ range: 'T_Transactions!A2', values: txData });
      if (expData.length > 0) updates.push({ range: 'T_Expenses!A2', values: expData });

      // 3. Batch Update
      if (updates.length > 0) {
        await this.batchUpdateValues(updates);
      }
      return true;
    } catch (e) {
      console.error('Failed to restore data', e);
      return false;
    }
  }
  static async uploadReceiptImage(base64Image: string, fileName: string): Promise<string> {
    const uploadUrl = (import.meta as any).env.VITE_GAS_UPLOAD_URL;
    if (!uploadUrl) {
      throw new Error('VITE_GAS_UPLOAD_URL is not defined in environment variables (.env.local).');
    }

    const payload = {
      imageBase64: base64Image,
      filename: fileName,
      folderName: 'Receipts'
    };

    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
      // GAS requires application/x-www-form-urlencoded or text/plain for simple CORS requests
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }

    const responseData = await res.json();
    if (responseData.status === 'error') {
      throw new Error(responseData.message || 'Unknown upload error');
    }
    
    return responseData.url;
  }
}
