const {
  getStoredNeedRegions,
  importNeedRegionsFromNycOpenData,
} = require("../services/needRegionService");
const {
  getRegionInsightsByCode,
} = require("../services/regionInsightsService");

const getAllNeedRegions = async (req, res) => {
  try {
    const [regions, insights] = await Promise.all([
      getStoredNeedRegions(),
      getRegionInsightsByCode().catch(() => new Map()),
    ]);

    const enriched = regions.map((region) => {
      const insight = insights.get(region.regionCode);
      return {
        ...region,
        dominantGap: insight?.dominantGap || null,
        categoryGaps: insight?.categoryGaps || [],
      };
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const importNeedRegions = async (req, res) => {
  try {
    const result = await importNeedRegionsFromNycOpenData();
    require("../services/regionInsightsService").invalidateInsightsCache();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllNeedRegions,
  importNeedRegions,
};
