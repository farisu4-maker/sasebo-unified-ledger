export type Organization = '道院' | 'スポ少' | '両方';

export interface Member {
  id: string;
  name: string;
  kana: string;
  birthDate: string; // YYYY-MM-DD
  joinDate: string;  // YYYY-MM-DD
  leaveDate?: string; // YYYY-MM-DD (null/undefined if active)
  organization: Organization;
  representativeId?: string; // 世帯代表者のMember_ID
  status: '現役' | '休眠' | '退会';
  exemptionFlag: boolean;
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
  enteredById: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  date: string;
  organization: '道院' | 'スポ少' | '両方';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string; // ブラウザ版では一旦Base64などのURL
  enteredById: string;
  timestamp: string;
}

export interface Budget {
  id: string;
  organization: '道院' | 'スポ少' | '両方';
  category: string;
  amount: number;
  year: number;
}

export interface OpeningBalance {
  organization: '道院' | 'スポ少';
  amount: number;
  year: number;
}


