/**
 * PodClaw SVG Renderer Sidecar
 *
 * Converts SVG to print-ready PNG using @resvg/resvg-js (fidelity)
 * and Sharp (post-processing, DPI metadata, resize).
 *
 * Endpoints:
 *   GET  /health  — Health check
 *   POST /render  — SVG → PNG at exact dimensions and DPI
 */

'use strict'

const fastify = require('fastify')({ logger: true })
const { Resvg } = require('@resvg/resvg-js')
const sharp = require('sharp')

const PORT = parseInt(process.env.PORT || '3002', 10)
const MAX_SVG_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_DIMENSION = 10000 // pixels

// ─── Health ─────────────────────────────────────────────────

fastify.get('/health', async () => {
  return { status: 'ok', service: 'svg-renderer' }
})

// ─── Render ─────────────────────────────────────────────────

fastify.post('/render', {
  schema: {
    body: {
      type: 'object',
      required: ['svg', 'width', 'height'],
      properties: {
        svg: { type: 'string', maxLength: MAX_SVG_SIZE },
        width: { type: 'integer', minimum: 1, maximum: MAX_DIMENSION },
        height: { type: 'integer', minimum: 1, maximum: MAX_DIMENSION },
        dpi: { type: 'integer', minimum: 72, maximum: 600, default: 300 },
        background: {
          type: 'string',
          enum: ['transparent', 'white', 'black'],
          default: 'transparent',
        },
      },
    },
  },
}, async (request, reply) => {
  const { svg, width, height, dpi = 300, background = 'transparent' } = request.body

  try {
    // 1. Render SVG with @resvg/resvg-js (best text/gradient fidelity)
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
      font: {
        loadSystemFonts: true,
      },
      logLevel: 'warn',
    })
    const rendered = resvg.render()
    const pngBuffer = rendered.asPng()

    // 2. Determine background for Sharp
    let bg
    switch (background) {
      case 'white':
        bg = { r: 255, g: 255, b: 255, alpha: 1 }
        break
      case 'black':
        bg = { r: 0, g: 0, b: 0, alpha: 1 }
        break
      default:
        bg = { r: 0, g: 0, b: 0, alpha: 0 }
    }

    // 3. Post-process with Sharp: exact resize + DPI metadata
    const result = await sharp(pngBuffer)
      .resize(width, height, {
        fit: 'contain',
        background: bg,
      })
      .withMetadata({ density: dpi })
      .png({ compressionLevel: 6 })
      .toBuffer()

    // 4. Return PNG buffer
    reply
      .header('Content-Type', 'image/png')
      .header('X-Width', width)
      .header('X-Height', height)
      .header('X-DPI', dpi)
      .send(result)

  } catch (err) {
    request.log.error({ err }, 'SVG render failed')
    reply.status(500).send({
      error: true,
      message: err.message || 'SVG render failed',
    })
  }
})

// ─── Composite ──────────────────────────────────────────────

fastify.post('/composite', {
  schema: {
    body: {
      type: 'object',
      required: ['layers', 'width', 'height'],
      properties: {
        layers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['svg', 'png_url', 'png_base64'] },
              content: { type: 'string' },
              x: { type: 'integer', default: 0 },
              y: { type: 'integer', default: 0 },
              width: { type: 'integer' },
              height: { type: 'integer' },
            },
            required: ['type', 'content'],
          },
        },
        width: { type: 'integer', minimum: 1, maximum: MAX_DIMENSION },
        height: { type: 'integer', minimum: 1, maximum: MAX_DIMENSION },
        dpi: { type: 'integer', minimum: 72, maximum: 600, default: 300 },
      },
    },
  },
}, async (request, reply) => {
  const { layers, width, height, dpi = 300 } = request.body

  try {
    // Start with transparent canvas
    let canvas = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png()

    const compositeInputs = []

    for (const layer of layers) {
      let layerBuffer

      if (layer.type === 'svg') {
        const resvg = new Resvg(layer.content, {
          fitTo: { mode: 'width', value: layer.width || width },
          font: { loadSystemFonts: true },
        })
        layerBuffer = resvg.render().asPng()
        if (layer.width && layer.height) {
          layerBuffer = await sharp(layerBuffer)
            .resize(layer.width, layer.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer()
        }
      } else if (layer.type === 'png_base64') {
        layerBuffer = Buffer.from(layer.content, 'base64')
      } else {
        // png_url — skip for now, would need fetch
        continue
      }

      compositeInputs.push({
        input: layerBuffer,
        left: layer.x || 0,
        top: layer.y || 0,
      })
    }

    const result = await canvas
      .composite(compositeInputs)
      .withMetadata({ density: dpi })
      .png({ compressionLevel: 6 })
      .toBuffer()

    reply
      .header('Content-Type', 'image/png')
      .header('X-Width', width)
      .header('X-Height', height)
      .header('X-DPI', dpi)
      .send(result)

  } catch (err) {
    request.log.error({ err }, 'Composite failed')
    reply.status(500).send({
      error: true,
      message: err.message || 'Composite failed',
    })
  }
})

// ─── Start ──────────────────────────────────────────────────

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  fastify.log.info(`SVG Renderer listening on port ${PORT}`)
})
