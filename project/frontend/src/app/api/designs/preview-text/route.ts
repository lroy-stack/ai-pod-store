import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { createCanvas, registerFont } from 'canvas';
import { containsProfanity, getProfanityErrorMessage } from '@/lib/profanity-filter';
import { previewTextLimiter, getClientIP } from '@/lib/rate-limit';

/**
 * POST /api/designs/preview-text
 *
 * Generates a product mockup preview with custom text overlaid
 * Returns a base64-encoded PNG image
 */

interface PreviewRequest {
  productType: string;
  color: string;
  text: string;
  font?: string;
  fontColor?: string;
  fontSize?: number;
  position?: 'top' | 'center' | 'bottom';
}

// Font mapping: font name to file path
const FONT_FILES: Record<string, string> = {
  'Inter': 'Inter-Regular.ttf',
  'Roboto': 'Roboto-Regular.ttf',
  'Playfair Display': 'PlayfairDisplay-Regular.ttf',
  'Montserrat': 'Montserrat-Regular.ttf',
  'Oswald': 'Oswald-Regular.ttf',
  'Lato': 'Lato-Regular.ttf',
};

// Register all fonts once at module load
Object.entries(FONT_FILES).forEach(([fontName, fileName]) => {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: fontName });
  }
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 20 requests/min per IP (canvas rendering is CPU-intensive)
    const clientIP = getClientIP(request);
    const rateLimitResult = previewTextLimiter.check(clientIP);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
          }
        }
      );
    }

    const body: PreviewRequest = await request.json();

    // Validate required fields
    if (!body.productType || !body.color || !body.text) {
      return NextResponse.json(
        { error: 'Missing required fields: productType, color, text' },
        { status: 400 }
      );
    }

    // Check for profanity (server-side validation)
    if (containsProfanity(body.text)) {
      return NextResponse.json(
        { error: getProfanityErrorMessage() },
        { status: 400 }
      );
    }

    // Validate line count and character limits
    const lines = body.text.split('\n');
    if (lines.length > 3) {
      return NextResponse.json(
        { error: 'Maximum 3 lines allowed' },
        { status: 400 }
      );
    }

    // Validate each line is max 50 characters
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 50) {
        return NextResponse.json(
          { error: `Line ${i + 1} exceeds 50 characters (${lines[i].length} chars)` },
          { status: 400 }
        );
      }
    }

    // Default values
    const font = body.font || 'Inter';
    const fontColor = body.fontColor || '#000000';
    const fontSize = body.fontSize || 24;
    const position = body.position || 'center';

    // Map product type and color to template file
    const templateFileName = `${body.productType}-${body.color}.png`;
    const templatePath = path.join(
      process.cwd(),
      'public',
      'mockup-templates',
      templateFileName
    );

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: `Template not found: ${templateFileName}` },
        { status: 404 }
      );
    }

    // Load the base template image
    const templateBuffer = fs.readFileSync(templatePath);
    const templateMetadata = await sharp(templateBuffer).metadata();
    const templateWidth = templateMetadata.width || 500;
    const templateHeight = templateMetadata.height || 600;

    // Calculate text position (matches CSS Quick preview positioning)
    const calculateY = (pos: string, imgHeight: number): number => {
      switch (pos) {
        case 'top':
          return Math.floor(imgHeight * 0.1); // 10% from top (matches CSS top-[10%])
        case 'bottom':
          return Math.floor(imgHeight * 0.9); // 90% from top (matches CSS bottom-[10%])
        case 'center':
        default:
          return Math.floor(imgHeight * 0.5); // 50% from top (centered)
      }
    };

    const textY = calculateY(position, templateHeight);

    // Validate font
    const selectedFont = FONT_FILES[font] ? font : 'Inter';

    // Create canvas for text rendering
    const canvas = createCanvas(templateWidth, templateHeight);
    const ctx = canvas.getContext('2d');

    // Set font properties
    ctx.font = `${fontSize}px "${selectedFont}"`;
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Render multi-line text
    // Canvas fillText() doesn't support \n, so we must split and render each line separately
    const lineHeight = fontSize * 1.3;
    const textLines = body.text.split('\n');
    const totalHeight = textLines.length * lineHeight;

    // Calculate starting Y position to center the text block
    const startY = textY - (totalHeight / 2) + (lineHeight / 2);

    // Render each line separately
    textLines.forEach((line, index) => {
      const y = startY + (index * lineHeight);
      ctx.fillText(line, templateWidth / 2, y);
    });

    // Convert canvas to buffer
    const textBuffer = canvas.toBuffer('image/png');

    // Overlay text on template using sharp
    const compositeBuffer = await sharp(templateBuffer)
      .composite([
        {
          input: textBuffer,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Convert to base64
    const base64Image = `data:image/png;base64,${compositeBuffer.toString('base64')}`;

    return NextResponse.json({
      preview: base64Image,
      metadata: {
        productType: body.productType,
        color: body.color,
        text: body.text,
        font: selectedFont,
        fontSize,
        fontColor,
        position,
        width: templateWidth,
        height: templateHeight,
      },
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
