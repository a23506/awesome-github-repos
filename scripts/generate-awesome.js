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

const API_URL = "https://api.github.com/user/starred?per_page=100";

async function githubRequest(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "awesome-github-repos"
    }
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

    if (data.length < 100) {
      break;
    }

    page++;
  }

  return repositories;
}

function getLanguage(repo) {
  return repo.language || "miscellaneous";
}

function sortRepositories(repositories) {
  const groups = {};

  for (const repo of repositories) {
    const language = getLanguage(repo);

    if (!groups[language]) {
      groups[language] = [];
    }

    groups[language].push(repo);
  }

  const sortedGroups = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([language, repos]) => {
      repos.sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

      return [language, repos];
    });

  return sortedGroups;
}

function escapeMarkdown(text) {
  if (!text) {
    return "";

  }

  return String(text)
    .replace(/\r?\n/g, " ")
    .trim();
}

function generateMarkdown(groups) {
  let output = "";

  output += `# [![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/${GITHUB_NAME}) [![Awesome](https://badgen.net/static/GitHub/Repos/blue)](https://github.com/${GITHUB_NAME})\n`;

  output += "## Table of Contents\n\n";

  for (const [language] of groups) {
    output += `  * ${language}\n`;
  }

  output += "\n";

  for (const [language, repositories] of groups) {
    output += `## ${language}\n\n`;

    for (const repo of repositories) {
      const description = escapeMarkdown(repo.description);

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

async function main() {
  console.log("Starting awesome list generation...");

  const repositories = await getAllStarredRepositories();

  console.log(
    `Found ${repositories.length} starred repositories.`
  );

  const groups = sortRepositories(repositories);

  console.log(
    `Found ${groups.length} languages/categories.`
  );

  const markdown = generateMarkdown(groups);

  const outputPath = path.resolve(
    process.cwd(),
    "data.md"
  );

  fs.writeFileSync(
    outputPath,
    markdown,
    "utf8"
  );

  console.log(`Generated: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
