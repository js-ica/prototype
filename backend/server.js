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
const frontendOrigins = new Set([
  'http://localhost:5173',
  'https://prototype-iota-steel.vercel.app',
])
const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN
const imageModel = '@cf/black-forest-labs/flux-1-schnell'
const imageDirectory = path.join(__dirname, 'generated-images')
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

function createRateLimiter(limit, windowMs, errorMessage) {
  const requests = new Map()

  return (request, response, next) => {
    const now = Date.now()
    const key = request.ip || request.socket.remoteAddress || 'unknown'
    const current = requests.get(key)
    if (!current || now - current.startedAt >= windowMs) {
      requests.set(key, { startedAt: now, count: 1 })
    } else if (current.count >= limit) {
      response.setHeader('Retry-After', String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)))
      return response.status(429).json({ error: errorMessage })
    } else {
      current.count += 1
    }

    if (requests.size > 1000) {
      for (const [client, window] of requests) {
        if (now - window.startedAt >= windowMs) requests.delete(client)
      }
    }
    return next()
  }
}

function cleanStringList(value, limit = 8) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, limit)
    : []
}

function normalizeFeatures(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        howItWorks: typeof item.howItWorks === 'string' ? item.howItWorks.trim() : '',
        whyItMatters: typeof item.whyItMatters === 'string' ? item.whyItMatters.trim() : '',
      }))
    : []
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasUsefulText(value, minimumLength = 20) {
  return hasText(value) &&
    value.trim().length >= minimumLength &&
    !/\b(?:not available|n\/a|tbd|placeholder|to be determined)\b/i.test(value)
}

function parseBlueprintResponse(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new SyntaxError('The AI provider returned an empty response.')
  }

  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const json = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(json)
  } catch {
    throw new SyntaxError('The AI provider returned malformed JSON.')
  }
}

function getBlueprintFieldDiagnostics(generated, fields) {
  return fields.map((field) => {
    const entryMatch = field.match(/^(buildPlan|testingPlan)\[(\d+)\]$/)
    if (entryMatch) {
      const [, listName, indexText] = entryMatch
      const value = Array.isArray(generated?.[listName]) ? generated[listName][Number(indexText)] : undefined
      const minimumLength = listName === 'buildPlan' ? 35 : 45
      const reason = !hasText(value)
        ? 'not a non-empty string'
        : value.trim().length < minimumLength
          ? 'shorter than the minimum length'
          : /\b(?:not available|n\/a|tbd|placeholder|to be determined)\b/i.test(value)
            ? 'contains a placeholder'
            : 'invalid'
      return {
        field,
        type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
        length: typeof value === 'string' ? value.trim().length : null,
        minimumLength,
        reason,
      }
    }
    if (field === 'targetUsers') {
      const value = generated?.targetUsers
      return {
        field,
        type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
        itemCount: Array.isArray(value) ? value.length : null,
        usefulItemCount: Array.isArray(value) ? value.filter((item) => hasUsefulText(item, 10)).length : null,
      }
    }
    const countMatch = field.match(/^(buildPlan|testingPlan) count/)
    if (countMatch) {
      const value = generated?.[countMatch[1]]
      return {
        field,
        type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
        itemCount: Array.isArray(value) ? value.length : null,
        expectedCount: countMatch[1] === 'buildPlan' ? 3 : 2,
      }
    }
    return { field, reason: 'Field did not satisfy blueprint validation.' }
  })
}

async function requestBlueprintRepair(client, modelName, systemContent, userContent, generated, incompleteFields) {
  const repairGuidance = [
    'Return the complete blueprint as one JSON object using the exact same schema and preserve valid project details from previousBlueprint.',
    'name and description must accurately describe the supplied idea and target outcome. targetUsers must contain 2-4 distinct project-specific user groups with their context and need.',
    'features must contain 3-6 distinct strings. Each featuresMvp, featuresSecondary, and featuresAdvanced object must explain its user task, behavior, and relevance. Keep future feature groups empty when no useful addition is justified.',
    'technologyStack must contain 1-6 project-appropriate components only, each with its implementation purpose and project-specific reason or trade-off; never add filler technology.',
    'buildPlan must contain exactly 3 sequential, actionable project-specific strings, each stating an objective, concrete tasks, and tangible deliverable.',
    'testingPlan must contain exactly 2 project-specific strings, each stating the test, expected observation, and pass condition.',
    'Do not use nulls, objects, empty strings, placeholders, or claim proposed work has already been completed.',
  ]
  let currentBlueprint = generated
  let currentIncompleteFields = incompleteFields
  let completion

  for (let attempt = 0; attempt < 2 && currentIncompleteFields.length > 0; attempt += 1) {
    completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemContent },
        {
          role: 'user',
          content: JSON.stringify({
            ...userContent,
            instructions: [
              userContent.instructions,
              `Repair only the invalid or missing fields: ${currentIncompleteFields.join(', ')}.`,
              ...repairGuidance,
            ].filter(Boolean).join(' '),
            previousBlueprint: currentBlueprint,
          }),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 8192,
    })
    const repaired = parseBlueprintResponse(completion.choices[0]?.message?.content)
    currentBlueprint = mergeBlueprintRepair(currentBlueprint, repaired, currentIncompleteFields)
    currentIncompleteFields = getIncompleteBlueprintFields(currentBlueprint)
  }

  return {
    completion,
    generated: currentBlueprint,
    incompleteFields: currentIncompleteFields,
  }
}

