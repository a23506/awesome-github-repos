const fs = require("fs");
const path = require("path");

const API_TOKEN = process.env.API_TOKEN;
const GITHUB_NAME = process.env.GITHUB_NAME;

if (!API_TOKEN) {
  console.error("ERROR: API_TOKEN is not set.");
  process.exit(1);
}

if (!GITHUB_NAME) {
  console.error("ERROR: GITHUB_NAME is not set.");
  process.exit(1);
}

const API_HEADERS = {
  Authorization: `Bearer ${API_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "awesome-github-repos"
};

async function githubRequest(url) {
  const response = await fetch(url, {
    headers: API_HEADERS
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `GitHub API error ${response.status}: ${text}`
    );
  }

  return {
    data: await response.json(),
    headers: response.headers
  };
}

/**
 * 获取当前 Token 所属账号的全部 Starred repositories
 */
async function getAllStarredRepositories() {
  const repositories = [];

  let page = 1;

  while (true) {
    const url =
      `https://api.github.com/user/starred?per_page=100&page=${page}`;

    console.log(`Fetching starred repositories: page ${page}`);

    const { data } = await githubRequest(url);

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    repositories.push(...data);

    console.log(
      `Page ${page}: ${data.length} repositories`
    );

    if (data.length < 100) {
      break;
    }

    page++;
  }

  return repositories;
}

/**
 * 获取仓库语言
 */
function getLanguage(repo) {
  return repo.language || "Other";
}

/**
 * 将仓库按照语言分组
 *
 * 保持 GitHub API 返回的顺序。
 * 这样 Recently 分类可以继续按照 Star 顺序使用。
 */
function groupRepositoriesByLanguage(repositories) {
  const groups = {};

  for (const repo of repositories) {
    const language = getLanguage(repo);

    if (!groups[language]) {
      groups[language] = [];
    }

    groups[language].push(repo);
  }

  return groups;
}

/**
 * 清理 description
 */
function cleanDescription(description) {
  if (!description) {
    return "";
  }

  return String(description)
    .replace(/\r?\n/g, " ")
    .trim();
}

/**
 * 生成 data.json
 *
 * 格式：
 *
 * {
 *   "Python": [
 *     {...},
 *     {...}
 *   ],
 *   "JavaScript": [
 *     {...}
 *   ]
 * }
 */
function generateJson(groups) {
  return JSON.stringify(groups, null, 2) + "\n";
}

/**
 * 生成 data.md
 *
 * 保持原来的 README.ejs 风格。
 */
function generateMarkdown(groups) {
  let output = "";

  output += `# [![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/${GITHUB_NAME}) [![Awesome](https://badgen.net/static/GitHub/Repos/blue)](https://github.com/${GITHUB_NAME})\n`;

  output += "## Table of Contents\n\n";

  for (const language of Object.keys(groups)) {
    output += `## ${language}\n\n`;

    for (const repo of groups[language]) {
      const description = cleanDescription(repo.description);

      output += `- [${repo.full_name}](${repo.html_url})`;

      if (description) {
        output += ` - ${description}`;
      }

      output += "\n";
    }

    output += "\n";
  }

  return output;
}

/**
 * 主程序
 */
async function main() {
  console.log("========================================");
  console.log("Awesome GitHub Repos Generator");
  console.log("========================================");

  console.log(`GitHub account: ${GITHUB_NAME}`);

  const repositories =
    await getAllStarredRepositories();

  console.log("");
  console.log(
    `Total starred repositories: ${repositories.length}`
  );

  if (repositories.length === 0) {
    throw new Error(
      "No starred repositories were returned. " +
      "Check API_TOKEN permissions."
    );
  }

  const groups =
    groupRepositoriesByLanguage(repositories);

  const languages =
    Object.keys(groups);

  console.log(
    `Languages/categories: ${languages.length}`
  );

  console.log("");
  console.log("Repository statistics:");

  for (const language of languages) {
    console.log(
      `  ${language}: ${groups[language].length}`
    );
  }

  /**
   * 生成 data.json
   */
  const jsonContent =
    generateJson(groups);

  const jsonPath =
    path.resolve(process.cwd(), "data.json");

  fs.writeFileSync(
    jsonPath,
    jsonContent,
    "utf8"
  );

  console.log("");
  console.log(`Generated: ${jsonPath}`);

  /**
   * 生成 data.md
   */
  const markdownContent =
    generateMarkdown(groups);

  const markdownPath =
    path.resolve(process.cwd(), "data.md");

  fs.writeFileSync(
    markdownPath,
    markdownContent,
    "utf8"
  );

  console.log(`Generated: ${markdownPath}`);

  console.log("");
  console.log("Generation completed successfully.");
}

main().catch(error => {
  console.error("");
  console.error("Generation failed:");
  console.error(error);
  process.exit(1);
});
