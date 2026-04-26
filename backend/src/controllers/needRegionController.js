const {
  getStoredNeedRegions,
  importNeedRegionsFromNycOpenData,
} = require("../services/needRegionService");

const getAllNeedRegions = async (req, res) => {
  try {
    const regions = await getStoredNeedRegions();

    res.status(200).json({
      success: true,
      count: regions.length,
      data: regions,
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
