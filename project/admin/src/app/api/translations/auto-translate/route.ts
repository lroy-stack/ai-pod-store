import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export const POST = withAuth(async (request: NextRequest, session: unknown) => {
  try {
    const { key, sourceLocale, sourceText, targetLocale } = await request.json();

    if (!key || !sourceLocale || !sourceText || !targetLocale) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const localeNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      de: 'German',
    };

    const prompt = `Translate the following ${localeNames[sourceLocale]} text to ${localeNames[targetLocale]}.
This is a UI translation key "${key}".
Maintain the same tone and formality. If there are placeholders like {variable}, keep them unchanged.

Text: ${sourceText}

Return ONLY the translated text, no explanations.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      console.error('Gemini API error:', await response.text());
      return NextResponse.json(
        { error: 'Translation API request failed' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
      return NextResponse.json(
        { error: 'No translation returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Auto-translate error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-translate' },
      { status: 500 }
    );
  }
});
