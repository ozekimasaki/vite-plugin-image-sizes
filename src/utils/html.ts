export function pickFirstFromSrcOrSrcset(raw: string): string {
  const firstCandidate = raw.split(',')[0] ?? '';
  return firstCandidate.trim().split(/\s+/)[0] ?? '';
}

/** cheerio を起動する前に、対象タグが無い HTML を弾く */
export function htmlMayContainTags(html: string, tags: readonly string[]): boolean {
  for (const tag of tags) {
    if (html.includes(`<${tag}`)) {
      return true;
    }
  }
  return false;
}
