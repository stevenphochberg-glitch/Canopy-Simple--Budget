/**
 * Canopy Budgeting App - Firebase Cloud Functions
 * HTTPS Callables for Quick Note AI Natural Language Parsing & Receipt Image Scanning
 * Behavioral Check-In, Rollover, and Fresh Start Cloud Functions
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleGenAI, Type } from '@google/genai';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

// Initialize Gemini Client using Google Gen AI SDK
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY environment variable is not configured');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export interface ParsedExpenseItem {
  amount: number;
  description: string;
  predictedCategory: string;
}

/**
 * parseQuickNote (HTTPS Callable)
 * Accepts raw natural language strings, compound sentences, or pasted email/order confirmation HTML/text.
 * Prompts Gemini to return a structured JSON array: [{"amount", "description", "predictedCategory"}]
 */
export const parseQuickNote = onCall<
  { text: string; categoryNames?: string[] },
  Promise<{ items: ParsedExpenseItem[] }>
>(async (request) => {
  const { text, categoryNames } = request.data;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'The "text" field is required and must not be empty.');
  }

  const ai = getGeminiClient();
  const availableCategories =
    categoryNames && categoryNames.length > 0
      ? categoryNames.join(', ')
      : 'Groceries, Gas / Auto, Dining / Bar, Coffee, Rent, Utilities, Subscriptions, Phone Bill, Fun Money, Household Essentials, Savings';

  const systemInstruction = `You are a financial entity extraction assistant for Canopy, a household budgeting app.
Your task is to parse compound natural language statements, receipts, or pasted email confirmations into distinct individual line items.
DO NOT mathematically group or aggregate items by category. Keep every separate expense as its own distinct item in the list.
For example, if the input is: "I paid $50 in gas, $150 at the bar last night, and had to pay my $75 cell phone bill yesterday. I also paid $25 for a case of beer.",
you must return 4 individual items:
1. amount: 50, description: "Gas", predictedCategory: "Gas / Auto"
2. amount: 150, description: "Bar last night", predictedCategory: "Dining / Bar"
3. amount: 75, description: "Cell phone bill", predictedCategory: "Phone Bill"
4. amount: 25, description: "Case of beer", predictedCategory: "Fun Money"

For each line item:
- "amount": Positive number (numeric value only, without currency signs).
- "description": Clean, concise title or merchant name.
- "predictedCategory": Best matching category name chosen from the household's available categories: [${availableCategories}].`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: text,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: {
                type: Type.NUMBER,
                description: 'The exact numerical price/cost of this specific transaction item.',
              },
              description: {
                type: Type.STRING,
                description: 'Concise description of the item or merchant.',
              },
              predictedCategory: {
                type: Type.STRING,
                description: 'The best matching category name from available categories.',
              },
            },
            required: ['amount', 'description', 'predictedCategory'],
          },
        },
      },
    });

    const rawText = response.text?.trim() || '[]';
    const items: ParsedExpenseItem[] = JSON.parse(rawText);
    return { items };
  } catch (err: unknown) {
    console.error('Error in parseQuickNote Cloud Function:', err);
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Failed to parse natural language quick note');
  }
});

/**
 * scanReceipt (HTTPS Callable)
 * Accepts the Firebase Storage URL (or base64 data) of an uploaded receipt photo.
 * Uses Gemini multimodal capabilities to extract line items into [{"amount", "description", "predictedCategory"}].
 */
export const scanReceipt = onCall<
  { receiptUrl?: string; imageBase64?: string; mimeType?: string; categoryNames?: string[] },
  Promise<{ items: ParsedExpenseItem[] }>
