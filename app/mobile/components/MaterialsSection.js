// mobile/components/MaterialsSection.js
'use client';

import { useState, useEffect } from 'react';
import { 
  loadMaterials, 
  addMaterial, 
  updateMaterial, 
  deleteMaterial 
} from '../utils/workOrderHelpers';
import { formatCurrency } from '../utils/calculations';

export default function MaterialsSection({ workOrder, supabase, saving, setSaving }) {
  const [materials, setMaterials] = useState([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [newMaterial, setNewMaterial] = useState({
    description: '',
    quantity: 1,
    unit: 'ea',
    unit_cost: 0,
    markup_percentage: 25
  });

  useEffect(() => {
    if (workOrder?.wo_id) {
      fetchMaterials();
    }
  }, [workOrder?.wo_id]);

  const fetchMaterials = async () => {
    const result = await loadMaterials(supabase, workOrder.wo_id);
    if (result.success) {
      setMaterials(result.data);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.description || !newMaterial.quantity || !newMaterial.unit_cost) {
      alert('Please fill in all material fields');
      return;
    }

    setSaving(true);
    const result = await addMaterial(supabase, {
      wo_id: workOrder.wo_id,
      description: newMaterial.description,
      quantity: parseFloat(newMaterial.quantity),
      unit: newMaterial.unit,
      unit_cost: parseFloat(newMaterial.unit_cost),
      markup_percentage: parseFloat(newMaterial.markup_percentage)
    });

    if (result.success) {
      await fetchMaterials();
      setNewMaterial({
        description: '',
        quantity: 1,
        unit: 'ea',
        unit_cost: 0,
        markup_percentage: 25
      });
      setShowAddMaterial(false);
    } else {
      alert('Error adding material: ' + result.error);
    }
    setSaving(false);
  };

  const handleUpdateMaterial = async (materialId, updates) => {
    setSaving(true);
    const result = await updateMaterial(supabase, materialId, updates);
    if (result.success) {
      await fetchMaterials();
      setEditingMaterial(null);
    } else {
      alert('Error updating material: ' + result.error);
    }
    setSaving(false);
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!confirm('Delete this material?')) return;
    
    setSaving(true);
    const result = await deleteMaterial(supabase, materialId);
    if (result.success) {
      await fetchMaterials();
    } else {
      alert('Error deleting material: ' + result.error);
    }
    setSaving(false);
  };

  const calculateMaterialCost = (material) => {
    const baseCost = material.quantity * material.unit_cost;
    const markup = baseCost * (material.markup_percentage / 100);
    return baseCost + markup;
  };

  const totalMaterialsCost = materials.reduce((sum, m) => sum + calculateMaterialCost(m), 0);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">📦 Materials</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-green-500 font-semibold">
            Total: {formatCurrency(totalMaterialsCost)}
          </span>
          <button
            onClick={() => setShowAddMaterial(!showAddMaterial)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            disabled={saving}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Add Material Form */}
      {showAddMaterial && (
        <div className="bg-gray-700 rounded-lg p-3 mb-3 space-y-2">
          <input
            type="text"
            placeholder="Description"
            value={newMaterial.description}
            onChange={(e) => setNewMaterial({...newMaterial, description: e.target.value})}
            className="w-full px-3 py-2 bg-gray-600 rounded text-sm"
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Quantity"
              value={newMaterial.quantity}
              onChange={(e) => setNewMaterial({...newMaterial, quantity: e.target.value})}
              className="px-3 py-2 bg-gray-600 rounded text-sm"
              disabled={saving}
            />
            <input
              type="text"
              placeholder="Unit"
              value={newMaterial.unit}
              onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})}
              className="px-3 py-2 bg-gray-600 rounded text-sm"
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Unit Cost"
              value={newMaterial.unit_cost}
              onChange={(e) => setNewMaterial({...newMaterial, unit_cost: e.target.value})}
              className="px-3 py-2 bg-gray-600 rounded text-sm"
              disabled={saving}
            />
            <input
              type="number"
              placeholder="Markup %"
              value={newMaterial.markup_percentage}
              onChange={(e) => setNewMaterial({...newMaterial, markup_percentage: e.target.value})}
              className="px-3 py-2 bg-gray-600 rounded text-sm"
              disabled={saving}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddMaterial(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded text-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleAddMaterial}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded text-sm font-semibold"
              disabled={saving}
            >
              Add Material
            </button>
          </div>
        </div>
      )}

      {/* Materials List */}
      <div className="space-y-2">
        {materials.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No materials added yet</p>
        ) : (
          materials.map((material) => (
            <div key={material.material_id} className="bg-gray-700 rounded p-3">
              {editingMaterial === material.material_id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={material.description}
                    onChange={(e) => {
                      const updated = materials.map(m => 
                        m.material_id === material.material_id 
                          ? {...m, description: e.target.value}
                          : m
                      );
                      setMaterials(updated);
                    }}
                    className="w-full px-2 py-1 bg-gray-600 rounded text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={material.quantity}
                      onChange={(e) => {
                        const updated = materials.map(m => 
                          m.material_id === material.material_id 
                            ? {...m, quantity: parseFloat(e.target.value)}
                            : m
                        );
                        setMaterials(updated);
                      }}
                      className="px-2 py-1 bg-gray-600 rounded text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={material.unit_cost}
                      onChange={(e) => {
                        const updated = materials.map(m => 
                          m.material_id === material.material_id 
                            ? {...m, unit_cost: parseFloat(e.target.value)}
                            : m
                        );
                        setMaterials(updated);
                      }}
                      className="px-2 py-1 bg-gray-600 rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingMaterial(null)}
                      className="flex-1 bg-gray-600 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateMaterial(material.material_id, material)}
                      className="flex-1 bg-blue-600 py-1 rounded text-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm">{material.description}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingMaterial(material.material_id)}
                        className="text-blue-400 text-xs px-2 py-1"
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(material.material_id)}
                        className="text-red-400 text-xs px-2 py-1"
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {material.quantity} {material.unit} × {formatCurrency(material.unit_cost)} 
                    <span className="text-yellow-500 ml-1">(+{material.markup_percentage}%)</span>
                  </div>
                  <div className="text-sm text-green-500 font-semibold mt-1">
                    Total: {formatCurrency(calculateMaterialCost(material))}
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