function mergeBlueprintRepair(previous, repaired, incompleteFields) {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous) ||
    !repaired || typeof repaired !== 'object' || Array.isArray(repaired)) {
    return repaired
  }

  const merged = { ...previous }
  for (const field of incompleteFields) {
    if (field === 'blueprint') return repaired
    const normalizedField = field.replace(/\s+count.*$/, '')
    const tokens = [...normalizedField.matchAll(/[^.[\]]+|\[(\d+)\]/g)]
      .map((match) => match[1] === undefined ? match[0] : Number(match[1]))
    if (tokens.at(-1) === 'details' || tokens.at(-1) === 'count') tokens.pop()
    if (!tokens.length) continue

    let source = repaired
    for (const token of tokens) {
      if (source === null || source === undefined || !Object.hasOwn(source, token)) {
        source = undefined
        break
      }
      source = source[token]
    }
    if (source === undefined) continue

    let target = merged
    for (let index = 0; index < tokens.length - 1; index += 1) {
      const token = tokens[index]
      const next = target[token]
      target[token] = Array.isArray(next)
        ? [...next]
        : next && typeof next === 'object'
          ? { ...next }
          : typeof tokens[index + 1] === 'number'
            ? []
            : {}
      target = target[token]
    }
    target[tokens[tokens.length - 1]] = source
  }
  return merged
}

function getIncompleteBlueprintFields(generated) {
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) return ['blueprint']
  const missing = []
  const requiredText = [
    ['tagline', generated.tagline, 8],
    ['problem', generated.problem, 30],
    ['mechanism', generated.mechanism, 30],
    ['differentiation', generated.differentiation, 30],
    ['timeline', generated.timeline, 8],
    ['architecture', generated.architecture, 40],
    ['buildFeasibility.complexityReason', generated.buildFeasibility?.complexityReason, 30],
    ['buildFeasibility.simplifiedStartingVersion', generated.buildFeasibility?.simplifiedStartingVersion, 30],
    ['buildFeasibility.firstPracticalStep', generated.buildFeasibility?.firstPracticalStep, 25],
    ['buildFeasibility.estimatedCost.range', generated.buildFeasibility?.estimatedCost?.range, 6],
    ['buildFeasibility.estimatedCost.assumptions', generated.buildFeasibility?.estimatedCost?.assumptions, 20],
    ['buildFeasibility.estimatedCost.reason', generated.buildFeasibility?.estimatedCost?.reason, 20],
  ]
  const featureGroups = [generated.featuresMvp, generated.featuresSecondary, generated.featuresAdvanced]
  requiredText.forEach(([name, value, minimumLength]) => {
    if (!hasUsefulText(value, minimumLength)) missing.push(name)
  })
  if (!hasUsefulText(generated.name, 3)) missing.push('name')
  if (!hasUsefulText(generated.description, 30)) missing.push('description')
  if (!['beginner', 'intermediate', 'advanced'].includes(generated.buildFeasibility?.complexityLevel?.toLowerCase())) {
    missing.push('buildFeasibility.complexityLevel')
  }
  featureGroups.forEach((features, groupIndex) => {
    const groupName = ['featuresMvp', 'featuresSecondary', 'featuresAdvanced'][groupIndex]
    if (!Array.isArray(features) || (groupIndex === 0 && features.length === 0)) {
      missing.push(groupName)
      return
    }
    if (features.some((feature) => !feature || !hasText(feature.name) ||
      !hasUsefulText(feature.summary) || !hasUsefulText(feature.howItWorks, 30) ||
      !hasUsefulText(feature.whyItMatters))) {
      missing.push(`${groupName}.details`)
    }
  })
  if (Array.isArray(generated.featuresMvp) && (generated.featuresMvp.length < 2 || generated.featuresMvp.length > 3)) {
    missing.push('featuresMvp.count')
  }
  for (const groupName of ['featuresSecondary', 'featuresAdvanced']) {
    if (Array.isArray(generated[groupName]) && generated[groupName].length > 2) missing.push(`${groupName}.count`)
  }
  if (!['software', 'hardware', 'hybrid'].includes(generated.category)) missing.push('category')
  if (!Array.isArray(generated.targetUsers) || generated.targetUsers.length < 2 || generated.targetUsers.length > 4 ||
    generated.targetUsers.some((item) => !hasUsefulText(item, 10))) {
    missing.push('targetUsers')
  }
  if (!Array.isArray(generated.technologyStack) || generated.technologyStack.length < 1 || generated.technologyStack.length > 6) {
    missing.push('technologyStack.count')
  } else if (generated.technologyStack.some((item) => !item || !hasText(item.name) || !hasText(item.type) ||
    !hasUsefulText(item.purpose, 15) || !hasUsefulText(item.whyNeeded, 15))) {
    missing.push('technologyStack.details')
  }
  if (!Array.isArray(generated.features) || generated.features.length < 3 || generated.features.length > 6 ||
    generated.features.some((feature) => !hasUsefulText(feature, 8))) {
    missing.push('features')
  }
  if (!Array.isArray(generated.buildPlan) || generated.buildPlan.length !== 3) {
    missing.push(`buildPlan count (expected 3; received ${Array.isArray(generated.buildPlan) ? generated.buildPlan.length : typeof generated.buildPlan})`)
  } else {
    generated.buildPlan.forEach((step, index) => {
      if (!hasUsefulText(step, 35)) missing.push(`buildPlan[${index}]`)
    })
  }
  if (!Array.isArray(generated.testingPlan) || generated.testingPlan.length !== 2) {
    missing.push(`testingPlan count (expected 2; received ${Array.isArray(generated.testingPlan) ? generated.testingPlan.length : typeof generated.testingPlan})`)
  } else {
    generated.testingPlan.forEach((step, index) => {
      if (!hasUsefulText(step, 45)) missing.push(`testingPlan[${index}]`)
    })
  }
  return missing
}

