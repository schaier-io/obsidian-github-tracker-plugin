/* eslint-disable @typescript-eslint/no-inferrable-types */
import { Notice, Plugin } from "obsidian";
import {
	GitHubTrackerSettings,
	DEFAULT_SETTINGS,
	DEFAULT_REPOSITORY_TRACKING,
} from "./types";
import { GitHubClient } from "./github-client";
import { FileManager } from "./file-manager";
import { GitHubTrackerSettingTab } from "./settings-tab";
import { NoticeManager } from "./notice-manager";

export default class GitHubTrackerPlugin extends Plugin {
	settings: GitHubTrackerSettings = DEFAULT_SETTINGS;
	private gitHubClient: GitHubClient | null = null;
	private fileManager: FileManager | null = null;
	private noticeManager!: NoticeManager;
	private isSyncing: boolean = false;

	async sync() {
		if (this.isSyncing) {
			this.noticeManager.warning("Already syncing...");
			return;
		}

		this.isSyncing = true;
		try {
			this.noticeManager.info("Syncing issues and pull requests");
			await this.fetchIssues();
			await this.fetchPullRequests();
			await this.fileManager?.cleanupEmptyFolders();

			this.noticeManager.success("Synced issues and pull requests");
		} catch (error: unknown) {
			this.noticeManager.error(
				"Error syncing issues and pull requests",
				error
			);
		}
		this.isSyncing = false;
	}

	async onload() {
		await this.loadSettings();

		// Initialize notice manager first
		this.noticeManager = new NoticeManager(this.settings);

		// Initialize the GitHub client
		this.gitHubClient = new GitHubClient(this.settings, this.noticeManager);

		// Initialize file manager
		this.fileManager = new FileManager(
			this.app,
			this.settings,
			this.noticeManager,
			this.gitHubClient
		);

		// Sync on startup if enabled
		if (this.settings.syncOnStartup && this.gitHubClient?.isReady()) {
			new Promise((resolve) => setTimeout(resolve, 750)).then(
				async () => {
					await this.sync();
				}
			);
		}

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon(
			"sync",
			"GitHub Tracker",
			async (evt: MouseEvent) => {
				if (!this.gitHubClient?.isReady()) {
					new Notice(
						"Please set your GitHub token in settings first"
					);
					return;
				}
				await this.sync();
			}
		);
		ribbonIconEl.addClass("github-tracker-ribbon-class");

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("GitHub Tracker");

		// Add command to sync GitHub issues and pull requests
		this.addCommand({
			id: "sync-github-issues-pull-requests",
			name: "Sync GitHub Issues & Pull Requests",
			callback: () => {
				this.sync();
			},
		});

		// Add settings tab
		this.addSettingTab(new GitHubTrackerSettingTab(this.app, this));
	}

	onunload() {
		this.gitHubClient?.dispose();
	}

	async loadSettings() {
		const loadedData = await this.loadData();

		// Apply migrations if needed
		const migratedData = this.migrateSettings(loadedData);

		// Merge with default settings
		this.settings = Object.assign({}, DEFAULT_SETTINGS, migratedData);
	}

	/**
	 * Migrate settings from older versions to the current version
	 * @param loadedData The data loaded from storage
	 * @returns The migrated data
	 */
	private migrateSettings(loadedData: any): any {
		// If no data, return empty object to use defaults
		if (!loadedData) return {};

		// Create a copy to avoid modifying the original
		const migratedData = { ...loadedData };

		// Migration 1: Add manuallyTrackedIssues and manuallyTrackedPullRequests if they don't exist
		if (!migratedData.manuallyTrackedIssues) {
			migratedData.manuallyTrackedIssues = [];
		}

		if (!migratedData.manuallyTrackedPullRequests) {
			migratedData.manuallyTrackedPullRequests = [];
		}

		// Migration 2: Move manually tracked items from repositories to global arrays
		if (
			migratedData.repositories &&
			Array.isArray(migratedData.repositories)
		) {
			for (const repo of migratedData.repositories) {
				// Check for old manually tracked issues in repository
				if (
					repo.manuallyTrackedIssues &&
					Array.isArray(repo.manuallyTrackedIssues)
				) {
					for (const issueNumber of repo.manuallyTrackedIssues) {
						// Add to global array if not already there
						const exists = migratedData.manuallyTrackedIssues.some(
							(item: { repo: string; number: string }) =>
								item.repo === repo.repository &&
								item.number === issueNumber
						);

						if (!exists) {
							migratedData.manuallyTrackedIssues.push({
								repo: repo.repository,
								number: issueNumber,
							});
						}
					}

					// Remove the old array
					delete repo.manuallyTrackedIssues;
				}

				// Check for old manually tracked pull requests in repository
				if (
					repo.manuallyTrackedPullRequests &&
					Array.isArray(repo.manuallyTrackedPullRequests)
				) {
					for (const prNumber of repo.manuallyTrackedPullRequests) {
						// Add to global array if not already there
						const exists =
							migratedData.manuallyTrackedPullRequests.some(
								(item: { repo: string; number: string }) =>
									item.repo === repo.repository &&
									item.number === prNumber
							);

						if (!exists) {
							migratedData.manuallyTrackedPullRequests.push({
								repo: repo.repository,
								number: prNumber,
							});
						}
					}

					// Remove the old array
					delete repo.manuallyTrackedPullRequests;
				}
			}
		}

		// Migration 3: Ensure all repositories have the latest properties
		if (
			migratedData.repositories &&
			Array.isArray(migratedData.repositories)
		) {
			migratedData.repositories = migratedData.repositories.map(
				(repo: any) => {
					// Create a new object with default values
					const updatedRepo = { ...DEFAULT_REPOSITORY_TRACKING };

					// Copy all existing properties
					Object.assign(updatedRepo, repo);

					// Ensure repository name is set
					updatedRepo.repository = repo.repository || "";

					return updatedRepo;
				}
			);
		}

		// Migration 4: Ensure escapeMode is valid
		if (
			!migratedData.escapeMode ||
			!["disabled", "normal", "strict", "veryStrict"].includes(
				migratedData.escapeMode
			)
		) {
			migratedData.escapeMode = "strict";
		}

		// Migration 5: Ensure syncNoticeMode is valid
		if (
			!migratedData.syncNoticeMode ||
			!["minimal", "normal", "extensive", "debug"].includes(
				migratedData.syncNoticeMode
			)
		) {
			migratedData.syncNoticeMode = "normal";
		}

		return migratedData;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.settings.githubToken) {
			this.gitHubClient?.initializeClient();
		}

