import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

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

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json();

    // Validate required fields
    if (!body.productType || !body.color || !body.text) {
      return NextResponse.json(
        { error: 'Missing required fields: productType, color, text' },
        { status: 400 }
      );
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

    // Parse font color to RGB
    const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
      const sanitized = hex.replace('#', '');
      return {
        r: parseInt(sanitized.substring(0, 2), 16),
        g: parseInt(sanitized.substring(2, 4), 16),
        b: parseInt(sanitized.substring(4, 6), 16),
      };
    };

    const rgb = hexToRgb(fontColor);

    // Calculate text position
    const calculateY = (pos: string, imgHeight: number): number => {
      switch (pos) {
        case 'top':
          return Math.floor(imgHeight * 0.2);
        case 'bottom':
          return Math.floor(imgHeight * 0.8);
        case 'center':
        default:
          return Math.floor(imgHeight * 0.5);
      }
    };

    const textY = calculateY(position, templateHeight);

    // Create SVG text overlay
    // Note: sharp doesn't support custom fonts directly, so we'll use a simple text rendering
    // For production, you'd want to use @vercel/og or a proper font rendering library
    const textSvg = `
      <svg width="${templateWidth}" height="${templateHeight}">
        <text
          x="50%"
          y="${textY}"
          font-family="${font}, sans-serif"
          font-size="${fontSize}"
          fill="rgb(${rgb.r}, ${rgb.g}, ${rgb.b})"
          text-anchor="middle"
          dominant-baseline="middle"
        >${body.text}</text>
      </svg>
    `;

    // Overlay text on template
    const compositeBuffer = await sharp(templateBuffer)
      .composite([
        {
          input: Buffer.from(textSvg),
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
