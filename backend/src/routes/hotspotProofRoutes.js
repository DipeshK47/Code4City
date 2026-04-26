const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const {
  createCoverageProof,
  createProfileCoverageProof,
  getCoverageProofsForCurrentUser,
  getCoverageProofsForHotspot,
} = require("../controllers/hotspotProofController");

const router = express.Router();
router.post("/hotspots/:id/coverage-proof", requireAuth, createCoverageProof);
router.post("/hotspots/profile-coverage-proof", requireAuth, createProfileCoverageProof);
router.get("/hotspots/:id/coverage-proofs", requireAuth, getCoverageProofsForHotspot);
router.get("/users/me/coverage-proofs", requireAuth, getCoverageProofsForCurrentUser);

module.exports = router;
