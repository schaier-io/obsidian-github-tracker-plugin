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
}

export interface GitHubTrackerSettings {
  githubToken: string;
  repositories: RepositoryTracking[];
  dateFormat: string;
  syncOnStartup: boolean;
  syncNoticeMode: "minimal" | "normal" | "extensive" | "debug";
  syncInterval: number;
  escapeMode: "disabled" | "normal" | "strict" | "veryStrict";
}

export const DEFAULT_SETTINGS: GitHubTrackerSettings = {
  githubToken: "",
  repositories: [],
  dateFormat: "",
  syncOnStartup: true,
  syncNoticeMode: "normal",
  syncInterval: 0,
  escapeMode: "strict",
}; 