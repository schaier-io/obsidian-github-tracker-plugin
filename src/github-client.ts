import { GitHubTrackerSettings } from "./types";
import { Octokit } from "octokit";
import { NoticeManager } from "./notice-manager";

export class GitHubClient {
	private octokit: Octokit | null = null;

	constructor(
		private settings: GitHubTrackerSettings,
		private noticeManager: NoticeManager
	) {
		this.initializeClient();
	}

	/**
	 * Initialize GitHub client with the current token
	 */
	public initializeClient(token?: string): void {
		const authToken = token || this.settings.githubToken;

		if (!authToken) {
			this.noticeManager.error(
				"GitHub token is not set. Please set it in settings."
			);
			return;
		}

		this.octokit = new Octokit({
			auth: authToken,
		});
	}

	/**
	 * Check if the client is ready to use
	 */
	public isReady(): boolean {
		return this.octokit !== null;
	}

	/**
	 * Get the Octokit instance
	 */
	public getClient(): Octokit | null {
		return this.octokit;
	}

	/**
	 * Fetch issues for a repository
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetchRepositoryIssues(
		owner: string,
		repo: string
	): Promise<any[]> {
		if (!this.octokit) {
			return [];
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let allIssues: any[] = [];
			let page = 1;
			let hasMorePages = true;

			while (hasMorePages) {
				const response = await this.octokit.rest.issues.listForRepo({
					owner,
					repo,
					state: "open",
					per_page: 100,
					page,
				});

				allIssues = [...allIssues, ...response.data];

				// Check if we've reached the last page
				hasMorePages = response.data.length === 100;
				page++;
			}

			this.noticeManager.debug(
				`Fetched ${allIssues.length} issues for ${owner}/${repo}`
			);
			return allIssues;
		} catch (error) {
			this.noticeManager.error(
				`Error fetching issues for ${owner}/${repo}`,
				error
			);
			return [];
		}
	}

	/**
	 * Fetch pull requests for a repository
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetchRepositoryPullRequests(
		owner: string,
		repo: string
	): Promise<any[]> {
		if (!this.octokit) {
			return [];
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let allPullRequests: any[] = [];
			let page = 1;
			let hasMorePages = true;

			while (hasMorePages) {
				const response = await this.octokit.rest.pulls.list({
					owner,
					repo,
					state: "open",
					per_page: 100,
					page,
				});

				allPullRequests = [...allPullRequests, ...response.data];

				// Check if we've reached the last page
				hasMorePages = response.data.length === 100;
				page++;
			}

			this.noticeManager.debug(
				`Fetched ${allPullRequests.length} pull requests for ${owner}/${repo}`
			);
			return allPullRequests;
		} catch (error) {
			this.noticeManager.error(
				`Error fetching pull requests for ${owner}/${repo}`,
				error
			);
			return [];
		}
	}

	/**
	 * Check if a pull request is opened by a specific user
	 */
	public isPullRequestByUser(pullRequest: any, username: string): boolean {
		if (!pullRequest || !pullRequest.user) {
			return false;
		}

		return pullRequest.user.login === username;
	}

