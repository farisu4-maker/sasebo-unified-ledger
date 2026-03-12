import { Member } from '../types';

/**
 * 役職の優先順位。配列の先頭ほど上位。
 * この一覧に含まれない役職は「その他」として扱われる。
 */
const ROLE_PRIORITY: string[] = ['支部長', '副支部長', '監事'];

/**
 * sortMembers
 *
 * 拳士リストを以下の優先順位でソートして返します（元配列は変更しない）。
 *  1. 役職順（ROLE_PRIORITY の順番 → その他の役職 → 役職なし・空欄）
 *  2. 拳士ID 昇順（同じ役職ランク内での安定ソート）
 */
export function sortMembers(members: Member[]): Member[] {
  return [...members].sort((a, b) => {
    const ra = a.role ? ROLE_PRIORITY.indexOf(a.role) : -1;
    const rb = b.role ? ROLE_PRIORITY.indexOf(b.role) : -1;

    // ROLE_PRIORITY にある役職のランク（見つからない場合は「その他」扱い）
    const rankA = ra >= 0 ? ra : a.role ? ROLE_PRIORITY.length : ROLE_PRIORITY.length + 1;
    const rankB = rb >= 0 ? rb : b.role ? ROLE_PRIORITY.length : ROLE_PRIORITY.length + 1;

    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id, 'ja');
  });
}