>(async (request) => {
  const { receiptUrl, imageBase64, mimeType, categoryNames } = request.data;
  if (!receiptUrl && !imageBase64) {
    throw new HttpsError('invalid-argument', 'Either "receiptUrl" or "imageBase64" is required.');
  }

  const ai = getGeminiClient();
  const availableCategories =
    categoryNames && categoryNames.length > 0
      ? categoryNames.join(', ')
      : 'Groceries, Gas / Auto, Dining / Bar, Coffee, Rent, Utilities, Subscriptions, Phone Bill, Fun Money, Household Essentials, Savings';

  let imagePartData: string = '';
  let resolvedMimeType = mimeType || 'image/jpeg';

  if (imageBase64) {
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      resolvedMimeType = matches[1];
      imagePartData = matches[2];
    } else {
      imagePartData = imageBase64;
    }
  } else if (receiptUrl) {
    try {
      const fetchRes = await fetch(receiptUrl);
      const arrayBuffer = await fetchRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imagePartData = buffer.toString('base64');
      resolvedMimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
    } catch (fetchErr) {
      console.error('Failed to fetch image from receiptUrl:', fetchErr);
      throw new HttpsError('invalid-argument', 'Could not download receipt image from provided URL.');
    }
  }

  const systemInstruction = `You are an expert optical receipt parser for Canopy household budget.
Scan this receipt photo carefully. Extract all purchased items and their prices.
If individual line items are clearly legible, return each distinct item. If only a single total is clear or it is a summary receipt, return the total with the store/merchant name.
For each item:
- "amount": Positive number representing the item price or total.
- "description": Store name + item name (e.g. "Trader Joe's - Organic Milk", "Shell - Gasoline", "Target - Paper Towels").
- "predictedCategory": Best matching category from: [${availableCategories}].`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: imagePartData,
              mimeType: resolvedMimeType,
            },
          },
          {
            text: 'Extract all receipt items with their price amounts and predicted categories.',
          },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: {
                type: Type.NUMBER,
                description: 'The numerical price of this item on the receipt.',
              },
              description: {
                type: Type.STRING,
                description: 'Store/merchant and item name.',
              },
              predictedCategory: {
                type: Type.STRING,
                description: 'The best matching category.',
              },
            },
            required: ['amount', 'description', 'predictedCategory'],
          },
        },
      },
    });

    const rawText = response.text?.trim() || '[]';
    const items: ParsedExpenseItem[] = JSON.parse(rawText);
    return { items };
  } catch (err: unknown) {
    console.error('Error in scanReceipt Cloud Function:', err);
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Failed to scan receipt image');
  }
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * evaluateCheckInStatus (Pub/Sub Scheduled Function)
 * Runs daily at midnight to compare current date against household's lastDayOfWeek.
 * Toggles checkInPending or past-due alerts based on the schedule, honoring grace periods for new users.
 */
export const evaluateCheckInStatus = onSchedule('0 0 * * *', async (event) => {
  const now = new Date();
  const currentDayName = DAY_NAMES[now.getDay()];

  console.log(`Evaluating check-in status for households on ${currentDayName} (${now.toISOString()})`);

  const householdsSnap = await db.collection('households').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of householdsSnap.docs) {
    const data = doc.data();
    const lastDay = data.lastDayOfWeek || 'Sunday';
    const createdAt = data.createdAt ? new Date(data.createdAt) : now;
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // Grace period for first week (suppresses past due)
    const isFirstWeek = daysSinceCreation < 7;

    const isCheckInDay = currentDayName.toLowerCase() === lastDay.toLowerCase();

    // Query recent checkin
    const checkinsSnap = await doc.ref.collection('checkins')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    const lastCheckin = checkinsSnap.empty ? null : checkinsSnap.docs[0].data();
    const lastCheckinTime = lastCheckin?.timestamp ? new Date(lastCheckin.timestamp) : null;
    const daysSinceLastCheckin = lastCheckinTime ? (now.getTime() - lastCheckinTime.getTime()) / (1000 * 60 * 60 * 24) : 999;

    let checkInPending = false;
    let checkInStatus = 'upcoming';

    if (isCheckInDay) {
      checkInPending = true;
      checkInStatus = 'pending';
    } else if (daysSinceLastCheckin > 7 && !isFirstWeek) {
      checkInPending = true;
      checkInStatus = 'past-due';
    } else if (daysSinceLastCheckin <= 7) {
      checkInStatus = 'completed';
    }

    batch.update(doc.ref, {
      checkInPending,
      checkInStatus,
      lastEvaluatedAt: FieldValue.serverTimestamp(),
    });
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`Evaluated check-in status for ${count} households.`);
});

