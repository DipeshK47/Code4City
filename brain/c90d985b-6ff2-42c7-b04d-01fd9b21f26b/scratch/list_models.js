const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config({ path: "/Users/dipeshkumar/Downloads/Code4City-community_ai/backend/.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function list() {
  try {
    // Note: The public API doesn't have a direct listModels on the genAI object in some versions.
    // We can try to use the fetch API directly if needed, but let's try calling a known model with a different namespace.
    console.log("Testing with gemini-1.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("hello");
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err.message);
    if (err.status) console.error("Status:", err.status);
  }
}

list();
