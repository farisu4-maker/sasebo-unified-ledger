import React from 'react';
import { Organization } from '../types';
import { LayoutDashboard, Users, ReceiptText as Receipt, FileText, Menu, X, Settings as SettingsIcon } from 'lucide-react'; // Fallback icons or adjust based on actual import availability
interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeOrgContext: Organization | '統合';
  onOrgContextChange: (org: Organization | '統合') => void;
  activeFiscalYear: number;
  onFiscalYearChange: (year: number) => void;
  pendingSyncCount: number;
  isSyncing: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  activeOrgContext,
  onOrgContextChange,
  activeFiscalYear,
  onFiscalYearChange,
  pendingSyncCount,
  isSyncing
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // コンテキストに基づくテーマ色設定
  const getThemeColor = () => {
    switch(activeOrgContext) {
      case '道院': return 'bg-blue-600 border-blue-700';
      case 'スポ少': return 'bg-emerald-600 border-emerald-700';
      default: return 'bg-indigo-700 border-indigo-800'; // 統合
    }
  };

  const getThemeTextHover = () => {
    switch(activeOrgContext) {
      case '道院': return 'hover:text-blue-600';
      case 'スポ少': return 'hover:text-emerald-600';
      default: return 'hover:text-indigo-600';
    }
  };
  
  const getThemeBgActive = () => {
    switch(activeOrgContext) {
      case '道院': return 'bg-blue-50 text-blue-700';
      case 'スポ少': return 'bg-emerald-50 text-emerald-700';
      default: return 'bg-indigo-50 text-indigo-700';
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'ダッシュボード', icon: <LayoutDashboard size={20} /> },
    { id: 'members', label: '拳士・入金', icon: <Users size={20} /> },
    { id: 'expenses', label: '支出記録', icon: <Receipt size={20} /> },
    { id: 'reports', label: '監査・レポート', icon: <FileText size={20} /> },
    { id: 'journal', label: '印刷（仕訳帳）', icon: <FileText size={20} /> },
    { id: 'history', label: '履歴一覧・取消', icon: <FileText size={20} /> }, // History added
    { id: 'settings', label: 'システム設定', icon: <SettingsIcon size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className={`md:hidden text-white shadow-md ${getThemeColor()} transition-colors duration-300 z-20 sticky top-0`}>
        <div className="px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-base font-bold tracking-tight opacity-95">少林寺拳法 佐世保道院・佐世保西スポーツ少年団 統合台帳</h1>
            <p className="text-[10px] opacity-80 mt-0.5">{activeOrgContext}モード</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Sync Indicator Mobile */}
            <div className="flex items-center" title={isSyncing ? '同期中...' : pendingSyncCount > 0 ? `${pendingSyncCount}件の未送信データ` : '同期完了'}>
              {isSyncing ? (
                <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
              ) : pendingSyncCount > 0 ? (
                <div className="relative flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8" /></svg>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                </div>
              ) : (
                <svg className="w-6 h-6 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar (Desktop) / Mobile Menu */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-30 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className={`px-5 py-4 text-white ${getThemeColor()} transition-colors duration-300 hidden md:flex justify-between items-start`}>
          <h1 className="text-base font-bold tracking-tight leading-snug opacity-95">少林寺拳法 佐世保道院<br/>佐世保西スポーツ少年団<br/>統合台帳</h1>
          
          {/* Sync Indicator Desktop */}
          <div className="mt-1" title={isSyncing ? '同期中...' : pendingSyncCount > 0 ? `${pendingSyncCount}件の未送信データ` : '同期完了'}>
            {isSyncing ? (
              <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
            ) : pendingSyncCount > 0 ? (
              <div className="relative">
                <svg className="w-6 h-6 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3V8" /></svg>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 text-[8px] items-center justify-center text-white">{pendingSyncCount > 9 ? '9+' : pendingSyncCount}</span>
                </span>
              </div>
            ) : (
              <svg className="w-6 h-6 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
        </div>

        {/* 団体・年度切り替えセレクタ */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">表示コンテキスト</p>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button 
                onClick={() => onOrgContextChange('統合')}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${activeOrgContext === '統合' ? 'bg-white shadow text-indigo-700' : 'text-gray-600'}`}
              >
                統合
              </button>
              <button 
                onClick={() => onOrgContextChange('道院')}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${activeOrgContext === '道院' ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}
              >
                道院
              </button>
              <button 
                onClick={() => onOrgContextChange('スポ少')}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${activeOrgContext === 'スポ少' ? 'bg-white shadow text-emerald-700' : 'text-gray-600'}`}
              >
                スポ少
              </button>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">年度管理</p>
            </div>
            <select
              value={activeFiscalYear}
              onChange={(e) => onFiscalYearChange(Number(e.target.value))}
              className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
            >
              {[activeFiscalYear - 1, activeFiscalYear, activeFiscalYear + 1].map(year => (
                <option key={year} value={year}>{year}年度</option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation block */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`
                w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${activeTab === item.id 
                  ? getThemeBgActive() 
                  : `text-gray-600 hover:bg-gray-100 ${getThemeTextHover()}`}
              `}
            >
              <span className={`mr-3 ${activeTab === item.id ? '' : 'text-gray-400'}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center text-sm font-medium text-gray-500">
            <span className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 font-bold text-gray-600">A</span>
            会計管理者
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full md:max-w-[calc(100vw-16rem)] relative pb-24 md:pb-8">
        {/* 背景の装飾 */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-gray-100 opacity-50 pointer-events-none -z-10"></div>
        {children}
      </main>

      {/* Mobile Bottom Navigation (for quick access) */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center w-full py-3 ${
              activeTab === item.id ? getThemeTextHover().replace('hover:', '') : 'text-gray-400'
            }`}
          >
            {item.icon}
            <span className="text-[10px] mt-1 font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
