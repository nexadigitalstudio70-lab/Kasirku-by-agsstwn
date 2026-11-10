import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { uploadImageHelper, db } from '../../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Store, MapPin, Utensils, Image as ImageIcon, ArrowRight, Check, Sparkles, Loader2 } from 'lucide-react';

interface InitialSetupModalProps {
  onComplete: () => void;
}

export const InitialSetupModal: React.FC<InitialSetupModalProps> = ({ onComplete }) => {
  const { currentUser, completeSetup, setActiveBranchId } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Profil Toko
  const [storeName, setStoreName] = useState('Resto Saya');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');

  // Step 2: Cabang Pertama (Bisa lewati)
  const [branchName, setBranchName] = useState('Cabang Utama');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchHours, setBranchHours] = useState('09:00 - 22:00');
  const [branchPhotoUrl, setBranchPhotoUrl] = useState('');
  const [skipBranch, setSkipBranch] = useState(false);

  // Step 3: Menu Pertama (Bisa lewati)
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState<number>(25000);
  const [menuPhotoUrl, setMenuPhotoUrl] = useState('');
  const [menuCategoryType, setMenuCategoryType] = useState<'food' | 'beverage'>('food');
  const [skipMenu, setSkipMenu] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'logo' | 'branch' | 'menu') => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setSaving(true);
    try {
      const path = `uploads/${currentUser.uid}/${target}_${Date.now()}_${file.name}`;
      const url = await uploadImageHelper(file, path);
      if (target === 'logo') setStoreLogoUrl(url);
      if (target === 'branch') setBranchPhotoUrl(url);
      if (target === 'menu') setMenuPhotoUrl(url);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const uid = currentUser.uid;

      // 1. Profil Toko
      await completeSetup(storeName, storeLogoUrl, storeAddress);

      // 2. Cabang Pertama jika tidak dilewati
      let createdBranchId = '';
      if (!skipBranch && branchName.trim()) {
        const branchRef = doc(collection(db, 'branches'));
        createdBranchId = branchRef.id;
        await setDoc(branchRef, {
          id: branchRef.id,
          ownerId: uid,
          name: branchName.trim(),
          address: branchAddress.trim() || storeAddress.trim(),
          phone: '',
          openingHours: branchHours,
          photoUrl: branchPhotoUrl,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setActiveBranchId(branchRef.id);
      }

      // 3. Menu Pertama jika tidak dilewati
      if (!skipMenu && menuName.trim()) {
        const menuRef = doc(collection(db, 'menus'));
        await setDoc(menuRef, {
          id: menuRef.id,
          ownerId: uid,
          branchId: createdBranchId || '',
          name: menuName.trim(),
          price: Number(menuPrice) || 0,
          costPrice: Math.round(Number(menuPrice) * 0.5),
          description: '',
          photoUrl: menuPhotoUrl,
          isAvailable: true,
          categoryType: menuCategoryType,
          variants: [],
          recipe: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      onComplete();
    } catch (err) {
      console.error('Setup error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Stepper */}
        <div className="bg-[#0F766E] text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#14B8A6]" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-100">Setup Awal Kasirku</span>
            </div>
            <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
              Langkah {step} dari 3
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            {step === 1 && '1. Atur Profil Restoran / Toko'}
            {step === 2 && '2. Buat Cabang Pertama'}
            {step === 3 && '3. Tambah Menu Pertama'}
          </h2>
          <p className="text-xs sm:text-sm text-teal-100 mt-1">
            {step === 1 && 'Lengkapi informasi bisnis Anda untuk nota dan sistem.'}
            {step === 2 && 'Atur lokasi operasional utama Anda (dapat dilewati).'}
            {step === 3 && 'Tambahkan hidangan atau produk pertama Anda (dapat dilewati).'}
          </p>

          {/* Stepper Dots */}
          <div className="flex gap-2 mt-4">
            <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Restoran / Toko <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Store className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Contoh: Cafe Kenangan"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Logo Restoran (Disimpan ke Storage)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {storeLogoUrl ? (
                      <img src={storeLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition">
                    <span>Pilih Foto Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alamat Restoran / Pusat
                </label>
                <div className="relative">
                  <MapPin className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                  <textarea
                    rows={2}
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="Jl. Merdeka No. 45, Jakarta"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-[#0F766E]">Buat Cabang Sekarang?</h4>
                  <p className="text-xs text-slate-600">Anda dapat melewati ini dan menambahkan nanti.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSkipBranch(!skipBranch)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                    skipBranch ? 'bg-slate-200 text-slate-700' : 'bg-[#0F766E] text-white'
                  }`}
                >
                  {skipBranch ? 'Dilewati' : 'Aktif'}
                </button>
              </div>

              {!skipBranch && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nama Cabang
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="Cabang Pusat"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Foto Cabang
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {branchPhotoUrl ? (
                          <img src={branchPhotoUrl} alt="Cabang" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
                        Upload Foto
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'branch')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Jam Buka
                      </label>
                      <input
                        type="text"
                        value={branchHours}
                        onChange={(e) => setBranchHours(e.target.value)}
                        placeholder="09:00 - 22:00"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-[#0F766E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Alamat Cabang
                      </label>
                      <input
                        type="text"
                        value={branchAddress}
                        onChange={(e) => setBranchAddress(e.target.value)}
                        placeholder="Alamat cabang"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-[#0F766E]"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-[#0F766E]">Tambah Menu Sekarang?</h4>
                  <p className="text-xs text-slate-600">Dapat juga ditambahkan nanti di Menu & Kategori.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSkipMenu(!skipMenu)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                    skipMenu ? 'bg-slate-200 text-slate-700' : 'bg-[#0F766E] text-white'
                  }`}
                >
                  {skipMenu ? 'Dilewati' : 'Aktif'}
                </button>
              </div>

              {!skipMenu && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nama Menu
                    </label>
                    <div className="relative">
                      <Utensils className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                        placeholder="Contoh: Nasi Goreng Spesial / Es Kopi Gula Aren"
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F766E]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tipe Menu
                      </label>
                      <select
                        value={menuCategoryType}
                        onChange={(e) => setMenuCategoryType(e.target.value as 'food' | 'beverage')}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F766E]"
                      >
                        <option value="food">Makanan (Dapur)</option>
                        <option value="beverage">Minuman (Bar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Harga Jual (Rp)
                      </label>
                      <input
                        type="number"
                        value={menuPrice}
                        onChange={(e) => setMenuPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-[#0F766E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Foto Menu (Rasio 1:1, Tajam)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {menuPhotoUrl ? (
                          <img src={menuPhotoUrl} alt="Menu" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
                        Upload Foto Menu
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'menu')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Stepper Buttons */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Kembali
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
                className="px-5 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer text-sm"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleFinish}
                className="px-6 py-2.5 bg-[#F97316] hover:bg-[#ea580c] text-white font-black rounded-xl shadow-md shadow-[#F97316]/30 flex items-center gap-2 cursor-pointer text-sm disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firebase...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Selesai & Mulai Jualan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
