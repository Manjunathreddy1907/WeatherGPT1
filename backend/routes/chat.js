const express = require("express");

const router = express.Router();

/*
=========================================================
WEATHERGPT LIVE WEATHER CHAT
=========================================================

Frontend sends:

{
  message: "Will it rain later?",
  location: "Bengaluru",
  weather: {
    temperature: 26,
    feelsLike: 27,
    humidity: 72,
    wind: 14,
    windDirection: "SW",
    rainChance: 45,
    uv: 5,
    pressure: 1012,
    visibility: 10,
    cloudCover: 60,
    condition: "Partly cloudy",
    weatherCode: 2
  }
}

The backend uses the LIVE weather values to answer.
=========================================================
*/


// =========================================================
// HELPERS
// =========================================================

function toNumber(value, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();

  return text || fallback;
}


// =========================================================
// WEATHER CODE -> CONDITION
// =========================================================

function getWeatherCondition(code) {
  const c = Number(code);

  if (c === 0) return "Clear sky";

  if (c === 1) return "Mainly clear";

  if (c === 2) return "Partly cloudy";

  if (c === 3) return "Overcast";

  if (c === 45 || c === 48) return "Foggy";

  if ([51, 53, 55, 56, 57].includes(c)) {
    return "Drizzle";
  }

  if ([61, 63, 65, 66, 67].includes(c)) {
    return "Rainy";
  }

  if ([71, 73, 75, 77].includes(c)) {
    return "Snowy";
  }

  if ([80, 81, 82].includes(c)) {
    return "Rain showers";
  }

  if ([95, 96, 99].includes(c)) {
    return "Thunderstorm";
  }

  return "Current weather conditions";
}


// =========================================================
// CREATE CURRENT WEATHER SUMMARY
// =========================================================

function createWeatherSummary(
  city,
  weather
) {
  const temperature = toNumber(
    weather.temperature
  );

  const feelsLike = toNumber(
    weather.feelsLike,
    temperature
  );

  const humidity = toNumber(
    weather.humidity
  );

  const rainChance = toNumber(
    weather.rainChance
  );

  const wind = toNumber(
    weather.wind
  );

  const condition = cleanText(
    weather.condition,
    getWeatherCondition(
      weather.weatherCode
    )
  );

  return (
    `Right now in ${city}, it's ${temperature}°C ` +
    `with ${condition}. It feels like ${feelsLike}°C. ` +
    `Humidity is ${humidity}%, rain chance is ${rainChance}%, ` +
    `and wind is ${wind} km/h.`
  );
}


// =========================================================
// GET UPCOMING FORECAST FROM FRONTEND DATA
// =========================================================

function getUpcomingForecast(
  forecast
) {
  if (!Array.isArray(forecast)) {
    return [];
  }

  return forecast
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => ({
      time: cleanText(
        item.time,
        "Upcoming"
      ),

      temperature: toNumber(
        item.temperature ??
        item.temp
      ),

      rain: toNumber(
        item.rain ??
        item.rainChance ??
        item.rain_chance
      ),

      wind: toNumber(
        item.wind ??
        item.wind_speed
      ),

      condition: cleanText(
        item.condition ??
        item.weather,
        getWeatherCondition(
          item.weatherCode ??
          item.weather_code
        )
      ),
    }));
}


// =========================================================
// GET TOMORROW FROM DAILY FORECAST
// =========================================================

function getTomorrow(
  dailyForecast
) {
  if (!Array.isArray(dailyForecast)) {
    return null;
  }

  if (dailyForecast.length < 2) {
    return null;
  }

  const tomorrow =
    dailyForecast[1];

  return {
    day: cleanText(
      tomorrow.day,
      "Tomorrow"
    ),

    high: toNumber(
      tomorrow.high ??
      tomorrow.maxTemperature
    ),

    low: toNumber(
      tomorrow.low ??
      tomorrow.minTemperature
    ),

    rain: toNumber(
      tomorrow.rain ??
      tomorrow.rainChance ??
      tomorrow.precipitationProbability
    ),

    wind: toNumber(
      tomorrow.wind
    ),

    condition: cleanText(
      tomorrow.condition ??
      tomorrow.weather,
      "Current weather conditions"
    ),
  };
}


// =========================================================
// GENERATE WEATHER RESPONSE
// =========================================================

