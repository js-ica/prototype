const assert = require('node:assert/strict')
const { after, test } = require('node:test')
const app = require('./server')

const server = app.listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}`

after(() => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve())
}))

test('clarification endpoint rejects an empty idea and rate-limits excess requests', async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: '' }),
    })
    assert.equal(response.status, 400)
  }
  const limited = await fetch(`${baseUrl}/api/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea: '' }),
  })
  assert.equal(limited.status, 429)
})

test('image prompt prioritizes blueprint features and project context', () => {
  const prompt = app.createProjectImagePrompt({
    name: 'Library Repair Scheduler',
    description: 'A library appointment calendar for coordinating mobility-aid repairs.',
    problem: 'Staff lose track of repair appointments.',
    category: 'software',
    imagePrompt: 'Accessible calendar with repair status.',
    featuresMvp: [
      { name: 'Repair appointment calendar', summary: 'Book technician time.', howItWorks: 'Choose an open repair slot.' },
      { name: 'Repair status queue', summary: 'See request progress.', howItWorks: 'Show received and scheduled states.' },
      { name: 'Unneeded extra feature', summary: 'Decorative suggestion.', howItWorks: 'Do not prioritize.' },
    ],
    features: ['Calendar', 'Status queue'],
    technologyStack: [{ name: 'Accessible web interface', type: 'Software' }],
    targetUsers: ['Library staff'],
    whereUseful: ['Public library'],
  })

  assert.match(prompt, /Library Repair Scheduler/)
  assert.match(prompt, /Repair appointment calendar/)
  assert.match(prompt, /Repair status queue/)
  assert.doesNotMatch(prompt, /Unneeded extra feature/)
  assert.doesNotMatch(prompt, /Accessible calendar with repair status/)
  assert.ok(prompt.length <= 500)
  assert.match(prompt, /concept illustration/)
})

test('build feasibility normalization supplies a compact and stable shape', () => {
  assert.deepEqual(app.normalizeBuildFeasibility({
    complexityLevel: 'intermediate',
    complexityReason: 'Needs one small pilot.',
    requiredResources: [{ category: 'Tools', items: ['Prototype UI', '', 'Test user'] }],
    implementationChallenges: ['Limited access to pilot sites'],
    risksAndLimitations: ['Adoption needs testing'],
    simplifiedStartingVersion: 'A single-site prototype',
    estimatedCost: { range: 'Not estimated', assumptions: 'Costs depend on hardware.', reason: 'Local quotes are needed.' },
    firstPracticalStep: 'Interview one potential user.',
  }), {
    complexityLevel: 'Intermediate',
    complexityReason: 'Needs one small pilot.',
    requiredResources: [{ category: 'Tools', items: ['Prototype UI', 'Test user'] }],
    implementationChallenges: ['Limited access to pilot sites'],
    risksAndLimitations: ['Adoption needs testing'],
    simplifiedStartingVersion: 'A single-site prototype',
    estimatedCost: { range: 'Not estimated', assumptions: 'Costs depend on hardware.', reason: 'Local quotes are needed.' },
    firstPracticalStep: 'Interview one potential user.',
  })
})

