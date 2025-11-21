// components/CreateUserForm.js
'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CreateUserForm({ onUserCreated }) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'tech',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClientComponentClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate email
      if (!formData.email || !formData.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      // Validate required fields
      if (!formData.firstName || !formData.lastName) {
        throw new Error('First name and last name are required');
      }

      // Create user with default PIN
      const { data, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email: formData.email.toLowerCase().trim(),
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            role: formData.role,
            phone: formData.phone.trim() || null,
            pin: '5678', // ⭐ Default PIN
            is_active: true,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('A user with this email already exists');
        }
        throw insertError;
      }

      setSuccess(`✅ User created successfully! Default PIN: 5678`);
      
      // Reset form
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'tech',
        phone: ''
      });

      // Notify parent component
      if (onUserCreated) {
        onUserCreated(data);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);

    } catch (err) {
      console.error('Error creating user:', err);
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Create New User</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="user@example.com"
            required
          />
        </div>

        {/* First Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="John"
            required
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Doe"
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone (Optional)
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role *
          </label>
          <select
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="tech">Tech</option>
            <option value="helper">Helper</option>
            <option value="lead_tech">Lead Tech</option>
            <option value="office">Office Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Default PIN Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Default PIN:</strong> All new users will be created with PIN <code className="bg-blue-100 px-2 py-1 rounded">5678</code>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Users can change their PIN after first login
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
        >
          {loading ? 'Creating User...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
