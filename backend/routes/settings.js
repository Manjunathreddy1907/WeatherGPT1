const express = require("express");

const router = express.Router();

/*
  Default WeatherGPT settings
*/
let settings = {
  temperature: "Celsius",
  windSpeed: "km/h",
  notifications: true,
  weatherAlerts: true,
  autoRefresh: true,
  language: "English",
};

/*
  GET /api/settings
  Get current settings
*/
router.get("/", (req, res) => {
  res.json({
    success: true,
    settings,
  });
});

/*
  PUT /api/settings
  Update settings
*/
router.put("/", (req, res) => {
  try {
    const allowedFields = [
      "temperature",
      "windSpeed",
      "notifications",
      "weatherAlerts",
      "autoRefresh",
      "language",
    ];

    const updates = req.body || {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        settings[field] = updates[field];
      }
    }

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Settings update error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to update settings",
    });
  }
});

/*
  PATCH /api/settings/:key
  Update one setting
*/
router.patch("/:key", (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const allowedFields = [
      "temperature",
      "windSpeed",
      "notifications",
      "weatherAlerts",
      "autoRefresh",
      "language",
    ];

    if (!allowedFields.includes(key)) {
      return res.status(400).json({
        success: false,
        error: `Invalid setting: ${key}`,
      });
    }

    settings[key] = value;

    res.json({
      success: true,
      message: `${key} updated successfully`,
      settings,
    });
  } catch (error) {
    console.error("Setting update error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to update setting",
    });
  }
});

/*
  POST /api/settings/reset
  Reset everything to default
*/
router.post("/reset", (req, res) => {
  settings = {
    temperature: "Celsius",
    windSpeed: "km/h",
    notifications: true,
    weatherAlerts: true,
    autoRefresh: true,
    language: "English",
  };

  res.json({
    success: true,
    message: "Settings reset successfully",
    settings,
  });
});

module.exports = router;