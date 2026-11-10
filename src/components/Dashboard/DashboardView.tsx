import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Order, TableItem, InventoryItem, MenuItem, Branch } from '../../types';
import {
  TrendingUp,
  CreditCard,
  Calendar,
  UtensilsCrossed,
  Flame,
  AlertTriangle,
  Store,
  PlusCircle,
  ShoppingBag,
  ArrowUpRight,
  Clock
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { userProfile, activeBranchId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Real-time Firestore sync
  useEffect(() => {
    if (!userProfile?.uid) return;

    // 1. Orders
    const ordersQuery = query(collection(db, 'orders'), where('ownerId', '==', userProfile.uid));
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
    });

    // 2. Tables
    const tablesQuery = query(collection(db, 'tables'));
    const unsubTables = onSnapshot(tablesQuery, (snapshot) => {
      const list: TableItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as TableItem));
      setTables(list);
    });

    // 3. Inventory
    const invQuery = query(collection(db, 'inventory'));
    const unsubInv = onSnapshot(invQuery, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    });

    // 4. Menus
    const menuQuery = query(collection(db, 'menus'));
    const unsubMenus = onSnapshot(menuQuery, (snapshot) => {
      const list: MenuItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as MenuItem));
      setMenus(list);
    });

    // 5. Branches
    const branchQuery = query(collection(db, 'branches'), where('ownerId', '==', userProfile.uid));
    const unsubBranches = onSnapshot(branchQuery, (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Branch));
      setBranches(list);
    });

    return () => {
      unsubOrders();
      unsubTables();
      unsubInv();
      unsubMenus();
      unsubBranches();
    };
  }, [userProfile?.uid]);

  // Filtered by active branch if selected
  const filteredOrders = activeBranchId
    ? orders.filter((o) => o.branchId === activeBranchId)
    : orders;

  const filteredTables = activeBranchId
    ? tables.filter((t) => t.branchId === activeBranchId)
    : tables;

  const filteredInventory = activeBranchId
    ? inventory.filter((i) => i.branchId === activeBranchId)
    : inventory;

  // Calculate Metrics from Firestore
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');

  const todayRevenue = paidOrders
    .filter((o) => o.createdAt?.startsWith(todayStr))
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const weekRevenue = paidOrders
    .filter((o) => new Date(o.createdAt) >= oneWeekAgo)
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const monthRevenue = paidOrders
    .filter((o) => new Date(o.createdAt) >= oneMonthAgo)
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // Table status metrics
  const occupiedTables = filteredTables.filter((t) => t.status === 'occupied' || t.status === 'bill').length;
  const cookingOrdersCount = filteredOrders.filter((o) => o.status === 'cooking').length;

  // Low stock inventory (< minStock)
  const lowStockItems = filteredInventory.filter((i) => i.currentStock <= i.minStock);

  // Top Selling Menu items calculation
  const itemSalesMap: { [name: string]: { count: number; revenue: number } } = {};
  paidOrders.forEach((o) => {
    o.items?.forEach((item) => {
      if (!itemSalesMap[item.name]) {
        itemSalesMap[item.name] = { count: 0, revenue: 0 };
      }
      itemSalesMap[item.name].count += item.quantity || 1;
      itemSalesMap[item.name].revenue += (item.price || 0) * (item.quantity || 1);
    });
  });

  const topSellingMenus = Object.entries(itemSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Per Branch Breakdown for Owner
  const branchRevenues = branches.map((b) => {
    const branchPaid = orders.filter((o) => o.branchId === b.id && o.paymentStatus === 'paid');
    const total = branchPaid.reduce((sum, o) => sum + (o.total || 0), 0);
    const count = branchPaid.length;
    return { id: b.id, name: b.name, total, count };
  });

  // Simple 7-day bar chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dayTotal = paidOrders
      .filter((o) => o.createdAt?.startsWith(dateKey))
      .reduce((sum, o) => sum + (o.total || 0), 0);
    return { dayLabel, dateKey, dayTotal };
  });

  const maxChartRevenue = Math.max(...last7Days.map((d) => d.dayTotal), 100000);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <Store className="w-4 h-4" />
            <span>{activeBranchId ? 'Cabang Terpilih' : 'Semua Cabang (Gabungan)'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Selamat Datang, {userProfile?.name || 'Kasir'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pantau performa penjualan, ketersediaan meja, dan pesanan real-time dari Firebase.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Buka Kasir & Meja</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('menu')}
            className="px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-[#0F766E] text-xs sm:text-sm font-bold rounded-xl border border-teal-200 flex items-center gap-1.5 cursor-pointer transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tambah Menu</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('branch')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
          >
            <Store className="w-4 h-4" />
            <span>Tambah Cabang</span>
          </button>
        </div>
      </div>

      {/* Revenue Stat Cards (Tosca Pekat #0F766E) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Omzet Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Omzet Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F766E]">
            Rp {todayRevenue.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>Diperbarui otomatis dari pesanan selesai</span>
          </div>
        </div>

        {/* Omzet Minggu Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Omzet 7 Hari Terakhir
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F766E]">
            Rp {weekRevenue.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total penjualan 7 hari terakhir</span>
          </div>
        </div>

        {/* Omzet Bulan Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Omzet 30 Hari Terakhir
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#F97316] flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F766E]">
            Rp {monthRevenue.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Akumulasi transaksi tersimpan di Firestore</span>
          </div>
        </div>
      </div>

      {/* Operational Highlights (Meja Terisi, Pesanan Dimasak, Stok Menipis) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Meja Terisi */}
        <div
          onClick={() => onNavigate('pos')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#0F766E] transition cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Meja Terisi</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {occupiedTables} <span className="text-xs text-slate-400 font-normal">/ {filteredTables.length} Meja</span>
            </div>
            <div className="text-[11px] text-[#0F766E] font-semibold mt-1">Lihat Peta Meja →</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-[#0F766E] flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>

        {/* Pesanan Dimasak */}
        <div
          onClick={() => onNavigate('kds')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#F97316] transition cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Pesanan Dimasak (KDS)</div>
            <div className="text-2xl font-black text-[#F97316] mt-1">
              {cookingOrdersCount} <span className="text-xs text-slate-400 font-normal">Pesanan</span>
            </div>
            <div className="text-[11px] text-[#F97316] font-semibold mt-1">Buka Layar Dapur →</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        {/* Stok Mau Habis */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-rose-400 transition cursor-pointer flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Bahan Menipis</div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {lowStockItems.length} <span className="text-xs text-slate-400 font-normal">Bahan Baku</span>
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-1">Cek Inventori →</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Middle Section: 7-Day Chart & Top Selling Menus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (Hijau Tosca Pekat #0F766E) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Grafik Penjualan 7 Hari</h3>
              <p className="text-xs text-slate-500">Omzet harian dalam Rupiah</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E]">
              <span className="w-3 h-3 rounded-sm bg-[#0F766E]" />
              <span>Omzet Harian</span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-56 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-2">
            {last7Days.map((day) => {
              const heightPct = Math.max(Math.round((day.dayTotal / maxChartRevenue) * 100), 6);
              return (
                <div key={day.dateKey} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    Rp {day.dayTotal > 0 ? (day.dayTotal / 1000).toFixed(0) + 'k' : '0'}
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[42px] bg-gradient-to-t from-[#0F766E] to-[#14B8A6] rounded-t-lg transition-all duration-300 hover:brightness-110 shadow-sm"
                  />
                  <span className="text-[11px] font-bold text-slate-500">{day.dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Menus */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Menu Paling Laris</h3>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-bold text-[#0F766E] hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            {topSellingMenus.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium">Belum ada menu terjual.</p>
                <p className="text-[11px] text-slate-400">Pesanan selesai akan terdaftar di sini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topSellingMenus.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#0F766E]/10 text-[#0F766E] font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-800 line-clamp-1">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.count} porsi terjual</div>
                      </div>
                    </div>
                    <div className="text-xs font-black text-[#0F766E]">
                      Rp {item.revenue.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('menu')}
            className="w-full mt-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Kelola Katalog Menu ({menus.length})
          </button>
        </div>
      </div>

      {/* For Owner: Omzet Gabungan & Per Cabang Breakdown */}
      {branches.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Performa Per Cabang</h3>
              <p className="text-xs text-slate-500">Perbandingan omzet antar outlet</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('branch')}
              className="text-xs font-bold text-[#0F766E] hover:underline"
            >
              Kelola Cabang →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {branchRevenues.map((br) => (
              <div key={br.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800">{br.name}</div>
                  <span className="text-[10px] font-semibold text-slate-500">{br.count} transaksi</span>
                </div>
                <div className="text-lg font-black text-[#0F766E] mt-1.5">
                  Rp {br.total.toLocaleString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