test('blueprint validation rejects missing project-specific implementation details and repairs an incomplete response', async () => {
  const feature = {
    name: 'Core workflow',
    summary: 'Complete the main user task.',
    howItWorks: 'The interface collects required inputs and shows a result.',
    whyItMatters: 'It addresses the primary user need.',
  }
  const blueprint = {
    name: 'Library Repair Scheduler',
    description: 'A scheduling tool that helps public library staff coordinate mobility-aid repairs and communicate appointment status.',
    features: ['Book repair appointments', 'Track repair status', 'Coordinate technician availability'],
    tagline: 'A focused prototype.',
    problem: 'Users cannot complete the task reliably.',
    mechanism: 'Guide users through the main task and show the result before they commit changes.',
    differentiation: 'Designed for the specific user context.',
    category: 'software',
    timeline: '3-5 weeks, assuming one builder.',
    targetUsers: ['Public library staff coordinating mobility-aid repairs', 'Technicians servicing mobility aids at local libraries'],
    architecture: 'A web client sends requests to a small API and stores prototype data locally.',
    featuresMvp: [feature, { ...feature, name: 'Progress view' }],
    featuresSecondary: [{ ...feature, name: 'Team access' }],
    featuresAdvanced: [{ ...feature, name: 'Usage analysis' }],
    technologyStack: [
      { name: 'React', type: 'Software', purpose: 'Render the interface and main user workflow.', whyNeeded: 'The prototype needs an accessible browser interface.' },
      { name: 'Node.js API', type: 'Software', purpose: 'Validate and process requests from the interface.', whyNeeded: 'A server boundary keeps request handling consistent.' },
      { name: 'SQLite', type: 'Database', purpose: 'Store prototype records for the first release.', whyNeeded: 'A local relational store supports the small initial dataset.' },
    ],
    buildPlan: [
      'Create the project-specific input form and save a valid first record.',
      'Implement the primary workflow and display its result in the prototype.',
      'Add request validation and a visible recovery state for invalid input.',
    ],
    testingPlan: [
      'Submit a valid project-specific record; confirm it is saved and shown with the expected result.',
      'Submit an incomplete record; confirm validation identifies the missing field and prevents saving.',
    ],
    originalityAssessment: { summary: 'Preliminary comparison only.', unverified: 'Check existing tools before claiming novelty.' },
    buildFeasibility: {
      complexityLevel: 'Beginner',
      complexityReason: 'The MVP uses three familiar components.',
      simplifiedStartingVersion: 'One user and the main workflow.',
      firstPracticalStep: 'Confirm the workflow with two intended users.',
      estimatedCost: { range: 'Not estimated', assumptions: 'Hosting and local rates are unknown.', reason: 'Collect local quotes.' },
    },
  }
  assert.equal(app.hasCompleteBlueprint(blueprint), true)
  assert.equal(app.hasCompleteBlueprint({ ...blueprint, architecture: '' }), false)
  assert.equal(app.hasCompleteBlueprint({ ...blueprint, name: '' }), false)
  assert.equal(app.hasCompleteBlueprint({ ...blueprint, description: '' }), false)
  assert.equal(app.hasCompleteBlueprint({ ...blueprint, features: ['Only one feature'] }), false)
  assert.equal(app.hasCompleteBlueprint({ ...blueprint, featuresMvp: [feature] }), false)
  assert.equal(app.hasCompleteBlueprint({ ...blueprint, technologyStack: [] }), false)
  assert.equal(app.hasCompleteBlueprint({
    ...blueprint,
    technologyStack: blueprint.technologyStack.slice(0, 1),
    featuresSecondary: [],
    featuresAdvanced: [],
  }), true)
  assert.ok(app.getIncompleteBlueprintFields({
    ...blueprint,
    technologyStack: [{ ...blueprint.technologyStack[0], purpose: '' }],
  }).includes('technologyStack.details'))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, problem: 'Not available.' }).includes('problem'))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, buildPlan: ['Build it.', ...blueprint.buildPlan.slice(1)] }).includes('buildPlan[0]'))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, targetUsers: [] }).includes('targetUsers'))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, targetUsers: [blueprint.targetUsers[0]] }).includes('targetUsers'))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, targetUsers: [null, ''] }).includes('targetUsers'))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, buildPlan: [] }).some((field) => field.startsWith('buildPlan count')))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, testingPlan: [] }).some((field) => field.startsWith('testingPlan count')))
  assert.ok(app.getIncompleteBlueprintFields({ ...blueprint, testingPlan: [{ name: 'wrong shape' }, null] }).includes('testingPlan[0]'))
  assert.deepEqual(app.getIncompleteBlueprintFields({ ...blueprint, architecture: '' }), ['architecture'])

  const incompleteBlueprint = {
    ...blueprint,
    targetUsers: [''],
    buildPlan: ['short', ...blueprint.buildPlan.slice(1)],
    testingPlan: ['', blueprint.testingPlan[1]],
  }
  const incompleteFields = app.getIncompleteBlueprintFields(incompleteBlueprint)
  const fieldDiagnostics = app.getBlueprintFieldDiagnostics(incompleteBlueprint, incompleteFields)
  assert.ok(fieldDiagnostics.some((item) => item.field === 'targetUsers' && item.usefulItemCount === 0))
  assert.ok(fieldDiagnostics.some((item) => item.field === 'buildPlan[0]' && item.minimumLength === 35 && item.length === 5))
  assert.ok(fieldDiagnostics.some((item) => item.field === 'testingPlan[0]' && item.minimumLength === 45 && item.length === 0))
  assert.doesNotMatch(JSON.stringify(fieldDiagnostics), /Library|"short"/)
  let repairCalls = 0
  const mockGroq = {
    chat: {
      completions: {
        async create(request) {
          repairCalls += 1
          const repairRequest = JSON.parse(request.messages[1].content)
          assert.deepEqual(repairRequest.previousBlueprint, incompleteBlueprint)
          assert.match(repairRequest.instructions, /targetUsers must contain 2-4/)
          assert.match(repairRequest.instructions, /buildPlan must contain exactly 3/)
          assert.match(repairRequest.instructions, /testingPlan must contain exactly 2/)
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  ...blueprint,
                  targetUsers: ['Library staff coordinating mobility-aid repairs', 'Technicians servicing mobility aids at public libraries'],
                }),
              },
            }],
          }
        },
      },
    },
  }
  const repaired = await app.requestBlueprintRepair(
    mockGroq,
    'test-model',
    'Return a blueprint.',
    { idea: 'Library repair scheduling', instructions: '' },
    incompleteBlueprint,
    incompleteFields,
  )
  assert.equal(repairCalls, 1)
  assert.deepEqual(repaired.incompleteFields, [])
  assert.equal(app.hasCompleteBlueprint(repaired.generated), true)

  let retryCalls = 0
  const retryGroq = {
    chat: {
      completions: {
        async create(request) {
          retryCalls += 1
          if (retryCalls === 1) {
            const partialRepair = {
              ...blueprint,
              testingPlan: ['', blueprint.testingPlan[1]],
            }
            delete partialRepair.problem
            return {
              choices: [{
                message: {
                  content: JSON.stringify(partialRepair),
                },
              }],
            }
          }

          const retryRequest = JSON.parse(request.messages[1].content)
          assert.deepEqual(retryRequest.previousBlueprint.testingPlan, ['', blueprint.testingPlan[1]])
          assert.equal(retryRequest.previousBlueprint.problem, blueprint.problem)
          assert.match(retryRequest.instructions, /testingPlan\[0\]/)
          return {
            choices: [{
              message: {
                content: JSON.stringify(blueprint),
              },
            }],
          }
        },
      },
    },
  }
  const retried = await app.requestBlueprintRepair(
    retryGroq,
    'test-model',
    'Return a blueprint.',
    { idea: 'Library repair scheduling', instructions: '' },
    incompleteBlueprint,
    incompleteFields,
  )
  assert.equal(retryCalls, 2)
  assert.deepEqual(retried.incompleteFields, [])
  assert.equal(app.hasCompleteBlueprint(retried.generated), true)
})

