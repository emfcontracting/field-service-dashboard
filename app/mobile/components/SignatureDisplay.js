// components/SignatureDisplay.js
import { formatDateTime } from '../utils/helpers';

export default function SignatureDisplay({ workOrder }) {
  const wo = workOrder || {};
  
  if (!wo.customer_signature) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3 text-green-400">✍️ Customer Signature</h3>
      
      <div className="bg-white rounded-lg p-4 mb-3">
        <img 
          src={wo.customer_signature} 
          alt="Customer Signature" 
          className="w-full h-auto"
        />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Signed By:</span>
          <span className="font-semibold">{wo.customer_name || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Signed On:</span>
          <span className="font-semibold">{formatDateTime(wo.signature_date)}</span>
        </div>
      </div>
      
      <div className="mt-3 bg-green-900 rounded-lg p-2 text-center">
        <p className="text-green-200 text-xs font-semibold">
          ✓ Work order signed by customer
        </p>
      </div>
    </div>
  );
}
