'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  
  const isSuperuser = currentUser?.email === 'jones.emfcontracting@gmail.com';

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    sms_carrier: '',
    role: 'lead_tech',
    regular_rate: 64,
    overtime_rate: 96,
    is_active: true
  });

  useEffect(() => {
    checkAuth();
    fetchUsers();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    setCurrentUser(userData);
  }

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  function openNewUserModal() {
    setEditingUser(null);
    setNewPassword('');
    setShowPasswordReset(false);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      sms_carrier: '',
      role: 'lead_tech',
      regular_rate: 64,
      overtime_rate: 96,
      is_active: true
    });
    setShowModal(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setNewPassword('');
    setShowPasswordReset(false);
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
      sms_carrier: user.sms_carrier || '',
      role: user.role,
      regular_rate: user.regular_rate || 64,
      overtime_rate: user.overtime_rate || 96,
      is_active: user.is_active
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update(formData)
          .eq('user_id', editingUser.user_id);

        if (error) throw error;

        if (isSuperuser && showPasswordReset && newPassword) {
          await handlePasswordReset(editingUser.user_id);
        }

        alert('User updated successfully!');
      } else {
        const { error } = await supabase
          .from('users')
          .insert([formData]);

        if (error) throw error;
        alert('User created successfully! They can log in with email and PIN: 5678');
      }

      setShowModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset(userId) {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          newPassword: newPassword,
          requestorEmail: currentUser.email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      alert('Password reset successfully!');
      setNewPassword('');
      setShowPasswordReset(false);
    } catch (error) {
      console.error('Password reset error:', error);
      alert('Error resetting password: ' + error.message);
    }
  }

  async function handleDeleteUser(user) {
    if (!isSuperuser) {
      alert('Only superuser can delete users');
      return;
    }

    const confirmMessage = `⚠️ WARNING: PERMANENT DELETION

This will PERMANENTLY DELETE:
• ${user.first_name} ${user.last_name}
• ${user.email}
• All their hours logs
• All their team assignments
• Their availability records

This CANNOT be undone!

If you just want to remove access, use "Deactivate" instead.

Type "DELETE" to confirm permanent deletion:`;
    const confirmation = prompt(confirmMessage);

    if (confirmation !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }

    try {
      const response = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.user_id,
          requestorEmail: currentUser.email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      alert('✅ User permanently deleted!');
      fetchUsers();
    } catch (error) {
      console.error('Delete user error:', error);
      alert('Error deleting user: ' + error.message);
    }
  }

  async function toggleUserStatus(user) {
    if (!confirm(`${user.is_active ? 'Deactivate' : 'Activate'} ${user.first_name} ${user.last_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('user_id', user.user_id);

      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error updating user status');
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    leadTechs: users.filter(u => u.role === 'lead_tech').length,
    helpers: users.filter(u => u.role === 'helper').length,
    active: users.filter(u => u.is_active).length,
    missingCarrier: users.filter(u => u.is_active && !u.sms_carrier && ['lead_tech', 'helper', 'tech'].includes(u.role)).length
  };

  function getRoleBadgeColor(role) {
    switch (role) {
      case 'admin': return 'bg-purple-600';
      case 'office_staff': return 'bg-blue-600';
      case 'office': return 'bg-blue-600';
      case 'lead_tech': return 'bg-green-600';
      case 'tech': return 'bg-teal-600';
      case 'helper': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  }

  function getRoleDisplayName(role) {
    switch (role) {
      case 'admin': return 'Admin';
      case 'office_staff': return 'Office Staff';
      case 'office': return 'Office';
      case 'lead_tech': return 'Lead Tech';
      case 'tech': return 'Tech';
      case 'helper': return 'Helper';
      default: return role;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold">👥 User Management</h1>
              <p className="text-sm text-gray-400">Manage team members and access</p>
              {isSuperuser && (
                <p className="text-xs text-green-400 mt-1">🔑 Superuser Access</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={openNewUserModal}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              + Add User
            </button>
            <button 
              onClick={() => router.push('/dashboard')}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Lead Techs</p>
            <p className="text-3xl font-bold text-green-400">{stats.leadTechs}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Helpers</p>
            <p className="text-3xl font-bold text-gray-400">{stats.helpers}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Active Users</p>
            <p className="text-3xl font-bold text-blue-400">{stats.active}</p>
          </div>
          <div className={`p-4 rounded-lg ${stats.missingCarrier > 0 ? 'bg-yellow-900/50 border border-yellow-600' : 'bg-gray-800'}`}>
            <p className="text-gray-400 text-sm">📱 Missing Carrier</p>
            <p className={`text-3xl font-bold ${stats.missingCarrier > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {stats.missingCarrier}
            </p>
            {stats.missingCarrier > 0 && (
              <p className="text-xs text-yellow-500 mt-1">Can't receive texts</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="lead_tech">Lead Techs</option>
                <option value="tech">Techs</option>
                <option value="helper">Helpers</option>
                <option value="office">Office</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Phone / Carrier</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rates (RT/OT)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="border-t border-gray-700 hover:bg-gray-700/50 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold">
                        {user.first_name} {user.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {user.phone ? (
                        <div>
                          <div className="text-gray-300">
                            {user.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                          </div>
                          {user.sms_carrier ? (
                            <span className="text-xs px-2 py-0.5 bg-green-900 text-green-300 rounded-full">
                              📱 {user.sms_carrier.charAt(0).toUpperCase() + user.sms_carrier.slice(1)}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-yellow-900 text-yellow-300 rounded-full">
                              ⚠️ No carrier
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      ${user.regular_rate || 64} / ${user.overtime_rate || 96}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user)}
                          className={user.is_active ? 'text-orange-400 hover:text-orange-300' : 'text-green-400 hover:text-green-300'}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {isSuperuser && user.email !== 'jones.emfcontracting@gmail.com' && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-400 hover:text-red-300 font-semibold"
                            title="Permanently delete user"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Phone Carrier (for SMS alerts)
                  </label>
                  <select
                    value={formData.sms_carrier}
                    onChange={(e) => setFormData({...formData, sms_carrier: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Select Carrier --</option>
                    <option value="aerial">Aerial Communications</option>
                    <option value="att">AT&T</option>
                    <option value="bellsouth">BellSouth</option>
                    <option value="boost">Boost Mobile</option>
                    <option value="cricket">Cricket</option>
                    <option value="googlefi">Google Fi</option>
                    <option value="metro">Metro PCS</option>
                    <option value="sprint">Sprint</option>
                    <option value="straight_talk">Straight Talk</option>
                    <option value="tmobile">T-Mobile</option>
                    <option value="uscellular">US Cellular</option>
                    <option value="verizon">Verizon</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Required to receive text notifications</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="lead_tech">Lead Tech</option>
                    <option value="tech">Tech</option>
                    <option value="helper">Helper</option>
                    <option value="office">Office</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Regular Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      value={formData.regular_rate}
                      onChange={(e) => setFormData({...formData, regular_rate: parseFloat(e.target.value)})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">RT (up to 8 hrs)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Overtime Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      value={formData.overtime_rate}
                      onChange={(e) => setFormData({...formData, overtime_rate: parseFloat(e.target.value)})}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">OT (over 8 hrs)</p>
                  </div>
                </div>

                {isSuperuser && editingUser && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-400">
                        🔑 Reset Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(!showPasswordReset)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        {showPasswordReset ? 'Cancel' : 'Change Password'}
                      </button>
                    </div>
                    
                    {showPasswordReset && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 6 characters)"
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500">
                          New password will be saved when you click "Update User"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-300">
                    Active User
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-lg font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg font-semibold transition"
                  >
                    {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
