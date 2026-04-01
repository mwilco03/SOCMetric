import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { JiraIssue } from '../../types';

interface SlideOutState {
  isOpen: boolean;
  title: string;
  content: ReactNode;
}

interface BottomSheetState {
  isOpen: boolean;
  issue: JiraIssue | null;
}

interface PanelContextValue {
  slideOut: SlideOutState;
  bottomSheet: BottomSheetState;
  openSlideOut: (title: string, content: ReactNode) => void;
  closeSlideOut: () => void;
  openTicketDetail: (issue: JiraIssue) => void;
  closeTicketDetail: () => void;
  closeAll: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [slideOut, setSlideOut] = useState<SlideOutState>({
    isOpen: false,
    title: '',
    content: null,
  });

  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>({
    isOpen: false,
    issue: null,
  });

  const closeAll = useCallback(() => {
    setSlideOut({ isOpen: false, title: '', content: null });
    setBottomSheet({ isOpen: false, issue: null });
  }, []);

  const openSlideOut = useCallback((title: string, content: ReactNode) => {
    setBottomSheet({ isOpen: false, issue: null }); // close others first
    setSlideOut({ isOpen: true, title, content });
  }, []);

  const closeSlideOut = useCallback(() => {
    setSlideOut({ isOpen: false, title: '', content: null });
  }, []);

  const openTicketDetail = useCallback((issue: JiraIssue) => {
    setSlideOut({ isOpen: false, title: '', content: null }); // close others first
    setBottomSheet({ isOpen: true, issue });
  }, []);

  const closeTicketDetail = useCallback(() => {
    setBottomSheet({ isOpen: false, issue: null });
  }, []);

  return (
    <PanelContext.Provider
      value={{ slideOut, bottomSheet, openSlideOut, closeSlideOut, openTicketDetail, closeTicketDetail, closeAll }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanel must be used within PanelProvider');
  return ctx;
}