function generateWeatherReply({
  question,
  city,
  weather,
  forecast,
  dailyForecast,
}) {
  const q =
    question.toLowerCase().trim();

  // -------------------------------------------------------
  // LIVE WEATHER VALUES
  // -------------------------------------------------------

  const temperature =
    toNumber(weather.temperature);

  const feelsLike =
    toNumber(
      weather.feelsLike,
      temperature
    );

  const humidity =
    toNumber(weather.humidity);

  const rainChance =
    toNumber(weather.rainChance);

  const wind =
    toNumber(weather.wind);

  const uv =
    toNumber(weather.uv);

  const pressure =
    toNumber(weather.pressure);

  const visibility =
    toNumber(weather.visibility);

  const cloudCover =
    toNumber(weather.cloudCover);

  const condition =
    cleanText(
      weather.condition,
      getWeatherCondition(
        weather.weatherCode
      )
    );

  const upcoming =
    getUpcomingForecast(
      forecast
    );

  const tomorrow =
    getTomorrow(
      dailyForecast
    );


  // =======================================================
  // GREETING
  // =======================================================

  if (
    /^(hi|hii|hello|hey|helo|good morning|good afternoon|good evening|good night)\b/
      .test(q)
  ) {
    return (
      `Hey! 👋 I'm WeatherGPT. ` +
      `Right now in ${city}, it's ${temperature}°C ` +
      `with ${condition}. ` +
      `What would you like to know? 😊`
    );
  }


  // =======================================================
  // THANK YOU
  // =======================================================

  if (
    q === "thanks" ||
    q.includes("thank you") ||
    q.includes("thanks")
  ) {
    return (
      `You're welcome! 😊 ` +
      `I'm always here to help with the weather in ${city}.`
    );
  }


  // =======================================================
  // CURRENT WEATHER
  // =======================================================

  if (
    q === "weather" ||
    q.includes("current weather") ||
    q.includes("how is the weather") ||
    q.includes("how's the weather") ||
    q.includes("today weather") ||
    q.includes("today's weather")
  ) {
    return createWeatherSummary(
      city,
      weather
    );
  }


  // =======================================================
  // TEMPERATURE
  // =======================================================

  if (
    q.includes("temperature") ||
    q.includes("how hot") ||
    q.includes("how cold") ||
    q.includes("degrees") ||
    q.includes("feels like")
  ) {
    return (
      `It's ${temperature}°C in ${city} right now. ` +
      `It feels like ${feelsLike}°C, and the weather is ${condition}.`
    );
  }


  // =======================================================
  // RAIN
  // =======================================================

  if (
    q.includes("rain") ||
    q.includes("raining") ||
    q.includes("umbrella") ||
    q.includes("precipitation")
  ) {
    if (rainChance >= 70) {
      return (
        `Yes ☔, rain is quite likely in ${city}. ` +
        `The current rain chance is ${rainChance}%. ` +
        `I'd definitely carry an umbrella.`
      );
    }

    if (rainChance >= 40) {
      return (
        `There's a moderate chance of rain in ${city}, ` +
        `around ${rainChance}%. ` +
        `I'd keep an umbrella nearby if you're going out.`
      );
    }

    const rainyHour =
      upcoming.find(
        (item) => item.rain >= 50
      );

    if (rainyHour) {
      return (
        `The current rain chance is only ${rainChance}%, ` +
        `but rain becomes more likely around ${rainyHour.time}, ` +
        `where the chance is about ${rainyHour.rain}%.`
      );
    }

    return (
      `Rain doesn't look like a major concern right now. ` +
      `The current chance is ${rainChance}%.`
    );
  }


  // =======================================================
  // NEXT FEW HOURS
  // =======================================================

  if (
    q.includes("later") ||
    q.includes("next hour") ||
    q.includes("next few hours") ||
    q.includes("hourly") ||
    q.includes("this evening") ||
    q.includes("tonight")
  ) {
    if (!upcoming.length) {
      return (
        `I don't have enough hourly forecast data right now. ` +
        `Please refresh the weather and try again.`
      );
    }

    const summary =
      upcoming
        .slice(0, 6)
        .map(
          (item) =>
            `${item.time}: ${item.temperature}°C, ` +
            `${item.condition}, ${item.rain}% rain`
        )
        .join(" • ");

    return (
      `Sure 😊 Here are the upcoming hours in ${city}: ` +
      `${summary}.`
    );
  }


  // =======================================================
  // TOMORROW
  // =======================================================

  if (
    q.includes("tomorrow") ||
    q.includes("next day")
  ) {
    if (!tomorrow) {
      return (
        `I don't have tomorrow's forecast available right now. ` +
        `Please refresh and try again.`
      );
    }

    return (
      `Tomorrow in ${city} looks like ${tomorrow.condition}. ` +
      `The temperature may reach around ${tomorrow.high}°C ` +
      `and drop to about ${tomorrow.low}°C. ` +
      `The rain chance is around ${tomorrow.rain}%. ` +
      `${
        tomorrow.rain >= 50
          ? "I'd keep an umbrella ready. ☔"
          : "Rain doesn't look like the main concern."
      }`
    );
  }


  // =======================================================
  // CLOTHING
  // =======================================================

  if (
    q.includes("wear") ||
    q.includes("clothes") ||
    q.includes("outfit") ||
    q.includes("dress")
  ) {
    if (rainChance >= 50) {
      return (
        `I'd go with light, comfortable clothes and carry ` +
        `an umbrella. ☔ It's ${temperature}°C right now ` +
        `and the rain chance is ${rainChance}%.`
      );
    }

    if (temperature >= 32) {
      return (
        `It's quite warm at ${temperature}°C. ` +
        `Light, breathable cotton clothes would be a good choice.`
      );
    }

    if (temperature <= 20) {
      return (
        `It's relatively cool at ${temperature}°C. ` +
        `A light jacket or full-sleeve clothing should be comfortable.`
      );
    }

    return (
      `At ${temperature}°C, light and comfortable clothing ` +
      `should work well today. 😊`
    );
  }


  // =======================================================
  // TRAVEL
  // =======================================================

  if (
    q.includes("travel") ||
    q.includes("trip") ||
    q.includes("journey") ||
    q.includes("drive") ||
    q.includes("outside") ||
    q.includes("go out")
  ) {
    if (
      rainChance >= 70 ||
      condition.toLowerCase().includes(
        "thunderstorm"
      )
    ) {
      return (
        `I'd be careful about travelling right now. ` +
        `${city} has ${condition} conditions with a ` +
        `${rainChance}% rain chance. ` +
        `Avoid unnecessary outdoor travel during severe weather.`
      );
    }

    if (
      rainChance >= 40 ||
      wind >= 35 ||
      (visibility > 0 && visibility < 5)
    ) {
      return (
        `Travel is possible, but I'd use some caution. ` +
        `It's ${temperature}°C with ${condition}, ` +
        `${rainChance}% rain chance and ${wind} km/h wind.`
      );
    }

    return (
      `Travel looks reasonably comfortable in ${city} right now. ` +
      `It's ${temperature}°C with ${condition}, ` +
      `${rainChance}% rain chance and ${wind} km/h wind. 🚗`
    );
  }


  // =======================================================
  // HUMIDITY
  // =======================================================

  if (
    q.includes("humidity") ||
    q.includes("humid")
  ) {
    if (humidity >= 75) {
      return (
        `Humidity is ${humidity}% in ${city}. ` +
        `That's quite humid, so it may feel warmer than the actual temperature.`
      );
    }

    if (humidity >= 50) {
      return (
        `Humidity is ${humidity}% in ${city} right now. ` +
        `The air is moderately humid.`
      );
    }

    return (
      `Humidity is ${humidity}% in ${city} right now. ` +
      `The air is relatively dry.`
    );
  }


  // =======================================================
  // WIND
  // =======================================================

  if (
    q.includes("wind") ||
    q.includes("windy")
  ) {
    return (
      `The wind is around ${wind} km/h in ${city}.`
    );
  }


  // =======================================================
  // UV
  // =======================================================

  if (
    q.includes("uv") ||
    q.includes("sunlight") ||
    q.includes("sun")
  ) {
    if (uv >= 8) {
      return (
        `The UV index is ${uv}, which is very high. ` +
        `Good sun protection is recommended. ☀️`
      );
    }

    if (uv >= 6) {
      return (
        `The UV index is ${uv}. ` +
        `Sun protection is recommended if you're outside for a while.`
      );
    }

    if (uv >= 3) {
      return (
        `The UV index is ${uv}. ` +
        `Some sun protection would be sensible outdoors.`
      );
    }

    return (
      `The UV index is ${uv}, which is relatively low right now.`
    );
  }


  // =======================================================
  // VISIBILITY
  // =======================================================

  if (
    q.includes("visibility") ||
    q.includes("fog")
  ) {
    return (
      `Visibility in ${city} is around ${visibility} km right now.`
    );
  }


  // =======================================================
  // PRESSURE
  // =======================================================

  if (q.includes("pressure")) {
    return (
      `Atmospheric pressure in ${city} is around ${pressure} hPa.`
    );
  }


  // =======================================================
  // CLOUDS
  // =======================================================

  if (
    q.includes("cloud") ||
    q.includes("cloudy")
  ) {
    return (
      `Cloud cover in ${city} is around ${cloudCover}%. ` +
      `The current condition is ${condition}.`
    );
  }


  // =======================================================
  // FARMING
  // =======================================================

  if (
    q.includes("farm") ||
    q.includes("farming") ||
    q.includes("crop") ||
    q.includes("agriculture") ||
    q.includes("irrigation") ||
    q.includes("soil") ||
    q.includes("plant")
  ) {
    return (
      `For farming in ${city}, the current weather is ` +
      `${temperature}°C with ${condition}, ${humidity}% humidity ` +
      `and a ${rainChance}% rain chance. 🌱 ` +
      `For crop-specific advice, you can use the Agriculture section.`
    );
  }


  // =======================================================
  // WEATHER RISK
  // =======================================================

  if (
    q.includes("risk") ||
    q.includes("danger") ||
    q.includes("warning") ||
    q.includes("alert") ||
    q.includes("storm") ||
    q.includes("thunder")
  ) {
    if (
      rainChance >= 70 ||
      condition.toLowerCase().includes(
        "thunderstorm"
      )
    ) {
      return (
        `There is a higher weather concern in ${city} right now. ` +
        `Conditions are ${condition} with a ${rainChance}% rain chance. ` +
        `Avoid unnecessary outdoor activity.`
      );
    }

    if (
      rainChance >= 40 ||
      wind >= 35
    ) {
      return (
        `There is a moderate weather concern in ${city}. ` +
        `Rain chance is ${rainChance}% and wind is ${wind} km/h.`
      );
    }

    return (
      `Weather risk currently looks relatively low in ${city}. ` +
      `It's ${temperature}°C with ${condition}.`
    );
  }


  // =======================================================
  // GENERAL FRIENDLY RESPONSE
  // =======================================================

  return (
    `Sure 😊 I'm checking the latest weather for ${city}. ` +
    `Right now it's ${temperature}°C with ${condition} and ` +
    `a ${rainChance}% rain chance. ` +
    `You can ask me things like "Will it rain later?", ` +
    `"What should I wear?", "Is it safe to travel?", ` +
    `or "What about tomorrow?"`
  );
}


