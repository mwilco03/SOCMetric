import React, { useState, createContext, useContext } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AccordionContextType {
  openItems: string[];
  toggleItem: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

const useAccordion = () => {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('Must be used within Accordion');
  return context;
};

interface AccordionProps {
  children: React.ReactNode;
  allowMultiple?: boolean;
  defaultOpen?: string[];
}

export const Accordion: React.FC<AccordionProps> = ({
  children,
  allowMultiple = false,
  defaultOpen = [],
}) => {
  const [openItems, setOpenItems] = useState<string[]>(defaultOpen);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      }
      return prev.includes(id) ? [] : [id];
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem }}>
      <div className="space-y-2">{children}</div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  id,
  title,
  children,
  className,
}) => {
  const { openItems, toggleItem } = useAccordion();
  const isOpen = openItems.includes(id);

  return (
    <div className={cn('border border-gray-700 rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => toggleItem(id)}
        className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-gray-200">{title}</span>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>
      {isOpen && <div className="p-4 bg-gray-900/50">{children}</div>}
    </div>
  );
};

