// utils/priorityCalculator.js
// ─────────────────────────────────────────────────────────────────────────────
// Automated Priority Scoring Engine for Emergency SOS Requests (Member-2)
//
// Calculates an objective urgency score (0 - 100) based on vulnerability factors:
//   - Pregnant women (+25 pts each)
//   - Injured / Critical medical cases (+25 pts each)
//   - Children <= 12 yrs (+12 pts each)
//   - Elderly >= 60 yrs (+10 pts each)
//   - Need category weights (rescue: +25, medicine: +15, water: +10, food: +5)
//   - Group size scaling (marginal increase per person)
//   - Emergency situational keywords detected in description
//
// Priority Tiers:
//   - Critical: Score >= 70 (or direct life-threat rescue + injuries/pregnancy)
//   - High:     Score 45 - 69
//   - Medium:   Score 25 - 44
//   - Low:      Score < 25
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates priority score and detailed factor breakdown for an SOS request.
 *
 * @param {Object} params
 * @param {Object} [params.vulnerabilities] - Breakdown of vulnerable people
 * @param {number} [params.vulnerabilities.children] - Children count (<= 12 yrs)
 * @param {number} [params.vulnerabilities.elderly] - Elderly count (>= 60 yrs)
 * @param {number} [params.vulnerabilities.pregnantWomen] - Pregnant women count
 * @param {number} [params.vulnerabilities.injured] - Injured or critically ill count
 * @param {string[]} [params.needs] - Array of need types ('food', 'water', 'medicine', 'rescue')
 * @param {number} [params.numberOfPeople] - Total number of people in the group
 * @param {string} [params.description] - Additional emergency description notes
 * @returns {Object} { score, priority, factors, vulnerabilities }
 */
function calculatePriorityScore({
  vulnerabilities = {},
  needs = [],
  numberOfPeople = 1,
  description = '',
} = {}) {
  const children = Math.max(0, parseInt(vulnerabilities?.children, 10) || 0);
  const elderly = Math.max(0, parseInt(vulnerabilities?.elderly, 10) || 0);
  const pregnantWomen = Math.max(0, parseInt(vulnerabilities?.pregnantWomen, 10) || 0);
  const injured = Math.max(0, parseInt(vulnerabilities?.injured, 10) || 0);
  const totalPeople = Math.max(1, parseInt(numberOfPeople, 10) || 1);

  const factors = [];
  let score = 0;

  // ── 1. Pregnant Women (Extremely high vulnerability in disaster) ─────────────
  if (pregnantWomen > 0) {
    const pts = Math.min(30, pregnantWomen * 25);
    score += pts;
    factors.push({
      factor: 'Pregnant Women',
      count: pregnantWomen,
      points: pts,
      description: `${pregnantWomen} pregnant woman/women in immediate crisis`,
    });
  }

  // ── 2. Injured / Serious Medical Condition ─────────────────────────────────
  if (injured > 0) {
    const pts = Math.min(35, injured * 25);
    score += pts;
    factors.push({
      factor: 'Injuries / Critical Medical',
      count: injured,
      points: pts,
      description: `${injured} injured person(s) requiring emergency medical aid`,
    });
  }

  // ── 3. Children (<= 12 years) ──────────────────────────────────────────────
  if (children > 0) {
    const pts = Math.min(25, children * 12);
    score += pts;
    factors.push({
      factor: 'Children (<= 12 yrs)',
      count: children,
      points: pts,
      description: `${children} child/children at high risk`,
    });
  }

  // ── 4. Elderly (>= 60 years) ───────────────────────────────────────────────
  if (elderly > 0) {
    const pts = Math.min(20, elderly * 10);
    score += pts;
    factors.push({
      factor: 'Elderly Citizens (>= 60 yrs)',
      count: elderly,
      points: pts,
      description: `${elderly} elderly senior citizen(s) with limited mobility`,
    });
  }

  // ── 5. Needs Categorization ────────────────────────────────────────────────
  const normalizedNeeds = Array.isArray(needs)
    ? needs.map((n) => String(n).trim().toLowerCase())
    : [];

  if (normalizedNeeds.includes('rescue')) {
    score += 25;
    factors.push({
      factor: 'Emergency Extraction (Rescue)',
      points: 25,
      description: 'Immediate life risk requiring physical rescue/boat evacuation',
    });
  }

  if (normalizedNeeds.includes('medicine')) {
    score += 15;
    factors.push({
      factor: 'Medical / First Aid Need',
      points: 15,
      description: 'Acute medication, insulin, or first-aid supplies needed',
    });
  }

  if (normalizedNeeds.includes('water')) {
    score += 10;
    factors.push({
      factor: 'Drinking Water Need',
      points: 10,
      description: 'Severe hydration threat in flood-contaminated zone',
    });
  }

  if (normalizedNeeds.includes('food')) {
    score += 5;
    factors.push({
      factor: 'Food Rations Need',
      points: 5,
      description: 'Emergency food supplies requested',
    });
  }

  // ── 6. Group Size Scaling ──────────────────────────────────────────────────
  if (totalPeople > 1) {
    const pts = Math.min(15, Math.floor((totalPeople - 1) * 2));
    score += pts;
    factors.push({
      factor: 'Group Size Multiplier',
      count: totalPeople,
      points: pts,
      description: `Large cluster of ${totalPeople} affected individuals`,
    });
  }

  // ── 7. Disaster Keyword Heuristics ─────────────────────────────────────────
  const descLower = (description || '').toLowerCase();
  const criticalKeywords = [
    'trapped',
    'water rising',
    'drowning',
    'submerged',
    'bleeding',
    'unconscious',
    'infant',
    'rooftop',
    'collapsed',
    'oxygen',
  ];

  const matchedKeywords = criticalKeywords.filter((kw) => descLower.includes(kw));
  if (matchedKeywords.length > 0) {
    const pts = Math.min(15, matchedKeywords.length * 5);
    score += pts;
    factors.push({
      factor: 'Critical Situation Keywords',
      points: pts,
      description: `Emergency keywords detected: ${matchedKeywords.join(', ')}`,
    });
  }

  // ── 8. Normalize Score (5 to 100) ──────────────────────────────────────────
  const finalScore = Math.min(100, Math.max(5, Math.round(score)));

  // ── 9. Map to Standard Priority Tier ──────────────────────────────────────
  let priorityTier = 'Low';
  if (finalScore >= 70 || (normalizedNeeds.includes('rescue') && (injured > 0 || pregnantWomen > 0))) {
    priorityTier = 'Critical';
  } else if (finalScore >= 45 || normalizedNeeds.includes('rescue') || injured > 0) {
    priorityTier = 'High';
  } else if (finalScore >= 25) {
    priorityTier = 'Medium';
  } else {
    priorityTier = 'Low';
  }

  return {
    score: finalScore,
    priority: priorityTier,
    factors,
    vulnerabilities: {
      children,
      elderly,
      pregnantWomen,
      injured,
    },
  };
}

module.exports = {
  calculatePriorityScore,
};
