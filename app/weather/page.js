'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/app/components/AppShell';

// ── Severity config ──────────────────────────────────────────────────────────
const SEVERITY = {
  Extreme: { bar: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/30',    glow: 'border-red-500/30 bg-red-500/5' },
  Severe:  { bar: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', glow: 'border-orange-500/30 bg-orange-500/5' },
  Moderate:{ bar: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', glow: 'border-yellow-500/30 bg-yellow-500/5' },
  Minor:   { bar: 'bg-blue-500',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   glow: 'border-blue-500/30 bg-blue-500/5' },
  Unknown: { bar: 'bg-slate-500',  badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30', glow: 'border-slate-500/30 bg-slate-500/5' },
};

const HAZARD_COLORS = {
  lightning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  tornado:   'bg-red-500/15 text-red-400 border-red-500/30',
  flood:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  ice:       'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  snow:      'bg-slate-500/15 text-slate-400 border-slate-500/30',
  wind:      'bg-purple-500/15 text-purple-400 border-purple-500/30',
  heat:      'bg-orange-500/15 text-orange-400 border-orange-500/30',
  fog:       'bg-gray-500/15 text-gray-400 border-gray-500/30',
  hail:      'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
};

// ── UI primitives ────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0d0d14] border border-[#1e1e2e] rounded-xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-[#1e1e2e] ${className}`}>{children}</div>
);
const CardBody = ({ children, className = '' }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

// ── Weather icon based on forecast text ─────────────────────────────────────
const weatherIcon = (text = '', isDaytime = true) => {
  const t = text.toLowerCase();
  if (t.includes('thunder') || t.includes('lightning')) return '⛈️';
  if (t.includes('tornado'))   return '🌪️';
  if (t.includes('snow') || t.includes('blizzard')) return '❄️';
  if (t.includes('sleet') || t.includes('ice'))     return '🌨️';
  if (t.includes('rain') || t.includes('shower'))   return '🌧️';
  if (t.includes('drizzle'))   return '🌦️';
  if (t.includes('fog') || t.includes('mist'))      return '🌫️';
  if (t.includes('wind') || t.includes('breezy') || t.includes('blustery')) return '💨';
  if (t.includes('cloud') || t.includes('overcast')) return isDaytime ? '⛅' : '☁️';
  if (t.includes('partly'))    return isDaytime ? '⛅' : '🌤️';
  if (t.includes('clear') || t.includes('sunny')) return isDaytime ? '☀️' : '🌙';
  return isDaytime ? '🌤️' : '🌙';
};

// ── Temp color ───────────────────────────────────────────────────────────────
const tempColor = (t) => {
  if (t >= 100) return 'text-red-400';
  if (t >= 90)  return 'text-orange-400';
  if (t >= 80)  return 'text-yellow-400';
  if (t >= 60)  return 'text-emerald-400';
  if (t >= 40)  return 'text-blue-400';
  return 'text-cyan-400';
};

// ════════════════════════════════════════════════════════════════════════════
export default function WeatherPage() {
  const [weather, setWeather]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('lexington');
  const [showAllAlerts, setShowAllAlerts]   = useState(false);
  const [sendingAlert, setSendingAlert]     = useState(false);
  const [alertSent, setAlertSent]           = useState(false);
  const [expandedAlert, setExpandedAlert]   = useState(null);
  const [lastUpdated, setLastUpdated]       = useState(null);

  useEffect(() => {
    fetchWeather();
    const iv = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  async function fetchWeather() {
    try {
      setLoading(true);
      const res = await fetch('/api/weather?location=all');
      if (!res.ok) throw new Error('Failed to fetch weather');
      const data = await res.json();
      setWeather(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendWeatherAlert() {
    if (!weather?.alerts?.length) return;
    setSendingAlert(true);
    try {
      const severe = weather.alerts.filter(a => a.severity === 'Extreme' || a.severity === 'Severe');
      const primary = severe[0] || weather.alerts[0];
      const alertText = `EMF WEATHER ALERT: ${primary.event}. ${primary.headline?.slice(0, 80) || 'Check forecast before outdoor work.'}`.slice(0, 160);
      const res = await fetch('/api/weather/alert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType: primary.event, alertMessage: alertText, alertDetails: primary.instruction?.slice(0, 500), severity: primary.severity }),
      });
      const result = await res.json();
      if (result.success) { setAlertSent(true); setTimeout(() => setAlertSent(false), 4000); }
      else alert('Failed to send alert: ' + result.error);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSendingAlert(false); }
  }

  const hasAlerts  = weather?.alerts?.length > 0;
  const hasSevere  = weather?.alerts?.some(a => a.severity === 'Extreme' || a.severity === 'Severe');
  const hasHazards = weather?.hazardous_conditions?.length > 0;
  const forecast   = weather?.forecasts?.[selectedLocation];
  const visibleAlerts = showAllAlerts ? weather?.alerts : weather?.alerts?.slice(0, 2);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading && !weather) {
    return (
      <AppShell activeLink="/weather">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading weather data…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeLink="/weather">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Toast ── */}
        {alertSent && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Weather alert sent to team!
          </div>
        )}

        {/* ── Page Header ── */}
        <div className={`border-b px-6 py-5 ${hasSevere ? 'bg-red-950/40 border-red-800/50' : hasAlerts ? 'bg-yellow-950/30 border-yellow-800/40' : 'bg-[#0d0d14] border-[#1e1e2e]'}`}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                {hasSevere && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                {!hasSevere && hasAlerts && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                {!hasAlerts && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">
                  {hasSevere ? 'Severe Weather Active' : hasAlerts ? 'Weather Alerts Active' : 'All Clear'}
                </p>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">Weather &amp; Alerts</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                South Carolina Service Areas
                {lastUpdated && <span className="ml-2 text-slate-600">• Updated {lastUpdated.toLocaleTimeString()}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn onClick={fetchWeather} disabled={loading} variant="default" size="sm">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={loading ? 'animate-spin' : ''}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </Btn>
              {hasAlerts && (
                <Btn onClick={sendWeatherAlert} disabled={sendingAlert}
                  variant={hasSevere ? 'danger' : 'warning'} size="sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
                  {sendingAlert ? 'Sending…' : 'Alert Team'}
                </Btn>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
              <p className="text-red-400 text-sm">Error loading weather: {error}</p>
              <Btn onClick={fetchWeather} variant="danger" size="sm">Try Again</Btn>
            </div>
          )}

          {/* ── All Clear Banner ── */}
          {!hasAlerts && !hasHazards && !error && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl flex-shrink-0">✅</div>
              <div>
                <h2 className="text-lg font-bold text-emerald-400">All Clear</h2>
                <p className="text-slate-500 text-sm">No active weather alerts or hazardous conditions for outdoor work.</p>
              </div>
            </div>
          )}

          {/* ── Active Alerts ── */}
          {hasAlerts && (
            <Card className={hasSevere ? 'border-red-500/30' : 'border-yellow-500/30'}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${hasSevere ? 'bg-red-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`} />
                  <h2 className="text-sm font-semibold text-slate-200">
                    Active Weather Alerts
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border font-bold
                      ${hasSevere ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'}`}>
                      {weather.alerts.length}
                    </span>
                  </h2>
                </div>
                {weather.alerts.length > 2 && (
                  <Btn onClick={() => setShowAllAlerts(p => !p)} variant="ghost" size="sm">
                    {showAllAlerts ? 'Show Less' : `Show All ${weather.alerts.length}`}
                  </Btn>
                )}
              </CardHeader>
              <CardBody className="space-y-3">
                {visibleAlerts?.map((alert, idx) => {
                  const sev = SEVERITY[alert.severity] || SEVERITY.Unknown;
                  const isOpen = expandedAlert === idx;
                  return (
                    <div key={alert.id || idx} className={`rounded-xl border ${sev.glow} overflow-hidden`}>
                      {/* Severity bar */}
                      <div className={`h-0.5 ${sev.bar}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${sev.badge}`}>
                                {alert.severity}
                              </span>
                            </div>
                            <h3 className="font-bold text-slate-100 text-base">{alert.event}</h3>
                            <p className="text-slate-400 text-sm mt-1 leading-relaxed">{alert.headline}</p>
                            {alert.areas && (
                              <p className="text-slate-600 text-xs mt-2 flex items-center gap-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {alert.areas}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-600">Expires</p>
                            <p className="text-xs text-slate-400 font-mono">
                              {alert.expires ? new Date(alert.expires).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '—'}
                            </p>
                          </div>
                        </div>
                        {alert.instruction && (
                          <div className="mt-3 pt-3 border-t border-[#1e1e2e]">
                            <button onClick={() => setExpandedAlert(isOpen ? null : idx)}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold transition">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                              {isOpen ? 'Hide' : 'Show'} Instructions
                            </button>
                            {isOpen && (
                              <p className="text-xs text-slate-400 mt-2 leading-relaxed whitespace-pre-wrap bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-3">
                                {alert.instruction}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          {/* ── Hazardous Conditions ── */}
          {hasHazards && (
            <Card className="border-orange-500/20">
              <CardHeader>
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="text-orange-400">⚠</span>
                  Hazardous Conditions for Outdoor Work
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {weather.hazardous_conditions.map((cond, idx) => (
                    <div key={idx} className="bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-slate-200 text-sm">{cond.location}</p>
                        <p className="text-xs text-slate-600">{cond.period}</p>
                      </div>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">{cond.forecast}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cond.hazards?.map((h, hi) => (
                          <span key={hi} className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${HAZARD_COLORS[h.type] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                            {h.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── Location Forecast ── */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Location Forecast</h2>
              <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
                className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/60 transition">
                {weather?.forecasts && Object.entries(weather.forecasts).map(([key, loc]) => (
                  <option key={key} value={key}>{loc.name}</option>
                ))}
              </select>
            </CardHeader>
            <CardBody>
              {forecast ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {forecast.periods?.slice(0, 6).map((period, idx) => (
                    <div key={idx}
                      className={`rounded-xl p-3 text-center border transition
                        ${idx === 0
                          ? 'bg-blue-500/10 border-blue-500/20'
                          : period.isDaytime
                            ? 'bg-[#0a0a0f] border-[#1e1e2e] hover:border-[#2d2d44]'
                            : 'bg-[#080810] border-[#1e1e2e] hover:border-[#2d2d44]'}`}>
                      <p className={`text-xs font-semibold mb-2 ${idx === 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                        {period.name}
                      </p>
                      <div className="text-3xl mb-2">{weatherIcon(period.shortForecast, period.isDaytime)}</div>
                      <p className={`text-2xl font-bold font-mono mb-1 ${tempColor(period.temperature)}`}>
                        {period.temperature}°
                      </p>
                      <p className="text-[10px] text-slate-600 mb-2 font-mono">
                        {period.windSpeed} {period.windDirection}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-tight">{period.shortForecast}</p>
                      {period.probabilityOfPrecipitation > 0 && (
                        <p className="text-[10px] text-blue-400 mt-1.5 font-semibold">
                          💧 {period.probabilityOfPrecipitation}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-slate-600">No forecast data available.</p>
              )}
            </CardBody>
          </Card>

          {/* ── Bottom grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* All locations current */}
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-slate-200">All Locations — Current</h3></CardHeader>
              <CardBody className="space-y-1 p-3">
                {weather?.forecasts && Object.entries(weather.forecasts).map(([key, loc]) => {
                  const cur = loc.periods?.[0];
                  if (!cur) return null;
                  const isSelected = key === selectedLocation;
                  return (
                    <button key={key} onClick={() => setSelectedLocation(key)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition text-left
                        ${isSelected ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-[#1e1e2e]/40 border border-transparent'}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{weatherIcon(cur.shortForecast, cur.isDaytime)}</span>
                        <p className={`text-sm font-medium ${isSelected ? 'text-blue-300' : 'text-slate-300'}`}>{loc.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`text-xs text-slate-500 hidden sm:block max-w-[120px] truncate`}>{cur.shortForecast}</p>
                        <p className={`font-bold font-mono text-sm ${tempColor(cur.temperature)}`}>
                          {cur.temperature}°{cur.temperatureUnit}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </CardBody>
            </Card>

            {/* Safety guidelines */}
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-slate-200">Outdoor Work Safety</h3></CardHeader>
              <CardBody className="space-y-3">
                {[
                  { icon: '⚡', label: 'Lightning',    text: 'Stop outdoor work, seek shelter. Wait 30 min after last strike.' },
                  { icon: '💨', label: 'High Winds',   text: 'No ladder/lift work above 25 mph sustained winds.' },
                  { icon: '🔥', label: 'Extreme Heat', text: 'Frequent breaks, stay hydrated. Watch for heat exhaustion signs.' },
                  { icon: '🧊', label: 'Ice / Snow',   text: 'Check road conditions. Extra caution on ladders and roofs.' },
                  { icon: '🌧️', label: 'Heavy Rain',   text: 'No electrical work in wet outdoor conditions.' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl">
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-300 mb-0.5">{item.label}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
