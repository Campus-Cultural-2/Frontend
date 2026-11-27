import { createContext } from 'react';

export type TabTransitionValues = {
  direction: -1 | 1;
  version: number;
  onSwipeTab: (direction: -1 | 1) => void;
};

export const TabTransitionContext = createContext<TabTransitionValues | null>(null);
