// hooks/useQuotes.js - NTE Increase/Quote Management Hook
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as quoteService from '../services/quoteService';

export function useQuotes(workOrder, currentUser) {
  const [quotes, setQuotes] = useState([]);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showQuotePage, setShowQuotePage] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const supabase = createClientComponentClient();

  // Load quotes when work order changes
  useEffect(() => {
    if (workOrder?.wo_id) {
      loadQuotesForWO();
    }
  }, [workOrder?.wo_id]);

  async function loadQuotesForWO() {
    if (!workOrder?.wo_id) return;
    
    try {
      setLoading(true);
      const data = await quoteService.loadQuotes(supabase, workOrder.wo_id);
      setQuotes(data);
    } catch (err) {
      console.error('Error loading quotes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadQuoteDetails(quoteId) {
    try {
      setLoading(true);
      const data = await quoteService.loadQuoteWithMaterials(supabase, quoteId);
      setSelectedQuote(data);
      setMaterials(data.materials || []);
      setEditMode(true);
      setShowQuotePage(true);
    } catch (err) {
      console.error('Error loading quote details:', err);
      alert('Error loading quote: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function startNewQuote() {
    setSelectedQuote({
      wo_id: workOrder.wo_id,
      is_verbal_nte: false,
      verbal_approved_by: '',
      estimated_techs: 1,
      estimated_rt_hours: 0,
      estimated_ot_hours: 0,
      material_cost: 0,
      equipment_cost: 0,
      rental_cost: 0,
      trailer_cost: 0,
      estimated_miles: 0,
      description: '',
      notes: ''
    });
    setMaterials([]);
    setEditMode(false);
    setShowQuotePage(true);
  }

  async function saveQuote(quoteData) {
    if (!currentUser?.user_id) {
      alert('You must be logged in to save a quote');
      return null;
    }

    try {
      setSaving(true);
      
      let savedQuote;
      
      if (editMode && selectedQuote?.quote_id) {
        // Update existing quote
        savedQuote = await quoteService.updateQuote(supabase, selectedQuote.quote_id, quoteData);
      } else {
        // Create new quote
        savedQuote = await quoteService.createQuote(supabase, {
          ...quoteData,
          wo_id: workOrder.wo_id
        }, currentUser.user_id);
      }

      // Reload quotes list
      await loadQuotesForWO();
      
      return savedQuote;
    } catch (err) {
      console.error('Error saving quote:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuote(quoteId) {
    if (!confirm('Are you sure you want to delete this NTE Increase?')) {
      return false;
    }

    try {
      setSaving(true);
      await quoteService.deleteQuote(supabase, quoteId);
      await loadQuotesForWO();
      return true;
    } catch (err) {
      console.error('Error deleting quote:', err);
      alert('Error deleting quote: ' + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Material management
  async function addMaterial(materialData) {
    if (!selectedQuote?.quote_id) {
      // If quote not saved yet, just add to local state
      const newMaterial = {
        material_id: `temp_${Date.now()}`,
        ...materialData,
        total_cost: (parseFloat(materialData.quantity) || 1) * (parseFloat(materialData.unit_cost) || 0)
      };
      setMaterials([...materials, newMaterial]);
      return newMaterial;
    }

    try {
      setSaving(true);
      const saved = await quoteService.addMaterial(supabase, selectedQuote.quote_id, materialData);
      setMaterials([...materials, saved]);
      
      // Recalculate quote totals
      await quoteService.recalculateMaterialTotal(supabase, selectedQuote.quote_id);
      
      return saved;
    } catch (err) {
      console.error('Error adding material:', err);
      alert('Error adding material: ' + err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function updateMaterial(materialId, materialData) {
    if (materialId.startsWith('temp_')) {
      // Update local state only
      setMaterials(materials.map(m => 
        m.material_id === materialId 
          ? { ...m, ...materialData, total_cost: (parseFloat(materialData.quantity) || 1) * (parseFloat(materialData.unit_cost) || 0) }
          : m
      ));
      return;
    }

    try {
      setSaving(true);
      const updated = await quoteService.updateMaterial(supabase, materialId, materialData);
      setMaterials(materials.map(m => m.material_id === materialId ? updated : m));
      
      // Recalculate quote totals
      if (selectedQuote?.quote_id) {
        await quoteService.recalculateMaterialTotal(supabase, selectedQuote.quote_id);
      }
    } catch (err) {
      console.error('Error updating material:', err);
      alert('Error updating material: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteMaterial(materialId) {
    if (materialId.startsWith('temp_')) {
      // Remove from local state only
      setMaterials(materials.filter(m => m.material_id !== materialId));
      return;
    }

    try {
      setSaving(true);
      await quoteService.deleteMaterial(supabase, materialId);
      setMaterials(materials.filter(m => m.material_id !== materialId));
      
      // Recalculate quote totals
      if (selectedQuote?.quote_id) {
        await quoteService.recalculateMaterialTotal(supabase, selectedQuote.quote_id);
      }
    } catch (err) {
      console.error('Error deleting material:', err);
      alert('Error deleting material: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function closeQuotePage() {
    setShowQuotePage(false);
    setSelectedQuote(null);
    setMaterials([]);
    setEditMode(false);
  }

  // Calculate totals for display
  function calculateTotals(quoteData) {
    return quoteService.calculateQuoteTotals(quoteData);
  }

  return {
    // State
    quotes,
    selectedQuote,
    materials,
    loading,
    saving,
    showQuotePage,
    editMode,
    
    // Actions
    loadQuotesForWO,
    loadQuoteDetails,
    startNewQuote,
    saveQuote,
    deleteQuote,
    closeQuotePage,
    
    // Materials
    addMaterial,
    updateMaterial,
    deleteMaterial,
    
    // Utils
    calculateTotals
  };
}
