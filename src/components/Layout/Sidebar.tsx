import React from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Flame,
  BookOpen,
  Boxes,
  Building2,
  Users2,
  BarChart3,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  orderCookingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  orderCookingCount = 0
}) => {
  const { logout, userProfile } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Kasir & Meja', icon: UtensilsCrossed },
    {
      id: 'kds',
      label: 'Pesanan & Dapur (KDS)',
      icon: Flame,
      badge: orderCookingCount > 0 ? orderCookingCount : undefined
    },
    { id: 'menu', label: 'Menu & Kategori', icon: BookOpen },
    { id: 'inventory', label: 'Inventori & Stok', icon: Boxes },
    { id: 'branch', label: 'Manajemen Cabang', icon: Building2 },
    { id: 'customers', label: 'Pelanggan & Reservasi', icon: Users2 },
    { id: 'reports', label: 'Laporan Penjualan', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan & Toko', icon: Settings }
  ];

  const handleSelect = (id: string) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top Info on Mobile */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between lg:hidden">
          <div className="font-bold text-slate-800 text-sm">
            {userProfile?.storeName || 'Kasirku POS'}
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Menu Utama
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F766E] text-white shadow-md shadow-[#0F766E]/20 font-bold'
                    : 'text-slate-600 hover:text-[#0F766E] hover:bg-teal-50/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#0F766E]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-[#F97316] text-white'
                        : 'bg-[#F97316] text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom User & Logout */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/60">
          <div className="px-3 py-2 mb-2 bg-white rounded-xl border border-slate-200/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center font-bold text-xs uppercase">
              {userProfile?.name?.charAt(0) || 'K'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-800 truncate">
                {userProfile?.name || 'Kasir'}
              </div>
              <div className="text-[10px] text-slate-400 capitalize truncate">
                {userProfile?.storeName || 'Toko Utama'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Keluar Sesi (Logout)</span>
          </button>
        </div>
      </aside>
    </>
  );
};
