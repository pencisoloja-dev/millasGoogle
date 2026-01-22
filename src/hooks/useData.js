import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { APP_ID, COLLECTION_NAMES } from '../constants';

export const useData = (user) => {
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!user) return;

    // 1. Suscripción a Viajes
    const qTrips = query(
        collection(db, 'artifacts', APP_ID, COLLECTION_NAMES.USERS, user.uid, COLLECTION_NAMES.TRIPS), 
        orderBy('fecha', 'desc'), 
        limit(50)
    );
    const unsubTrips = onSnapshot(qTrips, snap => 
        setTrips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );

    // 2. Suscripción a Gastos
    const qExpenses = query(
        collection(db, 'artifacts', APP_ID, COLLECTION_NAMES.USERS, user.uid, COLLECTION_NAMES.EXPENSES), 
        orderBy('uploadedAt', 'desc'), 
        limit(50)
    );
    const unsubExpenses = onSnapshot(qExpenses, snap => 
        setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );

    return () => {
        unsubTrips();
        unsubExpenses();
    };
  }, [user]);

  return { trips, expenses };
};