import { describe, it, expect } from "vitest";
import {
  normalizeGithubUrl,
  getGithubApiUrl,
  isGithubHost,
  getGithubHost,
  parseOwnerRepo,
  parsePrUrl,
  githubApi,
  getTokenCreationUrl,
} from "./github-url.js";

describe("normalizeGithubUrl", () => {
  it("returns default for null/undefined/empty", () => {
    expect(normalizeGithubUrl(null)).toBe("https://github.com");
    expect(normalizeGithubUrl(undefined)).toBe("https://github.com");
    expect(normalizeGithubUrl("")).toBe("https://github.com");
    expect(normalizeGithubUrl("  ")).toBe("https://github.com");
  });

  it("strips trailing slashes", () => {
    expect(normalizeGithubUrl("https://github.example.com/")).toBe("https://github.example.com");
    expect(normalizeGithubUrl("https://github.example.com///")).toBe("https://github.example.com");
  });

  it("adds https:// if missing", () => {
    expect(normalizeGithubUrl("github.example.com")).toBe("https://github.example.com");
  });

  it("preserves existing protocol", () => {
    expect(normalizeGithubUrl("https://github.example.com")).toBe("https://github.example.com");
  });
});

describe("getGithubApiUrl", () => {
  it("returns api.github.com for public GitHub", () => {
    expect(getGithubApiUrl(null)).toBe("https://api.github.com");
    expect(getGithubApiUrl("https://github.com")).toBe("https://api.github.com");
  });

  it("returns /api/v3 for GitHub Enterprise", () => {
    expect(getGithubApiUrl("https://github.example.com")).toBe("https://github.example.com/api/v3");
    expect(getGithubApiUrl("https://git.corp.io")).toBe("https://git.corp.io/api/v3");
  });
});

describe("isGithubHost", () => {
  it("matches public GitHub URLs", () => {
    expect(isGithubHost("https://github.com/owner/repo")).toBe(true);
    expect(isGithubHost("git@github.com:owner/repo.git")).toBe(true);
  });

  it("matches enterprise GitHub URLs", () => {
    expect(
      isGithubHost("https://github.example.com/owner/repo", "https://github.example.com"),
    ).toBe(true);
    expect(
      isGithubHost("git@github.example.com:owner/repo.git", "https://github.example.com"),
    ).toBe(true);
  });

  it("rejects mismatched hosts", () => {
    expect(isGithubHost("https://gitlab.com/owner/repo")).toBe(false);
    expect(isGithubHost("https://github.com/owner/repo", "https://github.example.com")).toBe(false);
  });
});

describe("getGithubHost", () => {
  it("extracts hostname", () => {
    expect(getGithubHost(null)).toBe("github.com");
    expect(getGithubHost("https://github.example.com")).toBe("github.example.com");
  });
});

describe("parseOwnerRepo", () => {
  it("parses public GitHub HTTPS URLs", () => {
    expect(parseOwnerRepo("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses public GitHub SSH URLs", () => {
    expect(parseOwnerRepo("git@github.com:owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses enterprise HTTPS URLs", () => {
    expect(
      parseOwnerRepo("https://github.example.com/myorg/myrepo", "https://github.example.com"),
    ).toEqual({ owner: "myorg", repo: "myrepo" });
  });

  it("parses enterprise SSH URLs", () => {
    expect(
      parseOwnerRepo("git@github.example.com:myorg/myrepo.git", "https://github.example.com"),
    ).toEqual({ owner: "myorg", repo: "myrepo" });
  });

  it("returns null for non-matching URLs", () => {
    expect(parseOwnerRepo("https://gitlab.com/owner/repo")).toBeNull();
    expect(
      parseOwnerRepo("https://github.com/owner/repo", "https://github.example.com"),
    ).toBeNull();
  });
});

describe("parsePrUrl", () => {
  it("parses public GitHub PR URLs", () => {
    expect(parsePrUrl("https://github.com/owner/repo/pull/42")).toEqual({
      owner: "owner",
      repo: "repo",
      prNumber: 42,
    });
  });

  it("parses enterprise PR URLs", () => {
    expect(
      parsePrUrl("https://github.example.com/org/repo/pull/99", "https://github.example.com"),
    ).toEqual({ owner: "org", repo: "repo", prNumber: 99 });
  });

  it("returns null for non-PR URLs", () => {
    expect(parsePrUrl("https://github.com/owner/repo")).toBeNull();
  });
});

describe("githubApi", () => {
  it("builds public GitHub API URLs", () => {
    const api = githubApi();
    expect(api.user()).toBe("https://api.github.com/user");
    expect(api.repo("owner", "repo")).toBe("https://api.github.com/repos/owner/repo");
    expect(api.pull("owner", "repo", 42)).toBe("https://api.github.com/repos/owner/repo/pulls/42");
  });

  it("builds enterprise GitHub API URLs", () => {
    const api = githubApi("https://github.example.com");
    expect(api.user()).toBe("https://github.example.com/api/v3/user");
    expect(api.repo("org", "app")).toBe("https://github.example.com/api/v3/repos/org/app");
    expect(api.checkRuns("org", "app", "abc123")).toBe(
      "https://github.example.com/api/v3/repos/org/app/commits/abc123/check-runs",
    );
  });

  it("builds userRepos URL with query params", () => {
    const api = githubApi();
    expect(api.userRepos("sort=pushed&per_page=20")).toBe(
      "https://api.github.com/user/repos?sort=pushed&per_page=20",
    );
  });
});

describe("getTokenCreationUrl", () => {
  it("generates public GitHub token URL", () => {
    expect(getTokenCreationUrl()).toContain("https://github.com/settings/tokens/new");
  });

  it("generates enterprise token URL", () => {
    expect(getTokenCreationUrl("https://github.example.com")).toContain(
      "https://github.example.com/settings/tokens/new",
    );
  });
});
