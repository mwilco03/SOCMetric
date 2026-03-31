import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

const variants = {
  default: 'bg-gray-800 text-gray-300',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};

// Specialized badges for common use cases
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusMap: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    open: { variant: 'info', label: 'Open' },
    closed: { variant: 'success', label: 'Closed' },
    'in progress': { variant: 'warning', label: 'In Progress' },
    resolved: { variant: 'success', label: 'Resolved' },
    pending: { variant: 'warning', label: 'Pending' },
  };

  const config = statusMap[status.toLowerCase()] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const priorityMap: Record<string, BadgeProps['variant']> = {
    highest: 'error',
    high: 'error',
    medium: 'warning',
    low: 'info',
    lowest: 'default',
  };

  return (
    <Badge variant={priorityMap[priority.toLowerCase()] || 'default'}>
      {priority}
    </Badge>
  );
};

