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
  deleteDoc
} from 'firebase/firestore';
import { Customer, Reservation, TableItem } from '../../types';
import {
  Users2,
  CalendarCheck,
  Plus,
  Search,
  Phone,
  Gift,
  Award,
  Calendar,
  Clock,
  Trash2,
  X,
  CheckCircle2,
  UserPlus
} from 'lucide-react';

export const CustomerView: React.FC = () => {
  const { userProfile, activeBranchId } = useAuth();

  const [activeTab, setActiveTab] = useState<'customers' | 'reservations'>('customers');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);

  // Search
  const [search, setSearch] = useState('');

  // Customer Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+62');
  const [birthDate, setBirthDate] = useState('');
  const [notes, setNotes] = useState('');

  // Reservation Modal
  const [showResModal, setShowResModal] = useState(false);
  const [resCustomerName, setResCustomerName] = useState('');
  const [resCustomerPhone, setResCustomerPhone] = useState('+62');
  const [resTableId, setResTableId] = useState('');
  const [resDate, setResDate] = useState(new Date().toISOString().split('T')[0]);
  const [resTime, setResTime] = useState('19:00');
  const [resGuestCount, setResGuestCount] = useState<number>(4);
  const [resNotes, setResNotes] = useState('');

  // Sync Customers
  useEffect(() => {
    const q = query(collection(db, 'customers'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(list);
    });
    return () => unsub();
  }, []);

  // Sync Reservations
  useEffect(() => {
    const q = query(collection(db, 'reservations'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Reservation[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Reservation));
      list.sort((a, b) => (b.reservationDate + b.reservationTime).localeCompare(a.reservationDate + a.reservationTime));
      setReservations(list);
    });
    return () => unsub();
  }, []);

  // Sync Tables for reservation selection
  useEffect(() => {
    const q = query(collection(db, 'tables'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: TableItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as TableItem));
      setTables(list);
    });
    return () => unsub();
  }, []);

  // Save Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userProfile?.uid) return;

    const ref = doc(collection(db, 'customers'));
    const newCust: Customer = {
      id: ref.id,
      ownerId: userProfile.uid,
      branchId: activeBranchId || '',
      name: name.trim(),
      phone: phone.trim(),
      points: 50, // Welcome points
      totalSpent: 0,
      orderCount: 0,
      birthDate,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, newCust);
    setName('');
    setPhone('+62');
    setBirthDate('');
    setNotes('');
    setShowCustomerModal(false);
  };

  // Save Reservation
  const handleSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resCustomerName.trim() || !userProfile?.uid) return;

    const selectedTable = tables.find((t) => t.id === resTableId);

    const ref = doc(collection(db, 'reservations'));
    const newRes: Reservation = {
      id: ref.id,
      branchId: activeBranchId || 'default',
      ownerId: userProfile.uid,
      tableId: resTableId,
      tableName: selectedTable?.name || 'Meja Umum',
      customerName: resCustomerName.trim(),
      customerPhone: resCustomerPhone.trim(),
      reservationDate: resDate,
      reservationTime: resTime,
      guestCount: Number(resGuestCount) || 2,
      status: 'confirmed',
      notes: resNotes,
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, newRes);

    setShowResModal(false);
    setResCustomerName('');
    setResCustomerPhone('+62');
    setResNotes('');
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F766E] uppercase tracking-wider">
            <Users2 className="w-4 h-4" />
            <span>Loyalty & Table Booking</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Pelanggan, Reservasi & Member
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Database nomor HP pelanggan, perolehan poin member, dan jadwal booking meja.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'customers' ? (
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Pelanggan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowResModal(true)}
              className="px-4 py-2.5 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#0F766E]/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Buat Reservasi Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex p-1 bg-slate-200/80 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'customers'
                ? 'bg-white text-[#0F766E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Database Pelanggan ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reservations')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'reservations'
                ? 'bg-white text-[#0F766E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reservasi Meja ({reservations.length})
          </button>
        </div>

        {activeTab === 'customers' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / nomor HP..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>
        )}
      </div>

      {/* TAB 1: CUSTOMERS */}
      {activeTab === 'customers' && (
        <div>
          {customers.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-6">
              <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Belum Ada Pelanggan Terdaftar</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Kumpulkan kontak pelanggan setia Anda untuk memberikan poin diskon dan ucapan ulang tahun.
              </p>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="px-5 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-5 h-5" />
                <span>Tambah Pelanggan Pertama</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map((cust) => (
                <div key={cust.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{cust.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cust.phone}</span>
                        </div>
                      </div>
                      <span className="w-9 h-9 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center font-bold text-xs">
                        {cust.name.charAt(0)}
                      </span>
                    </div>

                    {/* Member Points badge */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-[#F97316] font-bold">
                        <Award className="w-4 h-4" />
                        <span>{cust.points || 0} Poin</span>
                      </div>
                      <span className="text-slate-500">
                        Total: Rp {(cust.totalSpent || 0).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {cust.birthDate && (
                      <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-rose-500" />
                        <span>Ultah: {cust.birthDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        window.open(`https://wa.me/${cust.phone.replace(/\D/g, '')}?text=Halo%20${cust.name},%20terima%20kasih%20telah%20menjadi%20pelanggan%20setia%20kami!`, '_blank');
                      }}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      Kirim Pesan WA
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Hapus pelanggan ${cust.name}?`)) {
                          await deleteDoc(doc(db, 'customers', cust.id));
                        }
                      }}
                      className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESERVATIONS */}
      {activeTab === 'reservations' && (
        <div>
          {reservations.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center my-6">
              <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CalendarCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Belum Ada Reservasi Meja</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Catat pemesanan meja tamu lebih awal beserta tanggal, jam, dan jumlah tamu.
              </p>
              <button
                type="button"
                onClick={() => setShowResModal(true)}
                className="px-5 py-3 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold text-sm rounded-xl shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <CalendarCheck className="w-5 h-5" />
                <span>Buat Reservasi Pertama</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4">Nama Pelanggan</th>
                    <th className="p-4">Meja</th>
                    <th className="p-4">Tamu</th>
                    <th className="p-4">Catatan</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {reservations.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-teal-600" />
                          <span>{res.reservationDate}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Pukul {res.reservationTime}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{res.customerName}</div>
                        <div className="text-[11px] text-slate-400">{res.customerPhone}</div>
                      </td>
                      <td className="p-4 font-semibold text-[#0F766E]">
                        {res.tableName}
                      </td>
                      <td className="p-4">
                        {res.guestCount} Orang
                      </td>
                      <td className="p-4 text-slate-500">
                        {res.notes || '-'}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                          {res.status === 'confirmed' ? 'Dikonfirmasi' : res.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Hapus reservasi untuk ${res.customerName}?`)) {
                              await deleteDoc(doc(db, 'reservations', res.id));
                            }
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Tambah Pelanggan */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Tambah Pelanggan Baru</h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Lengkap"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nomor Telepon / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+628123456789"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tanggal Lahir (Untuk Promo Ultah)
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Pelanggan
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alergi, makanan favorit, dll."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Reservasi */}
      {showResModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Buat Reservasi Meja Baru</h3>
              <button onClick={() => setShowResModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReservation} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Pemesan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={resCustomerName}
                    onChange={(e) => setResCustomerName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    No WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={resCustomerPhone}
                    onChange={(e) => setResCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Pilih Meja
                  </label>
                  <select
                    value={resTableId}
                    onChange={(e) => setResTableId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="">-- Meja Bebas --</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.capacity} Kursi)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Jumlah Tamu
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={resGuestCount}
                    onChange={(e) => setResGuestCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Jam
                  </label>
                  <input
                    type="time"
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Catatan Khusus (Acara ultah, dekor, dll.)
                </label>
                <input
                  type="text"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="Contoh: Sediakan baby chair"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Simpan Reservasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
