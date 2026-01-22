import { App } from '@capacitor/app'; 
import { useState, useRef, useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { calculateDistance } from '../utils/math';

// --- CONFIGURACIÓN DE PRODUCCIÓN ---
const DEBUG_MODE = false; // 🔴 Cambia a FALSE para producción (oculta logs)
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
  
  // 🆕 ESTADOS PARA GEOCODIFICACIÓN
  const [startAddress, setStartAddress] = useState(null);
  const [endAddress, setEndAddress] = useState(null);
  const [geocodingError, setGeocodingError] = useState(null);
  
  // --- REFS (Memoria síncrona para el Watcher) ---
  const watcherId = useRef(null);
  const lastCoords = useRef(null);
  const pathRef = useRef([]);
  const milesRef = useRef(0);
  
  // REF CRÍTICO: Mantiene el tipo actualizado dentro del watcher sin reiniciar
  const typeRef = useRef('trabajo'); 
  
  // REF DE RENDIMIENTO: Acumulador para no escribir en disco a cada paso
  const unsavedMilesRef = useRef(0);

  // 🆕 REF para rastrear si ya geocodificamos el inicio
  const hasGeocodedStart = useRef(false);

  // Configuración de filtros GPS
  const MAX_PATH_POINTS = 500;
  const MIN_MOVEMENT = 0.0031; // ~5 metros (filtro de ruido)
  const MAX_JUMP = 0.5; 
  const MAX_ACCURACY = 50;

  // 🆕 FUNCIÓN: Geocodificación Inversa con Google Maps API
  // 🆕 FUNCIÓN MEJORADA: Filtra Plus Codes y busca direcciones reales
const getAddressFromCoords = async (lat, lon) => {
  try {
    const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!API_KEY) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${API_KEY}&language=es`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      
      // 1. Intentamos buscar la primera dirección que NO sea un Plus Code
      // Buscamos resultados que tengan tipos como 'street_address', 'route', o 'premise'
      const cleanResult = data.results.find(res => 
        !res.types.includes('plus_code') && 
        (res.types.includes('street_address') || 
         res.types.includes('route') || 
         res.types.includes('intersection') ||
         res.types.includes('point_of_interest'))
      );

      // 2. Si no encontramos una calle específica, buscamos un barrio o ciudad (más amigable)
      const neighborhoodResult = data.results.find(res => 
        res.types.includes('neighborhood') || 
        res.types.includes('locality')
      );

      // 3. Selección final: Dirección limpia > Barrio > Resultado original (si no hay de otra)
      const finalAddress = cleanResult?.formatted_address || 
                           neighborhoodResult?.formatted_address || 
                           data.results[0].formatted_address;

      const address = {
        formatted: finalAddress,
        lat,
        lon,
        timestamp: new Date().toISOString()
      };
      
      setGeocodingError(null);
      return address;
      
    } else {
      setGeocodingError(`Error Google: ${data.status}`);
      return null;
    }
  } catch (error) {
    setGeocodingError('Error de conexión');
    return null;
  }
};

  // Wrapper para cambiar el tipo y actualizar la referencia al mismo tiempo
  const changeType = (newType) => {
    setType(newType);
    typeRef.current = newType;
    // Si estamos rastreando, forzamos un guardado inmediato para asegurar el cambio
    if (isTracking) {
      saveToDisk(milesRef.current, pathRef.current);
    }
  };

  // --- 1. FUNCIÓN: Guardar en Disco (Optimizado) ---
  // NOTA: NO guardamos las direcciones aquí (solo en memoria)
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
      log("💾 Estado guardado en disco. Tipo:", typeRef.current);

    } catch (e) {
      console.error("Error guardando estado:", e);
    }
  };

  // --- 2. MOTOR DEL GPS ---
  const _startWatcher = async (initialMiles = 0, initialPath = [], initialType = 'trabajo') => {
    try {
      // Inicialización de Refs y Estados
      setMiles(initialMiles);
      milesRef.current = initialMiles;
      unsavedMilesRef.current = 0;
      
      setCurrentPath(initialPath);
      pathRef.current = initialPath;
      
      // Sincronizar Type y TypeRef
      setType(initialType);
      typeRef.current = initialType;
      
      // 🆕 Resetear flag de geocodificación de inicio
      hasGeocodedStart.current = false;
      
      if (initialPath.length > 0) {
        lastCoords.current = initialPath[initialPath.length - 1];
        setWasGPSUsed(true);
        // 🆕 Si estamos restaurando un viaje, marcamos que ya geocodificamos
        hasGeocodedStart.current = true;
      }

      // Verificación de Permisos
      const status = await BackgroundGeolocation.checkPermissions();
      if (status.location !== 'granted') {
          const request = await BackgroundGeolocation.requestPermissions();
          if (request.location !== 'granted') {
              throw new Error("Se requiere permiso de ubicación.");
          }
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
            console.error('GPS Error:', error);
            if (error.code === 'NOT_AUTHORIZED') setGpsQuality('poor');
            return;
          }

          const lat = location.latitude;
          const lon = location.longitude;
          const accuracy = location.accuracy || 20;

          // Indicador de Calidad
          if (accuracy > 30) setGpsQuality('poor');
          else if (accuracy > 15) setGpsQuality('medium');
          else setGpsQuality('good');

          if (accuracy > MAX_ACCURACY) return;

          const point = { lat, lon, accuracy };

          // Lógica de Distancia
          if (lastCoords.current) {
            const d = calculateDistance(
              lastCoords.current.lat,
              lastCoords.current.lon,
              lat,
              lon
            );

            if (d > MAX_JUMP) {
                log('Salto ignorado:', d);
                return; 
            }

            if (d >= MIN_MOVEMENT) {
              const newMiles = milesRef.current + d;
              milesRef.current = newMiles;
              unsavedMilesRef.current += d;

              setMiles(newMiles);
              setWasGPSUsed(true);
              
              lastCoords.current = point;
              pathRef.current.push(point);
              
              if (pathRef.current.length > MAX_PATH_POINTS) {
                pathRef.current = pathRef.current.slice(-MAX_PATH_POINTS);
              }
              
              setCurrentPath([...pathRef.current]);

              // LÓGICA DE GUARDADO INTELIGENTE
              if (unsavedMilesRef.current >= SAVE_THRESHOLD) {
                  saveToDisk(newMiles, [...pathRef.current]);
              } else {
                  log(`Acumulando: ${unsavedMilesRef.current.toFixed(4)} / ${SAVE_THRESHOLD}`);
              }
            }
          } else {
            // 🆕 PRIMER PUNTO: Guardar Y geocodificar origen
            lastCoords.current = point;
            pathRef.current.push(point);
            setCurrentPath([...pathRef.current]);
            saveToDisk(milesRef.current, [...pathRef.current]);
            
            // 🆕 Geocodificar dirección de inicio (solo una vez)
            if (!hasGeocodedStart.current && accuracy <= MAX_ACCURACY) {
              hasGeocodedStart.current = true;
              log('📍 Geocodificando punto de inicio...');
              
              getAddressFromCoords(lat, lon).then(address => {
                if (address) {
                  setStartAddress(address);
                  log('✅ Dirección de inicio guardada');
                } else {
                  log('⚠️ No se pudo obtener dirección de inicio');
                }
              }).catch(err => {
                console.error('Error geocodificando inicio:', err);
              });
            }
          }
        }
      );
      log('✅ GPS Iniciado/Restaurado ID:', watcherId.current);

    } catch (e) {
      console.error("Error iniciando GPS:", e);
      setIsTracking(false);
      alert("Error GPS: " + e.message);
    }
  };

  const startTrip = async () => {
    await Preferences.remove({ key: TRIP_STORAGE_KEY });
    setWasGPSUsed(false);
    lastCoords.current = null;
    
    // 🆕 Resetear direcciones al iniciar viaje nuevo
    setStartAddress(null);
    setEndAddress(null);
    setGeocodingError(null);
    hasGeocodedStart.current = false;
    
    await _startWatcher(0, [], typeRef.current);
  };

  const stopTrip = async () => {
    // 🆕 Geocodificar dirección final ANTES de detener el watcher
    let finalEndAddress = endAddress;
    
    if (lastCoords.current && !finalEndAddress) {
      log('📍 Geocodificando punto final...');
      
      try {
        finalEndAddress = await getAddressFromCoords(
          lastCoords.current.lat,
          lastCoords.current.lon
        );
        
        if (finalEndAddress) {
          setEndAddress(finalEndAddress);
          log('✅ Dirección final obtenida');
        } else {
          log('⚠️ No se pudo obtener dirección final');
        }
      } catch (err) {
        console.error('Error geocodificando final:', err);
      }
    }

    // Detener watcher
    if (watcherId.current) {
        try {
            await BackgroundGeolocation.removeWatcher({ id: watcherId.current });
        } catch (e) {
            console.warn("Error deteniendo watcher", e);
        }
    }
    watcherId.current = null;
    setIsTracking(false);
    
    // 🆕 Retornar datos finales CON direcciones
    const finalData = { 
        miles: milesRef.current,
        path: pathRef.current,
        type: typeRef.current,
        startAddress: startAddress,      // 🆕 Dirección de origen
        endAddress: finalEndAddress      // 🆕 Dirección de destino
    };
    
    // Limpieza final
    await Preferences.remove({ key: TRIP_STORAGE_KEY });
    unsavedMilesRef.current = 0;
    
    return finalData;
  };

  const resetTrip = async () => {
    setMiles(0);
    milesRef.current = 0;
    unsavedMilesRef.current = 0;
    pathRef.current = [];
    setCurrentPath([]);
    lastCoords.current = null;
    setWasGPSUsed(false);
    
    // 🆕 Limpiar direcciones
    setStartAddress(null);
    setEndAddress(null);
    setGeocodingError(null);
    hasGeocodedStart.current = false;
    
    await Preferences.remove({ key: TRIP_STORAGE_KEY });
  };

  useEffect(() => {
    const checkSavedState = async () => {
      try {
        const { value } = await Preferences.get({ key: TRIP_STORAGE_KEY });
        if (value) {
          const savedState = JSON.parse(value);
          if (savedState.isTracking) {
            log("🔄 Restaurando viaje previo...");
            await _startWatcher(savedState.miles, savedState.path, savedState.type);
          }
        }
      } catch (e) {
        console.error("Error recuperando estado:", e);
      }
    };

    checkSavedState();

    return () => {
      if (watcherId.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherId.current });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 6. EFECTO: Refrescar pantalla al volver de segundo plano ---
  useEffect(() => {
    const subscription = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && isTracking) {
        log("📱 App volvió a primer plano. Actualizando UI.");
        setMiles(milesRef.current); 
        setCurrentPath([...pathRef.current]);
      }
    });

    return () => {
      subscription.then(sub => sub.remove());
    };
  }, [isTracking]);

  // 🆕 Retorno actualizado con las nuevas propiedades
  return { 
      isTracking, 
      miles, 
      type, 
      setType: changeType,
      currentPath, 
      gpsQuality, 
      wasGPSUsed,
      startAddress,        // 🆕 Dirección de origen
      endAddress,          // 🆕 Dirección de destino
      geocodingError,      // 🆕 Error de geocodificación (si existe)
      startTrip, 
      stopTrip, 
      resetTrip 
  };
};