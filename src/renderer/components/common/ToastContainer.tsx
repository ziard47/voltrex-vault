import React from 'react';
import { useVault } from '../../context/VaultContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useVault();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-vault-lime flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-vault-danger flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-vault-olive flex-shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none select-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-[#0e100a] border border-vault-border rounded px-3.5 py-2.5 text-xs text-vault-textPrimary shadow-xl flex items-center space-x-2.5 min-w-[260px] max-w-sm transition-all"
        >
          {getIcon(toast.type)}
          <span className="flex-1 font-medium">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-vault-textSecondary hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
