import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// System instruction for explanation (from gemini.rs)
const EXPLANATION_SYSTEM_INSTRUCTION = `You are an expert at explaining complex concepts in simple, easy-to-understand terms.

## Output Format (STRICT - follow exactly):
- Output MUST be valid JSON only. No markdown code blocks, no extra text.
- The JSON structure MUST be:
{
  "summary": "One-sentence summary (string)",
  "points": ["Point 1 (string)", "Point 2 (string)", "Point 3 (string)"]
}

## Critical Rules:
- The "points" field MUST be a flat array of strings. DO NOT use nested objects.
- All output text MUST be in Japanese.

## Explanation Guidelines:

### Summary (summary field):
- Summarize the essence in ONE sentence
- Use phrases like "要するに〜ということ" or "つまり〜"
- Make it understandable even for someone unfamiliar with the topic

### Explanation points (points field):
- Rephrase technical terms in plain language: "〇〇（つまり△△のこと）"
- Use familiar analogies or metaphors to explain abstract concepts
- Add context about "why this matters" or "what benefit does this provide"
- For technical content, explain practical use cases and benefits concretely
- For academic content, explain the importance in the field and application examples
- Each point should be independently understandable
- Keep each point to 2-3 sentences`;

// User prompt template for explanation (from gemini.rs)
const EXPLANATION_PROMPT = `Explain the following text.

The user has selected text from a PDF document. The context shows the surrounding text:
- "Context before" = text that appears BEFORE the selected text in the document
- "Text to explain" = the actual text the user selected
- "Context after" = text that appears AFTER the selected text in the document

## Context before (for understanding only):
{context_before}

## Text to explain:
{text}

## Context after (for understanding only):
{context_after}

Use the context to understand the meaning, but explain only the selected text.`;

interface ExplanationResponse {
  summary: string;
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

function parseExplanationResponse(text: string): ExplanationResponse {
  // Try to parse directly first
  try {
    const parsed = JSON.parse(text);
    if (parsed.summary !== undefined && Array.isArray(parsed.points)) {
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
    if (parsed.summary !== undefined && Array.isArray(parsed.points)) {
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
      const summary = typeof obj.summary === 'string' ? obj.summary : '';
      const points = Array.isArray(obj.points)
        ? obj.points.filter((p: unknown): p is string => typeof p === 'string')
        : [];

      return { summary, points };
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: return raw text as summary
  return { summary: text, points: [] };
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

    const prompt = EXPLANATION_PROMPT
      .replace('{text}', text)
      .replace('{context_before}', contextBefore || '')
      .replace('{context_after}', contextAfter || '');

    const url = `${GEMINI_API_BASE}/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: EXPLANATION_SYSTEM_INSTRUCTION }] },
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

    const parsed = parseExplanationResponse(resultText);
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Explanation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