function hasCompleteBlueprint(generated) {
  return getIncompleteBlueprintFields(generated).length === 0
}

function normalizeBuildFeasibility(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const allowedLevels = new Set(['beginner', 'intermediate', 'advanced'])
  const level = typeof source.complexityLevel === 'string' ? source.complexityLevel.trim().toLowerCase() : ''
  const cost = source.estimatedCost && typeof source.estimatedCost === 'object' ? source.estimatedCost : {}

  return {
    complexityLevel: allowedLevels.has(level) ? `${level[0].toUpperCase()}${level.slice(1)}` : 'Intermediate',
    complexityReason: typeof source.complexityReason === 'string' && source.complexityReason.trim()
      ? source.complexityReason.trim()
      : 'Assumption: a focused MVP uses a small set of components; confirm the scope against available skills and tools.',
    requiredResources: Array.isArray(source.requiredResources) ? source.requiredResources
      .filter((item) => item && typeof item === 'object' && typeof item.category === 'string')
      .map((item) => ({ category: item.category.trim(), items: cleanStringList(item.items, 8) }))
      .filter((item) => item.category && item.items.length)
      .slice(0, 8) : [],
    implementationChallenges: cleanStringList(source.implementationChallenges),
    risksAndLimitations: cleanStringList(source.risksAndLimitations),
    simplifiedStartingVersion: typeof source.simplifiedStartingVersion === 'string' && source.simplifiedStartingVersion.trim()
      ? source.simplifiedStartingVersion.trim()
      : 'Assumption: begin with the main user workflow and one prototype setup.',
    estimatedCost: {
      range: typeof cost.range === 'string' && cost.range.trim() ? cost.range.trim() : 'Not estimated',
      assumptions: typeof cost.assumptions === 'string' && cost.assumptions.trim()
        ? cost.assumptions.trim()
        : 'Assumption: cost depends on local component prices and prototype quantity.',
      reason: typeof cost.reason === 'string' && cost.reason.trim()
        ? cost.reason.trim()
        : 'Use local supplier quotes before committing to a budget.',
    },
    firstPracticalStep: typeof source.firstPracticalStep === 'string' && source.firstPracticalStep.trim()
      ? source.firstPracticalStep.trim()
      : 'Confirm the core need with representative users before purchasing components.',
  }
}

