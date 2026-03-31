import { useState, useEffect, useCallback, useRef } from 'react';
import { BREAKPOINT_NARROW, BREAKPOINT_WIDE } from '../constants';

interface WindowSize {
  width: number;
  height: number;
  /** < 1024px — sidebar should collapse to icon rail */
  isNarrow: boolean;
  /** 1024-1280px — standard layout */
  isStandard: boolean;
  /** > 1280px — full width, spacious layout */
  isWide: boolean;
}

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isNarrow: false,
    isStandard: true,
    isWide: false,
  });

  const rafId = useRef(0);

  const handleResize = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const width = window.innerWidth;
      setWindowSize({
        width,
        height: window.innerHeight,
        isNarrow: width < BREAKPOINT_NARROW,
        isStandard: width >= BREAKPOINT_NARROW && width < BREAKPOINT_WIDE,
        isWide: width >= BREAKPOINT_WIDE,
      });
    });
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId.current);
    };
  }, [handleResize]);

  return windowSize;
}
