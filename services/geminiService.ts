
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getSmartReminderInfo(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract a clear title and concise notes for a reminder from this text: "${prompt}". 
      Keep notes helpful but short. Format as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A punchy title for the reminder." },
            notes: { type: Type.STRING, description: "Brief details about what to do." }
          },
          required: ["title", "notes"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}