/**
 * executeMonthEndReset (Pub/Sub Scheduled Function)
 * Runs at the end of the fiscal month to reset all category currentWeeklyBudget values back to baselineBudget.
 * Permanently prevents budget deficits or rollovers from spilling into the new month.
 */
export const executeMonthEndReset = onSchedule('59 23 28-31 * *', async (event) => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  // Check if tomorrow is the first day of next month (i.e. tonight is the final day of month)
  if (tomorrow.getDate() !== 1) {
    console.log('Not the final day of month. Skipping month-end reset.');
    return;
  }

  console.log(`Executing Month-End Hard Reset for all households on ${now.toISOString()}`);

  const householdsSnap = await db.collection('households').get();

  for (const householdDoc of householdsSnap.docs) {
    const categoriesSnap = await householdDoc.ref.collection('categories').get();
    const batch = db.batch();

    for (const catDoc of categoriesSnap.docs) {
      const catData = catDoc.data();
      const baseline = catData.baselineBudget ?? catData.currentWeeklyBudget ?? 0;
      batch.update(catDoc.ref, {
        currentWeeklyBudget: baseline,
        lastResetAt: FieldValue.serverTimestamp(),
      });
    }

    // Write a month-end reset log in household doc
    batch.update(householdDoc.ref, {
      lastMonthEndReset: FieldValue.serverTimestamp(),
    });

    await batch.commit();
  }

  console.log(`Month-End Hard Reset completed for ${householdsSnap.size} households.`);
});

/**
 * triggerFreshStart (HTTPS Callable)
 * Resolves past-due check-in blockers by applying the "exactly on budget" assumption to missed gap weeks.
 * Injects $0 placeholder "Fresh Start" expenses into each category and records on-budget check-in records.
 */
export const triggerFreshStart = onCall<
  { householdId: string },
  Promise<{ success: boolean; weeksResolved: number; message: string }>
>(async (request) => {
  const { householdId } = request.data;
  if (!householdId) {
    throw new HttpsError('invalid-argument', 'The "householdId" parameter is required.');
  }

  const householdRef = db.collection('households').doc(householdId);
  const householdSnap = await householdRef.get();

  if (!householdSnap.exists) {
    throw new HttpsError('not-found', `Household with ID ${householdId} not found.`);
  }

  const categoriesSnap = await householdRef.collection('categories').get();
  if (categoriesSnap.empty) {
    throw new HttpsError('failed-precondition', 'No categories found in household.');
  }

  const now = new Date();
  const batch = db.batch();

  // 1. Reset all category currentWeeklyBudget values to baselineBudget
  for (const catDoc of categoriesSnap.docs) {
    const catData = catDoc.data();
    const baseline = catData.baselineBudget ?? catData.currentWeeklyBudget ?? 0;
    batch.update(catDoc.ref, {
      currentWeeklyBudget: baseline,
    });

    // 2. Inject a $0 "Fresh Start" expense for each category
    const expenseRef = householdRef.collection('expenses').doc();
    batch.set(expenseRef, {
      id: expenseRef.id,
      amount: 0,
      description: 'Fresh Start (On-Budget Assumption)',
      categoryId: catDoc.id,
      timestamp: Date.now(),
      date: now.toISOString().split('T')[0],
      loggedByUserId: request.auth?.uid || 'system_fresh_start',
      isFreshStartPlaceholder: true,
    });
  }

  // 3. Write a completed checkin record
  const checkinRef = householdRef.collection('checkins').doc();
  batch.set(checkinRef, {
    id: checkinRef.id,
    status: 'completed',
    weekStartDate: now.toISOString().split('T')[0],
    weekEndDate: now.toISOString().split('T')[0],
    timestamp: Date.now(),
    completedByUserId: request.auth?.uid || 'system',
    completedByName: 'Fresh Start Reset',
    notes: 'Fresh Start applied. All past-due blockers resolved with exact baseline budget assumptions.',
    totalSaved: 0,
    totalSpent: 0,
  });

  // 4. Update household state
  batch.update(householdRef, {
    checkInPending: false,
    checkInStatus: 'completed',
    lastFreshStartAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    success: true,
    weeksResolved: 1,
    message: 'All past-due check-in blockers have been resolved with on-budget assumptions, and your budgets are reset to baseline.',
  };
});
