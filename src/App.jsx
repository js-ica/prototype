import { useEffect, useRef, useState } from 'react'
import './App.css'
import { appendVoiceTranscript, getSpeechRecognitionConstructor, getVoiceErrorMessage } from './voiceInput'

const examplePrompts = [
  'A low-cost soil health sensor for small farms',
  'A repair-tracker for shared work tools in a student workshop',
  'A voice-guided study companion for students with attention challenges',
  'A solar-powered backup monitor for small shops during blackouts',
  'A packaging reuse helper for local markets and small retailers',
]

const defaultBlueprint = {
  tagline: 'A practical idea shaped around a real user problem and a clear build path.',
  problem: 'The user has an idea but needs a sharper, more realistic concept with identifiable users and a credible validation route.',
  whyItMatters: 'Good ideas solve real friction. This version helps narrow the problem before building anything expensive.',
  targetUsers: ['Independent builders', 'Students', 'Small teams', 'Early-stage founders'],
  whereUseful: ['Hackathons', 'School projects', 'Startup validation', 'Campus labs'],
  userBenefit: 'The project becomes easier to explain, cheaper to validate, and more likely to matter to real users.',
  category: 'hybrid',
  difficulty: 'Medium',
  timeline: '4-8 weeks',
  budget: 'USD 300-1,200',
  currency: 'USD',
  assumptions: ['The concept will be refined with user interviews and a low-fidelity prototype.'],
  originalityAssessment: {
    summary: 'Preliminary AI-generated originality assessment: the concept needs a sharper user story and more evidence before it can be treated as a verified novel idea.',
    similar: ['Generic productivity apps', 'Template AI tools'],
    difference: 'The plan will be more concrete once the user, context, and failure mode are defined.',
    unverified: 'Originality should be validated with a quick market scan and targeted user interviews.',
    validation: 'Test the concept with a lightweight prototype and gather real feedback from a few likely users.',
  },
  similarSolutions: ['Generic and broad solution generators', 'Standard project planning tools'],
  differentiation: 'This is intentionally a starting point that gets more specific with user constraints and technical reality.',
  potentialWeaknesses: ['The problem is still broad', 'The concept may need more user validation'],
  validationPlan: 'Run a one-page concept or landing-page test and ask 3-5 likely users whether they would pay attention to the problem.',
  features: ['Clear problem framing', 'Targeted user validation', 'Low-cost prototype path'],
  featuresMvp: [
    {
      name: 'Problem framing',
      summary: 'Define the user, setting, and failure mode before building.',
      problem: 'Many ideas remain too generic to evaluate.',
      audience: 'Students, startup builders, and product teams',
      howItWorks: 'Users describe the pain point, target group, and environment, then the concept sharpens around those constraints.',
      requirements: ['Idea input', 'User context'],
      inputs: ['User description', 'Problem statement'],
      userExperience: 'The user sees a more concrete and actionable concept quickly.',
      output: 'A clearer project direction',
      dependencies: [],
      difficulty: 'Easy',
      cost: 'Low',
      limitations: ['It still needs user testing.'],
      validation: 'Check whether the concept feels recognizably useful to the target audience.',
    },
  ],
  featuresSecondary: [],
  featuresAdvanced: [],
  technologyStack: [
    { name: 'Frontend app', type: 'Software', purpose: 'Display concept cards and blueprint summaries.', whyNeeded: 'Users need a clear, readable workspace.', connectsTo: 'Browser', notes: 'React + Vite' },
    { name: 'AI text generation', type: 'Service', purpose: 'Generate the project blueprint.', whyNeeded: 'The app needs to translate rough ideas into more concrete concepts.', connectsTo: 'Backend API', notes: 'Groq' },
  ],
  architecture: 'The interface captures the rough idea, the backend sends it to the text model with a structured prompt, and the app presents a clear blueprint and idea history.',
  buildPlan: ['Define the issue and target user.', 'Generate a concept and validate the problem.', 'Refine the concept around cost and feasibility.'],
  testingPlan: ['Check if a real user recognizes the problem.', 'Test a simple prototype with a few people.', 'Measure if the concept solves a real pain point.'],
  risks: ['The idea may still be too broad.', 'The user may not see the intended value.'],
  futureImprovements: ['Add more structured idea comparisons', 'Support export and save workflows', 'Refine budget and timeline guidance'],
  imagePrompt: 'A clear concept render of the core prototype design and its main feature.',
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|;|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function generatePrototype(idea) {
  const prompt = (idea || 'A low-cost soil health sensor for small farms').trim() || 'A low-cost soil health sensor for small farms'
  const lowerPrompt = prompt.toLowerCase()

  let concept = {
    name: 'FieldSense Mini',
    tagline: 'Affordable crop insight for small farms',
    description: 'A low-cost sensor and decision-support system that helps small farmers detect crop stress early and act before a loss becomes expensive.',
    problem: 'Small farms often only detect crop stress late because they lack affordable monitoring tools, clear thresholds, and simple advice.',
    whyItMatters: 'Water stress, nutrient imbalance, and disease pressure can quickly lower yield. Small farmers need earlier signals without expensive precision-agriculture systems.',
    targetUsers: ['Smallholder farmers', 'Agri-extension workers', 'Cooperative field managers'],
    whereUseful: ['Vegetable plots', 'Greenhouses', 'Irrigation projects', 'Community farms'],
    userBenefit: 'Farmers get clear guidance on irrigation and crop health without needing expensive technical devices or a full agronomy team.',
    category: 'hybrid',
    difficulty: 'Medium',
    timeline: '5-8 weeks',
    budget: '₦ 180,000-350,000',
    currency: 'NGN',
    assumptions: ['Farmers can check a simple mobile dashboard or receive SMS alerts.', 'A pilot can be tested on one or two plots.'],
    originalityAssessment: {
      summary: 'Preliminary AI-generated originality assessment: the concept is practical and specific to low-resource farming, but it should be checked against existing soil-monitoring and advice tools in the target region.',
      similar: ['Soil moisture kits', 'Farm monitoring dashboards', 'Smart irrigation apps'],
      difference: 'The concept prioritizes affordability, actionability, and daily decisions rather than expensive precision farming features.',
      unverified: 'Exact differentiation should be tested with a quick market scan and small number of local farmer conversations.',
      validation: 'Interview 3-5 farmers and compare the recommendations to their everyday decisions during a short pilot.',
    },
    similarSolutions: ['Commercial soil monitoring devices', 'Irrigation apps', 'Farm analytics dashboards'],
    differentiation: 'It focuses on decision support for small farmers with limited budgets and unreliable infrastructure, rather than premium field automation.',
    potentialWeaknesses: ['Calibration may vary by soil type', 'Connectivity may be weak in remote locations'],
    validationPlan: 'Pilot a small sensor and dashboard on one field for a month and compare farmer decisions against observed crop health.',
    features: ['Soil and moisture sensing', 'Crop-stress alerts', 'Simple irrigation guidance', 'Low-cost dashboard', 'Field-ready alerts'],
    featuresMvp: [
      {
        name: 'Soil moisture and temperature sensing',
        summary: 'Measure field conditions to detect water stress earlier.',
        problem: 'Farmers often water or fertilize late, after crops are already stressed.',
        audience: 'Smallholder farmers',
        howItWorks: 'A low-cost sensor node measures soil moisture and temperature and sends an update to a dashboard or alert channel.',
        requirements: ['Soil probe', 'Microcontroller', 'Power source'],
        inputs: ['Soil moisture', 'Temperature', 'Time'],
        userExperience: 'The user sees a simple trend instead of raw numbers.',
        output: 'Moisture readings and field alerts',
        dependencies: ['Alert workflow'],
        difficulty: 'Medium',
        cost: '₦ 30,000-80,000',
        limitations: ['Calibration varies across soil types.'],
        validation: 'Compare sensor readings to manual checks during a week of field activity.',
      },
      {
        name: 'Decision-support alert workflow',
        summary: 'Turn readings into a clear recommendation before the crop is visibly damaged.',
        problem: 'Even good data is not useful if it arrives too late or without an action.',
        audience: 'Farmers and cooperative field staff',
        howItWorks: 'Threshold rules convert sensor data into a simple recommendation such as irrigation timing or a deeper check.',
        requirements: ['Rules engine', 'Alert notification'],
        inputs: ['Thresholds', 'Sensor readings', 'Weather'],
        userExperience: 'The user receives simple instructions, not a confusing dashboard full of numbers.',
        output: 'Actionable alert and next step',
        dependencies: ['Soil moisture sensing'],
        difficulty: 'Medium',
        cost: '₦ 15,000-45,000',
        limitations: ['Advice can be general without local agronomy context.'],
        validation: 'Check whether farmers would act on the advice in a real field situation.',
      },
    ],
    featuresSecondary: [
      {
        name: 'Local-language summaries',
        summary: 'Translate technical readings into plain-language advice.',
        problem: 'Farmers need clarity, not jargon.',
        audience: 'Community farm groups',
        howItWorks: 'The app translates numbers into quick messages such as “soils are drying fast; check the nearest irrigation line.”',
        requirements: ['Simple rules', 'Message templates'],
        inputs: ['Condition state', 'Timing'],
        userExperience: 'The user reads short, actionable instructions.',
        output: 'Plain-language prompt',
        dependencies: ['Decision support workflow'],
        difficulty: 'Medium',
        cost: '₦ 10,000-25,000',
        limitations: ['Translations need local knowledge for correctness.'],
        validation: 'Ask farmers whether the messages are clear enough to act upon.',
      },
    ],
    featuresAdvanced: [
      {
        name: 'Yield trend tracking',
        summary: 'Compare field performance over time to improve planning.',
        problem: 'Farmers need to learn what worked best in prior seasons.',
        audience: 'Cooperative managers',
        howItWorks: 'The system stores field data and compares crop conditions against yield expectations.',
        requirements: ['Database', 'Trend analysis'],
        inputs: ['Historical field data', 'Seasonal notes'],
        userExperience: 'The user sees patterns and plans improvements for the next cycle.',
        output: 'Seasonal trend summary',
        dependencies: ['Data collection'],
        difficulty: 'Hard',
        cost: '₦ 25,000-60,000',
        limitations: ['Seasonal variability can make predictions noisy.'],
        validation: 'Compare trend reports with actual performance after one season.',
      },
    ],
    technologyStack: [
      { name: 'ESP32', type: 'Microcontroller', purpose: 'Collect and transmit field data.', whyNeeded: 'It is low-cost and flexible for a prototype.', connectsTo: 'Sensors and Wi-Fi', notes: 'Works well for compact deployments.' },
      { name: 'Soil moisture sensor', type: 'Sensor', purpose: 'Measure key ground conditions.', whyNeeded: 'This drives irrigation and crop-stress decisions.', connectsTo: 'ESP32', notes: 'Use a sensor that matches common local soil conditions.' },
      { name: 'Node.js backend', type: 'Software', purpose: 'Store readings and alert logic.', whyNeeded: 'The system needs a simple API and data store.', connectsTo: 'Dashboard', notes: 'Good for quick prototypes.' },
      { name: 'React frontend', type: 'Software', purpose: 'Present readable guidance and dashboards.', whyNeeded: 'Farmers need an easy interface on mobile devices.', connectsTo: 'API', notes: 'Responsive design matters.' },
    ],
    architecture: 'The field sensor collects data, sends it to a small backend, and the dashboard turns the readings into plain-language guidance for the farmer.',
    buildPlan: ['Define the issue and target user.', 'Generate a concept and validate the problem.', 'Refine the concept around cost and feasibility.'],
    testingPlan: ['Check sensor accuracy against manual checks.', 'Verify whether the alert is easy to act on.', 'Interview farmers after a week of use.'],
    risks: ['Sensor drift', 'Connectivity gaps', 'Inaccurate assumptions about local soil conditions'],
    futureImprovements: ['Weather-based recommendations', 'Multiple sensor nodes', 'Local-language alerts'],
    imagePrompt: 'A compact soil sensor and mobile moisture dashboard for a small farm.',
  }

  if (lowerPrompt.includes('solar') || lowerPrompt.includes('power') || lowerPrompt.includes('backup')) {
    concept = {
      ...concept,
      name: 'SolarSync Hub',
      tagline: 'Simple power visibility for small businesses',
      description: 'A compact solar and backup-monitoring system that helps small shops track outages, battery health, and critical loads before a power event disrupts operations.',
      problem: 'Small businesses often lose time and money when the power fails, but they do not have a low-cost way to know which loads matter most or when their backup system is weak.',
      whyItMatters: 'Unexpected outages can affect income, equipment, and customer trust. A low-cost monitor helps owners prepare and prioritize what matters most.',
      targetUsers: ['Retail shops', 'Workshops', 'Small clinics', 'Micro-enterprises'],
      whereUseful: ['Urban shops', 'Warehouses', 'Clinics', 'Campus businesses'],
      userBenefit: 'Owners can identify essential loads and react more confidently during outages without paying for expensive industrial monitoring systems.',
      category: 'hybrid',
      difficulty: 'Medium',
      timeline: '4-7 weeks',
      budget: '₦ 200,000-500,000',
      currency: 'NGN',
      assumptions: ['The business has a few critical loads that can be monitored in a pilot.'],
      originalityAssessment: {
        summary: 'Preliminary AI-generated originality assessment: this is grounded in a real small-business pain point rather than generic “smart home” automation. It still needs validation against existing power-monitoring and backup systems.',
        similar: ['UPS monitoring apps', 'Smart energy monitors', 'Backup battery dashboards'],
        difference: 'The focus is on small-business continuity and critical-load visibility rather than premium industrial analytics or home automation.',
        unverified: 'The exact value proposition should be checked against how local businesses actually experience outages and backup systems.',
        validation: 'Interview a few shop owners and compare the business impact of their last four power disruptions to the proposed monitoring workflow.',
      },
      similarSolutions: ['UPS dashboards', 'Power quality devices', 'Smart energy monitoring tools'],
      differentiation: 'It emphasizes practical outage visibility and backup prioritization for small businesses, not expensive enterprise monitoring.',
      potentialWeaknesses: ['Installation quality affects reliability', 'Critical loads may vary from one business to another'],
      validationPlan: 'Test on one local shop with a few monitored loads and compare downtime recovery before and after using the system.',
      features: ['Outage history dashboard', 'Battery health monitoring', 'Critical-load prioritization', 'Low-cost alerting', 'Power-quality overview'],
      featuresMvp: [
        {
          name: 'Power event monitor',
          summary: 'Capture low-voltage events, outages, and restoration windows.',
          problem: 'Businesses often only realize they had an outage after losing work or equipment.',
          audience: 'Retail and workshop owners',
          howItWorks: 'Monitors track voltage, outage timing, and critical events so owners can see patterns.',
          requirements: ['Voltage/current sensors', 'Microcontroller', 'Dashboard'],
          inputs: ['Voltage readings', 'Current draw', 'Time'],
          userExperience: 'The user sees a timeline of outages and the impact on key systems.',
          output: 'Power event timeline',
          dependencies: ['Dashboard'],
          difficulty: 'Medium',
          cost: '₦ 45,000-90,000',
          limitations: ['Some power issues may need additional calibration.'],
          validation: 'Compare readings with a meter during a real power event.',
        },
      ],
      featuresSecondary: [
        {
          name: 'Critical-load prioritization',
          summary: 'Show which loads matter most during an outage.',
          problem: 'Not every device is equally important during a blackout.',
          audience: 'Operations teams',
          howItWorks: 'Rules classify loads by operational criticality and show which equipment needs backup or manual switching first.',
          requirements: ['Priority tags', 'Rules engine'],
          inputs: ['Load type', 'Operational importance'],
          userExperience: 'The user sees an action plan, not just raw power numbers.',
          output: 'Priority recommendation',
          dependencies: ['Power event monitor'],
          difficulty: 'Medium',
          cost: '₦ 15,000-30,000',
          limitations: ['Needs user-defined priorities.'],
          validation: 'Check whether the priority list matches real business needs.',
        },
      ],
      featuresAdvanced: [
        {
          name: 'Battery health prediction',
          summary: 'Estimate whether the backup solution is likely to fail soon.',
          problem: 'A battery may fail at the worst moment without warning.',
          audience: 'Business owners',
          howItWorks: 'Multiple readings and charge history are used to spot weak battery behavior.',
          requirements: ['Battery monitor', 'Analytics'],
          inputs: ['Voltage', 'Charge trend', 'Cycle info'],
          userExperience: 'The user receives a health trend and a maintenance reminder.',
          output: 'Health score and suggested action',
          dependencies: ['Power event monitor'],
          difficulty: 'Hard',
          cost: '₦ 25,000-70,000',
          limitations: ['Battery chemistry matters.'],
          validation: 'Cross-check with a maintenance record or battery QA procedure.',
        },
      ],
      technologyStack: [
        { name: 'Current sensor', type: 'Sensor', purpose: 'Measure load and outage behavior.', whyNeeded: 'Critical equipment decisions depend on load visibility.', connectsTo: 'Microcontroller', notes: 'Non-invasive clamp sensors reduce installation complexity.' },
        { name: 'ESP32', type: 'Microcontroller', purpose: 'Collect and transmit data.', whyNeeded: 'It is cheap and practical for a pilot.', connectsTo: 'Voltage and current sensors', notes: 'Wi-Fi or Bluetooth is usually sufficient for a small deployment.' },
        { name: 'React dashboard', type: 'Software', purpose: 'Display outage and backup data clearly.', whyNeeded: 'Business owners need a simple summary, not raw telemetry.', connectsTo: 'API', notes: 'Use a mobile-friendly layout.' },
      ],
      architecture: 'Monitoring sensors capture power conditions, the controller pushes the data to a small backend, and the user sees the outage history and critical-load priorities in a dashboard.',
      buildPlan: ['Choose the most critical field measurement and threshold.', 'Prototype the sensor and alert logic.', 'Add a simple dashboard or SMS summaries.', 'Validate the workflow in one local field.'],
      testingPlan: ['Check readings with a calibrated meter during a fault event.', 'Ask owners whether the dashboard supports faster business recovery.', 'Confirm the recommendations feel practical instead of generic.'],
      risks: ['Sensor placement can be inconsistent', 'Business priorities may differ from assumptions', 'The solution may be too basic for larger sites'],
      futureImprovements: ['Add multi-site monitoring', 'Predict maintenance windows', 'Support solar and hybrid optimization'],
      imagePrompt: 'A compact power monitor showing outage status and critical-load battery levels.',
    }
  }

  if (lowerPrompt.includes('study') || lowerPrompt.includes('student') || lowerPrompt.includes('learning')) {
    concept = {
      ...concept,
      name: 'FocusLoop',
      tagline: 'A calmer study companion for learners who lose momentum',
      description: 'A study planning tool that helps students break work into manageable sessions, recover from distraction, and focus on the next productive action instead of feeling overwhelmed.',
      problem: 'Students often know what they need to do but struggle to plan realistically, recover from lost focus, and maintain momentum over long study periods.',
      whyItMatters: 'A study tool should reduce pressure, not create another layer of guilt. Realistic pacing improves completion and confidence.',
      targetUsers: ['University students', 'Secondary school learners', 'Students with attention challenges'],
      whereUseful: ['Self-study', 'Exam revision', 'Course projects', 'Academic support programs'],
      userBenefit: 'Students move from vague pressure into a smaller, sustainable plan that is easier to maintain and less psychologically draining.',
      category: 'software',
      difficulty: 'Medium',
      timeline: '3-5 weeks',
      budget: '₦ 50,000-180,000',
      currency: 'NGN',
      assumptions: ['Students have access to a laptop or phone and can follow a few study blocks per week.'],
      originalityAssessment: {
        summary: 'Preliminary AI-generated originality assessment: this is not a standard task manager because it emphasizes attention recovery and realistic pacing. It still needs validation against common productivity and study-planning tools.',
        similar: ['Pomodoro apps', 'Study planners', 'Task trackers'],
        difference: 'The concept is designed around recovery and momentum rather than countdown-based productivity alone.',
        unverified: 'Whether this approach improves real study behavior needs to be checked in user testing and short pilot sessions.',
        validation: 'Compare session completion rates over one week with and without the planning flow.',
      },
      similarSolutions: ['Pomodoro tools', 'Task planners', 'Learning apps'],
      differentiation: 'It is tailored to attention recovery and realistic session length instead of generic productivity optimization.',
      potentialWeaknesses: ['May not suit all learning styles', 'Some users still prefer paper planning'],
      validationPlan: 'Pilot with a small student group and compare completion rates and self-reported study stress before and after using the system.',
      features: ['Attention-aware planning', 'Session recovery flow', 'Priority-based blocks', 'Progress reinforcement', 'Low-friction dashboard'],
      featuresMvp: [
        {
          name: 'Study session planner',
          summary: 'Break study tasks into small, realistic blocks that match the learner’s time and energy.',
          problem: 'Students often freeze when a task is too large or vague.',
          audience: 'Students and learners',
          howItWorks: 'The app turns a goal into smaller timed blocks with a clear next action.',
          requirements: ['Task input', 'Time estimates'],
          inputs: ['Topic', 'Deadline', 'Available time'],
          userExperience: 'The user sees a manageable sequence instead of a long checklist.',
          output: 'Daily or weekly study plan',
          dependencies: [],
          difficulty: 'Easy',
          cost: 'Low',
          limitations: ['Needs regular task updates to stay useful.'],
          validation: 'Check whether students complete more blocks than with a normal to-do list.',
        },
      ],
      featuresSecondary: [
        {
          name: 'Recovery routine',
          summary: 'Give students a short reset action after distractions or missed blocks.',
          problem: 'Lost focus often becomes a cycle of guilt and avoidance.',
          audience: 'Students with attention challenges',
          howItWorks: 'The app suggests a smaller task to restart momentum rather than asking for a full session restart.',
          requirements: ['Focus tracking', 'Session patterns'],
          inputs: ['Current task', 'Elapsed time', 'Previous track'],
          userExperience: 'The user receives encouragement and a smaller restart action.',
          output: 'Recovery plan and reset prompt',
          dependencies: ['Study session planner'],
          difficulty: 'Medium',
          cost: 'Low',
          limitations: ['Behavioral support is not a substitute for deeper assistance.'],
          validation: 'Ask students whether the reset flow feels encouraging rather than frustrating.',
        },
      ],
      featuresAdvanced: [
        {
          name: 'Study rhythm insights',
          summary: 'Track patterns such as the best study time, session lengths, and task types.',
          problem: 'Students need feedback on what helps them reach flow.',
          audience: 'Students and academic support teams',
          howItWorks: 'The app summarizes completed sessions and highlights which patterns correlate with productive work.',
          requirements: ['History tracking', 'Analytics'],
          inputs: ['Session history', 'Task completion data'],
          userExperience: 'The user sees a summary of energy and consistency patterns.',
          output: 'Study pattern insight',
          dependencies: ['Study planner'],
          difficulty: 'Medium',
          cost: 'Low',
          limitations: ['Insights can be noisy without enough data.'],
          validation: 'Review whether students find the summary useful, not just interesting.',
        },
      ],
      technologyStack: [
        { name: 'React app', type: 'Software', purpose: 'Present the study planner and progress dashboard.', whyNeeded: 'Students need an interface that feels light and encouraging.', connectsTo: 'API and database', notes: 'Responsive layout matters.' },
        { name: 'Node.js backend', type: 'Software', purpose: 'Store tasks and study history.', whyNeeded: 'Users need persistence and reminders.', connectsTo: 'Database', notes: 'A simple hosted service is sufficient.' },
        { name: 'SQLite', type: 'Database', purpose: 'Keep an easy local or lightweight cloud data store.', whyNeeded: 'A lean prototype needs low operational overhead.', connectsTo: 'Backend', notes: 'Works well for a low-cost prototype.' },
      ],
      architecture: 'The user adds a task and time constraints, the planner breaks it down into achievable blocks, and a lightweight backend keeps progress and reminders.',
      buildPlan: ['Define the smallest useful study workflow.', 'Prototype an attention-aware planner.', 'Add a recovery after a distraction.', 'Pilot the app with a few students and adjust the logic.'],
      testingPlan: ['Track whether the planner increases completed sessions over a week.', 'Ask students whether the system reduced overwhelm and guilt.', 'Check whether it feels simpler than a generic to-do list.'],
      risks: ['Students may still prefer paper tools', 'The app may not fit every learning context'],
      futureImprovements: ['Adaptive time blocks', 'Class-level planning', 'Teacher or tutor dashboard'],
      imagePrompt: 'A study-planning app interface showing realistic focus blocks and a recovery routine.',
    }
  }

  if (lowerPrompt.includes('market') || lowerPrompt.includes('waste') || lowerPrompt.includes('packaging') || lowerPrompt.includes('reuse')) {
    concept = {
      ...concept,
      name: 'LoopSort',
      tagline: 'Smarter reuse for small vendors and market operators',
      description: 'A practical packaging and material identification workflow that helps local vendors spot reusable materials before they are thrown away or mixed into general waste.',
      problem: 'Local markets and small shops often discard containers and packaging without checking if they can be reused, stored, or collected for a second use.',
      whyItMatters: 'Waste is not always disposal; some materials can be reintegrated into local supply chains, reducing losses and reducing landfill pressure.',
      targetUsers: ['Market vendors', 'Retail shops', 'Waste collectors', 'Community recycling groups'],
      whereUseful: ['Open markets', 'Community stores', 'Food-processing sites', 'Local recycling hubs'],
      userBenefit: 'Users can recover value from packaging and identify which materials are worth sorting before they are lost or mixed with trash.',
      category: 'hybrid',
      difficulty: 'Medium',
      timeline: '4-6 weeks',
      budget: '₦ 80,000-250,000',
      currency: 'NGN',
      assumptions: ['The prototype can be validated in a single market or local business cluster.'],
      originalityAssessment: {
        summary: 'Preliminary AI-generated originality assessment: the concept is grounded in local material flow issues and reuse opportunities, but it should still be checked against existing recycling and waste-tracking products.',
        similar: ['Waste management apps', 'Recycling trackers', 'Smart-bin systems'],
        difference: 'It focuses on recovering packaging value before disposal rather than broad sustainability tracking alone.',
        unverified: 'The value of sorting and reuse will vary by local conditions and material demand.',
        validation: 'Pilot the concept with a few vendors and compare the amount of reusable packaging captured before and after the workflow.',
      },
      similarSolutions: ['Recycling apps', 'Waste collection tools', 'Smart waste sorting products'],
      differentiation: 'The focus is on identifying material value and reuse options early, instead of only counting waste after it has already been mixed or discarded.',
      potentialWeaknesses: ['Material quality varies', 'Collection routes may differ by location'],
      validationPlan: 'Run a pilot in one market, document sorted packaging items, and compare the recovered value and time saved with the old system.',
      features: ['Material recognition', 'Reuse suggestions', 'Collection planning', 'Sorting guidance', 'Market reuse dashboard'],
      featuresMvp: [
        {
          name: 'Material recognition',
          summary: 'Identify packaging types from a photo or short selection.',
          problem: 'Users do not know which materials are reusable, recyclable, or ordinary waste.',
          audience: 'Market vendors and shop owners',
          howItWorks: 'The user scans or selects a material type and gets an immediate classification and next step.',
          requirements: ['Image input', 'Material map'],
          inputs: ['Photo', 'Packaging type'],
          userExperience: 'The user gets a clear classification and reuse suggestion quickly.',
          output: 'Material category and guidance',
          dependencies: [],
          difficulty: 'Medium',
          cost: '₦ 20,000-50,000',
          limitations: ['Image quality and lighting affect accuracy.'],
          validation: 'Test the classification against a set of common local packaging items.',
        },
      ],
      featuresSecondary: [
        {
          name: 'Collection scheduling',
          summary: 'Coordinate reuse or collection pickups in a predictable flow.',
          problem: 'Reusable materials often sit aside without a clear collection plan.',
          audience: 'Waste collectors and community programs',
          howItWorks: 'The app recommends pickup windows and sorting groups based on material type and volume.',
          requirements: ['Scheduling logic', 'Collection data'],
          inputs: ['Volume', 'Item type', 'Pickup time'],
          userExperience: 'The user sees a simple schedule and can prepare sorted materials ahead of time.',
          output: 'Pickup schedule or action list',
          dependencies: ['Material recognition'],
          difficulty: 'Medium',
          cost: '₦ 12,000-25,000',
          limitations: ['Collection patterns vary by neighborhood.'],
          validation: 'Check whether the schedule is useful for local operators.',
        },
      ],
      featuresAdvanced: [
        {
          name: 'Material value dashboard',
          summary: 'Track how much material is recovered and reused over time.',
          problem: 'Users need proof that the sorting workflow creates value, not just more steps.',
          audience: 'Community organizers',
          howItWorks: 'The system stores material flows and estimates potential value or waste avoided.',
          requirements: ['Analytics', 'Data history'],
          inputs: ['Material type', 'Volume', 'Time'],
          userExperience: 'The user sees summarized recovery outcomes and local impact.',
          output: 'Reuse report',
          dependencies: ['Collection scheduling'],
          difficulty: 'Hard',
          cost: '₦ 20,000-50,000',
          limitations: ['Local pricing and material demand vary.'],
          validation: 'Compare dashboard estimates with actual material collected over a trial period.',
        },
      ],
      technologyStack: [
        { name: 'React app', type: 'Software', purpose: 'Capture material categorization and reuse flow.', whyNeeded: 'The workflow needs to be simple and mobile-friendly.', connectsTo: 'Backend and camera input', notes: 'Works well on phone-based workflows.' },
        { name: 'Image model', type: 'AI service', purpose: 'Identify common packaging and materials in photos.', whyNeeded: 'Classification is central to the user flow.', connectsTo: 'Backend API', notes: 'A lightweight model is sufficient for a pilot.' },
        { name: 'SQLite', type: 'Database', purpose: 'Store material items and pickup data.', whyNeeded: 'Simple collection tracking is part of the core value.', connectsTo: 'Backend', notes: 'Lightweight and low-cost.' },
      ],
      architecture: 'Users identify material or packaging in the app, the system classifies it, and the backend recommends reuse or collection routes based on local conditions and value.',
      buildPlan: ['Select a single material stream to prototype.', 'Build a photo-based classification flow.', 'Add collection planning and reuse recommendations.', 'Validate with a small market pilot.'],
      testingPlan: ['Measure how often common packaging items are classified correctly.', 'Compare recovery volume before and after the workflow.', 'Check whether the guidance is action-oriented and useful.'],
      risks: ['Poor image quality', 'Material variability', 'Local market conditions affect value'],
      futureImprovements: ['Route planning', 'Barcode support', 'Supplier matching and resale suggestions'],
      imagePrompt: 'A material-recognition app identifying reusable packaging in a local market.',
    }
  }

  return {
    ...concept,
    blueprint: {
      ...defaultBlueprint,
      ...concept,
      title: concept.name,
      name: concept.name,
      description: concept.description,
      features: concept.features,
      imagePrompt: concept.imagePrompt,
    },
  }
}

function refinePrototype(current, instruction) {
  const guidance = (instruction || 'Refine the concept').trim() || 'Refine the concept'
  const lowerGuidance = guidance.toLowerCase()
  const base = current?.blueprint || current || defaultBlueprint
  const existingName = base.name || current?.name || 'Prototype Concept'
  const nextName = lowerGuidance.includes('cheap') || lowerGuidance.includes('low cost')
    ? `${existingName.split(' ')[0]} Lite`
    : lowerGuidance.includes('hardware')
      ? `${existingName.split(' ')[0]} Device`
      : lowerGuidance.includes('software')
        ? `${existingName.split(' ')[0]} App`
        : existingName

  let features = normalizeList(base.features)
  if (lowerGuidance.includes('low cost') || lowerGuidance.includes('cheap') || lowerGuidance.includes('budget')) {
    features = [...new Set(['Lower-cost prototype', ...features])]
  }
  if (lowerGuidance.includes('mobile') || lowerGuidance.includes('phone')) {
    features = [...new Set(['Mobile-first workflow', ...features])]
  }
  if (lowerGuidance.includes('hardware') || lowerGuidance.includes('sensor')) {
    features = [...new Set(['Hardware integration', ...features])]
  }

  const description = `${base.description || current?.description || 'A practical concept'} Updated to better match the request: ${guidance}.`

  return {
    name: nextName,
    description,
    features: features.slice(0, 6),
    ideaSummary: current?.ideaSummary || base?.problem || guidance,
    imagePrompt: base.imagePrompt || current?.imagePrompt || 'A polished product design concept rendered in a stylish studio environment.',
    blueprint: {
      ...defaultBlueprint,
      ...base,
      name: nextName,
      description,
      tagline: base.tagline || 'Refined concept',
      differentiation: `${base.differentiation || 'The idea stays grounded in a real user problem.'} The guidance specifically emphasizes: ${guidance}.`,
      features: features.slice(0, 6),
    },
  }
}

function getTimestampLabel() {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function createVersionRecord(instance, number, label, ideaSummary) {
  return {
    id: `v${number}`,
    versionNumber: number,
    shortDescription: label,
    timestamp: getTimestampLabel(),
    ideaSummary,
    ...instance,
  }
}

function PrototypePreview({ prototype, onImageError, isImageGenerating }) {
  const image = typeof prototype.image === 'string' ? prototype.image : ''
  const [loadedImage, setLoadedImage] = useState('')
  const [failedImage, setFailedImage] = useState('')
  const isLoading = Boolean(image) && image !== loadedImage && image !== failedImage
  const isUnavailable = !image || image === failedImage

  return (
    <>
      <div className="prototype-image-frame">
        {!isUnavailable && (
          <img
            src={image}
            alt={`${prototype.name} concept preview`}
            onLoad={() => setLoadedImage(image)}
            onError={() => {
              setFailedImage(image)
              onImageError(image)
            }}
          />
        )}
        {isLoading && (
          <div className="prototype-preview-state is-loading" role="status" aria-live="polite">
            <span className="preview-spinner" aria-hidden="true" />
            <strong>Loading visual preview...</strong>
          </div>
        )}
        {isUnavailable && !isImageGenerating && (
          <div className="prototype-preview-state" role="status" aria-live="polite">
            <span className="preview-symbol" aria-hidden="true">P</span>
            <strong>
              {failedImage
                ? 'Preview image could not be loaded'
                : prototype.imageError
                  ? 'Image generation unavailable'
                  : 'No concept image generated yet'}
            </strong>
            <span>
              {failedImage
                ? 'Try generating the concept again to load another preview.'
                : prototype.imageError
                  ? prototype.imageError
                  : 'Generate a concept image when ready.'}
            </span>
          </div>
        )}
        {isImageGenerating && (
          <div className="prototype-preview-state is-loading" role="status" aria-live="polite">
            <span className="preview-spinner" aria-hidden="true" />
            <strong>Generating a project-specific concept render...</strong>
          </div>
        )}
      </div>
    </>
  )
}

function VersionThumbnail({ version }) {
  const image = typeof version.image === 'string' ? version.image : ''
  const [failedImage, setFailedImage] = useState('')

  if (!image || image === failedImage) {
    return <span className="version-preview-placeholder">{failedImage ? 'Preview unavailable' : 'Preview pending'}</span>
  }

  return <img src={image} alt={`${version.name} concept image`} onError={() => setFailedImage(image)} />
}

async function requestPrototype(idea, instructions = '', currentPrototype, recentIdeas = []) {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
  let response

  try {
    response = await fetch(`${apiBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea,
        instructions,
        ...(currentPrototype ? { currentPrototype } : {}),
        ...(recentIdeas.length > 0 ? { recentIdeas } : {}),
      }),
    })
  } catch {
    throw new Error('Could not reach the backend. Start it with npm start from the backend folder.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('The backend returned an invalid response. Please try again.')
  }

  if (!response.ok) {
    const message = typeof result?.error === 'string' ? result.error : 'The backend could not generate the prototype.'
    throw new Error(message)
  }

  const concept = result?.prototype
  const blueprint = concept?.blueprint
  if (
    !concept ||
    typeof concept.name !== 'string' ||
    typeof concept.description !== 'string' ||
    typeof concept.imagePrompt !== 'string' ||
    !Array.isArray(concept.features) ||
    !concept.features.every((feature) => typeof feature === 'string') ||
    !blueprint ||
    typeof blueprint !== 'object' ||
    !blueprint.buildFeasibility ||
    typeof blueprint.buildFeasibility !== 'object' ||
    !Array.isArray(blueprint.buildFeasibility.requiredResources) ||
    !Array.isArray(blueprint.featuresMvp) ||
    !Array.isArray(blueprint.featuresSecondary) ||
    !Array.isArray(blueprint.featuresAdvanced) ||
    !Array.isArray(blueprint.buildPlan) ||
    !Array.isArray(blueprint.testingPlan)
  ) {
    throw new Error('The backend returned an incomplete prototype. Please try again.')
  }

  return {
    ...concept,
    image: typeof concept.imageUrl === 'string' && concept.imageUrl.trim() ? concept.imageUrl.trim() : null,
    ideaSummary: concept.ideaSummary || idea,
    blueprint,
  }
}

async function requestIdeaClarification(idea) {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
  let response
  try {
    response = await fetch(`${apiBaseUrl}/api/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea }),
    })
  } catch {
    throw new Error('Could not reach the backend to clarify this idea. You can generate a blueprint without clarification.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('The backend returned an invalid clarification response. Try again or generate without clarification.')
  }
  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'Idea clarification failed.')
  }
  if (
    typeof result?.needsClarification !== 'boolean' ||
    !Array.isArray(result.questions) ||
    !result.questions.every((question) => typeof question === 'string')
  ) {
    throw new Error('The backend returned incomplete clarification questions.')
  }
  return {
    needsClarification: result.needsClarification,
    questions: result.questions.map((question) => question.slice(0, 160)).filter(Boolean).slice(0, 4),
  }
}