function createBlueprintSystemPrompt(isRefinement) {
  return [
    'You are a practical product and engineering strategist for software, hardware, and hybrid prototypes.',
    'Treat the user idea and constraints as authoritative. Be specific to the named problem, users, context, and outcome; do not fill fields with generic startup or app advice.',
    'Describe a coherent product: name is a concise project title; description is a 1-2 sentence summary naming the product, user, problem, and outcome. Keep problem, userBenefit, mechanism, differentiation, and whyDifferenceMatters distinct and mutually consistent.',
    'For new concepts, compare the problem, mechanism, and product form with recentIdeas when supplied; changing only the name or minor features is not a distinct idea. Do not sacrifice the user’s core problem just to be novel.',
    'targetUsers must contain 2-4 strings describing identifiable user groups in the relevant setting and their actual need. Do not use generic labels such as "users" or repeat the same audience.',
    'features must contain 3-6 concise, distinct capability strings. featuresMvp must contain 2-3 concrete feature objects; featuresSecondary and featuresAdvanced may each contain 0-2 genuinely useful future features. Do not invent features merely to fill a group. Each feature object has exactly { name, summary, howItWorks, whyItMatters }; explain the user task, the observable behavior, and the need it serves. Keep MVP essential and future groups optional and clearly distinct.',
    'technologyStack must contain 1-6 relevant, distinct components as { name, type, purpose, whyNeeded }. Include only technologies, tools, or materials that have a clear role in this idea. Prefer the simplest viable approach; do not add AI, blockchain, a database, payments, cloud, or external services unless the problem actually needs them. purpose explains what is used; whyNeeded explains project fit and a meaningful trade-off or limitation where relevant. Do not invent vendors, integrations, account credentials, or APIs.',
    'architecture explains the data or physical flow and how the named components work together. Mention external services only if they are optional or explicitly established by the idea; otherwise describe a viable local or manual alternative.',
    'buildPlan contains exactly 3 sequential MVP steps in dependency order. Each step must state its objective, concrete implementation tasks, and expected tangible deliverable, with project-specific detail; avoid vague tasks such as "build the frontend" or "add a database". Scale work to the stated complexity and do not imply anything has already been built.',
    'testingPlan contains exactly 2 practical, project-specific verification steps. Each states what to test, the expected observation, and a measurable or observable pass condition. These are proposed tests, never completed results.',
    'buildFeasibility contains complexityLevel (Beginner, Intermediate, or Advanced), complexityReason, requiredResources (relevant grouped hardware, tools, skills, and materials; do not repeat technologyStack), implementationChallenges, risksAndLimitations, simplifiedStartingVersion, estimatedCost ({ range, assumptions, reason }), and firstPracticalStep. Include realistic, project-specific challenges and mitigation or validation approaches where supported. Do not claim certainty unsupported by the idea.',
    'Give a rough timeline with scope and staffing assumptions. State reasonable assumptions explicitly in assumptions and feasibility fields when details are unknown; do not ask questions unless the idea is impossible to scope without an answer. For cost, if a defensible estimate is unavailable use "Not estimated", name the cost drivers, and recommend local quotes.',
    'originalityAssessment contains { summary, similar, unverified } and must be explicitly preliminary. similarSolutions and researchSearchTerms are suggestions, not evidence. Do not claim web research or invent products, sources, statistics, patents, test results, deployment links, or completed capabilities.',
    'Return valid JSON only with exactly these fields: name, tagline, description, problem, targetUsers, userBenefit, mechanism, category, difficulty, timeline, assumptions, originalityAssessment, similarSolutions, researchSearchTerms, differentiation, whyDifferenceMatters, features, featuresMvp, featuresSecondary, featuresAdvanced, technologyStack, architecture, buildPlan, testingPlan, buildFeasibility.',
    'Use category exactly software, hardware, or hybrid. Do not return nulls, objects in place of strings, empty required fields, or placeholder text. Do not repeat the same explanation across sections.',
    isRefinement
      ? 'For refinement, use currentPrototype and its blueprint as the source of truth. Treat instructions as requested changes: preserve the project identity, purpose, users, constraints, and all unrelated validated decisions. Update only affected sections, but return the complete current schema. Do not regenerate a different project or discard existing features unless explicitly requested.'
      : 'For a new concept, build the solution from the supplied idea and instructions without overriding the user’s intended problem or constraints.',
    'Output JSON only without markdown or commentary.',
  ].join(' ')
}

const limitTextGeneration = createRateLimiter(8, 60_000, 'Too many AI requests. Wait a minute, then try again.')
const limitImageGeneration = createRateLimiter(4, 60_000, 'Too many image requests. Wait a minute, then try again.')

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
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:hf|gsk)_[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500)
}

