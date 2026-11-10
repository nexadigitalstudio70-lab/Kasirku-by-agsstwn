import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationResult } from 'firebase/auth';
import { ShoppingCart, Zap, Mail, Phone, Lock, User, Store, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot' | 'verify-email' | 'verify-phone' | 'verified-success';
type LoginTab = 'email' | 'phone';

export const AuthPage: React.FC = () => {
  const {
    currentUser,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    setupPhoneRecaptcha,
    sendPhoneOtp,
    verifyPhoneOtp,
    sendPasswordReset,
    resendVerificationEmail,
    checkEmailVerified
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loginTab, setLoginTab] = useState<LoginTab>('email');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('+62');
  const [otpCode, setOtpCode] = useState('');

  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // If user is already logged in but email is not verified, show verification view
  useEffect(() => {
    if (currentUser && !currentUser.emailVerified && currentUser.email && mode !== 'verified-success') {
      setMode('verify-email');
    }
  }, [currentUser]);

  // Countdown timer for OTP
  useEffect(() => {
    if (otpTimer > 0) {
      const interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [otpTimer]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Harap masukkan email dan kata sandi.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email, password);
      // Auth listener handles the rest
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj.code === 'auth/user-not-found' || errorObj.code === 'auth/wrong-password' || errorObj.code === 'auth/invalid-credential') {
        setError('Email atau kata sandi yang Anda masukkan salah.');
      } else if (errorObj.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError('Gagal masuk: ' + (errorObj.message || 'Terjadi kesalahan sistem.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Nama Lengkap wajib diisi.');
      return;
    }
    if (!storeName.trim()) {
      setError('Nama Restoran / Toko wajib diisi.');
      return;
    }
    if (!email.trim() && phone === '+62') {
      setError('Harap isi Email atau Nomor HP.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(email, password, name, storeName, phone);
      setMode('verify-email');
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar. Silakan login atau gunakan lupa password.');
      } else {
        setError('Pendaftaran gagal: ' + (errorObj.message || 'Periksa kembali data Anda.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      // Google logins are verified automatically
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError('Login Google dibatalkan atau gagal: ' + (errorObj.message || 'Coba lagi.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = phone.trim();
    if (!cleaned.startsWith('+62') || cleaned.length < 10) {
      setError('Nomor telepon harus berformat Indonesia (+628xxx...) minimal 10 digit.');
      return;
    }

    setLoading(true);
    try {
      const recaptcha = setupPhoneRecaptcha('recaptcha-container');
      if (!recaptcha) {
        throw new Error('Gagal menyiapkan verifikasi reCAPTCHA');
      }
      const confirmation = await sendPhoneOtp(cleaned, recaptcha);
      setConfirmationResult(confirmation);
      setOtpTimer(60);
      setMode('verify-phone');
      setSuccessMsg('Kode verifikasi OTP telah dikirimkan ke ' + cleaned);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError('Gagal mengirimkan OTP: ' + (errorObj.message || 'Periksa format nomor telepon Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!confirmationResult) {
      setError('Sesi verifikasi kadaluarsa. Silakan kirim ulang OTP.');
      return;
    }
    if (otpCode.length !== 6) {
      setError('Harap masukkan 6 digit kode OTP dengan benar.');
      return;
    }

    setLoading(true);
    try {
      await verifyPhoneOtp(confirmationResult, otpCode, {
        name: name || 'Kasir',
        storeName: storeName || 'Toko Saya'
      });
      setMode('verified-success');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError('Kode OTP salah atau telah kadaluarsa: ' + (errorObj.message || 'Coba lagi.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Masukkan email Anda untuk menerima link reset.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSuccessMsg('Link reset kata sandi telah dikirim ke email ' + email + '. Silakan cek kotak masuk atau folder spam.');
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError('Gagal mengirim email reset: ' + (errorObj.message || 'Periksa kembali email Anda.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmailVerified = async () => {
    setLoading(true);
    setError(null);
    try {
      const isVerified = await checkEmailVerified();
      if (isVerified) {
        setMode('verified-success');
      } else {
        setError('Email belum terverifikasi. Harap buka inbox email Anda dan klik link konfirmasi dari Firebase.');
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError('Gagal memeriksa verifikasi: ' + (errorObj.message || 'Coba sesaat lagi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-[#14B8A6] selection:text-white">
      {/* Invisible container for Firebase phone recaptcha */}
      <div id="recaptcha-container"></div>

      {/* Top Header / Branding */}
      <header className="w-full pt-8 pb-4 flex flex-col items-center px-4">
        <div className="flex items-center gap-3">
          <div className="w-13 h-13 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-lg shadow-[#0F766E]/20">
            <div className="relative">
              <ShoppingCart className="w-7 h-7" />
              <Zap className="w-4 h-4 text-[#F97316] absolute -top-1 -right-1 fill-[#F97316]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Kasirku <span className="text-[#0F766E]">by Agsstwn</span>
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#0F766E]">
              Kasir Cepat, Dapur Sigap, Omzet Naik.
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="w-full max-w-md mx-auto px-4 py-4 flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          
          {/* Messages */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-3 text-teal-800 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#0F766E]" />
              <div className="leading-snug">{successMsg}</div>
            </div>
          )}

          {/* VIEW 1: LOGIN */}
          {mode === 'login' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#0F172A]">Masuk ke Akun</h2>
                <p className="text-sm text-slate-500 mt-1">Pilih metode masuk untuk mengelola kasir & toko Anda</p>
              </div>

              {/* Login Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => { setLoginTab('email'); setError(null); }}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                    loginTab === 'email'
                      ? 'bg-white text-[#0F766E] shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Email & Password
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginTab('phone'); setError(null); }}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                    loginTab === 'phone'
                      ? 'bg-white text-[#0F766E] shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nomor HP (OTP)
                </button>
              </div>

              {/* Email Login Form */}
              {loginTab === 'email' && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contoh@kasirku.id"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); }}
                        className="text-xs text-[#0F766E] hover:underline font-semibold"
                      >
                        Lupa Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md shadow-[#0F766E]/20 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Masuk Sekarang</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Phone Login Form */}
              {loginTab === 'phone' && (
                <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nomor HP Aktif
                    </label>
                    <div className="relative">
                      <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+6281234567890"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Kode verifikasi OTP 6 digit akan dikirim melalui SMS ke nomor ini.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md shadow-[#0F766E]/20 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Kirim Kode OTP</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Google Login Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold">atau masuk dengan</span>
                </div>
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm shadow-sm transition flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Lanjutkan dengan Google</span>
              </button>

              {/* Switch to Register */}
              <div className="mt-6 text-center text-sm text-slate-600">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
                  className="text-[#0F766E] font-bold hover:underline"
                >
                  Daftar Gratis
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: REGISTER */}
          {mode === 'register' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#0F172A]">Daftar Akun Baru</h2>
                <p className="text-sm text-slate-500 mt-1">Mulai kelola kasir dan tingkatkan omzet restoran Anda</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Anda"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Restoran / Toko
                  </label>
                  <div className="relative">
                    <Store className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Contoh: Kopi Nusantara"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <div className="relative">
                    <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+6281234567890"
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Konfirmasi Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang kata sandi"
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md shadow-[#0F766E]/20 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-70"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Daftar Sekarang</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-sm text-slate-600">
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                  className="text-[#0F766E] font-bold hover:underline"
                >
                  Masuk di sini
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#0F172A]">Lupa Kata Sandi</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi melalui Firebase.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Terdaftar
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh@kasirku.id"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>Kirim Tautan Reset Password</span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-sm text-[#0F766E] font-bold hover:underline"
                >
                  ← Kembali ke Halaman Masuk
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: EMAIL VERIFICATION */}
          {mode === 'verify-email' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-teal-100 text-[#0F766E] rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#0F172A] mb-2">Cek Email Kamu, Klik Link Verifikasi</h2>
              <p className="text-sm text-slate-600 mb-6">
                Kami telah mengirimkan tautan verifikasi ke email <strong className="text-slate-800">{currentUser?.email || email}</strong>. Silakan periksa inbox atau spam, lalu klik tautan untuk mengaktifkan akun.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleCheckEmailVerified}
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Saya Sudah Verifikasi / Cek Status</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await resendVerificationEmail();
                      setSuccessMsg('Email verifikasi baru berhasil dikirim!');
                    } catch (e: unknown) {
                      const errorObj = e as { message?: string };
                      setError('Gagal mengirim ulang email: ' + (errorObj.message || 'Coba lagi nanti'));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
                >
                  Kirim Ulang Email Verifikasi
                </button>
              </div>
            </div>
          )}

          {/* VIEW 5: PHONE OTP VERIFICATION */}
          {mode === 'verify-phone' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-teal-100 text-[#0F766E] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-[#0F172A]">Verifikasi Nomor Telepon</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Masukkan 6 digit kode OTP yang dikirimkan ke <strong className="text-slate-800">{phone}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    required
                    className="w-full py-3 text-center text-2xl tracking-[0.5em] font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'Verifikasi & Lanjutkan'}
                </button>

                <div className="text-center">
                  {otpTimer > 0 ? (
                    <span className="text-xs text-slate-500 font-medium">
                      Kirim ulang kode dalam <span className="font-bold text-[#F97316]">{otpTimer}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      className="text-xs text-[#0F766E] font-bold hover:underline"
                    >
                      Kirim Ulang Kode OTP
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* VIEW 6: VERIFIED SUCCESS */}
          {mode === 'verified-success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-[#0F172A] mb-2">Verifikasi Berhasil!</h2>
              <p className="text-sm text-slate-600 mb-6">
                Akun Anda telah terverifikasi resmi. Anda dapat langsung melanjutkan ke pengaturan awal toko Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-3.5 px-4 bg-[#0F766E] hover:bg-[#0d655e] text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Lanjut ke Setup Awal</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Mandatory Exact Footer: "© 2026 Kasirku by Agsstwn. Seluruh Hak Cipta Dilindungi." */}
      <footer className="w-full py-4 text-center px-4">
        <p className="text-xs font-medium text-slate-600 tracking-wide">
          © 2026 Kasirku by Agsstwn. Seluruh Hak Cipta Dilindungi.
        </p>
      </footer>
    </div>
  );
};
