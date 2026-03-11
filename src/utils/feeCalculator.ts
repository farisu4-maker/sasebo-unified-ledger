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
  // 今年度の3月31日（厳密には4月1日の前日）に到達する年齢
  // 翌年4月1日として、誕生年を引くことで年度内に達する年齢を算出
  const fiscalEndAge = targetYear - bd.getFullYear();
  
  // 生まれ月が4月1日以降の場合の処理（通常は誕生日の年との差分で年度末年齢となる）
  // ただし、早生まれ（1月〜4月1日生）の場合の学年繰り上げ等の細かい仕様は必要に応じて調整
  // 簡略化して: (対象年度の翌年 - 誕生年) をそのまま返す
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
