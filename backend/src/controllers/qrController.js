const crypto = require("crypto");
const { pool } = require("../db");

const DEFAULT_RESOURCE_COORDS = "40.7128,-74.0060";
const APP_BASE_URL =
  process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DEFAULT_FLYERS_URL = `${APP_BASE_URL.replace(/\/$/, "")}/resources/${DEFAULT_RESOURCE_COORDS}`;

async function getOrCreateMyQrCode(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT id, slug, target_url FROM user_qrcodes WHERE user_id = $1",
        [userId],
      );

      let slug;
      let targetUrl;

      if (existing.rows[0]) {
        slug = existing.rows[0].slug;
        targetUrl = existing.rows[0].target_url;
      } else {
        slug = crypto.randomBytes(6).toString("hex");
        targetUrl = DEFAULT_FLYERS_URL;

        await client.query(
          `
          INSERT INTO user_qrcodes (user_id, slug, target_url)
          VALUES ($1, $2, $3)
          `,
          [userId, slug, targetUrl],
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        slug,
        targetUrl,
        userId,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("getOrCreateMyQrCode error:", err);
      return res.status(500).json({ success: false, message: "Failed to create QR code." });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("getOrCreateMyQrCode outer error:", error);
    return res.status(500).json({ success: false, message: "Failed to create QR code." });
  }
}

async function handleScanAndRedirect(req, res) {
  const { slug } = req.params;

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        "SELECT user_id, target_url FROM user_qrcodes WHERE slug = $1",
        [slug],
      );

      const row = result.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return res.status(404).send("QR code not found");
      }

      const userId = row.user_id;
      const targetUrl = row.target_url || DEFAULT_FLYERS_URL;

      await client.query(
        `
        INSERT INTO user_stats (id, flyers, hours, scans, "updatedAt")
        VALUES ($1, 0, 0, 1, NOW())
        ON CONFLICT (id) DO UPDATE SET
          scans = COALESCE(user_stats.scans, 0) + 1,
          "updatedAt" = NOW()
        `,
        [userId],
      );

      await client.query("COMMIT");

      return res.redirect(302, targetUrl);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("handleScanAndRedirect error:", err);
      return res.status(500).send("Failed to handle QR scan.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("handleScanAndRedirect outer error:", error);
    return res.status(500).send("Failed to handle QR scan.");
  }
}

async function handleFlyerScan(req, res) {
  const { id } = req.params;

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Fetch the flyer to find who created it and what resources it has
      const result = await client.query(
        "SELECT user_id, resources_json, drop_lat, drop_lng FROM generated_flyers WHERE id = $1",
        [id],
      );

      const flyer = result.rows[0];
      if (!flyer) {
        await client.query("ROLLBACK");
        return res.status(404).send("Flyer not found");
      }

      const userId = flyer.user_id;

      // 2. Increment user scan stats if we have a userId
      if (userId) {
        await client.query(
          `
          INSERT INTO user_stats (id, flyers, hours, scans, "updatedAt")
          VALUES ($1, 0, 0, 1, NOW())
          ON CONFLICT (id) DO UPDATE SET
            scans = COALESCE(user_stats.scans, 0) + 1,
            "updatedAt" = NOW()
          `,
          [userId],
        );
      }

      await client.query("COMMIT");

      // 3. Build Google Maps URL with markers
      // We use the Google Maps Directions or Search with waypoints.
      // Search with a query for the first few resources is simple.
      // Or Directions starting from the user's scan loc (implicit) to the drop point via resources.
      const resources = typeof flyer.resources_json === 'string' 
        ? JSON.parse(flyer.resources_json) 
        : flyer.resources_json;

      let mapsUrl;
      if (resources && Array.isArray(resources) && resources.length > 0) {
        const destination = resources[resources.length - 1];
        const waypoints = resources.slice(0, -1)
          .map(r => `${r.lat},${r.lng}`)
          .join('|');
        
        // Directions API 1 format for "multiple markers" on a route
        mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination.address)}&destination_place_id=${destination.id || ''}&waypoints=${encodeURIComponent(waypoints)}`;
      } else {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${flyer.drop_lat},${flyer.drop_lng}`;
      }

      return res.redirect(302, mapsUrl);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("handleFlyerScan error:", err);
      return res.status(500).send("Failed to handle flyer scan.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("handleFlyerScan outer error:", error);
    return res.status(500).send("Failed to handle flyer scan.");
  }
}

module.exports = {
  getOrCreateMyQrCode,
  handleScanAndRedirect,
  handleFlyerScan,
};
