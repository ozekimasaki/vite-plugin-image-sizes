#!/usr/bin/env node
// Auto-review / auto-merge bot for all repositories owned by the configured OWNER.
// Scans open PRs, identifies "minor" changes, approves them, and then merges or
// enables GitHub auto-merge when all checks pass.

const TOKEN = process.env.GITHUB_TOKEN || process.env.AUTO_MERGE_TOKEN;
const OWNER = process.env.OWNER || 'ozekimasaki';
const DRY_RUN = (process.env.DRY_RUN || '').toLowerCase() === 'true';

const TRUSTED_AUTHORS = (process.env.TRUSTED_AUTHORS || 'dependabot[bot],renovate[bot]')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const AUTO_MERGE_LABELS = (process.env.AUTO_MERGE_LABELS || 'auto-merge,dependencies')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MINOR_KEYWORDS = (process.env.MINOR_KEYWORDS ||
  'Bump,bump,update,Update,chore,docs,style,ci,refactor,fix(deps)')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_FILES = parseInt(process.env.MAX_FILES || '10', 10);
const REPO_CONCURRENCY = parseInt(process.env.REPO_CONCURRENCY || '5', 10);
const MERGE_METHOD = process.env.MERGE_METHOD || 'squash';

const ALLOWED_PATTERNS = (process.env.ALLOWED_PATTERNS ||
  '**/package.json,**/package-lock.json,**/pnpm-lock.yaml,**/yarn.lock,**/bun.lockb,' +
  '**/Cargo.toml,**/Cargo.lock,**/pyproject.toml,**/poetry.lock,**/requirements*.txt,' +
  '**/Pipfile,**/Pipfile.lock,**/go.mod,**/go.sum,**/Gemfile,**/Gemfile.lock,' +
  '**/composer.json,**/composer.lock,**/*.md,**/LICENSE,**/CHANGELOG*,' +
  '**/README*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const BLOCKED_PATTERNS = (process.env.BLOCKED_PATTERNS ||
  'src/**,lib/**,app/**,bin/**,packages/*/src/**,test/**,tests/**,__tests__/**,' +
  '.github/workflows/**,**/*.js,**/*.ts,**/*.jsx,**/*.tsx,**/*.py,**/*.cs,**/*.cpp,' +
  '**/*.c,**/*.java,**/*.go,**/*.rs,**/*.rb,**/*.php,**/*.swift,**/*.kt,**/*.scala,' +
  '**/*.sh,**/*.bat,**/*.ps1,**/*.sql,**/*.env,**/*.secret,**/*.key,**/*.pem,' +
  '**/*.test.*,**/*.spec.*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_RE = ALLOWED_PATTERNS.map(globToRegex);
const BLOCKED_RE = BLOCKED_PATTERNS.map(globToRegex);

const FAILED_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
const OK_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function globToRegex(pattern) {
  let re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  re = re.replace(/\*\*/g, '\u0000');
  re = re.replace(/\*/g, '[^/]*');
  re = re.replace(/\?/g, '[^/]');
  re = re.replace(/\u0000/g, '.*');
  return new RegExp(`^${re}$`);
}

function isAllowedFile(filename) {
  const allowed = ALLOWED_PATTERNS.some((p, i) => ALLOWED_RE[i].test(filename) || (!p.includes('/') && ALLOWED_RE[i].test(filename.split('/').pop())));
  const blocked = BLOCKED_PATTERNS.some((p, i) => BLOCKED_RE[i].test(filename) || (!p.includes('/') && BLOCKED_RE[i].test(filename.split('/').pop())));
  return allowed && !blocked;
}

async function githubRequest(url, init = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ozekimasaki-auto-merge',
        ...(init.headers || {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });

    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    const retryAfter = res.headers.get('retry-after');

    if ((res.status === 403 || res.status === 429) && remaining === '0' && reset) {
      const wait = Math.max(parseInt(reset, 10) * 1000 - Date.now(), 0) + 1000;
      console.warn(`Rate limit hit. Sleeping ${wait}ms...`);
      await sleep(wait);
      continue;
    }

    if ((res.status === 403 || res.status === 429) && retryAfter) {
      const wait = parseInt(retryAfter, 10) * 1000;
      console.warn(`Retry-After ${wait}ms...`);
      await sleep(wait);
      continue;
    }

    return res;
  }
  throw new Error(`GitHub API request failed after retries: ${url}`);
}

