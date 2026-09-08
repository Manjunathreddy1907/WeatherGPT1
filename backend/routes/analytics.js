const express = require("express");

const router = express.Router();

// ============================================================
// COMMON CITY COORDINATES
// ============================================================

const CITY_COORDINATES = {
  bengaluru: {
    latitude: 12.9716,
    longitude: 77.5946,
    state: "Karnataka",
    country: "IN",
  },

  bangalore: {
    latitude: 12.9716,
    longitude: 77.5946,
    state: "Karnataka",
    country: "IN",
  },

  hyderabad: {
    latitude: 17.385,
    longitude: 78.4867,
    state: "Telangana",
    country: "IN",
  },

  visakhapatnam: {
    latitude: 17.6868,
    longitude: 83.2185,
    state: "Andhra Pradesh",
    country: "IN",
  },

  vijayawada: {
    latitude: 16.5062,
    longitude: 80.648,
    state: "Andhra Pradesh",
    country: "IN",
  },

  chennai: {
    latitude: 13.0827,
    longitude: 80.2707,
    state: "Tamil Nadu",
    country: "IN",
  },

  mumbai: {
    latitude: 19.076,
    longitude: 72.8777,
    state: "Maharashtra",
    country: "IN",
  },

  delhi: {
    latitude: 28.6139,
    longitude: 77.209,
    state: "Delhi",
    country: "IN",
  },

  kolkata: {
    latitude: 22.5726,
    longitude: 88.3639,
    state: "West Bengal",
    country: "IN",
  },

  pune: {
    latitude: 18.5204,
    longitude: 73.8567,
    state: "Maharashtra",
    country: "IN",
  },

  ahmedabad: {
    latitude: 23.0225,
    longitude: 72.5714,
    state: "Gujarat",
    country: "IN",
  },

  jaipur: {
    latitude: 26.9124,
    longitude: 75.7873,
    state: "Rajasthan",
    country: "IN",
  },

  kochi: {
    latitude: 9.9312,
    longitude: 76.2673,
    state: "Kerala",
    country: "IN",
  },

  thiruvananthapuram: {
    latitude: 8.5241,
    longitude: 76.9366,
    state: "Kerala",
    country: "IN",
  },

  lucknow: {
    latitude: 26.8467,
    longitude: 80.9462,
    state: "Uttar Pradesh",
    country: "IN",
  },

  bhubaneswar: {
    latitude: 20.2961,
    longitude: 85.8245,
    state: "Odisha",
    country: "IN",
  },

  patna: {
    latitude: 25.5941,
    longitude: 85.1376,
    state: "Bihar",
    country: "IN",
  },

  chandigarh: {
    latitude: 30.7333,
    longitude: 76.7794,
    state: "Chandigarh",
    country: "IN",
  },

  nagpur: {
    latitude: 21.1458,
    longitude: 79.0882,
    state: "Maharashtra",
    country: "IN",
  },

  surat: {
    latitude: 21.1702,
    longitude: 72.8311,
    state: "Gujarat",
    country: "IN",
  },

  indore: {
    latitude: 22.7196,
    longitude: 75.8577,
    state: "Madhya Pradesh",
    country: "IN",
  },
};

// ============================================================
// GET COORDINATES
// ============================================================

