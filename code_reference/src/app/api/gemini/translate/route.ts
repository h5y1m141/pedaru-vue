import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// System instruction for translation (from gemini.rs)
const TRANSLATION_SYSTEM_INSTRUCTION = `You are a professional English-to-Japanese translator and language teacher.

## Your Task
Translate ONLY the "SELECTED TEXT" provided by the user. The context is for understanding only.

## Output Format (STRICT - follow exactly):
- Output MUST be valid JSON only. No markdown code blocks, no extra text.
- The JSON structure MUST be:
{
  "translation": "Translation result in Japanese (string)",
  "points": ["Point 1 (string)", "Point 2 (string)", "Point 3 (string)"]
}

## Critical Rules:
- The "points" field MUST be a flat array of strings. DO NOT use nested objects.
- Each element in points must be a simple string, not an object.
- All output text MUST be in Japanese.
- IMPORTANT: Translate ONLY the SELECTED TEXT, not the context.

## Translation Rules:
- For single words, idioms, or short phrases (no spaces, or 2-3 words):
  - translation: Only the meaning of the word/idiom. NOT a translation of the entire sentence.
  - points: A flat array of strings containing:
    1. "単語の意味: [explanation of the word in Japanese]"
    2. "原文: [Extract the COMPLETE English sentence containing the word from the context, with ***highlighted*** word]"
    3. "訳: [Japanese translation of that complete sentence, with ***highlighted*** translation of the word]"
    4. "類語・言い換え: [synonyms in English with Japanese meanings]"
  - Example output:
    {
      "translation": "活用する、利用する",
      "points": [
        "単語の意味: 何かの力や資源を有効に使うこと",
        "原文: The goal is to ***harness*** the power of AI.",
        "訳: 目標はAIの力を***活用する***ことです。",
        "類語・言い換え: utilize（活用する）, leverage（活かす）, exploit（利用する）"
      ]
    }
  - CRITICAL: How to find the 原文 (original sentence):
    - The selected word appears at the EXACT BOUNDARY between "Context before" and "Context after".
    - The 原文 containing the selected word is: (end of "Context before") + (selected word) + (beginning of "Context after")
    - If the same word appears multiple times in the context, you MUST use ONLY the occurrence at the boundary position.
    - DO NOT pick a sentence from earlier in Context before that happens to contain the same word.

- For sentences or longer text:
  - translation: Full Japanese translation of the text
  - points: A flat array of strings with grammatical explanations:
    1. Each point is a single string explaining one grammar structure
    2. Focus on challenging structures: relative clauses, participle constructions, etc.
    3. Include synonyms or alternative expressions where helpful`;

// User prompt template for translation (from gemini.rs)
const TRANSLATION_PROMPT = `SELECTED TEXT (translate this):
{text}

Context before:
{context_before}

Context after:
{context_after}`;

interface TranslationResponse {
  translation: string;
  points: string[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

function parseTranslationResponse(text: string): TranslationResponse {
  // Try to parse directly first
  try {
    const parsed = JSON.parse(text);
    if (parsed.translation !== undefined && Array.isArray(parsed.points)) {
      return parsed;
    }
  } catch {
    // Continue to next attempt
  }

  // Try to extract JSON from markdown code block
  const cleaned = text
    .trim()
    .replace(/^```json\s*/, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.translation !== undefined && Array.isArray(parsed.points)) {
      return parsed;
    }
  } catch {
    // Continue to next attempt
  }

  // Try flexible parsing
  try {
    const value = JSON.parse(cleaned);

    // Handle array response
    const obj = Array.isArray(value) ? value[0] : value;

    if (obj) {
      const translation = typeof obj.translation === 'string' ? obj.translation : '';
      const points = Array.isArray(obj.points)
        ? obj.points.filter((p: unknown): p is string => typeof p === 'string')
        : [];

      return { translation, points };
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: return raw text as translation
  return { translation: text, points: [] };
}

export async function POST(request: NextRequest) {
  try {
    const { text, contextBefore, contextAfter, model } = await request.json();

    // Get API key from environment variable (server-side only)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Please set it in .env.local' },
        { status: 500 }
      );
    }

    if (!text) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const prompt = TRANSLATION_PROMPT
      .replace('{text}', text)
      .replace('{context_before}', contextBefore || '')
      .replace('{context_after}', contextAfter || '');

    const url = `${GEMINI_API_BASE}/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: TRANSLATION_SYSTEM_INSTRUCTION }] },
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();

      let errorMessage: string;
      if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 401 || status === 403) {
        errorMessage = 'Invalid API key. Please check your Gemini API key in Settings.';
      } else {
        errorMessage = `API error (${status}): ${errorText}`;
      }

      return NextResponse.json({ error: errorMessage }, { status });
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return NextResponse.json({ error: 'No response from API' }, { status: 500 });
    }

    const parsed = parseTranslationResponse(resultText);
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
