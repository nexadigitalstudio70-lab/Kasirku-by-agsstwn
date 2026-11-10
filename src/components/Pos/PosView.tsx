import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { TableItem, MenuItem, Order, OrderItem, TableStatus, InventoryItem } from '../../types';
import { soundNotifier } from '../../utils/audio';
import { PinModal } from '../Common/PinModal';
import {
  Plus,
  PlusCircle,
  Users,
  UtensilsCrossed,
  Printer,
  Share2,
  Trash2,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Receipt,
  Search,
  Minus,
  Check,
  RotateCcw,
  Tag,
  ArrowRightLeft
} from 'lucide-react';

export const PosView: React.FC = () => {
  const { userProfile, activeBranchId } = useAuth();

  const [tables, setTables] = useState<TableItem[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Active table & active order state
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // New Table modal state
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);

  // Guest count modal when opening table
  const [showOpenTableModal, setShowOpenTableModal] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState('');

  // Menu selector search & filter
  const [menuSearch, setMenuSearch] = useState('');
  const [menuTypeFilter, setMenuTypeFilter] = useState<'all' | 'food' | 'beverage'>('all');

  // Checkout & Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'QRIS' | 'Transfer' | 'Debit' | 'Kredit' | 'Utang'>('Tunai');
  const [cashAmountGiven, setCashAmountGiven] = useState<number>(0);

  // Discount & Voucher state
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);

  // Struk / Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastPaidOrder, setLastPaidOrder] = useState<Order | null>(null);

  // Move table state
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState('');

  // Manager PIN modal for Void / Refund
  const [showVoidPinModal, setShowVoidPinModal] = useState(false);
  const [pendingVoidAction, setPendingVoidAction] = useState<(() => void) | null>(null);

  // 1. Sync Tables
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = activeBranchId
      ? query(collection(db, 'tables'), where('branchId', '==', activeBranchId))
      : query(collection(db, 'tables'));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: TableItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as TableItem));
      setTables(list);
    });
    return () => unsub();
  }, [userProfile?.uid, activeBranchId]);

  // 2. Sync Menus
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menus'), (snapshot) => {
      const list: MenuItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as MenuItem));
      setMenus(list);
    });
    return () => unsub();
  }, []);

  // 3. Sync Active Orders
  useEffect(() => {
    const q = query(collection(db, 'orders'), where('paymentStatus', '==', 'pending'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
    });
    return () => unsub();
  }, []);

  // 4. Sync Inventory for recipe stock deductions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    });
    return () => unsub();
  }, []);

  // Sync selected table's active order
  useEffect(() => {
    if (selectedTable?.currentOrderId) {
      const order = orders.find((o) => o.id === selectedTable.currentOrderId);
      if (order) {
        setCurrentOrder(order);
      }
    } else {
      setCurrentOrder(null);
    }
  }, [selectedTable, orders]);

  // Handle Create Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    const ref = doc(collection(db, 'tables'));
    await setDoc(ref, {
      id: ref.id,
      branchId: activeBranchId || 'default',
      ownerId: userProfile?.uid || '',
      name: newTableName.trim(),
      capacity: Number(newTableCapacity) || 4,
      status: 'empty',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setNewTableName('');
    setShowAddTableModal(false);
  };

  // Open Table with guests
  const handleOpenTable = async () => {
    if (!selectedTable) return;
    const orderRef = doc(collection(db, 'orders'));
    const newOrder: Order = {
      id: orderRef.id,
      branchId: selectedTable.branchId || activeBranchId || 'default',
      ownerId: userProfile?.uid || '',
      tableId: selectedTable.id,
      tableName: selectedTable.name,
      customerName: customerName || `Tamu (${guestCount} org)`,
      items: [],
      subtotal: 0,
      serviceCharge: 0,
      tax: 0,
      discount: 0,
      total: 0,
      status: 'cooking',
      type: 'dine_in',
      cashierId: userProfile?.uid || '',
      cashierName: userProfile?.name || 'Kasir',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(orderRef, newOrder);
    await updateDoc(doc(db, 'tables', selectedTable.id), {
      status: 'occupied',
      currentOrderId: orderRef.id,
      updatedAt: new Date().toISOString()
    });

    setCurrentOrder(newOrder);
    setShowOpenTableModal(false);
    setCustomerName('');
  };

  // Add Item to Order
  const handleAddItem = async (menu: MenuItem) => {
    if (!currentOrder || !selectedTable) return;

    const existingIdx = currentOrder.items.findIndex((i) => i.menuId === menu.id);
    let updatedItems = [...currentOrder.items];

    if (existingIdx > -1) {
      updatedItems[existingIdx].quantity += 1;
    } else {
      const newItem: OrderItem = {
        menuId: menu.id,
        name: menu.name,
        price: menu.price,
        costPrice: menu.costPrice || 0,
        quantity: 1,
        categoryType: menu.categoryType || 'food'
      };
      updatedItems.push(newItem);
    }

    await recalculateAndSaveOrder(updatedItems);
  };

  // Change Item Quantity
  const handleChangeQty = async (index: number, delta: number) => {
    if (!currentOrder) return;
    const updatedItems = [...currentOrder.items];
    const newQty = updatedItems[index].quantity + delta;

    if (newQty <= 0) {
      updatedItems.splice(index, 1);
    } else {
      updatedItems[index].quantity = newQty;
    }

    await recalculateAndSaveOrder(updatedItems);
  };

  // Calculate taxes and totals
  const recalculateAndSaveOrder = async (items: OrderItem[]) => {
    if (!currentOrder) return;
    const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    const discountAmount = Math.round((subtotal * (discountPercent || 0)) / 100) + (voucherDiscount || 0);
    const afterDiscount = Math.max(subtotal - discountAmount, 0);

    const serviceCharge = Math.round(afterDiscount * 0.05); // 5%
    const tax = Math.round((afterDiscount + serviceCharge) * 0.1); // PB1 10%
    const total = afterDiscount + serviceCharge + tax;

    const updates = {
      items,
      subtotal,
      discount: discountAmount,
      voucherCode: voucherCode || '',
      serviceCharge,
      tax,
      total,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(doc(db, 'orders', currentOrder.id), updates);
    setCurrentOrder((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // Move table (Pindah Meja)
  const handleMoveTable = async () => {
    if (!selectedTable || !currentOrder || !targetTableId) return;
    const targetTable = tables.find((t) => t.id === targetTableId);
    if (!targetTable) return;

    // 1. Update Order table info
    await updateDoc(doc(db, 'orders', currentOrder.id), {
      tableId: targetTable.id,
      tableName: targetTable.name,
      updatedAt: new Date().toISOString()
    });

    // 2. Set target table occupied
    await updateDoc(doc(db, 'tables', targetTable.id), {
      status: 'occupied',
      currentOrderId: currentOrder.id,
      updatedAt: new Date().toISOString()
    });

    // 3. Clear source table to empty or cleaning
    await updateDoc(doc(db, 'tables', selectedTable.id), {
      status: 'cleaning',
      currentOrderId: '',
      updatedAt: new Date().toISOString()
    });

    setSelectedTable(targetTable);
    setShowMoveTableModal(false);
  };

  // Void / Cancel Order with PIN check
  const handleRequestVoidOrder = () => {
    setPendingVoidAction(() => async () => {
      if (!currentOrder || !selectedTable) return;
      await updateDoc(doc(db, 'orders', currentOrder.id), {
        status: 'cancelled',
        paymentStatus: 'refunded',
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'tables', selectedTable.id), {
        status: 'cleaning',
        currentOrderId: '',
        updatedAt: new Date().toISOString()
      });
      setCurrentOrder(null);
    });
    setShowVoidPinModal(true);
  };

  // Complete Payment
  const handleCompletePayment = async () => {
    if (!currentOrder || !selectedTable) return;

    const change = Math.max(cashAmountGiven - currentOrder.total, 0);

    const paidOrderData: Partial<Order> = {
      paymentStatus: 'paid',
      paymentMethod,
      cashGiven: cashAmountGiven > 0 ? cashAmountGiven : currentOrder.total,
      changeAmount: change,
      status: 'completed',
      updatedAt: new Date().toISOString()
    };

    // 1. Update Order to paid
    await updateDoc(doc(db, 'orders', currentOrder.id), paidOrderData);

    // 2. Inventory auto-deduction according to menu recipes
    for (const item of currentOrder.items) {
      const menu = menus.find((m) => m.id === item.menuId);
      if (menu?.recipe && menu.recipe.length > 0) {
        for (const recipeItem of menu.recipe) {
          const invItem = inventory.find((inv) => inv.id === recipeItem.inventoryId);
          if (invItem) {
            const deductAmount = recipeItem.amount * item.quantity;
            const newStock = Math.max(invItem.currentStock - deductAmount, 0);
            await updateDoc(doc(db, 'inventory', invItem.id), {
              currentStock: newStock,
              updatedAt: new Date().toISOString()
            });
            // Record audit log
            await addDoc(collection(db, 'inventory_transactions'), {
              id: `${Date.now()}_${invItem.id}`,
              branchId: activeBranchId || 'default',
              inventoryId: invItem.id,
              ingredientName: invItem.name,
              type: 'out',
              amount: deductAmount,
              previousStock: invItem.currentStock,
              newStock,
              notes: `Terpotong pesanan #${currentOrder.id.slice(-5)} (${item.name} x${item.quantity})`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }

    // 3. Set Table to cleaning
    await updateDoc(doc(db, 'tables', selectedTable.id), {
      status: 'cleaning',
      currentOrderId: '',
      updatedAt: new Date().toISOString()
    });

    // Sound notification
    soundNotifier.playCashRegister();

    setLastPaidOrder({ ...currentOrder, ...paidOrderData } as Order);
    setShowPaymentModal(false);
    setShowReceiptModal(true);
    setCurrentOrder(null);
  };

  // Voucher apply
  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (voucherCode.toUpperCase() === 'DISKON10') {
      setVoucherDiscount(10000);
      recalculateAndSaveOrder(currentOrder?.items || []);
    } else if (voucherCode.toUpperCase() === 'HEMAT20') {
      setVoucherDiscount(20000);
      recalculateAndSaveOrder(currentOrder?.items || []);
    } else {
      alert('Kode voucher tidak ditemukan atau telah kedaluwarsa.');
    }
  };

  // WhatsApp share message formatter
  const shareReceiptWhatsApp = () => {
    if (!lastPaidOrder) return;
    const itemsText = lastPaidOrder.items
      .map((i) => `• ${i.name} x${i.quantity} = Rp ${(i.price * i.quantity).toLocaleString('id-ID')}`)
      .join('%0A');

    const msg = `*STRUK PEMBAYARAN KASIRKU*%0A` +
      `No. Nota: #${lastPaidOrder.id.slice(-6)}%0A` +
      `Meja: ${lastPaidOrder.tableName}%0A` +
      `Kasir: ${lastPaidOrder.cashierName}%0A` +
      `Metode: ${lastPaidOrder.paymentMethod}%0A` +
      `--------------------------------%0A` +
      `${itemsText}%0A` +
      `--------------------------------%0A` +
      `Subtotal: Rp ${lastPaidOrder.subtotal.toLocaleString('id-ID')}%0A` +
      `Pajak PB1 (10%): Rp ${lastPaidOrder.tax.toLocaleString('id-ID')}%0A` +
      `Service: Rp ${lastPaidOrder.serviceCharge.toLocaleString('id-ID')}%0A` +
      `*TOTAL: Rp ${lastPaidOrder.total.toLocaleString('id-ID')}*%0A` +
      `Terima kasih atas kunjungan Anda!`;

    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const filteredMenus = menus.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(menuSearch.toLowerCase());
    const matchesType = menuTypeFilter === 'all' || m.categoryType === menuTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      {/* Top POS Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900">Peta Meja & Transaksi</h2>
          
          {/* Status Indicator Legend */}
          <div className="hidden md:flex items-center gap-3 text-xs font-semibold pl-4 border-l border-slate-200">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Kosong
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ada Pesanan
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Minta Bill
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Perlu Bersih
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddTableModal(true)}
          className="px-3.5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Meja</span>
        </button>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Table Grid / Order Menu Picker */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
          {!selectedTable ? (
            /* TABLE GRID VIEW */
            <div>
              {tables.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-8">
                  <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <UtensilsCrossed className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Belum Ada Meja Terdaftar</h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                    Buat susunan meja untuk cabang ini agar kasir dapat memesan dan mengelola tamu dine-in.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddTableModal(true)}
                    className="px-5 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md inline-flex items-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-5 h-5" />
                    <span>Tambah Meja Pertama</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
                  {tables.map((table) => {
                    const isOccupied = table.status === 'occupied';
                    const isBill = table.status === 'bill';
                    const isCleaning = table.status === 'cleaning';

                    return (
                      <div
                        key={table.id}
                        onClick={() => {
                          setSelectedTable(table);
                          if (table.status === 'empty') {
                            setShowOpenTableModal(true);
                          }
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between h-36 ${
                          isOccupied
                            ? 'bg-amber-50/60 border-amber-400 hover:border-amber-500'
                            : isBill
                            ? 'bg-rose-50/60 border-rose-400 hover:border-rose-500'
                            : isCleaning
                            ? 'bg-slate-100 border-slate-300 hover:border-slate-400'
                            : 'bg-white border-emerald-400/80 hover:border-emerald-500 shadow-sm'
                        }`}
                      >
                        {/* Table Top Info */}
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-base sm:text-lg font-black text-slate-900 block">
                              {table.name}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3 text-slate-400" />
                              {table.capacity} Kursi
                            </span>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOccupied
                                ? 'bg-amber-500 text-white'
                                : isBill
                                ? 'bg-rose-500 text-white'
                                : isCleaning
                                ? 'bg-slate-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {isOccupied ? 'Terisi' : isBill ? 'Minta Bill' : isCleaning ? 'Bersih' : 'Kosong'}
                          </span>
                        </div>

                        {/* Table Bottom Action / Status */}
                        <div>
                          {isCleaning ? (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await updateDoc(doc(db, 'tables', table.id), { status: 'empty' });
                              }}
                              className="w-full py-1 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                            >
                              Selesai Dibersihkan
                            </button>
                          ) : isOccupied ? (
                            <div className="text-[11px] font-semibold text-amber-800 line-clamp-1">
                              Lihat Pesanan Aktif →
                            </div>
                          ) : (
                            <div className="text-[11px] font-semibold text-emerald-700">
                              + Buka Meja
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* MENU CATALOGUE (When Table is Selected) */
            <div className="flex flex-col h-full space-y-4">
              {/* Back to Table Map & Table Heading */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTable(null)}
                    className="p-1.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-bold"
                  >
                    ← Peta Meja
                  </button>
                  <h3 className="text-base font-black text-slate-900">
                    {selectedTable.name} ({selectedTable.capacity} Kursi)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {selectedTable.status === 'occupied' && (
                    <button
                      type="button"
                      onClick={() => setShowMoveTableModal(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Pindah Meja</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(`Hapus ${selectedTable.name}?`)) {
                        await deleteDoc(doc(db, 'tables', selectedTable.id));
                        setSelectedTable(null);
                      }
                    }}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                    title="Hapus Meja"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Menu Filter & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Cari menu makanan atau minuman..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <div className="flex gap-1.5 p-1 bg-slate-200/80 rounded-xl">
                  {(['all', 'food', 'beverage'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMenuTypeFilter(t)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                        menuTypeFilter === t
                          ? 'bg-white text-[#0F766E] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t === 'all' ? 'Semua' : t === 'food' ? 'Makanan' : 'Minuman'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items Grid */}
              <div className="flex-1 overflow-y-auto">
                {filteredMenus.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500">Tidak ada menu yang sesuai.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredMenus.map((menu) => {
                      const isOutOfStock = !menu.isAvailable;
                      return (
                        <div
                          key={menu.id}
                          onClick={() => !isOutOfStock && handleAddItem(menu)}
                          className={`bg-white rounded-xl border p-3 flex flex-col justify-between transition-all select-none ${
                            isOutOfStock
                              ? 'opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed'
                              : 'border-slate-200 hover:border-[#0F766E] hover:shadow-md cursor-pointer active:scale-95'
                          }`}
                        >
                          <div>
                            {/* Photo (Sharp, 1:1 ratio) */}
                            <div className="w-full aspect-square rounded-lg bg-slate-100 mb-2 overflow-hidden relative">
                              {menu.photoUrl ? (
                                <img
                                  src={menu.photoUrl}
                                  alt={menu.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <UtensilsCrossed className="w-6 h-6" />
                                </div>
                              )}
                              {isOutOfStock && (
                                <span className="absolute inset-0 bg-black/50 text-white font-bold text-xs flex items-center justify-center">
                                  HABIS
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                              {menu.name}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-black text-[#0F766E]">
                              Rp {menu.price.toLocaleString('id-ID')}
                            </span>
                            <span className="w-6 h-6 rounded-lg bg-teal-50 text-[#0F766E] font-bold text-xs flex items-center justify-center">
                              +
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Bill / Cart Sheet */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between shrink-0 h-full">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pesanan Aktif
              </div>
              <div className="text-base font-black text-slate-900">
                {selectedTable ? selectedTable.name : 'Pilih Meja Dahulu'}
              </div>
            </div>

            {currentOrder && (
              <button
                type="button"
                onClick={handleRequestVoidOrder}
                className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Void / Batal</span>
              </button>
            )}
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!currentOrder || currentOrder.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Receipt className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">Keranjang Masih Kosong</p>
                <p className="text-[11px] text-slate-400">
                  {selectedTable
                    ? 'Pilih hidangan di sebelah kiri untuk menambah ke tagihan.'
                    : 'Pilih salah satu meja untuk mulai melayani pesanan.'}
                </p>
              </div>
            ) : (
              currentOrder.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-bold text-slate-800 line-clamp-1">{item.name}</div>
                    <div className="text-[11px] text-[#0F766E] font-semibold">
                      Rp {item.price.toLocaleString('id-ID')}
                    </div>
                  </div>

                  {/* Quantity Controller */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangeQty(idx, -1)}
                      className="w-6 h-6 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-slate-800 w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleChangeQty(idx, 1)}
                      className="w-6 h-6 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill Calculation & Checkout Footer */}
          {currentOrder && currentOrder.items.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5">
              {/* Voucher input */}
              <form onSubmit={handleApplyVoucher} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Kode Voucher (cth: DISKON10)"
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg"
                >
                  Pakai
                </button>
              </form>

              {/* Discount % Selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Diskon Kasir:</span>
                <div className="flex gap-1">
                  {[0, 5, 10, 15, 20].map((disc) => (
                    <button
                      key={disc}
                      type="button"
                      onClick={() => {
                        setDiscountPercent(disc);
                        recalculateAndSaveOrder(currentOrder.items);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        discountPercent === disc
                          ? 'bg-[#0F766E] text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {disc}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtotal, Tax, Total */}
              <div className="space-y-1 pt-2 border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>Rp {currentOrder.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {currentOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Diskon & Voucher</span>
                    <span>- Rp {currentOrder.discount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Service Charge (5%)</span>
                  <span>Rp {currentOrder.serviceCharge.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Pajak Resto (PB1 10%)</span>
                  <span>Rp {currentOrder.tax.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Tagihan</span>
                  <span className="text-[#0F766E]">Rp {currentOrder.total.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Bayar Sekarang Button */}
              <button
                type="button"
                onClick={() => {
                  setCashAmountGiven(currentOrder.total);
                  setShowPaymentModal(true);
                }}
                className="w-full py-3.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-black rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <Banknote className="w-5 h-5 text-[#14B8A6]" />
                <span>Bayar Sekarang (Rp {currentOrder.total.toLocaleString('id-ID')})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Tambah Meja Baru */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">Tambah Meja Baru</h3>
              <button onClick={() => setShowAddTableModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor / Nama Meja
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="Contoh: Meja 01 / VIP A"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kapasitas Kursi
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md transition"
              >
                Simpan Meja
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Buka Meja (Input Tamu) */}
      {showOpenTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Buka {selectedTable?.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Masukkan detail tamu untuk memulai pesanan.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Tamu (Opsional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Pelanggan"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Jumlah Tamu
                </label>
                <div className="flex items-center gap-3">
                  {[1, 2, 4, 6, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestCount(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                        guestCount === num
                          ? 'bg-[#0F766E] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {num} Org
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpenTableModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleOpenTable}
                  className="flex-1 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Buka & Pesan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Pindah Meja */}
      {showMoveTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">Pindah dari {selectedTable?.name}</h3>
            <p className="text-xs text-slate-500 mb-4">Pilih meja kosong tujuan:</p>
            <div className="space-y-3">
              <select
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              >
                <option value="">-- Pilih Meja Tujuan --</option>
                {tables
                  .filter((t) => t.id !== selectedTable?.id && t.status === 'empty')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.capacity} Kursi)
                    </option>
                  ))}
              </select>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoveTableModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!targetTableId}
                  onClick={handleMoveTable}
                  className="flex-1 py-2 bg-[#0F766E] text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  Konfirmasi Pindah
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Pembayaran (Payment Sheet) */}
      {showPaymentModal && currentOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Pembayaran Kasir</h3>
                <p className="text-xs text-slate-500">
                  {currentOrder.tableName} • {currentOrder.items.length} Menu
                </p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total tagihan */}
            <div className="my-4 p-4 bg-teal-50 border border-teal-200 rounded-2xl text-center">
              <span className="text-xs font-bold text-[#0F766E] uppercase">Total yang Harus Dibayar</span>
              <div className="text-3xl font-black text-[#0F766E] mt-0.5">
                Rp {currentOrder.total.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Metode Pembayaran */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Pilih Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Tunai', 'QRIS', 'Transfer', 'Debit', 'Kredit', 'Utang'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1 ${
                      paymentMethod === method
                        ? 'bg-[#0F766E] text-white border-[#0F766E] shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {method === 'Tunai' && <Banknote className="w-4 h-4" />}
                    {method === 'QRIS' && <QrCode className="w-4 h-4" />}
                    {(method === 'Debit' || method === 'Kredit' || method === 'Transfer' || method === 'Utang') && (
                      <CreditCard className="w-4 h-4" />
                    )}
                    <span>{method}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Jika Tunai: Hitung Uang Diterima & Kembalian */}
            {paymentMethod === 'Tunai' && (
              <div className="space-y-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={cashAmountGiven}
                    onChange={(e) => setCashAmountGiven(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                {/* Quick Nominal Buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCashAmountGiven(currentOrder.total)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Uang Pas
                  </button>
                  {[50000, 100000, 150000, 200000, 500000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setCashAmountGiven(nominal)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {nominal.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>

                {/* Kembalian */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Kembalian:</span>
                  <span className="text-base font-black text-[#0F766E]">
                    Rp {Math.max(cashAmountGiven - currentOrder.total, 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* Jika QRIS: Tampilkan QR code simulasi */}
            {paymentMethod === 'QRIS' && (
              <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200 mb-6">
                <div className="w-36 h-36 bg-white p-2 mx-auto rounded-xl border border-slate-300 shadow-xs flex items-center justify-center">
                  <QrCode className="w-28 h-28 text-slate-800" />
                </div>
                <div className="text-xs font-bold text-slate-700 mt-2">Scan QRIS Kasirku</div>
                <p className="text-[11px] text-slate-400">Gopay, OVO, Dana, ShopeePay, BCA, dll.</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleCompletePayment}
              className="w-full py-3.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>Selesaikan Pembayaran & Simpan</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: Struk / Receipt Preview */}
      {showReceiptModal && lastPaidOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in max-h-[90vh] overflow-y-auto">
            {/* Thermal Print Receipt Simulation */}
            <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 font-mono text-xs text-slate-800 space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-bold text-sm uppercase">KASIRKU BY AGSSTWN</div>
                <div className="text-[10px] text-slate-500">Kasir Cepat, Dapur Sigap, Omzet Naik</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Nota: #{lastPaidOrder.id.slice(-6)} • {new Date(lastPaidOrder.createdAt).toLocaleTimeString('id-ID')}
                </div>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Meja: {lastPaidOrder.tableName}</span>
                <span>Kasir: {lastPaidOrder.cashierName}</span>
              </div>

              <div className="py-2 border-y border-dashed border-slate-300 space-y-1">
                {lastPaidOrder.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="line-clamp-1">{i.name} x{i.quantity}</span>
                    <span>Rp {(i.price * i.quantity).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rp {lastPaidOrder.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {lastPaidOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Diskon</span>
                    <span>- Rp {lastPaidOrder.discount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Service (5%)</span>
                  <span>Rp {lastPaidOrder.serviceCharge.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>PB1 (10%)</span>
                  <span>Rp {lastPaidOrder.tax.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                  <span>TOTAL</span>
                  <span>Rp {lastPaidOrder.total.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Metode: {lastPaidOrder.paymentMethod}</span>
                  <span>Diterima: Rp {(lastPaidOrder.cashGiven || lastPaidOrder.total).toLocaleString('id-ID')}</span>
                </div>
                {(lastPaidOrder.changeAmount || 0) > 0 && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Kembalian</span>
                    <span>Rp {lastPaidOrder.changeAmount?.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                Terima kasih atas kunjungan Anda!
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Struk</span>
                </button>
                <button
                  type="button"
                  onClick={shareReceiptWhatsApp}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Kirim WA</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Tutup & Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal for Void */}
      <PinModal
        isOpen={showVoidPinModal}
        title="Otorisasi PIN Manajer"
        description="Masukkan PIN untuk membatalkan (Void) pesanan ini"
        expectedPin={userProfile?.pin || '1234'}
        onSuccess={() => {
          setShowVoidPinModal(false);
          if (pendingVoidAction) {
            pendingVoidAction();
            setPendingVoidAction(null);
          }
        }}
        onClose={() => {
          setShowVoidPinModal(false);
          setPendingVoidAction(null);
        }}
      />
    </div>
  );
};
