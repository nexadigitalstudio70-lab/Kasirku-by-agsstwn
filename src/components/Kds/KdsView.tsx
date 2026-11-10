import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { Order, OrderStatus } from '../../types';
import { soundNotifier } from '../../utils/audio';
import { Flame, CheckCircle, Clock, Coffee, Utensils, Volume2, AlertCircle } from 'lucide-react';

export const KdsView: React.FC = () => {
  const { userProfile, activeBranchId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'food' | 'beverage'>('all');
  const [nowTime, setNowTime] = useState(Date.now());
  const previousOrderCountRef = useRef<number | null>(null);

  // Update time ticker every 10 seconds for color-coded timers
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Sync cooking / active orders from Firestore
  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = activeBranchId
      ? query(
          collection(db, 'orders'),
          where('branchId', '==', activeBranchId),
          where('status', 'in', ['cooking', 'ready'])
        )
      : query(
          collection(db, 'orders'),
          where('status', 'in', ['cooking', 'ready'])
        );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Order);
      });

      // Sort by creation time (FIFO: oldest orders first)
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // If new order arrived, play "Ting!" chime
      if (previousOrderCountRef.current !== null && list.length > previousOrderCountRef.current) {
        soundNotifier.playKitchenChime();
      }
      previousOrderCountRef.current = list.length;
      setOrders(list);
    });

    return () => unsub();
  }, [userProfile?.uid, activeBranchId]);

  // Update status (e.g. Mulai Masak -> Siap Saji / Selesai)
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    await updateDoc(doc(db, 'orders', orderId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    if (newStatus === 'ready') {
      soundNotifier.playKitchenChime();
    }
  };

  // Filter items by category (Dapur: Food, Bar: Beverage)
  const getDisplayItems = (order: Order) => {
    if (filterType === 'food') {
      return order.items.filter((i) => i.categoryType === 'food');
    }
    if (filterType === 'beverage') {
      return order.items.filter((i) => i.categoryType === 'beverage');
    }
    return order.items;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F172A] text-white overflow-hidden">
      {/* Top KDS Bar */}
      <div className="h-16 bg-[#1E293B] border-b border-slate-700/80 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] text-white flex items-center justify-center shadow-md shadow-[#F97316]/20">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Layar Dapur & Bar (KDS)</h2>
            <p className="text-xs text-slate-400">
              Antrean Masak Real-Time • {orders.length} Pesanan Aktif
            </p>
          </div>
        </div>

        {/* Filter Section: Semua / Dapur (Makanan) / Bar (Minuman) */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                filterType === 'all'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterType('food')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                filterType === 'food'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Dapur (Makanan)</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('beverage')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                filterType === 'beverage'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Bar (Minuman)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => soundNotifier.playKitchenChime()}
            title="Tes Suara Notifikasi"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* KDS Card Grid */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-200">Semua Pesanan Selesai Disajikan!</h3>
            <p className="text-sm text-slate-400 max-w-sm mt-1">
              Belum ada pesanan baru. Pesanan yang dibuat oleh kasir akan otomatis muncul di sini disertai bunyi 'Ting!'.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const displayItems = getDisplayItems(order);
              if (displayItems.length === 0) return null;

              // Calculate waiting time
              const createdTimestamp = new Date(order.createdAt).getTime();
              const elapsedMinutes = Math.floor((nowTime - createdTimestamp) / (60 * 1000));

              // Color codes:
              // Yellow warning if > 10 mins
              // Red danger pulsing if > 15 mins
              const isDanger = elapsedMinutes >= 15;
              const isWarning = elapsedMinutes >= 10 && elapsedMinutes < 15;

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border-2 flex flex-col justify-between overflow-hidden shadow-xl transition-all ${
                    isDanger
                      ? 'bg-rose-950/40 border-rose-500 shadow-rose-900/30'
                      : isWarning
                      ? 'bg-amber-950/40 border-amber-500 shadow-amber-900/30'
                      : 'bg-slate-800/90 border-slate-700 shadow-black/40'
                  }`}
                >
                  {/* Order Header */}
                  <div
                    className={`p-3.5 flex items-center justify-between border-b ${
                      isDanger
                        ? 'bg-rose-600 text-white border-rose-700'
                        : isWarning
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-slate-700/80 text-white border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-mono font-semibold tracking-wider">
                        #{order.id.slice(-5).toUpperCase()}
                      </div>
                      <div className="text-lg font-black">
                        {order.tableName || 'Takeaway'}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className="flex items-center gap-1 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsedMinutes} Menit Lalu</span>
                      </div>
                      <span className="text-[10px] opacity-80">
                        {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Order Items list */}
                  <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-72">
                    {displayItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between pb-2.5 border-b border-slate-700/50 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#0F766E] text-white flex items-center justify-center font-black text-xs shrink-0">
                              {item.quantity}x
                            </span>
                            <span className="line-clamp-2">{item.name}</span>
                          </div>
                          {item.notes && (
                            <div className="text-xs text-amber-300 font-medium pl-8 mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>{item.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-3 bg-slate-900/80 border-t border-slate-700 flex gap-2">
                    {order.status === 'cooking' ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                        className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0d655e] active:scale-98 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Selesai Dimasak / Siap Saji</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, 'served')}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Telah Disajikan ke Meja</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
