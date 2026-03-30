import type { OAuthProvider, OAuthTokens, OAuthUser } from "./provider.js";
import { getCallbackUrl } from "./provider.js";
import { getGithubApiUrl, normalizeGithubUrl } from "@optio/shared";

export class GitHubOAuthProvider implements OAuthProvider {
  name = "github";

  private get clientId(): string {
    return process.env.GITHUB_OAUTH_CLIENT_ID ?? "";
  }

  private get clientSecret(): string {
    return process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "";
  }

  /** Base URL of the GitHub instance (e.g., "https://github.example.com"). */
  private get githubUrl(): string {
    return normalizeGithubUrl(process.env.GITHUB_OAUTH_BASE_URL);
  }

  /** REST API base URL (e.g., "https://api.github.com" or "https://ghe.example.com/api/v3"). */
  private get apiUrl(): string {
    return getGithubApiUrl(process.env.GITHUB_OAUTH_BASE_URL);
  }

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: getCallbackUrl("github"),
      scope: "read:user user:email",
      state,
    });
    return `${this.githubUrl}/login/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const res = await fetch(`${this.githubUrl}/login/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: getCallbackUrl("github"),
      }),
    });
    if (!res.ok) {
      throw new Error(`GitHub token exchange failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as Record<string, string>;
    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description ?? data.error}`);
    }
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async fetchUser(accessToken: string): Promise<OAuthUser> {
    const [userRes, emailsRes] = await Promise.all([
      fetch(`${this.apiUrl}/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      }),
      fetch(`${this.apiUrl}/user/emails`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      }),
    ]);

    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.status} ${userRes.statusText}`);
    }
    if (!emailsRes.ok) {
      throw new Error(`GitHub emails fetch failed: ${emailsRes.status} ${emailsRes.statusText}`);
    }
    const user = (await userRes.json()) as Record<string, any>;
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;

    const primaryEmail =
      emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? "";

    return {
      externalId: String(user.id),
      email: primaryEmail || user.email || "",
      displayName: user.name || user.login || "",
      avatarUrl: user.avatar_url,
    };
  }
}
