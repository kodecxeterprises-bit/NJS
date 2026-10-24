import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, toast: showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          let bg = 'bg-[#2B2B2B] text-white border-white/10';
          let icon = 'info';
          let iconColor = 'text-primary';

          if (t.type === 'success') {
            bg = 'bg-[#143E24] text-[#E8F8EE] border-[#22C55E]/30';
            icon = 'check_circle';
            iconColor = 'text-[#22C55E]';
          } else if (t.type === 'error') {
            bg = 'bg-[#431414] text-[#FEE8E8] border-[#EF4444]/30';
            icon = 'error';
            iconColor = 'text-[#EF4444]';
          } else if (t.type === 'warning') {
            bg = 'bg-[#3D2B0F] text-[#FEF3C7] border-[#F59E0B]/30';
            icon = 'warning';
            iconColor = 'text-[#F59E0B]';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border backdrop-blur-sm transition-all duration-300 transform translate-y-0 ${bg}`}
              role="alert"
            >
              <span className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${iconColor}`}>
                {icon}
              </span>
              <p className="text-xs font-medium leading-relaxed flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-white/60 hover:text-white shrink-0 -mr-1 -mt-1 p-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback to console.info if used outside provider
    return {
      showToast: (msg: string) => console.info('[NJS Toast]', msg),
      toast: (msg: string) => console.info('[NJS Toast]', msg),
    };
  }
  return context;
};
