// Carrier Setup Modal - One-time prompt for mobile carrier info
'use client';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// SMS Carrier options with gateway domains
const SMS_CARRIERS = [
  { value: 'verizon', label: 'Verizon', gateway: 'vtext.com' },
  { value: 'att', label: 'AT&T', gateway: 'txt.att.net' },
  { value: 'tmobile', label: 'T-Mobile', gateway: 'tmomail.net' },
  { value: 'sprint', label: 'Sprint', gateway: 'messaging.sprintpcs.com' },
  { value: 'boost', label: 'Boost Mobile', gateway: 'sms.myboostmobile.com' },
  { value: 'cricket', label: 'Cricket', gateway: 'sms.cricketwireless.net' },
  { value: 'metropcs', label: 'Metro PCS', gateway: 'mymetropcs.com' },
  { value: 'uscellular', label: 'US Cellular', gateway: 'email.uscc.net' },
  { value: 'virgin', label: 'Virgin Mobile', gateway: 'vmobl.com' },
  { value: 'googlefi', label: 'Google Fi', gateway: 'msg.fi.google.com' },
  { value: 'xfinity', label: 'Xfinity Mobile', gateway: 'vtext.com' },
  { value: 'visible', label: 'Visible', gateway: 'vtext.com' },
  { value: 'spectrum', label: 'Spectrum Mobile', gateway: 'vtext.com' },
  { value: 'bellsouth', label: 'BellSouth', gateway: 'sms.bellsouth.com' },
  { value: 'other', label: 'Other / Not Listed', gateway: '' }
];

export default function CarrierSetupModal({ user, onComplete, onSkip }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [carrier, setCarrier] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClientComponentClient();

  // Format phone number as user types
  const formatPhone = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async () => {
    // Validate
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    if (!carrier) {
      setError('Please select your mobile carrier');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          phone: digitsOnly,
          sms_carrier: carrier
        })
        .eq('user_id', user.user_id);

      if (updateError) throw updateError;

      // Update the user object and close modal
      onComplete({
        ...user,
        phone: digitsOnly,
        sms_carrier: carrier
      });
    } catch (err) {
      console.error('Error saving carrier info:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">📱</div>
          <h2 className="text-2xl font-bold text-white">
            Set Up Text Notifications
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            Enter your phone number and carrier to receive text notifications about new work orders and emergencies.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="w-full bg-gray-700 text-white text-lg px-4 py-3 rounded-xl border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Carrier Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Mobile Carrier
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full bg-gray-700 text-white text-lg px-4 py-3 rounded-xl border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- Select Your Carrier --</option>
              {SMS_CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-3 text-sm text-blue-200">
            <p className="font-semibold mb-1">📨 Why do we need this?</p>
            <p className="text-blue-300">
              We use your carrier info to send you text messages about:
            </p>
            <ul className="list-disc list-inside mt-1 text-blue-300 text-xs">
              <li>New work order assignments</li>
              <li>Emergency job notifications</li>
              <li>Schedule changes</li>
            </ul>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition"
          >
            {saving ? '⏳ Saving...' : '✅ Save & Continue'}
          </button>

          <button
            onClick={onSkip}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl font-semibold text-sm transition"
          >
            Skip for Now (Remind Me Later)
          </button>
        </div>

        {/* Privacy Note */}
        <p className="text-center text-gray-500 text-xs mt-4">
          Your phone number is only used for work notifications. Standard text message rates may apply.
        </p>
      </div>
    </div>
  );
}
