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
  addDoc
} from 'firebase/firestore';
import { UserProfile, UserRole } from '../../types';
import {
  Settings,
  Store,
  Printer,
  Percent,
  Users,
  ShieldCheck,
  LogOut,
  Image as ImageIcon,
  Check,
  Plus,
  Lock,
  Wifi,
  CloudCheck,
  Loader2
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { userProfile, currentUser, logout, refreshProfile } = useAuth();

  // Store Profile State
  const [storeName, setStoreName] = useState(userProfile?.storeName || 'Toko Saya');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [logoUrl, setLogoUrl] = useState(userProfile?.photoUrl || '');

  // Rates State
  const [taxRate, setTaxRate] = useState<number>(10);
  const [serviceRate, setServiceRate] = useState<number>(5);
  const [receiptFooter, setReceiptFooter] = useState('Terima Kasih Atas Kunjungan Anda!');
  const [cashierPin, setCashierPin] = useState(userProfile?.pin || '1234');

  // Printer State
  const [printerName, setPrinterName] = useState('Thermal POS 58mm');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');

  // Staff Management State
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('cashier');
  const [newStaffPin, setNewStaffPin] = useState('1234');

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync settings document
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'settings', currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.storeName) setStoreName(data.storeName);
        if (data.address) setAddress(data.address);
        if (data.phone) setPhone(data.phone);
        if (data.taxRate !== undefined) setTaxRate(data.taxRate);
        if (data.serviceChargeRate !== undefined) setServiceRate(data.serviceChargeRate);
        if (data.receiptFooter) setReceiptFooter(data.receiptFooter);
        if (data.bluetoothPrinterName) setPrinterName(data.bluetoothPrinterName);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Sync Staff list from Firestore users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => list.push({ uid: doc.id, ...doc.data() } as UserProfile));
      setStaffList(list);
    });
    return () => unsub();
  }, []);

  // Upload Logo
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;
    setUploadingLogo(true);
    try {
      const path = `logos/${currentUser.uid}/${Date.now()}_${file.name}`;
      const url = await uploadImageHelper(file, path);
      setLogoUrl(url);
    } catch (err) {
      console.error('Logo upload note:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    setSaving(true);
    setSuccessMsg(null);

    try {
      // 1. Update user profile
      await updateDoc(doc(db, 'users', currentUser.uid), {
        storeName,
        phone,
        pin: cashierPin,
        photoUrl: logoUrl,
        updatedAt: new Date().toISOString()
      });

      // 2. Update store setting
      await setDoc(
        doc(db, 'settings', currentUser.uid),
        {
          id: currentUser.uid,
          ownerId: currentUser.uid,
          storeName,
          address,
          phone,
          taxRate: Number(taxRate) || 0,
          serviceChargeRate: Number(serviceRate) || 0,
          receiptFooter,
          bluetoothPrinterName: printerName,
          logoUrl,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      await refreshProfile();
      setSuccessMsg('Pengaturan berhasil disimpan ke Firebase!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Add new staff user
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !currentUser?.uid) return;

    const newStaffId = `staff_${Date.now()}`;
    const newStaff: UserProfile = {
      uid: newStaffId,
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: newStaffPin,
      storeName,
      setupCompleted: true,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', newStaffId), newStaff);
    setShowAddStaffModal(false);
    setNewStaffName('');
    setNewStaffPin('1234');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <Settings className="w-4 h-4" />
            <span>Konfigurasi Sistem POS</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Pengaturan Toko & Keamanan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Atur profil bisnis, printer bluetooth, pajak resto PB1, PIN otorisasi, dan akun staff.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs sm:text-sm rounded-xl border border-rose-200 flex items-center gap-2 cursor-pointer transition active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sesi</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-2 text-teal-800 text-sm animate-in fade-in">
          <Check className="w-5 h-5 text-[#0F766E]" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* SECTION 1: Profil Toko & Logo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store className="w-5 h-5 text-[#0F766E]" />
            <h2 className="text-base font-bold text-slate-900">Profil Bisnis & Logo Nota</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 shadow-xs inline-flex items-center gap-1.5">
                {uploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0F766E]" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-[#0F766E]" />
                )}
                <span>Ganti Foto Logo Toko</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadLogo}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400">
                Logo ini akan tercetak pada struk belanja dan tampil di header aplikasi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nama Toko / Restoran
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nomor Telepon Kasir
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Alamat Toko (Muncul di Struk)
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Merdeka No. 10, Jakarta"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
        </div>

        {/* SECTION 2: Pajak PB1 & Service Charge */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Percent className="w-5 h-5 text-[#0F766E]" />
            <h2 className="text-base font-bold text-slate-900">Tarif Pajak & Biaya Layanan</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Pajak Restoran PB1 (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-[#0F766E]"
              />
              <p className="text-[11px] text-slate-400 mt-1">Standar PB1 daerah: 10%</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Service Charge (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={serviceRate}
                onChange={(e) => setServiceRate(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-[#0F766E]"
              />
              <p className="text-[11px] text-slate-400 mt-1">Biaya layanan resto (opsional, cth: 5%)</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Pesan Footer Struk Belanja
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* SECTION 3: Printer Bluetooth & Thermal Receipt */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Printer className="w-5 h-5 text-[#0F766E]" />
            <h2 className="text-base font-bold text-slate-900">Printer Bluetooth & Struk Kasir</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Nama Printer Struk
              </label>
              <input
                type="text"
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                placeholder="Thermal Printer Bluetooth"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Lebar Kertas Thermal
              </label>
              <select
                value={paperWidth}
                onChange={(e) => setPaperWidth(e.target.value as '58mm' | '80mm')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              >
                <option value="58mm">58 mm (Ukuran Standar Kasir Portabel)</option>
                <option value="80mm">80 mm (Ukuran Lebar Mesin Kasir POS)</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 4: Keamanan & PIN Kasir */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Lock className="w-5 h-5 text-[#0F766E]" />
            <h2 className="text-base font-bold text-slate-900">PIN Keamanan & Kunci Layar</h2>
          </div>

          <div className="max-w-xs">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              4 Digit PIN Kasir / Otorisasi Void
            </label>
            <input
              type="password"
              maxLength={4}
              value={cashierPin}
              onChange={(e) => setCashierPin(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-xl font-mono font-bold tracking-[0.5em] focus:ring-2 focus:ring-[#0F766E]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Digunakan untuk membuka kunci layar kasir dan menyetujui void pesanan.
            </p>
          </div>
        </div>

        {/* SECTION 5: Manajemen Akun & Staff */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0F766E]" />
              <h2 className="text-base font-bold text-slate-900">Manajemen Pengguna & Staff</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-[#0F766E] font-bold text-xs rounded-xl border border-teal-200 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Staff</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {staffList.map((st) => (
              <div key={st.uid} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#0F766E] text-white flex items-center justify-center font-bold text-xs uppercase">
                    {st.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{st.name}</div>
                    <div className="text-[10px] text-slate-400 capitalize">{st.role} • PIN: ****</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                  {st.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-70"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Simpan Semua Perubahan</span>
          </button>
        </div>
      </form>

      {/* MODAL: Tambah Staff */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-3">Tambah Akun Staff Baru</h3>
            <form onSubmit={handleAddStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Staff
                </label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Nama Kasir / Pelayan"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Peran / Hak Akses
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                >
                  <option value="cashier">Kasir (Transaksi & Meja)</option>
                  <option value="waiter">Pelayan (Pesan Menu Saja)</option>
                  <option value="kitchen">Dapur (Layar KDS Saja)</option>
                  <option value="manager">Manajer (Void & Laporan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  PIN Kasir (4 Digit)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0F766E] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Simpan Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Exact Footer at the bottom of Settings */}
      <footer className="w-full pt-8 pb-4 text-center">
        <p className="text-xs font-medium text-slate-600 tracking-wide">
          © 2026 Kasirku by Agsstwn. Seluruh Hak Cipta Dilindungi.
        </p>
      </footer>
    </div>
  );
};
