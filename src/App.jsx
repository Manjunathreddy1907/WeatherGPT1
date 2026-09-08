import { useEffect, useState } from "react";
import "./App.css";
import WeatherMap from "./WeatherMap";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const convertTemperature = (value, unit = "Celsius") => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return unit === "Fahrenheit" ? (n * 9) / 5 + 32 : n;
};

const formatTemperature = (value, unit = "Celsius", digits = 0) => {
  const converted = convertTemperature(value, unit);
  return `${converted.toFixed(digits)}°${unit === "Fahrenheit" ? "F" : "C"}`;
};

const convertWind = (value, unit = "km/h") => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (unit === "mph") return n * 0.621371;
  if (unit === "m/s") return n / 3.6;
  return n;
};

const formatWind = (value, unit = "km/h", digits = 0) => {
  return `${convertWind(value, unit).toFixed(digits)} ${unit}`;
};

const Climate = ({ currentLocation, settings }) => {
    const [climateData, setClimateData] = useState([]);
    const [climateLoading, setClimateLoading] = useState(false);
    const [climateError, setClimateError] = useState("");

    /*
     * Convert either:
     *   365 daily records
     * OR
     *   monthly records
     * into the 12/13 monthly points needed by the Climate page.
     *
     * This is intentionally done in the frontend too, so the Climate page
     * remains correct even if an older backend process still returns daily
     * analytics for days=365.
     */
    const aggregateMonthly = (rows) => {
      if (!Array.isArray(rows) || !rows.length) return [];

      const monthly = {};

      rows.forEach((item) => {
        if (!item?.date) return;

        const date = String(item.date);
        const monthKey = date.length >= 7 ? date.slice(0, 7) : date;

        if (!monthly[monthKey]) {
          monthly[monthKey] = {
            date: monthKey,
            temperatures: [],
            highs: [],
            lows: [],
            rainfall: 0,
            humidities: [],
            winds: [],
          };
        }

        const month = monthly[monthKey];

        const temperature = Number(item.temperature);
        const high = Number(item.high);
        const low = Number(item.low);
        const rainfall = Number(item.rainfall);
        const humidity = Number(item.humidity);
        const wind = Number(item.wind);

        if (Number.isFinite(temperature)) {
          month.temperatures.push(temperature);
        }

        if (Number.isFinite(high)) {
          month.highs.push(high);
        }

        if (Number.isFinite(low)) {
          month.lows.push(low);
        }

        if (Number.isFinite(rainfall)) {
          month.rainfall += rainfall;
        }

        if (Number.isFinite(humidity)) {
          month.humidities.push(humidity);
        }

        if (Number.isFinite(wind)) {
          month.winds.push(wind);
        }
      });

      const avg = (values) =>
        values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;

      return Object.values(monthly)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((month) => ({
          date: month.date,
          temperature: avg(month.temperatures),
          high: month.highs.length ? Math.max(...month.highs) : 0,
          low: month.lows.length ? Math.min(...month.lows) : 0,
          rainfall: month.rainfall,
          humidity: avg(month.humidities),
          wind: avg(month.winds),
        }));
    };

    const fetchClimateData = async () => {
      try {
        setClimateLoading(true);
        setClimateError("");
        setClimateData([]);

        const controller = new AbortController();

        /*
         * Stop waiting forever if the backend is unavailable.
         */
        const timeout = setTimeout(() => controller.abort(), 15000);

        let response;

        try {
          response = await fetch(
            `${API_BASE}/analytics?city=${encodeURIComponent(
              currentLocation
            )}&days=365`,
            { signal: controller.signal }
          );
        } finally {
          clearTimeout(timeout);
        }

        /*
         * Read as text first instead of response.json().
         * This prevents "Unexpected token '<'" when another server/page
         * accidentally returns HTML.
         */
        const raw = await response.text();

        let data;

        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            "Analytics server returned an invalid response. Please restart the backend."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load historical climate data."
          );
        }

        if (!Array.isArray(data?.analytics) || !data.analytics.length) {
          throw new Error("No historical climate data was returned.");
        }

        /*
         * IMPORTANT:
         * Always aggregate the 365-day response here.
         * So even if backend returns 365 daily records, the UI gets
         * monthly values only.
         */
        const monthlyData = aggregateMonthly(data.analytics);

        if (!monthlyData.length) {
          throw new Error("Unable to create monthly climate data.");
        }

        setClimateData(monthlyData);
      } catch (error) {
        console.error("Climate data error:", error);

        if (error.name === "AbortError") {
          setClimateError(
            "Climate data request timed out. Make sure the backend is running on port 5001."
          );
        } else {
          setClimateError(
            error.message || "Unable to load historical climate data."
          );
        }

        setClimateData([]);
      } finally {
        setClimateLoading(false);
      }
    };

    useEffect(() => {
      fetchClimateData();
    }, [currentLocation]);

    const validData = climateData.filter(
      (item) =>
        Number.isFinite(Number(item.temperature)) &&
        Number.isFinite(Number(item.rainfall)) &&
        Number.isFinite(Number(item.humidity)) &&
        Number.isFinite(Number(item.wind))
    );

    const average = (key) => {
      if (!validData.length) return 0;

      return (
        validData.reduce((sum, item) => sum + Number(item[key]), 0) /
        validData.length
      );
    };

    const annualRainfall = validData.reduce(
      (sum, item) => sum + Number(item.rainfall),
      0
    );

    const hottestMonth = validData.length
      ? validData.reduce((max, item) =>
          Number(item.temperature) > Number(max.temperature) ? item : max
        )
      : null;

    const wettestMonth = validData.length
      ? validData.reduce((max, item) =>
          Number(item.rainfall) > Number(max.rainfall) ? item : max
        )
      : null;

    const coldestMonth = validData.length
      ? validData.reduce((min, item) =>
          Number(item.temperature) < Number(min.temperature) ? item : min
        )
      : null;

    const formatMonth = (dateString) => {
      if (!dateString) return "--";

      const date = new Date(`${dateString}-15T12:00:00`);

      return date.toLocaleDateString([], {
        month: "short",
      });
    };

    const formatMonthLong = (dateString) => {
      if (!dateString) return "--";

      const date = new Date(`${dateString}-15T12:00:00`);

      return date.toLocaleDateString([], {
        month: "long",
        year: "numeric",
      });
    };

    const maxTemperature = Math.max(
      ...validData.map((item) => Number(item.temperature)),
      1
    );

    const maxRainfall = Math.max(
      ...validData.map((item) => Number(item.rainfall)),
      1
    );

    return (
      <div className="page-section climate-page">
        <div className="page-title">
          <span className="eyebrow">WEATHER INTELLIGENCE</span>

          <h1>Climate 🌡️</h1>

          <p className="page-description">
            Historical climate patterns and yearly weather trends for{" "}
            <strong>{currentLocation}</strong>.
          </p>
        </div>

        {climateLoading && (
          <div className="climate-loading">
            <div className="loading-spinner"></div>

            <h3>Loading historical climate data...</h3>

            <p>
              Fetching 365 days of weather history for{" "}
              <strong>{currentLocation}</strong>
            </p>
          </div>
        )}

        {climateError && !climateLoading && (
          <div className="climate-error">
            <div className="error-icon">⚠️</div>

            <h3>Climate data unavailable</h3>

            <p>{climateError}</p>

            <button className="retry-btn" onClick={fetchClimateData}>
              Retry
            </button>
          </div>
        )}

        {!climateLoading && !climateError && validData.length > 0 && (
          <>
            <div className="climate-summary-grid">
              <div className="climate-summary-card temperature-card">
                <div className="summary-label">Average Temperature</div>

                <div className="summary-value">
                  {convertTemperature(average("temperature"), settings?.temperature).toFixed(1)}°{settings?.temperature === "Fahrenheit" ? "F" : "C"}
                </div>

                <div className="summary-subtext">
                  Last 365 days
                </div>
              </div>

              <div className="climate-summary-card rainfall-card">
                <div className="summary-label">Annual Rainfall</div>

                <div className="summary-value">
                  {annualRainfall.toFixed(1)} mm
                </div>

                <div className="summary-subtext">
                  Total precipitation
                </div>
              </div>

              <div className="climate-summary-card wettest-card">
                <div className="summary-label">Wettest Month</div>

                <div className="summary-value">
                  {formatMonthLong(wettestMonth?.date)}
                </div>

                <div className="summary-subtext">
                  {wettestMonth
                    ? `${Number(wettestMonth.rainfall).toFixed(1)} mm`
                    : "--"}
                </div>
              </div>

              <div className="climate-summary-card hottest-card">
                <div className="summary-label">Hottest Month</div>

                <div className="summary-value">
                  {formatMonthLong(hottestMonth?.date)}
                </div>

                <div className="summary-subtext">
                  {hottestMonth
                    ? `${convertTemperature(Number(hottestMonth.temperature), settings?.temperature).toFixed(1)}°${settings?.temperature === "Fahrenheit" ? "F" : "C"} avg`
                    : "--"}
                </div>
              </div>
            </div>

            <div className="climate-chart-card">
              <div className="chart-header">
                <div>
                  <h2>Monthly Temperature</h2>

                  <p>
                    Average temperature for each month over the last 365 days.
                  </p>
                </div>

                <span className="chart-badge">
                  {validData.length} months
                </span>
              </div>

              <div className="temperature-chart">
                {validData.map((item, index) => {
                  const temperature = Number(item.temperature);

                  const height = Math.max(
                    12,
                    (temperature / maxTemperature) * 205
                  );

                  return (
                    <div
                      className="temperature-column"
                      key={`${item.date}-${index}`}
                      title={`${item.date}: ${formatTemperature(temperature, settings?.temperature, 1)}`}
                    >
                      <div className="temperature-value">
                        {temperature.toFixed(0)}°
                      </div>

                      <div className="temperature-bar-container">
                        <div
                          className="temperature-bar"
                          style={{
                            height: `${height}px`,
                          }}
                        ></div>
                      </div>

                      <div className="temperature-month">
                        {formatMonth(item.date)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="climate-chart-card">
              <div className="chart-header">
                <div>
                  <h2>Monthly Rainfall</h2>

                  <p>
                    Total precipitation recorded for each month.
                  </p>
                </div>

                <span className="chart-badge rainfall-badge">
                  {annualRainfall.toFixed(1)} mm total
                </span>
              </div>

              <div className="rainfall-chart">
                {validData.map((item, index) => {
                  const rainfall = Number(item.rainfall);

                  const height = Math.max(
                    8,
                    (rainfall / maxRainfall) * 195
                  );

                  return (
                    <div
                      className="rainfall-column"
                      key={`${item.date}-rain-${index}`}
                      title={`${item.date}: ${rainfall.toFixed(1)} mm`}
                    >
                      <div className="rainfall-value">
                        {rainfall.toFixed(0)}
                      </div>

                      <div className="rainfall-bar-container">
                        <div
                          className="rainfall-bar"
                          style={{
                            height: `${height}px`,
                          }}
                        ></div>
                      </div>

                      <div className="rainfall-month">
                        {formatMonth(item.date)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="climate-details-grid">
              <div className="climate-detail-card">
                <div className="detail-icon">💧</div>

                <div>
                  <h3>Average Humidity</h3>

                  <p>
                    The yearly average humidity is{" "}
                    <strong>
                      {average("humidity").toFixed(1)}%
                    </strong>.
                  </p>
                </div>
              </div>

              <div className="climate-detail-card">
                <div className="detail-icon">💨</div>

                <div>
                  <h3>Average Wind</h3>

                  <p>
                    Average monthly maximum wind speed is{" "}
                    <strong>
                      {convertWind(average("wind"), settings?.windSpeed).toFixed(1)} {settings?.windSpeed || "km/h"}
                    </strong>.
                  </p>
                </div>
              </div>

              <div className="climate-detail-card">
                <div className="detail-icon">❄️</div>

                <div>
                  <h3>Coolest Month</h3>

                  <p>
                    <strong>
                      {formatMonthLong(coldestMonth?.date)}
                    </strong>{" "}
                    had the lowest average temperature of{" "}
                    <strong>
                      {coldestMonth
                        ? `${convertTemperature(Number(
                            coldestMonth.temperature
                          ), settings?.temperature).toFixed(1)}°${settings?.temperature === "Fahrenheit" ? "F" : "C"}`
                        : "--"}
                    </strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="climate-chart-card">
              <div className="chart-header">
                <div>
                  <h2>Climate Details</h2>

                  <p>
                    Monthly historical weather summary.
                  </p>
                </div>
              </div>

              <div className="climate-table">
                <div className="climate-table-header">
                  <span>Month</span>
                  <span>Avg Temp</span>
                  <span>Rainfall</span>
                  <span>Humidity</span>
                  <span>Wind</span>
                </div>

                {validData.map((item, index) => (
                  <div
                    className="climate-row"
                    key={`${item.date}-table-${index}`}
                  >
                    <span>{formatMonthLong(item.date)}</span>

                    <span>
                      {convertTemperature(Number(item.temperature), settings?.temperature).toFixed(1)}°{settings?.temperature === "Fahrenheit" ? "F" : "C"}
                    </span>

                    <span>
                      {Number(item.rainfall).toFixed(1)} mm
                    </span>

                    <span>
                      {Number(item.humidity).toFixed(1)}%
                    </span>

                    <span>
                      {convertWind(Number(item.wind), settings?.windSpeed).toFixed(1)} {settings?.windSpeed || "km/h"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="climate-source">
              <div className="source-icon">🤖</div>

              <div>
                <strong>WeatherGPT Climate Insight</strong>

                <p>
                  {wettestMonth && hottestMonth
                    ? `${formatMonthLong(
                        wettestMonth.date
                      )} was the wettest month with ${Number(
                        wettestMonth.rainfall
                      ).toFixed(
                        1
                      )} mm of rainfall, while ${formatMonthLong(
                        hottestMonth.date
                      )} had the highest average temperature at ${convertTemperature(Number(
                        hottestMonth.temperature
                      ), settings?.temperature).toFixed(1)}°${settings?.temperature === "Fahrenheit" ? "F" : "C"}.`
                    : "Historical climate trends are available for this location."}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };


function App() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [readAlerts, setReadAlerts] = useState([]);

  /* ================================
     NOTIFICATIONS
  ================================= */

  const [notifications, setNotifications] = useState([
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
  ]);

  /* ================================
     LOCATIONS
  ================================= */

  const [locations, setLocations] = useState([
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
  ]);

  const [locationSearch, setLocationSearch] = useState("");
  const [mapLayer, setMapLayer] = useState("Temperature");

  /* ================================
     AGRICULTURE
  ================================= */

  const [agriculture, setAgriculture] = useState({
    location: "Bengaluru",
    crop: "Tomato",
    soil: "Loamy",
    season: "Kharif",
  });

  /* ================================
     TRAVEL
  ================================= */

  const [travel, setTravel] = useState(() => ({
    from: "Bengaluru",
    to: "Mysuru",
    date: new Date().toLocaleDateString("en-CA"),
    time: "09:00",
  }));

  const [currentLocation, setCurrentLocation] = useState(() =>
    localStorage.getItem("weatherGPT_currentLocation") || "Bengaluru"
  );

  const [currentCoordinates, setCurrentCoordinates] = useState(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem("weatherGPT_currentCoordinates")
        ) || null
      );
    } catch {
      return null;
    }
  });


  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("weatherGPT_profile")) || {
        name: "Raghava Narasimha",
        role: "Student",
      };
    } catch {
      return { name: "Raghava Narasimha", role: "Student" };
    }
  });

  const [profileEditing, setProfileEditing] = useState(false);

  const [liveProfile, setLiveProfile] = useState({
    location: {
      city: currentLocation,
      state: "",
      district: "",
      country: "India",
      latitude: null,
      longitude: null,
      display_name: currentLocation,
    },
    updatedAt: null,
  });

  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("weatherGPT_settings")) || {
        temperature: "Celsius",
        windSpeed: "km/h",
        notifications: true,
        weatherAlerts: true,
        autoRefresh: true,
        language: "English",
      };
    } catch {
      return {
        temperature: "Celsius",
        windSpeed: "km/h",
        notifications: true,
        weatherAlerts: true,
        autoRefresh: true,
        language: "English",
      };
    }
  });


  /* ================================
     MULTILINGUAL APPLICATION UI
  ================================= */
  const translations = {
    Telugu: {
      "PREFERENCES": "ప్రాధాన్యతలు",
      "Settings": "సెట్టింగ్స్",
      "Customize your WeatherGPT experience.": "మీ WeatherGPT అనుభవాన్ని అనుకూలీకరించండి.",
      "Weather Units": "వాతావరణ యూనిట్లు",
      "Choose how weather information is displayed.": "వాతావరణ సమాచారాన్ని ఎలా చూపించాలో ఎంచుకోండి.",
      "Temperature": "ఉష్ణోగ్రత",
      "Select temperature unit": "ఉష్ణోగ్రత యూనిట్ ఎంచుకోండి",
      "Celsius": "సెల్సియస్",
      "Fahrenheit": "ఫారెన్‌హీట్",
      "Wind Speed": "గాలి వేగం",
      "Select wind speed unit": "గాలి వేగం యూనిట్ ఎంచుకోండి",
      "Notifications": "నోటిఫికేషన్లు",
      "Control weather notifications and alerts.": "వాతావరణ నోటిఫికేషన్లు మరియు హెచ్చరికలను నియంత్రించండి.",
      "Receive WeatherGPT notifications": "WeatherGPT నోటిఫికేషన్లు పొందండి",
      "Weather Alerts": "వాతావరణ హెచ్చరికలు",
      "Receive severe weather warnings": "తీవ్రమైన వాతావరణ హెచ్చరికలను పొందండి",
      "Application": "అప్లికేషన్",
      "General WeatherGPT preferences.": "సాధారణ WeatherGPT ప్రాధాన్యతలు.",
      "Language": "భాష",
      "Application language": "అప్లికేషన్ భాష",
      "English": "ఇంగ్లీష్",
      "Telugu": "తెలుగు",
      "Hindi": "హిందీ",
      "Auto Refresh": "ఆటో రిఫ్రెష్",
      "Automatically update weather data": "వాతావరణ డేటాను స్వయంచాలకంగా నవీకరించండి",
      "About WeatherGPT": "WeatherGPT గురించి",
      "Application information.": "అప్లికేషన్ సమాచారం.",
      "Version": "వెర్షన్",
      "Platform": "ప్లాట్‌ఫారమ్",
      "MAIN": "ప్రధాన",
      "WEATHER INTELLIGENCE": "వాతావరణ సమాచారం",
      "SMART FEATURES": "స్మార్ట్ ఫీచర్లు",
      "Dashboard": "డ్యాష్‌బోర్డ్",
      "AI Weather Chat": "AI వాతావరణ చాట్",
      "Live Weather": "ప్రత్యక్ష వాతావరణం",
      "Hourly Forecast": "గంటల వారీ అంచనా",
      "7-Day Forecast": "7 రోజుల అంచనా",
      "Risk Assessment": "ప్రమాద అంచనా",
      "Weather Map": "వాతావరణ మ్యాప్",
      "Locations": "ప్రదేశాలు",
      "Climate": "వాతావరణ మార్పులు",
      "Agriculture": "వ్యవసాయం",
      "Travel": "ప్రయాణం",
      "Analytics": "విశ్లేషణ",
      "Today": "ఈ రోజు",
      "Tomorrow": "రేపు",
      "Humidity": "తేమ",
      "Pressure": "పీడనం",
      "Visibility": "దృశ్యమానత",
      "Cloud Cover": "మేఘాల కవరేజ్",
      "Rain Chance": "వర్షం అవకాశం",
      "UV Index": "UV సూచిక",
      "Feels Like": "అనిపించే ఉష్ణోగ్రత",
      "High": "గరిష్ఠం",
      "Low": "కనిష్ఠం",
      "No active weather-risk alerts": "ప్రస్తుతం వాతావరణ ప్రమాద హెచ్చరికలు లేవు",
    },
    Hindi: {
      "PREFERENCES": "प्राथमिकताएँ",
      "Settings": "सेटिंग्स",
      "Customize your WeatherGPT experience.": "अपने WeatherGPT अनुभव को अनुकूलित करें।",
      "Weather Units": "मौसम इकाइयाँ",
      "Choose how weather information is displayed.": "मौसम की जानकारी कैसे दिखाई जाए, चुनें।",
      "Temperature": "तापमान",
      "Select temperature unit": "तापमान इकाई चुनें",
      "Celsius": "सेल्सियस",
      "Fahrenheit": "फ़ारेनहाइट",
      "Wind Speed": "हवा की गति",
      "Select wind speed unit": "हवा की गति की इकाई चुनें",
      "Notifications": "सूचनाएँ",
      "Control weather notifications and alerts.": "मौसम सूचनाओं और अलर्ट को नियंत्रित करें।",
      "Receive WeatherGPT notifications": "WeatherGPT सूचनाएँ प्राप्त करें",
      "Weather Alerts": "मौसम अलर्ट",
      "Receive severe weather warnings": "गंभीर मौसम चेतावनियाँ प्राप्त करें",
      "Application": "एप्लिकेशन",
      "General WeatherGPT preferences.": "सामान्य WeatherGPT प्राथमिकताएँ।",
      "Language": "भाषा",
      "Application language": "एप्लिकेशन भाषा",
      "English": "अंग्रेज़ी",
      "Telugu": "तेलुगु",
      "Hindi": "हिंदी",
      "Auto Refresh": "ऑटो रिफ्रेश",
      "Automatically update weather data": "मौसम डेटा को अपने आप अपडेट करें",
      "About WeatherGPT": "WeatherGPT के बारे में",
      "Application information.": "एप्लिकेशन की जानकारी।",
      "Version": "संस्करण",
      "Platform": "प्लेटफ़ॉर्म",
      "MAIN": "मुख्य",
      "WEATHER INTELLIGENCE": "मौसम जानकारी",
      "SMART FEATURES": "स्मार्ट फीचर्स",
      "Dashboard": "डैशबोर्ड",
      "AI Weather Chat": "AI मौसम चैट",
      "Live Weather": "लाइव मौसम",
      "Hourly Forecast": "प्रति घंटा पूर्वानुमान",
      "7-Day Forecast": "7 दिन का पूर्वानुमान",
      "Risk Assessment": "जोखिम आकलन",
      "Weather Map": "मौसम मानचित्र",
      "Locations": "स्थान",
      "Climate": "जलवायु",
      "Agriculture": "कृषि",
      "Travel": "यात्रा",
      "Analytics": "विश्लेषण",
      "Today": "आज",
      "Tomorrow": "कल",
      "Humidity": "आर्द्रता",
      "Pressure": "दाब",
      "Visibility": "दृश्यता",
      "Cloud Cover": "बादल कवर",
      "Rain Chance": "बारिश की संभावना",
      "UV Index": "UV सूचकांक",
      "Feels Like": "महसूस होने वाला तापमान",
      "High": "अधिकतम",
      "Low": "न्यूनतम",
      "No active weather-risk alerts": "अभी कोई मौसम जोखिम अलर्ट सक्रिय नहीं है",
    },
  };

  /* Translate visible application text whenever the selected language changes. */
  useEffect(() => {
    if (settings.language === "English") return;

    const originalText = new WeakMap();
    const allMaps = Object.values(translations);
    const reverse = {};

    allMaps.forEach((map) => {
      Object.entries(map).forEach(([english, translated]) => {
        reverse[translated] = english;
      });
    });

    const translateNode = (node) => {
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const parent = node.parentElement;
      if (!parent) return;
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return;
      if (parent.closest("[data-no-translate='true']")) return;

      const base = originalText.get(node) || reverse[node.nodeValue.trim()] || node.nodeValue;
      if (!originalText.has(node)) originalText.set(node, base);

      const trimmed = base.trim();
      if (!trimmed) return;

      const translated = translations[settings.language]?.[trimmed];
      if (translated) {
        const leading = base.match(/^\s*/)?.[0] || "";
        const trailing = base.match(/\s*$/)?.[0] || "";
        node.nodeValue = leading + translated + trailing;
      }
    };

    const translatePage = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) translateNode(node);
    };

    translatePage();
    const observer = new MutationObserver(translatePage);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [settings.language]);

  const updateSetting = async (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch(`${API_BASE}/settings/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update setting");
      }

      if (data.settings) {
        setSettings(data.settings);
        localStorage.setItem(
          "weatherGPT_settings",
          JSON.stringify(data.settings)
        );
      }
    } catch (error) {
      console.error("Settings update error:", error);
      localStorage.setItem("weatherGPT_settings", JSON.stringify({
        ...settings,
        [key]: value,
      }));
    }
  };

/* WEATHER DATA */
const [weather, setWeather] = useState({
  temperature: 0,
  condition: "Loading...",
  icon: "🌤️",
  location: "Bengaluru, Karnataka",
  feelsLike: 0,
  high: 0,
  low: 0,
  humidity: 0,
  wind: 0,
  windDirection: "N/A",
  rainChance: 0,
  uv: 0,
  pressure: 0,
  visibility: 0,
  cloudCover: 0,
  sunrise: "--",
  sunset: "--",
});
const [forecast, setForecast] = useState([]);
const [weeklyForecast, setWeeklyForecast] = useState([]);
const [agricultureResult, setAgricultureResult] = useState(null);
const [travelRisk, setTravelRisk] = useState(null);

/* ================================
   ANALYTICS DATA
================================ */

const [analyticsRange, setAnalyticsRange] = useState("7");
const [analyticsData, setAnalyticsData] = useState({
  loading: false,
  error: "",
  location: currentLocation,
  points: [],
});

const fetchForecast = async () => {
  try {
    const response = await fetch(
      `${API_BASE}/forecast?city=${encodeURIComponent(currentLocation)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch forecast");
    }

    setForecast(data.forecast);

    const today = new Date().toLocaleDateString("en-CA");

    const days = data.dailyForecast
      .filter((item) => item.date >= today)
      .slice(0, 7)
      .map((item, index) => ({
        day:
          index === 0
            ? "Today"
            : new Date(item.date + "T12:00:00").toLocaleDateString([], {
                weekday: "long",
              }),

        date: new Date(item.date + "T12:00:00").toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),

        high: Math.round(item.high),
        low: Math.round(item.low),
        rain: Math.round(item.rain),
        wind: Math.round(item.wind),
        condition: item.condition,
        icon: item.icon,
      }));

    setWeeklyForecast(days);
  } catch (error) {
    console.error("Forecast error:", error);
  }
};
const fetchWeather = async () => {
  try {
    const response = await fetch(
      `${API_BASE}/weather?city=${encodeURIComponent(currentLocation)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch weather");
    }

    setWeather((prev) => ({
  ...prev,

  temperature: Math.round(data.temperature),
  condition: data.weather,
  feelsLike: Math.round(data.feels_like),

  high: Math.round(data.temp_max),
  low: Math.round(data.temp_min),

  humidity: data.humidity,
  pressure: data.pressure,

  wind: Math.round(data.wind_speed * 3.6),
  windDirection: data.wind_direction,

  cloudCover: data.cloud_cover,
  visibility: data.visibility,

  // Live values from the updated weather backend
  rainChance: Math.round(data.rain_chance || 0),
  uv: Number(data.uv_index || 0),

  sunrise: new Date(data.sunrise * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  }),

  sunset: new Date(data.sunset * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  }),

  location: `${data.city}, ${data.state || "India"}`,
}));
  } catch (error) {
    console.error("Weather fetch error:", error);
  }
};

const fetchFeatureData = async () => {
  try {
    const [locationsResponse, notificationsResponse] = await Promise.all([
      fetch(`${API_BASE}/locations`),
      fetch(`${API_BASE}/notifications`),
    ]);
    if (locationsResponse.ok) setLocations((await locationsResponse.json()).locations);
    if (notificationsResponse.ok) setNotifications((await notificationsResponse.json()).notifications);
  } catch (error) {
    console.error("Feature data fetch error:", error);
  }
};
const hourlyData = forecast
  .filter((item) => {
    const itemTime = new Date(item.time * 1000);
    return itemTime.getTime() >= Date.now() - 60 * 1000;
  })
  .slice(0, 24)
  .map((item) => ({
    time: new Date(item.time * 1000).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    temp: Math.round(item.temperature),
    icon: item.icon,
    rain: item.rain_chance,
    wind: Math.round(item.wind_speed * 3.6),
    condition: item.weather,
    timestamp: item.time,
  }));


  const weeklyData = [
    {
      day: "Today",
      date: "Sep 6",
      icon: "🌤️",
      condition: "Partly Cloudy",
      high: 30,
      low: 21,
      rain: 40,
      wind: 14,
    },
    {
      day: "Monday",
      date: "Sep 7",
      icon: "☀️",
      condition: "Sunny",
      high: 31,
      low: 22,
      rain: 10,
      wind: 12,
    },
    {
      day: "Tuesday",
      date: "Sep 8",
      icon: "⛅",
      condition: "Partly Cloudy",
      high: 30,
      low: 21,
      rain: 20,
      wind: 13,
    },
    {
      day: "Wednesday",
      date: "Sep 9",
      icon: "🌧️",
      condition: "Rainy",
      high: 28,
      low: 20,
      rain: 65,
      wind: 17,
    },
    {
      day: "Thursday",
      date: "Sep 10",
      icon: "🌦️",
      condition: "Showers",
      high: 27,
      low: 20,
      rain: 55,
      wind: 16,
    },
    {
      day: "Friday",
      date: "Sep 11",
      icon: "🌤️",
      condition: "Partly Cloudy",
      high: 29,
      low: 21,
      rain: 35,
      wind: 14,
    },
    {
      day: "Saturday",
      date: "Sep 12",
      icon: "☀️",
      condition: "Sunny",
      high: 30,
      low: 22,
      rain: 15,
      wind: 11,
    },
  ];

  /* ================================
     DYNAMIC WEATHER / DISASTER ALERTS
  ================================= */

  const alerts = (() => {
    const clamp = (value, min = 0, max = 100) =>
      Math.max(min, Math.min(max, Number(value) || 0));

    const rainChance = clamp(
      Math.max(
        Number(weather.rainChance) || 0,
        ...forecast.slice(0, 24).map((item) => Number(item.rain_chance) || 0)
      )
    );
    const temperature = Number(weather.temperature) || 0;
    const humidity = Number(weather.humidity) || 0;
    const wind = Number(weather.wind) || 0;
    const uv = Number(weather.uv) || 0;
    const visibility = Number(weather.visibility) || 0;
    const cloudCover = Number(weather.cloudCover) || 0;
    const thunderstorm = forecast.slice(0, 24).some((item) =>
      /thunder|storm|lightning/i.test(String(item.weather || ''))
    );

    const floodRisk = clamp(
      rainChance * 0.65 +
        (thunderstorm ? 20 : 0) +
        cloudCover * 0.1 +
        (humidity >= 85 ? 8 : 0)
    );

    const makeAlert = (id, title, severity, description, recommendation, time = 'Next 24 hours') => ({
      id,
      title,
      severity,
      location: currentLocation,
      start: 'Now',
      end: time,
      description,
      recommendation,
    });

    const generated = [];

    if (rainChance >= 50) {
      generated.push(
        makeAlert(
          'heavy-rain',
          rainChance >= 70 ? 'Heavy Rainfall Alert' : 'Moderate Rainfall Alert',
          rainChance >= 70 ? 'orange' : 'yellow',
          `Rain probability is ${Math.round(rainChance)}% for ${currentLocation} in the current/near-term forecast. Heavy rain may cause slippery roads and temporary water accumulation.`,
          'Carry an umbrella, avoid unnecessary travel during intense rainfall, and monitor local authority updates.'
        )
      );
    }

    if (thunderstorm) {
      generated.push(
        makeAlert(
          'thunderstorm',
          'Thunderstorm Watch',
          'orange',
          `Thunderstorm or lightning conditions are indicated in the next 24 hours for ${currentLocation}. Gusty winds and lightning may occur.`,
          'Stay indoors during thunderstorm activity. Avoid open fields, isolated trees, and exposed locations.'
        )
      );
    }

    if (floodRisk >= 50) {
      generated.push(
        makeAlert(
          'flood-risk',
          floodRisk >= 70 ? 'Flood Risk Alert' : 'Flood Risk Advisory',
          floodRisk >= 70 ? 'orange' : 'yellow',
          `Weather-based flood risk is ${Math.round(floodRisk)}% because of rainfall probability, cloud cover and humidity. Low-lying areas may be more vulnerable if heavy rain occurs.`,
          'Avoid flooded roads and low-lying areas. Never drive or walk through moving floodwater. Follow local disaster-management instructions.'
        )
      );
    }

    if (wind >= 45) {
      generated.push(
        makeAlert(
          'strong-wind',
          'Strong Wind Advisory',
          wind >= 60 ? 'orange' : 'yellow',
          `Current wind speed is approximately ${Math.round(wind)} km/h at ${currentLocation}. Stronger gusts may affect travel and outdoor activities.`,
          'Secure loose objects, use caution on two-wheelers, and avoid exposed areas during strong gusts.'
        )
      );
    }

    if (temperature >= 38 || (temperature >= 35 && uv >= 8)) {
      generated.push(
        makeAlert(
          'extreme-heat',
          'Extreme Heat Advisory',
          temperature >= 40 ? 'orange' : 'yellow',
          `Temperature is ${Math.round(temperature)}°C with a UV index of ${uv.toFixed(1)} at ${currentLocation}. Heat exposure may become unsafe.`,
          'Stay hydrated, reduce strenuous outdoor activity, and avoid prolonged direct sun during the hottest hours.'
        )
      );
    }

    if (visibility > 0 && visibility < 5) {
      generated.push(
        makeAlert(
          'low-visibility',
          'Low Visibility Advisory',
          visibility < 2 ? 'orange' : 'yellow',
          `Visibility is approximately ${visibility.toFixed(1)} km at ${currentLocation}. Reduced visibility can increase road and travel risk.`,
          'Slow down, use appropriate vehicle lights, and postpone travel if visibility becomes severely reduced.'
        )
      );
    }

    return generated;
  })();

  /* ================================
     MENU
  ================================= */

  const menuGroups = [
    {
      title: "MAIN",
      items: [
        ["Dashboard", "🏠"],
        ["Notifications", "🔔"],
        ["AI Weather Chat", "🤖"],
        ["Live Weather", "🌤️"],
        ["Hourly Forecast", "🕐"],
        ["7-Day Forecast", "📅"],
      ],
    },
    {
      title: "WEATHER INTELLIGENCE",
      items: [
        ["Weather Alerts", "⚠️"],
        ["Risk Assessment", "🛡️"],
        ["Weather Map", "🗺️"],
        ["Locations", "📍"],
        ["Climate", "🌡️"],
      ],
    },
    {
      title: "SMART FEATURES",
      items: [
        ["Agriculture", "🌱"],
        ["Travel", "✈️"],
        ["Analytics", "📊"],
      ],
    },
  ];

  /* ================================
     CURRENT LOCATION
  ================================= */

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoordinates({ latitude, longitude });

        try {
          const response = await fetch(
            `${API_BASE}/location/reverse?lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Reverse geocoding failed");
          }

          const city =
            data.city ||
            data.town ||
            data.village ||
            data.municipality ||
            data.state ||
            currentLocation;

          setCurrentLocation(city);
        } catch (error) {
          console.error("Reverse location error:", error);
          // Keep the previous city if reverse geocoding fails.
        }
      },
      (error) => {
        console.error("Location permission/error:", error);

        if (error.code === 1) {
          alert(
            "Location permission was denied. Please allow location access in your browser."
          );
        } else if (error.code === 2) {
          alert("Your current location could not be determined.");
        } else if (error.code === 3) {
          alert("Location request timed out. Please try again.");
        } else {
          alert("Unable to access your current location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      }
    );
  };

  /* ================================
     EFFECTS
  ================================= */
  /* ================================
     LIVE CLOCK
  ================================= */

  useEffect(() => {
    const clock = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    const savedLocation = localStorage.getItem("weatherGPT_currentLocation");

    if (!savedLocation && navigator.geolocation) {
      handleUseMyLocation();
    }
  }, []);


 useEffect(() => {
  fetchWeather();
  fetchForecast();
  fetchFeatureData();

  if (!settings.autoRefresh) return undefined;

  const timer = setInterval(() => {
    fetchWeather();
    fetchForecast();
    setLastUpdated("A few seconds ago");
  }, 30000);

  return () => clearInterval(timer);
}, [currentLocation, settings.autoRefresh]);

useEffect(() => {
  localStorage.setItem("weatherGPT_currentLocation", currentLocation);
  localStorage.setItem(
    "weatherGPT_currentCoordinates",
    JSON.stringify(currentCoordinates)
  );
  setAgriculture((prev) => ({ ...prev, location: currentLocation }));
}, [currentLocation, currentCoordinates]);

useEffect(() => {
  localStorage.setItem("weatherGPT_profile", JSON.stringify(profile));
}, [profile]);

/* ================================
   LIVE PROFILE / LOCATION SYNC
================================= */
useEffect(() => {
  const loadLiveProfile = async () => {
    try {
      const params = new URLSearchParams();

      if (currentCoordinates?.latitude != null && currentCoordinates?.longitude != null) {
        params.set("lat", currentCoordinates.latitude);
        params.set("lon", currentCoordinates.longitude);
      } else {
        params.set("city", currentLocation);
      }

      const response = await fetch(`${API_BASE}/profile?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load profile");
      }

      if (data.profile) {
        setProfile((prev) => ({
          ...prev,
          name: data.profile.name || prev.name,
          role: data.profile.role || prev.role,
        }));
      }

      if (data.location) {
        setLiveProfile({
          location: data.location,
          updatedAt: data.updatedAt || new Date().toISOString(),
        });

        if (currentCoordinates?.latitude != null && data.location.city) {
          setCurrentLocation(data.location.city);
        }
      }
    } catch (error) {
      console.warn("Live profile sync unavailable:", error);
      setLiveProfile((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          city: currentLocation,
        },
      }));
    }
  };

  loadLiveProfile();
}, [currentCoordinates?.latitude, currentCoordinates?.longitude, currentLocation]);

useEffect(() => {
  const syncSettings = async () => {
    try {
      const saved = localStorage.getItem("weatherGPT_settings");

      if (saved) {
        const localSettings = JSON.parse(saved);
        const response = await fetch(`${API_BASE}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localSettings),
        });
        const data = await response.json();

        if (response.ok && data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          localStorage.setItem(
            "weatherGPT_settings",
            JSON.stringify(data.settings)
          );
        }
      } else {
        const response = await fetch(`${API_BASE}/settings`);
        const data = await response.json();

        if (response.ok && data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      }
    } catch (error) {
      console.warn("Using local settings; backend settings unavailable.");
    }
  };

  syncSettings();
}, []);

useEffect(() => {
  localStorage.setItem("weatherGPT_settings", JSON.stringify(settings));
}, [settings]);

useEffect(() => {
  const controller = new AbortController();

  const timer = setTimeout(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/agriculture/recommendation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(agriculture),
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to get agriculture recommendation"
        );
      }

      setAgricultureResult(data);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Agriculture fetch error:", error);
      }
    }
  }, 500);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [agriculture]);

