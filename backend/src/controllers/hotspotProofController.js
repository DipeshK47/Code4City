const {
  listCoverageProofsForHotspot,
  listCoverageProofsForUser,
  submitCoverageProof,
  submitProfileCoverageProof,
} = require("../services/hotspotProofService");

async function createCoverageProof(req, res) {
  try {
    const { imageUrl, notes } = req.body || {};

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: "A proof photo is required.",
      });
    }

    const result = await submitCoverageProof({
      hotspotId: req.params.id,
      userId: req.user.id,
      photoUrl: imageUrl.trim(),
      notes,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit coverage proof.";
    const status =
      message === "Hotspot not found." ? 404 : message === "Authenticated user was not found." ? 401 : 500;

    return res.status(status).json({
      success: false,
      message,
    });
  }
}

async function createProfileCoverageProof(req, res) {
  try {
    const { imageUrl, notes, lat, lng } = req.body || {};

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: "A proof photo is required.",
      });
    }

    const result = await submitProfileCoverageProof({
      userId: req.user.id,
      photoUrl: imageUrl.trim(),
      notes,
      lat: Number(lat),
      lng: Number(lng),
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit profile coverage proof.";
    const status =
      message === "Authenticated user was not found."
        ? 401
        : message === "Photo location metadata is required."
          ? 400
          : 500;

    return res.status(status).json({
      success: false,
      message,
    });
  }
}

async function getCoverageProofsForHotspot(req, res) {
  try {
    const proofs = await listCoverageProofsForHotspot(req.params.id);

    if (proofs === null) {
      return res.status(404).json({
        success: false,
        message: "Hotspot not found.",
      });
    }

    return res.status(200).json({
      success: true,
      count: proofs.length,
      data: proofs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to load hotspot proofs.",
    });
  }
}

async function getCoverageProofsForCurrentUser(req, res) {
  try {
    const proofs = await listCoverageProofsForUser(req.user.id);

    return res.status(200).json({
      success: true,
      count: proofs.length,
      data: proofs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to load your hotspot proofs.",
    });
  }
}

module.exports = {
  createCoverageProof,
  createProfileCoverageProof,
  getCoverageProofsForCurrentUser,
  getCoverageProofsForHotspot,
};
