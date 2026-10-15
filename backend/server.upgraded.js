const { randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const cors = require('cors')
const dotenv = require('dotenv')
const express = require('express')
const Groq = require('groq-sdk')

dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const port = Number(process.env.PORT) || 3001
const frontendOrigin = 'http://localhost:5173'
const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN
const imageModel = '@cf/black-forest-labs/flux-1-schnell'
const imageDirectory = path.join(__dirname, 'generated-images')
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function sanitizeProviderMessage(value) {
  let message = typeof value === 'string' ? value : ''
  const secrets = [
    cloudflareAccountId,
    cloudflareApiToken,
    process.env.HF_TOKEN,
    process.env.GROQ_API_KEY,
  ].filter(Boolean)

  for (const secret of secrets) {
    message = message.split(secret).join('[REDACTED]')
  }

  return message
    .replace(/Bearer\s+\S+/gi, '******')
    .replace(/\b(?:hf|gsk)_[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500)
}

function getCloudflareFailure(status, providerMessage) {
  const safeProviderMessage = sanitizeProviderMessage(providerMessage)
  let userMessage = 'Cloudflare Workers AI could not complete the image-generation request.'

  if (status === 401) {
    userMessage = 'Cloudflare rejected the API token. Check CLOUDFLARE_API_TOKEN and its Workers AI permissions.'
  } else if (status === 403) {
    userMessage = 'Cloudflare denied access. Check the API token permissions and account configuration.'
  } else if (status === 404) {
    userMessage = 'Cloudflare could not find the Workers AI model for this account. Check CLOUDFLARE_ACCOUNT_ID and model availability.'
  } else if (status === 429) {
    userMessage = 'Cloudflare rate-limited image generation. Try again later.'
  } else if (status !== null && status >= 500) {
    userMessage = 'Cloudflare Workers AI is temporarily unavailable. Try again later.'
  } else if (/timeout|timed out|aborted/i.test(safeProviderMessage)) {
    userMessage = 'Image generation timed out. Try again; the image provider may be busy.'
  } else if (safeProviderMessage) {
    userMessage = `Image generation failed: ${safeProviderMessage}`
  }

  return {
    status,
    providerMessage: safeProviderMessage,
    userMessage,
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === frontendOrigin) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed'))
    },
  }),
)
app.use(express.json({ limit: '32kb' }))

app.get('/', (_request, response) => {
  response.json({
    name: 'PROTOTYPE backend',
    status: 'running',
    health: '/api/health',
  })
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/images/:imageName', async (request, response) => {
  const imageName = request.params.imageName
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(imageName)) {
    return response.status(404).json({ error: 'Image not found.' })
  }

  try {
    const image = await fs.readFile(path.join(imageDirectory, imageName))
    const extension = path.extname(imageName).toLowerCase()
    const contentType = Object.entries(imageTypes).find(([, value]) => `.${value}` === extension)?.[0]
    if (!contentType) {
      return response.status(404).json({ error: 'Image not found.' })
    }

    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return response.type(contentType).send(image)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return response.status(404).json({ error: 'Image not found.' })
    }
    return response.status(500).json({ error: 'The saved image could not be loaded.' })
  }
})

