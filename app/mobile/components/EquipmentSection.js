// mobile/components/EquipmentSection.js
'use client';

import { useState, useEffect } from 'react';
import { 
  loadEquipment, 
  addEquipment, 
  updateEquipment, 
  deleteEquipment 
} from '../utils/workOrderHelpers';
import { formatCurrency } from '../utils/calculations';

export default function EquipmentSection({ workOrder, supabase, saving, setSaving }) {
  const [equipment, setEquipment] = useState([]);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [newEquipment, setNewEquipment] = useState({
    description: '',
    rental_company: '',
    cost: 0,
    markup_percentage: 15
  });

  useEffect(() => {
    if (workOrder?.wo_id) {
      fetchEquipment();
    }
  }, [workOrder?.wo_id]);

  const fetchEquipment = async () => {
    const result = await loadEquipment(supabase, workOrder.wo_id);
    if (result.success) {
      setEquipment(result.data);
    }
  };

  const handleAddEquipment = async () => {
    if (!newEquipment.description || !newEquipment.cost) {
      alert('Please fill in equipment description and cost');
      return;
    }

    setSaving(true);
    const result = await addEquipment(supabase, {
      wo_id: workOrder.wo_id,
      description: newEquipment.description,
      rental_company: newEquipment.rental_company,
      cost: parseFloat(newEquipment.cost),
      markup_percentage: parseFloat(newEquipment.markup_percentage)
    });

    if (result.success) {
      await fetchEquipment();
      setNewEquipment({
        description: '',
        rental_company: '',
        cost: 0,
        markup_percentage: 15
      });
      setShowAddEquipment(false);
    } else {
      alert('Error adding equipment: ' + result.error);
    }
    setSaving(false);
  };

  const handleUpdateEquipment = async (equipmentId, updates) => {
    setSaving(true);
    const result = await updateEquipment(supabase, equipmentId, updates);
    if (result.success) {
      await fetchEquipment();
      setEditingEquipment(null);
    } else {
      alert('Error updating equipment: ' + result.error);
    }
    setSaving(false);
  };

  const handleDeleteEquipment = async (equipmentId) => {
    if (!confirm('Delete this equipment?')) return;
    
    setSaving(true);
    const result = await deleteEquipment(supabase, equipmentId);
    if (result.success) {
      await fetchEquipment();
    } else {
      alert('Error deleting equipment: ' + result.error);
    }
    setSaving(false);
  };

  const calculateEquipmentCost = (item) => {
    const baseCost = item.cost;
    const markup = baseCost * (item.markup_percentage / 100);
    return baseCost + markup;
  };

  const totalEquipmentCost = equipment.reduce((sum, e) => sum + calculateEquipmentCost(e), 0);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">🔧 Equipment / Rentals</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-green-500 font-semibold">
            Total: {formatCurrency(totalEquipmentCost)}
          </span>
          <button
            onClick={() => setShowAddEquipment(!showAddEquipment)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            disabled={saving}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Add Equipment Form */}
      {showAddEquipment && (
        <div className="bg-gray-700 rounded-lg p-3 mb-3 space-y-2">
          <input
            type="text"
            placeholder="Equipment Description"
            value={newEquipment.description}
            onChange={(e) => setNewEquipment({...newEquipment, description: e.target.value})}
            className="w-full px-3 py-2 bg-gray-600 rounded text-sm"
            disabled={saving}
          />
          <input
            type="text"
            placeholder="Rental Company (optional)"
            value={newEquipment.rental_company}
            onChange={(e) => setNewEquipment({...newEquipment, rental_company: e.target.value})}
            className="w-full px-3 py-2 bg-gray-600 rounded text-sm"
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Cost"
              value={newEquipment.cost}
              onChange={(e) => setNewEquipment({...newEquipment, cost: e.target.value})}
              className="px-3 py-2 bg-gray-600 rounded text-sm"
              disabled={saving}
            />
            <input
              type="number"
              placeholder="Markup %"
              value={newEquipment.markup_percentage}
              onChange={(e) => setNewEquipment({...newEquipment, markup_percentage: e.target.value})}
              className="px-3 py-2 bg-gray-600 rounded text-sm"
              disabled={saving}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddEquipment(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded text-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleAddEquipment}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded text-sm font-semibold"
              disabled={saving}
            >
              Add Equipment
            </button>
          </div>
        </div>
      )}

      {/* Equipment List */}
      <div className="space-y-2">
        {equipment.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No equipment added yet</p>
        ) : (
          equipment.map((item) => (
            <div key={item.equipment_id} className="bg-gray-700 rounded p-3">
              {editingEquipment === item.equipment_id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => {
                      const updated = equipment.map(eq => 
                        eq.equipment_id === item.equipment_id 
                          ? {...eq, description: e.target.value}
                          : eq
                      );
                      setEquipment(updated);
                    }}
                    className="w-full px-2 py-1 bg-gray-600 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={item.rental_company || ''}
                    onChange={(e) => {
                      const updated = equipment.map(eq => 
                        eq.equipment_id === item.equipment_id 
                          ? {...eq, rental_company: e.target.value}
                          : eq
                      );
                      setEquipment(updated);
                    }}
                    placeholder="Rental Company"
                    className="w-full px-2 py-1 bg-gray-600 rounded text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.cost}
                      onChange={(e) => {
                        const updated = equipment.map(eq => 
                          eq.equipment_id === item.equipment_id 
                            ? {...eq, cost: parseFloat(e.target.value)}
                            : eq
                        );
                        setEquipment(updated);
                      }}
                      className="px-2 py-1 bg-gray-600 rounded text-sm"
                    />
                    <input
                      type="number"
                      value={item.markup_percentage}
                      onChange={(e) => {
                        const updated = equipment.map(eq => 
                          eq.equipment_id === item.equipment_id 
                            ? {...eq, markup_percentage: parseFloat(e.target.value)}
                            : eq
                        );
                        setEquipment(updated);
                      }}
                      className="px-2 py-1 bg-gray-600 rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingEquipment(null)}
                      className="flex-1 bg-gray-600 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateEquipment(item.equipment_id, item)}
                      className="flex-1 bg-blue-600 py-1 rounded text-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="font-semibold text-sm">{item.description}</span>
                      {item.rental_company && (
                        <div className="text-xs text-gray-400">{item.rental_company}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingEquipment(item.equipment_id)}
                        className="text-blue-400 text-xs px-2 py-1"
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEquipment(item.equipment_id)}
                        className="text-red-400 text-xs px-2 py-1"
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Cost: {formatCurrency(item.cost)}
                    <span className="text-yellow-500 ml-1">(+{item.markup_percentage}%)</span>
                  </div>
                  <div className="text-sm text-green-500 font-semibold mt-1">
                    Total: {formatCurrency(calculateEquipmentCost(item))}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}