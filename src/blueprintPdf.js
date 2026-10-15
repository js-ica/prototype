import { jsPDF } from 'jspdf'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM_LIMIT = PAGE_HEIGHT - 20

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function formatFieldName(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())
}

function formatAdditionalValue(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatAdditionalValue).filter(Boolean).join('; ')
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => {
        const formatted = formatAdditionalValue(item)
        return formatted ? `${formatFieldName(key)}: ${formatted}` : ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function hasExportableBlueprint(prototype) {
  return isRecord(prototype) &&
    asText(prototype.name).length > 0 &&
    isRecord(prototype.blueprint) &&
    Object.keys(prototype.blueprint).length > 0
}

function collectBlueprintSections(prototype) {
  const blueprint = prototype.blueprint
  const feasibility = isRecord(blueprint.buildFeasibility) ? blueprint.buildFeasibility : {}
  const cost = isRecord(feasibility.estimatedCost) ? feasibility.estimatedCost : {}
  const sections = []
  const addFields = (heading, fields) => {
    const entries = fields.filter(([, value]) => asText(value)).map(([label, value]) => ({ label, text: asText(value) }))
    if (entries.length) sections.push({ heading, entries })
  }
  const addList = (heading, label, value, numbered = false) => {
    const items = asList(value)
    if (items.length) {
      sections.push({
        heading,
        entries: items.map((text, index) => ({
          label: numbered ? `${label} ${index + 1}` : label,
          text,
          bullet: true,
        })),
      })
    }
  }

  addFields('Project overview', [
    ['Tagline', blueprint.tagline],
    ['Summary', prototype.description],
    ['Original idea', prototype.ideaSummary],
    ['Category', blueprint.category],
    ['Difficulty', blueprint.difficulty],
    ['Estimated timeline', blueprint.timeline],
    ['Budget', [asText(blueprint.currency), asText(blueprint.budget)].filter(Boolean).join(' ')],
  ])
  addFields('Problem and proposed solution', [
    ['Problem', blueprint.problem],
    ['Why it matters', blueprint.whyItMatters],
    ['User benefit', blueprint.userBenefit],
    ['Proposed solution', blueprint.mechanism],
    ['Differentiation', blueprint.differentiation],
    ['Why the difference matters', blueprint.whyDifferenceMatters],
  ])
  addList('Target users', 'User group', blueprint.targetUsers)
  addList('Useful settings', 'Setting', blueprint.whereUseful)

  const featureGroupNames = [
    ['Core MVP features', blueprint.featuresMvp],
    ['Later additions', blueprint.featuresSecondary],
    ['Future options', blueprint.featuresAdvanced],
  ]
  const featureEntries = []
  for (const [groupName, features] of featureGroupNames) {
    if (!Array.isArray(features)) continue
    for (const feature of features) {
      if (!isRecord(feature)) continue
      const details = [
        asText(feature.summary),
        asText(feature.howItWorks) && `How it works: ${asText(feature.howItWorks)}`,
        asText(feature.whyItMatters) && `Why it matters: ${asText(feature.whyItMatters)}`,
        ...Object.entries(feature)
          .filter(([key]) => !['name', 'summary', 'howItWorks', 'whyItMatters'].includes(key))
          .map(([key, value]) => {
            const formatted = formatAdditionalValue(value)
            return formatted ? `${formatFieldName(key)}: ${formatted}` : ''
          }),
      ].filter(Boolean)
      if (asText(feature.name) || details.length) {
        featureEntries.push({
          label: [groupName, asText(feature.name)].filter(Boolean).join(' - '),
          text: details.join('\n'),
          bullet: true,
        })
      }
    }
  }
  const standaloneFeatures = asList(prototype.features)
  for (const feature of standaloneFeatures) {
    featureEntries.push({ label: 'Project capability', text: feature, bullet: true })
  }
  if (featureEntries.length) sections.push({ heading: 'Features', entries: featureEntries })

  if (Array.isArray(blueprint.technologyStack)) {
    const entries = blueprint.technologyStack.filter(isRecord).map((technology) => ({
      label: [asText(technology.name), asText(technology.type) && `(${asText(technology.type)})`].filter(Boolean).join(' '),
      text: [
        asText(technology.purpose) && `Purpose: ${asText(technology.purpose)}`,
        asText(technology.whyNeeded) && `Why suitable: ${asText(technology.whyNeeded)}`,
        asText(technology.connectsTo) && `Connects to: ${asText(technology.connectsTo)}`,
        asText(technology.notes) && `Notes: ${asText(technology.notes)}`,
      ].filter(Boolean).join('\n'),
      bullet: true,
    })).filter((entry) => entry.label || entry.text)
    if (entries.length) sections.push({ heading: 'Technology stack and components', entries })
  }

  addFields('System architecture', [['Architecture', blueprint.architecture]])
  addList('Sequential build plan', 'Step', blueprint.buildPlan, true)
  addList('Testing and verification plan', 'Test', blueprint.testingPlan, true)
  addFields('Feasibility and constraints', [
    ['Complexity', feasibility.complexityLevel],
    ['Complexity rationale', feasibility.complexityReason],
    ['Simplified starting version', feasibility.simplifiedStartingVersion],
    ['First practical step', feasibility.firstPracticalStep],
  ])
  addList('Implementation challenges', 'Challenge', feasibility.implementationChallenges)
  addList('Risks and limitations', 'Risk', feasibility.risksAndLimitations)
  addList('Potential weaknesses', 'Weakness', blueprint.potentialWeaknesses)
  addFields('Validation plan', [['Validation plan', blueprint.validationPlan]])
  addList('Additional risks', 'Risk', blueprint.risks)
  addList('Future improvements', 'Improvement', blueprint.futureImprovements)

  if (Array.isArray(feasibility.requiredResources)) {
    const entries = feasibility.requiredResources.filter(isRecord).map((group) => ({
      label: asText(group.category),
      text: asList(group.items).join('\n'),
      bullet: true,
    })).filter((entry) => entry.label || entry.text)
    if (entries.length) sections.push({ heading: 'Required resources', entries })
  }
  addFields('Estimated cost', [
    ['Range', cost.range],
    ['Assumptions', cost.assumptions],
    ['Basis', cost.reason],
  ])
  addList('Assumptions', 'Assumption', blueprint.assumptions)
  addFields('Originality assessment', [
    ['Preliminary assessment', blueprint.originalityAssessment?.summary],
    ['Differentiation', blueprint.originalityAssessment?.difference],
    ['Validation', blueprint.originalityAssessment?.validation],
    ['Unverified', blueprint.originalityAssessment?.unverified],
  ])
  addList('Comparable approaches to investigate', 'Approach', [
    ...asList(blueprint.similarSolutions),
    ...asList(blueprint.originalityAssessment?.similar),
  ].filter((item, index, list) => list.indexOf(item) === index))
  addList('Suggested research search terms', 'Search term', blueprint.researchSearchTerms)

  const handledBlueprintFields = new Set([
    'tagline', 'problem', 'targetUsers', 'userBenefit', 'mechanism', 'category', 'difficulty', 'timeline',
    'assumptions', 'originalityAssessment', 'similarSolutions', 'researchSearchTerms', 'differentiation',
    'whyDifferenceMatters', 'buildFeasibility', 'featuresMvp', 'featuresSecondary', 'featuresAdvanced',
    'technologyStack', 'architecture', 'buildPlan', 'testingPlan', 'whyItMatters', 'budget', 'currency',
    'whereUseful', 'potentialWeaknesses', 'validationPlan', 'risks', 'futureImprovements',
  ])
  const additionalEntries = Object.entries(blueprint)
    .filter(([key]) => !handledBlueprintFields.has(key))
    .map(([key, value]) => ({ label: formatFieldName(key), text: formatAdditionalValue(value) }))
    .filter((entry) => entry.text)
  if (additionalEntries.length) sections.push({ heading: 'Additional blueprint details', entries: additionalEntries })

  return sections
}

export function createBlueprintPdfDocument(prototype) {
  if (!hasExportableBlueprint(prototype)) {
    throw new Error('A valid project blueprint is not available to export.')
  }

  const sections = collectBlueprintSections(prototype)
  if (!sections.length) {
    throw new Error('This blueprint does not contain any exportable details.')
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const title = asText(prototype.name)
  doc.setProperties({ title: `${title} - Project Blueprint`, subject: 'Project blueprint', creator: 'PROTOTYPE' })
  let y = MARGIN + 12

  const addPage = () => {
    doc.addPage()
    y = MARGIN + 12
  }
  const ensureSpace = (height) => {
    if (y + height > BOTTOM_LIMIT) addPage()
  }
  const writeLines = (text, { fontSize = 10, color = [43, 53, 71], indent = 0, lineHeight = 5 } = {}) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(fontSize)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent)
    for (const line of lines) {
      ensureSpace(lineHeight)
      doc.text(line, MARGIN + indent, y)
      y += lineHeight
    }
    return lines.length
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH)
  doc.setTextColor(28, 43, 68)
  for (const line of titleLines) {
    ensureSpace(11)
    doc.text(line, MARGIN, y)
    y += 10
  }
  y += 2
  doc.setDrawColor(108, 91, 255)
  doc.setLineWidth(1)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 10

  for (const section of sections) {
    const firstEntry = section.entries[0]
    const firstText = [firstEntry.label, firstEntry.text].filter(Boolean).join(': ')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const estimatedFirstLine = doc.splitTextToSize(firstText, CONTENT_WIDTH - (firstEntry.bullet ? 4 : 0)).length
    ensureSpace(10 + Math.min(estimatedFirstLine, 2) * 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(36, 50, 75)
    doc.text(section.heading, MARGIN, y)
    y += 7

    for (const entry of section.entries) {
      const indent = entry.bullet ? 4 : 0
      if (entry.bullet) {
        ensureSpace(5)
        doc.setFillColor(108, 91, 255)
        doc.circle(MARGIN + 1, y - 1, 0.7, 'F')
      }
      if (entry.label) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(38, 48, 66)
        const labelLines = doc.splitTextToSize(entry.label, CONTENT_WIDTH - indent)
        for (const line of labelLines) {
          ensureSpace(5)
          doc.text(line, MARGIN + indent, y)
          y += 5
        }
      }
      if (entry.text) {
        const textLines = entry.text.split('\n').filter(Boolean)
        for (const textLine of textLines) {
          writeLines(textLine, { indent: indent + (entry.label ? 2 : 0), lineHeight: 5 })
        }
      }
      y += 2
    }
    y += 3
  }

  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 130, 145)
    doc.text('PROTOTYPE | Project blueprint', MARGIN, PAGE_HEIGHT - 9)
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, { align: 'right' })
  }

  return doc
}

export function downloadBlueprintPdf(prototype) {
  const doc = createBlueprintPdfDocument(prototype)
  const safeName = asText(prototype.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project-blueprint'
  doc.save(`${safeName}-blueprint.pdf`)
}