app.post('/api/generate', async (request, response) => {
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({ error: 'Request body must be a JSON object.' })
  }

  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  const instructions = body.instructions === undefined ? '' : typeof body.instructions === 'string' ? body.instructions.trim() : null
  const currentPrototype = body.currentPrototype

  if (!idea) {
    return response.status(400).json({ error: 'The idea field is required.' })
  }
  if (idea.length > 4000) {
    return response.status(400).json({ error: 'The idea must be 4000 characters or fewer.' })
  }
  if (instructions === null) {
    return response.status(400).json({ error: 'The instructions field must be a string.' })
  }
  if (instructions.length > 2000) {
    return response.status(400).json({ error: 'The instructions must be 2000 characters or fewer.' })
  }
  if (currentPrototype !== undefined) {
    if (
      !currentPrototype ||
      typeof currentPrototype !== 'object' ||
      Array.isArray(currentPrototype) ||
      typeof currentPrototype.name !== 'string' ||
      typeof currentPrototype.description !== 'string' ||
      !Array.isArray(currentPrototype.features) ||
      !currentPrototype.features.every((feature) => typeof feature === 'string')
    ) {
      return response.status(400).json({
        error: 'currentPrototype must include a name, description, and string features array.',
      })
    }
  }

  if (!groq) {
    return response.status(503).json({
      error: 'The backend is running, but GROQ_API_KEY is not configured in backend/.env.',
    })
  }

  const isRefinement = currentPrototype !== undefined
  const userContent = { idea, instructions, currentPrototype: currentPrototype || null }

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: [
            'You are a prototype strategist for software, hardware, and hybrid products.',
            'Design ideas that solve a specific real-world problem for identifiable users, in a realistic context.',
            'Prioritize feasibility, originality, practical usefulness, and a credible validation path.',
            'Do not default to generic categories such as standard chatbots, food delivery apps, generic task managers, or ordinary SaaS ideas unless the concept introduces a meaningful, clearly explained differentiation.',
            'If web research is unavailable, explicitly label the originality assessment as a preliminary AI-generated assessment rather than verified research.',
            'Return a single JSON object and nothing else. Include exactly these fields: name, tagline, description, problem, whyItMatters, targetUsers, whereUseful, userBenefit, category, difficulty, timeline, budget, currency, assumptions, originalityAssessment, similarSolutions, differentiation, potentialWeaknesses, validationPlan, qualityScores, features, featuresMvp, featuresSecondary, featuresAdvanced, technologyStack, architecture, buildPlan, testingPlan, risks, futureImprovements, imagePrompt.',
            'The top-level features field must be an array of 3 to 6 concise strings for the UI.',
            'featuresMvp, featuresSecondary, and featuresAdvanced must each be arrays of objects with this structure: { name, summary, problem, audience, howItWorks, requirements, inputs, userExperience, output, dependencies, difficulty, cost, limitations, validation }.',
            'technologyStack must be an array of objects with this structure: { name, type, purpose, whyNeeded, connectsTo, notes }.',
            'qualityScores must be an array of objects with this structure: { criterion, score, explanation }.',
            'Organization should be practical and realistic for the user constraints, including budget, available tools, and project type.',
            'Do not claim the idea is completely new, unique, or unprecedented without evidence.',
            'When the idea is generic, rework it into a more specific, differentiated concept before returning it.',
            'Use the provided instructions and current prototype to refine the concept while retaining its core intent.',
            'Output valid JSON only, without markdown fences or extra commentary.',
          ].join(' ') +
            (isRefinement
              ? ' Refine the supplied current prototype according to the instructions while retaining its core idea.'
              : ' Generate a useful concept from the idea and incorporate any supplied instructions.'),
        },
        { role: 'user', content: JSON.stringify(userContent) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1600,
    })

    const content = completion.choices[0]?.message?.content
    if (typeof content !== 'string') {
      return response.status(502).json({ error: 'The AI provider returned an empty response. Please try again.' })
    }

    let generated
    try {
      generated = JSON.parse(content)
    } catch {
      return response.status(502).json({ error: 'The AI provider returned an invalid response. Please try again.' })
    }

    if (
      !generated ||
      typeof generated !== 'object' ||
      typeof generated.name !== 'string' ||
      !generated.name.trim() ||
      typeof generated.description !== 'string' ||
      !generated.description.trim() ||
      !Array.isArray(generated.features) ||
      generated.features.length < 3 ||
      generated.features.length > 6 ||
      !generated.features.every((feature) => typeof feature === 'string' && feature.trim()) ||
      typeof generated.imagePrompt !== 'string' ||
      !generated.imagePrompt.trim()
    ) {
      return response.status(502).json({ error: 'The AI provider returned an incomplete concept. Please try again.' })
    }

    const blueprint = {
      tagline: typeof generated.tagline === 'string' ? generated.tagline.trim() : '',
      problem: typeof generated.problem === 'string' ? generated.problem.trim() : '',
      whyItMatters: typeof generated.whyItMatters === 'string' ? generated.whyItMatters.trim() : '',
      targetUsers: Array.isArray(generated.targetUsers) ? generated.targetUsers.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      whereUseful: Array.isArray(generated.whereUseful) ? generated.whereUseful.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      userBenefit: typeof generated.userBenefit === 'string' ? generated.userBenefit.trim() : '',
      category: typeof generated.category === 'string' ? generated.category.trim() : 'hybrid',
      difficulty: typeof generated.difficulty === 'string' ? generated.difficulty.trim() : 'Medium',
      timeline: typeof generated.timeline === 'string' ? generated.timeline.trim() : '4-8 weeks',
      budget: typeof generated.budget === 'string' ? generated.budget.trim() : 'Budget depends on scope',
      currency: typeof generated.currency === 'string' ? generated.currency.trim() : 'USD',
      assumptions: Array.isArray(generated.assumptions) ? generated.assumptions.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      originalityAssessment: generated.originalityAssessment && typeof generated.originalityAssessment === 'object' ? {
        summary: typeof generated.originalityAssessment.summary === 'string' ? generated.originalityAssessment.summary.trim() : 'Preliminary AI-generated originality assessment.',
        similar: Array.isArray(generated.originalityAssessment.similar) ? generated.originalityAssessment.similar.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
        difference: typeof generated.originalityAssessment.difference === 'string' ? generated.originalityAssessment.difference.trim() : '',
        unverified: typeof generated.originalityAssessment.unverified === 'string' ? generated.originalityAssessment.unverified.trim() : 'Originality should be validated with a quick market scan or user interviews.',
        validation: typeof generated.originalityAssessment.validation === 'string' ? generated.originalityAssessment.validation.trim() : 'Test with a lightweight prototype and user feedback.',
      } : {
        summary: 'Preliminary AI-generated originality assessment.',
        similar: [],
        difference: '',
        unverified: 'Originality should be validated with a quick market scan or user interviews.',
        validation: 'Test with a lightweight prototype and user feedback.',
      },
      similarSolutions: Array.isArray(generated.similarSolutions) ? generated.similarSolutions.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      differentiation: typeof generated.differentiation === 'string' ? generated.differentiation.trim() : '',
      potentialWeaknesses: Array.isArray(generated.potentialWeaknesses) ? generated.potentialWeaknesses.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      validationPlan: typeof generated.validationPlan === 'string' ? generated.validationPlan.trim() : '',
      qualityScores: Array.isArray(generated.qualityScores) ? generated.qualityScores.filter((item) => item && typeof item === 'object').map((item) => ({
        criterion: typeof item.criterion === 'string' ? item.criterion.trim() : 'Quality check',
        score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
        explanation: typeof item.explanation === 'string' ? item.explanation.trim() : '',
      })) : [],
      featuresMvp: Array.isArray(generated.featuresMvp) ? generated.featuresMvp.filter((item) => item && typeof item === 'object').map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : 'Feature',
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        problem: typeof item.problem === 'string' ? item.problem.trim() : '',
        audience: typeof item.audience === 'string' ? item.audience.trim() : '',
        howItWorks: typeof item.howItWorks === 'string' ? item.howItWorks.trim() : '',
        requirements: Array.isArray(item.requirements) ? item.requirements.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        inputs: Array.isArray(item.inputs) ? item.inputs.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        userExperience: typeof item.userExperience === 'string' ? item.userExperience.trim() : '',
        output: typeof item.output === 'string' ? item.output.trim() : '',
        dependencies: Array.isArray(item.dependencies) ? item.dependencies.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        difficulty: typeof item.difficulty === 'string' ? item.difficulty.trim() : 'Medium',
        cost: typeof item.cost === 'string' ? item.cost.trim() : '',
        limitations: Array.isArray(item.limitations) ? item.limitations.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        validation: typeof item.validation === 'string' ? item.validation.trim() : '',
      })) : [],
      featuresSecondary: Array.isArray(generated.featuresSecondary) ? generated.featuresSecondary.filter((item) => item && typeof item === 'object').map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : 'Feature',
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        problem: typeof item.problem === 'string' ? item.problem.trim() : '',
        audience: typeof item.audience === 'string' ? item.audience.trim() : '',
        howItWorks: typeof item.howItWorks === 'string' ? item.howItWorks.trim() : '',
        requirements: Array.isArray(item.requirements) ? item.requirements.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        inputs: Array.isArray(item.inputs) ? item.inputs.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        userExperience: typeof item.userExperience === 'string' ? item.userExperience.trim() : '',
        output: typeof item.output === 'string' ? item.output.trim() : '',
        dependencies: Array.isArray(item.dependencies) ? item.dependencies.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        difficulty: typeof item.difficulty === 'string' ? item.difficulty.trim() : 'Medium',
        cost: typeof item.cost === 'string' ? item.cost.trim() : '',
        limitations: Array.isArray(item.limitations) ? item.limitations.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        validation: typeof item.validation === 'string' ? item.validation.trim() : '',
      })) : [],
      featuresAdvanced: Array.isArray(generated.featuresAdvanced) ? generated.featuresAdvanced.filter((item) => item && typeof item === 'object').map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : 'Feature',
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        problem: typeof item.problem === 'string' ? item.problem.trim() : '',
        audience: typeof item.audience === 'string' ? item.audience.trim() : '',
        howItWorks: typeof item.howItWorks === 'string' ? item.howItWorks.trim() : '',
        requirements: Array.isArray(item.requirements) ? item.requirements.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        inputs: Array.isArray(item.inputs) ? item.inputs.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        userExperience: typeof item.userExperience === 'string' ? item.userExperience.trim() : '',
        output: typeof item.output === 'string' ? item.output.trim() : '',
        dependencies: Array.isArray(item.dependencies) ? item.dependencies.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        difficulty: typeof item.difficulty === 'string' ? item.difficulty.trim() : 'Medium',
        cost: typeof item.cost === 'string' ? item.cost.trim() : '',
        limitations: Array.isArray(item.limitations) ? item.limitations.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()) : [],
        validation: typeof item.validation === 'string' ? item.validation.trim() : '',
      })) : [],
      technologyStack: Array.isArray(generated.technologyStack) ? generated.technologyStack.filter((item) => item && typeof item === 'object').map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : 'Component',
        type: typeof item.type === 'string' ? item.type.trim() : 'General',
        purpose: typeof item.purpose === 'string' ? item.purpose.trim() : '',
        whyNeeded: typeof item.whyNeeded === 'string' ? item.whyNeeded.trim() : '',
        connectsTo: typeof item.connectsTo === 'string' ? item.connectsTo.trim() : '',
        notes: typeof item.notes === 'string' ? item.notes.trim() : '',
      })) : [],
      architecture: typeof generated.architecture === 'string' ? generated.architecture.trim() : '',
      buildPlan: Array.isArray(generated.buildPlan) ? generated.buildPlan.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      testingPlan: Array.isArray(generated.testingPlan) ? generated.testingPlan.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      risks: Array.isArray(generated.risks) ? generated.risks.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      futureImprovements: Array.isArray(generated.futureImprovements) ? generated.futureImprovements.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
    }

    return response.json({
      prototype: {
        name: generated.name.trim(),
        tagline: typeof generated.tagline === 'string' ? generated.tagline.trim() : '',
        description: generated.description.trim(),
        features: generated.features.map((feature) => feature.trim()),
        ideaSummary: idea,
        imagePrompt: generated.imagePrompt.trim(),
        blueprint,
      },
    })
  } catch {
    return response.status(502).json({
      error: 'The AI provider request failed. Check the configured Groq model and API key, then try again.',
    })
  }
})

