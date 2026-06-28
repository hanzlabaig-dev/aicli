import axios from 'axios';
import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

const GITHUB_API = 'https://api.github.com';

export interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  default_branch: string;
}

export interface GHUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  public_repos: number;
}

export interface GHPullRequest {
  number: number;
  title: string;
  html_url: string;
  state: string;
}

class GitHubIntegration {
  private getHeaders(): Record<string, string> {
    const token = configManager.get().github.token;
    if (!token) throw new Error('GitHub token not configured. Use /github auth <token>');
    return {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'aicli/1.0.0',
    };
  }

  isConfigured(): boolean {
    return !!configManager.get().github.token;
  }

  async getUser(): Promise<GHUser> {
    const response = await axios.get(`${GITHUB_API}/user`, { headers: this.getHeaders() });
    return response.data as GHUser;
  }

  async listRepos(page = 1, perPage = 30): Promise<GHRepo[]> {
    const response = await axios.get(`${GITHUB_API}/user/repos`, {
      headers: this.getHeaders(),
      params: { sort: 'updated', direction: 'desc', per_page: perPage, page },
    });
    return response.data as GHRepo[];
  }

  async getRepo(owner: string, repo: string): Promise<GHRepo> {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: this.getHeaders(),
    });
    return response.data as GHRepo;
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<GHPullRequest> {
    const response = await axios.post(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls`,
      { title, body, head, base },
      { headers: this.getHeaders() }
    );
    return response.data as GHPullRequest;
  }

  async listPullRequests(owner: string, repo: string, state = 'open'): Promise<GHPullRequest[]> {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
      headers: this.getHeaders(),
      params: { state, per_page: 20 },
    });
    return response.data as GHPullRequest[];
  }

  async searchRepos(query: string): Promise<GHRepo[]> {
    const response = await axios.get(`${GITHUB_API}/search/repositories`, {
      headers: this.getHeaders(),
      params: { q: query, sort: 'updated', per_page: 10 },
    });
    return (response.data as { items: GHRepo[] }).items;
  }

  async authenticate(token: string): Promise<GHUser> {
    // Verify token is valid
    const response = await axios.get(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const user = response.data as GHUser;
    // Save token only after validation
    configManager.set('github', { ...configManager.get().github, token });
    logger.info('GitHub authenticated', { login: user.login });
    return user;
  }

  async createRepo(name: string, description?: string, isPrivate = false): Promise<GHRepo> {
    const response = await axios.post(
      `${GITHUB_API}/user/repos`,
      { name, description, private: isPrivate, auto_init: true },
      { headers: this.getHeaders() }
    );
    return response.data as GHRepo;
  }
}

export const githubIntegration = new GitHubIntegration();
