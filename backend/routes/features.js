const express = require("express");

const router = express.Router();

/* =========================================================
   LOCATIONS
========================================================= */

let locations = [
  {
    id: 1,
    name: "Bengaluru",
    state: "Karnataka",
    temp: 28,
    condition: "Partly Cloudy",
    icon: "🌤️",
    high: 30,
    low: 21,
    favorite: true,
  },
  {
    id: 2,
    name: "Hyderabad",
    state: "Telangana",
    temp: 30,
    condition: "Sunny",
    icon: "☀️",
    high: 32,
    low: 23,
    favorite: false,
  },
  {
    id: 3,
    name: "Visakhapatnam",
    state: "Andhra Pradesh",
    temp: 29,
    condition: "Cloudy",
    icon: "☁️",
    high: 31,
    low: 24,
    favorite: false,
  },
];

/* =========================================================
   NOTIFICATIONS
========================================================= */

let notifications = [
  {
    id: 1,
    title: "Moderate Rainfall Alert",
    message: "Rain may increase around 6 PM today.",
    time: "10 minutes ago",
    type: "warning",
    read: false,
  },
  {
    id: 2,
    title: "Thunderstorm Watch",
    message: "Thunderstorm activity is possible this evening.",
    time: "30 minutes ago",
    type: "danger",
    read: false,
  },
  {
    id: 3,
    title: "Weather Updated",
    message: "Latest weather information is available.",
    time: "1 hour ago",
    type: "info",
    read: true,
  },
];

/* =========================================================
   LOCATION APIs
========================================================= */

router.get("/locations", (req, res) => {
  res.json({
    success: true,
    locations,
  });
});

router.post("/locations", (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Location name is required.",
      });
    }

    const cleanName = name.trim();

    const exists = locations.some(
      (item) =>
        item.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({
        success: false,
        error: "Location already exists.",
      });
    }

    const newLocation = {
      id:
        locations.length > 0
          ? Math.max(...locations.map((item) => item.id)) + 1
          : 1,
      name: cleanName,
      state: "India",
      temp: 0,
      condition: "Loading...",
      icon: "🌤️",
      high: 0,
      low: 0,
      favorite: false,
    };

    locations.push(newLocation);

    res.status(201).json({
      success: true,
      message: "Location added successfully.",
      location: newLocation,
    });
  } catch (error) {
    console.error("Add location error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to add location.",
    });
  }
});

router.patch("/locations/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const location = locations.find((item) => item.id === id);

    if (!location) {
      return res.status(404).json({
        success: false,
        error: "Location not found.",
      });
    }

    const {
      favorite,
      name,
      temp,
      condition,
      icon,
      high,
      low,
    } = req.body;

    if (favorite !== undefined) {
      location.favorite = Boolean(favorite);
    }

    if (name !== undefined && String(name).trim()) {
      location.name = String(name).trim();
    }

    if (temp !== undefined) location.temp = Number(temp);
    if (condition !== undefined) location.condition = condition;
    if (icon !== undefined) location.icon = icon;
    if (high !== undefined) location.high = Number(high);
    if (low !== undefined) location.low = Number(low);

    res.json({
      success: true,
      message: "Location updated successfully.",
      location,
    });
  } catch (error) {
    console.error("Update location error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to update location.",
    });
  }
});

router.delete("/locations/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!locations.some((item) => item.id === id)) {
      return res.status(404).json({
        success: false,
        error: "Location not found.",
      });
    }

    locations = locations.filter((item) => item.id !== id);

    res.json({
      success: true,
      message: "Location deleted successfully.",
    });
  } catch (error) {
    console.error("Delete location error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to delete location.",
    });
  }
});

/* =========================================================
   NOTIFICATION APIs
========================================================= */

router.get("/notifications", (req, res) => {
  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  res.json({
    success: true,
    notifications,
    unreadCount,
  });
});

