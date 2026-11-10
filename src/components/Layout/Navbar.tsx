import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Branch } from '../../types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { ShoppingCart, Zap, Store, Lock, Menu as MenuIcon, Wifi, User } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu, onSelectTab }) => {
  const { userProfile, activeBranchId, setActiveBranchId, lockApp } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch branches for branch switcher
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(collection(db, 'branches'), where('ownerId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Branch);
      });
      setBranches(list);
      // Auto select first branch if none selected and branches exist
      if (list.length > 0 && !activeBranchId) {
        setActiveBranchId(list[0].id);
      }
    });
    return () => unsubscribe();
  }, [userProfile?.uid, activeBranchId]);

  return (
    <header className="h-16 bg-[#0F766E] text-white px-4 sm:px-6 flex items-center justify-between shadow-md shrink-0 z-30">
      {/* Left: Hamburger (mobile) + Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-teal-100 hover:text-white hover:bg-white/10"
        >
          <MenuIcon className="w-6 h-6" />
        </button>

        <div
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-white text-[#0F766E] flex items-center justify-center shadow-sm">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <Zap className="w-3 h-3 text-[#F97316] absolute -top-1 -right-1 fill-[#F97316]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight">Kasirku</span>
              <span className="text-[11px] font-bold text-teal-200 bg-white/15 px-1.5 py-0.5 rounded">by Agsstwn</span>
            </div>
            <p className="text-[10px] text-teal-100 hidden sm:block -mt-0.5 font-medium">
              Kasir Cepat, Dapur Sigap, Omzet Naik.
            </p>
          </div>
        </div>
      </div>

      {/* Middle/Right: Branch Switcher & Quick Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Branch Selector (1 Click Switch) */}
        <div className="flex items-center gap-1.5 bg-black/15 hover:bg-black/25 px-2.5 py-1.5 rounded-xl border border-white/10 transition">
          <Store className="w-4 h-4 text-teal-200 shrink-0" />
          <select
            value={activeBranchId}
            onChange={(e) => setActiveBranchId(e.target.value)}
            className="bg-transparent text-white text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer pr-1"
          >
            <option value="" className="text-slate-800 font-medium">
              {branches.length === 0 ? 'Semua Cabang (0)' : 'Semua Cabang (Gabungan)'}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="text-slate-800 font-medium">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Online Indicator */}
        <div
          title={isOnline ? 'Firebase Terhubung (Online)' : 'Mode Offline Aktif'}
          className="hidden sm:flex items-center gap-1 text-[11px] font-medium bg-white/10 px-2 py-1 rounded-lg"
        >
          <Wifi className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-300' : 'text-amber-300'}`} />
          <span className="text-teal-50">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Lock Screen PIN */}
        <button
          type="button"
          onClick={lockApp}
          title="Kunci Kasir (PIN)"
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-teal-100 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <Lock className="w-4 h-4 text-[#14B8A6]" />
          <span className="hidden md:inline">Kunci PIN</span>
        </button>

        {/* User Role Tag */}
        <div
          onClick={() => onSelectTab('settings')}
          className="flex items-center gap-2 pl-2 border-l border-white/20 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-[#14B8A6] text-white flex items-center justify-center font-bold text-xs uppercase shadow-inner">
            {userProfile?.name?.charAt(0) || <User className="w-4 h-4" />}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold leading-tight">{userProfile?.name || 'Kasir'}</div>
            <div className="text-[10px] text-teal-200 capitalize font-medium">{userProfile?.role || 'Owner'}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