/* =========================================================
   POST /api/chat
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      message,
      location,
      weather,
      forecast,
      dailyForecast,
    } = req.body || {};

    if (
      !message ||
      !String(message).trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Please enter a question.",
      });
    }

    const city = cleanText(
      location ||
        weather?.location,
      "Bengaluru"
    );

    const currentWeather = {
      ...weather,

      location: city,

      temperature: toNumber(
        weather?.temperature
      ),

      feelsLike: toNumber(
        weather?.feelsLike ??
        weather?.feels_like,
        weather?.temperature
      ),

      humidity: toNumber(
        weather?.humidity
      ),

      rainChance: toNumber(
        weather?.rainChance ??
        weather?.rain_chance
      ),

      wind: toNumber(
        weather?.wind ??
        weather?.wind_speed
      ),

      windDirection:
        weather?.windDirection || "",

      uv: toNumber(
        weather?.uv ??
        weather?.uv_index
      ),

      pressure: toNumber(
        weather?.pressure
      ),

      visibility: toNumber(
        weather?.visibility
      ),

      cloudCover: toNumber(
        weather?.cloudCover
      ),

      condition: cleanText(
        weather?.condition,
        getWeatherCondition(
          weather?.weatherCode
        )
      ),
    };

    const reply =
      generateWeatherReply({
        question:
          String(message),
        city,
        weather:
          currentWeather,
        forecast,
        dailyForecast,
      });

    return res.json({
      success: true,

      reply,

      location: city,

      weatherUsed: {
        temperature:
          currentWeather.temperature,

        feelsLike:
          currentWeather.feelsLike,

        humidity:
          currentWeather.humidity,

        rainChance:
          currentWeather.rainChance,

        wind:
          currentWeather.wind,

        uv:
          currentWeather.uv,

        condition:
          currentWeather.condition,

        weatherCode:
          currentWeather.weatherCode,
      },

      timestamp:
        new Date().toISOString(),
    });

  } catch (error) {
    console.error(
      "Chat API error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to process your weather question.",
    });
  }
});


module.exports = router;