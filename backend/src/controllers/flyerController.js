const {
  getFlyerContext,
  saveFlyer,
  getFlyerById,
} = require("../services/flyerService");

async function getContext(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: "lat and lng required" });
    }
    const data = await getFlyerContext({ lat, lng });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function createFlyer(req, res) {
  try {
    const {
      userId,
      dropName,
      lat,
      lng,
      regionCode,
      regionName,
      dominantCategory,
      headline,
      blurb,
      resources,
      qrSlug,
      qrTargetUrl,
      secondaryLanguage,
      secondaryLanguageName,
      headlineTranslated,
      blurbTranslated,
      translatedLabels,
    } = req.body || {};

    if (!dropName || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "dropName, lat, and lng are required",
      });
    }
    if (!dominantCategory || !headline || !blurb) {
      return res.status(400).json({
        success: false,
        message: "dominantCategory, headline, and blurb are required",
      });
    }

    const flyer = await saveFlyer({
      userId,
      dropName,
      lat,
      lng,
      regionCode,
      regionName,
      dominantCategory,
      headline,
      blurb,
      resources,
      qrSlug,
      qrTargetUrl,
      secondaryLanguage,
      secondaryLanguageName,
      headlineTranslated,
      blurbTranslated,
      translatedLabels,
    });

    res.status(200).json({ success: true, data: flyer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getFlyer(req, res) {
  try {
    const flyer = await getFlyerById(req.params.id);
    if (!flyer) {
      return res.status(404).json({ success: false, message: "Flyer not found" });
    }
    res.status(200).json({ success: true, data: flyer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getContext,
  createFlyer,
  getFlyer,
};
