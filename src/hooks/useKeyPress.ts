import { useEffect } from 'react';

export function useKeyPress(
  targetKey: string,
  callback: () => void,
  modifiers?: { ctrl?: boolean; alt?: boolean; shift?: boolean }
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMatch = event.key === targetKey;
      const ctrlMatch = modifiers?.ctrl ? event.ctrlKey : !event.ctrlKey;
      const altMatch = modifiers?.alt ? event.altKey : !event.altKey;
      const shiftMatch = modifiers?.shift ? event.shiftKey : !event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetKey, callback, modifiers]);
}

export function useEscapeKey(callback: () => void): void {
  useKeyPress('Escape', callback);
}

export function useEnterKey(callback: () => void): void {
  useKeyPress('Enter', callback);
}