function getGroqErrorDiagnostic(error) {
  const rawMessage = typeof error?.message === 'string' ? error.message : ''
  const jsonStart = rawMessage.indexOf('{"error":')
  if (jsonStart < 0) {
    return { code: error?.code || null, message: sanitizeProviderMessage(rawMessage) || 'No provider error message was supplied.' }
  }

  try {
    const providerError = JSON.parse(rawMessage.slice(jsonStart))?.error
    const failedGeneration = providerError?.failed_generation
    let jsonError = null
    if (typeof failedGeneration === 'string') {
      try {
        JSON.parse(failedGeneration)
      } catch (parseError) {
        jsonError = parseError.message
      }
    }
    return {
      code: providerError?.code || error?.code || null,
      message: sanitizeProviderMessage(providerError?.message) || 'The provider rejected its generated response.',
      failedGenerationLength: typeof failedGeneration === 'string' ? failedGeneration.length : null,
      generatedJsonError: jsonError,
    }
  } catch {
    return { code: error?.code || null, message: 'The provider returned an unreadable error response.' }
  }
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

function getProjectCategory(project) {
  const technologyDetails = Array.isArray(project.technologyStack)
    ? project.technologyStack.map((item) =>
      item && typeof item === 'object' ? `${item.name || ''} ${item.type || ''} ${item.purpose || ''}` : '',
    ).join(' ')
    : ''
  const visualDetails = `${project.imagePrompt || ''} ${Array.isArray(project.features) ? project.features.join(' ') : ''}`
  const physicalDesign = /\b(sensor|device|probe|hardware|microcontroller|esp32|battery|solar|circuit|robot|module|controller|motor|antenna|valve|pump|wearable|equipment|actuator)\b/i
    .test(`${technologyDetails} ${visualDetails}`)
  const softwareDesign = /\b(app|software|dashboard|interface|web|mobile|screen|platform|portal|digital)\b/i
    .test(`${technologyDetails} ${visualDetails}`)
  const requestedCategory = typeof project.category === 'string' ? project.category.toLowerCase() : ''

  if (['software', 'hardware', 'hybrid'].includes(requestedCategory)) return requestedCategory
  if (requestedCategory.includes('hybrid') || (physicalDesign && softwareDesign)) return 'hybrid'
  if (physicalDesign || requestedCategory.includes('hardware')) return 'hardware'
  return 'software'
}

function getGroqUserError(error) {
  const status = Number(error?.status) || 0
  const code = String(error?.code || '').toLowerCase()
  const diagnostic = getGroqErrorDiagnostic(error)
  const providerMessage = diagnostic.message.toLowerCase()

  if (status === 401 || code.includes('authentication')) {
    return 'Groq rejected the configured API key. Check GROQ_API_KEY in backend/.env and restart the backend. Do not share the key.'
  }
  if (status === 402 || (status === 403 && /billing|payment|quota/.test(providerMessage))) {
    return 'Groq account billing or quota restrictions prevented generation. Check the account usage and billing settings for the configured API key.'
  }
  if (status === 403) {
    return 'The configured Groq account or API key is not permitted to use this model. Check its model access and account settings.'
  }
  if (status === 404 || /model_not_found|model_decommissioned/.test(code)) {
    return `Groq does not recognize the configured model "${model}". Check GROQ_MODEL in backend/.env against Groq's active model list.`
  }
  if (status === 429) {
    if (/tokens per day|\btpd\b|daily token/.test(providerMessage)) {
      return 'Groq has exhausted the daily token quota for this model. Wait for the quota reset or increase the Groq plan limit; the API key and model configuration do not need to be changed.'
    }
    if (/billing|payment|quota/.test(providerMessage)) {
      return 'Groq rejected the request because of an account quota or billing limit. Check the Groq account usage and billing settings.'
    }
    return 'Groq rate-limited this request. Wait before retrying; check the Groq account limits if the error continues.'
  }
  if (status === 400) {
    if (code === 'json_validate_failed') {
      return 'Groq rejected the generated blueprint response format. Please retry; if it continues, check the backend logs for sanitized response diagnostics.'
    }
    return 'Groq rejected the generation request as invalid. Check the backend request parameters and configured model.'
  }
  if (status >= 500) {
    return 'Groq is temporarily unavailable. Wait briefly and try again.'
  }
  if (!status || /connection|network|timeout|enotfound|econnreset|etimedout/.test(code)) {
    return 'The backend could not connect to Groq. Check server internet access, DNS, firewall, or proxy settings, then retry.'
  }
  return 'Groq could not complete the request. Check the backend logs for the sanitized provider diagnostic and try again.'
}

function createProjectImagePrompt(project) {
  const shorten = (value, limit) => typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, limit).trim()
    : ''
  const priorityFeatures = Array.isArray(project.featuresMvp) && project.featuresMvp.length
    ? project.featuresMvp.slice(0, 2).map((feature) =>
      `${shorten(feature.name, 48)}${feature.summary ? `: ${shorten(feature.summary, 64)}` : ''}`,
    ).join('; ')
    : Array.isArray(project.features) ? project.features.slice(0, 2).map((feature) => shorten(feature, 48)).join('; ') : ''
  const category = getProjectCategory(project)
  const design = category === 'software'
    ? 'Show its project-specific interface'
    : category === 'hardware'
      ? 'Show the device as the central subject'
      : 'Show the device and its connected interface together'
  const name = shorten(project.name, 56) || 'the proposed project'
  const purpose = shorten(project.description, 110)
  const features = shorten(priorityFeatures, 190)
  const direction = `Clean, realistic concept illustration of ${name}${purpose ? `: ${purpose}` : ''}. ${design}${features ? `, clearly showing ${features}` : ''}. Focus only on the core design; no unrelated objects.`
  return direction.slice(0, 500).trim()
}

function hasRepeatedConcept(generated, recentIdeas) {
  const commonWords = new Set([
    'about', 'after', 'also', 'approach', 'based', 'being', 'between', 'could', 'features',
    'from', 'idea', 'into', 'more', 'need', 'over', 'project', 'provide', 'provides', 'small',
    'solution', 'that', 'their', 'them', 'there', 'these', 'this', 'those', 'through', 'using',
    'users', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
  ])
  const candidateText = [
    generated.name,
    generated.description,
    generated.problem,
    generated.mechanism,
    ...(Array.isArray(generated.features) ? generated.features : []),
    ...(Array.isArray(generated.featuresMvp) ? generated.featuresMvp.map((feature) => feature?.name) : []),
    ...(Array.isArray(generated.technologyStack) ? generated.technologyStack.map((item) => item?.name) : []),
  ].filter((value) => typeof value === 'string').join(' ')
  const getTerms = (value) =>
    new Set((value.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !commonWords.has(word)))
  const candidateTerms = getTerms(candidateText)
  const families = [
    /\b(sensor|probe|spectrometer|meter)\b/i,
    /\b(chatbot|virtual assistant|conversational agent)\b/i,
    /\b(task manager|to-do list|task planner)\b/i,
    /\b(food delivery|delivery platform|meal delivery)\b/i,
    /\b(attendance app|attendance tracker|check-in system)\b/i,
    /\b(expense tracker|expense manager|budget tracker)\b/i,
    /\b(smart home|home automation)\b/i,
  ]

  return recentIdeas.some((recentIdea) => {
    const previousTerms = getTerms(recentIdea)
    const sharedTerms = [...candidateTerms].filter((term) => previousTerms.has(term))
    const sameProductFamily = families.some((family) => family.test(candidateText) && family.test(recentIdea))
    const overlapRatio = sharedTerms.length / Math.max(1, Math.min(candidateTerms.size, previousTerms.size))
    return (sameProductFamily && sharedTerms.length >= 2) || (sharedTerms.length >= 5 && overlapRatio >= 0.4)
  })
}

