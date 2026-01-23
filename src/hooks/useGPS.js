import { App } from '@capacitor/app'; 
import { useState, useRef, useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { calculateDistance } from '../utils/math';

// --- CONFIGURACIÓN DE PRODUCCIÓN ---
const DEBUG_MODE = false; 
const SAVE_THRESHOLD = 0.03; // ~50 metros. Solo guarda en disco si se avanza esto.

// Utilería de log condicional
const log = (...args) => {
  if (DEBUG_MODE) console.log(...args);
};

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
const TRIP_STORAGE_KEY = 'current_trip_state_v1';

export const useGPS = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [miles, setMiles] = useState(0);
  const [currentPath, setCurrentPath] = useState([]);
  const [type, setType] = useState('trabajo');
  const [gpsQuality, setGpsQuality] = useState('good');
  const [wasGPSUsed, setWasGPSUsed] = useState(false);
  
  // ESTADOS PARA GEOCODIFICACIÓN
  const [startAddress, setStartAddress] = useState(null);
  const [endAddress, setEndAddress] = useState(null);
  const [geocodingError, setGeocodingError] = useState(null);

  // LUGARES GUARDADOS (Cerebro de la bitácora)
  const [savedPlaces, setSavedPlaces] = useState([]);

  // Cargar lugares guardados al iniciar
  useEffect(() => {
    Preferences.get({ key: 'SAVED_PLACES_V1' }).then(({ value }) => {
      if (value) setSavedPlaces(JSON.parse(value));
    });
  }, []);

  // --- REFS (Memoria síncrona para el Watcher) ---
  const watcherId = useRef(null);
  const lastCoords = useRef(null);
  const pathRef = useRef([]);
  const milesRef = useRef(0);
  const typeRef = useRef('trabajo'); 
  const unsavedMilesRef = useRef(0);
  const hasGeocodedStart = useRef(false);

  // Configuración de filtros GPS
  const MAX_PATH_POINTS = 500;
  const MIN_MOVEMENT = 0.0031; // ~5 metros (filtro de ruido)
  const MAX_JUMP = 0.5; 
  const MAX_ACCURACY = 50;

  // 🆕 FUNCIÓN PARA GUARDAR NUEVOS LUGARES (Aprender)
  const savePlace = async (lat, lon, name) => {
    if (!name || name.trim() === "") return;
    
    try {
      const { value } = await Preferences.get({ key: 'SAVED_PLACES_V1' });
      const currentSaved = value ? JSON.parse(value) : [];
      
      // Evitar duplicados exactos en el mismo radio pequeño
      const isDuplicate = currentSaved.some(p => 
        calculateDistance(p.lat, p.lon, lat, lon) < 0.02 && p.name === name.trim()
      );

      if (isDuplicate) return;

      const updatedPlaces = [...currentSaved, { lat, lon, name: name.trim() }];
      setSavedPlaces(updatedPlaces);
      await Preferences.set({
        key: 'SAVED_PLACES_V1',
        value: JSON.stringify(updatedPlaces)
      });
      log("📍 Nuevo lugar aprendido:", name);
    } catch (e) {
      console.error("Error al aprender lugar:", e);
    }
  };

  const identifySavedPlace = (lat, lon, originalAddress) => {
    const nearbyPlace = savedPlaces.find(place => {
      const d = calculateDistance(place.lat, place.lon, lat, lon);
      return d <= 0.05; // 50 metros de radio
    });
    return nearbyPlace ? nearbyPlace.name : originalAddress;
  };

  // Geocodificación Inversa: Filtra Plus Codes y busca direcciones reales
  const getAddressFromCoords = async (lat, lon) => {
    try {
      const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!API_KEY) return null;

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${API_KEY}&language=es`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        // Priorizar direcciones de calle o establecimientos (evitar plus_code)
        const cleanResult = data.results.find(res => 
          !res.types.includes('plus_code') && 
          (res.types.includes('street_address') || 
           res.types.includes('route') || 
           res.types.includes('establishment'))
        );

        const neighborhoodResult = data.results.find(res => 
          res.types.includes('neighborhood') || 
          res.types.includes('locality')
        );

        const finalAddressText = cleanResult?.formatted_address || 
                                 neighborhoodResult?.formatted_address || 
                                 data.results[0].formatted_address;

        // Verificar si el lugar ya está en el diccionario de la bitácora
        const personalizedName = identifySavedPlace(lat, lon, finalAddressText);

        setGeocodingError(null);
        return {
          formatted: personalizedName,
          lat,
          lon,
          timestamp: new Date().toISOString()
        };
      } else {
        setGeocodingError(`Error Google: ${data.status}`);
        return null;
      }
    } catch (error) {
      setGeocodingError('Error de conexión');
      return null;
    }
  };

  const changeType = (newType) => {
    setType(newType);
    typeRef.current = newType;
    if (isTracking) {
      saveToDisk(milesRef.current, pathRef.current);
    }
  };

  const saveToDisk = async (currentMiles, currentPathData) => {
    try {
      const stateToSave = {
        isTracking: true,
        miles: currentMiles,
        path: currentPathData,
        lastCoords: lastCoords.current,
        type: typeRef.current, 
        timestamp: new Date().toISOString()
      };
      
      await Preferences.set({
        key: TRIP_STORAGE_KEY,
        value: JSON.stringify(stateToSave),
      });
      
      unsavedMilesRef.current = 0;
      log("💾 Estado guardado en disco.");
    } catch (e) {
      console.error("Error guardando estado:", e);
    }
  };

  const _startWatcher = async (initialMiles = 0, initialPath = [], initialType = 'trabajo') => {
    try {
      setMiles(initialMiles);
      milesRef.current = initialMiles;
      unsavedMilesRef.current = 0;
      setCurrentPath(initialPath);
      pathRef.current = initialPath;
      setType(initialType);
      typeRef.current = initialType;
      hasGeocodedStart.current = false;
      
      if (initialPath.length > 0) {
        lastCoords.current = initialPath[initialPath.length - 1];
        setWasGPSUsed(true);
        hasGeocodedStart.current = true;
      }

      const status = await BackgroundGeolocation.checkPermissions();
      if (status.location !== 'granted') {
        const request = await BackgroundGeolocation.requestPermissions();
        if (request.location !== 'granted') throw new Error("Permiso denegado");
      }

      setIsTracking(true);

      if (watcherId.current) {
        await BackgroundGeolocation.removeWatcher({ id: watcherId.current });
      }

      watcherId.current = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Registrando ruta en segundo plano",
          backgroundTitle: "GPS Activo",
          requestPermissions: true,
          stale: false,
          distanceFilter: 5
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') setGpsQuality('poor');
            return;
          }

          const { latitude: lat, longitude: lon, accuracy = 20 } = location;

          if (accuracy > 30) setGpsQuality('poor');
          else if (accuracy > 15) setGpsQuality('medium');
          else setGpsQuality('good');

          if (accuracy > MAX_ACCURACY) return;

          const point = { lat, lon, accuracy };

          if (lastCoords.current) {
            const d = calculateDistance(lastCoords.current.lat, lastCoords.current.lon, lat, lon);

            if (d > MAX_JUMP) return;

            if (d >= MIN_MOVEMENT) {
              const newMiles = milesRef.current + d;
              milesRef.current = newMiles;
              unsavedMilesRef.current += d;

              setMiles(newMiles);
              setWasGPSUsed(true);
              lastCoords.current = point;
              pathRef.current.push(point);
              setCurrentPath([...pathRef.current]);

              if (unsavedMilesRef.current >= SAVE_THRESHOLD) {
                saveToDisk(newMiles, [...pathRef.current]);
              }
            }
          } else {
            lastCoords.current = point;
            pathRef.current.push(point);
            setCurrentPath([...pathRef.current]);
            saveToDisk(milesRef.current, [...pathRef.current]);
            
            if (!hasGeocodedStart.current && accuracy <= MAX_ACCURACY) {
              hasGeocodedStart.current = true;
              getAddressFromCoords(lat, lon).then(addr => addr && setStartAddress(addr));
            }
          }
        }
      );
    } catch (e) {
      console.error(e);
      setIsTracking(false);
    }
  };

  const startTrip = async () => {
    await Preferences.remove({ key: TRIP_STORAGE_KEY });
    setWasGPSUsed(false);
    lastCoords.current = null;
    setStartAddress(null);
    setEndAddress(null);
    setGeocodingError(null);
    hasGeocodedStart.current = false;
    await _startWatcher(0, [], typeRef.current);
  };

  const stopTrip = async () => {
    let finalEndAddress = endAddress;
    
    if (lastCoords.current && !finalEndAddress) {
      finalEndAddress = await getAddressFromCoords(lastCoords.current.lat, lastCoords.current.lon);
      if (finalEndAddress) setEndAddress(finalEndAddress);
    }

    if (watcherId.current) {
      await BackgroundGeolocation.removeWatcher({ id: watcherId.current });
    }
    watcherId.current = null;
    setIsTracking(false);
    
    const finalData = { 
        miles: milesRef.current,
        path: pathRef.current,
        type: typeRef.current,
        startAddress: startAddress,
        endAddress: finalEndAddress
    };
    
    await Preferences.remove({ key: TRIP_STORAGE_KEY });
    return finalData;
  };

  const resetTrip = async () => {
    setMiles(0); milesRef.current = 0; pathRef.current = [];
    setCurrentPath([]); lastCoords.current = null; setWasGPSUsed(false);
    setStartAddress(null); setEndAddress(null); setGeocodingError(null);
    hasGeocodedStart.current = false;
    await Preferences.remove({ key: TRIP_STORAGE_KEY });
  };

  useEffect(() => {
    const checkSavedState = async () => {
      const { value } = await Preferences.get({ key: TRIP_STORAGE_KEY });
      if (value) {
        const saved = JSON.parse(value);
        if (saved.isTracking) await _startWatcher(saved.miles, saved.path, saved.type);
      }
    };
    checkSavedState();
    return () => {
      if (watcherId.current) BackgroundGeolocation.removeWatcher({ id: watcherId.current });
    };
  }, []);

  useEffect(() => {
    const subscription = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && isTracking) {
        setMiles(milesRef.current); 
        setCurrentPath([...pathRef.current]);
      }
    });
    return () => { subscription.then(sub => sub.remove()); };
  }, [isTracking]);

  return { 
      isTracking, miles, type, setType: changeType,
      currentPath, gpsQuality, wasGPSUsed,
      startAddress, endAddress, geocodingError,
      savePlace, startTrip, stopTrip, resetTrip 
  };
};