async function requestPrototypeImage(imagePrompt) {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '')
  let response

  try {
    response = await fetch(`${apiBaseUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePrompt }),
    })
  } catch {
    throw new Error('Could not reach the backend image-generation endpoint.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('The backend returned an invalid image response.')
  }

  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'Image generation failed.')
  }
  if (typeof result?.imageUrl !== 'string' || !result.imageUrl.startsWith('/api/images/')) {
    throw new Error('The backend did not return a valid saved-image URL.')
  }

  const imageUrl = new URL(result.imageUrl, `${apiBaseUrl}/`)
  if (imageUrl.origin !== new URL(apiBaseUrl).origin) {
    throw new Error('The backend returned an image URL from an unexpected origin.')
  }
  return imageUrl.href
}

async function requestPrototypeWithImage(idea, instructions = '', currentPrototype, recentIdeas = []) {
  const prototype = await requestPrototype(idea, instructions, currentPrototype, recentIdeas)
  try {
    const image = await requestPrototypeImage(prototype.imagePrompt)
    return { ...prototype, image, imageError: '' }
  } catch (error) {
    return { ...prototype, image: null, imageError: error.message }
  }
}

const historyStorageKey = 'prototype-version-history'
const favoritesStorageKey = 'prototype-favorites'
const draftsStorageKey = 'prototype-input-drafts'

function loadSavedDrafts() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(draftsStorageKey) || 'null')
    return {
      idea: typeof saved?.idea === 'string' ? saved.idea.slice(0, 4000) : '',
      refinement: typeof saved?.refinement === 'string' ? saved.refinement.slice(0, 2000) : '',
      clarificationQuestions: Array.isArray(saved?.clarificationQuestions)
        ? saved.clarificationQuestions.filter((question) => typeof question === 'string').slice(0, 4).map((question) => question.slice(0, 160))
        : [],
      clarificationAnswers: saved?.clarificationAnswers && typeof saved.clarificationAnswers === 'object' && !Array.isArray(saved.clarificationAnswers)
        ? Object.fromEntries(Object.entries(saved.clarificationAnswers)
          .filter(([index, answer]) => /^[0-3]$/.test(index) && typeof answer === 'string')
          .map(([index, answer]) => [index, answer.slice(0, 250)]))
        : {},
    }
  } catch {
    return { idea: '', refinement: '' }
  }
}

function loadSavedHistory() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(historyStorageKey) || 'null')
    if (
      saved &&
      Array.isArray(saved.versions) &&
      saved.versions.length > 0 &&
      Number.isInteger(saved.currentVersionIndex) &&
      saved.currentVersionIndex >= 0 &&
      saved.currentVersionIndex < saved.versions.length &&
      saved.versions.every((version) =>
        version &&
        typeof version.id === 'string' &&
        typeof version.name === 'string' &&
        typeof version.description === 'string' &&
        Array.isArray(version.features) &&
        version.features.every((feature) => typeof feature === 'string') &&
        (version.image == null || typeof version.image === 'string'),
      )
    ) {
      return saved
    }
  } catch {
    return null
  }
  return null
}

function loadSavedFavorites() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(favoritesStorageKey) || '[]')
    return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveVersionHistory(versions, currentVersionIndex) {
  try {
    window.localStorage.setItem(historyStorageKey, JSON.stringify({ versions, currentVersionIndex }))
    return true
  } catch {
    return false
  }
}

function saveFavorites(favorites) {
  try {
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites))
    return true
  } catch {
    return false
  }
}

function saveDrafts(drafts) {
  try {
    window.localStorage.setItem(draftsStorageKey, JSON.stringify({
      idea: drafts.idea.slice(0, 4000),
      refinement: drafts.refinement.slice(0, 2000),
      clarificationQuestions: drafts.clarificationQuestions.slice(0, 4).map((question) => question.slice(0, 160)),
      clarificationAnswers: Object.fromEntries(Object.entries(drafts.clarificationAnswers)
        .filter(([index, answer]) => /^[0-3]$/.test(index) && typeof answer === 'string')
        .map(([index, answer]) => [index, answer.slice(0, 250)])),
    }))
    return true
  } catch {
    return false
  }
}

const initialVersions = [
  createVersionRecord(
    generatePrototype('A low-cost soil health sensor for small farms'),
    1,
    'Original concept',
    'A low-cost soil health sensor for small farms',
  ),
  createVersionRecord(
    refinePrototype(
      generatePrototype('A low-cost soil health sensor for small farms'),
      'Make it cheaper and simpler for a small team',
    ),
    2,
    'Reduced cost and complexity',
    'A low-cost soil health sensor for small farms',
  ),
  createVersionRecord(
    refinePrototype(
      refinePrototype(generatePrototype('A low-cost soil health sensor for small farms'), 'Make it cheaper and simpler for a small team'),
      'Focus on quick decisions rather than full automation',
    ),
    3,
    'Focused on user value',
    'A low-cost soil health sensor for small farms',
  ),
]

function App() {
  const [savedHistory] = useState(loadSavedHistory)
  const [savedDrafts] = useState(loadSavedDrafts)
  const [favorites, setFavorites] = useState(loadSavedFavorites)
  const [ideaInput, setIdeaInput] = useState(savedDrafts.idea)
  const [refinementInput, setRefinementInput] = useState(savedDrafts.refinement)
  const [clarificationQuestions, setClarificationQuestions] = useState(savedDrafts.clarificationQuestions)
  const [clarificationAnswers, setClarificationAnswers] = useState(savedDrafts.clarificationAnswers)
  const draftInputsRef = useRef(savedDrafts)
  const [versions, setVersions] = useState(savedHistory?.versions || initialVersions)
  const [currentVersionIndex, setCurrentVersionIndex] = useState(savedHistory?.currentVersionIndex ?? 0)
  const [phase, setPhase] = useState('result')
  const [requestError, setRequestError] = useState('')
  const [draftError, setDraftError] = useState('')
  const [isClarifying, setIsClarifying] = useState(false)
  const [failedPreview, setFailedPreview] = useState('')
  const [isImageGenerating, setIsImageGenerating] = useState(false)
  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceTarget, setVoiceTarget] = useState('idea')
  const [voiceMessage, setVoiceMessage] = useState('')
  const recognitionRef = useRef(null)
  const pdfExportingRef = useRef(false)
  const voiceStateRef = useRef('idle')
  const recordingTargetRef = useRef('idea')
  const voiceErrorRef = useRef(false)
  const finalTranscriptRef = useRef(false)
  const ideaInputRef = useRef(null)
  const refinementInputRef = useRef(null)
  const SpeechRecognition = getSpeechRecognitionConstructor(typeof window !== 'undefined' ? window : null)
  const isRecording = voiceState !== 'idle'

  const releaseVoiceSession = (recognition, abort = false) => {
    if (recognitionRef.current !== recognition) return
    recognitionRef.current = null
    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    if (abort) {
      try {
        recognition.abort()
      } catch {
        return
      }
    }
  }

  useEffect(() => () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognitionRef.current = null
    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    try {
      recognition.abort()
    } catch {
      return
    }
  }, [])
  const updateIdeaInput = (nextValue) => {
    const idea = typeof nextValue === 'function' ? nextValue(draftInputsRef.current.idea) : nextValue
    if (draftInputsRef.current.idea !== idea && draftInputsRef.current.clarificationQuestions.length) {
      draftInputsRef.current.clarificationQuestions = []
      draftInputsRef.current.clarificationAnswers = {}
      setClarificationQuestions([])
      setClarificationAnswers({})
    }
    draftInputsRef.current.idea = idea
    setIdeaInput(idea)
    setDraftError(saveDrafts(draftInputsRef.current)
      ? ''
      : 'This browser could not save your input drafts. Keep a copy before refreshing.')
  }

  const updateRefinementInput = (refinement) => {
    draftInputsRef.current.refinement = refinement
    setRefinementInput(refinement)
    setDraftError(saveDrafts(draftInputsRef.current)
      ? ''
      : 'This browser could not save your input drafts. Keep a copy before refreshing.')
  }

  const updateClarificationAnswer = (index, answer) => {
    draftInputsRef.current.clarificationAnswers = { ...draftInputsRef.current.clarificationAnswers, [index]: answer }
    setClarificationAnswers(draftInputsRef.current.clarificationAnswers)
    setDraftError(saveDrafts(draftInputsRef.current)
      ? ''
      : 'This browser could not save your input drafts. Keep a copy before refreshing.')
  }

  const currentPrototype = versions[currentVersionIndex] || versions[0]
  const blueprint = currentPrototype?.blueprint || defaultBlueprint
  const canExportPdf = Boolean(
    currentPrototype &&
    typeof currentPrototype.name === 'string' &&
    currentPrototype.name.trim() &&
    currentPrototype.blueprint &&
    typeof currentPrototype.blueprint === 'object' &&
    !Array.isArray(currentPrototype.blueprint) &&
    Object.keys(currentPrototype.blueprint).length > 0,
  )
  const technologies = Array.isArray(blueprint.technologyStack) ? blueprint.technologyStack : []
  const feasibility = blueprint.buildFeasibility || {}
  const requiredResources = Array.isArray(feasibility.requiredResources) ? feasibility.requiredResources : []
  const buildSteps = normalizeList(blueprint.buildPlan)
  const testCases = normalizeList(blueprint.testingPlan)
  const featureGroups = [
    ['Core MVP features', Array.isArray(blueprint.featuresMvp) ? blueprint.featuresMvp : []],
    ['Later additions', Array.isArray(blueprint.featuresSecondary) ? blueprint.featuresSecondary : []],
    ['Future options', Array.isArray(blueprint.featuresAdvanced) ? blueprint.featuresAdvanced : []],
  ].filter(([, items]) => items.length > 0)
  const technologyGroups = [
    ['Hardware', technologies.filter((item) => /hardware|sensor|microcontroller|electrical|mechanical/i.test(item.type || ''))],
    ['Software and services', technologies.filter((item) => /software|service|api|tool|framework|database|cloud/i.test(item.type || ''))],
    ['Other project-specific components', technologies.filter((item) =>
      !/hardware|sensor|microcontroller|electrical|mechanical|software|service|api|tool|framework|database|cloud/i.test(item.type || ''),
    )],
  ].filter(([, items]) => items.length > 0)
  const feasibilityNotes = [...new Set([
    ...normalizeList(blueprint.buildFeasibility?.implementationChallenges),
    ...normalizeList(blueprint.buildFeasibility?.risksAndLimitations),
    ...normalizeList(blueprint.assumptions),
  ])]
  const comparableApproaches = []
  const seenComparableApproaches = new Set()
  for (const approach of [
    ...normalizeList(blueprint.similarSolutions),
    ...normalizeList(blueprint.originalityAssessment?.similar),
  ]) {
    const normalizedApproach = approach.toLocaleLowerCase()
    if (seenComparableApproaches.has(normalizedApproach)) continue
    seenComparableApproaches.add(normalizedApproach)
    comparableApproaches.push(approach)
  }
  const searchTerms = normalizeList(blueprint.researchSearchTerms)
  const hasSimilarityInfo = Boolean(blueprint.originalityAssessment?.summary || comparableApproaches.length || searchTerms.length)
  const hasBuildContent = Boolean(
    feasibility.complexityReason || feasibilityNotes.length || technologies.length || requiredResources.length ||
    blueprint.architecture || buildSteps.length || testCases.length || feasibility.estimatedCost?.range ||
    feasibility.firstPracticalStep || feasibility.simplifiedStartingVersion,
  )

  const updateHistory = (nextVersions, nextVersionIndex) => {
    setVersions(nextVersions)
    setCurrentVersionIndex(nextVersionIndex)
    if (!saveVersionHistory(nextVersions, nextVersionIndex)) {
      setRequestError('Project history could not be saved in this browser. Your current session remains available.')
    }
  }

  const getRecentIdeas = () => {
    const seen = new Set()
    const ideaHistory = versions === initialVersions ? [] : versions
    return ideaHistory
      .slice(-12)
      .reverse()
      .filter((version) => {
        const summary = (version.ideaSummary || version.description || '').trim()
        const key = summary.toLowerCase()
        if (!summary || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 8)
      .map((version) => {
        const projectBlueprint = version.blueprint || {}
        const mechanism = projectBlueprint.mechanism || projectBlueprint.differentiation || version.description
        const features = normalizeList(version.features).slice(0, 4).join(', ')
        return `${version.name}: idea ${(version.ideaSummary || '').slice(0, 120)}; approach ${mechanism}; features ${features}`.slice(0, 500)
      })
  }

  const toggleFavorite = () => {
    const nextFavorites = favorites.includes(currentPrototype.id)
      ? favorites.filter((item) => item !== currentPrototype.id)
      : [...favorites, currentPrototype.id]
    setFavorites(nextFavorites)
    saveFavorites(nextFavorites)
  }

  const startGeneration = async (nextIdea, clarificationInstructions = '') => {
    setRequestError('')
    setPhase('generating')
    try {
      const prototype = await requestPrototypeWithImage(nextIdea, clarificationInstructions, undefined, getRecentIdeas())
      const nextVersion = createVersionRecord(prototype, 1, 'Original concept', nextIdea)
      updateHistory([nextVersion], 0)
      draftInputsRef.current.clarificationQuestions = []
      draftInputsRef.current.clarificationAnswers = {}
      setClarificationQuestions([])
      setClarificationAnswers({})
      setDraftError(saveDrafts(draftInputsRef.current)
        ? ''
        : 'This browser could not save your input drafts. Keep a copy before refreshing.')
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setPhase('result')
    }
  }

  const handleGenerate = () => {
    const nextIdea = ideaInput.trim()
    if (!nextIdea || phase === 'generating' || isClarifying) return
    startGeneration(nextIdea)
  }

  const handleGetStarted = () => {
    window.location.hash = 'idea-input'
    ideaInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ideaInputRef.current?.focus({ preventScroll: true })
  }

  const handleClarify = async () => {
    const idea = ideaInput.trim()
    if (!idea || phase === 'generating' || isClarifying) return
    setRequestError('')
    setIsClarifying(true)
    try {
      const result = await requestIdeaClarification(idea)
      if (result.needsClarification && result.questions.length) {
        draftInputsRef.current.clarificationQuestions = result.questions
        draftInputsRef.current.clarificationAnswers = {}
        setClarificationQuestions(result.questions)
        setClarificationAnswers({})
        setDraftError(saveDrafts(draftInputsRef.current)
          ? ''
          : 'This browser could not save your input drafts. Keep a copy before refreshing.')
      } else {
        draftInputsRef.current.clarificationQuestions = []
        draftInputsRef.current.clarificationAnswers = {}
        setClarificationQuestions([])
        setClarificationAnswers({})
        setDraftError(saveDrafts(draftInputsRef.current)
          ? ''
          : 'This browser could not save your input drafts. Keep a copy before refreshing.')
        await startGeneration(idea)
      }
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setIsClarifying(false)
    }
  }

  const handleClarificationContinue = () => {
    const answeredQuestions = clarificationQuestions
      .map((question, index) => ({ question, answer: clarificationAnswers[index]?.trim() }))
      .filter(({ answer }) => answer)
    const clarificationInstructions = answeredQuestions
      .map(({ question, answer }) => `Clarification — ${question} Answer: ${answer}`)
      .join('\n')
    if (clarificationInstructions.length > 2000) {
      setRequestError('Your clarification answers exceed the request limit. Shorten an answer or skip clarification.')
      return
    }
    startGeneration(ideaInput.trim(), clarificationInstructions)
  }

  const handleClarificationSkip = () => {
    if (ideaInput.trim()) startGeneration(ideaInput.trim())
  }

  const handleGenerateAgain = async () => {
    if (phase === 'generating' || isClarifying) return
    const seedIdea = currentPrototype?.ideaSummary || ideaInput.trim() || 'A low-cost soil health sensor for small farms'
    const nextIdea = seedIdea
    setRequestError('')
    setPhase('generating')
    try {
      const generated = await requestPrototypeWithImage(nextIdea, '', undefined, getRecentIdeas())
      const nextNumber = versions.length + 1
      const nextVersion = createVersionRecord(generated, nextNumber, 'Fresh concept iteration', nextIdea)
      updateHistory([...versions, nextVersion], versions.length)
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setPhase('result')
    }
  }

  const handleRefine = async () => {
    const instruction = refinementInput.trim()
    if (!instruction || phase === 'generating' || isClarifying) return

    const nextIndex = versions.length
    setRequestError('')
    setPhase('generating')
    try {
      const refined = await requestPrototypeWithImage(
        currentPrototype.ideaSummary,
        instruction,
        {
          name: currentPrototype.name,
          description: currentPrototype.description,
          features: currentPrototype.features,
          blueprint: currentPrototype.blueprint,
        },
        getRecentIdeas(),
      )
      const nextVersionNumber = Math.max(...versions.map((version) => version.versionNumber), 0) + 1
      const nextVersion = createVersionRecord(refined, nextVersionNumber, 'Refined concept', currentPrototype.ideaSummary)
      updateHistory([...versions, nextVersion], nextIndex)
    } catch (error) {
      setRequestError(error.message)
    } finally {
      setPhase('result')
    }
  }

  const handleSelectVersion = (index) => {
    updateHistory(versions, index)
  }

  const handleGenerateImage = async () => {
    if (!currentPrototype?.imagePrompt || isImageGenerating) return
    setRequestError('')
    setFailedPreview('')
    setIsImageGenerating(true)
    try {
      const image = await requestPrototypeImage(currentPrototype.imagePrompt)
      const updatedVersions = versions.map((version, index) =>
        index === currentVersionIndex ? { ...version, image, imageError: '' } : version,
      )
      updateHistory(updatedVersions, currentVersionIndex)
    } catch (error) {
      const updatedVersions = versions.map((version, index) =>
        index === currentVersionIndex ? { ...version, imageError: error.message } : version,
      )
      updateHistory(updatedVersions, currentVersionIndex)
      setRequestError(error.message)
    } finally {
      setIsImageGenerating(false)
    }
  }

  const handleVoiceInput = (target) => {
    if (recognitionRef.current || voiceStateRef.current !== 'idle') {
      if (recordingTargetRef.current === target && voiceStateRef.current !== 'stopping') {
        voiceStateRef.current = 'stopping'
        setVoiceState('stopping')
        setVoiceMessage('Stopping voice input...')
        try {
          if (!recognitionRef.current) throw new Error('No active recognition session')
          recognitionRef.current.stop()
        } catch {
          if (recognitionRef.current) releaseVoiceSession(recognitionRef.current, true)
          voiceStateRef.current = 'idle'
          setVoiceState('idle')
          setVoiceMessage('Voice input could not stop cleanly. Any existing or transcribed text was kept; review it and try again.')
        }
      }
      return
    }

    if (!SpeechRecognition) {
      setVoiceTarget(target)
      setVoiceMessage(`Voice input is not supported in this browser. You can still type your ${target === 'idea' ? 'idea' : 'refinement instructions'}.`)
      return
    }

    voiceStateRef.current = 'starting'
    recordingTargetRef.current = target
    voiceErrorRef.current = false
    finalTranscriptRef.current = false
    setVoiceTarget(target)
    setVoiceState('starting')
    setVoiceMessage('Requesting microphone access...')

    let recognition
    try {
      recognition = new SpeechRecognition()
      recognition.lang = navigator.language || 'en-US'
      recognition.continuous = false
      recognition.interimResults = true
      recognitionRef.current = recognition
    } catch {
      recognitionRef.current = null
      voiceStateRef.current = 'idle'
      setVoiceState('idle')
      voiceErrorRef.current = true
      setVoiceMessage('Voice input could not initialize. Check browser speech-recognition support or type your response.')
      return
    }

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return
      voiceStateRef.current = 'listening'
      setVoiceState('listening')
      setVoiceMessage(`Listening for your ${target === 'idea' ? 'idea' : 'refinement request'}. Speak naturally, then stop or wait for recording to finish.`)
    }
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return
      let finalTranscript = ''
      let interimTranscript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || ''
        if (event.results[index].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }
      if (finalTranscript.trim()) {
        finalTranscriptRef.current = true
        const currentText = draftInputsRef.current[target]
        const maxLength = target === 'idea' ? 4000 : 2000
        const appended = appendVoiceTranscript(currentText, finalTranscript, maxLength)
        if (appended.exceedsLimit) {
          setVoiceMessage(`The transcript exceeds the ${maxLength.toLocaleString()}-character ${target === 'idea' ? 'idea' : 'refinement'} limit. Shorten the text before continuing.`)
        } else if (target === 'idea') {
          updateIdeaInput(appended.value)
        } else {
          updateRefinementInput(appended.value)
        }
      }
      if (interimTranscript.trim()) {
        setVoiceMessage(`Recognizing: ${interimTranscript.trim()}`)
      }
    }
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return
      if (event.error === 'aborted' && voiceStateRef.current === 'stopping') {
        voiceErrorRef.current = true
        setVoiceMessage('Voice input stopped. Review or edit any transcription before continuing.')
      } else {
        voiceErrorRef.current = true
        setVoiceMessage(getVoiceErrorMessage(event.error, target))
      }
      releaseVoiceSession(recognition, true)
      voiceStateRef.current = 'idle'
      setVoiceState('idle')
    }
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return
      voiceStateRef.current = 'idle'
      setVoiceState('idle')
      releaseVoiceSession(recognition)
      if (voiceErrorRef.current) return
      if (!finalTranscriptRef.current) {
        setVoiceMessage(`No speech was transcribed. Try again or type your ${recordingTargetRef.current === 'idea' ? 'idea' : 'refinement instructions'}.`)
        return
      }
      setVoiceMessage(`Voice input finished. Review or edit the transcription before ${recordingTargetRef.current === 'idea' ? 'generating' : 'refining'}.`)
    }

    try {
      recognition.start()
    } catch {
      releaseVoiceSession(recognition, true)
      voiceStateRef.current = 'idle'
      setVoiceState('idle')
      voiceErrorRef.current = true
      setVoiceMessage('Voice input could not start. Check microphone permission, browser speech-service availability, and site security settings, then try again.')
    }
  }

  const exportMarkdown = () => {
    const data = blueprint
    const exportedFeatureGroups = [
      ['Core MVP features', data.featuresMvp],
      ['Later additions', data.featuresSecondary],
      ['Future options', data.featuresAdvanced],
    ].filter(([, group]) => Array.isArray(group) && group.length > 0)
    const featuresMarkdown = exportedFeatureGroups.flatMap(([label, group]) => [
      `### ${label}`,
      ...group.map((feature) => [
        `- **${feature.name}:** ${feature.summary || ''}`,
        feature.howItWorks && `  How it works: ${feature.howItWorks}`,
        feature.whyItMatters && `  Why it matters: ${feature.whyItMatters}`,
      ].filter(Boolean).join('\n')),
      '',
    ])
    const feasibility = data.buildFeasibility || {}
    const cost = feasibility.estimatedCost || {}
    const markdown = [
      `# ${currentPrototype.name}`,
      '',
      data.tagline && `**Tagline:** ${data.tagline}`,
      data.category && `**Category:** ${data.category}`,
      '',
      '## Project overview',
      currentPrototype.description,
      data.problem && `**Problem:** ${data.problem}`,
      normalizeList(data.targetUsers).length > 0 && `**Target users:** ${normalizeList(data.targetUsers).join(', ')}`,
      (data.mechanism || data.userBenefit) && `**How it works:** ${data.mechanism || data.userBenefit}`,
      data.differentiation && `**Differentiator:** ${data.differentiation}`,
      '',
      hasSimilarityInfo && '## Similarity to investigate',
      hasSimilarityInfo && data.originalityAssessment?.summary,
      comparableApproaches.length > 0 && `**Comparable approaches:** ${comparableApproaches.join(', ')}`,
      searchTerms.length > 0 && `**Search terms:** ${searchTerms.join(', ')}`,
      '',
      featureGroups.length > 0 && '## Key features',
      ...featuresMarkdown,
      (feasibility.complexityLevel || feasibility.complexityReason || technologies.length || buildSteps.length || testCases.length || cost.range) && '## Build feasibility',
      feasibility.complexityReason && `**Complexity (${feasibility.complexityLevel || 'Assumption'}):** ${feasibility.complexityReason}`,
      ...feasibilityNotes.map((note) => `- ${note}`),
      ...(technologies.length > 0 ? ['### Components and tools', ...technologies.map((item) => `- ${item.name} (${item.type}): ${item.purpose || item.notes}`)] : []),
      ...(requiredResources.length > 0 ? requiredResources.map((group) => `- ${group.category}: ${normalizeList(group.items).join(', ')}`) : []),
      data.architecture && `**Architecture:** ${data.architecture}`,
      ...(buildSteps.length > 0 ? ['### MVP build steps', ...buildSteps.map((step) => `- ${step}`)] : []),
      ...(testCases.length > 0 ? ['### Testing', ...testCases.map((step) => `- ${step}`)] : []),
      cost.range && `**Estimated cost:** ${cost.range}`,
      cost.assumptions && `**Cost assumptions:** ${cost.assumptions}`,
      cost.reason && `**Cost basis:** ${cost.reason}`,
      feasibility.simplifiedStartingVersion && `**Simplest useful prototype:** ${feasibility.simplifiedStartingVersion}`,
      feasibility.firstPracticalStep && `**Recommended first step:** ${feasibility.firstPracticalStep}`,
    ].filter((line) => typeof line === 'string' && line.trim()).join('\n')

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentPrototype.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = async () => {
    if (pdfExportingRef.current) return
    if (!canExportPdf) {
      setRequestError('A valid blueprint is not available to export yet.')
      return
    }

    pdfExportingRef.current = true
    setIsPdfExporting(true)
    setRequestError('')
    try {
      const { downloadBlueprintPdf } = await import('./blueprintPdf')
      downloadBlueprintPdf(currentPrototype)
    } catch (error) {
      setRequestError(`PDF export failed. ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      pdfExportingRef.current = false
      setIsPdfExporting(false)
    }
  }

  const copySummary = async () => {
    const summary = [
      `${currentPrototype.name} — ${blueprint.tagline || currentPrototype.description}`,
      `Problem: ${blueprint.problem || currentPrototype.description}`,
      normalizeList(blueprint.targetUsers).length > 0 && `Users: ${normalizeList(blueprint.targetUsers).join(', ')}`,
      blueprint.buildFeasibility?.estimatedCost?.range && `Estimated cost: ${blueprint.buildFeasibility.estimatedCost.range}`,
      (blueprint.buildFeasibility?.estimatedCost?.assumptions || blueprint.buildFeasibility?.estimatedCost?.reason) &&
        `Cost basis: ${[blueprint.buildFeasibility.estimatedCost.assumptions, blueprint.buildFeasibility.estimatedCost.reason].filter(Boolean).join(' ')}`,
      blueprint.timeline && `Timeline: ${blueprint.timeline}`,
    ].filter(Boolean).join('\n')

    try {
      await navigator.clipboard.writeText(summary)
      setRequestError('Project summary copied to clipboard.')
    } catch {
      setRequestError('Clipboard access is unavailable. Copy the summary manually from the blueprint view.')
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container navbar">
          <div className="brand" aria-label="PROTOTYPE home">
            <span className="brand-mark">P</span>
            PROTOTYPE
          </div>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#blueprint">Blueprint</a>
            <a href="#version-history">Previous Ideas</a>
          </nav>
          <button type="button" className="nav-cta" onClick={handleGetStarted}>Get Started</button>
        </div>
      </header>

      <main>
        {requestError && (
          <div className="container status-banner" role="alert">
            <p>{requestError}</p>
          </div>
        )}
        {draftError && (
          <div className="container status-banner" role="status">
            <p>{draftError}</p>
          </div>
        )}

        <section id="home" className="hero-section">
          <div className="container hero-grid">
            <div className="hero-content">
              <p className="eyebrow">AI-powered invention workspace</p>
              <h1>Turn a rough idea into a buildable project.</h1>
              <p className="hero-copy">
                Describe a real problem, a user, and a context. PROTOTYPE turns it into a practical concept and buildable blueprint for software, hardware, or hybrid ideas.
              </p>

              <div className="idea-panel">
                <label className="sr-only" htmlFor="idea-input">Describe the idea</label>
                <div className="idea-input-row">
                  <textarea
                    id="idea-input"
                    ref={ideaInputRef}
                    value={ideaInput}
                    onChange={(event) => updateIdeaInput(event.target.value)}
                    placeholder="Describe a problem you want to solve, an idea you have, or something you wish existed..."
                    rows="4"
                    maxLength="4000"
                    aria-describedby="voice-input-help voice-input-status"
                  />
                  <button
                    type="button"
                    className={`microphone-button ${isRecording && voiceTarget === 'idea' ? 'is-recording' : ''}`}
                    onClick={() => handleVoiceInput('idea')}
                    aria-label={isRecording && voiceTarget === 'idea' ? 'Stop voice input' : 'Start voice input'}
                    aria-pressed={isRecording && voiceTarget === 'idea'}
                    disabled={(!isRecording && !SpeechRecognition) || (isRecording && voiceTarget !== 'idea')}
                    title={SpeechRecognition ? (isRecording && voiceTarget === 'idea' ? 'Stop voice input' : 'Speak your idea') : 'Voice input is not supported in this browser'}
                  >
                    {isRecording && voiceTarget === 'idea' ? (voiceState === 'starting' ? 'Starting...' : 'Stop') : (
                      <svg className="microphone-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="9" y="2.5" width="6" height="12" rx="3" />
                        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
                      </svg>
                    )}
                  </button>
                </div>
                <p id="voice-input-help" className="voice-disclosure">
                  Voice recognition is provided by your browser and may use its speech service. PROTOTYPE does not record in the background.
                </p>
                <p id="voice-input-status" className={`voice-status ${isRecording ? 'is-recording' : ''}`} role="status" aria-live="polite">
                  {voiceTarget === 'idea' && voiceMessage ? voiceMessage : !SpeechRecognition ? 'This browser does not expose speech recognition. Try an up-to-date browser with Web Speech API support; typing still works.' : ''}
                </p>
                <div className="hero-helper-row">
                  <span className="helper-text">Focus on the user problem, not just the technology.</span>
                  <div className="idea-action-buttons">
                    <button type="button" className="secondary-button" onClick={handleClarify} disabled={!ideaInput.trim() || phase === 'generating' || isClarifying}>
                      {isClarifying ? 'Checking idea...' : 'Clarify first (optional)'}
                    </button>
                    <button type="button" className="primary-button" onClick={handleGenerate} disabled={!ideaInput.trim() || phase === 'generating' || isClarifying}>Generate Blueprint</button>
                  </div>
                </div>
                {clarificationQuestions.length > 0 && (
                  <section className="clarification-panel" aria-labelledby="clarification-heading">
                    <p className="eyebrow">Optional idea clarification</p>
                    <h2 id="clarification-heading">A few details could make this blueprint more useful.</h2>
                    <p>Your original idea stays editable above. Answer any questions that matter, continue with your answers, or skip and generate from the original idea.</p>
                    {clarificationQuestions.map((question, index) => (
                      <label className="clarification-question" key={`${question}-${index}`}>
                        <span>{question}</span>
                        <textarea
                          value={clarificationAnswers[index] || ''}
                          onChange={(event) => updateClarificationAnswer(index, event.target.value)}
                          rows="2"
                          maxLength="250"
                          placeholder="Add a detail if you know it; otherwise leave this blank."
                        />
                      </label>
                    ))}
                    <div className="clarification-actions">
                      <button type="button" className="secondary-button" onClick={handleClarificationSkip} disabled={phase === 'generating'}>Skip and generate</button>
                      <button type="button" className="primary-button" onClick={handleClarificationContinue} disabled={phase === 'generating'}>Use answers and generate</button>
                    </div>
                  </section>
                )}
              </div>

              <div className="examples-row" aria-label="Example prompts">
                {examplePrompts.map((prompt) => (
                  <button key={prompt} type="button" className="example-pill" onClick={() => updateIdeaInput(prompt)}>{prompt}</button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {phase === 'generating' ? (
          <section className="container generation-section" aria-live="polite">
            <div className="generation-card">
              <p className="eyebrow">Generating blueprint</p>
              <h2>Shaping your idea into a practical concept...</h2>
              <p className="generation-copy">We are identifying the user problem, preparing the build plan, and generating a project-specific concept render.</p>
              <div className="loader-wrap">
                <div className="loader-track">
                  <div className="loader-fill" />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="container prototype-workspace">
            <div className="prototype-visual">
              <PrototypePreview prototype={currentPrototype} onImageError={setFailedPreview} isImageGenerating={isImageGenerating} />
              <div className="prototype-actions">
                {currentPrototype.image && currentPrototype.image !== failedPreview && (
                  <a className="secondary-button" href={currentPrototype.image} download>Download Image</a>
                )}
                <button type="button" className="ghost-button" onClick={handleGenerateImage} disabled={isImageGenerating}>
                  {isImageGenerating ? 'Generating image...' : currentPrototype.image ? 'Generate another image' : 'Generate image'}
                </button>
                <button type="button" className="ghost-button" onClick={handleGenerateAgain}>Generate Again</button>
                <button type="button" className="ghost-button" onClick={toggleFavorite}>{favorites.includes(currentPrototype.id) ? 'Unfavorite' : 'Save idea'}</button>
              </div>
              <p className="image-authenticity-note">AI-generated concept render only; not a verified engineering design or functioning prototype.</p>
            </div>

            <div className="prototype-details">
              <div className="detail-header-row">
                <div>
                  <p className="eyebrow">Current Idea</p>
                  <h3>{currentPrototype.name}</h3>
                </div>
              </div>

              <p className="detail-copy">{currentPrototype.description}</p>

              {(blueprint.category || blueprint.timeline) && (
                <div className="meta-grid">
                  {blueprint.category && <div className="metric-card"><span>Category</span><strong>{blueprint.category}</strong></div>}
                  {blueprint.timeline && <div className="metric-card"><span>Estimated timeline</span><strong>{blueprint.timeline}</strong></div>}
                </div>
              )}

            </div>
          </section>
        )}

        <section id="blueprint" className="container blueprint-shell">
          <div className="section-heading blueprint-header">
            <div>
              <p className="eyebrow">Project blueprint</p>
              <h2>{currentPrototype.name}</h2>
            </div>
            <div className="section-actions">
              <button type="button" className="secondary-button" onClick={copySummary}>Copy summary</button>
              <button
                type="button"
                className="primary-button"
                onClick={handleDownloadPdf}
                disabled={!canExportPdf || phase === 'generating' || isPdfExporting}
              >
                {isPdfExporting ? 'Preparing PDF...' : 'Download PDF'}
              </button>
              <button type="button" className="ghost-button" onClick={exportMarkdown}>Download .md</button>
            </div>
          </div>

          <article className="blueprint-card">
            <h3>Project overview</h3>
            {currentPrototype.description && <p>{currentPrototype.description}</p>}
            {blueprint.problem && <p><strong>Problem:</strong> {blueprint.problem}</p>}
            {normalizeList(blueprint.targetUsers).length > 0 && <p><strong>Intended for:</strong> {normalizeList(blueprint.targetUsers).join(', ')}</p>}
            {(blueprint.mechanism || blueprint.userBenefit) && <p><strong>How it works:</strong> {blueprint.mechanism || blueprint.userBenefit}</p>}
            {(blueprint.differentiation || blueprint.whyDifferenceMatters) && <p><strong>What distinguishes it:</strong> {blueprint.differentiation || blueprint.whyDifferenceMatters}</p>}
          </article>

          {featureGroups.length > 0 && (
            <article className="blueprint-card key-features-card">
              <h3>Key features</h3>
              <div className="feature-groups key-features">
                {featureGroups.map(([label, group]) => (
                  <section className="feature-block" key={label}>
                    <h4>{label}</h4>
                    <div className="feature-stack">
                      {group.map((feature) => (
                        <article className="feature-item" key={`${label}-${feature.name}`}>
                          <strong>{feature.name}</strong>
                          {feature.summary && <p>{feature.summary}</p>}
                          {(feature.howItWorks || feature.whyItMatters) && (
                            <ul className="feature-meta">
                              {feature.howItWorks && <li><span>How it works:</span> {feature.howItWorks}</li>}
                              {feature.whyItMatters && <li><span>Why it matters:</span> {feature.whyItMatters}</li>}
                            </ul>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          )}

          {hasBuildContent && (
            <article className="blueprint-card">
              <h3>Build feasibility</h3>
            <div className="feasibility-grid">
              {(feasibility.complexityReason || feasibilityNotes.length > 0) && (
                <section>
                  <h4>Complexity and constraints</h4>
                  {feasibility.complexityReason && <p><strong>{feasibility.complexityLevel || blueprint.difficulty}:</strong> {feasibility.complexityReason}</p>}
                  {feasibilityNotes.length > 0 && (
                    <ul className="mini-list">{feasibilityNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                  )}
                </section>
              )}
              {(technologies.length > 0 || requiredResources.length > 0) && (
                <section>
                  <h4>Components and tools</h4>
                  {technologyGroups.map(([groupName, items]) => (
                    <div key={groupName}>
                      <h5 className="resource-group-heading">{groupName}</h5>
                      <div className="tech-list">
                        {items.map((item) => (
                          <div key={`${item.name}-${item.type}`} className="tech-item">
                            <div><strong>{item.name}</strong><span>{item.type}</span></div>
                            {item.purpose && <p>{item.purpose}</p>}
                            {item.whyNeeded && <small>{item.whyNeeded}</small>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {requiredResources.map((group) => (
                    <div key={group.category}>
                      <h5 className="resource-group-heading">{group.category}</h5>
                      <ul className="mini-list">{normalizeList(group.items).map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  ))}
                </section>
              )}
              {blueprint.architecture && (
                <section>
                  <h4>System architecture</h4>
                  <p>{blueprint.architecture}</p>
                </section>
              )}
              {buildSteps.length > 0 && (
                <section>
                  <h4>MVP build steps</h4>
                  <ol className="mini-list">{buildSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                </section>
              )}
              {testCases.length > 0 && (
                <section>
                  <h4>Testing</h4>
                  <ul className="mini-list">{testCases.map((step) => <li key={step}>{step}</li>)}</ul>
                </section>
              )}
              {feasibility.estimatedCost && (
                <section>
                  <h4>Estimated cost</h4>
                  <p>{feasibility.estimatedCost.range || blueprint.budget}</p>
                  {(feasibility.estimatedCost.assumptions || feasibility.estimatedCost.reason) && (
                    <p className="muted-copy">{[feasibility.estimatedCost.assumptions, feasibility.estimatedCost.reason].filter(Boolean).join(' ')}</p>
                  )}
                </section>
              )}
              {(feasibility.firstPracticalStep || feasibility.simplifiedStartingVersion) && (
                <section>
                  <h4>Recommended first step</h4>
                  {feasibility.firstPracticalStep && <p>{feasibility.firstPracticalStep}</p>}
                  {feasibility.simplifiedStartingVersion && <p><strong>Simplest useful prototype:</strong> {feasibility.simplifiedStartingVersion}</p>}
                </section>
              )}
            </div>
            </article>
          )}

          {hasSimilarityInfo && (
            <article className="blueprint-card">
              <h3>Similarity to investigate</h3>
              <div className="two-column-grid">
                {blueprint.originalityAssessment?.summary && (
                  <div>
                    <h4>Preliminary AI assessment</h4>
                    <p>{blueprint.originalityAssessment.summary}</p>
                    {blueprint.originalityAssessment.unverified && <p><strong>Unverified:</strong> {blueprint.originalityAssessment.unverified}</p>}
                  </div>
                )}
                {comparableApproaches.length > 0 && (
                  <div>
                    <h4>Comparable approaches</h4>
                    <ul className="mini-list">{comparableApproaches.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}
                {searchTerms.length > 0 && (
                  <div>
                    <h4>Suggested search terms</h4>
                    <ul className="mini-list">{searchTerms.map((term) => <li key={term}>{term}</li>)}</ul>
                  </div>
                )}
              </div>
            </article>
          )}

        </section>

        <section id="refinement" className="container refinement-panel">
          <div className="refinement-copy">
            <p className="eyebrow">Improve the current concept</p>
            <h2>Refine Previous Idea</h2>
            <p>Update <strong>{currentPrototype.name}</strong>. Your changes apply to this idea and its blueprint.</p>
          </div>

          <div className="refinement-form">
            <div className="refinement-input-row">
              <textarea
                ref={refinementInputRef}
                value={refinementInput}
                onChange={(event) => updateRefinementInput(event.target.value)}
                rows="3"
                maxLength="2000"
                aria-describedby="refinement-voice-help refinement-voice-status"
                placeholder={`Describe changes to ${currentPrototype.name}. This refines the current idea; it will not start a new one.`}
              />
              <button
                type="button"
                className={`microphone-button ${isRecording && voiceTarget === 'refinement' ? 'is-recording' : ''}`}
                onClick={() => handleVoiceInput('refinement')}
                aria-label={isRecording && voiceTarget === 'refinement' ? 'Stop refinement voice input' : 'Speak refinement instructions'}
                aria-pressed={isRecording && voiceTarget === 'refinement'}
                disabled={(!isRecording && !SpeechRecognition) || (isRecording && voiceTarget !== 'refinement')}
                title={SpeechRecognition ? 'Speak refinement instructions' : 'Voice input is not supported in this browser'}
              >
                {isRecording && voiceTarget === 'refinement' ? (voiceState === 'starting' ? 'Starting...' : 'Stop') : (
                  <svg className="microphone-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="9" y="2.5" width="6" height="12" rx="3" />
                    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
                  </svg>
                )}
              </button>
            </div>
            <p id="refinement-voice-help" className="voice-disclosure">
              Voice recognition is provided by your browser and may use its speech service. PROTOTYPE does not record in the background.
            </p>
            <p id="refinement-voice-status" className={`voice-status ${isRecording && voiceTarget === 'refinement' ? 'is-recording' : ''}`} role="status" aria-live="polite">
              {voiceTarget === 'refinement' && voiceMessage ? voiceMessage : !SpeechRecognition ? 'This browser does not expose speech recognition. Try an up-to-date browser with Web Speech API support; typing still works.' : ''}
            </p>
            <button type="button" className="primary-button" onClick={handleRefine} disabled={!currentPrototype?.ideaSummary || !refinementInput.trim() || phase === 'generating'}>Refine Previous Idea</button>
          </div>
        </section>

        <section id="version-history" className="container version-panel">
          <div className="section-heading">
            <p className="eyebrow">Your idea evolution</p>
            <h2>Previous Ideas</h2>
          </div>

          <div className="version-history" role="list" aria-label="Previous ideas">
            {versions.map((version, index) => (
              <button key={version.id} type="button" className={`version-card ${currentVersionIndex === index ? 'active' : ''}`} onClick={() => handleSelectVersion(index)}>
                <VersionThumbnail version={version} />
                <div className="version-meta">
                  <strong>{version.shortDescription}</strong>
                  <time>{version.timestamp}</time>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
