import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, uploadImageHelper } from '../../firebase';
import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { MenuItem, Category, InventoryItem, RecipeIngredient, MenuVariant } from '../../types';
import {
  Plus,
  UtensilsCrossed,
  Search,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Check,
  X,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const MenuView: React.FC = () => {
  const { userProfile, activeBranchId } = useAuth();

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Menu Modal (Add / Edit)
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState<number>(20000);
  const [menuCostPrice, setMenuCostPrice] = useState<number>(10000);
  const [menuCategoryId, setMenuCategoryId] = useState('');
  const [menuCategoryType, setMenuCategoryType] = useState<'food' | 'beverage' | 'other'>('food');
  const [menuDescription, setMenuDescription] = useState('');
  const [menuPhotoUrl, setMenuPhotoUrl] = useState('');
  const [menuIsAvailable, setMenuIsAvailable] = useState(true);
  const [recipeList, setRecipeList] = useState<RecipeIngredient[]>([]);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync Menus
  useEffect(() => {
    const q = query(collection(db, 'menus'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: MenuItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as MenuItem));
      setMenus(list);
    });
    return () => unsub();
  }, []);

  // Sync Categories
  useEffect(() => {
    const q = query(collection(db, 'categories'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Category[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Category));
      setCategories(list);
    });
    return () => unsub();
  }, []);

  // Sync Inventory for Recipe selection
  useEffect(() => {
    const q = query(collection(db, 'inventory'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    });
    return () => unsub();
  }, []);

  // Handle Image Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?.uid) return;
    setIsUploading(true);
    try {
      const path = `menus/${userProfile.uid}/${Date.now()}_${file.name}`;
      const url = await uploadImageHelper(file, path);
      setMenuPhotoUrl(url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (menu: MenuItem) => {
    setEditingMenu(menu);
    setMenuName(menu.name);
    setMenuPrice(menu.price);
    setMenuCostPrice(menu.costPrice || 0);
    setMenuCategoryId(menu.categoryId || '');
    setMenuCategoryType(menu.categoryType || 'food');
    setMenuDescription(menu.description || '');
    setMenuPhotoUrl(menu.photoUrl || '');
    setMenuIsAvailable(menu.isAvailable);
    setRecipeList(menu.recipe || []);
    setShowMenuModal(true);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingMenu(null);
    setMenuName('');
    setMenuPrice(25000);
    setMenuCostPrice(12000);
    setMenuCategoryId(categories[0]?.id || '');
    setMenuCategoryType('food');
    setMenuDescription('');
    setMenuPhotoUrl('');
    setMenuIsAvailable(true);
    setRecipeList([]);
    setShowMenuModal(true);
  };

  // Save Menu (Create or Update)
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName.trim() || !userProfile?.uid) return;
    setIsSaving(true);

    try {
      if (editingMenu) {
        // Update
        const updates: Partial<MenuItem> = {
          name: menuName.trim(),
          price: Number(menuPrice) || 0,
          costPrice: Number(menuCostPrice) || 0,
          categoryId: menuCategoryId,
          categoryType: menuCategoryType,
          description: menuDescription,
          photoUrl: menuPhotoUrl,
          isAvailable: menuIsAvailable,
          recipe: recipeList,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(doc(db, 'menus', editingMenu.id), updates);
      } else {
        // Create new
        const ref = doc(collection(db, 'menus'));
        const newMenu: MenuItem = {
          id: ref.id,
          ownerId: userProfile.uid,
          branchId: activeBranchId || '',
          name: menuName.trim(),
          price: Number(menuPrice) || 0,
          costPrice: Number(menuCostPrice) || 0,
          categoryId: menuCategoryId,
          categoryType: menuCategoryType,
          description: menuDescription,
          photoUrl: menuPhotoUrl,
          isAvailable: menuIsAvailable,
          recipe: recipeList,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(ref, newMenu);
      }
      setShowMenuModal(false);
    } catch (err) {
      console.error('Error saving menu:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Menu
  const handleDeleteMenu = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus menu "${name}"?`)) {
      await deleteDoc(doc(db, 'menus', id));
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const ref = doc(collection(db, 'categories'));
    await setDoc(ref, {
      id: ref.id,
      name: newCategoryName.trim(),
      ownerId: userProfile?.uid || '',
      createdAt: new Date().toISOString()
    });
    setNewCategoryName('');
    setShowCategoryModal(false);
  };

  // Add ingredient to recipe
  const handleAddRecipeIngredient = (inventoryId: string) => {
    const inv = inventory.find((i) => i.id === inventoryId);
    if (!inv) return;
    if (recipeList.some((r) => r.inventoryId === inventoryId)) return;

    setRecipeList([
      ...recipeList,
      {
        inventoryId: inv.id,
        ingredientName: inv.name,
        amount: 1,
        unit: inv.unit
      }
    ]);
  };

  const filteredMenus = menus.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || m.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Katalog Makanan & Minuman</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Menu & Kategori Produk
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Atur hidangan, harga modal/jual, resep pengurangan bahan baku, dan varian.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 cursor-pointer transition"
          >
            <Layers className="w-4 h-4" />
            <span>Kategori ({categories.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Menu Baru</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama menu..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Semua ({menus.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menus List Grid */}
      {menus.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-6">
          <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Katalog Menu Masih Kosong</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Mulai tambahkan hidangan makanan dan minuman pertama Anda dengan foto tajam dan harga jual.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Menu Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMenus.map((menu) => (
            <div
              key={menu.id}
              className={`bg-white rounded-2xl border p-4 flex flex-col justify-between shadow-sm transition hover:shadow-md ${
                !menu.isAvailable ? 'border-slate-200 opacity-60' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Photo 1:1 Sharp */}
                <div className="w-full aspect-square rounded-xl bg-slate-100 mb-3 overflow-hidden relative border border-slate-100">
                  {menu.photoUrl ? (
                    <img
                      src={menu.photoUrl}
                      alt={menu.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-medium">Belum ada foto</span>
                    </div>
                  )}

                  {!menu.isAvailable && (
                    <div className="absolute inset-0 bg-black/60 text-white font-bold text-xs flex items-center justify-center">
                      HABIS / NONAKTIF
                    </div>
                  )}

                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 shadow-xs uppercase">
                    {menu.categoryType === 'beverage' ? 'Minuman' : 'Makanan'}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-900 line-clamp-1">{menu.name}</div>
                <div className="text-base font-black text-[#0F766E] mt-1">
                  Rp {menu.price.toLocaleString('id-ID')}
                </div>
                {menu.costPrice ? (
                  <div className="text-[11px] text-slate-400">
                    Modal: Rp {menu.costPrice.toLocaleString('id-ID')}
                  </div>
                ) : null}

                {menu.recipe && menu.recipe.length > 0 && (
                  <div className="text-[10px] text-teal-700 bg-teal-50 px-2 py-1 rounded-md mt-2">
                    Resep: {menu.recipe.length} bahan baku
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={async () => {
                    await updateDoc(doc(db, 'menus', menu.id), {
                      isAvailable: !menu.isAvailable
                    });
                  }}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                    menu.isAvailable
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {menu.isAvailable ? 'Tersedia' : 'Habis'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(menu)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    title="Edit Menu"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMenu(menu.id, menu.name)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                    title="Hapus Menu"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Tambah / Edit Menu */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-black text-slate-900">
                {editingMenu ? 'Edit Menu' : 'Tambah Menu Baru'}
              </h3>
              <button onClick={() => setShowMenuModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="space-y-4">
              {/* Photo Upload (1:1 Ratio) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Foto Menu (Tajam, Rasio 1:1)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {menuPhotoUrl ? (
                      <img src={menuPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 shadow-xs inline-flex items-center gap-1.5">
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#0F766E]" />
                          <span>Mengunggah ke Storage...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 text-[#0F766E]" />
                          <span>Pilih Foto Menu</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">Disimpan ke Firebase Storage.</p>
                  </div>
                </div>
              </div>

              {/* Nama & Tipe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Menu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    placeholder="Contoh: Nasi Goreng Spesial"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kategori Layar
                  </label>
                  <select
                    value={menuCategoryType}
                    onChange={(e) => setMenuCategoryType(e.target.value as 'food' | 'beverage' | 'other')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                  >
                    <option value="food">Makanan (KDS Dapur)</option>
                    <option value="beverage">Minuman (KDS Bar)</option>
                    <option value="other">Lainnya / Merchandise</option>
                  </select>
                </div>
              </div>

              {/* Harga Jual & Harga Modal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={menuPrice}
                    onChange={(e) => setMenuPrice(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Harga Modal / HPP (Rp)
                  </label>
                  <input
                    type="number"
                    value={menuCostPrice}
                    onChange={(e) => setMenuCostPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Deskripsi Menu (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={menuDescription}
                  onChange={(e) => setMenuDescription(e.target.value)}
                  placeholder="Keterangan singkat hidangan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              {/* Resep Bahan Baku (Otomatis potong stok saat kasir pesan) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Resep Bahan Baku (Auto-Deduct)</span>
                    <p className="text-[11px] text-slate-500">Stok inventori otomatis terpotong saat menu dipesan.</p>
                  </div>
                </div>

                {/* Add ingredient dropdown */}
                <div className="flex gap-2">
                  <select
                    id="recipe-inv-select"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Pilih Bahan dari Inventori --</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} (Stok: {inv.currentStock} {inv.unit})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById('recipe-inv-select') as HTMLSelectElement;
                      if (sel && sel.value) {
                        handleAddRecipeIngredient(sel.value);
                      }
                    }}
                    className="px-3 py-1.5 bg-[#0F766E] text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    + Bahan
                  </button>
                </div>

                {/* Selected recipe items */}
                {recipeList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                    <span className="font-semibold text-slate-800">{item.ingredientName}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => {
                          const updated = [...recipeList];
                          updated[idx].amount = Number(e.target.value);
                          setRecipeList(updated);
                        }}
                        className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs font-bold"
                      />
                      <span className="text-slate-500">{item.unit}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipeList(recipeList.filter((_, i) => i !== idx));
                        }}
                        className="text-rose-500 p-1 hover:bg-rose-50 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMenuModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="px-5 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-2 disabled:opacity-70 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Simpan Menu ke Firestore</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Kategori */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-3">Kelola Kategori Menu</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Kategori Baru
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Contoh: Makanan Utama, Dessert, Coffee"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0F766E] text-white font-bold rounded-xl text-xs shadow-sm"
                >
                  Tambah Kategori
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 max-h-48 overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Daftar Kategori:</span>
              {categories.map((c) => (
                <div key={c.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 text-xs">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(`Hapus kategori ${c.name}?`)) {
                        await deleteDoc(doc(db, 'categories', c.id));
                      }
                    }}
                    className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
