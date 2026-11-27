const TRUST_DELTAS = {
  UPVOTE_RECEIVED: 2,
  COMMUNITY_VERIFIED_BONUS: 4,
  OFFICIAL_VERIFIED_BONUS: 6,
  VERIFICATION_CAST: 1,
  FAKE_THRESHOLD_PENALTY: -10,
  OFFICIAL_REJECTED_PENALTY: -15,
};

const clampScore = (score) => {
  const num = Number(score);
  if (Number.isNaN(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const getTrustTier = (score) => {
  const safeScore = clampScore(score);

  if (safeScore >= 85) {
    return {
      tier: 'Trusted Guardian',
      label: 'Trusted Guardian',
      color: '#065f46',
      bgColor: '#d1fae5',
      borderColor: '#6ee7b7',
      badgeIcon: '🛡️',
      weight: 1.5,
    };
  }
  if (safeScore >= 65) {
    return {
      tier: 'Verified Reporter',
      label: 'Verified Reporter',
      color: '#1e40af',
      bgColor: '#dbeafe',
      borderColor: '#93c5fd',
      badgeIcon: '✅',
      weight: 1.2,
    };
  }
  if (safeScore >= 40) {
    return {
      tier: 'Community Member',
      label: 'Community Member',
      color: '#334155',
      bgColor: '#f1f5f9',
      borderColor: '#cbd5e1',
      badgeIcon: '👤',
      weight: 1.0,
    };
  }
  if (safeScore >= 20) {
    return {
      tier: 'Low Trust',
      label: 'Low Trust',
      color: '#9a3412',
      bgColor: '#ffedd5',
      borderColor: '#fdba74',
      badgeIcon: '⚠️',
      weight: 0.6,
    };
  }
  return {
    tier: 'Flagged Reporter',
    label: 'Flagged Reporter',
    color: '#991b1b',
    bgColor: '#fee2e2',
    borderColor: '#fca5a5',
    badgeIcon: '🚫',
    weight: 0.3,
  };
};

const calculateCredibilityScore = ({
  reporterTrustScore = 50,
  hasPhoto = false,
  upvotesCount = 0,
  verificationsCount = 0,
  officialVerificationsCount = 0,
  fakeFlagsCount = 0,
  status = 'Pending',
}) => {
  const baseTrust = Math.round(clampScore(reporterTrustScore) * 0.45);
  const photoBonus = hasPhoto ? 15 : 0;
  const upvotePoints = Math.min(20, Math.max(0, upvotesCount) * 5);
  const verifyPoints = Math.min(
    25,
    Math.max(0, verificationsCount) * 8 + Math.max(0, officialVerificationsCount) * 7
  );

  let statusBonus = 0;
  if (status === 'Verified') statusBonus = 15;
  else if (status === 'Community Verified') statusBonus = 8;

  const fakePenalty =
    Math.max(0, fakeFlagsCount) * 15 + (status === 'Rejected' ? 35 : 0);

  return clampScore(
    baseTrust + photoBonus + upvotePoints + verifyPoints + statusBonus - fakePenalty
  );
};

module.exports = {
  TRUST_DELTAS,
  clampScore,
  getTrustTier,
  calculateCredibilityScore,
};
