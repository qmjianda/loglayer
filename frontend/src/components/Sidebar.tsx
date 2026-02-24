import React from 'react';

interface SidebarProps {
  activeView: string;
  onSetActiveView: (view: any) => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSetActiveView, onOpenSettings }) => {
  const icons = [
    {
      id: 'main',
      icon: (
        <>
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
          <path d="M13 2v7h7" />
        </>
      ),
      label: '工作区',
      fill: false
    },
    {
      id: 'search',
      icon: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
      label: '搜索',
      fill: false
    },
    {
      id: 'ai',
      icon: <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
      label: 'AI 助手',
      fill: false
    },
    {
      id: 'stats',
      icon: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
      label: '统计',
      fill: false
    },
    {
      id: 'help',
      icon: <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      label: '帮助与 API',
      fill: false
    },
  ];

  return (
    <div className="w-12 bg-theme-header flex flex-col items-center py-2 shrink-0 h-full border-r border-theme-subtle">
      {icons.map((item) => (
        <button
          key={item.id}
          onClick={() => onSetActiveView(item.id)}
          className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center relative group transition-colors ${activeView === item.id ? 'text-theme-primary' : 'text-theme-muted hover:text-theme-secondary'
            }`}
        >
          {activeView === item.id && (
            <div className="absolute left-0 w-0.5 h-full bg-theme-primary" />
          )}
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6"
            fill={item.fill ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {item.icon}
          </svg>
          <span className="absolute left-14 bg-theme-surface text-theme-primary text-[10px] px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50 shadow-lg">
            {item.label}
          </span>
        </button>
      ))}
      <div className="mt-auto">
        <button 
          onClick={onOpenSettings}
          className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-theme-muted hover:text-theme-secondary transition-colors"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};