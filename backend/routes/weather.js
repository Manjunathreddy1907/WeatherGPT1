const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const city = req.query.city || "Bengaluru";

    // ==========================================
    // 1. CURRENT WEATHER
    // ==========================================
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${process.env.WEATHER_API_KEY}&units=metric`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      return res.status(weatherResponse.status).json({
        error: weatherData.message || "Weather API error",
      });
    }

    const windDirection = getWindDirection(weatherData.wind?.deg);

    // ==========================================
    // 2. FORECAST - USED FOR RAIN CHANCE
    // ==========================================
    let rainChance = 0;

    try {
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
        city
      )}&appid=${process.env.WEATHER_API_KEY}&units=metric`;

      const forecastResponse = await fetch(forecastUrl);
      const forecastData = await forecastResponse.json();

      if (forecastResponse.ok && Array.isArray(forecastData.list)) {
        // Take the next 24 hours (8 x 3-hour periods)
        const next24Hours = forecastData.list.slice(0, 8);

        const chances = next24Hours.map((item) =>
          Math.round((item.pop || 0) * 100)
        );

        rainChance = chances.length > 0 ? Math.max(...chances) : 0;
      }
    } catch (forecastError) {
      console.error("Rain forecast error:", forecastError);
    }

    // ==========================================
    // 3. UV INDEX
    // ==========================================
    let uvIndex = 0;

    try {
      const lat = weatherData.coord?.lat;
      const lon = weatherData.coord?.lon;

      if (lat !== undefined && lon !== undefined) {
        // Open-Meteo provides current UV index using coordinates.
        const uvUrl =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}` +
          `&longitude=${lon}` +
          `&current=uv_index` +
          `&timezone=auto`;

        const uvResponse = await fetch(uvUrl);
        const uvData = await uvResponse.json();

        if (
          uvResponse.ok &&
          uvData.current &&
          uvData.current.uv_index !== undefined
        ) {
          uvIndex = Number(uvData.current.uv_index.toFixed(1));
        }
      }
    } catch (uvError) {
      console.error("UV index error:", uvError);
    }

    // ==========================================
    // 4. SEND COMPLETE WEATHER RESPONSE
    // ==========================================
    res.json({
      city: weatherData.name,
      country: weatherData.sys.country,

      temperature: weatherData.main.temp,
      feels_like: weatherData.main.feels_like,
      temp_min: weatherData.main.temp_min,
      temp_max: weatherData.main.temp_max,

      humidity: weatherData.main.humidity,
      pressure: weatherData.main.pressure,

      weather: weatherData.weather[0].description,
      weather_main: weatherData.weather[0].main,
      icon: weatherData.weather[0].icon,

      wind_speed: weatherData.wind?.speed || 0,
      wind_direction: windDirection,

      cloud_cover: weatherData.clouds?.all || 0,
      visibility: weatherData.visibility
        ? weatherData.visibility / 1000
        : 0,

      sunrise: weatherData.sys.sunrise,
      sunset: weatherData.sys.sunset,

      // NEW
      rain_chance: rainChance,
      uv_index: uvIndex,

      // Coordinates
      latitude: weatherData.coord?.lat,
      longitude: weatherData.coord?.lon,

      state: "India",
    });
  } catch (error) {
    console.error("Weather route error:", error);

    res.status(500).json({
      error: "Failed to fetch weather data",
    });
  }
});

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

  const index = Math.round(degree / 45) % 8;

  return directions[index];
}

module.exports = router;