async function fetchJson(path) {
  const res = await githubRequest(`https://api.github.com${path}`);
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`GitHub API ${path} returned ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function* paginate(path) {
  let url = `https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=100`;
  while (url) {
    const res = await githubRequest(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${url} returned ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = await res.json();
    yield data;
    const link = res.headers.get('link') || '';
    const next = link
      .split(',')
      .find((part) => part.includes('rel="next"'));
    url = next ? next.match(/<([^>]+)>/)[1] : null;
  }
}

async function fetchAll(path) {
  const out = [];
  for await (const batch of paginate(path)) {
    out.push(...batch);
  }
  return out;
}

async function getAuthUser() {
  return fetchJson('/user');
}

async function listRepos() {
  const user = await getAuthUser();
  let repos;
  if (user.login === OWNER) {
    repos = await fetchAll('/user/repos?affiliation=owner&sort=updated');
  } else {
    try {
      repos = await fetchAll(`/users/${OWNER}/repos?sort=updated`);
    } catch (err) {
      if (err.status === 404) {
        repos = await fetchAll(`/orgs/${OWNER}/repos?sort=updated`);
      } else {
        throw err;
      }
    }
  }
  return repos.filter((r) => r.owner.login === OWNER && !r.fork && !r.archived);
}

function isMinorPr(pr) {
  if (pr.draft || pr.merged || pr.state !== 'open') return false;

  const author = pr.user?.login;
  if (TRUSTED_AUTHORS.includes(author)) return true;

  const labels = (pr.labels || []).map((l) => l.name.toLowerCase());
  if (AUTO_MERGE_LABELS.some((l) => labels.includes(l))) return true;

  const title = pr.title.toLowerCase();
  if (MINOR_KEYWORDS.some((kw) => title.includes(kw))) return true;

  return false;
}

async function getPrFiles(owner, repo, number) {
  return fetchAll(`/repos/${owner}/${repo}/pulls/${number}/files`);
}

async function getPrReviews(owner, repo, number) {
  return fetchAll(`/repos/${owner}/${repo}/pulls/${number}/reviews`);
}

async function getCheckRuns(owner, repo, sha) {
  const data = await fetchJson(`/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`);
  return data.check_runs || [];
}

function checksPassed(checkRuns) {
  if (!checkRuns.length) return true; // nothing to block on
  for (const run of checkRuns) {
    if (run.status !== 'completed') return false;
    if (FAILED_CONCLUSIONS.has(run.conclusion)) return false;
    if (!OK_CONCLUSIONS.has(run.conclusion)) return false;
  }
  return true;
}

function fileChangesOk(files) {
  if (files.length > MAX_FILES) {
    return { ok: false, reason: `${files.length} files changed (max ${MAX_FILES})` };
  }
  for (const file of files) {
    const filename = file.filename;
    if (!isAllowedFile(filename)) {
      return { ok: false, reason: `disallowed file: ${filename}` };
    }
  }
  return { ok: true };
}

async function approvePr(owner, repo, number) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would approve PR #${number}`);
    return;
  }
  await githubRequest(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: 'POST',
    body: {
      event: 'APPROVE',
      body: 'Auto-approved by the auto-merge bot 🤖\n\nMinor dependency / docs update.',
    },
  });
  console.log(`  Approved PR #${number}`);
}

