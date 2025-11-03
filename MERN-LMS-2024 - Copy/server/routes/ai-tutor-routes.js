const express = require("express");
const router = express.Router();
const { handleAiTutorRequest } = require("../controllers/ai-tutor-controller");

// This will create the endpoint: /api/ai-tutor/ask
router.post("/ask", handleAiTutorRequest);

module.exports = router;