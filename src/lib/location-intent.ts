/**
 * Deterministic intent + location extraction for जीवन AI.
 *
 * Two responsibilities:
 *  1. Detect whether the user is *searching* for care vs. asking a general
 *     (educational) question — so a chat answer is not confused with a search.
 *  2. Extract an explicit place from free text ("hospitals in London",
 *     "cardiologist near Chandigarh", "6-digit PIN") and resolve it to real
 *     worldwide coordinates through the Google Geocoding / Places APIs.
 *
 * Rules-based on purpose: offline, auditable, and available even when no LLM
 * key is configured. Results are always verified against real geocoding —
 * nothing is guessed.
 */

import {
  GoogleApiError,
  geocodeAddress,
  googleKeyConfigured,
  resolvePlaceLocation,
} from "@/lib/google-places";
import { interpretQuery, type ParsedNeed } from "@/lib/nlp";

export interface ExplicitPlace {
  query: string;
  lat: number;
  lng: number;
  label: string;
}

/** Tokens that may never start a place phrase. */
const STOP_START = new Set([
  "me", "my", "mine", "our", "your", "his", "her", "their", "its",
  "the", "a", "an", "this", "that", "these", "those", "here", "there",
  "some", "any", "no", "all", "each", "every", "what", "which", "who",
  "whom", "whose", "why", "how", "when", "where", "if", "or", "and",
  "but", "so", "because", "while", "during", "before", "after",
  "last", "next", "this", "coming", "previous", "past", "recent",
  "today", "tomorrow", "yesterday", "now", "then", "soon", "again",
  "please", "kindly", "help", "need", "want", "looking", "get", "got",
  "find", "show", "list", "search", "give", "tell", "let", "can",
  "could", "would", "should", "do", "does", "did", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "i", "we", "you",
  "they", "he", "she", "it", "someone", "anyone", "everyone", "people",
  "for", "with", "within", "from", "into", "onto", "about", "than",
  "very", "just", "only", "also", "even", "still", "more", "most",
  "good", "best", "better", "top", "nice", "great", "nearby",
]);

/** Tokens that end a place phrase. */
const STOP_AFTER = new Set([
  "for", "with", "who", "which", "that", "what", "please", "kindly",
  "today", "tomorrow", "yesterday", "now", "asap", "immediately",
  "and", "or", "of", "on", "to", "by", "my", "me", "your", "our",
  "family", "father", "mother", "mom", "dad", "parents", "brother",
  "sister", "son", "daughter", "wife", "husband", "kids", "children",
  "whoever", "anyone", "everyone", "self", "myself",
]);

/** Tokens that make a phrase a time expression, not a place. */
const TIME_WORDS = new Set([
  "day", "days", "hour", "hours", "hr", "hrs", "minute", "minutes",
  "week", "weeks", "month", "months", "year", "years", "morning",
  "afternoon", "evening", "night", "midnight", "noon", "am", "pm",
  "weekend", "weekday", "hourly", "daily", "weekly", "monthly",
]);

const PLACE_TOKEN = /^[\p{Script=Devanagari}A-Za-z0-9][\p{Script=Devanagari}A-Za-z0-9'’.\- ]*$/u;

const PREPOSITIONS = new Set([
  "in", "near", "around", "at", "में", "के पास", "पास",
]);

function cleanToken(t: string): string {
  return t.replace(/^["'`“‘(\[]+/, "").replace(/[\"'`”’)\]?:;,]+$/, "");
}

function validPhrase(phrase: string): boolean {
  const p = phrase.trim();
  if (p.length < 2 || p.length > 48) return false;
  if (!PLACE_TOKEN.test(p)) return false;
  const words = p.split(/\s+/);
  if (words.length > 6) return false;
  const letters = p.replace(/[^\p{Script=Devanagari}A-Za-z]/gu, "");
  if (letters.length < 2) return false;
  if (STOP_START.has(words[0].toLowerCase())) return false;
  for (const w of words) {
    if (TIME_WORDS.has(w.toLowerCase())) return false;
  }
  return true;
}

/**
 * Extract an explicit place phrase from a message, or null when the user
 * did not name a place ("near me" deliberately yields null so device
 * coordinates are used instead).
 */
export function extractPlacePhrase(message: string): string | null {
  const tokens = message.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const head = cleanToken(tokens[i]).toLowerCase();
    if (!PREPOSITIONS.has(head)) continue;

    const words: string[] = [];
    let blocked = false;
    for (let j = i + 1; j < Math.min(i + 7, tokens.length); j++) {
      const tok = cleanToken(tokens[j]);
      const low = tok.toLowerCase();
      if (!tok || STOP_AFTER.has(low) || PREPOSITIONS.has(low)) break;
      if (j === i + 1 && STOP_START.has(low)) {
        blocked = true;
        break;
      }
      words.push(tok);
      if (words.length >= 6) break;
    }
    if (blocked || words.length === 0) continue;
    const phrase = words.join(" ");
    if (validPhrase(phrase)) return phrase;
  }

  // Indian 6-digit PIN code.
  const pin = message.match(/\b(\d{6})\b/);
  if (pin?.[1]) return pin[1];

  return null;
}

/** OpenStreetMap Nominatim fallback — real coordinates, no API key needed. */
async function nominatimResolve(query: string): Promise<ExplicitPlace | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "JeevanSahay-AI-Assistant/1.0",
          },
        }
      );
      if (res.ok) {
        const rows = (await res.json()) as {
          lat: string;
          lon: string;
          display_name: string;
        }[];
        const hit = rows[0];
        const lat = Number(hit?.lat);
        const lng = Number(hit?.lon);
        if (hit && Number.isFinite(lat) && Number.isFinite(lng)) {
          return { query, lat, lng, label: hit.display_name ?? query };
        }
        return null;
      }
      // Rate limited or server error — brief pause, then one retry.
      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      if (attempt === 1) return null;
      await new Promise((r) => setTimeout(r, 1200));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Resolve an explicit place phrase to real coordinates (worldwide). */
