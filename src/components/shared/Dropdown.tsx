import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {label && (
        <label className="block text-sm text-gray-400 mb-1">{label}</label>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-700 rounded text-left text-gray-200 hover:border-gray-600 transition-colors"
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown
          className={cn('w-4 h-4 text-gray-500 transition-transform', isOpen && 'transform rotate-180')}
        />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              disabled={option.disabled}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors',
                value === option.value
                  ? 'bg-kpi-blue/10 text-kpi-blue'
                  : 'text-gray-300 hover:bg-gray-700',
                option.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

