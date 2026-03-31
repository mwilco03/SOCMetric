import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab, onChange }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className="w-full">
      <div className="border-b border-gray-700">
        <nav className="flex -mb-px space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'border-kpi-blue text-kpi-blue'
                  : 'border-transparent text-gray-400 hover:text-gray-200',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-4">{activeTabData?.content}</div>
    </div>
  );
};

interface VerticalTabsProps extends TabsProps {}

export const VerticalTabs: React.FC<VerticalTabsProps> = ({
  tabs,
  defaultTab,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div className="flex">
      <div className="w-48 border-r border-gray-700 pr-4">
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors',
                activeTab === tab.id
                  ? 'bg-kpi-blue/10 text-kpi-blue'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 pl-4">{activeTabData?.content}</div>
    </div>
  );
};

