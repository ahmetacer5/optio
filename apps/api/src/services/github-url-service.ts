import { retrieveSecretWithFallback, retrieveSecret } from "./secret-service.js";

/**
 * Retrieve the configured GitHub instance URL.
 *
 * Checks the `GITHUB_URL` secret (workspace-scoped then global).
 * Returns `null` if not configured, which callers should treat as
 * public GitHub (https://github.com).
 */
export async function getStoredGithubUrl(workspaceId?: string | null): Promise<string | null> {
  try {
    if (workspaceId) {
      return await retrieveSecretWithFallback("GITHUB_URL", "global", workspaceId);
    }
    return await retrieveSecret("GITHUB_URL");
  } catch {
    return null;
  }
}