		// Update the notice manager with new settings
		if (this.noticeManager) {
			this.noticeManager = new NoticeManager(this.settings);
		}
	}

	/**
	 * Fetch available repositories from GitHub
	 */
	async fetchAvailableRepositories() {
		if (!this.gitHubClient) {
			this.noticeManager.error("GitHub client not initialized");
			return [];
		}

		if (!this.settings.githubToken) {
			this.noticeManager.error(
				"No GitHub token provided. Please add your GitHub token in the settings."
			);
			return [];
		}

		try {
			// Initialize client with token
			await this.gitHubClient.initializeClient(this.settings.githubToken);

			// Fetch available repositories
			return await this.gitHubClient.fetchAvailableRepositories();
		} catch (error: unknown) {
			this.noticeManager.error(
				"Error fetching available repositories",
				error
			);
			return [];
		}
	}

	/**
	 * Fetch and process issues from GitHub
	 */
	private async fetchIssues() {
		if (!this.gitHubClient || !this.fileManager) {
			this.noticeManager.error(
				"GitHub client or file manager not initialized"
			);
			return;
		}

		try {
			for (const repo of this.settings.repositories) {
				if (!repo.trackIssues) continue;

				const [owner, repoName] = repo.repository.split("/");
				if (!owner || !repoName) continue;

				this.noticeManager.debug(
					`Fetching issues for ${repo.repository}`
				);
				// Fetch issues from GitHub
				const issues = await this.gitHubClient.fetchRepositoryIssues(
					owner,
					repoName
				);

				// Filter issues based on repository settings
				const filteredIssues = this.fileManager.filterIssues(
					repo,
					issues
				);

				this.noticeManager.debug(
					`Found ${issues.length} issues, ${filteredIssues.length} match filters`
				);

				// Get list of current issue numbers
				const currentIssueNumbers = new Set(
					filteredIssues.map((issue: { number: number }) =>
						issue.number.toString()
					)
				);

				// Create or update issue files
				await this.fileManager.createIssueFiles(
					repo,
					filteredIssues,
					currentIssueNumbers
				);

				this.noticeManager.debug(
					`Synced ${filteredIssues.length} issues for ${repo.repository}`
				);
			}
		} catch (error: unknown) {
			this.noticeManager.error("Error fetching GitHub issues", error);
		}
	}

	/**
	 * Fetch and process pull requests from GitHub
	 */
	private async fetchPullRequests() {
		if (!this.gitHubClient || !this.fileManager) {
			this.noticeManager.error(
				"GitHub client or file manager not initialized"
			);
			return;
		}

		try {
			for (const repo of this.settings.repositories) {
				if (!repo.trackPullRequest) continue;

				const [owner, repoName] = repo.repository.split("/");
				if (!owner || !repoName) continue;

				this.noticeManager.debug(
					`Fetching pull requests for ${repo.repository}`
				);

				// Fetch pull requests from GitHub
				const pullRequests =
					await this.gitHubClient.fetchRepositoryPullRequests(
						owner,
						repoName
					);

				// Filter pull requests based on repository settings
				const filteredPRs = this.fileManager.filterPullRequests(
					repo,
					pullRequests
				);

				this.noticeManager.debug(
					`Found ${pullRequests.length} pull requests, ${filteredPRs.length} match filters`
				);

				// Get list of current PR numbers
				const currentPRNumbers = new Set(
					filteredPRs.map((pr: { number: number }) =>
						pr.number.toString()
					)
				);

				// Create or update pull request files
				await this.fileManager.createPullRequestFiles(
					repo,
					filteredPRs,
					currentPRNumbers
				);

				this.noticeManager.debug(
					`Synced ${filteredPRs.length} pull requests for ${repo.repository}`
				);
			}
		} catch (error: unknown) {
			this.noticeManager.error(
				"Error fetching GitHub pull requests",
				error
			);
		}
	}
}
