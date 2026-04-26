const crypto = require("crypto");
const { pool } = require("../db");

const DEFAULT_FLYERS_URL =
  "http://foodhelpline.org/locations/40.873835,-73.87953999999999?utm_source=resourceFlyer&utm_term=%5B40.873835,-73.87953999999999%5D&utm_content=flyer&utm_campaign=bronx";

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

module.exports = {
  getOrCreateMyQrCode,
  handleScanAndRedirect,
};

