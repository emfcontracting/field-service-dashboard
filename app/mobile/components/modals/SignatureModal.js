// components/modals/SignatureModal.js - With Location Capture
import { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function SignatureModal({ show, onClose, onSave, saving }) {
  const { language } = useLanguage();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  useEffect(() => {
    if (show && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      // Set drawing style
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Get location when modal opens
      getLocation();
    }
  }, [show]);

  function getLocation() {
    if (!navigator.geolocation) {
      setLocationError(language === 'en' ? 'Geolocation not supported' : 'Geolocalización no soportada');
      return;
    }

    setLoadingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLoadingLocation(false);
      },
      (error) => {
        console.error('Location error:', error);
        setLocationError(
          language === 'en' 
            ? 'Could not get location. Signature will proceed without it.' 
            : 'No se pudo obtener la ubicación. La firma continuará sin ella.'
        );
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  function startDrawing(e) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  }

  function draw(e) {
    if (!isDrawing) return;
    
    e.preventDefault(); // Prevent scrolling on touch devices
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function handleSave() {
    if (!hasSignature) {
      alert(language === 'en' ? 'Please provide a signature' : 'Por favor proporcione una firma');
      return;
    }
    
    if (!customerName.trim()) {
      alert(language === 'en' ? 'Please enter customer name' : 'Por favor ingrese el nombre del cliente');
      return;
    }
    
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    
    onSave({
      signature: signatureData,
      customerName: customerName.trim(),
      signedAt: new Date().toISOString(),
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      } : null
    });
    
    // Reset
    setCustomerName('');
    setLocation(null);
    clearSignature();
  }

  function handleClose() {
    setCustomerName('');
    setLocation(null);
    setLocationError(null);
    clearSignature();
    onClose();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {language === 'en' ? 'Customer Signature' : 'Firma del Cliente'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Customer Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            {language === 'en' ? 'Customer Name' : 'Nombre del Cliente'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={language === 'en' ? 'Enter customer name' : 'Ingrese nombre del cliente'}
            className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>

        {/* Location Status */}
        <div className="mb-4 bg-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">📍 {language === 'en' ? 'Location:' : 'Ubicación:'}</span>
            {loadingLocation ? (
              <span className="text-yellow-400 text-sm">{language === 'en' ? 'Getting location...' : 'Obteniendo ubicación...'}</span>
            ) : location ? (
              <span className="text-green-400 text-sm">
                ✓ {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </span>
            ) : locationError ? (
              <span className="text-orange-400 text-sm">{locationError}</span>
            ) : (
              <button
                onClick={getLocation}
                className="text-blue-400 text-sm hover:underline"
              >
                {language === 'en' ? 'Get Location' : 'Obtener Ubicación'}
              </button>
            )}
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            {language === 'en' ? 'Signature' : 'Firma'} <span className="text-red-500">*</span>
          </label>
          <div className="bg-white rounded-lg p-2">
            <canvas
              ref={canvasRef}
              className="w-full h-64 touch-none border-2 border-gray-300 rounded cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {language === 'en' ? 'Sign above using your finger or stylus' : 'Firme arriba usando su dedo o lápiz'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={clearSignature}
            disabled={saving || !hasSignature}
            className="bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold disabled:bg-gray-800 disabled:text-gray-600"
          >
            {language === 'en' ? 'Clear Signature' : 'Borrar Firma'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasSignature || !customerName.trim()}
            className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold disabled:bg-gray-600"
          >
            {saving 
              ? (language === 'en' ? 'Saving...' : 'Guardando...') 
              : (language === 'en' ? '✓ Save Signature' : '✓ Guardar Firma')}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-4 bg-blue-900 rounded-lg p-3 text-sm text-blue-200">
          <p className="font-semibold mb-1">ℹ️ {language === 'en' ? 'Signature Information:' : 'Información de la Firma:'}</p>
          <ul className="text-xs space-y-1 ml-4">
            <li>• {language === 'en' ? 'Customer signature confirms work completion' : 'La firma del cliente confirma la finalización del trabajo'}</li>
            <li>• {language === 'en' ? 'Date, time, and location will be recorded' : 'Se registrarán fecha, hora y ubicación'}</li>
            <li>• {language === 'en' ? 'This will be saved with the work order' : 'Esto se guardará con la orden de trabajo'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
