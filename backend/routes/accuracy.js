const express = require("express");

const router = express.Router();

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function metricAccuracy(predicted, actual) {
  const pairs = predicted
    .map((value, index) => [Number(value), Number(actual[index])])
    .filter(([p, a]) => Number.isFinite(p) && Number.isFinite(a));

  if (!pairs.length) return null;

  const mae =
    pairs.reduce((sum, [p, a]) => sum + Math.abs(p - a), 0) / pairs.length;

  const meanActual =
    pairs.reduce((sum, [, a]) => sum + Math.abs(a), 0) / pairs.length;

  if (meanActual === 0) return 100;

  return Number(
    clamp((1 - mae / meanActual) * 100).toFixed(1)
  );
}

function rainEventAccuracy(predicted, actual) {
  const pairs = predicted
    .map((value, index) => [Number(value), Number(actual[index])])
    .filter(([p, a]) => Number.isFinite(p) && Number.isFinite(a));

  if (!pairs.length) return null;

  const correct = pairs.filter(
    ([p, a]) => (p > 0.1) === (a > 0.1)
  ).length;

  return Number(((correct / pairs.length) * 100).toFixed(1));
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

router.get("/", async (req, res) => {
  try {
    const city = String(
      req.query.city || "Bengaluru"
    ).trim();

    const requestedDays = Math.min(
      14,
      Math.max(3, Number(req.query.days) || 7)
    );

    // ===============================
    // GEOCODING
    // ===============================

    const geoUrl =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(city)}` +
      `&count=1` +
      `&language=en` +
      `&format=json` +
      `&countryCode=IN`;

    const geoResponse = await fetch(geoUrl, {
      signal: AbortSignal.timeout(15000),
    });

    const geoData = await geoResponse.json();

    if (!geoResponse.ok || !geoData.results?.length) {
      return res.status(404).json({
        success: false,
        error: `Location "${city}" was not found.`,
      });
    }

    const location = geoData.results[0];

    // ===============================
    // DATE RANGE
    // ===============================

    const endDate = new Date();

    endDate.setUTCDate(
      endDate.getUTCDate() - 1
    );

    const startDate = new Date(endDate);

    startDate.setUTCDate(
      startDate.getUTCDate() - (requestedDays - 1)
    );

    const start = toISODate(startDate);
    const end = toISODate(endDate);

    // ===============================
    // PREVIOUS MODEL RUNS
    // 24-HOUR LEAD FORECAST
    // ===============================

    const forecastUrl =
      `https://previous-runs-api.open-meteo.com/v1/forecast` +
      `?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      `&hourly=` +
      `temperature_2m_previous_day1,` +
      `relative_humidity_2m_previous_day1,` +
      `precipitation_previous_day1,` +
      `wind_speed_10m_previous_day1` +
      `&start_date=${start}` +
      `&end_date=${end}` +
      `&timezone=auto`;

    // ===============================
    // HISTORICAL WEATHER
    // ===============================

    const actualUrl =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${location.latitude}` +
      `&longitude=${location.longitude}` +
      `&hourly=` +
      `temperature_2m,` +
      `relative_humidity_2m,` +
      `precipitation,` +
      `wind_speed_10m` +
      `&start_date=${start}` +
      `&end_date=${end}` +
      `&timezone=auto`;

    // ===============================
    // FETCH BOTH APIs
    // ===============================

    const [
      forecastResponse,
      actualResponse,
    ] = await Promise.all([
      fetch(forecastUrl, {
        signal: AbortSignal.timeout(20000),
      }),

      fetch(actualUrl, {
        signal: AbortSignal.timeout(20000),
      }),
    ]);

    const forecastData =
      await forecastResponse.json();

    const actualData =
      await actualResponse.json();

    if (!forecastResponse.ok) {
      throw new Error(
        forecastData.reason ||
          "Unable to load historical forecast runs."
      );
    }

    if (!actualResponse.ok) {
      throw new Error(
        actualData.reason ||
          "Unable to load historical weather observations."
      );
    }

    const forecastHourly =
      forecastData.hourly || {};

    const actualHourly =
      actualData.hourly || {};

    // ===============================
    // CREATE ACTUAL DATA MAP
    // ===============================

    const actualByTime = new Map(
      (actualHourly.time || []).map(
        (time, index) => [
          time,
          {
            temperature:
              actualHourly.temperature_2m?.[index],

            humidity:
              actualHourly
                .relative_humidity_2m?.[index],

            precipitation:
              actualHourly
                .precipitation?.[index],

            wind:
              actualHourly
                .wind_speed_10m?.[index],
          },
        ]
      )
    );

    // ===============================
    // ARRAYS FOR COMPARISON
    // ===============================

    const times =
      forecastHourly.time || [];

    const temperaturePredicted = [];
    const temperatureActual = [];

    const humidityPredicted = [];
    const humidityActual = [];

    const windPredicted = [];
    const windActual = [];

    const rainPredicted = [];
    const rainActual = [];

    // ===============================
    // MATCH FORECAST WITH ACTUAL
    // ===============================

    times.forEach((time, index) => {
      const actual =
        actualByTime.get(time);

      if (!actual) return;

      const temperature =
        forecastHourly
          .temperature_2m_previous_day1?.[index];

      const humidity =
        forecastHourly
          .relative_humidity_2m_previous_day1?.[index];

      const precipitation =
        forecastHourly
          .precipitation_previous_day1?.[index];

      const wind =
        forecastHourly
          .wind_speed_10m_previous_day1?.[index];

      if (
        Number.isFinite(Number(temperature)) &&
        Number.isFinite(
          Number(actual.temperature)
        )
      ) {
        temperaturePredicted.push(
          temperature
        );

        temperatureActual.push(
          actual.temperature
        );
      }

      if (
        Number.isFinite(Number(humidity)) &&
        Number.isFinite(
          Number(actual.humidity)
        )
      ) {
        humidityPredicted.push(
          humidity
        );

        humidityActual.push(
          actual.humidity
        );
      }

      if (
        Number.isFinite(Number(wind)) &&
        Number.isFinite(
          Number(actual.wind)
        )
      ) {
        windPredicted.push(wind);
        windActual.push(actual.wind);
      }

      if (
        Number.isFinite(
          Number(precipitation)
        ) &&
        Number.isFinite(
          Number(actual.precipitation)
        )
      ) {
        rainPredicted.push(
          precipitation
        );

        rainActual.push(
          actual.precipitation
        );
      }
    });

    // ===============================
    // CALCULATE METRICS
    // ===============================

    const metrics = {
      temperature: metricAccuracy(
        temperaturePredicted,
        temperatureActual
      ),

      humidity: metricAccuracy(
        humidityPredicted,
        humidityActual
      ),

      wind: metricAccuracy(
        windPredicted,
        windActual
      ),

      rain: rainEventAccuracy(
        rainPredicted,
        rainActual
      ),
    };

    // ===============================
    // OVERALL ACCURACY
    // ===============================

    const availableMetrics =
      Object.values(metrics).filter(
        (value) => Number.isFinite(value)
      );

    const overall =
      availableMetrics.length
        ? Number(
            (
              availableMetrics.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
              availableMetrics.length
            ).toFixed(1)
          )
        : null;

    // ===============================
    // RESPONSE
    // ===============================

    res.json({
      success: true,

      location: location.name,

      state:
        location.admin1 || "",

      timezone:
        forecastData.timezone ||
        actualData.timezone ||
        "auto",

      leadTimeHours: 24,

      period: {
        start,
        end,
        days: requestedDays,
      },

      samples: times.length,

      verifiedSamples:
        temperaturePredicted.length,

      metrics,

      overall,

      methodology:
        "Accuracy is calculated from archived 24-hour-lead forecast runs versus corresponding historical weather values. Temperature, humidity and wind use normalized MAE; rain uses correct rain/no-rain event classification.",
    });
  } catch (error) {
    console.error(
      "Forecast accuracy error:",
      error
    );

    res.status(500).json({
      success: false,

      error:
        error.message ||
        "Unable to calculate forecast accuracy.",
    });
  }
});

module.exports = router;