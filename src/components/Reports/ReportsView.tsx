import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Order, MenuItem, Branch } from '../../types';
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  DollarSign,
  PieChart,
  Users,
  Clock,
  ArrowUpRight,
  Receipt
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { userProfile, activeBranchId } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Period filter: 'today' | 'week' | 'month' | 'custom'
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Sync Orders
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = activeBranchId
      ? query(
          collection(db, 'orders'),
          where('branchId', '==', activeBranchId),
          where('paymentStatus', '==', 'paid')
        )
      : query(
          collection(db, 'orders'),
          where('ownerId', '==', userProfile.uid),
          where('paymentStatus', '==', 'paid')
        );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
    });
    return () => unsub();
  }, [userProfile?.uid, activeBranchId]);

  // Sync Menus
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menus'), (snapshot) => {
      const list: MenuItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as MenuItem));
      setMenus(list);
    });
    return () => unsub();
  }, []);

  // Sync Branches
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'branches'), (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Branch));
      setBranches(list);
    });
    return () => unsub();
  }, []);

  // Filter orders by chosen date range
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const filteredOrders = orders.filter((o) => {
    const orderDate = o.createdAt?.split('T')[0];
    if (!orderDate) return false;

    if (period === 'today') {
      return orderDate === todayStr;
    }
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return orderDate >= weekAgo && orderDate <= todayStr;
    }
    if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return orderDate >= monthAgo && orderDate <= todayStr;
    }
    if (period === 'custom') {
      return orderDate >= startDate && orderDate <= endDate;
    }
    return true;
  });

  // Calculate Aggregates
  const totalOmzet = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalSubtotal = filteredOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const totalTax = filteredOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
  const totalService = filteredOrders.reduce((sum, o) => sum + (o.serviceCharge || 0), 0);
  const totalDiscount = filteredOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const averageTicket = totalOrdersCount > 0 ? Math.round(totalOmzet / totalOrdersCount) : 0;

  // Estimate Food Cost (HPP) & Gross Profit
  let totalHpp = 0;
  filteredOrders.forEach((o) => {
    o.items?.forEach((it) => {
      const menu = menus.find((m) => m.id === it.menuId);
      const unitCost = menu?.costPrice || it.costPrice || Math.round(it.price * 0.45);
      totalHpp += unitCost * (it.quantity || 1);
    });
  });
  const grossProfit = totalOmzet - totalHpp;
  const foodCostPercentage = totalOmzet > 0 ? ((totalHpp / totalOmzet) * 100).toFixed(1) : '0';

  // Breakdown by Cashier
  const cashierMap: { [name: string]: { count: number; total: number } } = {};
  filteredOrders.forEach((o) => {
    const cName = o.cashierName || 'Kasir Umum';
    if (!cashierMap[cName]) cashierMap[cName] = { count: 0, total: 0 };
    cashierMap[cName].count += 1;
    cashierMap[cName].total += o.total || 0;
  });

  // Breakdown by Payment Method
  const paymentMethodMap: { [method: string]: { count: number; total: number } } = {};
  filteredOrders.forEach((o) => {
    const pMethod = o.paymentMethod || 'Tunai';
    if (!paymentMethodMap[pMethod]) paymentMethodMap[pMethod] = { count: 0, total: 0 };
    paymentMethodMap[pMethod].count += 1;
    paymentMethodMap[pMethod].total += o.total || 0;
  });

  // Rush Hours (Jam Sibuk) calculation
  const hourMap: { [hour: number]: number } = {};
  for (let h = 0; h < 24; h++) hourMap[h] = 0;
  filteredOrders.forEach((o) => {
    const h = new Date(o.createdAt).getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;
  });

  const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];

  // Export CSV Function
  const exportToCSV = () => {
    let csv = 'ID Pesanan,Tanggal,Meja,Kasir,Metode,Subtotal,Diskon,Pajak PB1,Service,Total Omzet\n';
    filteredOrders.forEach((o) => {
      csv += `"${o.id}","${o.createdAt}","${o.tableName}","${o.cashierName}","${o.paymentMethod || 'Tunai'}",${o.subtotal},${o.discount},${o.tax},${o.serviceCharge},${o.total}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `laporan_penjualan_${period}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>Laporan Keuangan & Omzet</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Laporan Penjualan & Laba Rugi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Analisis lengkap omzet, HPP / food cost, laba kotor, jam sibuk, dan kinerja kasir.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export CSV / Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex p-1 bg-slate-200/80 rounded-xl overflow-x-auto">
          {(['today', 'week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
                period === p
                  ? 'bg-white text-[#0F766E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'today'
                ? 'Hari Ini'
                : p === 'week'
                ? '7 Hari Terakhir'
                : p === 'month'
                ? '30 Hari Terakhir'
                : 'Rentang Kustom'}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omzet */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
            <span>Total Omzet</span>
            <DollarSign className="w-4 h-4 text-[#0F766E]" />
          </div>
          <div className="text-2xl font-black text-[#0F766E]">
            Rp {totalOmzet.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {totalOrdersCount} Transaksi Selesai
          </div>
        </div>

        {/* Laba Kotor */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
            <span>Estimasi Laba Kotor</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            Rp {grossProfit.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Margin: {totalOmzet > 0 ? Math.round((grossProfit / totalOmzet) * 100) : 0}%
          </div>
        </div>

        {/* Food Cost (HPP) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
            <span>HPP / Food Cost</span>
            <PieChart className="w-4 h-4 text-[#F97316]" />
          </div>
          <div className="text-2xl font-black text-[#F97316]">
            Rp {totalHpp.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {foodCostPercentage}% dari Total Omzet
          </div>
        </div>

        {/* Rata-rata per Bill */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase mb-1">
            <span>Rata-Rata Bill</span>
            <Receipt className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-800">
            Rp {averageTicket.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Per meja / pesanan
          </div>
        </div>
      </div>

      {/* Middle Section: Breakdown by Cashier & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rekap Per Kasir */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0F766E]" />
            <span>Kinerja Penjualan Per Kasir</span>
          </h3>

          {Object.keys(cashierMap).length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Belum ada transaksi di periode ini.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(cashierMap).map(([cashier, data]) => (
                <div key={cashier} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{cashier}</div>
                    <div className="text-slate-500">{data.count} Transaksi Dilayani</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[#0F766E] text-sm">
                      Rp {data.total.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rekap Metode Pembayaran */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#0F766E]" />
            <span>Rekap Metode Pembayaran</span>
          </h3>

          {Object.keys(paymentMethodMap).length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Belum ada transaksi di periode ini.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(paymentMethodMap).map(([method, data]) => (
                <div key={method} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{method}</div>
                    <div className="text-slate-500">{data.count} Pembayaran Sukses</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[#0F766E] text-sm">
                      Rp {data.total.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Rincian Transaksi Selesai</h3>
          <span className="text-xs text-slate-500 font-semibold">{filteredOrders.length} Pesanan</span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Tidak ada transaksi pada periode yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-4">Waktu</th>
                  <th className="p-4">No. Nota</th>
                  <th className="p-4">Meja</th>
                  <th className="p-4">Kasir</th>
                  <th className="p-4">Metode</th>
                  <th className="p-4 text-right">Total Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-900">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="p-4 font-semibold text-teal-800">
                      {order.tableName}
                    </td>
                    <td className="p-4">{order.cashierName}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {order.paymentMethod || 'Tunai'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-[#0F766E] text-sm">
                      Rp {order.total.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