useEffect(() => {
  const controller = new AbortController();

  setTravelRisk(null);

  const timer = setTimeout(async () => {
    try {
      if (!travel.from.trim() || !travel.to.trim() || !travel.date || !travel.time) {
        return;
      }

      const response = await fetch(`${API_BASE}/travel/risk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(travel),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to calculate travel risk");
      }

      setTravelRisk(data);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Travel fetch error:", error);
      }
    }
  }, 500);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [travel.from, travel.to, travel.date, travel.time]);
  useEffect(() => {
    if (
      hourlyData.length > 0 &&
      selectedHour >= hourlyData.length
    ) {
      setSelectedHour(0);
    }
  }, [hourlyData.length, selectedHour]);

  /* ================================
     REFRESH
  ================================= */
  const handleRefresh = async () => {
  setIsRefreshing(true);

  await fetchWeather();

  setIsRefreshing(false);
  setLastUpdated("Just now");
};
  /* ================================
     NOTIFICATION FUNCTIONS
  ================================= */

  const markNotificationRead = (id) => {
    fetch(`${API_BASE}/notifications/${id}/read`, { method: "PATCH" })
      .catch((error) => console.error("Notification update error:", error));
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  };

  const markAllNotificationsRead = () => {
    fetch(`${API_BASE}/notifications/read-all`, { method: "POST" })
      .catch((error) => console.error("Notification update error:", error));
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        read: true,
      }))
    );
  };

  /* ================================
     AI RESPONSE
  ================================= */

  const generateResponse = (text) => {
    const lower = text.toLowerCase();

    if (lower.includes("rain")) {
      return "There is a 40% chance of rain today. Rain probability may increase to around 60–65% between 5 PM and 7 PM.";
    }

    if (lower.includes("wear")) {
      return "A light cotton outfit would be comfortable today. Carry an umbrella because evening rain is possible.";
    }

    if (
      lower.includes("travel") ||
      lower.includes("safe") ||
      lower.includes("outside")
    ) {
      return "Travel is generally safe during the daytime. Be more careful after 5 PM because rain and thunderstorm activity may increase.";
    }

    if (lower.includes("tomorrow")) {
      return "Tomorrow is expected to be mostly sunny with a high around 31°C, low around 22°C and only a 10% chance of rain.";
    }

    if (
      lower.includes("crop") ||
      lower.includes("farm") ||
      lower.includes("water")
    ) {
      return "Current weather is suitable for crops that prefer moderate warmth. Irrigation should be based on soil moisture because evening rainfall is possible.";
    }

    return "Based on the current weather data, Bengaluru is partly cloudy at 28°C with 68% humidity and a 40% chance of rain.";
  };

  /* ================================
     CHAT
  ================================= */

  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello! 👋 I'm WeatherGPT. Ask me anything about today's weather, rain, travel, farming or weather risks.",
      time: "Now",
    },
  ]);

  const sendChatMessage = async () => {
    if (!message.trim() || isTyping) return;

    const userText = message.trim();
    const userTime = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    // Keep the previous conversation so WeatherGPT can respond naturally.
    const conversationHistory = messages.slice(-10).map((item) => ({
      role: item.type === "user" ? "user" : "assistant",
      content: item.text,
    }));

    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        text: userText,
        time: userTime,
      },
    ]);

    setMessage("");
    setIsTyping(true);

    try {
      // Send the actual live weather + upcoming hourly data to the backend.
      const weatherContext = {
        location: currentLocation,
        temperature: weather.temperature,
        feelsLike: weather.feelsLike,
        condition: weather.condition,
        humidity: weather.humidity,
        wind: weather.wind,
        windDirection: weather.windDirection,
        rainChance: weather.rainChance,
        uv: weather.uv,
        pressure: weather.pressure,
        visibility: weather.visibility,
        cloudCover: weather.cloudCover,
        sunrise: weather.sunrise,
        sunset: weather.sunset,
      };

      const forecastContext = hourlyData.slice(0, 12).map((item) => ({
        time: item.time,
        temperature: item.temp,
        rainChance: item.rain,
        wind: item.wind,
        condition: item.condition,
      }));

      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          location: currentLocation,
          weather: weatherContext,
          forecast: forecastContext,
          language: settings.language,
          preferredTemperatureUnit: settings.temperature,
          preferredWindSpeedUnit: settings.windSpeed,
          history: conversationHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to reach WeatherGPT");
      }

      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text:
            data.reply ||
            "I couldn't generate a weather-aware answer right now.",
          time: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (error) {
      console.error("Chat request error:", error);

      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: generateResponse(userText),
          time: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        type: "ai",
        text: "Chat cleared. 🌤️ How can I help you with the weather?",
        time: "Now",
      },
    ]);
  };

  /* ================================
     LOCATIONS FUNCTIONS
  ================================= */

  const selectLocation = (name) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    setCurrentLocation(cleanName);
    setCurrentCoordinates(null);
    setLocationSearch("");
    setActiveMenu("Dashboard");
  };

  const addLocation = async () => {
    if (!locationSearch.trim()) return;

    const name = locationSearch.trim();

    const exists = locations.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );

    if (!exists) {
      try {
        const response = await fetch(`${API_BASE}/locations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await response.json();
        if (response.ok) {
          setLocations((prev) => [...prev, data.location]);
          selectLocation(data.location.name);
          return;
        }
      } catch (error) {
        console.error("Location add error:", error);
      }
    }

    setLocationSearch("");
  };

  const toggleFavorite = async (id) => {
    const location = locations.find((item) => item.id === id);
    if (location) {
      fetch(`${API_BASE}/locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !location.favorite }),
      }).catch((error) => console.error("Favorite update error:", error));
    }
    setLocations((prev) =>
      prev.map((location) =>
        location.id === id
          ? { ...location, favorite: !location.favorite }
          : location
      )
    );
  };

  const deleteLocation = async (id) => {
    try {
      await fetch(`${API_BASE}/locations/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Location delete error:", error);
    }
    setLocations((prev) =>
      prev.filter((location) => location.id !== id)
    );
  };

  /* ================================
     TRAVEL RISK
  ================================= */

  const getTravelRisk = () => {
    if (travelRisk) return travelRisk;

    return {
      level: "Checking",
      icon: "🕐",
      score: null,
      description:
        "Checking weather conditions at the departure and destination locations for the selected date and time.",
      recommendations: [],
      loading: true,
    };
  };

  /* ================================
     AGRICULTURE RESULT
  ================================= */

  const getAgricultureResult = () => {
    if (agricultureResult) return agricultureResult;
    if (agriculture.crop === "Tomato") {
      return {
        suitability: "High",
        irrigation: "Moderate irrigation",
        sowing: "June - September",
        water: "400 - 600 mm",
        recommendation:
          "Current weather is suitable for tomato cultivation. Avoid excess irrigation because rainfall is expected in the evening.",
        tips: [
          "Maintain proper drainage.",
          "Monitor fungal diseases after rainfall.",
          "Use drip irrigation when possible.",
        ],
      };
    }

    if (agriculture.crop === "Rice") {
      return {
        suitability: "High",
        irrigation: "High water requirement",
        sowing: "June - August",
        water: "1000 - 1500 mm",
        recommendation:
          "Warm and humid conditions are favorable for rice. Maintain sufficient soil moisture.",
        tips: [
          "Maintain water level in the field.",
          "Watch for pest activity.",
          "Avoid unnecessary irrigation before heavy rainfall.",
        ],
      };
    }

    return {
      suitability: "Moderate",
      irrigation: "Moderate",
      sowing: "Season dependent",
      water: "500 - 800 mm",
      recommendation:
        "Weather conditions are moderately suitable. Monitor rainfall and soil moisture before irrigation.",
      tips: [
        "Check soil moisture regularly.",
        "Avoid overwatering.",
        "Monitor weather alerts.",
      ],
    };
  };

  /* ================================
     DASHBOARD
  ================================= */

  const Dashboard = () => {
    const dashboardRainChance = Math.max(
      Number(weather.rainChance) || 0,
      ...forecast.slice(0, 24).map((item) => Number(item.rain_chance) || 0)
    );
    const dashboardWind = Number(weather.wind) || 0;
    const dashboardTemp = Number(weather.temperature) || 0;
    const dashboardHumidity = Number(weather.humidity) || 0;
    const dashboardUv = Number(weather.uv) || 0;
    const dashboardCloud = Number(weather.cloudCover) || 0;
    const dashboardVisibility = Number(weather.visibility) || 0;
    const dashboardThunderstorm = forecast
      .slice(0, 24)
      .some((item) => /thunder|storm|lightning/i.test(String(item.weather || "")));

    const dashboardClamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));
    const dashboardRiskValues = [
      dashboardClamp(dashboardRainChance),
      dashboardClamp((dashboardWind / 60) * 100),
      dashboardClamp(((dashboardTemp - 30) / 12) * 100),
      dashboardClamp(
        (dashboardThunderstorm ? 65 : 0) +
          dashboardRainChance * 0.25 +
          dashboardCloud * 0.1 +
          (dashboardHumidity >= 80 ? 8 : 0)
      ),
      dashboardClamp(
        dashboardRainChance * 0.65 +
          (dashboardThunderstorm ? 20 : 0) +
          dashboardCloud * 0.1 +
          (dashboardHumidity >= 85 ? 8 : 0)
      ),
      dashboardClamp(
        Math.max(0, (dashboardTemp - 35) * 12) +
          Math.max(0, (dashboardUv - 5) * 7)
      ),
      dashboardVisibility <= 0
        ? 0
        : dashboardClamp(((10 - dashboardVisibility) / 9) * 100),
    ];

    const dashboardOverallRisk = Math.round(
      dashboardRiskValues.reduce((sum, value) => sum + value, 0) /
        dashboardRiskValues.length
    );

    const dashboardRiskLevel =
      dashboardOverallRisk >= 70
        ? "High"
        : dashboardOverallRisk >= 40
        ? "Moderate"
        : "Low";

    const dashboardAlertsCount = [
      dashboardRainChance >= 50,
      dashboardThunderstorm,
      dashboardWind >= 45,
      dashboardTemp >= 38 || (dashboardTemp >= 35 && dashboardUv >= 8),
      dashboardVisibility > 0 && dashboardVisibility < 5,
    ].filter(Boolean).length;

    const dashboardCards = [
      {
        title: "Dashboard",
        description: "Weather overview",
        icon: "🏠",
        value: formatTemperature(weather.temperature, settings.temperature),
        sub: currentLocation,
        page: "Dashboard",
      },
      {
        title: "Notifications",
        description: "Your latest updates",
        icon: "🔔",
        value: `${notifications.filter((item) => !item.read).length} Unread`,
        sub: "View notifications",
        page: "Notifications",
      },
      {
        title: "AI Weather Chat",
        description: "Ask weather questions",
        icon: "🤖",
        value: "Ask AI",
        sub: "Get intelligent answers",
        page: "AI Weather Chat",
      },
      {
        title: "Live Weather",
        description: "Current conditions",
        icon: weather.icon || "🌤️",
        value: formatTemperature(weather.temperature, settings.temperature),
        sub: weather.condition,
        page: "Live Weather",
      },
      {
        title: "Hourly Forecast",
        description: "Weather hour by hour",
        icon: "🕐",
        value: hourlyData.length
          ? formatTemperature(hourlyData[0].temp, settings.temperature)
          : "--",
        sub: hourlyData.length ? `${hourlyData[0].rain}% rain chance` : "Loading...",
        page: "Hourly Forecast",
      },
      {
        title: "7-Day Forecast",
        description: "Upcoming weather",
        icon: "📅",
        value: weeklyForecast.length
          ? formatTemperature(weeklyForecast[0].high, settings.temperature)
          : "--",
        sub: weeklyForecast.length ? weeklyForecast[0].condition : "Loading...",
        page: "7-Day Forecast",
      },
      {
        title: "Weather Alerts",
        description: "Warnings and advisories",
        icon: "⚠️",
        value: dashboardAlertsCount ? `${dashboardAlertsCount} Active` : "No Alerts",
        sub: dashboardAlertsCount ? "Tap to view alerts" : "Conditions look stable",
        page: "Weather Alerts",
      },
      {
        title: "Risk Assessment",
        description: "Weather risk analysis",
        icon: "🛡️",
        value: `${dashboardOverallRisk}/100`,
        sub: `${dashboardRiskLevel} risk`,
        page: "Risk Assessment",
      },
      {
        title: "Weather Map",
        description: "Explore weather on map",
        icon: "🗺️",
        value: currentLocation,
        sub: "Open interactive map",
        page: "Weather Map",
      },
      {
        title: "Locations",
        description: "Manage saved places",
        icon: "📍",
        value: `${locations.length} Locations`,
        sub: "View saved locations",
        page: "Locations",
      },
      {
        title: "Climate",
        description: "Historical climate trends",
        icon: "🌡️",
        value: "Climate Data",
        sub: "Explore historical trends",
        page: "Climate",
      },
      {
        title: "Agriculture",
        description: "Weather for farming",
        icon: "🌱",
        value: agriculture.crop || "Crop Insights",
        sub: "Get farming recommendations",
        page: "Agriculture",
      },
      {
        title: "Travel",
        description: "Weather for journeys",
        icon: "✈️",
        value: travelRisk?.level || "Travel Risk",
        sub: "Check travel conditions",
        page: "Travel",
      },
      {
        title: "Analytics",
        description: "Weather data analysis",
        icon: "📊",
        value: "Analytics",
        sub: "View weather statistics",
        page: "Analytics",
      },
      {
        title: "Settings",
        description: "Customize WeatherGPT",
        icon: "⚙️",
        value: settings.temperature,
        sub: `${settings.language} • Auto refresh ${settings.autoRefresh ? "On" : "Off"}`,
        page: "Settings",
      },
      {
        title: "Profile",
        description: "Your WeatherGPT profile",
        icon: "👤",
        value: profile?.name || "Profile",
        sub: profile?.role || "View profile",
        page: "Profile",
      },
    ];

    return (
      <div className="page-section dashboard-modern">
        <div className="dashboard-hero">
          <div className="dashboard-hero-content">
            <span className="dashboard-eyebrow">WEATHER INTELLIGENCE</span>
            <h1>
              {currentTime.getHours() < 5
                ? "Good night!"
                : currentTime.getHours() < 12
                ? "Good morning!"
                : currentTime.getHours() < 17
                ? "Good afternoon!"
                : currentTime.getHours() < 21
                ? "Good evening!"
                : "Good night!"} 👋
            </h1>
            <p>
              Welcome to WeatherGPT. Get live weather, forecasts, alerts and
              intelligent risk insights for your location.
            </p>
            <div className="dashboard-location-pill">📍 {currentLocation}</div>
          </div>

          <div className="dashboard-hero-weather">
            <div className="dashboard-hero-icon">{weather.icon || "🌤️"}</div>
            <strong>{formatTemperature(weather.temperature, settings.temperature)}</strong>
            <span>{weather.condition}</span>
          </div>
        </div>

        <div className="dashboard-action-row">
          <button
            className="dashboard-primary-action"
            onClick={() => setActiveMenu("AI Weather Chat")}
          >
            🤖 Ask WeatherGPT
          </button>
          <button className="dashboard-refresh-action" onClick={handleRefresh}>
            {isRefreshing ? "⟳ Refreshing..." : "↻ Refresh Weather"}
          </button>
        </div>

        <div className="dashboard-card-grid">
          {dashboardCards.map((card) => (
            <button
              className="dashboard-feature-card"
              key={card.title}
              onClick={() => setActiveMenu(card.page)}
              type="button"
            >
              <div className="dashboard-card-icon">{card.icon}</div>
              <div className="dashboard-card-body">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <strong>{card.value}</strong>
                <span>{card.sub}</span>
              </div>
              <div className="dashboard-card-arrow">→</div>
            </button>
          ))}
        </div>

        <div className="dashboard-stats-row">
          <div className="dashboard-stat-box">
            <span>💧 Humidity</span>
            <strong>{weather.humidity}%</strong>
          </div>
          <div className="dashboard-stat-box">
            <span>💨 Wind</span>
            <strong>{formatWind(weather.wind, settings.windSpeed)}</strong>
          </div>
          <div className="dashboard-stat-box">
            <span>🌧️ Rain Chance</span>
            <strong>{weather.rainChance}%</strong>
          </div>
          <div className="dashboard-stat-box">
            <span>☀️ UV Index</span>
            <strong>{weather.uv}</strong>
          </div>
        </div>

        <div className="dashboard-preview-grid">
          <div className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <h2>Today's Hourly Forecast</h2>
                <p>Next few hours</p>
              </div>
              <button onClick={() => setActiveMenu("Hourly Forecast")}>View all →</button>
            </div>

            <div className="dashboard-hourly-row">
              {hourlyData.slice(0, 6).map((hour) => (
                <button
                  className="dashboard-hour-card"
                  key={hour.time}
                  onClick={() => setActiveMenu("Hourly Forecast")}
                >
                  <span>{hour.time}</span>
                  <b>{hour.icon}</b>
                  <strong>{formatTemperature(hour.temp, settings.temperature)}</strong>
                  <small>💧 {hour.rain}%</small>
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-panel dashboard-risk-panel">
            <div className="dashboard-panel-heading">
              <div>
                <h2>Weather Risk</h2>
                <p>AI-powered assessment</p>
              </div>
              <button onClick={() => setActiveMenu("Risk Assessment")}>Details →</button>
            </div>

            <div className="dashboard-risk-score">
              <div>
                <strong>{dashboardOverallRisk}</strong>
                <span>/100</span>
              </div>
              <div>
                <b>{dashboardRiskLevel} Risk</b>
                <p>Based on current and upcoming weather conditions.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-footer-note">
          📍 Live weather data for <strong>{currentLocation}</strong> • Last updated: {lastUpdated}
        </div>
      </div>
    );
  };

const Notifications = () => {
  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  return (
    <div className="page-section">
      <div className="page-title">
        <span className="eyebrow">USER NOTIFICATIONS</span>

        <h1>Notifications 🔔</h1>

        <p>
          You have {unreadCount} unread notifications.
        </p>
      </div>

      <div className="notification-actions">
        <button
          className="secondary-btn"
          onClick={markAllNotificationsRead}
        >
          Mark All Read
        </button>
      </div>

      <div className="notifications-list">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`notification-card ${
              item.read ? "read" : "unread"
            }`}
          >
            <div
              className={`notification-icon ${item.type}`}
            >
              {item.type === "warning"
                ? "⚠️"
                : item.type === "danger"
                ? "⛈️"
                : "ℹ️"}
            </div>

            <div className="notification-content">
              <div className="notification-title">
                <h3>{item.title}</h3>

                {!item.read && <span>NEW</span>}
              </div>

              <p>{item.message}</p>

              <small>{item.time}</small>
            </div>

            {!item.read && (
              <button
                className="text-btn"
                onClick={() =>
                  markNotificationRead(item.id)
                }
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


/* =========================
   PROFILE
========================= */

const Profile = () => {
  const initials = profile.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "WG";
  const liveCity = liveProfile.location.city || currentLocation;
  const liveState = liveProfile.location.state || "";
  const liveDistrict = liveProfile.location.district || "";
  const liveCountry = liveProfile.location.country || "India";

  const saveProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, role: profile.role }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profile update failed");

      if (data.profile) {
        setProfile((prev) => ({ ...prev, ...data.profile }));
      }
    } catch (error) {
      console.warn("Profile backend update unavailable:", error);
    } finally {
      setProfileEditing(false);
    }
  };

  return (
    <div className="page-section">
      <div className="page-title">
        <span className="eyebrow">ACCOUNT</span>
        <h1>Profile 👤</h1>
        <p>Manage your WeatherGPT profile information.</p>
      </div>

      <div className="profile-layout">
        <div className="profile-card profile-main-card">
          <div className="profile-avatar">{initials}</div>

          {profileEditing ? (
            <div className="profile-edit-form">
              <label>Name</label>
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter your name"
              />

              <label>Role</label>
              <input
                value={profile.role}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, role: e.target.value }))
                }
                placeholder="Enter your role"
              />

              <button className="primary-btn" onClick={saveProfile}>
                Save Profile
              </button>
            </div>
          ) : (
            <>
              <h2>{profile.name}</h2>
              <p className="profile-role">{profile.role}</p>
              <button
                className="primary-btn"
                onClick={() => setProfileEditing(true)}
              >
                Edit Profile
              </button>
            </>
          )}
        </div>

        <div className="profile-card">
          <h2>Personal Information</h2>

          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span>Name</span>
              <strong>{profile.name}</strong>
            </div>

            <div className="profile-info-item">
              <span>Role</span>
              <strong>{profile.role}</strong>
            </div>

            <div className="profile-info-item">
              <span>Location</span>
              <strong>{liveCity}</strong>
              {liveState && <small>{liveState}</small>}
            </div>

            <div className="profile-info-item">
              <span>Member Since</span>
              <strong>{profile.memberSince || 2026}</strong>
            </div>
          </div>

          <div style={{ marginTop: "18px", fontSize: "13px", color: "#63806f" }}>
            📍 Live location: {liveCity}{liveDistrict ? `, ${liveDistrict}` : ""}{liveState ? `, ${liveState}` : ""}, {liveCountry}
            {liveProfile.location.latitude != null && (
              <span> · {Number(liveProfile.location.latitude).toFixed(4)}, {Number(liveProfile.location.longitude).toFixed(4)}</span>
            )}
          </div>
        </div>

        <div className="profile-card">
          <h2>Weather Preferences</h2>

          <div className="preference-row">
            <span>Default Location</span>
            <strong>{liveCity}</strong>
          </div>

          <div className="preference-row">
            <span>Temperature Unit</span>
            <strong>
              {settings.temperature === "Celsius" ? "°C" : "°F"}
            </strong>
          </div>

          <div className="preference-row">
            <span>Wind Speed</span>
            <strong>{settings.windSpeed}</strong>
          </div>

          <div className="preference-row">
            <span>Rainfall Unit</span>
            <strong>mm</strong>
          </div>

          <div className="preference-row">
            <span>Weather Alerts</span>
            <strong>{settings.weatherAlerts ? "Enabled" : "Disabled"}</strong>
          </div>

          <div className="preference-row">
            <span>Auto Refresh</span>
            <strong>{settings.autoRefresh ? "Enabled" : "Disabled"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
const Settings = () => {

  return (
    <div className="page-section">
      <div className="page-title">
        <span className="eyebrow">PREFERENCES</span>

        <h1>Settings ⚙️</h1>

        <p>
          Customize your WeatherGPT experience.
        </p>
      </div>

      <div className="settings-grid">

        {/* WEATHER UNITS */}

        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>Weather Units</h2>
              <p>
                Choose how weather information is displayed.
              </p>
            </div>

            <span className="settings-icon">
              🌡️
            </span>
          </div>

          <div className="setting-row">
            <div>
              <strong>Temperature</strong>
              <span>Select temperature unit</span>
            </div>

            <select
              value={settings.temperature}
              onChange={(e) =>
                updateSetting(
                  "temperature",
                  e.target.value
                )
              }
            >
              <option>Celsius</option>
              <option>Fahrenheit</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <strong>Wind Speed</strong>
              <span>Select wind speed unit</span>
            </div>

            <select
              value={settings.windSpeed}
              onChange={(e) =>
                updateSetting(
                  "windSpeed",
                  e.target.value
                )
              }
            >
              <option>km/h</option>
              <option>mph</option>
              <option>m/s</option>
            </select>
          </div>
        </div>


        {/* NOTIFICATIONS */}

        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>Notifications</h2>
              <p>
                Control weather notifications and alerts.
              </p>
            </div>

            <span className="settings-icon">
              🔔
            </span>
          </div>

          <div className="setting-row">
            <div>
              <strong>Notifications</strong>
              <span>
                Receive WeatherGPT notifications
              </span>
            </div>

            <button
              className={`toggle ${
                settings.notifications
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                updateSetting(
                  "notifications",
                  !settings.notifications
                )
              }
            >
              <span></span>
            </button>
          </div>

          <div className="setting-row">
            <div>
              <strong>Weather Alerts</strong>
              <span>
                Receive severe weather warnings
              </span>
            </div>

            <button
              className={`toggle ${
                settings.weatherAlerts
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                updateSetting(
                  "weatherAlerts",
                  !settings.weatherAlerts
                )
              }
            >
              <span></span>
            </button>
          </div>
        </div>


        {/* APPLICATION */}

        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>Application</h2>
              <p>
                General WeatherGPT preferences.
              </p>
            </div>

            <span className="settings-icon">
              ⚙️
            </span>
          </div>

          <div className="setting-row">
            <div>
              <strong>Language</strong>
              <span>
                Application language
              </span>
            </div>

            <select
              value={settings.language}
              onChange={(e) =>
                updateSetting(
                  "language",
                  e.target.value
                )
              }
            >
              <option>English</option>
              <option>Telugu</option>
              <option>Hindi</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <strong>Auto Refresh</strong>
              <span>
                Automatically update weather data
              </span>
            </div>

            <button
              className={`toggle ${
                settings.autoRefresh
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                updateSetting(
                  "autoRefresh",
                  !settings.autoRefresh
                )
              }
            >
              <span></span>
            </button>
          </div>
        </div>


        {/* ABOUT */}

        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2>About WeatherGPT</h2>
              <p>
                Application information.
              </p>
            </div>

            <span className="settings-icon">
              🌤️
            </span>
          </div>

          <div className="about-info">

            <div>
              <span>Application</span>
              <strong>WeatherGPT</strong>
            </div>

            <div>
              <span>Version</span>
              <strong>1.0.0</strong>
            </div>

            <div>
              <span>Platform</span>
              <strong>
                Smart Weather Intelligence
              </strong>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
  /* ================================
     AI WEATHER CHAT
  ================================= */

  const AIWeatherChat = () => (
    <div className="page-section">
      <h1 className="page-title">
        AI Weather Chat 🤖
      </h1>

      <p className="page-description">
        Ask WeatherGPT questions about weather, travel,
        farming and weather risks.
      </p>
      <div className="current-day">
              {new Date().toLocaleDateString([], {
              weekday: "long",
              month: "long",
             day: "numeric",
             year: "numeric",
  })}
 </div>

      <div className="chat-box">
        <div className="chat-header">
          <div className="ai-profile">
            <div className="chat-avatar">🤖</div>

            <div>
              <div className="ai-name">
                WeatherGPT
              </div>

              <div className="ai-status">
                ● Online
              </div>
            </div>
          </div>

          <button
            className="clear-chat"
            onClick={clearChat}
          >
            Clear Chat
          </button>
        </div>

        <div className="messages">
          {messages.map((item, index) => (
            <div
              className={`message-row ${
                item.type === "user" ? "user" : ""
              }`}
              key={index}
            >
              {item.type === "ai" && (
                <div className="chat-avatar">
                  🤖
                </div>
              )}

              <div
                className={`message ${
                  item.type === "user"
                    ? "user-message"
                    : ""
                }`}
              >
                {item.text}

                <div className="message-time">
                  {item.time}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="message-row">
              <div className="chat-avatar">🤖</div>

              <div className="typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        <div className="suggestion-title">
          Suggested questions
        </div>

        <div className="suggestions">
          {[
            "Will it rain today?",
            "What should I wear?",
            "Is it safe to travel?",
            "Weather tomorrow?",
            "Is weather good for crops?",
          ].map((question) => (
            <button
              className="suggestion"
              key={question}
              onClick={() => setMessage(question)}
            >
              {question}
            </button>
          ))}
        </div>

        <div className="chat-input-area">
          <input
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendChatMessage();
              }
            }}
            placeholder="Ask WeatherGPT..."
          />

          <button className="voice-button">
            🎤
          </button>

          <button
            className="send-button"
            onClick={sendChatMessage}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );

  /* ================================
     LIVE WEATHER
  ================================= */

  const LiveWeather = () => (
    <div className="page-section">
      <h1 className="page-title">
        Live Weather 🌤️
      </h1>

      <p className="page-description">
        Current weather conditions for Bengaluru.
      </p>

      <div className="live-weather-card">
        <div className="weather-location">
          📍 {weather.location}
        </div>

        <div className="temperature-info">
          <div className="large-weather">
            {weather.icon}
          </div>

          <div className="temperature">
            {formatTemperature(weather.temperature, settings.temperature)}
          </div>

          <div>
            <div className="weather-condition">
              {weather.condition}
            </div>

            <div className="feels-like">
              Feels like {formatTemperature(weather.feelsLike, settings.temperature)}
            </div>
          </div>
        </div>
      </div>

      <div className="live-details-grid">
        <div className="detail-card">
          <div className="detail-label">
            Humidity
          </div>

          <div className="detail-value">
            {weather.humidity}%
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            Wind
          </div>

          <div className="detail-value">
            {formatWind(weather.wind, settings.windSpeed)}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            Direction
          </div>

          <div className="detail-value">
            {weather.windDirection}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            Pressure
          </div>

          <div className="detail-value">
            {weather.pressure} hPa
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            Visibility
          </div>

          <div className="detail-value">
            {weather.visibility} km
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            Cloud Cover
          </div>

          <div className="detail-value">
            {weather.cloudCover}%
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            UV Index
          </div>

          <div className="detail-value">
            {weather.uv}
          </div>
        </div>

        <div className="detail-card">
          <div className="detail-label">
            Rain Chance
          </div>

          <div className="detail-value">
            {weather.rainChance}%
          </div>
        </div>
      </div>
    </div>
  );

  /* ================================
     HOURLY
  ================================= */

  const HourlyForecast = () => {
    const hour = hourlyData[selectedHour];

    return (
      <div className="page-section">
        <h1 className="page-title">
          Hourly Forecast 🕐
        </h1>

        <p className="page-description">
                    Detailed weather forecast for the next several hours.
                   </p>

                   <div className="current-day">
                   {new Date().toLocaleDateString([], {
                   weekday: "long",
                   month: "long",
                  day: "numeric",
                  year: "numeric",
  })}
</div>



        <div className="hourly-container">
          {hourlyData.map((item, index) => (
            <div
              key={`${item.time}-${index}`}
              className={`hour ${
                selectedHour === index
                  ? "active-hour"
                  : ""
              }`}
              onClick={() => setSelectedHour(index)}
            >
              <div className="hour-time">
              {item.time}
              </div>

              <div className="hour-icon">
                {item.icon}
              </div>

              <div className="hour-temp">
                {formatTemperature(item.temp, settings.temperature)}
              </div>

              <div className="hour-rain">
                💧 {item.rain}%
              </div>

              <div className="small-title">
                💨 {formatWind(item.wind, settings.windSpeed)}
              </div>
            </div>
          ))}
        </div>

        <div className="selected-details">
          <h3>{hour.time} Weather Details</h3>

          <div className="live-details-grid">
            <div className="detail-card">
              <div className="detail-label">
                Condition
              </div>

              <div className="detail-value">
                {hour.condition}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Temperature
              </div>

              <div className="detail-value">
                {formatTemperature(hour.temp, settings.temperature)}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Rain Chance
              </div>

              <div className="detail-value">
                {hour.rain}%
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Wind
              </div>

              <div className="detail-value">
                {formatWind(hour.wind, settings.windSpeed)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     7 DAY
  ================================= */

  const SevenDayForecast = () => {
   const day = (weeklyForecast.length ? weeklyForecast : weeklyData)[selectedDay];

    return (
      <div className="page-section">
        <h1 className="page-title">
          7-Day Forecast 📅
        </h1>

        <p className="page-description">
          Plan your week with WeatherGPT predictions.
        </p>

        <div className="forecast-grid">
          {(weeklyForecast.length ? weeklyForecast : weeklyData).map((item, index) => (
            <div
              key={item.date}
              className={`forecast-card ${
                selectedDay === index ? "today" : ""
              }`}
              onClick={() => setSelectedDay(index)}
            >
              <div className="forecast-day">
                {item.day}
              </div>

              <div className="forecast-date">
                {item.date}
              </div>

              <div className="forecast-icon">
                {item.icon}
              </div>

              <div className="forecast-condition">
                {item.condition}
              </div>

              <div className="forecast-temp">
                <span className="high-temp">
                  {item.high}°
                </span>{" "}
                /{" "}
                <span className="low-temp">
                  {item.low}°
                </span>
              </div>

              <div className="forecast-rain">
                💧 {item.rain}%
              </div>
            </div>
          ))}
        </div>

        <div className="selected-day-details">
          <div className="selected-day-icon">
            {day.icon}
          </div>

          <h2>
            {day.day}, {day.date}
          </h2>

          <p>{day.condition}</p>

          <div className="live-details-grid">
            <div className="detail-card">
              <div className="detail-label">
                High
              </div>

              <div className="detail-value">
                {formatTemperature(day.high, settings.temperature)}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Low
              </div>

              <div className="detail-value">
                {formatTemperature(day.low, settings.temperature)}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Rain
              </div>

              <div className="detail-value">
                {day.rain}%
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Wind
              </div>

              <div className="detail-value">
                {formatWind(day.wind, settings.windSpeed)}
              </div>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h3>Weekly Temperature</h3>

          <div className="temperature-chart">
            {(weeklyForecast.length ? weeklyForecast : weeklyData).map((item, index) => (
              <div
                className="chart-column"
                key={item.date}
              >
                <span>{item.high}°</span>

                <div
                  className="chart-bar"
                  style={{
                    height: `${item.high * 4}px`,
                  }}
                ></div>

                <small>
                  {item.day.slice(0, 3)}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     ALERTS
  ================================= */

  useEffect(() => {
    // Read state belongs to the selected location.
    // Changing GPS/city starts a fresh alert center for that location.
    setReadAlerts([]);
  }, [currentLocation]);

  const WeatherAlerts = () => {
    const orangeCount = alerts.filter((alert) => alert.severity === 'orange').length;
    const yellowCount = alerts.filter((alert) => alert.severity === 'yellow').length;

    return (
      <div className="page-section">
        <h1 className="page-title">Weather Alerts ⚠️</h1>

        <p className="page-description">
          Live weather and disaster-risk alerts for <strong>{currentLocation}</strong>.
        </p>

        <div className="current-day">
          {new Date().toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>

        <div className="alert-summary">
          <div className="big-alert yellow">
            <div className="alert-severity">ACTIVE</div>
            <div className="alert-main">{yellowCount} Yellow Alert{yellowCount === 1 ? '' : 's'}</div>
            <div className="alert-meta">Weather advisory</div>
          </div>

          <div className="big-alert orange">
            <div className="alert-severity">ACTIVE</div>
            <div className="alert-main">{orangeCount} Orange Alert{orangeCount === 1 ? '' : 's'}</div>
            <div className="alert-meta">Higher-risk conditions</div>
          </div>

          <div className="big-alert yellow">
            <div className="alert-severity">STATUS</div>
            <div className="alert-main">{alerts.filter((alert) => readAlerts.includes(alert.id)).length} Read</div>
            <div className="alert-meta">Alert center</div>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="alert-card">
            <h3>🟢 No active weather-risk alerts</h3>
            <p>
              No threshold-based rainfall, flood, thunderstorm, strong-wind,
              extreme-heat, or low-visibility alert is currently detected for{' '}
              <strong>{currentLocation}</strong>.
            </p>
            <div className="safety-box">
              🛡️ Continue monitoring the forecast and official local disaster-management warnings.
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div className="alert-card" key={alert.id}>
              <h3>
                {alert.severity === 'orange' ? '🟠' : '🟡'} {alert.title}
              </h3>

              <p>
                <strong>Location:</strong> {alert.location}
              </p>

              <p>
                <strong>Time:</strong> {alert.start} - {alert.end}
              </p>

              <p>{alert.description}</p>

              <div className="safety-box">
                🛡️ <strong>Recommendation:</strong> {alert.recommendation}
              </div>

              <button
                className="read-button"
                onClick={() => {
                  if (!readAlerts.includes(alert.id)) {
                    setReadAlerts((prev) => [...prev, alert.id]);
                  }
                }}
              >
                {readAlerts.includes(alert.id) ? '✓ Read' : 'Mark as Read'}
              </button>
            </div>
          ))
        )}

        <div className="climate-source">
          <div className="source-icon">🛡️</div>
          <div>
            <strong>WeatherGPT Disaster-Risk Intelligence</strong>
            <p>
              Alerts are generated from the live weather and upcoming forecast for{' '}
              <strong>{currentLocation}</strong>. Changing your GPS location or selected
              location recalculates these alerts automatically. These are advisory risk
              indicators and do not replace official IMD or government emergency warnings.
            </p>
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     RISK
  ================================= */

  const RiskAssessment = () => {
    /*
     * Risk values are calculated from the same live weather + forecast data
     * used by the rest of the application. When currentLocation changes,
     * fetchWeather()/fetchForecast() update these values automatically.
     */
    const clamp = (value, min = 0, max = 100) =>
      Math.max(min, Math.min(max, Number(value) || 0));

    const getRiskLevel = (value) => {
      if (value >= 70) return "High";
      if (value >= 40) return "Moderate";
      return "Low";
    };

    const getForecastRain = () => {
      if (!forecast.length) return Number(weather.rainChance) || 0;

      return Math.max(
        Number(weather.rainChance) || 0,
        ...forecast.slice(0, 24).map((item) => Number(item.rain_chance) || 0)
      );
    };

    const hasThunderstormForecast = forecast
      .slice(0, 24)
      .some((item) => /thunder|storm|lightning/i.test(String(item.weather || "")));

    const temperature = Number(weather.temperature) || 0;
    const humidity = Number(weather.humidity) || 0;
    const wind = Number(weather.wind) || 0;
    const rainChance = clamp(getForecastRain());
    const uv = Number(weather.uv) || 0;
    const visibility = Number(weather.visibility) || 0;
    const cloudCover = Number(weather.cloudCover) || 0;

    // Rain risk: directly reflects the live/forecast precipitation probability.
    const rainRisk = clamp(rainChance);

    // Wind risk: increases as sustained wind approaches/exceeds 60 km/h.
    const windRisk = clamp((wind / 60) * 100);

    // Heat risk: starts becoming meaningful above 30°C and becomes high above 40°C.
    const heatRisk = clamp(((temperature - 30) / 12) * 100);

    // Thunderstorm risk uses forecast condition + rain/cloud indicators.
    const thunderstormRisk = clamp(
      (hasThunderstormForecast ? 65 : 0) +
        rainChance * 0.25 +
        cloudCover * 0.1 +
        (humidity >= 80 ? 8 : 0)
    );

    // Flood risk is based on precipitation probability, heavy-rain forecast,
    // cloud cover and humidity. This is a weather-risk indicator, not a
    // government flood warning.
    const floodRisk = clamp(
      rainChance * 0.65 +
        (hasThunderstormForecast ? 20 : 0) +
        cloudCover * 0.1 +
        (humidity >= 85 ? 8 : 0)
    );

    // Extreme heat combines temperature and UV exposure.
    const extremeHeatRisk = clamp(
      Math.max(0, (temperature - 35) * 12) + Math.max(0, (uv - 5) * 7)
    );

    // Visibility risk increases when visibility falls below 10 km.
    const visibilityRisk =
      visibility <= 0
        ? 0
        : clamp(((10 - visibility) / 9) * 100);

    const risks = [
      {
        icon: "🌧️",
        name: "Rain Risk",
        value: Math.round(rainRisk),
        reason: `Rain probability is ${Math.round(rainChance)}% in the current/near-term forecast.`,
      },
      {
        icon: "💨",
        name: "Wind Risk",
        value: Math.round(windRisk),
        reason: `Current wind speed is ${formatWind(wind, settings.windSpeed)}.`,
      },
      {
        icon: "🔥",
        name: "Heat Risk",
        value: Math.round(heatRisk),
        reason: `Current temperature is ${formatTemperature(temperature, settings.temperature)}.`,
      },
      {
        icon: "⛈️",
        name: "Thunderstorm",
        value: Math.round(thunderstormRisk),
        reason: hasThunderstormForecast
          ? "Thunderstorm conditions appear in the next 24 hours of the forecast."
          : "No thunderstorm condition is currently indicated in the next 24 hours.",
      },
      {
        icon: "🌊",
        name: "Flood Risk",
        value: Math.round(floodRisk),
        reason: `Based on rain probability, cloud cover (${Math.round(cloudCover)}%) and humidity (${Math.round(humidity)}%).`,
      },
      {
        icon: "☀️",
        name: "Extreme Heat",
        value: Math.round(extremeHeatRisk),
        reason: `Temperature is ${formatTemperature(temperature, settings.temperature)} with a UV index of ${uv.toFixed(1)}.`,
      },
      {
        icon: "🌫️",
        name: "Visibility",
        value: Math.round(visibilityRisk),
        reason:
          visibility > 0
            ? `Current visibility is approximately ${visibility.toFixed(1)} km.`
            : "Live visibility data is not available.",
      },
    ].map((risk) => ({
      ...risk,
      value: clamp(risk.value),
      level: getRiskLevel(risk.value),
    }));

    const overallRisk = Math.round(
      risks.reduce((sum, risk) => sum + risk.value, 0) / risks.length
    );
    const overallLevel = getRiskLevel(overallRisk);

    const mainFactors = [...risks]
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((risk) => risk.name.toLowerCase())
      .join(" and ");

    const riskMessage =
      overallRisk >= 70
        ? `High weather risk at ${currentLocation}. ${mainFactors} are the main factors affecting the current assessment.`
        : overallRisk >= 40
        ? `Moderate weather risk at ${currentLocation}. ${mainFactors} are the main factors affecting the current assessment.`
        : `Low weather risk at ${currentLocation}. Current weather conditions are generally favorable, but continue monitoring the forecast.`;

    const loadingLiveWeather = weather.condition === "Loading...";

    return (
      <div className="page-section">
        <h1 className="page-title">
          Risk Assessment 🛡️
        </h1>

        <p className="page-description">
          AI-powered weather risk analysis for <strong>{currentLocation}</strong>,
          calculated from live weather and the upcoming forecast.
        </p>

        {loadingLiveWeather ? (
          <div className="climate-loading">
            <div className="loading-spinner"></div>
            <h3>Loading live risk assessment...</h3>
            <p>Fetching current weather and forecast for <strong>{currentLocation}</strong>.</p>
          </div>
        ) : (
          <>
            <div className="overall-risk">
              <div className="risk-score">
                <strong>{overallRisk}</strong>
                <span>/100</span>
              </div>

              <div>
                <h2>{overallLevel} Overall Risk</h2>
                <p>{riskMessage}</p>
              </div>
            </div>

            <div className="detailed-risk-grid">
              {risks.map((risk) => (
                <div
                  className="detailed-risk-card"
                  key={risk.name}
                >
                  <div className="detailed-risk-header">
                    <div>
                      <div className="risk-icon-large">
                        {risk.icon}
                      </div>

                      <strong>{risk.name}</strong>
                    </div>

                    <div className="risk-percentage">
                      {risk.value}%
                    </div>
                  </div>

                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${risk.value}%`,
                      }}
                    ></div>
                  </div>

                  <p className="risk-reason">
                    Risk level: <strong>{risk.level}</strong>
                  </p>

                  <div className="risk-recommendation">
                    💡 {risk.reason}
                  </div>
                </div>
              ))}
            </div>

            <div className="climate-source">
              <div className="source-icon">🤖</div>
              <div>
                <strong>WeatherGPT Live Risk Insight</strong>
                <p>
                  These values update automatically whenever the selected location's
                  live weather changes. Use the Locations page or GPS button to
                  change the location being assessed.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  /* ================================
     LOCATIONS
  ================================= */

  const Locations = () => (
  <div className="page-section">
    <h1 className="page-title">Locations 📍</h1>
    <p className="page-description">Manage your favorite weather locations.</p>
    <div className="location-search">
      <input placeholder="Enter city name..." value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addLocation(); }} />
      <button onClick={addLocation}>+ Add Location</button>
    </div>
    <div className="locations-grid">
      {locations.map((location) => (
        <div className="location-card" key={location.id}>
          <div className="location-card-top">
            <div><h3>📍 {location.name}</h3><p>{location.state}</p></div>
            <button className="favorite-button" onClick={() => toggleFavorite(location.id)} title="Toggle favorite">{location.favorite ? "★" : "☆"}</button>
          </div>
          <div className="location-weather"><div className="location-icon">{location.icon}</div><div><div className="location-temp">{formatTemperature(location.temp, settings.temperature)}</div><div className="small-title">{location.condition}</div></div></div>
          <div className="location-high-low"><span className="high-temp">↑ {location.high}°</span><span className="low-temp">↓ {location.low}°</span></div>
          <div className="location-card-actions">
            <button className="primary-btn" onClick={() => selectLocation(location.name)}>{currentLocation.toLowerCase() === location.name.toLowerCase() ? "Current Location" : "Use This Location"}</button>
            <button className="delete-location" onClick={() => deleteLocation(location.id)}>🗑️ Remove</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

  /* ================================
     AGRICULTURE
  ================================= */

  const Agriculture = () => {
    const result = getAgricultureResult();

    return (
      <div className="page-section">
        <h1 className="page-title">
          Smart Agriculture 🌱
        </h1>

        <p className="page-description">
          Get weather-based crop and irrigation recommendations.
        </p>

        <div className="agriculture-form">
          <div className="form-group">
            <label>Location</label>

            <input
              value={agriculture.location}
              onChange={(e) => {
                const value = e.target.value;

                setAgriculture((prev) => ({
                  ...prev,
                  location: value,
                }));
              }}
            />
          </div>

          <div className="form-group">
            <label>Crop</label>

            <select
              value={agriculture.crop}
              onChange={(e) =>
                setAgriculture({
                  ...agriculture,
                  crop: e.target.value,
                })
              }
            >
              <option>Tomato</option>
              <option>Rice</option>
              <option>Wheat</option>
              <option>Maize</option>
              <option>Groundnut</option>
            </select>
          </div>

          <div className="form-group">
            <label>Soil Type</label>

            <select
              value={agriculture.soil}
              onChange={(e) =>
                setAgriculture({
                  ...agriculture,
                  soil: e.target.value,
                })
              }
            >
              <option>Loamy</option>
              <option>Clay</option>
              <option>Sandy</option>
              <option>Black Soil</option>
              <option>Red Soil</option>
            </select>
          </div>

          <div className="form-group">
            <label>Season</label>

            <select
              value={agriculture.season}
              onChange={(e) =>
                setAgriculture({
                  ...agriculture,
                  season: e.target.value,
                })
              }
            >
              <option>Kharif</option>
              <option>Rabi</option>
              <option>Summer</option>
            </select>
          </div>
        </div>

        <div className="agriculture-result">
          <div className="agriculture-result-header">
            <div>
              <span className="result-icon">
                🌱
              </span>

              <h2>{agriculture.crop}</h2>
            </div>

            <div className="suitability">
              {result.suitability} Suitability
            </div>
          </div>

          <p className="result-description">
            {result.recommendation}
          </p>

          <div className="live-details-grid">
            <div className="detail-card">
              <div className="detail-label">
                Irrigation
              </div>

              <div className="detail-value">
                {result.irrigation}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Sowing Period
              </div>

              <div className="detail-value">
                {result.sowing}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Water Requirement
              </div>

              <div className="detail-value">
                {result.water}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-label">
                Weather
              </div>

              <div className="detail-value">
                28°C
              </div>
            </div>
          </div>

          <div className="agriculture-tips">
            <h3>🌿 Farming Tips</h3>

            {result.tips.map((tip) => (
              <div key={tip}>
                ✓ {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     TRAVEL
  ================================= */

  const Travel = () => {
    const risk = getTravelRisk();

    const destinationWeather = risk.destinationWeather || {};
    const departureWeather = risk.departureWeather || {};

    return (
      <div className="page-section">
        <h1 className="page-title">
          Smart Travel ✈️
        </h1>

        <p className="page-description">
          Check weather conditions at your departure and destination for the exact date and time.
        </p>

        <div className="travel-form">
          <div className="form-group">
            <label>From</label>

            <input
              value={travel.from}
              onChange={(e) => {
                const value = e.target.value;

                setTravel((prev) => ({
                  ...prev,
                  from: value,
                }));
              }}
              placeholder="Departure city"
            />
          </div>

          <div className="form-group">
            <label>To</label>

            <input
              value={travel.to}
              onChange={(e) => {
                const value = e.target.value;

                setTravel((prev) => ({
                  ...prev,
                  to: value,
                }));
              }}
              placeholder="Destination city"
            />
          </div>

          <div className="form-group">
            <label>Date</label>

            <input
              type="date"
              value={travel.date}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => {
                const value = e.target.value;

                setTravel((prev) => ({
                  ...prev,
                  date: value,
                }));
              }}
            />
          </div>

          <div className="form-group">
            <label>Time</label>

            <input
              type="time"
              value={travel.time}
              onChange={(e) => {
                const value = e.target.value;

                setTravel((prev) => ({
                  ...prev,
                  time: value,
                }));
              }}
            />
          </div>
        </div>

        <div className="travel-result">
          <div className="travel-route">
            <div>
              <span>📍</span>
              <strong>{travel.from || "Departure"}</strong>
            </div>

            <div className="route-line">
              →
            </div>

            <div>
              <span>📍</span>
              <strong>{travel.to || "Destination"}</strong>
            </div>
          </div>

          <div className="travel-weather">
            <div className="travel-weather-icon">
              {destinationWeather.icon || "🌤️"}
            </div>

            <div>
              <div className="temperature">
                {destinationWeather.temperature !== undefined
                  ? formatTemperature(destinationWeather.temperature, settings.temperature)
                  : "Checking..."}
              </div>

              <div>
                {destinationWeather.condition || "Checking destination weather"}
              </div>
            </div>
          </div>

          <div className="travel-risk">
            <div className="travel-risk-icon">
              {risk.icon}
            </div>

            <div>
              <h2>
                Travel Risk: {risk.level}
                {risk.score !== null && risk.score !== undefined
                  ? ` (${risk.score}/100)`
                  : ""}
              </h2>

              <p>{risk.description}</p>

              {risk.reason && (
                <p className="small-title">
                  {risk.reason}
                </p>
              )}
            </div>
          </div>

          {risk.loading ? (
            <div className="loading-card">
              Checking both cities for the selected travel time...
            </div>
          ) : (
            <div className="travel-metrics">
              <div>
                🌧️
                <strong>
                  {destinationWeather.rainProbability !== undefined
                    ? `${destinationWeather.rainProbability}%`
                    : "--"}
                </strong>
                Rain
              </div>

              <div>
                💨
                <strong>
                  {destinationWeather.wind !== undefined
                    ? formatWind(destinationWeather.wind, settings.windSpeed)
                    : "--"}
                </strong>
                Wind
              </div>

              <div>
                🌡️
                <strong>
                  {destinationWeather.temperature !== undefined
                    ? formatTemperature(destinationWeather.temperature, settings.temperature)
                    : "--"}
                </strong>
                Temperature
              </div>

              <div>
                👁️
                <strong>
                  {destinationWeather.visibility !== undefined
                    ? `${destinationWeather.visibility.toFixed(1)} km`
                    : "--"}
                </strong>
                Visibility
              </div>
            </div>
          )}

          {!risk.loading && risk.recommendations?.length > 0 && (
            <div className="travel-recommendations">
              <h3>Travel Recommendations</h3>

              {risk.recommendations.map((item) => (
                <div key={item}>
                  ✓ {item}
                </div>
              ))}
            </div>
          )}

          {!risk.loading && departureWeather.temperature !== undefined && (
            <div className="small-title">
              Departure at selected time: {formatTemperature(departureWeather.temperature, settings.temperature, 1)},{" "}
              {departureWeather.condition},{" "}
              {departureWeather.rainProbability}% rain chance,{" "}
              {formatWind(departureWeather.wind, settings.windSpeed)} wind.
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ================================
     ANALYTICS DATA FETCH
  ================================= */

  const fetchAnalytics = async (range = analyticsRange) => {
    const controller = new AbortController();

    setAnalyticsData({
      loading: true,
      error: "",
      location: currentLocation,
      points: [],
    });

    try {
      // Find the selected city coordinates.
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          currentLocation
        )}&count=1&language=en&format=json&countryCode=IN`,
        { signal: controller.signal }
      );

      const geoData = await geoResponse.json();

      if (!geoResponse.ok || !geoData.results?.length) {
        throw new Error(`Unable to find "${currentLocation}".`);
      }

      const place = geoData.results[0];
      const latitude = place.latitude;
      const longitude = place.longitude;

      // 7 = 7 completed days, 30 = 30 completed days, 365 = one year.
      const days =
        range === "30"
          ? 30
          : range === "365"
          ? 365
          : 7;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (days - 1));

      const toISODate = (date) => date.toISOString().slice(0, 10);

      const start = toISODate(startDate);
      const end = toISODate(endDate);

      const weatherResponse = await fetch(
        `https://archive-api.open-meteo.com/v1/archive` +
          `?latitude=${latitude}` +
          `&longitude=${longitude}` +
          `&start_date=${start}` +
          `&end_date=${end}` +
          `&daily=temperature_2m_mean,precipitation_sum,wind_speed_10m_max` +
          `&hourly=relative_humidity_2m` +
          `&timezone=auto`,
        { signal: controller.signal }
      );

      const weatherData = await weatherResponse.json();

      if (!weatherResponse.ok) {
        throw new Error(
          weatherData.reason || "Unable to fetch historical weather."
        );
      }

      const daily = weatherData.daily;

      if (!daily?.time?.length) {
        throw new Error("No historical weather data was returned.");
      }

      // Build daily humidity averages from hourly humidity.
      const humidityByDate = {};

      if (
        weatherData.hourly?.time &&
        weatherData.hourly?.relative_humidity_2m
      ) {
        weatherData.hourly.time.forEach((time, index) => {
          const date = time.slice(0, 10);
          const value = Number(
            weatherData.hourly.relative_humidity_2m[index]
          );

          if (!Number.isNaN(value)) {
            if (!humidityByDate[date]) humidityByDate[date] = [];
            humidityByDate[date].push(value);
          }
        });
      }

      const dailyRows = daily.time.map((date, index) => {
        const humidityValues = humidityByDate[date] || [];
        const humidity =
          humidityValues.length > 0
            ? humidityValues.reduce((sum, value) => sum + value, 0) /
              humidityValues.length
            : 0;

        return {
          date,
          temperature: Number(daily.temperature_2m_mean?.[index] ?? 0),
          rainfall: Number(daily.precipitation_sum?.[index] ?? 0),
          humidity: Number(humidity.toFixed(1)),
          wind: Number(daily.wind_speed_10m_max?.[index] ?? 0),
        };
      });

      let points = [];

      if (range === "7") {
        points = dailyRows.map((item) => ({
          ...item,
          label: new Date(`${item.date}T12:00:00`).toLocaleDateString([], {
            weekday: "short",
          }),
        }));
      } else if (range === "30") {
        // For 30 days, show 5 weekly trend points to keep the charts readable.
        for (let i = 0; i < dailyRows.length; i += 7) {
          const chunk = dailyRows.slice(i, i + 7);

          const average = (key) =>
            chunk.reduce((sum, item) => sum + item[key], 0) / chunk.length;

          points.push({
            label: `${i + 1}-${Math.min(i + 7, 30)}`,
            temperature: Number(average("temperature").toFixed(1)),
            rainfall: Number(
              chunk
                .reduce((sum, item) => sum + item.rainfall, 0)
                .toFixed(1)
            ),
            humidity: Number(average("humidity").toFixed(1)),
            wind: Number(average("wind").toFixed(1)),
          });
        }
      } else {
        // For one year, show 12 monthly trend points.
        const months = {};

        dailyRows.forEach((item) => {
          const monthKey = item.date.slice(0, 7);

          if (!months[monthKey]) {
            months[monthKey] = [];
          }

          months[monthKey].push(item);
        });

        points = Object.entries(months).map(([monthKey, items]) => {
          const average = (key) =>
            items.reduce((sum, item) => sum + item[key], 0) /
            items.length;

          return {
            label: new Date(`${monthKey}-15T12:00:00`).toLocaleDateString(
              [],
              {
                month: "short",
              }
            ),
            temperature: Number(average("temperature").toFixed(1)),
            rainfall: Number(
              items
                .reduce((sum, item) => sum + item.rainfall, 0)
                .toFixed(1)
            ),
            humidity: Number(average("humidity").toFixed(1)),
            wind: Number(average("wind").toFixed(1)),
          };
        });
      }

      setAnalyticsData({
        loading: false,
        error: "",
        location:
          place.name ||
          currentLocation,
        points,
      });
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Analytics error:", error);

      setAnalyticsData({
        loading: false,
        error: error.message || "Unable to load analytics.",
        location: currentLocation,
        points: [],
      });
    }

    return () => controller.abort();
  };

  useEffect(() => {
    if (activeMenu === "Analytics") {
      fetchAnalytics(analyticsRange);
    }
  }, [activeMenu, currentLocation, analyticsRange]);

  /* ================================
     ANALYTICS
  ================================= */

  const Analytics = () => {
    const points = analyticsData.points;

    const maxTemperature = Math.max(
      ...points.map((item) => item.temperature),
      1
    );

    const maxRainfall = Math.max(
      ...points.map((item) => item.rainfall),
      1
    );

    const maxHumidity = Math.max(
      ...points.map((item) => item.humidity),
      1
    );

    const maxWind = Math.max(
      ...points.map((item) => item.wind),
      1
    );

    const average = (key) => {
      if (!points.length) return 0;

      return (
        points.reduce((sum, item) => sum + item[key], 0) /
        points.length
      );
    };

    const totalRainfall = points.reduce(
      (sum, item) => sum + item.rainfall,
      0
    );

    const rangeTitle =
      analyticsRange === "7"
        ? "7 Days"
        : analyticsRange === "30"
        ? "30 Days"
        : "1 Year";

    const rangeSubtitle =
      analyticsRange === "7"
        ? "Daily historical trend"
        : analyticsRange === "30"
        ? "Weekly trend across the last 30 days"
        : "Monthly trend across the last year";

    return (
      <div className="page-section">
        <h1 className="page-title">
          Weather Analytics 📊
        </h1>

        <p className="page-description">
          Analyze temperature, rainfall, humidity and wind trends for{" "}
          <strong>{analyticsData.location || currentLocation}</strong>.
        </p>

        <div className="analytics-filters">
          {[
            ["7", "7 Days"],
            ["30", "30 Days"],
            ["365", "1 Year"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`analytics-filter ${
                analyticsRange === value ? "active" : ""
              }`}
              onClick={() => setAnalyticsRange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {analyticsData.loading && (
          <div className="loading-card">
            Loading historical weather analytics for{" "}
            <strong>{currentLocation}</strong>...
          </div>
        )}

        {analyticsData.error && (
          <div className="error-card">
            {analyticsData.error}
          </div>
        )}

        {!analyticsData.loading && !analyticsData.error && points.length > 0 && (
          <>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>🌡️ Temperature</h3>

                <div className="analytics-chart">
                  {points.map((item, index) => (
                    <div
                      className="analytics-column"
                      key={`${item.label}-${index}`}
                    >
                      <div
                        className="analytics-bar"
                        style={{
                          height: `${Math.max(
                            12,
                            (item.temperature / maxTemperature) * 230
                          )}px`,
                        }}
                        title={`${item.label}: ${formatTemperature(item.temperature, settings.temperature)}`}
                      ></div>

                      <span>{formatTemperature(item.temperature, settings.temperature)}</span>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>

                <div className="chart-label">
                  {rangeSubtitle}
                </div>
              </div>

              <div className="analytics-card">
                <h3>🌧️ Rainfall</h3>

                <div className="analytics-chart">
                  {points.map((item, index) => (
                    <div
                      className="analytics-column"
                      key={`${item.label}-rain-${index}`}
                    >
                      <div
                        className="analytics-bar rain-bar"
                        style={{
                          height: `${Math.max(
                            12,
                            (item.rainfall / maxRainfall) * 230
                          )}px`,
                        }}
                        title={`${item.label}: ${item.rainfall} mm`}
                      ></div>

                      <span>{Math.round(item.rainfall)} mm</span>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>

                <div className="chart-label">
                  Total precipitation shown for {rangeTitle.toLowerCase()}
                </div>
              </div>

              <div className="analytics-card">
                <h3>💧 Humidity</h3>

                <div className="analytics-chart">
                  {points.map((item, index) => (
                    <div
                      className="analytics-column"
                      key={`${item.label}-humidity-${index}`}
                    >
                      <div
                        className="analytics-bar"
                        style={{
                          height: `${Math.max(
                            12,
                            (item.humidity / 100) * 230
                          )}px`,
                        }}
                        title={`${item.label}: ${item.humidity}%`}
                      ></div>

                      <span>{Math.round(item.humidity)}%</span>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>

                <div className="chart-label">
                  Average relative humidity
                </div>
              </div>

              <div className="analytics-card">
                <h3>💨 Wind Speed</h3>

                <div className="analytics-chart">
                  {points.map((item, index) => (
                    <div
                      className="analytics-column"
                      key={`${item.label}-wind-${index}`}
                    >
                      <div
                        className="analytics-bar"
                        style={{
                          height: `${Math.max(
                            12,
                            (item.wind / maxWind) * 230
                          )}px`,
                        }}
                        title={`${item.label}: ${formatWind(item.wind, settings.windSpeed)}`}
                      ></div>

                      <span>{convertWind(item.wind, settings.windSpeed).toFixed(1)}</span>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>

                <div className="chart-label">
                  Maximum daily wind speed
                </div>
              </div>
            </div>

            <div className="analytics-summary-grid">
              <div className="stat-card blue">
                <div className="stat-label">Average Temperature</div>
                <div className="stat-value">
                  {convertTemperature(average("temperature"), settings?.temperature).toFixed(1)}°{settings?.temperature === "Fahrenheit" ? "F" : "C"}
                </div>
              </div>

              <div className="stat-card green">
                <div className="stat-label">Total Rainfall</div>
                <div className="stat-value">
                  {totalRainfall.toFixed(1)} mm
                </div>
              </div>

              <div className="stat-card yellow">
                <div className="stat-label">Average Humidity</div>
                <div className="stat-value">
                  {average("humidity").toFixed(1)}%
                </div>
              </div>

              <div className="stat-card orange">
                <div className="stat-label">Average Wind</div>
                <div className="stat-value">
                  {convertWind(average("wind"), settings?.windSpeed).toFixed(1)} {settings?.windSpeed || "km/h"}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  /* ================================
     COMING SOON
  ================================= */

 const ComingSoon = ({ title }) => (
  <div className="coming-soon-card">
    <div className="coming-soon-icon">
      ðŸš€
    </div>

    <h2>{title}</h2>

    <p>
      This WeatherGPT feature is available in the next
      development phase.
    </p>
  </div>
);
  /* ================================
     PAGE ROUTER
  ================================= */

  const renderPage = () => {
    switch (activeMenu) {
      case "Dashboard":
        return Dashboard();

      case "Notifications":
        return Notifications();

      case "AI Weather Chat":
        return AIWeatherChat();

      case "Live Weather":
        return LiveWeather();

      case "Hourly Forecast":
        return HourlyForecast();

      case "7-Day Forecast":
        return SevenDayForecast();

      case "Weather Alerts":
        return WeatherAlerts();

      case "Risk Assessment":
        return RiskAssessment();

      case "Weather Map":
        return (
          <WeatherMap
            currentLocation={currentLocation}
            currentCoordinates={currentCoordinates}
            currentWeather={weather}
            locations={locations}
            mapLayer={mapLayer}
            setMapLayer={setMapLayer}
            locationSearch={locationSearch}
            setLocationSearch={setLocationSearch}
            onSearchLocation={addLocation}
            onUseMyLocation={handleUseMyLocation}
            onSelectLocation={(name) => {
              setCurrentLocation(name);
              setCurrentCoordinates(null);
            }}
          />
        );

      case "Locations":
        return Locations();

      case "Climate":
        return <Climate currentLocation={currentLocation} settings={settings} />;

      case "Agriculture":
        return Agriculture();

      case "Travel":
        return Travel();

      case "Analytics":
        return Analytics();

      case "Profile":
        return Profile();

      case "Settings":
        return Settings();

      default:
        return Dashboard();
    }
  };

  /* ================================
     MAIN UI
  ================================= */

  return (
    <div className="app">
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">
            🌦️
          </div>

          <div className="logo-text">
            WeatherGPT
          </div>
        </div>

        {menuGroups.map((group) => (
          <div
            className="menu-group"
            key={group.title}
          >
            <div className="menu-group-title">
              {group.title}
            </div>

            {group.items.map(([name, icon]) => (
              <button
                key={name}
                className={`menu-item ${
                  activeMenu === name
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActiveMenu(name)
                }
              >
                <span className="menu-icon">
                  {icon}
                </span>

                <span>{name}</span>
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          <button
            className={`menu-item ${
              activeMenu === "Settings"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveMenu("Settings")
            }
          >
            <span className="menu-icon">
              ⚙️
            </span>

            Settings
          </button>

          <button
            className={`menu-item ${
              activeMenu === "Profile"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveMenu("Profile")
            }
          >
            <span className="menu-icon">
              👤
            </span>

            Profile
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <main className="main">
        <header className="topbar">
          <div>
            <div className="small-title">
              Weather Intelligence
            </div>

            <div className="page-heading">
              {activeMenu}
            </div>
          </div>

          <div className="top-actions">
            <button
              className="icon-button"
              onClick={() =>
                setActiveMenu("Notifications")
              }
              title="Notifications"
            >
              🔔
            </button>

            <button
              className="location-button"
              onClick={() => setActiveMenu("Locations")}
              title="Open saved locations"
            >
              📍 {currentLocation}
            </button>

            <button
              className="icon-button"
              onClick={handleUseMyLocation}
              title="Use my current location"
              aria-label="Use my current location"
            >
              🎯
            </button>

            <button
              className="profile-button"
              onClick={() => setActiveMenu("Profile")}
              title="Profile"
            >
              {profile.name.trim().charAt(0).toUpperCase() || "R"}
            </button>
          </div>
        </header>

        {renderPage()}

        <footer className="footer">
          <span>
            🌦️ WeatherGPT — AI-powered Weather Intelligence
          </span>

          <span>
            Frontend Demo • Smart India Hackathon
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;