const express = require("express");
const { getOrCreateMyQrCode } = require("../controllers/qrController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);
router.get("/me", getOrCreateMyQrCode);

module.exports = router;

