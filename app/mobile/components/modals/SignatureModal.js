// components/modals/SignatureModal.js
import { useRef, useState, useEffect } from 'react';

export default function SignatureModal({ show, onClose, onSave, saving }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);

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
    }
  }, [show]);

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
      alert('Please provide a signature');
      return;
    }
    
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    
    onSave({
      signature: signatureData,
      customerName: customerName.trim(),
      signedAt: new Date().toISOString()
    });
    
    // Reset
    setCustomerName('');
    clearSignature();
  }

  function handleClose() {
    setCustomerName('');
    clearSignature();
    onClose();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Customer Signature</h3>
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
            Customer Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter customer name"
            className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={saving}
          />
        </div>

        {/* Signature Canvas */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Signature <span className="text-red-500">*</span>
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
            Sign above using your finger or stylus
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={clearSignature}
            disabled={saving || !hasSignature}
            className="bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold disabled:bg-gray-800 disabled:text-gray-600"
          >
            Clear Signature
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasSignature || !customerName.trim()}
            className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold disabled:bg-gray-600"
          >
            {saving ? 'Saving...' : '✓ Save Signature'}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-4 bg-blue-900 rounded-lg p-3 text-sm text-blue-200">
          <p className="font-semibold mb-1">ℹ️ Signature Information:</p>
          <ul className="text-xs space-y-1 ml-4">
            <li>• Customer signature confirms work completion</li>
            <li>• This will be saved with the work order</li>
            <li>• Timestamp will be recorded automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
