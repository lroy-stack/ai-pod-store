/**
 * Background removal pipeline with fallback chain.
 * 1. fal.ai rembg (free)
 * 2. fal.ai Bria RMBG 2.0 ($0.018)
 * 3. Replicate 851-labs ($0.0006)
 */

export interface BgRemovalResult {
  success: boolean
  imageUrl?: string
  provider: 'fal-rembg' | 'fal-bria' | 'replicate-851'
  costUsd: number
  error?: string
}

export async function removeBackground(imageUrl: string): Promise<BgRemovalResult> {
  const FAL_KEY = process.env.FAL_KEY

  // 1. fal.ai rembg (free, fastest)
  if (FAL_KEY) {
    const rembgResult = await tryFalRembg(FAL_KEY, imageUrl)
    if (rembgResult.success) return rembgResult

    // 2. fal.ai Bria RMBG 2.0 (better quality, $0.018)
    const briaResult = await tryFalBria(FAL_KEY, imageUrl)
    if (briaResult.success) return briaResult
  }

  // 3. Replicate 851-labs ($0.0006)
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN
  if (REPLICATE_API_TOKEN) {
    const replicateResult = await tryReplicate851(REPLICATE_API_TOKEN, imageUrl)
    if (replicateResult.success) return replicateResult
  }

  return {
    success: false,
    provider: 'fal-rembg',
    costUsd: 0,
    error: 'All background removal providers failed. Check API keys.',
  }
}

async function tryFalRembg(apiKey: string, imageUrl: string): Promise<BgRemovalResult> {
  try {
    const response = await fetch('https://fal.run/fal-ai/imageutils/rembg', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: imageUrl }),
    })

    if (!response.ok) {
      console.error('fal rembg error:', await response.text())
      return { success: false, provider: 'fal-rembg', costUsd: 0, error: 'rembg failed' }
    }

    const data = await response.json()
    const resultUrl = data.image?.url
    if (!resultUrl) {
      return { success: false, provider: 'fal-rembg', costUsd: 0, error: 'No image in rembg response' }
    }

    return { success: true, imageUrl: resultUrl, provider: 'fal-rembg', costUsd: 0 }
  } catch (error) {
    console.error('fal rembg error:', error)
    return { success: false, provider: 'fal-rembg', costUsd: 0, error: 'rembg provider error' }
  }
}

async function tryFalBria(apiKey: string, imageUrl: string): Promise<BgRemovalResult> {
  try {
    const response = await fetch('https://fal.run/fal-ai/bria/rmbg/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: imageUrl }),
    })

    if (!response.ok) {
      console.error('fal bria rmbg error:', await response.text())
      return { success: false, provider: 'fal-bria', costUsd: 0, error: 'bria rmbg failed' }
    }

    const data = await response.json()
    const resultUrl = data.image?.url
    if (!resultUrl) {
      return { success: false, provider: 'fal-bria', costUsd: 0, error: 'No image in bria response' }
    }

    return { success: true, imageUrl: resultUrl, provider: 'fal-bria', costUsd: 0.018 }
  } catch (error) {
    console.error('fal bria rmbg error:', error)
    return { success: false, provider: 'fal-bria', costUsd: 0, error: 'bria provider error' }
  }
}

async function tryReplicate851(apiToken: string, imageUrl: string): Promise<BgRemovalResult> {
  try {
    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '4067ee2a58f6c161d434a9c077cfa012820b8e076efa2772aa171e26557da919',
        input: { image: imageUrl },
      }),
    })

    if (!response.ok) {
      console.error('Replicate 851 error:', await response.text())
      return { success: false, provider: 'replicate-851', costUsd: 0, error: 'Replicate start failed' }
    }

    const prediction = await response.json()

    // Poll for completion (max ~30s)
    const pollUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000))

      const pollRes = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      })

      if (!pollRes.ok) continue

      const status = await pollRes.json()
      if (status.status === 'succeeded' && status.output) {
        const resultUrl = typeof status.output === 'string' ? status.output : status.output[0]
        return { success: true, imageUrl: resultUrl, provider: 'replicate-851', costUsd: 0.0006 }
      }
      if (status.status === 'failed' || status.status === 'canceled') {
        return { success: false, provider: 'replicate-851', costUsd: 0, error: 'Replicate prediction failed' }
      }
    }

    return { success: false, provider: 'replicate-851', costUsd: 0, error: 'Replicate prediction timed out' }
  } catch (error) {
    console.error('Replicate 851 error:', error)
    return { success: false, provider: 'replicate-851', costUsd: 0, error: 'Replicate provider error' }
  }
}
