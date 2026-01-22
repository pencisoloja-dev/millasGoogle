import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { APP_ID } from '../constants';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [passwordResetForced, setPasswordResetForced] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Escuchar cambios en el perfil del usuario (para forzar cambio de password)
    const userDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.require_password_reset === true) {
           setPasswordResetForced(true);
        } else {
           setPasswordResetForced(false);
        }
        setLoadingAuth(false);
      } else {
         // Si el usuario no existe en DB, lo creamos
         setDoc(userDocRef, { 
            email: user.email, 
            created_at: serverTimestamp(), 
            require_password_reset: false 
         }, { merge: true });
         setLoadingAuth(false);
      }
    });

    return () => unsubUser();
  }, [user]);

  const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al salir:", error);
    }
  };

  return { user, loadingAuth, passwordResetForced, logout };
};