async function getCoordinates(city) {
  const key = city.trim().toLowerCase();

  // First use local coordinates.
  if (CITY_COORDINATES[key]) {
    return {
      name: city,
      ...CITY_COORDINATES[key],
    };
  }

  // If it is not in our list, try Open-Meteo geocoding.
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const geoUrl =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(city)}` +
      `&count=1` +
      `&language=en` +
      `&format=json`;

    const response = await fetch(geoUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Geocoding service unavailable.");
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`Location "${city}" not found.`);
    }

    const place = data.results[0];

    return {
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      state: place.admin1 || "",
      country: place.country_code || "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// ANALYTICS ROUTE
// ============================================================

router.get("/", async (req, res) => {
  try {
    const city = req.query.city || "Bengaluru";

    let days = Number(req.query.days) || 7;

    if (![7, 30, 365].includes(days)) {
      days = 7;
    }

    console.log(
      `📊 Analytics request: ${city} - ${days} days`
    );

    // ========================================================
    // 1. GET LOCATION
    // ========================================================

    const place = await getCoordinates(city);

    console.log(
      `📍 Coordinates: ${place.latitude}, ${place.longitude}`
    );

    // ========================================================
    // 2. DATE RANGE
    // ========================================================

    const endDate = new Date();

    // Use yesterday because today's historical data may not
    // be complete yet.
    endDate.setDate(endDate.getDate() - 1);

    const startDate = new Date(endDate);

    startDate.setDate(
      startDate.getDate() - (days - 1)
    );

    const formatDate = (date) => {
      return date.toISOString().slice(0, 10);
    };

    const start = formatDate(startDate);
    const end = formatDate(endDate);

    console.log(
      `📅 Historical range: ${start} → ${end}`
    );

    // ========================================================
    // 3. OPEN-METEO ARCHIVE
    // ========================================================

    const archiveUrl =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${place.latitude}` +
      `&longitude=${place.longitude}` +
      `&start_date=${start}` +
      `&end_date=${end}` +
      `&daily=` +
      `temperature_2m_mean,` +
      `temperature_2m_max,` +
      `temperature_2m_min,` +
      `precipitation_sum,` +
      `relative_humidity_2m_mean,` +
      `wind_speed_10m_max` +
      `&timezone=auto`;

    const archiveController = new AbortController();

    const archiveTimeout = setTimeout(() => {
      archiveController.abort();
    }, 30000);

    let archiveResponse;

    try {
      archiveResponse = await fetch(archiveUrl, {
        signal: archiveController.signal,
      });
    } finally {
      clearTimeout(archiveTimeout);
    }

    if (!archiveResponse.ok) {
      const errorText = await archiveResponse.text();

      console.error(
        "Open-Meteo archive error:",
        errorText
      );

      throw new Error(
        "Historical weather service is unavailable."
      );
    }

    const archiveData = await archiveResponse.json();

    if (!archiveData.daily?.time) {
      throw new Error(
        "Historical weather data is unavailable."
      );
    }

    const daily = archiveData.daily;

    // ========================================================
    // 4. DAILY ANALYTICS
    // ========================================================

    const dailyAnalytics = daily.time.map(
      (date, index) => ({
        date,

        temperature:
          daily.temperature_2m_mean?.[index] ?? 0,

        high:
          daily.temperature_2m_max?.[index] ?? 0,

        low:
          daily.temperature_2m_min?.[index] ?? 0,

        rainfall:
          daily.precipitation_sum?.[index] ?? 0,

        humidity:
          daily.relative_humidity_2m_mean?.[index] ?? 0,

        wind:
          daily.wind_speed_10m_max?.[index] ?? 0,
      })
    );

    // ========================================================
    // 5. 7 DAYS / 30 DAYS
    // ========================================================

    if (days <= 30) {
      return res.json({
        city: place.name,
        state: place.state,
        country: place.country,

        period: {
          days,
          start,
          end,
          type: "daily",
        },

        analytics: dailyAnalytics,
      });
    }

    // ========================================================
    // 6. 365 DAYS → MONTHLY
    // ========================================================

    const monthlyMap = {};

    dailyAnalytics.forEach((item) => {
      const monthKey = item.date.slice(0, 7);

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          date: monthKey,

          temperatures: [],
          highs: [],
          lows: [],

          rainfall: 0,

          humidities: [],
          winds: [],
        };
      }

      const month = monthlyMap[monthKey];

      if (Number.isFinite(Number(item.temperature))) {
        month.temperatures.push(
          Number(item.temperature)
        );
      }

      if (Number.isFinite(Number(item.high))) {
        month.highs.push(
          Number(item.high)
        );
      }

      if (Number.isFinite(Number(item.low))) {
        month.lows.push(
          Number(item.low)
        );
      }

      if (Number.isFinite(Number(item.rainfall))) {
        month.rainfall += Number(item.rainfall);
      }

      if (Number.isFinite(Number(item.humidity))) {
        month.humidities.push(
          Number(item.humidity)
        );
      }

      if (Number.isFinite(Number(item.wind))) {
        month.winds.push(
          Number(item.wind)
        );
      }
    });

    // ========================================================
    // 7. AVERAGE
    // ========================================================

    const average = (values) => {
      if (!values.length) {
        return 0;
      }

      return (
        values.reduce(
          (sum, value) => sum + value,
          0
        ) / values.length
      );
    };

    // ========================================================
    // 8. MONTHLY RESULT
    // ========================================================

    const monthlyAnalytics = Object.values(
      monthlyMap
    )
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      .map((month) => ({
        date: month.date,

        temperature: Math.round(
          average(month.temperatures)
        ),

        high: month.highs.length
          ? Math.max(...month.highs)
          : 0,

        low: month.lows.length
          ? Math.min(...month.lows)
          : 0,

        rainfall: Number(
          month.rainfall.toFixed(1)
        ),

        humidity: Math.round(
          average(month.humidities)
        ),

        wind: Math.round(
          average(month.winds)
        ),
      }));

    // ========================================================
    // 9. SEND RESPONSE
    // ========================================================

    console.log(
      `✅ Analytics ready: ${monthlyAnalytics.length} months`
    );

    res.json({
      city: place.name,
      state: place.state,
      country: place.country,

      period: {
        days,
        start,
        end,
        type: "monthly",
      },

      analytics: monthlyAnalytics,
    });

  } catch (error) {
    console.error(
      "❌ Analytics error:",
      error.message
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to fetch analytics data.",
    });
  }
});

module.exports = router;