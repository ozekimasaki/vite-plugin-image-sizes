export function pickFirstFromSrcOrSrcset(raw: string): string {
  return raw.split(',')[0].trim().split(' ')[0];
}


