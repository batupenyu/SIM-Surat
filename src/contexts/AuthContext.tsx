import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type { UserProfile } from '../types/correspondence';
import { sanitizeText, SCHEMA_LIMITS } from '../utils/validation';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateUserProfileUnit: (unit: string, displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      const userPath = `users/${firebaseUser.uid}`;
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          const safeName = sanitizeText(
            firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Staf Persuratan',
            SCHEMA_LIMITS.NAME_MAX
          );
          const safeEmail = sanitizeText(
            firebaseUser.email || 'user@example.com',
            SCHEMA_LIMITS.EMAIL_MAX
          );
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: safeName,
            email: safeEmail,
            unit: 'Sekretariat Umum',
            role: 'staff',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const createdSnap = await getDoc(userRef);
          if (createdSnap.exists()) {
            setProfile(createdSnap.data() as UserProfile);
          }
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch (wrapped) {
          setAuthError(
            wrapped instanceof Error ? wrapped.message : 'Gagal memuat profil pengguna.'
          );
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const updateUserProfileUnit = async (unit: string, displayName: string) => {
    if (!user) return;
    const safeUnit = sanitizeText(unit, SCHEMA_LIMITS.UNIT_MAX);
    const safeName = sanitizeText(displayName, SCHEMA_LIMITS.NAME_MAX);
    if (!safeUnit || !safeName) return;

    const userPath = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        unit: safeUnit,
        displayName: safeName,
        email: sanitizeText(user.email || profile?.email || 'user@example.com', SCHEMA_LIMITS.EMAIL_MAX),
        updatedAt: serverTimestamp(),
      });
      const updated = await getDoc(userRef);
      if (updated.exists()) {
        setProfile(updated.data() as UserProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authReady,
        signingIn,
        authError,
        signInWithGoogle,
        signOutUser,
        updateUserProfileUnit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
