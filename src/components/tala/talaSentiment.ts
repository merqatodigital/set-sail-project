// ---------------------------------------------------------------------------
// TALA Sentiment Detection
//
// Lightweight, deterministic sentiment analysis for guest messages.
// No LLM call needed — uses keyword matching and pattern detection.
// Returns sentiment + confidence so TALA can adapt her tone.
// ---------------------------------------------------------------------------

export type Sentiment = "positive" | "negative" | "neutral" | "frustrated" | "confused";

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number; // 0-1
  signals: string[]; // what triggered the detection
}

const POSITIVE_WORDS = new Set([
  "great", "awesome", "amazing", "perfect", "love", "excellent", "fantastic",
  "wonderful", "beautiful", "best", "happy", "thanks", "thank", "appreciate",
  "helpful", "nice", "cool", "sweet", "brilliant", "superb", "outstanding",
  "perfect", "impressive", "loved", "enjoying", "enjoyed", "recommend",
  "definitely", "absolutely", "yes", "please", "sounds good", "let's do it",
  "book", "reserve", "count me in", "i'm in",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "horrible", "worst", "hate", "disappointed",
  "disappointing", "poor", "rude", "dirty", "noisy", "broken", "cold",
  "hot", "uncomfortable", "expensive", "overpriced", "waste", "never",
  "complaint", "problem", "issue", "wrong", "fail", "failed", "unfortunately",
]);

const FRUSTRATION_WORDS = new Set([
  "frustrated", "annoying", "annoyed", "ridiculous", "unacceptable",
  "furious", "angry", "mad", "livid", "outraged", "disgusted",
  "this is ridiculous", "i want to speak", "manager", "refund",
  "cancel", "worst experience", "never again",
]);

const CONFUSION_WORDS = new Set([
  "confused", "don't understand", "unclear", "what do you mean",
  "how does", "can you explain", "i don't get", "lost",
  "complicated", "too much", "simpler", "easier",
]);

const INTENT_SIGNALS = new Set([
  "book", "reserve", "check in", "check-out", "available", "price",
  "how much", "cost", "schedule", "tour", "rent", "order", "food",
  "menu", "room", "wifi", "internet", "parking",
]);

/**
 * Analyze sentiment of a guest message.
 */
export function detectSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase().trim();
  const signals: string[] = [];

  let positiveScore = 0;
  let negativeScore = 0;
  let frustratedScore = 0;
  let confusedScore = 0;

  // Check for positive signals
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) {
      positiveScore += 1;
      signals.push(`+${word}`);
    }
  }

  // Check for negative signals
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) {
      negativeScore += 1;
      signals.push(`-${word}`);
    }
  }

  // Check for frustration (stronger negative)
  for (const word of FRUSTRATION_WORDS) {
    if (lower.includes(word)) {
      frustratedScore += 2;
      signals.push(`!${word}`);
    }
  }

  // Check for confusion
  for (const word of CONFUSION_WORDS) {
    if (lower.includes(word)) {
      confusedScore += 1;
      signals.push(`?${word}`);
    }
  }

  // Exclamation marks can amplify sentiment
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 0) {
    if (positiveScore > negativeScore) positiveScore += exclamations * 0.5;
    else negativeScore += exclamations * 0.5;
  }

  // ALL CAPS can indicate frustration
  if (text.length > 10 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    frustratedScore += 1;
    signals.push("ALL_CAPS");
  }

  // Determine final sentiment
  let sentiment: Sentiment;
  let confidence: number;

  if (frustratedScore >= 2) {
    sentiment = "frustrated";
    confidence = Math.min(1, frustratedScore / 4);
  } else if (confusedScore >= 1) {
    sentiment = "confused";
    confidence = Math.min(1, confusedScore / 2);
  } else if (negativeScore > positiveScore && negativeScore >= 1) {
    sentiment = "negative";
    confidence = Math.min(1, negativeScore / 3);
  } else if (positiveScore > negativeScore && positiveScore >= 1) {
    sentiment = "positive";
    confidence = Math.min(1, positiveScore / 3);
  } else {
    sentiment = "neutral";
    confidence = 0.5;
  }

  return { sentiment, confidence, signals };
}

/**
 * Get a sentiment-aware system instruction snippet to inject into the prompt.
 */
export function sentimentInstruction(result: SentimentResult): string | null {
  if (result.sentiment === "frustrated" && result.confidence > 0.5) {
    return "IMPORTANT: The guest sounds frustrated or upset. Acknowledge their feelings first, apologize sincerely, and offer to connect them with a human team member immediately. Do not try to dismiss or minimize their concern.";
  }
  if (result.sentiment === "confused" && result.confidence > 0.5) {
    return "The guest seems confused. Slow down, use simpler language, and break your answer into smaller steps. Ask clarifying questions rather than assuming.";
  }
  if (result.sentiment === "negative" && result.confidence > 0.6) {
    return "The guest seems unhappy. Be extra empathetic, acknowledge their concern, and focus on solutions. If you can't resolve it, offer to connect them with the team.";
  }
  if (result.sentiment === "positive" && result.confidence > 0.7) {
    return "The guest is in a positive mood. Match their energy — be warm and enthusiastic. This is a good time to suggest activities or upgrades.";
  }
  return null;
}

/**
 * Detect booking intent signals in a message.
 */
export function detectBookingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  let signalCount = 0;
  for (const signal of INTENT_SIGNALS) {
    if (lower.includes(signal)) signalCount++;
  }
  return signalCount >= 1;
}
