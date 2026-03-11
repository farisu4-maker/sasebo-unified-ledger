import React from 'react';
import { Member } from '../types';

interface MembersListProps {
  members: Member[];
  onSelectMember: (member: Member) => void;
  onQuickEntry: (member: Member) => void;
}

export const MembersList: React.FC<MembersListProps> = ({ members, onSelectMember, onQuickEntry }) => {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">拳士一覧（クイックエントリー）</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="uppercase tracking-wider border-b-2 font-medium text-gray-600 bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 border-x">ID</th>
              <th scope="col" className="px-6 py-3 border-x">氏名</th>
              <th scope="col" className="px-6 py-3 border-x">所属</th>
              <th scope="col" className="px-6 py-3 border-x">区分</th>
              <th scope="col" className="px-6 py-3 border-x">アクション</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b hover:bg-indigo-50 transition-colors">
                <td className="px-6 py-4 border-x text-gray-500">{member.id}</td>
                <td className="px-6 py-4 border-x font-semibold text-gray-800">
                  {member.name} 
                  <span className="block text-xs font-normal text-gray-400">{member.kana}</span>
                </td>
                <td className="px-6 py-4 border-x">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      member.organization === '道院' ? 'bg-blue-100 text-blue-800' : 
                      member.organization === 'スポ少' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {member.organization}
                    </span>
                    {member.organization === '両方' && (
                      <span className="text-purple-600" title="二重所属">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 border-x text-gray-600">
                  {member.status} {member.exemptionFlag && <span className="text-red-500 ml-1 text-xs font-bold border border-red-500 rounded px-1">免除</span>}
                </td>
                <td className="px-6 py-4 border-x">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onQuickEntry(member)}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded-md shadow-sm transition-colors text-sm flex items-center"
                      title="当月分の基本会費をワンタップで現金納入記録します"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      クイック
                    </button>
                    <button 
                      onClick={() => onSelectMember(member)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-3 rounded-md shadow-sm transition-colors text-sm"
                    >
                      詳細
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
