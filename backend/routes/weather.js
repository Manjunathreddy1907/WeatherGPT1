const express = require("express");

const router = express.Router();

// ==========================================
// WEATHER CODE → DESCRIPTION
// ==========================================
function getWeatherDescription(code) {
  const weatherCodes = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return weatherCodes[code] || "Unknown weather";
}

// ==========================================
// WEATHER CODE → MAIN CONDITION
// ==========================================
function getWeatherMain(code) {
  if (code === 0) return "Clear";

  if ([1, 2, 3].includes(code)) {
    return "Clouds";
  }

  if ([45, 48].includes(code)) {
    return "Fog";
  }

  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(
      code
    )
  ) {
    return "Rain";
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "Snow";
  }

  if ([95, 96, 99].includes(code)) {
    return "Thunderstorm";
  }

  return "Clear";
}

// ==========================================
// WEATHER ICON
// ==========================================
function getWeatherIcon(code, isDay = true) {
  if (code === 0) {
    return isDay ? "☀️" : "🌙";
  }

  if ([1, 2].includes(code)) {
    return isDay ? "🌤️" : "☁️";
  }

  if (code === 3) {
    return "☁️";
  }

  if ([45, 48].includes(code)) {
    return "🌫️";
  }

  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(
      code
    )
  ) {
    return "🌧️";
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "🌨️";
  }

  if ([95, 96, 99].includes(code)) {
    return "⛈️";
  }

  return "🌤️";
}

// ==========================================
// WIND DIRECTION
// ==========================================
function getWindDirection(degree) {
  if (degree === undefined || degree === null) {
    return "N/A";
  }

  const directions = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];

  const index = Math.round(Number(degree) / 45) % 8;

  return directions[index];
}

// ==========================================
// MAIN WEATHER ROUTE
// GET /api/weather?city=Delhi
// ==========================================
router.get("/", async (req, res) => {
  try {
    const city = String(req.query.city || "Bengaluru").trim();

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "City name is required",
      });
    }

    console.log(`Weather request received for: ${city}`);

    // ==========================================
    // 1. GEOCODING
    // ==========================================
    const geocodingUrl =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(city)}` +
      `&count=1` +
      `&language=en` +
      `&format=json`;

    const geocodingResponse = await fetch(geocodingUrl);

    if (!geocodingResponse.ok) {
      throw new Error("Unable to connect to weather location service");
    }

    const geocodingData = await geocodingResponse.json();

    if (
      !geocodingData.results ||
      geocodingData.results.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error: `Location "${city}" was not found`,
      });
    }

    const location = geocodingData.results[0];

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    const locationName = location.name || city;
    const country = location.country || "";
    const countryCode = location.country_code || "";

    const state =
      location.admin1 ||
      location.admin2 ||
      "";

    const timezone =
      location.timezone ||
      "auto";

    // ==========================================
    // 2. OPEN-METEO WEATHER
    // ==========================================
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility,uv_index,is_day` +
      `&hourly=precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
      `&timezone=${encodeURIComponent(timezone)}` +
      `&forecast_days=2`;

    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      throw new Error("Unable to fetch live weather data");
    }

    const weatherData = await weatherResponse.json();

    if (!weatherData.current) {
      throw new Error("Weather data is unavailable");
    }

    const current = weatherData.current;

    // ==========================================
    // 3. RAIN CHANCE - NEXT 24 HOURS
    // ==========================================
    let rainChance = 0;

    if (
      weatherData.hourly &&
      Array.isArray(weatherData.hourly.precipitation_probability)
    ) {
      const probabilities =
        weatherData.hourly.precipitation_probability
          .slice(0, 24)
          .filter((value) => Number.isFinite(Number(value)))
          .map((value) => Number(value));

      if (probabilities.length > 0) {
        rainChance = Math.max(...probabilities);
      }
    }

    // ==========================================
    // 4. TEMPERATURE HIGH / LOW
    // ==========================================
    let highTemperature = Number(current.temperature_2m);
    let lowTemperature = Number(current.temperature_2m);

    if (
      weatherData.daily &&
      Array.isArray(weatherData.daily.temperature_2m_max) &&
      weatherData.daily.temperature_2m_max.length > 0
    ) {
      highTemperature = Number(
        weatherData.daily.temperature_2m_max[0]
      );
    }

    if (
      weatherData.daily &&
      Array.isArray(weatherData.daily.temperature_2m_min) &&
      weatherData.daily.temperature_2m_min.length > 0
    ) {
      lowTemperature = Number(
        weatherData.daily.temperature_2m_min[0]
      );
    }

    // ==========================================
    // 5. WEATHER CONDITION
    // ==========================================
    const weatherCode = Number(current.weather_code);

    const condition =
      getWeatherDescription(weatherCode);

    const mainCondition =
      getWeatherMain(weatherCode);

    const icon =
      getWeatherIcon(
        weatherCode,
        Number(current.is_day) === 1
      );

    // ==========================================
    // 6. UV INDEX
    // ==========================================
    const uvIndex = Number(current.uv_index || 0);

    // ==========================================
    // 7. VISIBILITY
    // Open-Meteo returns meters
    // Convert to kilometers
    // ==========================================
    const visibilityMeters =
      Number(current.visibility || 0);

    const visibilityKm =
      visibilityMeters / 1000;

    // ==========================================
    // 8. SEND COMPLETE WEATHER RESPONSE
    // ==========================================
    const response = {
      success: true,

      // Location
      city: locationName,
      country,
      country_code: countryCode,
      state,

      latitude,
      longitude,

      // Current weather
      temperature: Number(current.temperature_2m),
      feels_like: Number(current.apparent_temperature),

      temp_min: lowTemperature,
      temp_max: highTemperature,

      humidity: Number(
        current.relative_humidity_2m || 0
      ),

      pressure: Number(
        current.pressure_msl || 0
      ),

      weather: condition,
      weather_main: mainCondition,
      weather_code: weatherCode,

      icon,

      // Wind
      wind_speed: Number(
        current.wind_speed_10m || 0
      ),

      wind_direction: getWindDirection(
        current.wind_direction_10m
      ),

      wind_degree: Number(
        current.wind_direction_10m || 0
      ),

      // Other weather information
      cloud_cover: Number(
        current.cloud_cover || 0
      ),

      visibility: Number(
        visibilityKm.toFixed(1)
      ),

      uv_index: Number(
        uvIndex.toFixed(1)
      ),

      rain_chance: Number(rainChance),

      precipitation: Number(
        current.precipitation || 0
      ),

      rain: Number(
        current.rain || 0
      ),

      // Sunrise / Sunset
      sunrise:
        weatherData.daily?.sunrise?.[0] || null,

      sunset:
        weatherData.daily?.sunset?.[0] || null,

      // Time information
      timezone:
        weatherData.timezone ||
        timezone,

      observation_time:
        current.time || null,
    };

    console.log(
      `Weather successfully fetched for ${locationName}: ${response.temperature}°C`
    );

    res.json(response);

  } catch (error) {
    console.error(
      "Weather route error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to fetch live weather data",
    });
  }
});

module.exports = router;