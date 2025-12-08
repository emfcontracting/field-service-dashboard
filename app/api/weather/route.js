// app/api/weather/route.js
// Fetches weather data and alerts for South Carolina service areas
import { NextResponse } from 'next/server';

// NWS API is free and doesn't require an API key
const NWS_BASE_URL = 'https://api.weather.gov';

// Service area coordinates (South Carolina locations EMF covers)
const SERVICE_AREAS = {
  columbia: { lat: 34.0007, lon: -81.0348, name: 'Columbia', zone: 'SCZ045' },
  lexington: { lat: 33.9813, lon: -81.2365, name: 'Lexington', zone: 'SCZ045' },
  charleston: { lat: 32.7765, lon: -79.9311, name: 'Charleston', zone: 'SCZ050' },
  greenville: { lat: 34.8526, lon: -82.3940, name: 'Greenville', zone: 'SCZ011' },
  spartanburg: { lat: 34.9496, lon: -81.9320, name: 'Spartanburg', zone: 'SCZ012' },
  florence: { lat: 34.1954, lon: -79.7626, name: 'Florence', zone: 'SCZ041' },
  myrtle_beach: { lat: 33.6891, lon: -78.8867, name: 'Myrtle Beach', zone: 'SCZ056' },
  rock_hill: { lat: 34.9249, lon: -81.0251, name: 'Rock Hill', zone: 'SCZ025' },
  sumter: { lat: 33.9204, lon: -80.3415, name: 'Sumter', zone: 'SCZ043' },
  aiken: { lat: 33.5604, lon: -81.7196, name: 'Aiken', zone: 'SCZ039' },
};

// Severity levels for alerts
const SEVERITY_ORDER = {
  'Extreme': 4,
  'Severe': 3,
  'Moderate': 2,
  'Minor': 1,
  'Unknown': 0
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location') || 'all';
  
  try {
    const results = {
      timestamp: new Date().toISOString(),
      alerts: [],
      forecasts: {},
      hazardous_conditions: []
    };

    // Get active alerts for South Carolina
    const alertsResponse = await fetch(`${NWS_BASE_URL}/alerts/active?area=SC`, {
      headers: { 'User-Agent': 'EMF-Contracting-FSM (emfcbre@gmail.com)' }
    });
    
    if (alertsResponse.ok) {
      const alertsData = await alertsResponse.json();
      results.alerts = (alertsData.features || []).map(alert => ({
        id: alert.id,
        event: alert.properties.event,
        headline: alert.properties.headline,
        description: alert.properties.description,
        severity: alert.properties.severity,
        urgency: alert.properties.urgency,
        certainty: alert.properties.certainty,
        effective: alert.properties.effective,
        expires: alert.properties.expires,
        areas: alert.properties.areaDesc,
        instruction: alert.properties.instruction
      })).sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0));
    }

    // Get forecasts for requested locations
    const locationsToFetch = location === 'all' 
      ? Object.entries(SERVICE_AREAS)
      : [[location, SERVICE_AREAS[location]]].filter(([_, v]) => v);

    for (const [key, loc] of locationsToFetch) {
      if (!loc) continue;
      
      try {
        // Get grid point first
        const pointResponse = await fetch(
          `${NWS_BASE_URL}/points/${loc.lat},${loc.lon}`,
          { headers: { 'User-Agent': 'EMF-Contracting-FSM (emfcbre@gmail.com)' } }
        );
        
        if (pointResponse.ok) {
          const pointData = await pointResponse.json();
          const forecastUrl = pointData.properties.forecast;
          
          // Get forecast
          const forecastResponse = await fetch(forecastUrl, {
            headers: { 'User-Agent': 'EMF-Contracting-FSM (emfcbre@gmail.com)' }
          });
          
          if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json();
            const periods = forecastData.properties.periods || [];
            
            results.forecasts[key] = {
              name: loc.name,
              updated: forecastData.properties.updated,
              periods: periods.slice(0, 6).map(p => ({
                name: p.name,
                temperature: p.temperature,
                temperatureUnit: p.temperatureUnit,
                windSpeed: p.windSpeed,
                windDirection: p.windDirection,
                shortForecast: p.shortForecast,
                detailedForecast: p.detailedForecast,
                isDaytime: p.isDaytime,
                probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value || 0,
                icon: p.icon
              }))
            };

            // Check for hazardous conditions
            for (const period of periods.slice(0, 4)) {
              const dominated = period.shortForecast?.toLowerCase() || '';
              const detailed = period.detailedForecast?.toLowerCase() || '';
              const combined = dominated + ' ' + detailed;
              
              const hazards = [];
              
              // Check for various hazardous conditions
              if (combined.includes('thunder') || combined.includes('lightning')) {
                hazards.push({ type: 'lightning', label: '⚡ Lightning Risk' });
              }
              if (combined.includes('tornado') || combined.includes('funnel')) {
                hazards.push({ type: 'tornado', label: '🌪️ Tornado Risk' });
              }
              if (combined.includes('flood') || combined.includes('flooding')) {
                hazards.push({ type: 'flood', label: '🌊 Flood Risk' });
              }
              if (combined.includes('ice') || combined.includes('freezing rain') || combined.includes('sleet')) {
                hazards.push({ type: 'ice', label: '🧊 Ice/Freezing Rain' });
              }
              if (combined.includes('snow') || combined.includes('blizzard')) {
                hazards.push({ type: 'snow', label: '❄️ Snow' });
              }
              if (combined.includes('wind') && (combined.includes('high') || combined.includes('strong') || combined.includes('damaging'))) {
                hazards.push({ type: 'wind', label: '💨 High Winds' });
              }
              if (combined.includes('extreme heat') || combined.includes('excessive heat') || period.temperature >= 100) {
                hazards.push({ type: 'heat', label: '🔥 Extreme Heat' });
              }
              if (combined.includes('fog') && combined.includes('dense')) {
                hazards.push({ type: 'fog', label: '🌫️ Dense Fog' });
              }
              if (combined.includes('hail')) {
                hazards.push({ type: 'hail', label: '🌨️ Hail Risk' });
              }
              
              if (hazards.length > 0) {
                results.hazardous_conditions.push({
                  location: loc.name,
                  period: period.name,
                  temperature: `${period.temperature}°${period.temperatureUnit}`,
                  forecast: period.shortForecast,
                  hazards
                });
              }
            }
          }
        }
      } catch (locError) {
        console.error(`Error fetching weather for ${key}:`, locError);
      }
    }

    // Deduplicate hazardous conditions
    const seenHazards = new Set();
    results.hazardous_conditions = results.hazardous_conditions.filter(h => {
      const key = `${h.location}-${h.period}-${h.hazards.map(hz => hz.type).join(',')}`;
      if (seenHazards.has(key)) return false;
      seenHazards.add(key);
      return true;
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
