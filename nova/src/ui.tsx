import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { AlertTriangle, Check, ChevronDown, X } from 'lucide-react';
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

/* ---------- Buttons ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: boolean;
  loading?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', icon && 'btn--icon', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- Layout ---------- */

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Initials({ name, size }: { name: string; size?: 'sm' }) {
  const text = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={`avatar${size === 'sm' ? ' avatar--sm' : ''}`} aria-hidden>
      {text}
    </span>
  );
}

export function Chip({ tone, dot, children }: { tone?: 'green' | 'blue' | 'orange' | 'red'; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`chip${tone ? ` chip--${tone}` : ''}`}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  );
}

export function Wait({ days }: { days: number }) {
  if (days <= SLOW_DAYS) return <span className="num">{days}d</span>;
  return (
    <span className="warn num" title={`Waiting more than ${SLOW_DAYS} days`}>
      <AlertTriangle size={13} aria-label="Waiting too long" />
      {days}d
    </span>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="num">{value}%</span>
    </div>
  );
}

/* ---------- Loading ---------- */

export function InlineLoading({ children }: { children: ReactNode }) {
  return (
    <span className="inline-loading" role="status">
      <span className="spinner" aria-hidden />
      {children}
    </span>
  );
}

export function Skeleton({ w, h = 12 }: { w: number | string; h?: number }) {
  return <span className="skeleton" style={{ display: 'block', width: w, height: h }} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card skeleton-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <span className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <Skeleton w={`${30 + ((i * 17) % 25)}%`} />
            <Skeleton w="18%" h={10} />
          </div>
          <Skeleton w={64} />
        </div>
      ))}
    </div>
  );
}

/* ---------- Dropdowns ---------- */

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);
  return ref;
}

export interface Option<T extends string> {
  value: T;
  label?: string;
  count?: number;
}

/** A pill that shows the current filter and opens a list to change it. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  align,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  align?: 'end';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const id = useId();
  const current = options.find((o) => o.value === value);

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options.length - 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
    else if (e.key === 'Enter' || e.key === ' ') pick(options[active].value);
    else if (e.key === 'Escape' || e.key === 'Tab') return setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="select" ref={ref}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKey}
      >
        <span className="label">{label}:</span>
        <strong>{current?.label ?? current?.value}</strong>
        {current?.count !== undefined && <span className="muted num">{current.count}</span>}
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <ul className={`menu${align === 'end' ? ' menu--end' : ''}`} role="listbox" id={id} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              className="menu-item"
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
            >
              <span className="check">{o.value === value && <Check size={14} aria-hidden />}</span>
              {o.label ?? o.value}
              {o.count !== undefined && <span className="count">{o.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** A button that opens a short list of actions. */
export function ActionMenu({
  label,
  trigger,
  actions,
  variant = 'ghost',
  icon = true,
}: {
  label: string;
  trigger: ReactNode;
  actions: MenuAction[];
  variant?: ButtonProps['variant'];
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div className="select" ref={ref} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Button variant={variant} size="sm" icon={icon} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {trigger}
      </Button>
      {open && (
        <div className="menu menu--end" role="menu" aria-label={label}>
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              className={`menu-item${a.danger ? ' menu-item--danger' : ''}`}
              style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }}
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Tabs ---------- */

/** A short tab row, used where the original had one (three to six options). */
export function Tabs<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label ?? o.value}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <>
          <div className="modal-head">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <Button variant="ghost" size="sm" icon aria-label="Close" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          <div className="modal-body">{children}</div>
          <div className="modal-foot">{footer}</div>
        </>
      )}
    </dialog>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="error">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ---------- Toast ---------- */

interface Toast {
  id: number;
  title: string;
  subtitle?: string;
  undo?: () => void;
}

type ShowToast = (t: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<ShowToast>(() => {});
export const useToast = () => useContext(ToastContext);

/** Confirms every action, one at a time, with undo where an action changes data. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const next = useRef(0);
  const close = useCallback((id: number) => setToast((t) => (t?.id === id ? null : t)), []);
  const show = useCallback<ShowToast>(
    (t) => {
      const id = next.current++;
      setToast({ ...t, id });
      setTimeout(() => close(id), t.undo ? 7000 : 4000);
    },
    [close],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite">
        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <div>
              {toast.title}
              {toast.subtitle && <span className="sub">{toast.subtitle}</span>}
            </div>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  close(toast.id);
                }}
              >
                Undo
              </button>
            )}
            <button className="close" aria-label="Dismiss" onClick={() => close(toast.id)}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
