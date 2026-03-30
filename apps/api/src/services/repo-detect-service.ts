import { parseOwnerRepo, githubApi } from "@optio/shared";
import { logger } from "../logger.js";

interface DetectedConfig {
  imagePreset: string;
  languages: string[];
  testCommand?: string;
}

/**
 * Detect the appropriate image preset and test command by checking
 * the GitHub API for files in the repo root.
 *
 * Supports GitHub Enterprise when githubUrl is provided.
 */
export async function detectRepoConfig(
  repoUrl: string,
  githubToken: string,
  githubUrl?: string | null,
): Promise<DetectedConfig> {
  const parsed = parseOwnerRepo(repoUrl, githubUrl);
  if (!parsed) return { imagePreset: "base", languages: [] };
  const { owner, repo } = parsed;

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    "User-Agent": "Optio",
  };

  const api = githubApi(githubUrl);

  try {
    const res = await fetch(api.repoContents(owner, repo), { headers });
    if (!res.ok) return { imagePreset: "base", languages: [] };

    const files = (await res.json()) as Array<{ name: string; type: string }>;
    const fileNames = new Set(files.map((f) => f.name));

    const languages: string[] = [];
    let testCommand: string | undefined;

    // Detect languages by presence of config files
    if (fileNames.has("Cargo.toml")) {
      languages.push("rust");
      testCommand = testCommand ?? "cargo test";
    }
    if (fileNames.has("package.json")) {
      languages.push("node");
      testCommand = testCommand ?? "npm test";
    }
    if (fileNames.has("go.mod")) {
      languages.push("go");
      testCommand = testCommand ?? "go test ./...";
    }
    if (
      fileNames.has("pyproject.toml") ||
      fileNames.has("setup.py") ||
      fileNames.has("requirements.txt")
    ) {
      languages.push("python");
      testCommand = testCommand ?? "pytest";
    }
    if (fileNames.has("Gemfile")) {
      languages.push("ruby");
    }
    if (fileNames.has("pom.xml") || fileNames.has("build.gradle")) {
      languages.push("java");
    }

    // Choose image preset
    let imagePreset = "base";
    if (languages.length > 1) {
      imagePreset = "full";
    } else if (languages.includes("rust")) {
      imagePreset = "rust";
    } else if (languages.includes("node")) {
      imagePreset = "node";
    } else if (languages.includes("go")) {
      imagePreset = "go";
    } else if (languages.includes("python")) {
      imagePreset = "python";
    }

    logger.info({ repoUrl, imagePreset, languages, testCommand }, "Auto-detected repo config");
    return { imagePreset, languages, testCommand };
  } catch (err) {
    logger.warn({ err, repoUrl }, "Failed to detect repo config");
    return { imagePreset: "base", languages: [] };
  }
}
