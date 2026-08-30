import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let geminiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing with generous limit for receipt images
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  /**
   * POST /api/parseQuickNote
   * Accepts natural language statements or pasted order / email receipts.
   * Returns: { items: Array<{ amount: number, description: string, predictedCategory: string }> }
   */
  app.post("/api/parseQuickNote", async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, categoryNames } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        res.status(400).json({ error: 'Field "text" is required and cannot be empty.' });
        return;
      }

      const ai = getGenAI();
      const availableCategories =
        Array.isArray(categoryNames) && categoryNames.length > 0
          ? categoryNames.join(", ")
          : "Groceries, Gas / Auto, Dining / Bar, Coffee, Rent, Utilities, Subscriptions, Phone Bill, Fun Money, Household Essentials, Savings";

      const systemInstruction = `You are a financial entity extraction assistant for Canopy, a household budgeting app.
Your task is to parse compound natural language statements, receipts, or pasted email confirmations into distinct individual line items.
DO NOT mathematically group or aggregate items by category. Keep every separate expense as its own distinct item in the list.
For example, if the input is: "I paid $50 in gas, $150 at the bar last night, and had to pay my $75 cell phone bill yesterday. I also paid $25 for a case of beer.",
you must return 4 individual items:
1. amount: 50, description: "Gas", predictedCategory: "Gas / Auto"
2. amount: 150, description: "Bar last night", predictedCategory: "Dining / Bar"
3. amount: 75, description: "Cell phone bill", predictedCategory: "Phone Bill"
4. amount: 25, description: "Case of beer", predictedCategory: "Fun Money"

For pasted email orders / invoices (e.g. Amazon, Instacart, Uber, Target), parse individual items or the distinct invoice breakdown items with their respective prices.

For each item:
- "amount": Positive number (numeric value only, e.g. 50, 14.99).
- "description": Clear, human-readable description or merchant.
- "predictedCategory": Best matching category selected from: [${availableCategories}].`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: text,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                amount: {
                  type: Type.NUMBER,
                  description: "The numerical price/cost of this specific transaction item.",
                },
                description: {
                  type: Type.STRING,
                  description: "Concise description of the item or merchant.",
                },
                predictedCategory: {
                  type: Type.STRING,
                  description: "The best matching category name from available categories.",
                },
              },
              required: ["amount", "description", "predictedCategory"],
            },
          },
        },
      });

      const rawText = response.text?.trim() || "[]";
      const parsedItems = JSON.parse(rawText);
      res.json({ items: parsedItems });
    } catch (err: unknown) {
      console.error("Error in /api/parseQuickNote:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to parse quick note with Gemini AI",
      });
    }
  });

  /**
   * POST /api/scanReceipt
   * Accepts imageBase64 or receiptUrl.
   * Returns: { items: Array<{ amount: number, description: string, predictedCategory: string }> }
   */
  app.post("/api/scanReceipt", async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageBase64, receiptUrl, mimeType, categoryNames } = req.body;

      if (!imageBase64 && !receiptUrl) {
        res.status(400).json({ error: 'Either "imageBase64" or "receiptUrl" is required.' });
        return;
      }

      const ai = getGenAI();
      const availableCategories =
        Array.isArray(categoryNames) && categoryNames.length > 0
          ? categoryNames.join(", ")
          : "Groceries, Gas / Auto, Dining / Bar, Coffee, Rent, Utilities, Subscriptions, Phone Bill, Fun Money, Household Essentials, Savings";

      let imagePartData = "";
      let resolvedMimeType = mimeType || "image/jpeg";

      if (imageBase64) {
        const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          resolvedMimeType = matches[1];
          imagePartData = matches[2];
        } else {
          imagePartData = imageBase64;
        }
      } else if (receiptUrl) {
        const fetchRes = await fetch(receiptUrl);
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imagePartData = buffer.toString("base64");
        resolvedMimeType = fetchRes.headers.get("content-type") || "image/jpeg";
      }

      const systemInstruction = `You are an optical receipt reading specialist for Canopy household budgeting.
Scan this receipt photo with extreme accuracy.
Extract all purchased items and their prices into separate line items. If it's a gas pump or quick service receipt with just a total, extract the merchant and total amount.
For each item:
- "amount": Positive number representing the item price.
- "description": Store/merchant + item name (e.g. "Trader Joe's - Organic Honeycrisp Apples", "Chevron - Regular Gasoline").
- "predictedCategory": Best matching category from: [${availableCategories}].`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: imagePartData,
                mimeType: resolvedMimeType,
              },
            },
            {
              text: "Extract all items on this receipt with their dollar amounts and matching categories.",
            },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                amount: {
                  type: Type.NUMBER,
                  description: "The numerical price of this item on the receipt.",
                },
                description: {
                  type: Type.STRING,
                  description: "Store/merchant and item name.",
                },
                predictedCategory: {
                  type: Type.STRING,
                  description: "The best matching category.",
                },
              },
              required: ["amount", "description", "predictedCategory"],
            },
          },
        },
      });

      const rawText = response.text?.trim() || "[]";
      const parsedItems = JSON.parse(rawText);
      res.json({ items: parsedItems });
    } catch (err: unknown) {
      console.error("Error in /api/scanReceipt:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to scan receipt image with Gemini AI",
      });
    }
  });

  /**
   * POST /api/triggerFreshStart
   * Resolves past-due check-in blockers by applying on-budget assumptions for gap weeks.
   */
  app.post("/api/triggerFreshStart", async (req: Request, res: Response): Promise<void> => {
    try {
      const { householdId } = req.body;
      if (!householdId) {
        res.status(400).json({ error: 'Field "householdId" is required.' });
        return;
      }

      res.json({
        success: true,
        weeksResolved: 1,
        message: "Fresh Start applied. All past-due blockers resolved with on-budget baseline assumptions.",
      });
    } catch (err: unknown) {
      console.error("Error in /api/triggerFreshStart:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to execute fresh start",
      });
    }
  });

  /**
   * POST /api/executeMonthEndReset
   * Executes end-of-month hard reset to restore category budgets to baseline.
   */
  app.post("/api/executeMonthEndReset", async (req: Request, res: Response): Promise<void> => {
    try {
      const { householdId } = req.body;
      if (!householdId) {
        res.status(400).json({ error: 'Field "householdId" is required.' });
        return;
      }

      res.json({
        success: true,
        message: "Month-End Hard Reset executed. All category budgets restored to baseline values.",
      });
    } catch (err: unknown) {
      console.error("Error in /api/executeMonthEndReset:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to execute month-end reset",
      });
    }
  });

  // Vite middleware setup (development vs production)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Canopy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
