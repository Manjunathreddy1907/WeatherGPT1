const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const city = req.query.city || "Bengaluru";

    // Get city coordinates
    const geoUrl =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}` +
      `&count=1&language=en&format=json`;

    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({
        error: "City not found",
      });
    }

    const location = geoData.results[0];

    // Get 7-day weather forecast
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max` +
      `&forecast_days=8&timezone=auto`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      return res.status(500).json({
        error: "Weather API error",
      });
    }

    // Hourly forecast
    const forecast = weatherData.hourly.time.map((time, index) => ({
      time: new Date(time).getTime() / 1000,
      temperature: weatherData.hourly.temperature_2m[index],
      rain_chance:
        weatherData.hourly.precipitation_probability[index] || 0,
      wind_speed:
        weatherData.hourly.wind_speed_10m[index] || 0,
      weather: getWeatherDescription(
        weatherData.hourly.weather_code[index]
      ),
      icon: getWeatherIcon(
        weatherData.hourly.weather_code[index]
      ),
    }));

    // Daily 7-day forecast
    const dailyForecast = weatherData.daily.time.map((date, index) => ({
      date: date,
      high: weatherData.daily.temperature_2m_max[index],
      low: weatherData.daily.temperature_2m_min[index],
      rain:
        weatherData.daily.precipitation_probability_max[index] || 0,
      wind:
        weatherData.daily.wind_speed_10m_max[index] || 0,
      condition: getWeatherDescription(
        weatherData.daily.weather_code[index]
      ),
      icon: getWeatherIcon(
        weatherData.daily.weather_code[index]
      ),
    }));

    res.json({
      version: "HOURLY-2026",
      city: location.name,
      forecast: forecast,
      dailyForecast: dailyForecast,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch forecast",
    });
  }
});

// Weather description
function getWeatherDescription(code) {
  if (code === 0) return "Clear Sky";
  if (code === 1 || code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rainy";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Thunderstorm";

  return "Unknown";
}

// Weather icons
function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";

  return "🌤️";
}

module.exports = router;