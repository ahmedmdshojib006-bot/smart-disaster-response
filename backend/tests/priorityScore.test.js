const { calculatePriorityScore } = require('../utils/priorityCalculator');
const SOSRequest = require('../models/SOSRequest');

describe('Module 2 (Member-2): Automated Priority Scoring Engine', () => {
  it('should calculate critical score for pregnant women and injured victims needing rescue', () => {
    const result = calculatePriorityScore({
      vulnerabilities: {
        children: 2,
        elderly: 1,
        pregnantWomen: 1,
        injured: 2,
      },
      needs: ['rescue', 'medicine', 'water'],
      numberOfPeople: 6,
      description: 'Water rising fast, family trapped on roof with pregnant mother and injured grandfather',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.priority).toBe('Critical');
    expect(result.vulnerabilities.pregnantWomen).toBe(1);
    expect(result.vulnerabilities.injured).toBe(2);
    expect(result.vulnerabilities.children).toBe(2);

    const factorNames = result.factors.map((f) => f.factor);
    expect(factorNames).toContain('Pregnant Women');
    expect(factorNames).toContain('Injuries / Critical Medical');
    expect(factorNames).toContain('Children (<= 12 yrs)');
    expect(factorNames).toContain('Emergency Extraction (Rescue)');
  });

  it('should calculate high priority when only children and urgent needs exist', () => {
    const result = calculatePriorityScore({
      vulnerabilities: {
        children: 3,
        elderly: 0,
        pregnantWomen: 0,
        injured: 0,
      },
      needs: ['food', 'water'],
      numberOfPeople: 4,
      description: 'Stranded without drinking water',
    });

    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.priority).toBe('High');
  });

  it('should calculate lower priority for small groups with only food needs and no vulnerabilities', () => {
    const result = calculatePriorityScore({
      vulnerabilities: {
        children: 0,
        elderly: 0,
        pregnantWomen: 0,
        injured: 0,
      },
      needs: ['food'],
      numberOfPeople: 1,
      description: 'Requesting dry food packet',
    });

    expect(result.score).toBeLessThan(45);
    expect(['Low', 'Medium']).toContain(result.priority);
  });

  it('should detect critical disaster keywords and increase priority score', () => {
    const normal = calculatePriorityScore({
      vulnerabilities: { children: 1 },
      needs: ['rescue'],
      numberOfPeople: 2,
      description: 'Need boat assistance',
    });

    const urgent = calculatePriorityScore({
      vulnerabilities: { children: 1 },
      needs: ['rescue'],
      numberOfPeople: 2,
      description: 'Water rising rapidly, family trapped, roof about to be submerged',
    });

    expect(urgent.score).toBeGreaterThan(normal.score);
  });

  it('should correctly define priorityScore and vulnerability schema paths on SOSRequest model', () => {
    const paths = SOSRequest.schema.paths;
    expect(paths['priorityScore']).toBeDefined();
    expect(paths['vulnerabilities.children']).toBeDefined();
    expect(paths['vulnerabilities.elderly']).toBeDefined();
    expect(paths['vulnerabilities.pregnantWomen']).toBeDefined();
    expect(paths['vulnerabilities.injured']).toBeDefined();
    expect(paths['priorityFactors']).toBeDefined();
  });
});
