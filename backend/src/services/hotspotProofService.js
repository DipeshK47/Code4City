const { getPool, query } = require("../db");
const { getHotspotById } = require("./osmHotspotService");
const {
  findNeedRegionForPointInRegions,
  getStoredNeedRegions,
} = require("./needRegionService");

const PROFILE_PROOF_MATCH_THRESHOLD_MILES = 0.12;

function mapProofRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    hotspotId: String(row.hotspot_id),
    hotspotName: row.hotspot_name || null,
    hotspotAddress: row.hotspot_address || null,
    userId: String(row.user_id),
    username: row.username || null,
    photoUrl: row.photo_url,
    notes: row.notes || "",
    submittedAt:
      row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function submitCoverageProof({ hotspotId, userId, photoUrl, notes }) {
  const client = await getPool().connect();
  const normalizedNotes = normalizeNotes(notes);
  const activityDate = new Date().toISOString().slice(0, 10);

  try {
    await client.query("BEGIN");

    const hotspotResult = await client.query(
      `
        SELECT id
        FROM hotspot_locations
        WHERE id = $1
        FOR UPDATE
      `,
      [hotspotId],
    );
    if (!hotspotResult.rows[0]) {
      throw new Error("Hotspot not found.");
    }

    const userResult = await client.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
      `,
      [userId],
    );
    if (!userResult.rows[0]) {
      throw new Error("Authenticated user was not found.");
    }

    const proofResult = await client.query(
      `
        INSERT INTO hotspot_coverage_proofs (
          hotspot_id,
          user_id,
          photo_url,
          notes
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [hotspotId, userId, photoUrl, normalizedNotes],
    );

    await client.query(
      `
        UPDATE hotspot_locations
        SET
          covered = TRUE,
          last_checked = $1,
          assigned_to = $2,
          notes = CASE
            WHEN COALESCE($3, '') = '' THEN notes
            ELSE $3
          END,
          updated_at = NOW()
        WHERE id = $4
      `,
      ["Proof submitted just now", "Volunteer confirmed", normalizedNotes, hotspotId],
    );

    await client.query(
      `
        INSERT INTO user_stats (id, flyers, hours, scans)
        VALUES ($1, 1, 0, 0)
        ON CONFLICT (id) DO UPDATE SET
          flyers = COALESCE(user_stats.flyers, 0) + 1
      `,
      [userId],
    );

    await client.query(
      `
        INSERT INTO user_daily_activity (user_id, date, flyers, hours)
        VALUES ($1, $2, 1, 0)
        ON CONFLICT (user_id, date) DO UPDATE SET
          flyers = user_daily_activity.flyers + 1
      `,
      [userId, activityDate],
    );

    await client.query("COMMIT");

    const hotspot = await getHotspotById(hotspotId);

    return {
      proof: attachHotspotSummary(mapProofRow(proofResult.rows[0]), hotspot),
      hotspot,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function submitProfileCoverageProof({ userId, photoUrl, notes, lat, lng }) {
  const client = await getPool().connect();
  const normalizedNotes = normalizeNotes(notes);
  const activityDate = new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Photo location metadata is required.");
  }

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
      `,
      [userId],
    );
    if (!userResult.rows[0]) {
      throw new Error("Authenticated user was not found.");
    }

    let hotspotId = await findNearbyHotspotId(client, lat, lng);
    let usedExistingHotspot = Boolean(hotspotId);

    if (!hotspotId) {
      hotspotId = await createProfileProofHotspot(client, {
        userId,
        lat,
        lng,
        notes: normalizedNotes,
      });
      usedExistingHotspot = false;
    }

    const proofResult = await client.query(
      `
        INSERT INTO hotspot_coverage_proofs (
          hotspot_id,
          user_id,
          photo_url,
          notes
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [hotspotId, userId, photoUrl, normalizedNotes],
    );

    await client.query(
      `
        UPDATE hotspot_locations
        SET
          covered = TRUE,
          last_checked = $1,
          assigned_to = $2,
          notes = CASE
            WHEN COALESCE($3, '') = '' THEN notes
            ELSE $3
          END,
          updated_at = NOW()
        WHERE id = $4
      `,
      ["Proof submitted just now", "Volunteer confirmed", normalizedNotes, hotspotId],
    );

    await client.query(
      `
        INSERT INTO user_stats (id, flyers, hours, scans)
        VALUES ($1, 1, 0, 0)
        ON CONFLICT (id) DO UPDATE SET
          flyers = COALESCE(user_stats.flyers, 0) + 1
      `,
      [userId],
    );

    await client.query(
      `
        INSERT INTO user_daily_activity (user_id, date, flyers, hours)
        VALUES ($1, $2, 1, 0)
        ON CONFLICT (user_id, date) DO UPDATE SET
          flyers = user_daily_activity.flyers + 1
      `,
      [userId, activityDate],
    );

    await client.query("COMMIT");

    const hotspot = await getHotspotById(hotspotId);

    return {
      proof: attachHotspotSummary(mapProofRow(proofResult.rows[0]), hotspot),
      hotspot,
      usedExistingHotspot,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCoverageProofsForHotspot(hotspotId) {
  const hotspot = await getHotspotById(hotspotId);
  if (!hotspot) {
    return null;
  }

  const result = await query(
    `
      SELECT
        proofs.*,
        users.username,
        hotspots.name AS hotspot_name,
        hotspots.address AS hotspot_address
      FROM hotspot_coverage_proofs proofs
      JOIN users ON users.id = proofs.user_id
      JOIN hotspot_locations hotspots ON hotspots.id = proofs.hotspot_id
      WHERE proofs.hotspot_id = $1
      ORDER BY proofs.submitted_at DESC
    `,
    [hotspotId],
  );

  return result.rows.map(mapProofRow);
}

async function listCoverageProofsForUser(userId) {
  const result = await query(
    `
      SELECT
        proofs.*,
        users.username,
        hotspots.name AS hotspot_name,
        hotspots.address AS hotspot_address
      FROM hotspot_coverage_proofs proofs
      JOIN users ON users.id = proofs.user_id
      JOIN hotspot_locations hotspots ON hotspots.id = proofs.hotspot_id
      WHERE proofs.user_id = $1
      ORDER BY proofs.submitted_at DESC
    `,
    [userId],
  );

  return result.rows.map(mapProofRow);
}

function normalizeNotes(notes) {
  if (typeof notes !== "string") return "";
  return notes.trim();
}

function attachHotspotSummary(proof, hotspot) {
  if (!proof || !hotspot) {
    return proof;
  }

  return {
    ...proof,
    hotspotName: proof.hotspotName || hotspot.name,
    hotspotAddress: proof.hotspotAddress || hotspot.address,
  };
}

async function findNearbyHotspotId(client, lat, lng) {
  const result = await client.query(
    `
      SELECT id, lat, lng
      FROM hotspot_locations
      WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
      LIMIT 250
    `,
    [lat - 0.02, lat + 0.02, lng - 0.02, lng + 0.02],
  );

  let nearestHotspotId = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const row of result.rows) {
    const distance = getDistanceMiles(lat, lng, Number(row.lat), Number(row.lng));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestHotspotId = row.id;
    }
  }

  if (nearestDistance <= PROFILE_PROOF_MATCH_THRESHOLD_MILES) {
    return nearestHotspotId;
  }

  return null;
}

async function createProfileProofHotspot(client, { userId, lat, lng, notes }) {
  const importedAt = new Date().toISOString();
  const needRegions = await getStoredNeedRegions();
  const matchedRegion = findNeedRegionForPointInRegions(lat, lng, needRegions);
  const tagsJson = JSON.stringify({
    source: "profile-proof",
    userId,
    capturedLat: lat,
    capturedLng: lng,
  });
  const sourceKey = `proof:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  const result = await client.query(
    `
      INSERT INTO hotspot_locations (
        source_key,
        osm_id,
        osm_type,
        name,
        category,
        address,
        neighborhood,
        region_code,
        region_name,
        region_need_score,
        priority,
        score,
        covered,
        last_checked,
        assigned_to,
        notes,
        lat,
        lng,
        tags_json,
        imported_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, TRUE, $13, $14, $15, $16, $17, $18::jsonb, $19::timestamptz, $20::timestamptz
      )
      RETURNING id
    `,
    [
      sourceKey,
      sourceKey,
      "proof",
      "Volunteer Proof Spot",
      "Custom Proof",
      "GPS-tagged flyer proof upload",
      "Volunteer submitted",
      matchedRegion?.regionCode || null,
      matchedRegion?.regionName || null,
      matchedRegion?.foodNeedScore ?? null,
      "Medium",
      6.4,
      "Proof submitted just now",
      "Volunteer confirmed",
      notes || "Volunteer-uploaded proof from profile.",
      lat,
      lng,
      tagsJson,
      importedAt,
      importedAt,
    ],
  );

  return result.rows[0].id;
}

function getDistanceMiles(fromLat, fromLng, toLat, toLng) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

module.exports = {
  listCoverageProofsForHotspot,
  listCoverageProofsForUser,
  submitCoverageProof,
  submitProfileCoverageProof,
};
