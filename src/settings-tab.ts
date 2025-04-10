import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import { RepositoryTracking, DEFAULT_REPOSITORY_TRACKING } from "./types";
import GitHubTrackerPlugin from "./main";

export class GitHubTrackerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: GitHubTrackerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass("github-tracker");

		new Setting(containerEl)
			.setName("GitHub token")
			.setDesc("Your GitHub personal access token")
			.addText((text) =>
				text
					.setPlaceholder("Enter your GitHub token")
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
					})
			);
		const tokenInfo = containerEl.createEl("p", {
			text: "Please limit the token to the minimum permissions needed. For more information. Requirements are Issues, Pull Requests, and Repositories. Read more ",
		});
		tokenInfo.addClass("github-tracker-info-text");

		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc(
				"Automatically sync issues and pull requests when Obsidian starts"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.syncOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.syncOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sync notice mode")
			.setDesc("Control the level of notifications shown during sync")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("minimal", "Minimal")
					.addOption("normal", "Normal")
					.addOption("extensive", "Extensive")
					.addOption("debug", "Debug")
					.setValue(this.plugin.settings.syncNoticeMode)
					.onChange(async (value) => {
						this.plugin.settings.syncNoticeMode = value as
							| "minimal"
							| "normal"
							| "extensive"
							| "debug";
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Date format")
			.setDesc(
				"Format for dates in issue files (e.g., yyyy-MM-dd HH:mm:ss)"
			)
			.addText((text) =>
				text
					.setPlaceholder("yyyy-MM-dd HH:mm:ss")
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Body content escaping")
			.setDesc(
				"Choose how to handle Templater, Dataview and other plugin escaping in issue and pull request bodies."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						"disabled",
						"Disabled - No escaping (may allow malicious content)"
					)
					.addOption(
						"normal",
						"Normal - Basic escaping for plugins like templater and dataview"
					)
					.addOption(
						"strict",
						"Strict - Only alphanumeric characters and links will be allowed"
					)
					.addOption(
						"veryStrict",
						"Very strict - Only alphanumeric characters, and punctuation"
					)
					.setValue(this.plugin.settings.escapeMode)
					.onChange(async (value) => {
						if (value === "disabled") {
							const modal = new Modal(this.app);
							modal.titleEl.setText("Security Warning");
							modal.contentEl.setText(
								"Disabling body content escaping may allow malicious scripts to execute in your vault. Are you sure you want to continue?"
							);

							// Create buttons container
							const buttonContainer = modal.contentEl.createDiv();
							buttonContainer.addClass(
								"github-tracker-button-container"
							);

							// Add Cancel button
							const cancelButton =
								buttonContainer.createEl("button");
							cancelButton.setText("Cancel");
							cancelButton.onclick = () => {
								dropdown.setValue("strict");
								modal.close();
							};

							// Add Continue button
							const continueButton =
								buttonContainer.createEl("button");
							continueButton.setText("Continue");
							continueButton.addClass("mod-warning");
							continueButton.onclick = async () => {
								this.plugin.settings.escapeMode = value as
									| "disabled"
									| "normal"
									| "strict"
									| "veryStrict";
								await this.plugin.saveSettings();
								modal.close();
							};

							modal.open();
							return;
						}
						this.plugin.settings.escapeMode = value as
							| "disabled"
							| "normal"
							| "strict"
							| "veryStrict";
						await this.plugin.saveSettings();
					})
			);

		const infoText = containerEl.createEl("p", {
			text: "CAUTION: especially if using Plugins that enable script execution. In disabled mode, no escaping will be done. ",
		});
		infoText.addClass("github-tracker-info-text");
		infoText.addClass("github-tracker-warning-text");

		const infoText2 = containerEl.createEl("p", {
			text: "In normal mode '`', '{{', '}}', '<%' and '%>' will be escaped. (This has the side effect of not allowing code blocks to be rendered)",
		});
		infoText2.addClass("github-tracker-info-text");

		const infoText3 = containerEl.createEl("p", {
			text: "In strict mode only alphanumeric characters, '.,'()/[]{}*+-:\"' and whitespace will be allowed. This will remove any html like rendering and templating, but persist links",
		});
		infoText3.addClass("github-tracker-info-text");

		const infoText4 = containerEl.createEl("p", {
			text: "In very strict mode only alphanumeric characters, and '.,' or whitespace will be allowed. This will remove any html like rendering and templating.",
		});
		infoText4.addClass("github-tracker-info-text");

		const infoLink = tokenInfo.createEl("a", {
			text: "here",
		});
		infoLink.addClass("github-tracker-info-link");
		infoLink.href =
			"https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token";
		infoLink.target = "_blank";

		containerEl.createEl("hr");

		// Add repository list
		const repoContainer = containerEl.createDiv();

		new Setting(repoContainer).setName("Repositories").setHeading();

		// Add external repository button
		new Setting(repoContainer)
			.setName("Add repository")
			.setDesc("Add a repository from GitHub or manually")
			.addButton((button) => {
				button.setButtonText("Add");
				button.onClick(async () => {
					this.showAddRepositoryModal();
				});
			});

		// Add search filter
		const searchContainer = repoContainer.createDiv();
		new Setting(searchContainer)
			.setName("Search repositories")
			.setDesc("Filter repositories by name or owner")
			.addText((text) =>
				text
					.setPlaceholder("Search repositories...")
					.onChange((value) => {
						const searchTerm = value.toLowerCase();
						const repoElements = repoContainer.querySelectorAll(
							".github-tracker-repo-settings"
						);
						let visibleRepositories = 0;
						repoElements.forEach((element) => {
							const repoName =
								element
									.getAttribute("data-repo-name")
									?.toLowerCase() || "";
							if (repoName.includes(searchTerm)) {
								(element as HTMLElement).classList.remove(
									"github-tracker-hidden"
								);
								visibleRepositories++;
							} else {
								(element as HTMLElement).classList.add(
									"github-tracker-hidden"
								);
							}
						});
						noRepositories.classList.toggle(
							"github-tracker-hidden",
							visibleRepositories > 0
						);
					})
			);

		const smallDivider = repoContainer.createEl("hr");
		smallDivider.addClass("github-tracker-small-divider");
		const noRepositories = repoContainer.createEl("p", {
			text: "No repositories found. Please add a repository to get started.",
		});
		noRepositories.classList.toggle(
			"github-tracker-hidden",
			this.plugin.settings.repositories.length > 0
		);

		this.renderRepositoriesList(repoContainer);
	}

	private showAddRepositoryModal(): void {
		const modal = new Modal(this.app);
		modal.titleEl.setText("Add repository");

		// Create form container
		const formContainer = modal.contentEl.createDiv();
		formContainer.addClass("github-tracker-form-container");

		// Add tabs for different add methods
		const tabsContainer = formContainer.createDiv();
		tabsContainer.addClass("github-tracker-tabs-container");

		const manualTab = tabsContainer.createEl("button");
		manualTab.setText("Manual Entry");
		manualTab.addClass("mod-cta");

		const githubTab = tabsContainer.createEl("button");
		githubTab.setText("From GitHub");

		// Create content containers
		const manualContent = formContainer.createDiv();
		manualContent.addClass("github-tracker-tab-content");
		manualContent.addClass("active");

		const githubContent = formContainer.createDiv();
		githubContent.addClass("github-tracker-tab-content");

		// Manual entry form
		const manualForm = manualContent.createDiv();
		manualForm.addClass("github-tracker-manual-form-container");

		// Add repository name input
		const repoContainer = manualForm.createDiv();
		repoContainer.addClass("github-tracker-container");
		repoContainer.createEl("label", { text: "Repository (owner/name)" });
		const repoInput = repoContainer.createEl("input");
		repoInput.type = "text";
		repoInput.placeholder = "e.g., owner/repo-name";

		// GitHub repositories list
		const githubList = githubContent.createDiv();
		githubList.addClass("github-tracker-list");

		// Tab switching logic
		manualTab.onclick = () => {
			manualTab.addClass("mod-cta");
			githubTab.removeClass("mod-cta");
			manualContent.addClass("active");
			githubContent.removeClass("active");

			buttonContainer.addClass("github-tracker-visible-flex");
			buttonContainer.removeClass("github-tracker-hidden");
		};

		githubTab.onclick = async () => {
			githubTab.addClass("mod-cta");
			manualTab.removeClass("mod-cta");
			manualContent.removeClass("active");
			githubContent.addClass("active");
			buttonContainer.addClass("github-tracker-hidden");
			buttonContainer.removeClass("github-tracker-visible-flex");
			await this.renderGitHubRepositories(githubList);
		};

		// Add buttons container
		const buttonContainer = formContainer.createDiv();
		buttonContainer.addClass("github-tracker-button-container");

		// Add Cancel button
		const cancelButton = buttonContainer.createEl("button");
		cancelButton.setText("Cancel");
		cancelButton.onclick = () => modal.close();

		// Add Add button (for manual entry)
		const addButton = buttonContainer.createEl("button");
		addButton.setText("Add");
		addButton.onclick = async () => {
			const repo = repoInput.value.trim();

			if (!repo) {
				new Notice("Please enter both owner and repository name");
				return;
			}

			await this.addRepository(repo);
			modal.close();
		};

		modal.open();
	}

	private async renderGitHubRepositories(
		container: HTMLElement
	): Promise<void> {
		container.empty();
		container.createEl("p", { text: "Loading repositories..." });

		try {
			const repos = await this.plugin.fetchAvailableRepositories();

			container.empty();
			for (const repo of repos) {
				const repoName = `${repo.owner.login}/${repo.name}`;
				const isTracked = this.plugin.settings.repositories.some(
					(r) => r.repository === repoName
				);

				const repoItem = container.createDiv();
				repoItem.addClass("github-tracker-item");

				const repoText = repoItem.createEl("span");
				repoText.setText(repoName);

				if (!isTracked) {
					const addButton = repoItem.createEl("button");
					addButton.setText("Add");
					addButton.onclick = async () => {
						await this.addRepository(repoName);
						this.display();
						repoItem.classList.add("github-tracker-hidden");
					};
				} else {
					const trackedText = repoItem.createEl("span");
					trackedText.setText("Already tracked");
					trackedText.addClass("github-tracker-info-text");
				}
			}
		} catch (error) {
			container.empty();
			container.createEl("p", {
				text: `Error loading repositories: ${(error as Error).message}`,
			});
		}
	}

	private async addRepository(repoName: string): Promise<void> {
		// Check if repository already exists
		if (
			this.plugin.settings.repositories.some(
				(r) => r.repository === repoName
			)
		) {
			new Notice("This repository is already being tracked");
			return;
		}

		// Add new repository with default settings
		const newRepo = {
			...DEFAULT_REPOSITORY_TRACKING,
			repository: repoName,
		};
		this.plugin.settings.repositories.push(newRepo);
		await this.plugin.saveSettings();
		this.display();
		new Notice(`Added repository: ${repoName}`);
	}

	private renderRepositoriesList(container: HTMLElement): void {
		const reposContainer = container.createDiv(
			"github-tracker-repos-container"
		);

		// Render each repository
		for (const repo of this.plugin.settings.repositories) {
			const repoContainer = reposContainer.createDiv(
				"github-tracker-repo-settings"
			);
			repoContainer.setAttribute("data-repo-name", repo.repository);

			// Create repository header
			const repoHeader = repoContainer.createDiv(
				"github-tracker-repo-header"
			);
			// Replace h3 with setting + setHeading
			new Setting(repoHeader)
				.setName("Repository: " + repo.repository)
				.setHeading();

			// Create repository actions
			const repoActions = repoHeader.createDiv(
				"github-tracker-repo-actions"
			);

			// Delete button
			const deleteButton = repoActions.createEl("button");
			deleteButton.setText("Delete");
			deleteButton.addClass("mod-warning");
			deleteButton.onclick = async () => {
				await this.showDeleteRepositoryModal(repo);
			};

			repoContainer
				.createEl("p", {
					text: "Configure tracking settings for this repository",
				})
				.addClass("setting-item-description");

			// Create containers for issues and pull requests
			const issuesContainer = repoContainer.createDiv(
				"github-tracker-settings-section"
			);
			const pullRequestsContainer = repoContainer.createDiv(
				"github-tracker-settings-section"
			);

			this.renderIssueSettings(issuesContainer, repo);
			this.renderPullRequestSettings(pullRequestsContainer, repo);

			// Add a divider between repositories
			const smallDivider = repoContainer.createEl("hr");
			smallDivider.addClass("github-tracker-small-divider");
		}
	}

	private async showDeleteRepositoryModal(
		repo: RepositoryTracking
	): Promise<void> {
		const modal = new Modal(this.app);
		modal.titleEl.setText("Delete Repository");
		modal.contentEl.setText(
			`Are you sure you want to delete ${repo.repository}? This will remove all tracking settings for this repository.`
		);

		// Create buttons container
		const buttonContainer = modal.contentEl.createDiv();
		buttonContainer.addClass("github-tracker-button-container");

		// Add Cancel button
		const cancelButton = buttonContainer.createEl("button");
		cancelButton.setText("Cancel");
		cancelButton.onclick = () => modal.close();

		// Add Delete button
		const confirmDeleteButton = buttonContainer.createEl("button");
		confirmDeleteButton.setText("Delete");
		confirmDeleteButton.addClass("mod-warning");
		confirmDeleteButton.onclick = async () => {
			this.plugin.settings.repositories =
				this.plugin.settings.repositories.filter(
					(r) => r.repository !== repo.repository
				);
			await this.plugin.saveSettings();
			this.display();
			modal.close();
			new Notice(`Deleted repository: ${repo.repository}`);
		};

		modal.open();
	}

	private renderIssueSettings(
		container: HTMLElement,
		repo: RepositoryTracking
	): void {
		new Setting(container).setName("Issues").setHeading();

		container
			.createEl("p", {
				text: "Configure how issues are tracked and stored",
			})
			.addClass("setting-item-description");

		// Issues tracking toggle
		new Setting(container)
			.setName("Track issues")
			.setDesc("Enable or disable issue tracking for this repository")
			.addToggle((toggle) =>
				toggle.setValue(repo.trackIssues).onChange(async (value) => {
					repo.trackIssues = value;
					issuesSettingsContainer.classList.toggle(
						"github-tracker-settings-hidden",
						!value
					);
					await this.plugin.saveSettings();
				})
			);

		// Issues additional settings container
		const issuesSettingsContainer = container.createDiv(
			"github-tracker-settings-group"
		);
		issuesSettingsContainer.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.trackIssues
		);

		// Issues folder setting
		new Setting(issuesSettingsContainer)
			.setName("Issues folder")
			.setDesc("The folder where issue files will be stored")
			.addText((text) =>
				text
					.setPlaceholder("GitHub Issues")
					.setValue(repo.issueFolder)
					.onChange(async (value) => {
						repo.issueFolder = value;
						await this.plugin.saveSettings();
					})
			);

		// Issues update mode dropdown
		new Setting(issuesSettingsContainer)
			.setName("Issue update mode")
			.setDesc("How to handle updates to existing issues")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("none", "None - Don't update existing issues")
					.addOption("update", "Update - Overwrite existing content")
					.addOption("append", "Append - Add new content at the end")
					.setValue(repo.issueUpdateMode)
					.onChange(async (value) => {
						repo.issueUpdateMode = value as
							| "none"
							| "update"
							| "append";
						await this.plugin.saveSettings();
					})
			);

		// Issues allow delete toggle
		new Setting(issuesSettingsContainer)
			.setName("Default: Allow issue deletion")
			.setDesc(
				"If enabled, issue files will be set to be deleted from your vault when the issue is closed or no longer matches your filter criteria"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.allowDeleteIssue)
					.onChange(async (value) => {
						repo.allowDeleteIssue = value;
						await this.plugin.saveSettings();
					})
			);
		const filterSettings = issuesSettingsContainer.createDiv(
			"github-tracker-filter-group"
		);
		filterSettings.createEl("h4", { text: "Filter settings" });
		const infoText = filterSettings.createEl("p", {
			text: "The settings work as an OR filter. If any of the settings are met, the issue will be tracked. In case you have no filter settings enabled, all issues will be tracked.",
		});
		infoText.addClass("github-tracker-info-text");

		// Issues require assignee toggle
		new Setting(filterSettings)
			.setName("Require assignee")
			.setDesc("Only track issues that have at least one assignee")
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requireAssignee)
					.onChange(async (value) => {
						repo.requireAssignee = value;
						assigneeMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Issues assignee match setting
		const assigneeMatchSetting = new Setting(filterSettings)
			.setName("Assignee match")
			.setDesc(
				"Only track issues assigned to this specific GitHub username (case-insensitive). Disable to track all assignees"
			)
			.addText((text) =>
				text
					.setPlaceholder("GitHub username")
					.setValue(repo.assigneeMatch)
					.onChange(async (value) => {
						repo.assigneeMatch = value;
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of assignee match setting
		assigneeMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requireAssignee
		);

		// Issues require opened by toggle
		new Setting(filterSettings)
			.setName("Require opened by")
			.setDesc("Only track issues that were opened by a specific user")
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requireOpenedByIssue)
					.onChange(async (value) => {
						repo.requireOpenedByIssue = value;
						openedByIssueMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Issues opened by match setting
		const openedByIssueMatchSetting = new Setting(filterSettings)
			.setName("Opened by")
			.setDesc(
				"Only track issues opened by this specific GitHub username (case-insensitive)"
			)
			.addText((text) =>
				text
					.setPlaceholder("GitHub username")
					.setValue(repo.openedByIssueMatch)
					.onChange(async (value) => {
						repo.openedByIssueMatch = value;
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of opened by match setting
		openedByIssueMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requireOpenedByIssue
		);

		// Issues require label toggle
		new Setting(filterSettings)
			.setName("Require label")
			.setDesc(
				"Only track issues that have at least one of the specified labels"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requireIssueLabel)
					.onChange(async (value) => {
						repo.requireIssueLabel = value;
						issueLabelMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Issues label match setting
		const issueLabelMatchSetting = new Setting(filterSettings)
			.setName("Label match")
			.setDesc(
				"Only track issues with at least one of these labels (case-insensitive, comma-separated)"
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("bug, enhancement, feature")
					.setValue(
						Array.isArray(repo.issueLabelMatch)
							? repo.issueLabelMatch.join(", ")
							: ""
					)
					.onChange(async (value) => {
						// Split by comma and trim whitespace
						repo.issueLabelMatch = value
							.split(",")
							.map((label) => label.trim())
							.filter((label) => label !== "");
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of label match setting
		issueLabelMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requireIssueLabel
		);
	}

	private renderPullRequestSettings(
		container: HTMLElement,
		repo: RepositoryTracking
	): void {
		new Setting(container).setName("Pull requests").setHeading();

		container
			.createEl("p", {
				text: "Configure how pull requests are tracked and stored",
			})
			.addClass("setting-item-description");

		// Pull Requests tracking toggle
		new Setting(container)
			.setName("Track pull requests")
			.setDesc(
				"Enable or disable pull request tracking for this repository"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.trackPullRequest)
					.onChange(async (value) => {
						repo.trackPullRequest = value;
						pullRequestsSettingsContainer.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Pull Requests additional settings container
		const pullRequestsSettingsContainer = container.createDiv(
			"github-tracker-settings-group"
		);
		pullRequestsSettingsContainer.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.trackPullRequest
		);

		// Pull Requests folder setting
		new Setting(pullRequestsSettingsContainer)
			.setName("Pull requests folder")
			.setDesc("The folder where pull request files will be stored")
			.addText((text) =>
				text
					.setPlaceholder("GitHub Pull Requests")
					.setValue(repo.pullRequestFolder)
					.onChange(async (value) => {
						repo.pullRequestFolder = value;
						await this.plugin.saveSettings();
					})
			);

		// Pull Requests update mode dropdown
		new Setting(pullRequestsSettingsContainer)
			.setName("Pull request update mode")
			.setDesc("How to handle updates to existing pull requests")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						"none",
						"None - Don't update existing pull requests"
					)
					.addOption("update", "Update - Overwrite existing content")
					.addOption("append", "Append - Add new content at the end")
					.setValue(repo.pullRequestUpdateMode)
					.onChange(async (value) => {
						repo.pullRequestUpdateMode = value as
							| "none"
							| "update"
							| "append";
						await this.plugin.saveSettings();
					})
			);

		// Pull Requests allow delete toggle
		new Setting(pullRequestsSettingsContainer)
			.setName("Default: Allow pull request deletion")
			.setDesc(
				"If enabled, pull request files will be set to be deleted from your vault when the pull request is closed or no longer matches your filter criteria"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.allowDeletePullRequest)
					.onChange(async (value) => {
						repo.allowDeletePullRequest = value;
						await this.plugin.saveSettings();
					})
			);

		const filterSettings = pullRequestsSettingsContainer.createDiv(
			"github-tracker-filter-group"
		);
		filterSettings.createEl("h4", { text: "Filter settings" });
		const infoText = filterSettings.createEl("p", {
			text: "The settings work as an OR filter. If any of the settings are met, the pull request will be tracked. In case you have no filter settings enabled, all pull requests will be tracked.",
		});
		infoText.addClass("github-tracker-info-text");

		// Pull Requests require reviewer toggle
		new Setting(filterSettings)
			.setName("Require reviewer")
			.setDesc(
				"Only track pull requests that have at least one requested reviewer"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requireReviewer)
					.onChange(async (value) => {
						repo.requireReviewer = value;
						reviewerMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Pull Requests reviewer match setting
		const reviewerMatchSetting = new Setting(filterSettings)
			.setName("Reviewer match")
			.setDesc(
				"Only track pull requests with this specific GitHub username as a reviewer (case-insensitive). Leave empty to track all reviewers."
			)
			.addText((text) =>
				text
					.setPlaceholder("GitHub username")
					.setValue(repo.reviewerMatch)
					.onChange(async (value) => {
						repo.reviewerMatch = value;
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of reviewer match setting
		reviewerMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requireReviewer
		);

		// Pull Requests require assignee toggle
		new Setting(filterSettings)
			.setName("Require assignee")
			.setDesc("Only track pull requests that have at least one assignee")
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requirePullRequestAssignee)
					.onChange(async (value) => {
						repo.requirePullRequestAssignee = value;
						pullRequestAssigneeMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Pull Requests assignee match setting
		const pullRequestAssigneeMatchSetting = new Setting(filterSettings)
			.setName("Assignee match")
			.setDesc(
				"Only track pull requests assigned to this specific GitHub username (case-insensitive). Disable to track all assignees."
			)
			.addText((text) =>
				text
					.setPlaceholder("GitHub username")
					.setValue(repo.pullRequestAssigneeMatch)
					.onChange(async (value) => {
						repo.pullRequestAssigneeMatch = value;
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of assignee match setting
		pullRequestAssigneeMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requirePullRequestAssignee
		);

		// Pull Requests require opened by toggle
		new Setting(filterSettings)
			.setName("Require opened by")
			.setDesc(
				"Only track pull requests that were opened by a specific user"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requireOpenedByPR)
					.onChange(async (value) => {
						repo.requireOpenedByPR = value;
						openedByPRMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Pull Requests opened by match setting
		const openedByPRMatchSetting = new Setting(filterSettings)
			.setName("Opened by")
			.setDesc(
				"Only track pull requests opened by this specific GitHub username (case-insensitive)"
			)
			.addText((text) =>
				text
					.setPlaceholder("GitHub username")
					.setValue(repo.openedByPRMatch)
					.onChange(async (value) => {
						repo.openedByPRMatch = value;
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of opened by match setting
		openedByPRMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requireOpenedByPR
		);

		// Pull requests require label toggle
		new Setting(filterSettings)
			.setName("Require label")
			.setDesc(
				"Only track pull requests that have at least one of the specified labels"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(repo.requirePullRequestLabel)
					.onChange(async (value) => {
						repo.requirePullRequestLabel = value;
						pullRequestLabelMatchSetting.settingEl.classList.toggle(
							"github-tracker-settings-hidden",
							!value
						);
						await this.plugin.saveSettings();
					})
			);

		// Pull requests label match setting
		const pullRequestLabelMatchSetting = new Setting(
			pullRequestsSettingsContainer
		)
			.setName("Label match")
			.setDesc(
				"Only track pull requests with at least one of these labels (case-insensitive, comma-separated)"
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("bug, enhancement, feature")
					.setValue(
						Array.isArray(repo.pullRequestLabelMatch)
							? repo.pullRequestLabelMatch.join(", ")
							: ""
					)
					.onChange(async (value) => {
						// Split by comma and trim whitespace
						repo.pullRequestLabelMatch = value
							.split(",")
							.map((label) => label.trim())
							.filter((label) => label !== "");
						await this.plugin.saveSettings();
					})
			);

		// Set initial visibility of label match setting
		pullRequestLabelMatchSetting.settingEl.classList.toggle(
			"github-tracker-settings-hidden",
			!repo.requirePullRequestLabel
		);
	}
}
