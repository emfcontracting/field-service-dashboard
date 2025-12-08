// app/mobile/components/WeatherWidget.js
'use client';

import { useState, useEffect } from 'react';

const HAZARD_ICONS = {
  'lightning': '⚡',
  'tornado': '🌪️',
  'flood': '🌊',
  'ice': '🧊',
  'snow': '❄️',
  'wind': '💨',
  'heat': '🔥',
  'fog': '🌫️',
  'hail': '🌨️'
};

export default function WeatherWidget({ expanded = false, onToggle }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchWeather() {
    try {
      const response = await fetch('/api/weather?location=lexington');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setWeather(data);
      setError(null);
    } catch (err) {
      setError('Unable to load weather');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  const hasAlerts = weather?.alerts?.length > 0;
  const hasSevere = weather?.alerts?.some(a => a.severity === 'Extreme' || a.severity === 'Severe');
  const hasHazards = weather?.hazardous_conditions?.length > 0;
  const forecast = weather?.forecasts?.lexington?.periods?.[0];

  return (
    <div 
      className={`rounded-xl mb-4 overflow-hidden transition-all ${
        hasSevere 
          ? 'bg-red-900/40 border border-red-500/50' 
          : hasAlerts || hasHazards
            ? 'bg-yellow-900/30 border border-yellow-500/30'
            : 'bg-gray-800 border border-gray-700'
      }`}
    >
      {/* Compact View */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">
              {hasSevere ? '⚠️' : hasAlerts ? '🌧️' : forecast?.isDaytime ? '☀️' : '🌙'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {forecast?.temperature || '--'}°
                </span>
                <span className="text-gray-400 text-sm">
                  {forecast?.shortForecast || 'Loading...'}
                </span>
              </div>
              {hasAlerts && (
                <div className={`text-sm font-medium ${hasSevere ? 'text-red-400' : 'text-yellow-400'}`}>
                  ⚠️ {weather.alerts.length} Active Alert{weather.alerts.length > 1 ? 's' : ''}
                </div>
              )}
              {!hasAlerts && hasHazards && (
                <div className="text-sm text-yellow-400">
                  ⚠️ Hazardous conditions
                </div>
              )}
            </div>
          </div>
          <div className="text-gray-500">
            {expanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50">
          {/* Current Conditions */}
          {forecast && (
            <div className="py-3 border-b border-gray-700/50">
              <div className="text-sm text-gray-400 mb-1">Current Conditions</div>
              <div className="flex items-center gap-4 text-sm">
                <span>💨 {forecast.windSpeed} {forecast.windDirection}</span>
                {forecast.probabilityOfPrecipitation > 0 && (
                  <span>💧 {forecast.probabilityOfPrecipitation}% rain</span>
                )}
              </div>
              <p className="text-sm text-gray-300 mt-2">{forecast.detailedForecast}</p>
            </div>
          )}

          {/* Alerts */}
          {hasAlerts && (
            <div className="py-3 border-b border-gray-700/50">
              <div className="text-sm text-gray-400 mb-2">Active Alerts</div>
              <div className="space-y-2">
                {weather.alerts.slice(0, 2).map((alert, idx) => (
                  <div 
                    key={idx}
                    className={`p-2 rounded-lg text-sm ${
                      alert.severity === 'Extreme' || alert.severity === 'Severe'
                        ? 'bg-red-900/50 text-red-200'
                        : 'bg-yellow-900/50 text-yellow-200'
                    }`}
                  >
                    <div className="font-medium">{alert.event}</div>
                    <div className="text-xs opacity-80">{alert.headline?.slice(0, 100)}...</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hazards */}
          {hasHazards && (
            <div className="py-3 border-b border-gray-700/50">
              <div className="text-sm text-gray-400 mb-2">⚠️ Work Hazards</div>
              <div className="flex flex-wrap gap-2">
                {weather.hazardous_conditions.flatMap(c => c.hazards).map((hazard, idx) => (
                  <span 
                    key={idx}
                    className="px-2 py-1 bg-orange-900/50 text-orange-200 rounded text-xs"
                  >
                    {HAZARD_ICONS[hazard.type] || '⚠️'} {hazard.label.replace(/^[^\s]+\s/, '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Safety Tips */}
          <div className="pt-3">
            <div className="text-xs text-gray-500">
              🦺 Check conditions before outdoor work. Contact dispatch if unsafe.
            </div>
          </div>

          {/* Link to full forecast */}
          <a 
            href="/weather"
            className="mt-3 block text-center text-sm text-blue-400 hover:text-blue-300"
          >
            View Full Forecast →
          </a>
        </div>
      )}
    </div>
  );
}
