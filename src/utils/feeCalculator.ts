import { Member } from '../types';

/**
 * 年度末（翌年3月31日）時点での年齢を計算する
 * @param birthDate 生年月日 (YYYY-MM-DD)
 * @param currentDate 基準日 (YYYY-MM-DD)。省略時は現在日
 * @returns 該当年度末時点の年齢
 */
export const calculateAgeAtEndOfFiscalYear = (birthDate: string, currentDate: Date = new Date()): number => {
  const bd = new Date(birthDate);
  const targetYear = currentDate.getMonth() >= 3 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();

  // 年度末（targetYear年3月31日）時点で誕生日を迎えているかどうかで年齢を調整する。
  // 誕生月が1〜3月（月インデックス0〜2）なら年度末までに誕生日到達済み。
  // 4〜12月生まれは年度末時点でまだ誕生日を迎えていないため、年齢を1歳減らす
  // （この調整がないと大多数の会員で年齢が実際より1歳多く計算されてしまう）。
  const hasHadBirthdayByFiscalYearEnd = bd.getMonth() <= 2;
  const fiscalEndAge = targetYear - bd.getFullYear() - (hasHadBirthdayByFiscalYearEnd ? 0 : 1);

  return fiscalEndAge;
};

/**
 * 財団年費を判定する（23歳以下：4000円、24歳以上：5000円）
 * @param age 年度末時点の年齢
 * @returns 財団年費
 */
export const determineFoundationFee = (age: number): number => {
  return age <= 23 ? 4000 : 5000;
};

/**
 * メンバーに対して現在の財団年費を算出するラッパー関数
 * @param member メンバー情報
 * @returns 財団年費
 */
export const calculateFoundationFeeForMember = (member: Member): number => {
  const age = calculateAgeAtEndOfFiscalYear(member.birthDate);
  return determineFoundationFee(age);
};
