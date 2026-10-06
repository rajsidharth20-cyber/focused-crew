export type Classification = 'SAFE' | 'POTENTIALLY_PROBLEMATIC' | 'HIGH_CONFIDENCE_VIOLATION';

// Only explicit targeted insults/threats are deterministic violations; ordinary
// discussion or a keyword alone must be evaluated in context.
export function clearTargetedAbuse(content: string): boolean {
  return /\b(?:you(?:'re| are)?|u|@\w+)\s+(?:a\s+)?(?:fucking\s+)?(?:idiot|moron|bastard|bitch|asshole)\b/i.test(content)
    || /\b(?:kill yourself|i(?:'ll| will) (?:kill|hurt) you|shut (?:the fuck )?up (?:you )?(?:idiot|bitch|moron))\b/i.test(content);
}

export function parseModeration(raw: string): { classification: Classification; reason: string; confidence: number } {
  const classification = raw.startsWith('HIGH_CONFIDENCE_VIOLATION') ? 'HIGH_CONFIDENCE_VIOLATION'
    : raw.startsWith('POTENTIALLY_PROBLEMATIC') ? 'POTENTIALLY_PROBLEMATIC' : 'SAFE';
  return {
    classification,
    reason: raw.replace(/^(HIGH_CONFIDENCE_VIOLATION|POTENTIALLY_PROBLEMATIC|SAFE)\s*[:\-]?\s*/, '').slice(0, 300) || 'Needs admin review',
    confidence: classification === 'HIGH_CONFIDENCE_VIOLATION' ? 0.95 : 0.65,
  };
}