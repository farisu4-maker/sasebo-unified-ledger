export type Organization = '道院' | 'スポ少' | '両方';

export interface Member {
  id: string;
  name: string;
  kana: string;       // カタカナ氏名（旧フィールド、後方互換）
  yomigana?: string;  // スプレッドシート L列 から取得するヨミガナ
  role?: string;      // スプレッドシート M列 から取得する役職（支部長 / 副支部長 / 監事 等）
  birthDate: string; // YYYY-MM-DD
  joinDate: string;  // YYYY-MM-DD
  leaveDate?: string; // YYYY-MM-DD (null/undefined if active)
  organization: Organization;
  representativeId?: string; // 世帯代表者のMember_ID
  status: '現役' | '休眠' | '退会';
  exemptionFlag: boolean;
  notes?: string; // 備考
}


export interface FeeCondition {
  ageLimit?: number;
  organization?: string;
  familySizeMin?: number;
}

export interface FeeItem {
  name: string;
  amount: number;
  condition?: FeeCondition;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  memberId: string;
  organization: '道院' | 'スポ少';
  item: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string;
  enteredById: string;
  timestamp: string;
  isCancelled?: boolean; // 取消フラグ（論理削除）
  fiscalYear?: number;
  targetMonth?: string; // 対象月 YYYY-MM 形式（何月分の会費か）
}

export interface Expense {
  id: string;
  date: string;
  organization: '道院' | 'スポ少'; // 「両方」廃止 → 必ずどちらかに帰属
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string;
  enteredById: string;
  timestamp: string;
  isCancelled?: boolean;
  fiscalYear?: number;
}

export interface Budget {
  id: string;
  organization: '道院' | 'スポ少' | '両方';
  category: string;
  amount: number;
  year: number;
  initialBalance?: number;
  finalBalance?: number;
  rowNumber?: number;
}

export interface OpeningBalance {
  organization: '道院' | 'スポ少';
  amount: number;
  year: number;
}


