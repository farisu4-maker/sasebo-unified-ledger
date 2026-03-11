import { Member, FeeItem, Transaction, Expense, Budget, OpeningBalance } from '../types';

export const sampleMembers: Member[] = [
  // M001世帯 (3名: 山田太郎, 山田花子, 山田次郎) - 全員現役で割引対象
  { id: 'M001', name: '山田 太郎', kana: 'ヤマダ タロウ', birthDate: '1980-05-15', joinDate: '2020-04-01', organization: '道院', representativeId: 'M001', status: '現役', exemptionFlag: false, notes: '世帯主' },
  { id: 'M002', name: '山田 花子', kana: 'ヤマダ ハナコ', birthDate: '1982-08-20', joinDate: '2020-04-01', organization: '道院', representativeId: 'M001', status: '現役', exemptionFlag: false, notes: '' },
  { id: 'M003', name: '山田 次郎', kana: 'ヤマダ ジロウ', birthDate: '2010-12-05', joinDate: '2021-04-01', organization: '両方', representativeId: 'M001', status: '現役', exemptionFlag: false, notes: '' },
  
  // M004世帯 (3名だが1名休眠/脱会扱い -> 現役2名で割引対象外へ変動するテスト用)
  { id: 'M004', name: '佐藤 健一', kana: 'サトウ ケンイチ', birthDate: '1975-02-10', joinDate: '2019-05-01', organization: '道院', representativeId: 'M004', status: '現役', exemptionFlag: false, notes: '' },
  { id: 'M005', name: '佐藤 美咲', kana: 'サトウ ミサキ', birthDate: '2008-07-22', joinDate: '2020-04-01', leaveDate: '2025-10-01', organization: 'スポ少', representativeId: 'M004', status: '退会', exemptionFlag: false, notes: '引越のため退会' },
  { id: 'M006', name: '佐藤 浩二', kana: 'サトウ コウジ', birthDate: '2012-03-15', joinDate: '2023-04-01', organization: '両方', representativeId: 'M004', status: '現役', exemptionFlag: false, notes: '' },

  // 単独
  { id: 'M007', name: '鈴木 一郎', kana: 'スズキ イチロウ', birthDate: '1995-11-30', joinDate: '2024-02-01', organization: '道院', status: '現役', exemptionFlag: false, notes: '' },
  { id: 'M008', name: '高橋 涼子', kana: 'タカハシ リョウコ', birthDate: '2015-09-18', joinDate: '2025-04-01', organization: 'スポ少', status: '現役', exemptionFlag: false, notes: '' },
];

export const sampleFeeItems: FeeItem[] = [
  { name: '宗教年費', amount: 7000, updatedAt: '2024-01-01' },
  { name: '財団年費', amount: 4000, condition: { ageLimit: 23 }, updatedAt: '2024-01-01' },
  { name: '財団年費', amount: 5000, condition: { ageLimit: 24 }, updatedAt: '2024-01-01' },
  { name: '信徒香資（月）', amount: 3500, condition: { organization: '道院' }, updatedAt: '2024-01-01' },
  { name: '信徒香資（月・家族割引）', amount: 2500, condition: { organization: '道院', familySizeMin: 3 }, updatedAt: '2024-01-01' },
  { name: 'スポ少会費（月）', amount: 1000, condition: { organization: 'スポ少' }, updatedAt: '2024-01-01' },
];

export const sampleTransactions: Transaction[] = [
  { id: 'T001', date: '2026-03-10', memberId: 'M001', organization: '道院', item: '信徒香資（月）', amount: 3500, paymentMethod: '現金', enteredById: 'U001', timestamp: '2026-03-10T14:30:00Z' },
  { id: 'T002', date: '2026-03-10', memberId: 'M002', organization: 'スポ少', item: 'スポ少会費（月）', amount: 1000, paymentMethod: '現金', enteredById: 'U001', timestamp: '2026-03-10T14:35:00Z' },
  { id: 'T003', date: '2026-03-09', memberId: 'M003', organization: '道院', item: '財団年費', amount: 4000, paymentMethod: '振込', enteredById: 'U001', timestamp: '2026-03-09T09:10:00Z' },
  { id: 'T004', date: '2026-03-09', memberId: 'M003', organization: 'スポ少', item: 'スポ少会費（月）', amount: 1000, paymentMethod: '振込', enteredById: 'U001', timestamp: '2026-03-09T09:11:00Z' },
  { id: 'T005', date: '2026-03-08', memberId: 'M004', organization: '道院', item: '信徒香資（月）', amount: 3500, paymentMethod: '現金', enteredById: 'U001', timestamp: '2026-03-08T18:20:00Z' },
];

export const sampleExpenses: Expense[] = [
  { id: 'E001', date: '2026-03-05', organization: '道院', category: '会場費', description: '3月分武道館使用料', amount: 15000, paymentMethod: '銀行振込', enteredById: 'U001', timestamp: '2026-03-05T10:00:00Z' },
  { id: 'E002', date: '2026-03-02', organization: 'スポ少', category: '備品代', description: 'スポーツドリンク・救急箱補充', amount: 3500, paymentMethod: '現金', enteredById: 'U001', timestamp: '2026-03-02T15:30:00Z' },
  { id: 'E003', date: '2026-02-20', organization: '両方', category: '保険料', description: 'スポーツ安全保険料 (立替分)', amount: 14500, paymentMethod: '現金', enteredById: 'U001', timestamp: '2026-02-20T12:00:00Z' },
];

export const sampleBudgets: Budget[] = [
  { id: 'B001', organization: '道院', category: '会場費', amount: 200000, year: 2026 },
  { id: 'B002', organization: 'スポ少', category: '備品代', amount: 50000, year: 2026 },
  { id: 'B003', organization: '両方', category: '保険料', amount: 30000, year: 2026 },
];

export const sampleOpeningBalances: OpeningBalance[] = [
  { organization: '道院', amount: 500000, year: 2026 },
  { organization: 'スポ少', amount: 300000, year: 2026 },
];


