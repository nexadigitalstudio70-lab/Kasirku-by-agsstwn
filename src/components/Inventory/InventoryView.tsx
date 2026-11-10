import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, uploadImageHelper } from '../../firebase';
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
import { InventoryItem, InventoryTransaction, Branch } from '../../types';
import {
  Boxes,
  Plus,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  ShoppingCart,
  Search,
  Trash2,
  Edit2,
  X,
  Check,
  Building2,
  Loader2
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { userProfile, activeBranchId } = useAuth();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Modal: Add / Edit Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);
  const [supplier, setSupplier] = useState('');
  const [costPerUnit, setCostPerUnit] = useState<number>(0);

  // Modal: Stock In / Out / Opname / Transfer
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockActionItem, setStockActionItem] = useState<InventoryItem | null>(null);
  const [stockActionType, setStockActionType] = useState<'in' | 'out' | 'opname' | 'transfer'>('in');
  const [stockAmount, setStockAmount] = useState<number>(0);
  const [stockNotes, setStockNotes] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');

  // Modal: Shopping List (Daftar Belanja Otomatis)
  const [showShoppingList, setShowShoppingList] = useState(false);

  // Sync Inventory
  useEffect(() => {
    const q = activeBranchId
      ? query(collection(db, 'inventory'), where('branchId', '==', activeBranchId))
      : query(collection(db, 'inventory'));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    });
    return () => unsub();
  }, [activeBranchId]);

  // Sync Transactions
  useEffect(() => {
    const q = query(collection(db, 'inventory_transactions'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: InventoryTransaction[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryTransaction));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(list.slice(0, 50));
    });
    return () => unsub();
  }, []);

  // Sync Branches
  useEffect(() => {
    const q = query(collection(db, 'branches'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Branch));
      setBranches(list);
    });
    return () => unsub();
  }, []);

  // Open Add Item
  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setUnit('kg');
    setCurrentStock(10);
    setMinStock(5);
    setSupplier('');
    setCostPerUnit(15000);
    setShowItemModal(true);
  };

  // Open Edit Item
  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setCurrentStock(item.currentStock);
    setMinStock(item.minStock);
    setSupplier(item.supplier || '');
    setCostPerUnit(item.costPerUnit || 0);
    setShowItemModal(true);
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userProfile?.uid) return;

    if (editingItem) {
      await updateDoc(doc(db, 'inventory', editingItem.id), {
        name: name.trim(),
        unit,
        minStock: Number(minStock) || 0,
        supplier,
        costPerUnit: Number(costPerUnit) || 0,
        updatedAt: new Date().toISOString()
      });
    } else {
      const ref = doc(collection(db, 'inventory'));
      const newItem: InventoryItem = {
        id: ref.id,
        branchId: activeBranchId || 'default',
        ownerId: userProfile.uid,
        name: name.trim(),
        unit,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock) || 0,
        supplier,
        costPerUnit: Number(costPerUnit) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(ref, newItem);

      // Log initial stock in transaction
      if (currentStock > 0) {
        await addDoc(collection(db, 'inventory_transactions'), {
          id: `${Date.now()}_init`,
          branchId: activeBranchId || 'default',
          inventoryId: ref.id,
          ingredientName: newItem.name,
          type: 'in',
          amount: newItem.currentStock,
          previousStock: 0,
          newStock: newItem.currentStock,
          notes: 'Stok awal pendaftaran bahan baku',
          createdAt: new Date().toISOString()
        });
      }
    }

    setShowItemModal(false);
  };

  // Handle Stock Movement (In / Out / Opname / Transfer)
  const handleExecuteStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockActionItem || stockAmount <= 0) return;

    let newStock = stockActionItem.currentStock;
    if (stockActionType === 'in') {
      newStock += stockAmount;
    } else if (stockActionType === 'out' || stockActionType === 'transfer') {
      newStock = Math.max(newStock - stockAmount, 0);
    } else if (stockActionType === 'opname') {
      newStock = stockAmount; // sets to audited count
    }

    // 1. Update Inventory item current stock
    await updateDoc(doc(db, 'inventory', stockActionItem.id), {
      currentStock: newStock,
      updatedAt: new Date().toISOString()
    });

    // 2. Add audit transaction log
    await addDoc(collection(db, 'inventory_transactions'), {
      id: `${Date.now()}_tx`,
      branchId: activeBranchId || 'default',
      inventoryId: stockActionItem.id,
      ingredientName: stockActionItem.name,
      type: stockActionType,
      amount: stockAmount,
      previousStock: stockActionItem.currentStock,
      newStock,
      notes: stockNotes || (stockActionType === 'transfer' ? `Transfer ke cabang lain` : 'Penyesuaian stok'),
      createdAt: new Date().toISOString()
    });

    // If transfer: if target branch has same item name, add there
    if (stockActionType === 'transfer' && targetBranchId) {
      // Find matching item in target branch
      const targetMatch = inventory.find(
        (i) => i.branchId === targetBranchId && i.name.toLowerCase() === stockActionItem.name.toLowerCase()
      );
      if (targetMatch) {
        await updateDoc(doc(db, 'inventory', targetMatch.id), {
          currentStock: targetMatch.currentStock + stockAmount,
          updatedAt: new Date().toISOString()
        });
      }
    }

    setShowStockModal(false);
    setStockAmount(0);
    setStockNotes('');
  };

  // Low stock list
  const lowStockItems = inventory.filter((i) => i.currentStock <= i.minStock);

  const filteredItems = inventory.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchesLow = filterLowStock ? i.currentStock <= i.minStock : true;
    return matchesSearch && matchesLow;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <Boxes className="w-4 h-4" />
            <span>Inventori & Resep Otomatis</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Manajemen Stok & Bahan Baku
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Stok otomatis terpotong saat kasir melayani pesanan sesuai resep per menu.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowShoppingList(true)}
            className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-[#F97316] font-bold text-xs sm:text-sm rounded-xl border border-amber-200 flex items-center gap-2 cursor-pointer transition"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Daftar Belanja ({lowStockItems.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan Baku</span>
          </button>
        </div>
      </div>

      {/* Low Stock Warning Banner if any */}
      {lowStockItems.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                Peringatan: {lowStockItems.length} Bahan Baku Menipis!
              </h3>
              <p className="text-xs text-rose-700">
                {lowStockItems.map((i) => `${i.name} (sisa ${i.currentStock} ${i.unit})`).join(', ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterLowStock(!filterLowStock)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shrink-0"
          >
            {filterLowStock ? 'Lihat Semua' : 'Filter Menipis'}
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari bahan baku..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span>Total: {inventory.length} Bahan Terdata</span>
        </div>
      </div>

      {/* Inventory Table */}
      {inventory.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-6">
          <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Boxes className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Inventori Bahan Baku Masih Kosong</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Tambahkan bahan seperti Beras, Kopi, Telur, Susu, Gula, dll. untuk menghubungkannya ke resep menu.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Bahan Pertama</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-4">Nama Bahan</th>
                  <th className="p-4">Stok Saat Ini</th>
                  <th className="p-4">Batas Min</th>
                  <th className="p-4">Biaya / Satuan</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Aksi Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredItems.map((item) => {
                  const isLow = item.currentStock <= item.minStock;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                        <div className="text-[11px] text-slate-400">Satuan: {item.unit}</div>
                      </td>
                      <td className="p-4">
                        <span className={`text-base font-black ${isLow ? 'text-rose-600' : 'text-[#0F766E]'}`}>
                          {item.currentStock.toLocaleString('id-ID')}
                        </span>{' '}
                        <span className="text-slate-500">{item.unit}</span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {item.minStock} {item.unit}
                      </td>
                      <td className="p-4 text-slate-700 font-semibold">
                        Rp {(item.costPerUnit || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-slate-500">
                        {item.supplier || '-'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLow
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isLow ? 'Menipis' : 'Aman'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        {/* Quick Stock Movement Buttons */}
                        <button
                          type="button"
                          onClick={() => {
                            setStockActionItem(item);
                            setStockActionType('in');
                            setStockAmount(10);
                            setShowStockModal(true);
                          }}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-[#0F766E] rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          + Masuk
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStockActionItem(item);
                            setStockActionType('out');
                            setStockAmount(1);
                            setShowStockModal(true);
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-[#F97316] rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          - Keluar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStockActionItem(item);
                            setStockActionType('opname');
                            setStockAmount(item.currentStock);
                            setShowStockModal(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Opname
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Hapus bahan "${item.name}"?`)) {
                              await deleteDoc(doc(db, 'inventory', item.id));
                            }
                          }}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Movement Audit Log Section */}
      {transactions.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Riwayat Mutasi Stok Real-Time</h3>
              <p className="text-xs text-slate-500">Catatan pemotongan resep, penambahan stok, dan opname</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">50 Mutasi Terakhir</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      tx.type === 'in'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.type === 'out'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {tx.type === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">{tx.ingredientName}</span>
                    <span className="text-slate-500 ml-2">
                      ({tx.notes || (tx.type === 'in' ? 'Stok Masuk' : 'Stok Keluar')})
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-black ${tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'in' ? '+' : '-'}{tx.amount} (Sisa: {tx.newStock})
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(tx.createdAt).toLocaleTimeString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Tambah / Edit Bahan */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Bahan Baku <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Beras Ramos, Biji Kopi Arabica"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Satuan Ukuran
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="gr">gr (Gram)</option>
                    <option value="liter">liter</option>
                    <option value="ml">ml (Mililiter)</option>
                    <option value="pcs">pcs (Buah/Butir)</option>
                    <option value="porsi">porsi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Batas Minimum Notifikasi
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              {!editingItem && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-[#0F766E]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Biaya Beli / Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Supplier (Opsional)
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="PT Sumber Pangan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Simpan Bahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Mutasi Stok (Masuk, Keluar, Opname, Transfer) */}
      {showStockModal && stockActionItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Mutasi: {stockActionItem.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Stok saat ini: <strong>{stockActionItem.currentStock} {stockActionItem.unit}</strong>
            </p>

            <form onSubmit={handleExecuteStockMovement} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-xl text-center text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStockActionType('in')}
                  className={`py-1.5 rounded-lg transition ${
                    stockActionType === 'in' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setStockActionType('out')}
                  className={`py-1.5 rounded-lg transition ${
                    stockActionType === 'out' ? 'bg-amber-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Keluar
                </button>
                <button
                  type="button"
                  onClick={() => setStockActionType('opname')}
                  className={`py-1.5 rounded-lg transition ${
                    stockActionType === 'opname' ? 'bg-slate-800 text-white' : 'text-slate-600'
                  }`}
                >
                  Opname
                </button>
                <button
                  type="button"
                  onClick={() => setStockActionType('transfer')}
                  className={`py-1.5 rounded-lg transition ${
                    stockActionType === 'transfer' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Transfer
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {stockActionType === 'opname' ? 'Hasil Hitung Fisik Sebenarnya' : 'Jumlah (' + stockActionItem.unit + ')'}
                </label>
                <input
                  type="number"
                  value={stockAmount}
                  onChange={(e) => setStockAmount(Number(e.target.value))}
                  required
                  min={0.1}
                  step="any"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              {stockActionType === 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tujuan Cabang
                  </label>
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="">-- Pilih Cabang Tujuan --</option>
                    {branches
                      .filter((b) => b.id !== activeBranchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Mutasi
                </label>
                <input
                  type="text"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  placeholder="Contoh: Pembelian baru dari pasar, Rusak, dll."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Simpan Mutasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Daftar Belanja Otomatis */}
      {showShoppingList && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#F97316]" />
                <h3 className="text-base font-bold text-slate-900">Daftar Belanja Otomatis</h3>
              </div>
              <button onClick={() => setShowShoppingList(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Bahan-bahan baku yang stoknya berada di bawah batas minimum:
            </p>

            {lowStockItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Semua stok aman! Tidak ada bahan baku yang perlu dibeli saat ini.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto mb-4">
                {lowStockItems.map((item) => {
                  const neededAmount = Math.max(item.minStock * 2 - item.currentStock, 1);
                  return (
                    <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Sisa: {item.currentStock} {item.unit} • Batas: {item.minStock} {item.unit}
                        </div>
                        {item.supplier && (
                          <div className="text-[10px] text-teal-700">Supplier: {item.supplier}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Saran Beli:</span>
                        <span className="font-black text-rose-600 text-sm">
                          +{neededAmount} {item.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const text = lowStockItems
                  .map((i) => `• ${i.name}: sisa ${i.currentStock} ${i.unit} (perlu beli +${Math.max(i.minStock * 2 - i.currentStock, 1)} ${i.unit})`)
                  .join('%0A');
                window.open(`https://wa.me/?text=*DAFTAR BELANJA KASIRKU*%0A${text}`, '_blank');
              }}
              disabled={lowStockItems.length === 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50"
            >
              Kirim Daftar Belanja via WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
