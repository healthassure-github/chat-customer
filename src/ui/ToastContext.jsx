import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext({
  showToast: () => {}
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ type = "info", title = "", subtitle = "", duration = 3000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, title, subtitle }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, duration);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[9999] flex w-[320px] max-w-[95vw] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{toast.type}</div>
            {toast.title && <div className="text-sm font-semibold text-slate-800">{toast.title}</div>}
            {toast.subtitle && <div className="text-xs text-slate-600">{toast.subtitle}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
