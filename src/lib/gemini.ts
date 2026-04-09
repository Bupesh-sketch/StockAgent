import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Product, PredictionResult } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey! });

const inventoryTools: FunctionDeclaration[] = [
  {
    name: "add_new_product",
    description: "Add a new product to the inventory system.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Name of the product" },
        sku: { type: Type.STRING, description: "Stock Keeping Unit (unique identifier)" },
        type: { type: Type.STRING, description: "Category type: 'medicine', 'electronics', or 'general'" },
        category: { type: Type.STRING, description: "Specific category name (e.g., 'Antibiotics', 'Laptops')" },
        currentStock: { type: Type.NUMBER, description: "Initial stock level" },
        reorderPoint: { type: Type.NUMBER, description: "Stock level at which to reorder" },
        unitPrice: { type: Type.NUMBER, description: "Price per unit" },
        expiryDate: { type: Type.STRING, description: "ISO date string for expiry (optional, YYYY-MM-DD)" },
        dosageForm: { type: Type.STRING, description: "Form of medicine (optional, e.g., 'Tablet', 'Syrup')" }
      },
      required: ["name", "sku", "type", "category", "currentStock", "reorderPoint", "unitPrice"]
    }
  },
  {
    name: "update_stock_level",
    description: "Update the stock level of an existing product (restock or sale). Use positive quantity for restock, negative for sale.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING, description: "The ID of the product to update" },
        quantity: { type: Type.NUMBER, description: "The amount to add (positive) or remove (negative)" },
        reason: { type: Type.STRING, description: "Reason for update (e.g., 'restock', 'sale')" }
      },
      required: ["productId", "quantity"]
    }
  }
];

export async function predictShortages(products: Product[]): Promise<PredictionResult[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following inventory data and predict potential supply shortages.
    Consider:
    1. Current stock levels relative to reorder points.
    2. Product type (Medicines often have more critical supply needs).
    3. Expiry dates (Items expiring soon will cause a shortage of usable stock).
    
    Inventory Data:
    ${JSON.stringify(products, null, 2)}
    
    Be precise. If a product is well above its reorder point and has no near expiry, do not predict a shortage.
    Provide a confidence score (0.0 to 1.0) and a detailed reasoning for each prediction.
    
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

export async function getInventoryAdvice(
  query: string, 
  products: Product[],
  onToolCall?: (name: string, args: any) => Promise<any>
): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  let contents: any[] = [
    {
      role: 'user',
      parts: [{
        text: `
          You are StockSage, an expert inventory management AI. 
          You can help users manage their inventory by providing advice and performing actions like adding products or updating stock levels.
          
          User Query: ${query}
          
          Current Inventory Context:
          ${JSON.stringify(products.slice(0, 50), null, 2)}
          
          If the user wants to add a product or update stock, use the provided tools.
          Always confirm the action to the user after calling a tool.
        `
      }]
    }
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      tools: [{ functionDeclarations: inventoryTools }]
    }
  });

  const functionCalls = response.functionCalls;
  if (functionCalls && onToolCall) {
    const toolResults = [];
    for (const call of functionCalls) {
      const result = await onToolCall(call.name, call.args);
      toolResults.push({
        functionResponse: {
          name: call.name,
          response: result
        }
      });
    }

    // Add the model's tool call to history
    contents.push(response.candidates?.[0]?.content);
    // Add tool results to history
    contents.push({
      role: 'user',
      parts: toolResults
    });

    // Get final response from model
    const finalResponse = await ai.models.generateContent({
      model,
      contents,
      config: {
        tools: [{ functionDeclarations: inventoryTools }]
      }
    });

    return finalResponse.text || "Action completed successfully.";
  }

  return response.text || "I'm sorry, I couldn't generate a response.";
}
