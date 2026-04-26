const {
  listRouteItems,
  removeAllRouteItems,
  removeRouteItem,
  saveRouteItem,
} = require("../services/routeItemService");

async function getAllRouteItems(req, res) {
  try {
    const routeItems = await listRouteItems(req.user.id);

    return res.status(200).json({
      success: true,
      count: routeItems.length,
      data: routeItems,
    });
  } catch (error) {
    console.error("Get route items error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch route items.",
    });
  }
}

async function createRouteItem(req, res) {
  try {
    const routeItem = await saveRouteItem(req.body, req.user.id);

    return res.status(201).json({
      success: true,
      data: routeItem,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Could not save route item.",
    });
  }
}

async function deleteRouteItem(req, res) {
  try {
    const deletedRouteItem = await removeRouteItem(req.params.id, req.user.id);

    if (!deletedRouteItem) {
      return res.status(404).json({
        success: false,
        message: "Route item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: deletedRouteItem,
    });
  } catch (error) {
    console.error("Delete route item error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete route item.",
    });
  }
}

async function clearRouteItems(req, res) {
  try {
    const deletedRouteItems = await removeAllRouteItems(req.user.id);

    return res.status(200).json({
      success: true,
      count: deletedRouteItems.length,
      data: deletedRouteItems,
    });
  } catch (error) {
    console.error("Clear route items error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not clear route items.",
    });
  }
}

module.exports = {
  clearRouteItems,
  createRouteItem,
  deleteRouteItem,
  getAllRouteItems,
};