app.post('/api/generate-image', async (request, response) => {
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({ error: 'Request body must be a JSON object.' })
  }

  const imagePrompt = typeof body.imagePrompt === 'string' ? body.imagePrompt.trim() : ''
  if (!imagePrompt) {
    return response.status(400).json({ error: 'The imagePrompt field is required.' })
  }
  if (imagePrompt.length > 2000) {
    return response.status(400).json({ error: 'The imagePrompt must be 2000 characters or fewer.' })
  }

  if (!cloudflareAccountId || !cloudflareApiToken) {
    return response.status(503).json({
      error: 'Image generation is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to backend/.env and restart the backend.',
    })
  }

  let imageBuffer
  try {
    const cloudflareResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccountId)}/ai/run/${imageModel}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: imagePrompt }),
        signal: AbortSignal.timeout(120_000),
      },
    )

    const responseContentType = cloudflareResponse.headers.get('content-type') || ''
    const responseBytes = Buffer.from(await cloudflareResponse.arrayBuffer())
    let result
    if (responseContentType.includes('application/json') || responseContentType.includes('+json')) {
      try {
        result = JSON.parse(responseBytes.toString('utf8'))
      } catch {
        result = null
      }
    }

    if (!cloudflareResponse.ok || result?.success === false) {
      const providerMessage = Array.isArray(result?.errors)
        ? result.errors.map((item) => item?.message).filter((message) => typeof message === 'string').join('; ')
        : ''
      const failure = getCloudflareFailure(cloudflareResponse.status, providerMessage)
      console.error('[image-generation] Cloudflare Workers AI request failed', JSON.stringify({
        model: imageModel,
        status: failure.status,
        message: failure.providerMessage || 'No provider error message was supplied.',
      }))
      return response.status(502).json({ error: failure.userMessage })
    }

    if (result !== undefined) {
      const encodedImage = result?.result?.image
      if (
        typeof encodedImage !== 'string' ||
        encodedImage.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedImage)
      ) {
        console.error('[image-generation] Cloudflare Workers AI returned an invalid image response', JSON.stringify({
          model: imageModel,
        }))
        return response.status(502).json({ error: 'Cloudflare Workers AI returned an invalid image. Please try again.' })
      }
      imageBuffer = Buffer.from(encodedImage, 'base64')
    } else {
      imageBuffer = responseBytes
    }
  } catch (error) {
    const failure = getCloudflareFailure(null, error?.message)
    console.error('[image-generation] Cloudflare Workers AI request failed', JSON.stringify({
      model: imageModel,
      status: failure.status,
      message: failure.providerMessage || 'No provider error message was supplied.',
    }))
    return response.status(502).json({ error: failure.userMessage })
  }

  const isPng = imageBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
  const isWebp = imageBuffer.toString('ascii', 0, 4) === 'RIFF' && imageBuffer.toString('ascii', 8, 12) === 'WEBP'
  const extension = isPng ? 'png' : isJpeg ? 'jpg' : isWebp ? 'webp' : null
  if (imageBuffer.length === 0 || imageBuffer.length > 10 * 1024 * 1024 || !extension) {
    return response.status(502).json({ error: 'Cloudflare Workers AI returned an unsupported or oversized image. Please try again.' })
  }

  const imageName = `${randomUUID()}.${extension}`
  try {
    await fs.mkdir(imageDirectory, { recursive: true })
    await fs.writeFile(path.join(imageDirectory, imageName), imageBuffer, { flag: 'wx' })
  } catch {
    return response.status(500).json({ error: 'The generated image could not be saved on the backend.' })
  }

  return response.status(201).json({ imageUrl: `/api/images/${imageName}` })
})

app.use((error, _request, response, _next) => {
  if (error.message === 'Origin not allowed') {
    return response.status(403).json({ error: 'Requests from this origin are not allowed.' })
  }
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must contain valid JSON.' })
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Request body is too large.' })
  }
  return response.status(500).json({ error: 'An unexpected server error occurred.' })
})

if (require.main === module) {
  app.listen(port, () => {
    console.log(`PROTOTYPE backend listening on port ${port}`)
  })
}

module.exports = app
