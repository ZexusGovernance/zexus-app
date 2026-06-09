// Client-safe constants/labels for Emergency Call verdicts.
// Kept free of any server-only imports (no supabase) so UI components can use it.

export const EMERGENCY_VERDICT_TITLE  = 'Emergency Call — Community Verdict'
export const EMERGENCY_RESPONSE_TITLE = 'Response to Emergency Call'

/** True when a voting post is an Emergency Call verdict (vs a milestone vote). */
export function isEmergencyVerdict(title?: string | null): boolean {
  return title === EMERGENCY_VERDICT_TITLE
}

// In a milestone vote, confirm/dispute means "was the milestone delivered".
// In an Emergency Call verdict it means "did the project resolve the concern".
// These labels make that explicit so voters don't read a bare "Confirm/Dispute".
export function verdictVoteLabel(side: 'confirm' | 'dispute', voted: boolean): string {
  if (side === 'confirm') return voted ? 'Voted: Resolved' : 'Resolved'
  return voted ? 'Voted: Unresolved' : 'Unresolved'
}
