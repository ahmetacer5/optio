/**
 * Utilities for working with GitHub URLs, including GitHub Enterprise support.
 *
 * The default GitHub host is `https://github.com` with API at `https://api.github.com`.
 * For GitHub Enterprise, the API lives at `{baseUrl}/api/v3`.
 */

const DEFAULT_GITHUB_URL = "https://github.com";
const PUBLIC_GITHUB_API = "https://api.github.com";

/**
 * Normalize a GitHub base URL: trim, ensure https://, remove trailing slashes.
 */
export function normalizeGithubUrl(url?: string | null): string {
  if (!url || !url.trim()) return DEFAULT_GITHUB_URL;
  let u = url.trim().replace(/\/+$/, "");
  // Ensure protocol
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u.replace(/\/+$/, "");
}

/**
 * Derive the GitHub REST API base URL from a GitHub instance URL.
 *
 * - `https://github.com` → `https://api.github.com`
 * - `https://github.example.com` → `https://github.example.com/api/v3`
 */
export function getGithubApiUrl(githubUrl?: string | null): string {
  const base = normalizeGithubUrl(githubUrl);
  // Public GitHub has a dedicated API subdomain
  if (base === DEFAULT_GITHUB_URL || base === "http://github.com") {
    return PUBLIC_GITHUB_API;
  }
  // GitHub Enterprise uses /api/v3 path
  return `${base}/api/v3`;
}

/**
 * Check whether a given URL (repo URL, PR URL, etc.) belongs to the configured
 * GitHub instance.
 *
 * Compares hostnames, case-insensitive.
 */
export function isGithubHost(url: string, githubUrl?: string | null): boolean {
  const base = normalizeGithubUrl(githubUrl);
  try {
    const urlHost = new URL(url.replace(/^[\w-]+@([^:]+):/, "https://$1/")).hostname.toLowerCase();
    const ghHost = new URL(base).hostname.toLowerCase();
    return urlHost === ghHost;
  } catch {
    return false;
  }
}

/**
 * Extract the hostname from a GitHub base URL.
 */
export function getGithubHost(githubUrl?: string | null): string {
  const base = normalizeGithubUrl(githubUrl);
  try {
    return new URL(base).hostname;
  } catch {
    return "github.com";
  }
}

/**
 * Parse owner and repo from a repository URL, supporting both public GitHub
 * and GitHub Enterprise hosts.
 *
 * Handles: HTTPS URLs, SSH shorthand (git@host:owner/repo), SSH protocol URLs.
 */
export function parseOwnerRepo(
  repoUrl: string,
  githubUrl?: string | null,
): { owner: string; repo: string } | null {
  const host = getGithubHost(githubUrl);
  // Escape dots for regex
  const hostPattern = host.replace(/\./g, "\\.");

  // Match the host in the URL, then capture owner/repo
  const re = new RegExp(`${hostPattern}[/:]([^/]+)\\/([^/.]+)`, "i");
  const match = repoUrl.match(re);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Parse owner, repo, and PR number from a pull request URL.
 */
export function parsePrUrl(
  prUrl: string,
  githubUrl?: string | null,
): { owner: string; repo: string; prNumber: number } | null {
  const host = getGithubHost(githubUrl);
  const hostPattern = host.replace(/\./g, "\\.");
  const re = new RegExp(`${hostPattern}\\/([^/]+)\\/([^/]+)\\/pull\\/(\\d+)`, "i");
  const match = prUrl.match(re);
  if (!match) return null;
  return { owner: match[1], repo: match[2], prNumber: parseInt(match[3], 10) };
}

/**
 * Build common GitHub REST API endpoint URLs.
 */
export function githubApi(githubUrl?: string | null) {
  const apiBase = getGithubApiUrl(githubUrl);

  return {
    /** GET /user */
    user: () => `${apiBase}/user`,

    /** GET /user/repos */
    userRepos: (params?: string) => `${apiBase}/user/repos${params ? `?${params}` : ""}`,

    /** GET /repos/{owner}/{repo} */
    repo: (owner: string, repo: string) => `${apiBase}/repos/${owner}/${repo}`,

    /** GET /repos/{owner}/{repo}/contents/ */
    repoContents: (owner: string, repo: string) => `${apiBase}/repos/${owner}/${repo}/contents/`,

    /** GET /repos/{owner}/{repo}/pulls */
    pulls: (owner: string, repo: string, params?: string) =>
      `${apiBase}/repos/${owner}/${repo}/pulls${params ? `?${params}` : ""}`,

    /** GET /repos/{owner}/{repo}/pulls/{number} */
    pull: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/pulls/${number}`,

    /** PUT /repos/{owner}/{repo}/pulls/{number}/merge */
    pullMerge: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/pulls/${number}/merge`,

    /** GET /repos/{owner}/{repo}/pulls/{number}/reviews */
    pullReviews: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/pulls/${number}/reviews`,

    /** GET /repos/{owner}/{repo}/pulls/{number}/comments */
    pullComments: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/pulls/${number}/comments`,

    /** GET /repos/{owner}/{repo}/commits/{sha}/check-runs */
    checkRuns: (owner: string, repo: string, sha: string) =>
      `${apiBase}/repos/${owner}/${repo}/commits/${sha}/check-runs`,

    /** GET /repos/{owner}/{repo}/issues */
    issues: (owner: string, repo: string, params?: string) =>
      `${apiBase}/repos/${owner}/${repo}/issues${params ? `?${params}` : ""}`,

    /** POST /repos/{owner}/{repo}/issues/{number}/comments */
    issueComments: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/issues/${number}/comments`,

    /** PATCH /repos/{owner}/{repo}/issues/{number} */
    issue: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/issues/${number}`,

    /** POST /repos/{owner}/{repo}/labels */
    labels: (owner: string, repo: string) => `${apiBase}/repos/${owner}/${repo}/labels`,

    /** POST /repos/{owner}/{repo}/issues/{number}/labels */
    issueLabels: (owner: string, repo: string, number: number) =>
      `${apiBase}/repos/${owner}/${repo}/issues/${number}/labels`,

    /** The raw API base URL, for custom paths */
    base: apiBase,
  };
}

/**
 * Build the URL for creating a new personal access token on the GitHub instance.
 */
export function getTokenCreationUrl(githubUrl?: string | null): string {
  const base = normalizeGithubUrl(githubUrl);
  return `${base}/settings/tokens/new?scopes=repo,read:org&description=Optio+Agent`;
}

/**
 * Extract the `owner/repo` portion from a repository URL.
 *
 * Falls back to stripping the protocol/host prefix for non-matching URLs.
 * Used for display and matching purposes.
 */
export function extractRepoFullName(repoUrl: string, githubUrl?: string | null): string {
  const parsed = parseOwnerRepo(repoUrl, githubUrl);
  if (parsed) return `${parsed.owner}/${parsed.repo}`;
  // Fallback: strip protocol + host + any leading slash
  return repoUrl
    .replace(/^(https?:\/\/|ssh:\/\/|[\w-]+@)/, "")
    .replace(/^[^/]+[/:]/, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
}
