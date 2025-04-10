export interface RepositoryTracking {
	repository: string;
	trackIssues: boolean;
	issueUpdateMode: "none" | "update" | "append";
	allowDeleteIssue: boolean;
	issueFolder: string;
	trackPullRequest: boolean;
	pullRequestFolder: string;
	pullRequestUpdateMode: "none" | "update" | "append";
	allowDeletePullRequest: boolean;
	requireAssignee: boolean;
	requireReviewer: boolean;
	assigneeMatch: string;
	reviewerMatch: string;
	pullRequestAssigneeMatch: string;
	requirePullRequestAssignee: boolean;
	requireOpenedByIssue: boolean;
	openedByIssueMatch: string;
	requireOpenedByPR: boolean;
	openedByPRMatch: string;
	requireIssueLabel: boolean;
	issueLabelMatch: string[];
	requirePullRequestLabel: boolean;
	pullRequestLabelMatch: string[];
}

export interface GitHubTrackerSettings {
	githubToken: string;
	repositories: RepositoryTracking[];
	dateFormat: string;
	syncOnStartup: boolean;
	syncNoticeMode: "minimal" | "normal" | "extensive" | "debug";
	syncInterval: number;
	escapeMode: "disabled" | "normal" | "strict" | "veryStrict";
	manuallyTrackedIssues: { repo: string; number: string }[];
	manuallyTrackedPullRequests: { repo: string; number: string }[];
}

export const DEFAULT_SETTINGS: GitHubTrackerSettings = {
	githubToken: "",
	repositories: [],
	dateFormat: "",
	syncOnStartup: true,
	syncNoticeMode: "normal",
	syncInterval: 0,
	escapeMode: "strict",
	manuallyTrackedIssues: [],
	manuallyTrackedPullRequests: [],
};

// Default repository tracking settings
export const DEFAULT_REPOSITORY_TRACKING: RepositoryTracking = {
	repository: "",
	trackIssues: false,
	issueUpdateMode: "none",
	allowDeleteIssue: true,
	issueFolder: "GitHub Issues",
	trackPullRequest: false,
	pullRequestFolder: "GitHub Pull Requests",
	pullRequestUpdateMode: "none",
	allowDeletePullRequest: true,
	requireAssignee: false,
	requireReviewer: false,
	assigneeMatch: "",
	reviewerMatch: "",
	pullRequestAssigneeMatch: "",
	requirePullRequestAssignee: false,
	requireOpenedByIssue: false,
	openedByIssueMatch: "",
	requireOpenedByPR: false,
	openedByPRMatch: "",
	requireIssueLabel: false,
	issueLabelMatch: [],
	requirePullRequestLabel: false,
	pullRequestLabelMatch: [],
};
