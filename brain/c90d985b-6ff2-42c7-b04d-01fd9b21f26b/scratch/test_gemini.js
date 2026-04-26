const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: "/Users/dipeshkumar/Downloads/Code4City-community_ai/backend/.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function test() {
  try {
    console.log("Using API Key:", process.env.GEMINI_API_KEY ? "FOUND" : "MISSING");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Say hello");
    console.log("Response:", result.response.text());
  } catch (err) {
    console.error("Gemini Error:", err);
  }
}

test();
