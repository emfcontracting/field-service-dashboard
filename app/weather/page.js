'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const SEVERITY_COLORS = {
  'Extreme': 'bg-red-600 border-red-500',
  'Severe': 'bg-orange-600 border-orange-500',
  'Moderate': 'bg-yellow-600 border-yellow-500',
  'Minor': 'bg-blue-600 border-blue-500',
  'Unknown': 'bg-gray-600 border-gray-500'
};

const SEVERITY_TEXT = {
  'Extreme': 'text-red-400',
  'Severe': 'text-orange-400',
  'Moderate': 'text-yellow-400',
  'Minor': 'text-blue-400',
  'Unknown': 'text-gray-400'
};

const HAZARD_COLORS = {
  'lightning': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'tornado': 'bg-red-500/20 text-red-300 border-red-500/30',
  'flood': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'ice': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'snow': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'wind': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'heat': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'fog': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  'hail': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
};

export default function WeatherPage() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('lexington');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    fetchWeather();
    // Refresh every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchWeather() {
    try {
      setLoading(true);
      const response = await fetch('/api/weather?location=all');
      if (!response.ok) throw new Error('Failed to fetch weather');
      const data = await response.json();
      setWeather(data);
      setError(null);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendWeatherAlert() {
    if (!weather || weather.alerts.length === 0) return;
    
    setSendingAlert(true);
    try {
      // Get the most severe alert
      const severeAlerts = weather.alerts.filter(a => 
        a.severity === 'Extreme' || a.severity === 'Severe'
      );
      
      const primaryAlert = severeAlerts.length > 0 ? severeAlerts[0] : weather.alerts[0];
      
      const alertText = `EMF WEATHER ALERT: ${primaryAlert.event}. ${primaryAlert.headline?.slice(0, 80) || 'Check forecast before outdoor work.'}`.slice(0, 160);

      const response = await fetch('/api/weather/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType: primaryAlert.event,
          alertMessage: alertText,
          alertDetails: primaryAlert.instruction?.slice(0, 500),
          severity: primaryAlert.severity
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setAlertSent(true);
        setTimeout(() => setAlertSent(false), 5000);
      } else {
        alert('Failed to send alert: ' + result.error);
      }
    } catch (err) {
      console.error('Failed to send alert:', err);
      alert('Failed to send alert: ' + err.message);
    } finally {
      setSendingAlert(false);
    }
  }

  if (loading && !weather) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading weather data...</p>
        </div>
      </div>
    );
  }

  const selectedForecast = weather?.forecasts?.[selectedLocation];
  const hasActiveAlerts = weather?.alerts?.length > 0;
  const hasSevereAlerts = weather?.alerts?.some(a => a.severity === 'Extreme' || a.severity === 'Severe');
  const hasHazards = weather?.hazardous_conditions?.length > 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className={`border-b px-6 py-4 ${
        hasSevereAlerts 
          ? 'bg-red-900/50 border-red-700' 
          : hasActiveAlerts 
            ? 'bg-yellow-900/30 border-yellow-700' 
            : 'bg-gray-800 border-gray-700'
      }`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ← Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🌤️ Weather & Alerts
                {hasSevereAlerts && <span className="text-red-400 animate-pulse">⚠️</span>}
              </h1>
              <p className="text-gray-400 text-sm">
                South Carolina Service Areas • Updated {weather?.timestamp ? new Date(weather.timestamp).toLocaleTimeString() : 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWeather}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm disabled:opacity-50"
            >
              🔄 Refresh
            </button>
            {hasActiveAlerts && (
              <button
                onClick={sendWeatherAlert}
                disabled={sendingAlert}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  hasSevereAlerts 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-yellow-600 hover:bg-yellow-700'
                } disabled:opacity-50`}
              >
                {sendingAlert ? 'Sending...' : '📢 Alert Team'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Alert Sent Toast */}
      {alertSent && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          ✓ Weather alert sent to team!
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Active Alerts Banner */}
        {hasActiveAlerts && (
          <div className={`rounded-xl border p-4 ${
            hasSevereAlerts 
              ? 'bg-red-900/30 border-red-500/50' 
              : 'bg-yellow-900/30 border-yellow-500/50'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                🚨 Active Weather Alerts ({weather.alerts.length})
              </h2>
              {weather.alerts.length > 2 && (
                <button
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {showAllAlerts ? 'Show Less' : `Show All ${weather.alerts.length}`}
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {(showAllAlerts ? weather.alerts : weather.alerts.slice(0, 2)).map((alert, idx) => (
                <div 
                  key={alert.id || idx}
                  className={`rounded-lg border p-3 ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS['Unknown']}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-xs font-bold uppercase ${SEVERITY_TEXT[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      <h3 className="font-bold text-white">{alert.event}</h3>
                      <p className="text-sm text-gray-200 mt-1">{alert.headline}</p>
                    </div>
                    <div className="text-right text-xs text-gray-300">
                      <div>Expires: {alert.expires ? new Date(alert.expires).toLocaleString() : 'Unknown'}</div>
                    </div>
                  </div>
                  {alert.areas && (
                    <p className="text-xs text-gray-300 mt-2">
                      📍 Areas: {alert.areas}
                    </p>
                  )}
                  {alert.instruction && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-300 cursor-pointer hover:text-white">
                        View Instructions
                      </summary>
                      <p className="text-xs text-gray-200 mt-1 whitespace-pre-wrap">
                        {alert.instruction}
                      </p>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hazardous Conditions for Outdoor Work */}
        {hasHazards && (
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              ⚠️ Hazardous Conditions for Outdoor Work
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {weather.hazardous_conditions.map((condition, idx) => (
                <div key={idx} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{condition.location}</span>
                    <span className="text-sm text-gray-400">{condition.period}</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{condition.forecast}</p>
                  <div className="flex flex-wrap gap-1">
                    {condition.hazards.map((hazard, hIdx) => (
                      <span 
                        key={hIdx}
                        className={`text-xs px-2 py-1 rounded border ${HAZARD_COLORS[hazard.type] || 'bg-gray-500/20 text-gray-300'}`}
                      >
                        {hazard.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Alerts Banner */}
        {!hasActiveAlerts && !hasHazards && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <h2 className="text-lg font-bold text-green-400">All Clear</h2>
                <p className="text-gray-400">No active weather alerts or hazardous conditions for outdoor work.</p>
              </div>
            </div>
          </div>
        )}

        {/* Location Forecasts */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">📍 Location Forecast</h2>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              >
                {weather?.forecasts && Object.entries(weather.forecasts).map(([key, loc]) => (
                  <option key={key} value={key}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedForecast ? (
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {selectedForecast.periods.map((period, idx) => (
                  <div 
                    key={idx}
                    className={`rounded-lg p-3 text-center ${
                      period.isDaytime ? 'bg-blue-900/20' : 'bg-gray-700/50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-300 mb-1">
                      {period.name}
                    </div>
                    <div className="text-3xl font-bold mb-1">
                      {period.temperature}°{period.temperatureUnit}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {period.windSpeed} {period.windDirection}
                    </div>
                    <div className="text-sm">
                      {period.shortForecast}
                    </div>
                    {period.probabilityOfPrecipitation > 0 && (
                      <div className="text-xs text-blue-400 mt-1">
                        💧 {period.probabilityOfPrecipitation}% precip
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No forecast data available
            </div>
          )}
        </div>

        {/* Quick Reference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* All Locations Overview */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="font-bold mb-3">🗺️ All Locations - Current</h3>
            <div className="space-y-2">
              {weather?.forecasts && Object.entries(weather.forecasts).map(([key, loc]) => {
                const current = loc.periods?.[0];
                if (!current) return null;
                return (
                  <div 
                    key={key}
                    className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                  >
                    <span className="font-medium">{loc.name}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold">{current.temperature}°{current.temperatureUnit}</span>
                      <span className="text-gray-400 w-32 truncate text-right">{current.shortForecast}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Safety Guidelines */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="font-bold mb-3">🦺 Outdoor Work Safety</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span>⚡</span>
                <span><strong>Lightning:</strong> Stop outdoor work, seek shelter. Wait 30 min after last strike.</span>
              </div>
              <div className="flex items-start gap-2">
                <span>💨</span>
                <span><strong>High Winds:</strong> No ladder/lift work above 25mph sustained winds.</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🔥</span>
                <span><strong>Extreme Heat:</strong> Frequent breaks, hydration. Watch for heat exhaustion.</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🧊</span>
                <span><strong>Ice/Snow:</strong> Check road conditions. Extra caution on ladders/roofs.</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🌧️</span>
                <span><strong>Heavy Rain:</strong> No electrical work in wet conditions outdoors.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
            <p className="text-red-400">Error loading weather: {error}</p>
            <button 
              onClick={fetchWeather}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
