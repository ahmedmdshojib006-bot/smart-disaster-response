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

  const finalScore = Math.min(100, Math.max(5, Math.round(score)));

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
