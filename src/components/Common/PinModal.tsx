import React, { useState } from 'react';
import { Lock, X, Delete, ShieldCheck } from 'lucide-react';

interface PinModalProps {
  title?: string;
  description?: string;
  expectedPin?: string;
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
  allowCancel?: boolean;
}

export const PinModal: React.FC<PinModalProps> = ({
  title = 'Verifikasi PIN Kasir',
  description = 'Masukkan 4 digit PIN keamanan',
  expectedPin,
  isOpen,
  onSuccess,
  onClose,
  allowCancel = true,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        // Validate
        if (!expectedPin || nextPin === expectedPin) {
          onSuccess();
          setPin('');
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
          }, 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6 text-center animate-in fade-in zoom-in-95">
        
        {allowCancel && (
          <div className="flex justify-end -mt-2 -mr-2">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="w-12 h-12 bg-teal-100 text-[#0F766E] rounded-full flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mb-6">{description}</p>

        {/* PIN Dots */}
        <div className={`flex justify-center gap-4 mb-6 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > idx
                  ? error
                    ? 'bg-rose-500 border-rose-500'
                    : 'bg-[#0F766E] border-[#0F766E]'
                  : 'border-slate-300 bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-500 mb-4 animate-in fade-in">
            PIN Salah! Silakan coba lagi.
          </p>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-12 bg-slate-100 hover:bg-slate-200 active:bg-[#0F766E] active:text-white rounded-xl text-lg font-bold text-slate-800 transition active:scale-95 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-12 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-500"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 bg-slate-100 hover:bg-slate-200 active:bg-[#0F766E] active:text-white rounded-xl text-lg font-bold text-slate-800 transition active:scale-95 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-600 active:scale-95"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>Keamanan Kasir Terproteksi</span>
        </div>
      </div>
    </div>
  );
};
