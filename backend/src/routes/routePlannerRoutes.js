const express = require("express");
const router = express.Router();
const { postPlan } = require("../controllers/routePlannerController");

router.post("/plan", postPlan);

module.exports = router;
