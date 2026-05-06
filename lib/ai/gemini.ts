import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "@/lib/logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generate a human-like response using Gemini 1.5 Flash
 */
export async function generateAIResponse(
  userContext: string,
  incomingMessage: string,
  userName: string = "User"
): Promise<string | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      logger.warn("GEMINI_API_KEY is missing, AI response disabled");
      return null;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    });

    const prompt = `
You are a helpful and human-like Instagram assistant.
Your goal is to answer the user's question based ONLY on the context provided below.

CONTEXT:
${userContext}

USER'S NAME: ${userName}
USER'S MESSAGE: "${incomingMessage}"

INSTRUCTIONS:
1. Be friendly, concise, and professional.
2. Use emojis naturally like a human would.
3. If you don't know the answer from the context, politely ask them to wait for a human representative.
4. Keep the response under 600 characters to fit in an Instagram DM.
5. Do not mention that you are an AI.

RESPONSE:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    logger.error("Error generating AI response", { error, category: "ai" });
    return null;
  }
}
