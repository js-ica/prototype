import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createBlueprintPdfDocument,
  hasExportableBlueprint,
} from './blueprintPdf.js'

const project = {
  name: 'Library Repair Scheduler',
  description: 'A project summary for public libraries coordinating mobility-aid repairs.',
  ideaSummary: 'Help library staff coordinate repairs.',
  features: ['Appointment booking', 'Repair status updates', 'Technician coordination'],
  blueprint: {
    tagline: 'Coordinate repairs with less confusion.',
    category: 'software',
    difficulty: 'Intermediate',
    timeline: 'Four weeks for one developer',
    problem: 'Staff currently coordinate repairs across disconnected phone calls and notes.',
    targetUsers: ['Public library staff coordinating mobility-aid repairs', 'Technicians servicing library equipment'],
    userBenefit: 'Staff and technicians share a clearer view of pending repairs.',
    mechanism: 'A shared request queue tracks appointment and repair status.',
    differentiation: 'Designed around library service workflows rather than general work orders.',
    whyDifferenceMatters: 'The workflow supports staff who do not manage a dedicated repair desk.',
    featuresMvp: [{
      name: 'Repair queue',
      summary: 'Track repair requests.',
      howItWorks: 'Staff record an item, issue, and next appointment.',
      whyItMatters: 'The next action stays visible to the responsible team.',
    }],
    featuresSecondary: [],
    featuresAdvanced: [],
    technologyStack: [{
      name: 'React',
      type: 'Frontend',
      purpose: 'Render the request queue and appointment details.',
      whyNeeded: 'A browser interface can be used on existing library computers.',
    }],
    architecture: 'A browser interface submits repair requests to an API and displays the current status.',
    buildPlan: ['Interview library staff and map the repair request workflow.'],
    testingPlan: ['Ask staff to enter a repair request and confirm its status is visible to the assigned technician.'],
    assumptions: ['A pilot begins at one library location.'],
    originalityAssessment: { summary: 'Preliminary assessment only.', similar: ['Work-order tracking'], unverified: 'No market research has been performed.' },
    similarSolutions: ['General work-order tracking'],
    researchSearchTerms: ['library mobility aid repair workflow'],
    buildFeasibility: {
      complexityLevel: 'Intermediate',
      complexityReason: 'A small shared workflow requires basic request handling.',
      requiredResources: [{ category: 'People', items: ['One library staff pilot group'] }],
      implementationChallenges: ['Agreeing on a shared status vocabulary'],
      risksAndLimitations: ['Technicians may not check the queue regularly'],
      simplifiedStartingVersion: 'A single-library request queue.',
      estimatedCost: { range: 'Not estimated', assumptions: 'Hosting and staffing costs are unknown.', reason: 'Confirm local costs before deployment.' },
      firstPracticalStep: 'Confirm the current request process with staff and one technician.',
    },
  },
}

test('builds a PDF containing a normal blueprint with page numbers and metadata', () => {
  const doc = createBlueprintPdfDocument(project)
  const pdf = doc.output()
  const renderedText = doc.internal.pages.flat().join('\n')

  assert.match(pdf, /^%PDF-/)
  assert.ok(doc.internal.getNumberOfPages() >= 1)
  assert.match(pdf, /Library Repair Scheduler - Project Blueprint/)
  assert.match(pdf, /\/Count \d+/)
  assert.match(renderedText, /Staff currently coordinate repairs/)
  assert.match(renderedText, /Public library staff/)
  assert.match(renderedText, /Repair queue/)
  assert.match(renderedText, /Purpose: Render the request/)
  assert.match(renderedText, /Step 1/)
  assert.match(renderedText, /Testing and verification plan/)
  assert.match(renderedText, /Page 1 of/)
})

test('long blueprint sections paginate rather than overflowing a single page', () => {
  const longProject = {
    ...project,
    blueprint: {
      ...project.blueprint,
      problem: 'Specific project context. '.repeat(400),
      architecture: 'Architecture detail. '.repeat(400),
      buildPlan: Array.from({ length: 12 }, (_, index) => `Step ${index + 1}: ${'Implement and verify this project workflow. '.repeat(30)}`),
      testingPlan: ['Test case and expected pass condition. '.repeat(80)],
    },
  }
  const doc = createBlueprintPdfDocument(longProject)

  assert.ok(doc.internal.getNumberOfPages() > createBlueprintPdfDocument(project).internal.getNumberOfPages())
  assert.match(doc.output(), /\/Count \d+/)
})

test('missing optional blueprint fields still produce a valid PDF', () => {
  const sparseProject = { name: 'Sparse Prototype', blueprint: { problem: 'A clear problem statement.' } }
  const doc = createBlueprintPdfDocument(sparseProject)

  assert.equal(doc.internal.getNumberOfPages(), 1)
  assert.match(doc.output(), /Sparse Prototype - Project Blueprint/)
  assert.equal(hasExportableBlueprint(sparseProject), true)
})

test('export uses the supplied current refined project and rejects empty blueprint data', () => {
  const refinedProject = { ...project, name: 'Refined Library Repair Scheduler' }
  const doc = createBlueprintPdfDocument(refinedProject)

  assert.match(doc.output(), /Refined Library Repair Scheduler - Project Blueprint/)
  assert.equal(hasExportableBlueprint({ name: 'Missing blueprint', blueprint: {} }), false)
  assert.throws(() => createBlueprintPdfDocument({ name: 'Missing blueprint', blueprint: {} }), /not available to export/)
  assert.throws(() => createBlueprintPdfDocument({ name: 'Empty project' }), /not available to export/)
})
