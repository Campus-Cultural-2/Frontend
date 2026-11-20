import { useCallback, useEffect, useRef, useState } from 'react';

import { AppToastType } from '@/components/ui/app-toast';

type ToastState = {
  message: string;
  type: AppToastType;
};

// Mensagens de erro e aviso precisam de tempo para serem lidas.
const DURATION_BY_TYPE: Record<AppToastType, number> = {
  error: 6500,
  success: 2600,
  warning: 5000,
};

export function useAppToast(duration?: number) {
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((nextToast: ToastState) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast(nextToast);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, duration ?? DURATION_BY_TYPE[nextToast.type]);
  }, [duration]);

  return {
    showToast,
    toast,
  };
}
