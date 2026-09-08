import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./WeatherMap.css";

const INDIA_CENTER = [22.5, 79.0];
const INDIA_BOUNDS = [
  [6.0, 68.0],
  [37.5, 97.5],
];

async function geocodeCity(city) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=en&format=json`
  );

  if (!response.ok) throw new Error("Unable to find the location");

  const data = await response.json();
  const result = data.results?.[0];

  if (!result) throw new Error(`Location "${city}" was not found`);

  return {
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
    name: result.name,
    state: result.admin1 || "",
  };
}

function getLayerValue(layer, weather) {
  if (!weather) return "Saved location";

  switch (layer) {
    case "Temperature":
      return `${weather.temperature ?? "--"}°C`;
    case "Rain":
      return `${weather.rainChance ?? 0}% rain chance`;
    case "Wind":
      return `${weather.wind ?? "--"} km/h`;
    case "Clouds":
      return `${weather.cloudCover ?? "--"}%`;
    case "Pressure":
      return `${weather.pressure ?? "--"} hPa`;
    default:
      return "--";
  }
}

export default function WeatherMap({
  currentLocation,
  currentCoordinates,
  currentWeather,
  locations = [],
  mapLayer,
  setMapLayer,
  locationSearch,
  setLocationSearch,
  onUseMyLocation,
  onSelectLocation,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState("");

  const layers = ["Temperature", "Rain", "Wind", "Clouds", "Pressure"];

  // Create the real India map once.
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 0.8,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Draw current + saved locations.
  // onSelectLocation is intentionally not a dependency because App creates
  // the callback during render; including it would redraw the map every clock tick.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerLayer = markersLayerRef.current;
    if (!map || !markerLayer) return;

    let cancelled = false;

    async function drawLocations() {
      setLoading(true);
      setMapError("");
      markerLayer.clearLayers();

      try {
        const points = [];

        if (
          currentCoordinates &&
          Number.isFinite(Number(currentCoordinates.latitude)) &&
          Number.isFinite(Number(currentCoordinates.longitude))
        ) {
          points.push({
            latitude: Number(currentCoordinates.latitude),
            longitude: Number(currentCoordinates.longitude),
            name: currentLocation || "My Location",
            state: "",
            isCurrent: true,
          });
        } else if (currentLocation) {
          const result = await geocodeCity(currentLocation);
          points.push({
            ...result,
            name: currentLocation,
            isCurrent: true,
          });
        }

        const saved = locations
          .filter(
            (item) =>
              item?.name &&
              item.name.toLowerCase() !== currentLocation?.toLowerCase()
          )
          .slice(0, 8);

        const savedPoints = await Promise.all(
          saved.map(async (item) => {
            try {
              const result = await geocodeCity(item.name);
              return {
                ...result,
                name: item.name,
                state: item.state || result.state,
                isCurrent: false,
              };
            } catch {
              return null;
            }
          })
        );

        points.push(...savedPoints.filter(Boolean));

        if (cancelled) return;

        const bounds = [];

        points.forEach((point) => {
          const marker = L.marker([
            point.latitude,
            point.longitude,
          ]).bindPopup(`
            <div class="weather-popup">
              <strong>${point.isCurrent ? "📍 " : ""}${point.name}</strong>
              ${point.state ? `<span>${point.state}</span>` : ""}
              <b>${
                point.isCurrent
                  ? getLayerValue(mapLayer, currentWeather)
                  : "Saved location"
              }</b>
            </div>
          `);

          marker.on("click", () => {
            if (!point.isCurrent) onSelectLocation?.(point.name);
          });

          marker.addTo(markerLayer);
          bounds.push([point.latitude, point.longitude]);

          if (point.isCurrent) marker.openPopup();
        });

        if (points.length === 1) {
          map.setView(
            [points[0].latitude, points[0].longitude],
            currentCoordinates ? 13 : 8,
            { animate: true }
          );
        } else if (bounds.length > 1) {
          map.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 8,
            animate: true,
          });
        } else {
          map.setView(INDIA_CENTER, 5);
        }

        setTimeout(() => map.invalidateSize(), 150);
      } catch (error) {
        if (!cancelled) {
          console.error("Weather map error:", error);
          setMapError(
            "Unable to load the map location. Try Search or My Location."
          );
          map.setView(INDIA_CENTER, 5);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    drawLocations();

    return () => {
      cancelled = true;
    };
  }, [currentLocation, currentCoordinates, locations, currentWeather, mapLayer]);

  async function handleSearch() {
    const query = locationSearch?.trim();
    if (!query) return;

    try {
      setMapError("");
      const result = await geocodeCity(query);

      // This changes the global current location, so Dashboard, Forecast,
      // Climate, Agriculture and Chat use the searched location too.
      onSelectLocation?.(result.name);
      setLocationSearch?.("");
    } catch (error) {
      setMapError(
        `Location "${query}" was not found. Try a city or district name.`
      );
    }
  }

  return (
    <div className="page-section weather-map-page">
      <div className="page-title">
        <span className="eyebrow">LIVE LOCATION MAP</span>
        <h1>Weather Map 🗺️</h1>
        <p className="page-description">
          Real India map with GPS location, search, saved locations and live
          weather data.
        </p>
      </div>

      <div className="map-toolbar">
        <input
          placeholder="Search city, district or location..."
          value={locationSearch || ""}
          onChange={(e) => setLocationSearch?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />

        <button onClick={handleSearch}>Search</button>

        <button onClick={onUseMyLocation}>📍 My Location</button>
      </div>

      {mapError && <div className="map-error">{mapError}</div>}

      <div className="map-layout real-map-layout">
        <div className="weather-map real-weather-map">
          {loading && (
            <div className="map-loading-overlay">
              <div className="loading-spinner"></div>
              <span>Loading India map...</span>
            </div>
          )}
          <div ref={mapRef} className="leaflet-map" />
        </div>

        <div className="map-sidebar">
          <h3>Weather Layers</h3>

          {layers.map((layer) => (
            <button
              key={layer}
              className={
                mapLayer === layer
                  ? "layer-button active"
                  : "layer-button"
              }
              onClick={() => setMapLayer?.(layer)}
            >
              {layer === "Temperature" && "🌡️"}
              {layer === "Rain" && "🌧️"}
              {layer === "Wind" && "💨"}
              {layer === "Clouds" && "☁️"}
              {layer === "Pressure" && "🔵"} {layer}
            </button>
          ))}

          <div className="map-current-location-card">
            <span>Current location</span>
            <strong>📍 {currentLocation}</strong>

            {currentCoordinates && (
              <small>
                GPS: {Number(currentCoordinates.latitude).toFixed(4)},{" "}
                {Number(currentCoordinates.longitude).toFixed(4)}
              </small>
            )}

            <button onClick={onUseMyLocation}>Use GPS Location</button>
          </div>

          <div className="map-legend">
            <h4>Selected Layer</h4>
            <p>
              <strong>{mapLayer}</strong>
            </p>
            <p className="legend-help">
              Click a saved-location marker to make it the global current
              location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
