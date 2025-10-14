'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function SettingsContent() {
  const [qbConnected, setQbConnected] = useState(false);
  const [qbSettings, setQbSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    checkQuickBooksConnection();

    // Show success/error messages
    if (searchParams.get('qb_success')) {
      alert('✅ QuickBooks connected successfully!');
    }
    if (searchParams.get('qb_error')) {
      alert('❌ QuickBooks connection failed. Please try again.');
    }
  }, []);

  const checkQuickBooksConnection = async () => {
    const { data, error } = await supabase
      .from('quickbooks_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!error && data) {
      setQbConnected(true);
      setQbSettings(data);
    }
    setLoading(false);
  };

  const connectQuickBooks = async () => {
    try {
      const response = await fetch('/api/quickbooks/auth');
      const { authUri } = await response.json();
      window.location.href = authUri;
    } catch (error) {
      alert('Failed to connect to QuickBooks: ' + error.message);
    }
  };

  const disconnectQuickBooks = async () => {
    if (!confirm('Disconnect QuickBooks?\n\nYou can reconnect anytime.')) return;

    try {
      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'POST'
      });

      if (response.ok) {
        alert('✅ QuickBooks disconnected');
        setQbConnected(false);
        setQbSettings(null);
      }
    } catch (error) {
      alert('Failed to disconnect: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">⚙️ Settings</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* QuickBooks Integration */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src="https://plugin.intuitcdn.net/sbg-web-shell-ui/6.3.0/shell/harmony/images/QBOlogo.svg"
              alt="QuickBooks"
              className="h-8"
            />
            <h2 className="text-2xl font-bold">QuickBooks Online</h2>
          </div>

          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : qbConnected ? (
            <div>
              <div className="bg-green-900 text-green-200 p-4 rounded-lg mb-4">
                <div className="font-bold mb-2">✅ Connected to QuickBooks</div>
                <div className="text-sm">
                  <div>Company ID: {qbSettings.realm_id}</div>
                  <div>Connected: {new Date(qbSettings.connected_at).toLocaleString()}</div>
                  {qbSettings.last_sync_at && (
                    <div>Last Sync: {new Date(qbSettings.last_sync_at).toLocaleString()}</div>
                  )}
                </div>
              </div>

              <button
                onClick={disconnectQuickBooks}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-bold transition"
              >
                Disconnect QuickBooks
              </button>
            </div>
          ) : (
            <div>
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg mb-4">
                <div className="font-bold mb-2">Connect to QuickBooks Online</div>
                <div className="text-sm">
                  Sync your invoices directly to QuickBooks Online. You'll need:
                  <ul className="list-disc list-inside mt-2 ml-4">
                    <li>QuickBooks Online account (not Desktop)</li>
                    <li>Admin access to your QuickBooks company</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={connectQuickBooks}
                className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                🔗 Connect QuickBooks
              </button>
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        {!qbConnected && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-3">📋 Setup Instructions</h3>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>Don't have QuickBooks yet?</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Sign up for QuickBooks Online at <a href="https://quickbooks.intuit.com" target="_blank" className="text-blue-400 underline">quickbooks.intuit.com</a></li>
                <li>Complete your company setup</li>
                <li>Return here and click "Connect QuickBooks"</li>
                <li>Log in with your QuickBooks credentials</li>
                <li>Authorize the connection</li>
              </ol>
              <p className="mt-4 text-yellow-400">
                ⚠️ <strong>Note:</strong> This integration requires QuickBooks Online, not QuickBooks Desktop.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-2xl">Loading settings...</div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}