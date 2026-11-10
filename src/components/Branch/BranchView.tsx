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
  deleteDoc
} from 'firebase/firestore';
import { Branch, Order } from '../../types';
import {
  Building2,
  Plus,
  MapPin,
  Clock,
  Phone,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Check,
  X,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';

export const BranchView: React.FC = () => {
  const { userProfile, activeBranchId, setActiveBranchId } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('09:00 - 22:00');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync Branches
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(collection(db, 'branches'), where('ownerId', '==', userProfile.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Branch));
      setBranches(list);
    });
    return () => unsub();
  }, [userProfile?.uid]);

  // Sync Orders for Branch Analytics
  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
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
  }, [userProfile?.uid]);

  // Upload Branch Photo
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?.uid) return;
    setIsUploading(true);
    try {
      const path = `branches/${userProfile.uid}/${Date.now()}_${file.name}`;
      const url = await uploadImageHelper(file, path);
      setPhotoUrl(url);
    } catch (err) {
      console.error('Branch photo upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setName('');
    setAddress('');
    setPhone('');
    setOpeningHours('09:00 - 22:00');
    setPhotoUrl('');
    setIsActive(true);
    setShowModal(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setName(branch.name);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setOpeningHours(branch.openingHours || '09:00 - 22:00');
    setPhotoUrl(branch.photoUrl || '');
    setIsActive(branch.isActive);
    setShowModal(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userProfile?.uid) return;
    setIsSaving(true);

    try {
      if (editingBranch) {
        await updateDoc(doc(db, 'branches', editingBranch.id), {
          name: name.trim(),
          address,
          phone,
          openingHours,
          photoUrl,
          isActive,
          updatedAt: new Date().toISOString()
        });
      } else {
        const ref = doc(collection(db, 'branches'));
        const newBranch: Branch = {
          id: ref.id,
          ownerId: userProfile.uid,
          name: name.trim(),
          address,
          phone,
          openingHours,
          photoUrl,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(ref, newBranch);
        if (!activeBranchId) {
          setActiveBranchId(ref.id);
        }
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving branch:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus cabang "${branchName}"?`)) {
      await deleteDoc(doc(db, 'branches', branchId));
      if (activeBranchId === branchId) {
        setActiveBranchId('');
      }
    }
  };

  // Export Branch CSV Report
  const handleExportCSV = () => {
    let csv = 'ID Cabang,Nama Cabang,Alamat,Jam Buka,Total Transaksi,Total Omzet (Rp)\n';
    branches.forEach((b) => {
      const branchOrders = orders.filter((o) => o.branchId === b.id);
      const totalOmzet = branchOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      csv += `"${b.id}","${b.name}","${b.address || ''}","${b.openingHours || ''}",${branchOrders.length},${totalOmzet}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `laporan_cabang_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Manajemen Multi-Outlet</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Cabang Restoran & Toko
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Beralih antar cabang dalam 1 klik tanpa logout, pantau omzet per outlet atau gabungan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {branches.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Export CSV / Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cabang Baru</span>
          </button>
        </div>
      </div>

      {/* 1-Click Branch Switcher Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Cabang Aktif Saat Ini:</span>
          <span className="text-sm font-black text-[#0F766E]">
            {activeBranchId
              ? branches.find((b) => b.id === activeBranchId)?.name || 'Cabang Terpilih'
              : 'Semua Cabang (Data Gabungan)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveBranchId('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeBranchId === ''
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Gabungan
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBranchId(b.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                activeBranchId === b.id
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {activeBranchId === b.id && <Check className="w-3.5 h-3.5" />}
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Branches Grid */}
      {branches.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-6">
          <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Belum Ada Cabang Terdaftar</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Daftarkan outlet fisik, resto, cafe, atau booth Anda untuk memisahkan stok dan laporan omzet.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Cabang Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((branch) => {
            const branchOrders = orders.filter((o) => o.branchId === branch.id);
            const branchRevenue = branchOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const isCurrent = activeBranchId === branch.id;

            return (
              <div
                key={branch.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-sm transition hover:shadow-md ${
                  isCurrent ? 'border-[#0F766E] ring-2 ring-[#0F766E]/20' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Photo or Header */}
                  <div className="w-full h-36 rounded-xl bg-slate-100 mb-3 overflow-hidden relative border border-slate-100">
                    {branch.photoUrl ? (
                      <img
                        src={branch.photoUrl}
                        alt={branch.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <Building2 className="w-8 h-8 mb-1" />
                        <span className="text-[10px]">Foto outlet belum diunggah</span>
                      </div>
                    )}

                    <span
                      className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        branch.isActive
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-500 text-white'
                      }`}
                    >
                      {branch.isActive ? 'Operasional' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{branch.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{branch.address || 'Alamat belum diatur'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{branch.openingHours || '09:00 - 22:00'}</span>
                      </div>
                      {branch.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{branch.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Omzet Metric */}
                  <div className="mt-4 p-3 bg-teal-50/70 border border-teal-100 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Omzet Outlet</div>
                      <div className="text-base font-black text-[#0F766E]">
                        Rp {branchRevenue.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {branchOrders.length} Pesanan
                    </span>
                  </div>
                </div>

                {/* Branch Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveBranchId(branch.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#0F766E] text-white hover:bg-[#0d655e]'
                    }`}
                  >
                    {isCurrent ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    <span>{isCurrent ? 'Sedang Dipilih' : 'Pilih Cabang Ini'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(branch)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                      title="Edit Cabang"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBranch(branch.id, branch.name)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                      title="Hapus Cabang"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Tambah / Edit Cabang */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingBranch ? 'Edit Cabang' : 'Tambah Cabang Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-3.5">
              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Foto Cabang
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Cabang" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-[#0F766E]" />}
                      <span>Pilih Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPhoto}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Cabang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Cabang Senopati, Booth Mall A"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Merdeka No. 12"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Jam Buka
                  </label>
                  <input
                    type="text"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                    placeholder="09:00 - 22:00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    No Telepon
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812345678"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Simpan Cabang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
