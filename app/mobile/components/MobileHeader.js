// mobile/components/MobileHeader.js
'use client';

export default function MobileHeader({ 
  currentUser, 
  onCompletedClick, 
  onChangePinClick, 
  onLogout,
  showDashboardButton = false
}) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <img 
          src="/emf-logo.png" 
          alt="EMF" 
          className="h-10 w-auto"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML += '<div class="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-gray-900 font-bold">EMF</div>';
          }}
        />
        <div>
          <h1 className="text-lg font-bold">👋 {currentUser.first_name}</h1>
          <p className="text-xs text-gray-400">
            {currentUser.role.replace('_', ' ').toUpperCase()}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        {/* Only show Dashboard button for admin and office roles */}
        {showDashboardButton && (currentUser.role === 'admin' || currentUser.role === 'office') && (
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
          >
            💻 Dashboard
          </button>
        )}
        
        <button
          onClick={onCompletedClick}
          className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
        >
          ✅ Completed
        </button>
        
        <button
          onClick={onChangePinClick}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"
        >
          🔑 PIN
        </button>
        
        <button
          onClick={onLogout}
          className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
        >
          Logout
        </button>
      </div>
    </div>
  );
}