import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Branch } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  activeBranch: Branch | null;
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  loading: boolean;
  isLocked: boolean;
  lockApp: () => void;
  unlockApp: (pin: string) => boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, storeName: string, phone: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  setupPhoneRecaptcha: (containerId: string) => RecaptchaVerifier | null;
  sendPhoneOtp: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyPhoneOtp: (confirmationResult: ConfirmationResult, otp: string, extraData?: { name?: string; storeName?: string }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkEmailVerified: () => Promise<boolean>;
  completeSetup: (storeName: string, logoUrl?: string, address?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => {
    return localStorage.getItem('kasirku_active_branch') || '';
  });
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  const setActiveBranchId = (id: string) => {
    setActiveBranchIdState(id);
    localStorage.setItem('kasirku_active_branch', id);
  };

  const loadUserProfile = async (uid: string, fallbackUser?: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUserProfile(data);
        if (data.assignedBranchId && !activeBranchId) {
          setActiveBranchId(data.assignedBranchId);
        }
      } else if (fallbackUser) {
        // Create initial profile for new Google or other sign-ins
        const newProfile: UserProfile = {
          uid: fallbackUser.uid,
          name: fallbackUser.displayName || 'Kasir',
          email: fallbackUser.email || '',
          phone: fallbackUser.phoneNumber || '',
          storeName: 'Toko Saya',
          role: 'owner',
          pin: '1234',
          setupCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserProfile(user.uid, user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await loadUserProfile(cred.user.uid, cred.user);
  };

  const registerWithEmail = async (email: string, pass: string, name: string, storeName: string, phone: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      name,
      email,
      phone,
      storeName,
      role: 'owner',
      pin: '1234',
      setupCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      setUserProfile(newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cred.user.uid}`);
    }
    // Send email verification
    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn('Could not send verification email:', e);
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await loadUserProfile(result.user.uid, result.user);
  };

  const setupPhoneRecaptcha = (containerId: string): RecaptchaVerifier | null => {
    if (typeof window === 'undefined') return null;
    try {
      return new RecaptchaVerifier(auth, containerId, {
        size: 'invisible'
      });
    } catch (e) {
      console.warn('Recaptcha init note:', e);
      return null;
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  };

  const verifyPhoneOtp = async (
    confirmationResult: ConfirmationResult,
    otp: string,
    extraData?: { name?: string; storeName?: string }
  ) => {
    const cred = await confirmationResult.confirm(otp);
    const uid = cred.user.uid;
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      const newProfile: UserProfile = {
        uid,
        name: extraData?.name || 'Kasir',
        phone: cred.user.phoneNumber || '',
        storeName: extraData?.storeName || 'Toko Saya',
        role: 'owner',
        pin: '1234',
        setupCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, newProfile);
      setUserProfile(newProfile);
    } else {
      setUserProfile(snap.data() as UserProfile);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const checkEmailVerified = async (): Promise<boolean> => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      return !!auth.currentUser.emailVerified;
    }
    return false;
  };

  const completeSetup = async (storeName: string, logoUrl?: string, address?: string) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const updates: Partial<UserProfile> = {
      storeName,
      setupCompleted: true,
      updatedAt: new Date().toISOString()
    };
    if (logoUrl) updates.photoUrl = logoUrl;
    
    await updateDoc(doc(db, 'users', uid), updates);
    setUserProfile(prev => prev ? { ...prev, ...updates } : null);

    // Save initial store setting
    const settingRef = doc(db, 'settings', uid);
    await setDoc(settingRef, {
      id: uid,
      ownerId: uid,
      storeName,
      logoUrl: logoUrl || '',
      address: address || '',
      taxRate: 10,
      serviceChargeRate: 5,
      receiptFooter: 'Terima Kasih Atas Kunjungan Anda!',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const lockApp = () => {
    setIsLocked(true);
  };

  const unlockApp = (pin: string): boolean => {
    const userPin = userProfile?.pin || '1234';
    if (pin === userPin) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    localStorage.removeItem('kasirku_active_branch');
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await loadUserProfile(currentUser.uid, currentUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        activeBranch,
        activeBranchId,
        setActiveBranchId,
        loading,
        isLocked,
        lockApp,
        unlockApp,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        setupPhoneRecaptcha,
        sendPhoneOtp,
        verifyPhoneOtp,
        sendPasswordReset,
        resendVerificationEmail,
        checkEmailVerified,
        completeSetup,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
