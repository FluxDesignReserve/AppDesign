import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionableNotification, ToastNotification } from '@carbon/react';
import { WarningAltFilled } from '@carbon/icons-react';
import { SLOW_DAYS } from './data/model';

/** Pages fetch on open. This stands in for that latency so loading states are real. */
export function usePageLoad(ms = 450): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}

/** Resolve after a short delay, like a network call. */
export const settle = (ms = 700) => new Promise<void>((r) => setTimeout(r, ms));

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="nova-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Wait({ days }: { days: number }) {
  if (days <= SLOW_DAYS) return <span className="nova-num">{days}d</span>;
  return (
    <span className="nova-warn nova-num" title={`Waiting more than ${SLOW_DAYS} days`}>
      <WarningAltFilled size={16} aria-label="Waiting too long" />
      {days}d
    </span>
  );
}

interface Toast {
  id: number;
  title: string;
  subtitle?: string;
  kind?: 'success' | 'info' | 'error';
  undo?: () => void;
}

type ShowToast = (t: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<ShowToast>(() => {});
export const useToast = () => useContext(ToastContext);

/** Confirms every action, and offers undo where an action changes data. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const close = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const show = useCallback<ShowToast>(
    (t) => {
      const id = next.current++;
      setToasts([{ ...t, id }]);
      setTimeout(() => close(id), t.undo ? 8000 : 5000);
    },
    [close],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="nova-toasts" aria-live="polite">
        {toasts.map((t) =>
          t.undo ? (
            <ActionableNotification
              key={t.id}
              kind={t.kind ?? 'success'}
              lowContrast
              title={t.title}
              subtitle={t.subtitle}
              actionButtonLabel="Undo"
              hasFocus={false}
              onActionButtonClick={() => {
                t.undo?.();
                close(t.id);
              }}
              onClose={() => {
                close(t.id);
                return false;
              }}
            />
          ) : (
            <ToastNotification
              key={t.id}
              kind={t.kind ?? 'success'}
              lowContrast
              title={t.title}
              subtitle={t.subtitle}
              timeout={0}
              onClose={() => {
                close(t.id);
                return false;
              }}
            />
          ),
        )}
      </div>
    </ToastContext.Provider>
  );
}
