const {
  generateSuggestions,
  listPendingSuggestions,
  approveSuggestionAsMeetup,
  dismissSuggestion,
  seedDemoSessions,
} = require("../services/eventSuggestionService");

async function listSuggestions(req, res) {
  try {
    const data = await listPendingSuggestions();
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function runGenerate(req, res) {
  try {
    const result = await generateSuggestions();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function approveSuggestion(req, res) {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const result = await approveSuggestionAsMeetup(id, req.user.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Suggestion not found or already handled" });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function dismiss(req, res) {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const ok = await dismissSuggestion(id);
    if (!ok) {
      return res.status(404).json({ success: false, message: "Suggestion not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function runSeedDemo(req, res) {
  try {
    const result = await seedDemoSessions();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listSuggestions,
  runGenerate,
  approveSuggestion,
  dismiss,
  runSeedDemo,
};