function getDuplicateAvoidanceInstruction(generated, recentIdeas) {
  const candidateText = [
    generated.name,
    generated.description,
    generated.mechanism,
    ...(Array.isArray(generated.features) ? generated.features : []),
    ...(Array.isArray(generated.technologyStack) ? generated.technologyStack.map((item) => item?.name) : []),
  ].filter((value) => typeof value === 'string').join(' ')
  const familyInstructions = [
    {
      pattern: /\b(sensor|probe|spectrometer|meter)\b/i,
      instruction: 'Do not propose any sensor, probe, spectrometer, meter, or other measuring device. Change the solution modality to a non-device service, shared sampling workflow, coordination process, or another approach that does not repeat soil-measuring hardware.',
    },
    {
      pattern: /\b(chatbot|virtual assistant|conversational agent)\b/i,
      instruction: 'Do not propose another chatbot, conversational agent, or virtual assistant. Change to a non-conversational workflow or service.',
    },
    {
      pattern: /\b(task manager|to-do list|task planner)\b/i,
      instruction: 'Do not propose another task manager, to-do list, or task planner. Change the central mechanism and product form.',
    },
    {
      pattern: /\b(food delivery|delivery platform|meal delivery)\b/i,
      instruction: 'Do not propose another food-delivery or delivery marketplace. Change the central mechanism and product form.',
    },
    {
      pattern: /\b(attendance app|attendance tracker|check-in system)\b/i,
      instruction: 'Do not propose another attendance tracker, check-in system, or attendance app. Change the central mechanism and product form.',
    },
    {
      pattern: /\b(expense tracker|expense manager|budget tracker)\b/i,
      instruction: 'Do not propose another expense or budget tracker. Change the central mechanism and product form.',
    },
    {
      pattern: /\b(smart home|home automation)\b/i,
      instruction: 'Do not propose another smart-home or home-automation device. Change the central mechanism and product form.',
    },
  ]
  const matchingFamily = familyInstructions.find(({ pattern }) =>
    pattern.test(candidateText) && recentIdeas.some((recentIdea) => pattern.test(recentIdea)),
  )
  return matchingFamily?.instruction || 'Avoid the previously rejected mechanism and product form. Change the central approach, not just its name or feature list.'
}


