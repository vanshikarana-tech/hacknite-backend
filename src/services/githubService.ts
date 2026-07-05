import axios from 'axios';

const ELIGIBLE_EXTENSIONS = ['.html', '.jsx', '.tsx', '.js'];
const MAX_FILES = 200;

interface GitHubFile {
  path: string;
  content: string;
}

interface GitHubTreeItem {
  path: string;
  type: string;
  sha: string;
  url: string;
}

function getGitHubHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function isEligibleFile(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.'));
  return ELIGIBLE_EXTENSIONS.includes(ext.toLowerCase());
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; headers: Record<string, string> } };
      if (axiosErr?.response?.status === 429) {
        const retryAfter = parseInt(axiosErr.response.headers['retry-after'] || '60', 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
      } else if (i === retries - 1) {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function fetchRepositoryFiles(owner: string, repo: string): Promise<{ files: GitHubFile[]; truncated: boolean }> {
  const headers = getGitHubHeaders();

  // Get default branch
  const repoRes = await retryWithBackoff(() =>
    axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers })
  );

  if (repoRes.status === 404) {
    throw Object.assign(new Error('Repository not found or is private'), { status: 404 });
  }

  const defaultBranch = repoRes.data.default_branch || 'main';

  // Get full tree
  const treeRes = await retryWithBackoff(() =>
    axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers })
  );

  const allItems: GitHubTreeItem[] = treeRes.data.tree || [];
  const eligibleFiles = allItems
    .filter((item) => item.type === 'blob' && isEligibleFile(item.path))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAX_FILES);

  const truncated = allItems.filter((item) => item.type === 'blob' && isEligibleFile(item.path)).length > MAX_FILES;

  const files: GitHubFile[] = [];
  for (const item of eligibleFiles) {
    try {
      await new Promise((r) => setTimeout(r, 100)); // space requests
      const fileRes = await retryWithBackoff(() =>
        axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${item.path}`, { headers })
      );
      const content = Buffer.from(fileRes.data.content, 'base64').toString('utf-8');
      files.push({ path: item.path, content });
    } catch {
      // Skip files that fail to fetch
    }
  }

  return { files, truncated };
}
