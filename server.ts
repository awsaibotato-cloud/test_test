import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

const SYSTEM_PROMPTS: Record<string, string> = {
  master: `You are "Salam AI", the "Feloos Master", a gamified Personal Finance Manager.
Tone: Friendly, witty, slightly sarcastic (the "Fin-Troll") in Palestinian/Levantine dialect.
Style: Gamified (HP/Bosses/Juice). Keep responses VERY CONCISE (max 2-3 sentences).`,
  
  coach: `You are "Salam AI", a supportive financial coach.
Tone: Friendly, encouraging, and clear. Use soft Levantine dialect.
Style: Focus on habits. Keep responses VERY CONCISE (max 2-3 sentences).`,
  
  professional: `You are "Salam AI", a professional financial advisor.
Tone: Serious, direct, and data-focused. Use formal Arabic (MSA).
Style: Pragmatic, NO sarcasm. Keep responses VERY CONCISE (max 2 sentences).`
};

const BASE_RULES = `
RULES:
1. Treat money as HP.
2. Categorize as "Need", "Want", or "Saving".
3. Use emojis (💰, 🛡️, 🔥, ⚔️, 🐉).
4. Analyze priorities if the user asks for buying advice.

CRITICAL: If a transaction is logged, append JSON:
\`\`\`json
{
  "transaction": {
    "amount": number,
    "description": "string",
    "category": "need" | "want" | "saving",
    "hpImpact": number
  }
}
\`\`\`
If no transaction, NO JSON.
`;

// API Route for Gemini
app.post("/api/chat", async (req, res) => {
    console.log("--- New Chat Request ---");
    try {
      const { message, history, personality, imageBase64 } = req.body;
      console.log("Personality:", personality || "master");
      console.log("Message Length:", message?.length || 0);

      if (!process.env.GEMINI_API_KEY) {
        console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables!");
        return res.status(500).json({ error: "API Key logic failure on server." });
      }
      
      const systemInstruction = (SYSTEM_PROMPTS[personality] || SYSTEM_PROMPTS.master) + "\n" + BASE_RULES;
      const modelName = "gemini-3-flash-preview";
      
      const contents = Array.isArray(history) ? [...history] : [];
      
      const currentParts: any[] = [{ text: message || "مرحباً" }];
      if (imageBase64) {
        try {
          const dataPart = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
          currentParts.push({
            inlineData: {
              data: dataPart,
              mimeType: "image/jpeg"
            }
          });
          console.log("Image attached to request");
        } catch (e) {
          console.error("Error processing image base64:", e);
        }
      }
      
      contents.push({
        role: "user",
        parts: currentParts
      });

      console.log("Sending request to Gemini...");
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: { systemInstruction }
      });

      console.log("Gemini responded successfully");
      res.json({ text: response.text || "حدث خطأ في استجابة الذكاء الاصطناعي." });
    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      res.status(500).json({ 
        error: "فشل الخادم في معالجة طلبك.",
        debug: error.message 
      });
    }
});

// For development
async function setupVite() {
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite();

if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