app.use(
  cors({
    origin(origin, callback) {
      if (!origin || frontendOrigins.has(origin)) {
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

app.post('/api/clarify', limitTextGeneration, async (request, response) => {
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({ error: 'Request body must be a JSON object.' })
  }
  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  if (!idea) return response.status(400).json({ error: 'The idea field is required.' })
  if (idea.length > 4000) return response.status(400).json({ error: 'The idea must be 4000 characters or fewer.' })
  if (!groq) {
    return response.status(503).json({
      error: 'The backend is running, but GROQ_API_KEY is not configured in backend/.env.',
    })
  }

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: [
            'Determine whether the supplied project idea contains enough specific information for a useful, project-specific prototype blueprint.',
            'Treat an idea as sufficiently clear when it gives an intended audience, a concrete problem or goal, a plausible solution direction or outcome, and any critical constraints the user has already chosen. If those are present, return needsClarification false even if optional product details remain unknown.',
            'Ask only questions whose answers are not already stated or reasonably inferable and whose answers would materially change the first blueprint. Usually ask 1-3 concise questions, never more than 4. Do not ask for preferences or implementation details that can remain explicit assumptions.',
            'Questions may clarify intended user, concrete problem, distinguishing approach, context, and essential constraints. Do not ask generic questions or require details that can safely remain assumptions.',
            'If the idea is already sufficiently detailed, return needsClarification false and an empty questions array.',
            'Do not rewrite the idea, impose requirements, or change the user intention. Return JSON only: {"needsClarification": boolean, "questions": ["..."]}.',
          ].join(' '),
        },
        { role: 'user', content: JSON.stringify({ idea }) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 500,
    })
    const content = completion.choices[0]?.message?.content
    const result = typeof content === 'string' ? JSON.parse(content) : null
    if (
      !result ||
      typeof result.needsClarification !== 'boolean' ||
      !Array.isArray(result.questions) ||
      !result.questions.every((question) => typeof question === 'string' && question.trim())
    ) {
      return response.status(502).json({ error: 'The AI returned invalid clarification questions. Please try again.' })
    }
    const questions = result.needsClarification
      ? result.questions.map((question) => question.trim().slice(0, 160)).filter(Boolean).slice(0, 4)
      : []
    return response.json({ needsClarification: questions.length > 0, questions })
  } catch (error) {
    console.error('[idea-clarification] Groq request failed', JSON.stringify({
      model,
      status: error?.status || null,
      code: error?.code || null,
      requestId: error?.requestID || error?.request_id || null,
      message: sanitizeProviderMessage(error?.message) || 'No provider error message was supplied.',
    }))
    return response.status(502).json({ error: 'Idea clarification could not be completed. Try again or generate without clarification.' })
  }
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

app.post('/api/generate', limitTextGeneration, async (request, response) => {
  const body = request.body
  const generationStartedAt = Date.now()

  response.on('finish', () => {
    console.log(`[generation] Completed with status ${response.statusCode} in ${Date.now() - generationStartedAt}ms`)
  })

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({ error: 'Request body must be a JSON object.' })
  }

  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  const instructions =
    body.instructions === undefined
      ? ''
      : typeof body.instructions === 'string'
        ? body.instructions.trim()
        : null
  const currentPrototype = body.currentPrototype
  const recentIdeas = body.recentIdeas === undefined ? [] : body.recentIdeas

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
  if (
    !Array.isArray(recentIdeas) ||
    recentIdeas.length > 8 ||
    !recentIdeas.every((item) => typeof item === 'string' && item.trim().length <= 500)
  ) {
    return response.status(400).json({ error: 'recentIdeas must contain up to 8 strings of 500 characters or fewer.' })
  }
  if (currentPrototype !== undefined) {
    if (
      !currentPrototype ||
      typeof currentPrototype !== 'object' ||
      Array.isArray(currentPrototype) ||
      typeof currentPrototype.name !== 'string' ||
      typeof currentPrototype.description !== 'string' ||
      !Array.isArray(currentPrototype.features) ||
      !currentPrototype.features.every((feature) => typeof feature === 'string' && feature.length <= 500) ||
      currentPrototype.name.length > 200 ||
      currentPrototype.description.length > 4000 ||
      currentPrototype.features.length > 20
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
  const userContent = {
    idea,
    instructions,
    currentPrototype: currentPrototype || null,
    recentIdeas,
  }
  const systemContent = createBlueprintSystemPrompt(isRefinement)

  try {
    let completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: JSON.stringify(userContent) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 8192,
    })

    let generated
    try {
      generated = parseBlueprintResponse(completion.choices[0]?.message?.content)
    } catch (error) {
      console.error('[text-generation] Groq returned malformed blueprint JSON', JSON.stringify({
        model,
        requestId: completion.id || null,
        finishReason: completion.choices[0]?.finish_reason || null,
        error: error.message,
      }))
      return response.status(502).json({ error: 'The AI provider returned an invalid response. Please try again.' })
    }

    if (
      !isRefinement &&
      recentIdeas.length > 0 &&
      generated &&
      typeof generated === 'object' &&
      hasRepeatedConcept(generated, recentIdeas)
    ) {
      const rejectedApproach = typeof generated.mechanism === 'string'
        ? generated.mechanism
        : typeof generated.description === 'string'
          ? generated.description
          : 'the previous proposed mechanism'
      const retryUserContent = {
        ...userContent,
        instructions: [
          instructions,
          `Your previous draft repeated a recent idea and was rejected. Preserve the underlying problem, but choose a materially different solution mechanism and product form. ${getDuplicateAvoidanceInstruction(generated, recentIdeas)} Do not use this approach: ${rejectedApproach.slice(0, 500)}. Do not just change the feature list or name.`,
        ].filter(Boolean).join(' '),
      }
      completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: JSON.stringify(retryUserContent) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 8192,
      })
      try {
        generated = parseBlueprintResponse(completion.choices[0]?.message?.content)
      } catch (error) {
        console.error('[text-generation] Groq returned malformed blueprint JSON after novelty retry', JSON.stringify({
          model,
          requestId: completion.id || null,
          error: error.message,
        }))
        return response.status(502).json({ error: 'The AI provider returned an invalid response after avoiding a repeated idea. Please try again.' })
      }
      if (generated && typeof generated === 'object' && hasRepeatedConcept(generated, recentIdeas)) {
        console.warn('[text-generation] Groq repeated a recent concept after one retry', JSON.stringify({
          model,
          requestId: completion.id || null,
          recentIdeaCount: recentIdeas.length,
        }))
        return response.status(502).json({
          error: 'The AI could not produce a sufficiently different idea from recent projects. Add a new constraint or try again.',
        })
      }
    }

    let incompleteFields = getIncompleteBlueprintFields(generated)
    if (incompleteFields.length > 0 && generated && typeof generated === 'object' && !Array.isArray(generated)) {
      try {
        const repair = await requestBlueprintRepair(groq, model, systemContent, userContent, generated, incompleteFields)
        completion = repair.completion
        generated = repair.generated
        incompleteFields = repair.incompleteFields
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error('[text-generation] Groq returned malformed blueprint JSON during targeted repair', JSON.stringify({
            model,
            requestId: error.requestId || null,
            fields: incompleteFields,
            error: error.message,
          }))
          return response.status(502).json({ error: 'The AI returned an invalid blueprint while completing missing details. Please try again.' })
        }
        throw error
      }
      if (!isRefinement && recentIdeas.length > 0 && hasRepeatedConcept(generated, recentIdeas)) {
        return response.status(502).json({
          error: 'The AI could not produce a sufficiently different idea with a complete blueprint. Add a new constraint or try again.',
        })
      }
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
      !generated.buildFeasibility ||
      typeof generated.buildFeasibility !== 'object' ||
      incompleteFields.length > 0
    ) {
      console.error('[text-generation] Groq returned an incomplete or underspecified blueprint', JSON.stringify({
        model,
        finishReason: completion.choices[0]?.finish_reason || null,
        completionTokens: completion.usage?.completion_tokens || null,
        returnedFields: generated && typeof generated === 'object' ? Object.keys(generated) : [],
        missingFields: incompleteFields,
        fieldDiagnostics: getBlueprintFieldDiagnostics(generated, incompleteFields),
      }))
      return response.status(502).json({ error: 'The AI could not provide all required blueprint details. Please try again.' })
    }

    const blueprint = {
      tagline: typeof generated.tagline === 'string' ? generated.tagline.trim() : '',
      problem: typeof generated.problem === 'string' ? generated.problem.trim() : '',
      targetUsers: Array.isArray(generated.targetUsers) ? generated.targetUsers.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      userBenefit: typeof generated.userBenefit === 'string' ? generated.userBenefit.trim() : '',
      mechanism: typeof generated.mechanism === 'string' ? generated.mechanism.trim() : '',
      category: getProjectCategory(generated),
      difficulty: typeof generated.difficulty === 'string' ? generated.difficulty.trim() : '',
      timeline: generated.timeline.trim(),
      assumptions: Array.isArray(generated.assumptions) ? generated.assumptions.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      originalityAssessment: generated.originalityAssessment && typeof generated.originalityAssessment === 'object' ? {
        summary: typeof generated.originalityAssessment.summary === 'string' ? generated.originalityAssessment.summary.trim() : '',
        similar: Array.isArray(generated.originalityAssessment.similar) ? generated.originalityAssessment.similar.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
        unverified: typeof generated.originalityAssessment.unverified === 'string' ? generated.originalityAssessment.unverified.trim() : '',
      } : {
        summary: '',
        similar: [],
        unverified: '',
      },
      similarSolutions: Array.isArray(generated.similarSolutions) ? generated.similarSolutions.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      researchSearchTerms: Array.isArray(generated.researchSearchTerms) ? generated.researchSearchTerms.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      differentiation: typeof generated.differentiation === 'string' ? generated.differentiation.trim() : '',
      whyDifferenceMatters: typeof generated.whyDifferenceMatters === 'string' ? generated.whyDifferenceMatters.trim() : '',
      buildFeasibility: normalizeBuildFeasibility(generated.buildFeasibility),
      featuresMvp: normalizeFeatures(generated.featuresMvp),
      featuresSecondary: normalizeFeatures(generated.featuresSecondary),
      featuresAdvanced: normalizeFeatures(generated.featuresAdvanced),
      technologyStack: Array.isArray(generated.technologyStack) ? generated.technologyStack.filter((item) => item && typeof item === 'object').map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        type: typeof item.type === 'string' ? item.type.trim() : '',
        purpose: typeof item.purpose === 'string' ? item.purpose.trim() : '',
        whyNeeded: typeof item.whyNeeded === 'string' ? item.whyNeeded.trim() : '',
      })) : [],
      architecture: typeof generated.architecture === 'string' ? generated.architecture.trim() : '',
      buildPlan: Array.isArray(generated.buildPlan) ? generated.buildPlan.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
      testingPlan: Array.isArray(generated.testingPlan) ? generated.testingPlan.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [],
    }
    return response.json({
      prototype: {
        name: generated.name.trim(),
        tagline: typeof generated.tagline === 'string' ? generated.tagline.trim() : '',
        description: generated.description.trim(),
        features: generated.features.map((feature) => feature.trim()),
        ideaSummary: idea,
        imagePrompt: createProjectImagePrompt(generated),
        blueprint,
      },
    })
  } catch (error) {
    const diagnostic = getGroqErrorDiagnostic(error)
    console.error('[text-generation] Groq request failed', JSON.stringify({
      model,
      status: error?.status || null,
      type: error?.type || null,
      requestId: error?.requestID || error?.request_id || null,
      ...diagnostic,
    }))
    return response.status(502).json({
      error: getGroqUserError(error),
    })
  }
})

