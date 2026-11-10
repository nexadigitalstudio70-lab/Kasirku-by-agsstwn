import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/Auth/AuthPage';
import { InitialSetupModal } from './components/Setup/InitialSetupModal';
import { PinModal } from './components/Common/PinModal';
import { Navbar } from './components/Layout/Navbar';
import { Sidebar } from './components/Layout/Sidebar';
import { DashboardView } from './components/Dashboard/DashboardView';
import { PosView } from './components/Pos/PosView';
import { KdsView } from './components/Kds/KdsView';
import { MenuView } from './components/Menu/MenuView';
import { InventoryView } from './components/Inventory/InventoryView';
import { BranchView } from './components/Branch/BranchView';
import { CustomerView } from './components/Customers/CustomerView';
import { ReportsView } from './components/Reports/ReportsView';
import { SettingsView } from './components/Settings/SettingsView';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { Order } from './types';
import { ShoppingCart, Zap, Loader2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentUser, userProfile, loading, isLocked, unlockApp } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cookingCount, setCookingCount] = useState<number>(0);

  // Sync cooking orders count for KDS notification badge in sidebar
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'orders'), where('status', '==', 'cooking'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCookingCount(snapshot.size);
    });
    return () => unsub();
  }, [currentUser]);

  // Loading skeleton screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-lg shadow-[#0F766E]/20 mb-4 animate-pulse">
          <div className="relative">
            <ShoppingCart className="w-7 h-7" />
            <Zap className="w-4 h-4 text-[#F97316] absolute -top-1 -right-1 fill-[#F97316]" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Loader2 className="w-4 h-4 animate-spin text-[#0F766E]" />
          <span>Memuat Kasirku by Agsstwn...</span>
        </div>
      </div>
    );
  }

  // Not logged in or requires email verification: show AuthPage
  if (!currentUser) {
    return <AuthPage />;
  }

  // If email not verified: show AuthPage (which renders verify-email step)
  if (!currentUser.emailVerified && currentUser.email) {
    return <AuthPage />;
  }

  // Initial Setup Modal if user hasn't completed setup
  const needsSetup = userProfile && userProfile.setupCompleted === false;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-[#14B8A6] selection:text-white">
      {/* Initial Setup Modal */}
      {needsSetup && (
        <InitialSetupModal onComplete={() => window.location.reload()} />
      )}

      {/* Screen Lock PIN Modal */}
      <PinModal
        isOpen={isLocked}
        title="Kasir Terkunci"
        description="Masukkan 4 digit PIN untuk membuka kembali layar kasir"
        expectedPin={userProfile?.pin || '1234'}
        allowCancel={false}
        onSuccess={() => unlockApp(userProfile?.pin || '1234')}
        onClose={() => {}}
      />

      {/* Top Navbar */}
      <Navbar
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* App Body with Sidebar + View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          orderCookingCount={cookingCount}
        />

        {/* Dynamic View Container */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'pos' && <PosView />}
          {activeTab === 'kds' && <KdsView />}
          {activeTab === 'menu' && <MenuView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'branch' && <BranchView />}
          {activeTab === 'customers' && <CustomerView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
