/**
 * Settings management functions
 *
 * This module provides functions to manage application settings,
 * particularly Gemini translation settings.
 */

import type { GeminiSettings, GeminiModelOption, TranslationResponse, ExplanationResponse } from '@/types';

// ============================================
// Default Values
// ============================================

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
export const DEFAULT_GEMINI_EXPLANATION_MODEL = 'gemini-2.0-flash';

export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
  apiKey: '',
  model: DEFAULT_GEMINI_MODEL,
  explanationModel: DEFAULT_GEMINI_EXPLANATION_MODEL,
};

// ============================================
// Available Models
// ============================================

export const GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast and efficient (Recommended)',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    description: 'Cost-effective for high volume',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Latest flash model with adaptive thinking',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    description: 'Optimized for efficiency',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Best for complex tasks',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: 'Latest preview with advanced reasoning',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: 'Most capable preview model',
  },
];

// ============================================
// LocalStorage Key
// ============================================

const GEMINI_SETTINGS_KEY = 'pedaru_gemini_settings';

// ============================================
// API Functions
// ============================================

/**
 * Get Gemini translation settings from localStorage
 * Note: apiKey is managed server-side via environment variable, always returns empty string
 */
export function getGeminiSettings(): GeminiSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_GEMINI_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(GEMINI_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        apiKey: '', // API key is managed server-side
        model: parsed.model || DEFAULT_GEMINI_MODEL,
        explanationModel: parsed.explanationModel || DEFAULT_GEMINI_EXPLANATION_MODEL,
      };
    }
  } catch (error) {
    console.error('Failed to get Gemini settings:', error);
  }

  return DEFAULT_GEMINI_SETTINGS;
}

/**
 * Save Gemini translation settings to localStorage
 */
export function saveGeminiSettings(settings: GeminiSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(GEMINI_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save Gemini settings:', error);
  }
}

/**
 * Translate text using Gemini API via API Route
 * Returns a structured response with translation and points
 * Note: API key is managed server-side via environment variable
 */
export async function translateWithGemini(
  text: string,
  contextBefore: string,
  contextAfter: string,
  modelOverride?: string
): Promise<TranslationResponse> {
  const settings = getGeminiSettings();

  const response = await fetch('/api/gemini/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      contextBefore,
      contextAfter,
      model: modelOverride || settings.model,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Translation failed');
  }

  return response.json();
}

/**
 * Get explanation of text via API Route
 * Returns summary + explanation points
 * Note: API key is managed server-side via environment variable
 */
export async function explainDirectly(
  text: string,
  contextBefore: string,
  contextAfter: string,
  modelOverride?: string
): Promise<ExplanationResponse> {
  const settings = getGeminiSettings();

  const response = await fetch('/api/gemini/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      contextBefore,
      contextAfter,
      model: modelOverride || settings.explanationModel,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Explanation failed');
  }

  return response.json();
}

/**
 * Check if Gemini is available
 * Note: API key is now managed server-side, so we assume it's configured.
 * Errors will be handled when the API is actually called.
 */
export function isGeminiConfigured(): boolean {
  // API key is managed server-side via environment variable
  // Always return true; errors will be shown if API key is missing
  return true;
}
