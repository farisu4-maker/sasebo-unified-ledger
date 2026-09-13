import React from 'react';
import { Member, Transaction, Organization } from '../types';
import { PaymentStatusMatrix } from './PaymentStatusMatrix';

interface PaymentStatusPageProps {
  members: Member[];
  transactions: Transaction[];
  fiscalYear: number;
  activeOrgContext: Organization | '統合';
  onTransactionUpdate?: (updated: Transaction) => void | Promise<void>;
}

/**
 * 拳士別・月別の納入チェック表（済/未納が一目でわかる一覧）。
 * 以前は「監査・レポート」タブの中の更にサブタブという2階層下に
 * 埋もれていたため、「拳士・入金」の直下に単独ページとして配置している。
 */
export const PaymentStatusPage: React.FC<PaymentStatusPageProps> = ({
  members,
  transactions,
  fiscalYear,
  activeOrgContext,
  onTransactionUpdate
}) => {
  const showDoin = activeOrgContext === '統合' || activeOrgContext === '道院';
  const showSpo = activeOrgContext === '統合' || activeOrgContext === 'スポ少';

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-800">納入チェック表</h2>
        <p className="text-sm text-gray-500">令和{fiscalYear - 2018}年度（{fiscalYear}年4月〜{fiscalYear + 1}年3月）</p>
      </div>

      {showDoin && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h3 className="text-md font-bold text-gray-800 mb-3 border-l-4 border-blue-600 pl-2">
            少林寺拳法佐世保道院
          </h3>
          <PaymentStatusMatrix
            members={members}
            transactions={transactions}
            fiscalYear={fiscalYear}
            org="道院"
            onTransactionUpdate={onTransactionUpdate}
          />
        </div>
      )}

      {showSpo && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h3 className="text-md font-bold text-gray-800 mb-3 border-l-4 border-emerald-600 pl-2">
            佐世保西スポーツ少年団
          </h3>
          <PaymentStatusMatrix
            members={members}
            transactions={transactions}
            fiscalYear={fiscalYear}
            org="スポ少"
            onTransactionUpdate={onTransactionUpdate}
          />
        </div>
      )}
    </div>
  );
};