export async function resolveExplicitPlace(
  message: string
): Promise<ExplicitPlace | null> {
  const query = extractPlacePhrase(message);
  if (!query) return null;

  if (googleKeyConfigured()) {
    try {
      const direct = await geocodeAddress(query);
      const hit = direct[0];
      if (hit) return { query, ...hit };
      const viaPlaces = await resolvePlaceLocation(query);
      const alt = viaPlaces[0];
      if (alt) return { query, ...alt };
    } catch (err) {
      if (err instanceof GoogleApiError) {
        console.warn("[location-intent] geocode failed", { status: err.status });
      } else {
        throw err;
      }
    }
  }

  return await nominatimResolve(query);
}

/* ------------------------------------------------------------------ */
/* Intent classification                                               */
/* ------------------------------------------------------------------ */

const FINDER =
  /\b(find|search|show|list|nearest|nearby|near me|closest|best|top|rated|recommend(?:ed|ations?)?|suggest(?:ed|ions?)?|locate|options?|where can i|which (hospital|clinic|doctor|centre|center)|help me)\b/i;

const FACILITY =
  /\b(hospitals?|clinics?|doctors?|physicians?|specialists?|centres?|centers?|er\b|emergency (?:room|care|department|ward)|urgent care|facilities|pharmacies|nursing homes?|diagnostic(?:s| centres?| centers?)?)\b/i;

const EDUCATIONAL =
  /^\s*(what(?:'s| is| are|'s a)?|define|explain|tell me about|why|how (?:do|does|can)|can you tell me|difference between|symptoms of|causes of|is it normal|should i (?:worry|be worried))\b/i;

const SYMPTOM =
  /\b(i have|i'?ve got|i am having|i'?m having|fever|temperature|headache|migraine|pain|ache|cough|cold|vomit|rash|bleed|dizzy|swollen|injured|sick|unwell|not feeling well|diarrh|breathless|बुखार|दर्द|बीमार)\b/i;

export interface SearchIntent {
  wantsSearch: boolean;
  educational: boolean;
  placePhrase: string | null;
}

/**
 * Decide whether the message should trigger a live hospital search.
 * Educational questions ("What is a migraine?") never trigger a search;
 * finders, facility words, explicit places, emergencies and symptom
 * reports do.
 */
export function classifySearchIntent(message: string): SearchIntent {
  const placePhrase = extractPlacePhrase(message);
  const need = interpretQuery(message);
  const isFinder = FINDER.test(message);
  const isFacility = FACILITY.test(message);
  const isEducationalLead = EDUCATIONAL.test(message);
  const symptom = SYMPTOM.test(message);

  const educational =
    isEducationalLead && !isFinder && !isFacility && !placePhrase;

  const wantsSearch =
    !educational &&
    Boolean(
      placePhrase ||
        isFinder ||
        isFacility ||
        symptom ||
        need.requiresEmergency ||
        need.requiresIcu ||
        need.requiresVentilator
    );

  return { wantsSearch, educational, placePhrase };
}

/* ------------------------------------------------------------------ */
/* Search query building                                               */
/* ------------------------------------------------------------------ */

const SPECIALTY_TERM: Record<string, string> = {
  CARDIOLOGY: "cardiology",
  NEUROLOGY: "neurology",
  PULMONOLOGY: "pulmonology",
  ORTHOPEDICS: "orthopedics",
  PEDIATRICS: "pediatrics",
  ONCOLOGY: "oncology",
  DERMATOLOGY: "dermatology",
  GYNECOLOGY: "gynecology",
  GASTROENTEROLOGY: "gastroenterology",
  ENT: "ENT",
  EMERGENCY_MEDICINE: "emergency",
};

/** Human-readable text query for Places Text Search (city-wide search). */
export function buildTextQuery(need: ParsedNeed, place: string): string {
  const parts: string[] = [];
  if (need.requiresEmergency) parts.push("emergency");
  if (need.requiresIcu && !need.requiresEmergency) parts.push("ICU");
  if (need.specialty) parts.push(SPECIALTY_TERM[need.specialty] ?? need.specialty.toLowerCase());
  parts.push("hospital");
  return `${parts.join(" ")} in ${place}`;
}
