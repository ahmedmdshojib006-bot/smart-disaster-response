// src/utils/priorityCalculatorClient.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side Priority Score Calculator for instant live preview (Member-2)
// ─────────────────────────────────────────────────────────────────────────────

export function calculatePriorityScoreClient({
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

  if (pregnantWomen > 0) {
    const pts = Math.min(30, pregnantWomen * 25);
    score += pts;
    factors.push({
      factor: 'Pregnant Women',
      points: pts,
      desc: `${pregnantWomen} pregnant woman/women in danger`,
    });
  }

  if (injured > 0) {
    const pts = Math.min(35, injured * 25);
    score += pts;
    factors.push({
      factor: 'Injured / Medical Emergency',
      points: pts,
      desc: `${injured} injured person(s) needing care`,
    });
  }

  if (children > 0) {
    const pts = Math.min(25, children * 12);
    score += pts;
    factors.push({
      factor: 'Children (<= 12 yrs)',
      points: pts,
      desc: `${children} child/children trapped`,
    });
  }

  if (elderly > 0) {
    const pts = Math.min(20, elderly * 10);
    score += pts;
    factors.push({
      factor: 'Elderly (>= 60 yrs)',
      points: pts,
      desc: `${elderly} senior citizen(s) stranded`,
    });
  }

  const normalizedNeeds = Array.isArray(needs)
    ? needs.map((n) => String(n).trim().toLowerCase())
    : [];

  if (normalizedNeeds.includes('rescue')) {
    score += 25;
    factors.push({
      factor: 'Emergency Extraction (Rescue)',
      points: 25,
      desc: 'Immediate physical rescue / boat needed',
    });
  }

  if (normalizedNeeds.includes('medicine')) {
    score += 15;
    factors.push({
      factor: 'Medical / First Aid',
      points: 15,
      desc: 'Emergency medication requested',
    });
  }

  if (normalizedNeeds.includes('water')) {
    score += 10;
    factors.push({
      factor: 'Drinking Water',
      points: 10,
      desc: 'Potable water dehydration threat',
    });
  }

  if (normalizedNeeds.includes('food')) {
    score += 5;
    factors.push({
      factor: 'Food Rations',
      points: 5,
      desc: 'Emergency food required',
    });
  }

  if (totalPeople > 1) {
    const pts = Math.min(15, Math.floor((totalPeople - 1) * 2));
    score += pts;
    factors.push({
      factor: 'Group Size Multiplier',
      points: pts,
      desc: `${totalPeople} people affected in group`,
    });
  }

  const descLower = (description || '').toLowerCase();
  const criticalKeywords = ['trapped', 'water rising', 'drowning', 'submerged', 'bleeding', 'unconscious', 'roof', 'collapsed'];
  const matched = criticalKeywords.filter((kw) => descLower.includes(kw));
  if (matched.length > 0) {
    const pts = Math.min(15, matched.length * 5);
    score += pts;
    factors.push({
      factor: 'Emergency Keyword Triggers',
      points: pts,
      desc: `Critical triggers: ${matched.join(', ')}`,
    });
  }

  const finalScore = Math.min(100, Math.max(5, Math.round(score)));

  let priority = 'Low';
  if (finalScore >= 70 || (normalizedNeeds.includes('rescue') && (injured > 0 || pregnantWomen > 0))) {
    priority = 'Critical';
  } else if (finalScore >= 45 || normalizedNeeds.includes('rescue') || injured > 0) {
    priority = 'High';
  } else if (finalScore >= 25) {
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  return {
    score: finalScore,
    priority,
    factors,
    vulnerabilities: { children, elderly, pregnantWomen, injured },
  };
}
