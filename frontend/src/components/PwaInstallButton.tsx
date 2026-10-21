'use client';

import React from 'react';
import { Download, Check, Share2, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

interface PwaInstallButtonProps {
  variant?: 'compact' | 'full' | 'icon' | 'badge';
  label?: string;
  className?: string;
}

export default function PwaInstallButton({
  variant = 'compact',
  label = 'INSTALL APP',
  className = '',
}: PwaInstallButtonProps) {
  const {
    isInstalled,
    isIOS,
    triggerInstall,
    showIosGuide,
    showChromeGuide,
    closeGuides
  } = usePwaInstall();

  if (isInstalled) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-black uppercase tracking-wider ${className}`}>
        <Check size={12} className="stroke-[3]" />
        <span>Installed</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={triggerInstall}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 ${
          variant === 'compact'
            ? 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/30'
            : variant === 'full'
            ? 'w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        } ${className}`}
      >
        <Download size={13} className="stroke-[2.5]" />
        <span>{label}</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Smartphone size={22} />
              <h3 className="font-black text-sm uppercase tracking-wide">Install on iOS (Safari)</h3>
            </div>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li>Tap the <Share2 size={13} className="inline mx-1 text-blue-600" /> <b>Share</b> button in Safari.</li>
              <li>Scroll down and select <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b> in the top right corner.</li>
            </ol>
            <button
              onClick={closeGuides}
              className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Chrome Desktop/Android Instructions Modal */}
      {showChromeGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Download size={22} />
              <h3 className="font-black text-sm uppercase tracking-wide">Install App</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Click the install icon <Download size={13} className="inline text-blue-600 mx-1" /> in the browser address bar or menu to install Warrior Gym OS as an app.
            </p>
            <button
              onClick={closeGuides}
              className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
