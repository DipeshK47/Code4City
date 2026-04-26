const express = require("express");
const router = express.Router();
const { getContext, createFlyer, getFlyer } = require("../controllers/flyerController");

router.get("/context", getContext);
router.post("/", createFlyer);
router.get("/:id", getFlyer);

module.exports = router;
