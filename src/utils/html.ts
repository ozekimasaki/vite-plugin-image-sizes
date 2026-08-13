export function pickFirstFromSrcOrSrcset(raw: string): string {
  const firstCandidate = raw.split(',')[0] ?? '';
  return (firstCandidate.trim().split(/\s+/)[0] ?? '');
}