router.patch("/notifications/:id/read", (req, res) => {
  try {
    const id = Number(req.params.id);

    const notification = notifications.find(
      (item) => item.id === id
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found.",
      });
    }

    notification.read = true;

    res.json({
      success: true,
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    console.error("Notification read error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to update notification.",
    });
  }
});

router.post("/notifications/read-all", (req, res) => {
  notifications = notifications.map((item) => ({
    ...item,
    read: true,
  }));

  res.json({
    success: true,
    message: "All notifications marked as read.",
    notifications,
  });
});

/* =========================================================
   AGRICULTURE RECOMMENDATION API
========================================================= */

router.post("/agriculture/recommendation", (req, res) => {
  try {
    const {
      location = "Bengaluru",
      crop = "Tomato",
      soil = "Loamy",
      season = "Kharif",
    } = req.body;

    const cropKey = String(crop).trim().toLowerCase();
    const soilKey = String(soil).trim().toLowerCase();
    const seasonKey = String(season).trim().toLowerCase();

    const soilProfiles = {
      loamy: {
        water: "Medium",
        irrigation: "Every 2-3 days",
        condition:
          "Balanced moisture conditions are generally suitable for cultivation in loamy soil.",
        tip:
          "Maintain balanced soil moisture and good drainage.",
      },
      clay: {
        water: "Low",
        irrigation: "Every 3-5 days",
        condition:
          "Clay soil holds moisture for longer, so rainy or humid conditions can increase waterlogging risk.",
        tip:
          "Ensure good drainage and avoid over-irrigation.",
      },
      sandy: {
        water: "High",
        irrigation: "Every 1-2 days",
        condition:
          "Sandy soil drains quickly, so warm or dry conditions can cause faster moisture loss.",
        tip:
          "Use frequent light irrigation and improve organic matter.",
      },
      "black soil": {
        water: "Medium",
        irrigation: "Every 3-4 days",
        condition:
          "Black soil retains moisture well, so warm weather is suitable when excess water is avoided.",
        tip:
          "Avoid excessive irrigation after rainfall.",
      },
      "red soil": {
        water: "Medium-High",
        irrigation: "Every 2-3 days",
        condition:
          "Red soil can lose moisture faster during warm and dry conditions, so regular moisture monitoring is important.",
        tip:
          "Add organic matter and maintain regular irrigation.",
      },
    };

    const soilData =
      soilProfiles[soilKey] || soilProfiles.loamy;

    const seasonProfiles = {
      kharif: {
        label: "Kharif",
        modifier:
          "Monsoon rainfall can reduce the need for additional irrigation.",
      },
      rabi: {
        label: "Rabi",
        modifier:
          "Cooler conditions usually require closer monitoring of irrigation intervals.",
      },
      summer: {
        label: "Summer",
        modifier:
          "Higher heat can increase crop water demand and soil moisture loss.",
      },
    };

    const seasonData =
      seasonProfiles[seasonKey] || seasonProfiles.kharif;

    const cropProfiles = {
      tomato: {
        suitability: "High",
        sowing: "June - September",
        base:
          "Tomato generally performs well when moisture is controlled and drainage is maintained.",
        tips: [
          "Monitor fungal diseases after rainfall.",
          "Use drip irrigation when possible.",
          "Avoid irrigation immediately before heavy rain.",
        ],
      },

      rice: {
        suitability: "High",
        sowing: "June - July",
        base:
          "Rice requires higher moisture availability. Maintain suitable field water levels without unnecessary irrigation.",
        tips: [
          "Monitor field water levels.",
          "Watch for fungal and pest activity.",
          "Avoid unnecessary irrigation before heavy rainfall.",
        ],
      },

      wheat: {
        suitability: "Moderate",
        sowing: "October - December",
        base:
          "Wheat prefers cooler conditions and controlled soil moisture.",
        tips: [
          "Monitor soil moisture regularly.",
          "Avoid excessive irrigation.",
          "Watch temperature changes.",
        ],
      },

      maize: {
        suitability: "High",
        sowing: "June - August",
        base:
          "Maize performs well when moisture is maintained consistently without waterlogging.",
        tips: [
          "Maintain consistent soil moisture.",
          "Avoid standing water.",
          "Monitor rainfall before irrigation.",
        ],
      },

      groundnut: {
        suitability: soilKey === "clay" ? "Moderate" : "High",
        sowing: "June - July",
        base:
          "Groundnut benefits from well-drained soil and careful moisture management.",
        tips: [
          "Maintain good drainage.",
          "Avoid prolonged waterlogging.",
          "Monitor soil moisture during dry periods.",
        ],
      },
    };

    const cropData = cropProfiles[cropKey] || {
      suitability: "Moderate",
      sowing: "Season dependent",
      base:
        "Monitor rainfall, temperature and soil moisture before irrigation.",
      tips: [
        "Check soil moisture regularly.",
        "Avoid overwatering.",
        "Monitor weather alerts.",
      ],
    };

    let suitability = cropData.suitability;

    if (cropKey === "rice" && soilKey === "sandy") {
      suitability = "Moderate";
    }

    if (cropKey === "groundnut" && soilKey === "clay") {
      suitability = "Moderate";
    }

    const recommendation =
      `${cropData.base} ` +
      `For ${soil} soil during the ${seasonData.label} season, ` +
      `${soilData.condition} ${seasonData.modifier}`;

    res.json({
      success: true,
      location,
      crop,
      soil,
      season,
      suitability,
      irrigation: soilData.irrigation,
      water: soilData.water,
      weather:
        `${soilData.condition} ${seasonData.modifier}`,
      sowing: cropData.sowing,
      recommendation,
      tips: [...cropData.tips, soilData.tip],
    });
  } catch (error) {
    console.error(
      "Agriculture recommendation error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        "Unable to generate agriculture recommendation.",
    });
  }
});

