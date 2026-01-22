// src/hooks/useVehicles.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { APP_ID } from '../constants';

export const useVehicles = (user) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Ruta: artifacts -> APP_ID -> users -> UID -> config -> vehicles
    const configRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'vehicles');

    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVehicles(data.list || []);
      } else {
        // Si no existe el documento, iniciamos vacío
        setVehicles([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addVehicle = async (vehicleData) => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'vehicles');
    
    try {
        // Verificar si el documento existe, si no, crearlo
        const docSnap = await getDoc(configRef);
        if (!docSnap.exists()) {
            await setDoc(configRef, { list: [] });
        }

        const newVehicle = {
            id: Date.now().toString(), // ID único simple
            ...vehicleData
        };

        await updateDoc(configRef, {
            list: arrayUnion(newVehicle)
        });
        return true;
    } catch (error) {
        console.error("Error agregando vehículo:", error);
        alert("Error al guardar. Revisa tu conexión.");
        return false;
    }
  };

  const deleteVehicle = async (vehicle) => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'config', 'vehicles');
    try {
        await updateDoc(configRef, {
            list: arrayRemove(vehicle)
        });
    } catch (error) {
        console.error("Error borrando vehículo:", error);
    }
  };

  return { vehicles, loading, addVehicle, deleteVehicle };
};
