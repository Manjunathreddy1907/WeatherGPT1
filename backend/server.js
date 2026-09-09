const express = require("express");
const cors = require("cors");
const path = require("path");

/*
=================================
ENVIRONMENT VARIABLES
=================================
*/

// Load backend/.env correctly
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

/*
=================================
ROUTES
=================================
*/

const weatherRoutes = require("./routes/weather");
const forecastRoutes = require("./routes/forecast");
const featuresRoutes = require("./routes/features");
const chatRoutes = require("./routes/chat");
const analyticsRoutes = require("./routes/analytics");
const settingsRoutes = require("./routes/settings");
const locationRoutes = require("./routes/location");
const profileRoutes = require("./routes/profile");

// NEW: Forecast Accuracy Route
const accuracyRoutes = require("./routes/accuracy");

/*
=================================
EXPRESS APP
=================================
*/

const app = express();

/*
=================================
MIDDLEWARE
=================================
*/

app.use(cors());

app.use(express.json());

/*
=================================
WEATHER APIs
=================================
*/

// Current weather
app.use("/api/weather", weatherRoutes);

// Weather forecast
app.use("/api/forecast", forecastRoutes);

/*
=================================
ANALYTICS API
=================================
*/

// Historical weather analytics
// 7 / 30 days = daily data
// 365 days = monthly data

app.use("/api/analytics", analyticsRoutes);

/*
=================================
FORECAST ACCURACY API
=================================
*/

// Verified forecast accuracy
//
// Uses:
// Previous Model Runs API
// +
// Historical Weather API
//
// Calculates:
// Temperature accuracy
// Humidity accuracy
// Wind accuracy
// Rain event accuracy
// Overall accuracy

app.use("/api/accuracy", accuracyRoutes);

/*
=================================
OTHER FRONTEND FEATURES
=================================
*/

// Locations
// Notifications
// Agriculture
// Travel
// Risk Assessment
// Weather Alerts

app.use("/api", featuresRoutes);

/*
=================================
LOCATION API
=================================
*/

// Reverse geocoding
// Latitude + Longitude
// -> City
// -> State
// -> District
// -> Country

app.use("/api/location", locationRoutes);

/*
=================================
PROFILE API
=================================
*/

// Live profile location data
//
// Example:
// /api/profile?lat=12.9716&lon=77.5946

app.use("/api/profile", profileRoutes);

/*
=================================
SETTINGS API
=================================
*/

// Temperature units
// Wind speed units
// Notifications
// Weather alerts
// Auto refresh
// Language

app.use("/api/settings", settingsRoutes);

/*
=================================
AI CHAT API
=================================
*/

app.use("/api/chat", chatRoutes);

/*
=================================
TEST APIs
=================================
*/

// General backend test
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "WeatherGPT Backend is working",
  });
});

// Location test
app.get("/api/location-test", (req, res) => {
  res.json({
    success: true,
    message: "Location route is registered",
    endpoint: "/api/location",
  });
});

// Profile test
app.get("/api/profile-test", (req, res) => {
  res.json({
    success: true,
    message: "Profile route is registered",
    endpoint: "/api/profile",
  });
});

// Settings test
app.get("/api/settings-test", (req, res) => {
  res.json({
    success: true,
    message: "Settings route is registered",
    endpoint: "/api/settings",
  });
});

// Analytics test
app.get("/api/analytics-test", (req, res) => {
  res.json({
    success: true,
    message: "Analytics route is registered",
    endpoint: "/api/analytics",
  });
});

// Accuracy test
app.get("/api/accuracy-test", (req, res) => {
  res.json({
    success: true,
    message: "Forecast Accuracy route is registered",
    endpoint: "/api/accuracy",
  });
});

/*
=================================
FRONTEND BUILD
=================================
*/

// Vite creates:
//
// PROJECT/dist
//
// Structure:
//
// PROJECT/
// ├── dist/
// └── backend/
//     └── server.js
//
// Therefore:
// backend/server.js
//       ↓
// ../dist

const frontendDist = path.join(__dirname, "..", "dist");

/*
=================================
SERVE FRONTEND
=================================
*/

app.use(express.static(frontendDist));

/*
=================================
REACT SPA FALLBACK
=================================
*/

// Express 5 does not support:
// app.get("*", ...)
//
// So we use middleware instead.
//
// This allows React routes such as:
//
// /dashboard
// /live-weather
// /forecast
// /analytics
// /settings
// /profile
// /accuracy
//
// to load index.html.

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api")
  ) {
    return res.sendFile(
      path.join(frontendDist, "index.html")
    );
  }

  next();
});

/*
=================================
404 HANDLER
=================================
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.originalUrl,
  });
});

/*
=================================
ERROR HANDLER
=================================
*/

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

/*
=================================
START SERVER
=================================
*/

// Local:
// http://localhost:5001
//
// Render:
// Render automatically provides PORT.
//
// Therefore we use:
// process.env.PORT || 5001

const PORT = Number(process.env.PORT) || 5001;

app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log("WeatherGPT Production Server");
  console.log(`Port: ${PORT}`);
  console.log("Frontend: /dist");
  console.log("API: /api");
  console.log("Weather: /api/weather");
  console.log("Forecast: /api/forecast");
  console.log("Analytics: /api/analytics");

  // NEW
  console.log("Accuracy: /api/accuracy");

  console.log("Location: /api/location");
  console.log("Profile: /api/profile");
  console.log("Settings: /api/settings");
  console.log("Chat: /api/chat");
  console.log("=================================");
});