const express = require("express");
const { signup, login, me, agreeToTerms, uploadProfilePhoto } = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", me);
router.post("/agree-terms", agreeToTerms);
router.post("/profile-photo", uploadProfilePhoto);

module.exports = router;