async function mergePr(owner, repo, number, sha) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would merge PR #${number}`);
    return { merged: true };
  }
  const res = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/merge`, {
    method: 'PUT',
    body: { merge_method: MERGE_METHOD, sha },
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Merge failed (${res.status}): ${text.slice(0, 500)}`);
  }
  if (res.ok) {
    const body = await res.json();
    console.log(`  Merged PR #${number}: ${body.message || 'ok'}`);
    return body;
  }
  return null;
}

async function enableAutoMerge(owner, repo, number) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would enable auto-merge for PR #${number}`);
    return;
  }
  const res = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}/auto-merge`, {
    method: 'PUT',
    body: { merge_method: MERGE_METHOD },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Enable auto-merge failed (${res.status}): ${text.slice(0, 500)}`);
  }
  console.log(`  Enabled auto-merge for PR #${number}`);
}

async function processRepo(repo, authUser) {
  const { name: repoName } = repo;
  let prs;
  try {
    prs = await fetchAll(`/repos/${OWNER}/${repoName}/pulls?state=open&sort=updated`);
  } catch (err) {
    console.error(`Failed to list PRs for ${repoName}: ${err.message}`);
    return;
  }

  if (!prs.length) return;
  console.log(`\n[${repoName}] ${prs.length} open PR(s)`);

  for (const pr of prs) {
    const number = pr.number;
    const title = pr.title;
    const author = pr.user?.login;

    console.log(`  PR #${number} by ${author}: ${title}`);

    if (!isMinorPr(pr)) {
      console.log('    -> Not a minor PR. Skipping.');
      continue;
    }

    if (pr.auto_merge) {
      console.log('    -> Auto-merge already enabled. Skipping.');
      continue;
    }

    try {
      const files = await getPrFiles(OWNER, repoName, number);
      const fileCheck = fileChangesOk(files);
      if (!fileCheck.ok) {
        console.log(`    -> Skipping: ${fileCheck.reason}`);
        continue;
      }

      const checkRuns = await getCheckRuns(OWNER, repoName, pr.head.sha);
      if (!checksPassed(checkRuns)) {
        console.log('    -> Checks not complete or failed. Skipping.');
        continue;
      }

      const reviews = await getPrReviews(OWNER, repoName, number);
      const alreadyApproved = reviews.some(
        (r) => r.user?.login === authUser.login && r.state === 'APPROVED'
      );

      if (!alreadyApproved) {
        await approvePr(OWNER, repoName, number);
      } else {
        console.log('    -> Already approved by this bot.');
      }

      // Re-fetch the latest PR state after approval.
      const freshPr = await fetchJson(`/repos/${OWNER}/${repoName}/pulls/${number}`);

      if (freshPr.merged) {
        console.log('    -> Already merged.');
        continue;
      }

      if (freshPr.mergeable === false) {
        console.log('    -> PR is not mergeable (conflict). Skipping.');
        continue;
      }

      if (freshPr.mergeable_state === 'clean' && freshPr.mergeable) {
        await mergePr(OWNER, repoName, number, pr.head.sha);
      } else if (!freshPr.auto_merge) {
        await enableAutoMerge(OWNER, repoName, number);
      }
    } catch (err) {
      console.error(`    -> Error processing PR #${number}: ${err.message}`);
    }
  }
}

async function run() {
  if (!TOKEN) {
    console.error('Missing GITHUB_TOKEN or AUTO_MERGE_TOKEN environment variable.');
    process.exit(1);
  }

  const authUser = await getAuthUser();
  console.log(`Authenticated as: ${authUser.login}`);
  console.log(`Owner to scan: ${OWNER}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);

  const repos = await listRepos();
  console.log(`Found ${repos.length} repositories for ${OWNER}`);

  // Process repos with limited concurrency.
  const queue = [...repos];
  const workers = new Array(REPO_CONCURRENCY).fill(null).map(async () => {
    while (queue.length) {
      const repo = queue.shift();
      await processRepo(repo, authUser);
    }
  });
  await Promise.all(workers);

  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
