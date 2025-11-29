// mobile/components/LoginForm.js
'use client';

export default function LoginForm({ 
  email, 
  setEmail, 
  pin, 
  setPin, 
  error, 
  onSubmit 
}) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="bg-white rounded-xl p-4 inline-block mb-4">
              <img 
                src="/emf-logo.png" 
                alt="EMF Contracting" 
                className="h-16 w-auto mx-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<div class="h-16 w-16 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl">EMF</div>';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">EMF Contracting LLC</h1>
            <p className="text-gray-600 mt-1">Field Service Mobile</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit PIN"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition active:scale-95"
            >
              Login
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Contact your administrator if you need help with your PIN
          </p>
        </div>
      </div>
    </div>
  );
}