	/**
	 * Fetch available repositories for the authenticated user
	 */
	public async fetchAvailableRepositories(): Promise<
		{ owner: { login: string }; name: string }[]
	> {
		if (!this.octokit) {
			return [];
		}

		try {
			this.noticeManager.debug("Fetching repositories from GitHub");

			// Get user's repositories
			let allUserRepos: { owner: { login: string }; name: string }[] = [];
			let userReposPage = 1;
			let hasMoreUserRepos = true;

			while (hasMoreUserRepos) {
				const { data: repos } =
					await this.octokit.rest.repos.listForAuthenticatedUser({
						per_page: 100,
						sort: "updated",
						page: userReposPage,
					});

				allUserRepos = [...allUserRepos, ...repos];

				// Check if we've reached the last page
				hasMoreUserRepos = repos.length === 100;
				userReposPage++;
			}

			// Get organizations
			let allOrgs: { login: string }[] = [];
			let orgsPage = 1;
			let hasMoreOrgs = true;

			while (hasMoreOrgs) {
				const { data: orgs } =
					await this.octokit.rest.orgs.listForAuthenticatedUser({
						per_page: 100,
						page: orgsPage,
					});

				allOrgs = [...allOrgs, ...orgs];

				// Check if we've reached the last page
				hasMoreOrgs = orgs.length === 100;
				orgsPage++;
			}

			// Get repositories for each organization
			const orgRepos = await Promise.all(
				allOrgs.map(async (org: { login: string }) => {
					this.noticeManager.debug(
						`Fetching repositories for organization: ${org.login}`
					);
					if (!this.octokit) {
						this.noticeManager.error(
							"GitHub client is not initialized"
						);
						return [];
					}

					let allOrgRepos: {
						owner: { login: string };
						name: string;
					}[] = [];
					let orgReposPage = 1;
					let hasMoreOrgRepos = true;

					while (hasMoreOrgRepos) {
						const { data } =
							await this.octokit.rest.repos.listForOrg({
								org: org.login,
								per_page: 100,
								page: orgReposPage,
							});

						allOrgRepos = [...allOrgRepos, ...data];

						// Check if we've reached the last page
						hasMoreOrgRepos = data.length === 100;
						orgReposPage++;
					}

					return allOrgRepos;
				})
			);

			// Combine all repositories
			const allRepos = [...allUserRepos, ...orgRepos.flat()];
			this.noticeManager.debug(
				`Found ${allRepos.length} repositories in total`
			);

			return allRepos;
		} catch (error) {
			this.noticeManager.error("Error fetching repositories", error);
			return [];
		}
	}

	/**
	 * Fetch comments for an issue
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetchIssueComments(
		owner: string,
		repo: string,
		issueNumber: number
	): Promise<any[]> {
		if (!this.octokit) {
			return [];
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let allComments: any[] = [];
			let page = 1;
			let hasMorePages = true;

			while (hasMorePages) {
				const response = await this.octokit.rest.issues.listComments({
					owner,
					repo,
					issue_number: issueNumber,
					per_page: 100,
					page,
				});

				allComments = [...allComments, ...response.data];

				// Check if we've reached the last page
				hasMorePages = response.data.length === 100;
				page++;
			}

			this.noticeManager.debug(
				`Fetched ${allComments.length} comments for issue #${issueNumber}`
			);
			return allComments;
		} catch (error) {
			this.noticeManager.error(
				`Error fetching comments for issue #${issueNumber}`,
				error
			);
			return [];
		}
	}

	/**
	 * Fetch comments for a pull request
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async fetchPullRequestComments(
		owner: string,
		repo: string,
		prNumber: number
	): Promise<any[]> {
		if (!this.octokit) {
			return [];
		}

		try {
			// Get issue comments (PR general comments)
			const issueComments = await this.fetchIssueComments(
				owner,
				repo,
				prNumber
			);

			// Get PR review comments (line comments)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let allReviewComments: any[] = [];
			let page = 1;
			let hasMorePages = true;

			while (hasMorePages) {
				const response =
					await this.octokit.rest.pulls.listReviewComments({
						owner,
						repo,
						pull_number: prNumber,
						per_page: 100,
						page,
					});

				allReviewComments = [...allReviewComments, ...response.data];

				// Check if we've reached the last page
				hasMorePages = response.data.length === 100;
				page++;
			}

			this.noticeManager.debug(
				`Fetched ${issueComments.length} general comments and ${allReviewComments.length} review comments for PR #${prNumber}`
			);

			// Tag review comments to differentiate them
			allReviewComments.forEach((comment) => {
				comment.is_review_comment = true;
			});

			// Combine both types of comments
			return [...issueComments, ...allReviewComments];
		} catch (error) {
			this.noticeManager.error(
				`Error fetching comments for PR #${prNumber}`,
				error
			);
			return [];
		}
	}

	/**
	 * Release resources
	 */
	public dispose(): void {
		this.octokit = null;
	}
}
