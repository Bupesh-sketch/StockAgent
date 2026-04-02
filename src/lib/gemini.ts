import { GoogleGenAI, Type } from "@google/genai";
import { Product, PredictionResult } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey! });

export async function predictShortages(products: Product[]): Promise<PredictionResult[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following inventory data and predict potential supply shortages.
    Consider current stock levels relative to reorder points and typical lead times (assume 7-14 days).
    
    Inventory Data:
    ${JSON.stringify(products, null, 2)}
    
    Return a JSON array of predictions.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            productId: { type: Type.STRING },
            productName: { type: Type.STRING },
            predictedShortageDate: { type: Type.STRING, description: "ISO date or null" },
            confidence: { type: Type.NUMBER, description: "0 to 1" },
            reasoning: { type: Type.STRING }
          },
          required: ["productId", "productName", "confidence", "reasoning"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}

export async function getInventoryAdvice(query: string, products: Product[]): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are StockSage, an expert inventory management AI. 
    User Query: ${query}
    
    Current Inventory Context:
    ${JSON.stringify(products.slice(0, 20), null, 2)}
    
    Provide helpful, professional advice or answer the user's question based on the inventory data.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "I'm sorry, I couldn't generate a response.";
}
