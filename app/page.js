'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setWorkOrders(data || []);
    }
    setLoading(false);
  };

  const calculateTotalCost = (wo) => {
    const labor = ((wo.hours_regular || 0) * 64) + ((wo.hours_overtime || 0) * 96);
    const materials = wo.material_cost || 0;
    const equipment = wo.emf_equipment_cost || 0;
    const trailer = wo.trailer_cost || 0;
    const rental = wo.rental_cost || 0;
    const mileage = (wo.miles || 0) * 1.00;
    return labor + materials + equipment + trailer + rental + mileage;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔧 Work Orders - Test Version</h1>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {workOrders.length === 0 ? (
            <div className="p-8 text-center">No work orders found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">WO#</th>
                  <th className="px-4 py-3 text-left">Building</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-center">VIEW BUTTON HERE →</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.wo_id} className="border-t border-gray-700">
                    <td className="px-4 py-3">{wo.wo_number}</td>
                    <td className="px-4 py-3">{wo.building}</td>
                    <td className="px-4 py-3">{wo.work_order_description?.substring(0, 50)}...</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedWO(wo)}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-bold"
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.location.href = '/mobile'}
            className="bg-green-600 px-4 py-2 rounded"
          >
            📱 Mobile
          </button>
          <button
            onClick={() => window.location.href = '/users'}
            className="bg-blue-600 px-4 py-2 rounded"
          >
            👥 Users
          </button>
        </div>
      </div>

      {/* MODAL */}
      {selectedWO && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-bold">{selectedWO.wo_number}</h2>
              <button
                onClick={() => setSelectedWO(null)}
                className="text-4xl text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <strong>Building:</strong> {selectedWO.building}
              </div>
              <div>
                <strong>Description:</strong> {selectedWO.work_order_description}
              </div>

              {/* COST SUMMARY */}
              <div className="bg-gray-700 rounded-lg p-6 mt-6">
                <h3 className="text-2xl font-bold mb-4">💰 Cost Summary</h3>
                
                <div className="space-y-2 text-lg">
                  <div className="flex justify-between">
                    <span>Materials:</span>
                    <span className="font-bold">${(selectedWO.material_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Equipment:</span>
                    <span className="font-bold">${(selectedWO.emf_equipment_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trailer:</span>
                    <span className="font-bold">${(selectedWO.trailer_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rental:</span>
                    <span className="font-bold">${(selectedWO.rental_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Regular Hours ({selectedWO.hours_regular || 0} hrs @ $64):</span>
                    <span className="font-bold">${((selectedWO.hours_regular || 0) * 64).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime ({selectedWO.hours_overtime || 0} hrs @ $96):</span>
                    <span className="font-bold">${((selectedWO.hours_overtime || 0) * 96).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mileage ({selectedWO.miles || 0} mi @ $1.00):</span>
                    <span className="font-bold">${((selectedWO.miles || 0) * 1.00).toFixed(2)}</span>
                  </div>
                  
                  <div className="border-t-2 border-gray-500 pt-4 mt-4">
                    <div className="flex justify-between text-2xl">
                      <span className="font-bold">TOTAL COST:</span>
                      <span className="font-bold text-green-400">
                        ${calculateTotalCost(selectedWO).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {selectedWO.nte && (
                    <div className="flex justify-between text-lg mt-2">
                      <span>NTE Budget:</span>
                      <span className="font-bold">${(selectedWO.nte || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedWO(null)}
                className="w-full bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-bold text-lg mt-6"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}