app.post('/api/generate-image', limitImageGeneration, async (request, response) => {
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
        return response.status(502).json({
          error: 'Cloudflare Workers AI returned an invalid image. Please try again.',
        })
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
  const isWebp = imageBuffer.toString('ascii', 0, 4) === 'RIFF' &&
    imageBuffer.toString('ascii', 8, 12) === 'WEBP'
  const extension = isPng ? 'png' : isJpeg ? 'jpg' : isWebp ? 'webp' : null
  if (imageBuffer.length === 0 || imageBuffer.length > 10 * 1024 * 1024 || !extension) {
    return response.status(502).json({
      error: 'Cloudflare Workers AI returned an unsupported or oversized image. Please try again.',
    })
  }

  const imageName = `${randomUUID()}.${extension}`
  try {
    await fs.mkdir(imageDirectory, { recursive: true })
    await fs.writeFile(
      path.join(imageDirectory, imageName),
      imageBuffer,
      { flag: 'wx' },
    )
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
module.exports.createProjectImagePrompt = createProjectImagePrompt
module.exports.normalizeBuildFeasibility = normalizeBuildFeasibility
module.exports.hasCompleteBlueprint = hasCompleteBlueprint
module.exports.getIncompleteBlueprintFields = getIncompleteBlueprintFields
module.exports.getGroqErrorDiagnostic = getGroqErrorDiagnostic
module.exports.getGroqUserError = getGroqUserError
module.exports.parseBlueprintResponse = parseBlueprintResponse
module.exports.getBlueprintFieldDiagnostics = getBlueprintFieldDiagnostics
module.exports.requestBlueprintRepair = requestBlueprintRepair
module.exports.createBlueprintSystemPrompt = createBlueprintSystemPrompt