test('generation instructions emphasize actionable, idea-specific blueprints and conservative refinements', () => {
  const generationPrompt = app.createBlueprintSystemPrompt(false)
  const refinementPrompt = app.createBlueprintSystemPrompt(true)

  assert.match(generationPrompt, /concrete implementation tasks, and expected tangible deliverable/)
  assert.match(generationPrompt, /do not add AI, blockchain, a database, payments, cloud, or external services unless the problem actually needs them/i)
  assert.match(generationPrompt, /testingPlan contains exactly 2 practical, project-specific verification steps/)
  assert.match(generationPrompt, /Return valid JSON only with exactly these fields: name, tagline, description/)
  assert.match(refinementPrompt, /preserve the project identity, purpose, users, constraints, and all unrelated validated decisions/)
  assert.match(refinementPrompt, /Do not regenerate a different project or discard existing features unless explicitly requested/)
})

test('blueprint JSON parser accepts plain and fenced JSON but rejects malformed responses', () => {
  const expected = { targetUsers: ['Library staff coordinating repairs'] }
  assert.deepEqual(app.parseBlueprintResponse(JSON.stringify(expected)), expected)
  assert.deepEqual(app.parseBlueprintResponse(`\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``), expected)
  assert.throws(() => app.parseBlueprintResponse('{"targetUsers": ]'), /malformed JSON/)
  assert.throws(() => app.parseBlueprintResponse('   '), /empty response/)
})

test('blueprint repair rejects malformed mocked model output', async () => {
  const mockGroq = {
    chat: {
      completions: {
        async create() {
          return { choices: [{ message: { content: '{"name": ]' } }] }
        },
      },
    },
  }

  await assert.rejects(
    app.requestBlueprintRepair(
      mockGroq,
      'test-model',
      app.createBlueprintSystemPrompt(false),
      { idea: 'A specific project idea', instructions: '' },
      { name: 'Incomplete project' },
      ['description'],
    ),
    /malformed JSON/,
  )
})

test('Groq JSON errors log shape diagnostics without generated response content', () => {
  const diagnostic = app.getGroqErrorDiagnostic({
    message: `400 ${JSON.stringify({
      error: {
        code: 'json_validate_failed',
        message: 'Failed to generate JSON.',
        failed_generation: '{"name":"private user project",}',
      },
    })}`,
  })
  assert.equal(diagnostic.code, 'json_validate_failed')
  assert.ok(diagnostic.failedGenerationLength > 0)
  assert.ok(diagnostic.generatedJsonError)
  assert.doesNotMatch(JSON.stringify(diagnostic), /private user project/)
})

test('Groq failures are reported by cause without exposing credentials', () => {
  const dailyQuota = {
    status: 429,
    code: 'rate_limit_exceeded',
    message: `429 ${JSON.stringify({
      error: {
        code: 'rate_limit_exceeded',
        message: 'Limit reached on tokens per day (TPD).',
      },
    })}`,
  }
  assert.match(app.getGroqUserError(dailyQuota), /daily token quota/)
  assert.match(app.getGroqUserError(dailyQuota), /API key and model configuration do not need to be changed/)

  assert.match(app.getGroqUserError({ status: 401 }), /GROQ_API_KEY in backend\/\.env/)
  assert.match(app.getGroqUserError({ status: 404 }), /GROQ_MODEL in backend\/\.env/)
  assert.match(app.getGroqUserError({ status: 429, code: 'rate_limit_exceeded', message: 'Requests per minute exceeded.' }), /rate-limited/)
  assert.match(app.getGroqUserError({ status: 503 }), /temporarily unavailable/)
  assert.match(app.getGroqUserError({ code: 'ECONNRESET', message: 'connection reset' }), /could not connect/)
})

test('CORS rejects unconfigured origins', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://example.invalid' } })
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'Requests from this origin are not allowed.' })
})
