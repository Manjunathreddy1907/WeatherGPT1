const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        success: false,
        error: "Valid latitude and longitude are required",
      });
    }

    const url = new URL(
      "https://nominatim.openstreetmap.org/reverse"
    );

    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "WeatherGPT-Hackathon/1.0",
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error || "Reverse geocoding failed",
      });
    }

    const address = data.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      "Current Location";

    const state = address.state || "";

    const district =
      address.state_district ||
      address.county ||
      "";

    const country = address.country || "";

    const postcode = address.postcode || "";

    res.json({
      success: true,
      profileLocation: {
        city,
        state,
        district,
        country,
        postcode,
        latitude: lat,
        longitude: lon,
        display_name: data.display_name || "",
      },
    });
  } catch (error) {
    console.error("Profile location error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to determine current location",
    });
  }
});

module.exports = router;