/* =========================================================
   TRAVEL RISK API
   Based on From + To + Date + Time
========================================================= */

const getWeatherIcon = (weatherCode, isDay = 1) => {
  if (weatherCode === undefined || weatherCode === null) {
    return isDay ? "🌤️" : "🌙";
  }

  if (weatherCode === 0) return isDay ? "☀️" : "🌙";
  if ([1, 2].includes(weatherCode)) return "🌤️";
  if (weatherCode === 3) return "☁️";
  if ([45, 48].includes(weatherCode)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return "🌧️";
  if ([71, 73, 75, 77].includes(weatherCode)) return "🌨️";
  if ([80, 81, 82].includes(weatherCode)) return "🌦️";
  if ([95, 96, 99].includes(weatherCode)) return "⛈️";

  return "🌤️";
};

const getWeatherText = (weatherCode) => {
  if (weatherCode === 0) return "Clear sky";
  if ([1, 2].includes(weatherCode)) return "Partly cloudy";
  if (weatherCode === 3) return "Overcast";
  if ([45, 48].includes(weatherCode)) return "Fog";
  if ([51, 53, 55].includes(weatherCode)) return "Drizzle";
  if ([56, 57].includes(weatherCode)) return "Freezing drizzle";
  if ([61, 63, 65].includes(weatherCode)) return "Rain";
  if ([66, 67].includes(weatherCode)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(weatherCode)) return "Snow";
  if ([80, 81, 82].includes(weatherCode)) return "Rain showers";
  if ([95, 96, 99].includes(weatherCode)) return "Thunderstorm";
  return "Weather conditions";
};

const geocodeCity = async (city) => {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(city)}` +
    `&count=1` +
    `&language=en` +
    `&format=json` +
    `&countryCode=IN`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json();

  if (!response.ok || !data.results?.length) {
    throw new Error(`Location not found: ${city}`);
  }

  return data.results[0];
};

const getWeatherForLocation = async (
  place,
  date,
  time
) => {
  const requestedDateTime = `${date}T${time}:00`;
  const requested = new Date(requestedDateTime);
  const now = new Date();

  const dayDifference =
    (requested.getTime() - now.getTime()) /
    (1000 * 60 * 60 * 24);

  let url;

  // Recent past + upcoming forecast.
  if (dayDifference >= -3 && dayDifference <= 16) {
    url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${place.latitude}` +
      `&longitude=${place.longitude}` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,visibility,weather_code,is_day` +
      `&timezone=auto` +
      `&past_hours=72` +
      `&forecast_days=16`;
  } else if (dayDifference < -3) {
    // Historical forecast archive for older dates.
    url =
      `https://historical-forecast-api.open-meteo.com/v1/forecast` +
      `?latitude=${place.latitude}` +
      `&longitude=${place.longitude}` +
      `&start_date=${date}` +
      `&end_date=${date}` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,visibility,weather_code,is_day` +
      `&timezone=auto`;
  } else {
    throw new Error(
      "The selected travel date is outside the available forecast window."
    );
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json();

  if (!response.ok || !data.hourly?.time) {
    throw new Error(
      data.reason ||
        `Weather forecast unavailable for ${place.name}.`
    );
  }

  // Open-Meteo returns local-time ISO timestamps when timezone=auto.
  let index = data.hourly.time.indexOf(
    requestedDateTime
  );

  // Some responses may include seconds. Try the hour prefix.
  if (index === -1) {
    index = data.hourly.time.findIndex(
      (value) =>
        value.slice(0, 13) === requestedDateTime.slice(0, 13)
    );
  }

  if (index === -1) {
    throw new Error(
      `Weather data is unavailable for ${place.name} at ${time}.`
    );
  }

  const temperature = Number(
    data.hourly.temperature_2m[index] ?? 0
  );

  const rainProbability = Math.round(
    Number(
      data.hourly.precipitation_probability[index] ?? 0
    )
  );

  const rainAmount = Number(
    data.hourly.precipitation[index] ?? 0
  );

  const wind = Number(
    data.hourly.wind_speed_10m[index] ?? 0
  );

  const visibilityMeters = Number(
    data.hourly.visibility[index] ?? 0
  );

  const visibility = visibilityMeters
    ? visibilityMeters / 1000
    : 0;

  const weatherCode = Number(
    data.hourly.weather_code[index] ?? 0
  );

  const isDay = Number(data.hourly.is_day?.[index] ?? 1);

  return {
    city: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    temperature,
    rainProbability,
    rainAmount,
    wind,
    visibility,
    weatherCode,
    condition: getWeatherText(weatherCode),
    icon: getWeatherIcon(weatherCode, isDay),
  };
};

const calculateTravelRisk = (
  departure,
  destination
) => {
  let riskPoints = 0;
  const reasons = [];
  const recommendations = [];

  const maxRain = Math.max(
    departure.rainProbability,
    destination.rainProbability
  );

  const maxWind = Math.max(
    departure.wind,
    destination.wind
  );

  const minVisibility = Math.min(
    departure.visibility,
    destination.visibility
  );

  const hasThunderstorm =
    [95, 96, 99].includes(departure.weatherCode) ||
    [95, 96, 99].includes(destination.weatherCode);

  const hasHeavyRain =
    departure.rainProbability >= 70 ||
    destination.rainProbability >= 70 ||
    departure.rainAmount >= 5 ||
    destination.rainAmount >= 5;

  if (hasThunderstorm) {
    riskPoints += 60;
    reasons.push(
      "Thunderstorm activity is possible at the departure or destination."
    );
    recommendations.push(
      "Avoid travelling during active thunderstorms."
    );
  }

  if (maxRain >= 70) {
    riskPoints += 25;
    reasons.push(
      `High rain probability (${maxRain}%).`
    );
    recommendations.push(
      "Carry rain protection and allow extra travel time."
    );
  } else if (maxRain >= 40) {
    riskPoints += 12;
    reasons.push(
      `Moderate rain probability (${maxRain}%).`
    );
    recommendations.push(
      "Carry an umbrella and monitor rainfall."
    );
  }

  if (maxWind >= 50) {
    riskPoints += 35;
    reasons.push(
      `Strong winds up to ${Math.round(maxWind)} km/h are possible.`
    );
    recommendations.push(
      "Use extra caution, especially on highways and two-wheelers."
    );
  } else if (maxWind >= 30) {
    riskPoints += 15;
    reasons.push(
      `Breezy conditions up to ${Math.round(maxWind)} km/h.`
    );
  }

  if (minVisibility > 0 && minVisibility < 2) {
    riskPoints += 30;
    reasons.push(
      `Low visibility may reach ${minVisibility.toFixed(1)} km.`
    );
    recommendations.push(
      "Drive slowly and use headlights in low visibility."
    );
  } else if (minVisibility > 0 && minVisibility < 5) {
    riskPoints += 10;
    reasons.push("Visibility may be reduced.");
  }

  if (hasHeavyRain) {
    recommendations.push(
      "Check roads for waterlogging or flooding before departure."
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "Weather conditions are favorable at both locations."
    );
    recommendations.push(
      "Travel conditions look comfortable for the selected time."
    );
  }

  riskPoints = Math.min(100, riskPoints);

  let level;
  let icon;

  if (riskPoints >= 60) {
    level = "High Risk";
    icon = "🔴";
  } else if (riskPoints >= 30) {
    level = "With Caution";
    icon = "🟡";
  } else {
    level = "Good";
    icon = "🟢";
  }

  return {
    level,
    icon,
    score: Math.max(0, 100 - riskPoints),
    reason: reasons.join(" "),
    description:
      level === "Good"
        ? "Weather conditions look comfortable for travel at the selected date and time."
        : level === "With Caution"
        ? "Travel is possible, but weather conditions require additional caution."
        : "Weather conditions may make travel unsafe or uncomfortable at the selected time.",
    recommendations: [
      ...new Set(recommendations),
    ],
  };
};

router.post("/travel/risk", async (req, res) => {
  try {
    const {
      from = "Bengaluru",
      to = "Mysuru",
      date,
      time = "09:00",
    } = req.body;

    if (!String(from).trim()) {
      return res.status(400).json({
        success: false,
        error: "Departure location is required.",
      });
    }

    if (!String(to).trim()) {
      return res.status(400).json({
        success: false,
        error: "Destination location is required.",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Travel date is required.",
      });
    }

    if (!/^\d{2}:\d{2}$/.test(String(time))) {
      return res.status(400).json({
        success: false,
        error: "Travel time must be in HH:MM format.",
      });
    }

    const [departurePlace, destinationPlace] =
      await Promise.all([
        geocodeCity(String(from).trim()),
        geocodeCity(String(to).trim()),
      ]);

    const [departureWeather, destinationWeather] =
      await Promise.all([
        getWeatherForLocation(
          departurePlace,
          date,
          time
        ),
        getWeatherForLocation(
          destinationPlace,
          date,
          time
        ),
      ]);

    const risk = calculateTravelRisk(
      departureWeather,
      destinationWeather
    );

    res.json({
      success: true,
      from: departurePlace.name,
      to: destinationPlace.name,
      date,
      time,

      ...risk,

      departureWeather,
      destinationWeather,
    });
  } catch (error) {
    console.error("Travel risk error:", error);

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to calculate travel risk.",
    });
  }
});

/* =========================================================
   FEATURES TEST
========================================================= */

router.get("/features/test", (req, res) => {
  res.json({
    success: true,
    message: "WeatherGPT Features API is working.",
    features: [
      "locations",
      "notifications",
      "agriculture",
      "travel",
    ],
  });
});

module.exports = router;
