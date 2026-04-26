const express = require("express");
const cors = require("cors");
const locationRoutes = require("./routes/locationRoutes");
const needRegionRoutes = require("./routes/needRegionRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const authRoutes = require("./routes/authRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const activityRoutes = require("./routes/activityRoutes");
const badgesRoutes = require("./routes/badgesRoutes");
const routeItemRoutes = require("./routes/routeItemRoutes");
const qrRoutes = require("./routes/qrRoutes");
const communityRoutes = require("./routes/communityRoutes");
const meetupRoutes = require("./routes/meetupRoutes");
const messageRoutes = require("./routes/messageRoutes");
const hotspotProofRoutes = require("./routes/hotspotProofRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Backend is running" });
});

app.use("/api/locations", locationRoutes);
app.use("/api/need-regions", needRegionRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/badges", badgesRoutes);
app.use("/api/route-items", routeItemRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/meetups", meetupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api", hotspotProofRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/qr", qrRoutes);

const { handleScanAndRedirect } = require("./controllers/qrController");
app.get("/qr/:slug", handleScanAndRedirect);

module.exports = app;
