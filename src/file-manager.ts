import { App, TFile, TFolder } from "obsidian";
import { format } from "date-fns";
import { GitHubTrackerSettings, RepositoryTracking } from "./types";
import { escapeBody } from "./util/escapeUtils";
import { extractProperties, mapToProperties } from "./util/properties";
import { NoticeManager } from "./notice-manager";
import { GitHubClient } from "./github-client";

export class FileManager {
  constructor(
    private app: App, 
    private settings: GitHubTrackerSettings,
    private noticeManager: NoticeManager,
    private gitHubClient: GitHubClient
  ) {}
  
  /**
   * Create issue files for a repository
   */
  public async createIssueFiles(
    repo: RepositoryTracking, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    issues: any[],
    currentIssueNumbers: Set<string>
  ): Promise<void> {
    const [owner, repoName] = repo.repository.split("/");
    if (!owner || !repoName) return;
    
    const repoCleaned = repoName.replace(/\//g, "-");
    const ownerCleaned = owner.replace(/\//g, "-");
    
    // Check for and delete issues that are no longer present
    await this.cleanupDeletedIssues(repo, ownerCleaned, repoCleaned, currentIssueNumbers);
    
    // Create or update issue files
    for (const issue of issues) {
      await this.createOrUpdateIssueFile(repo, ownerCleaned, repoCleaned, issue);
    }
  }
  
  /**
   * Create pull request files for a repository
   */
  public async createPullRequestFiles(
    repo: RepositoryTracking, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pullRequests: any[],
    currentPRNumbers: Set<string>
  ): Promise<void> {
    const [owner, repoName] = repo.repository.split("/");
    if (!owner || !repoName) return;
    
    const repoCleaned = repoName.replace(/\//g, "-");
    const ownerCleaned = owner.replace(/\//g, "-");
    
    // Check for and delete PRs that are no longer present
    await this.cleanupDeletedPullRequests(repo, ownerCleaned, repoCleaned, currentPRNumbers);
    
    // Create or update PR files
    for (const pr of pullRequests) {
      await this.createOrUpdatePullRequestFile(repo, ownerCleaned, repoCleaned, pr);
    }
  }
  
  /**
   * Filter issues based on repository settings
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public filterIssues(repo: RepositoryTracking, issues: any[]): any[] {
    return issues.filter((issue) => {
      // If no requirement set, include all issues
      if (!repo.requireAssignee && !repo.requireOpenedByIssue) {
        return true;
      }
      
      // Check assignee requirement
      if (repo.requireAssignee) {
        const assigneeNames = issue.assignees?.map((a: { login: string }) => a.login) || [];
        if (repo.assigneeMatch &&assigneeNames.length>0 && assigneeNames.some(
          (name: string) => name.toLowerCase() === repo.assigneeMatch.toLowerCase()
        )) {
          return true;
        }
      }
      
      // Check opened by requirement
      if (repo.requireOpenedByIssue) {
      
        if (repo.openedByIssueMatch && issue.user.login &&issue.user  &&
            issue.user.login.toLowerCase() == repo.openedByIssueMatch.toLowerCase()) {
          return true;
        }
      }
      
      return false;
    });
  }
  
  /**
   * Filter pull requests based on repository settings
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public filterPullRequests(repo: RepositoryTracking, pullRequests: any[]): any[] {
    return pullRequests.filter((pr) => {
      // If no requirements are set, include all PRs
      if (!repo.requireReviewer && !repo.requirePullRequestAssignee && !repo.requireOpenedByPR) {
        return true;
      }
      
      // Check reviewer requirement
      if (repo.requireReviewer) {
        const reviewerNames = pr.requested_reviewers?.map((r: { login: string }) => r.login) || [];
        if (repo.reviewerMatch && reviewerNames.length>0 && reviewerNames.some((name: string) => name.toLowerCase() === repo.reviewerMatch.toLowerCase())) {
          return true;
        }
      }
      
      // Check assignee requirement
      if (repo.requirePullRequestAssignee) {
        const assigneeNames = pr.assignees?.map((a: { login: string }) => a.login) || [];
        if (repo.pullRequestAssigneeMatch && assigneeNames.length>0 && assigneeNames.some((name: string) => name.toLowerCase() === repo.pullRequestAssigneeMatch.toLowerCase())) {
          return true;
        }
      }
      
      // Check opened by requirement
      if (repo.requireOpenedByPR) {
        if (repo.openedByPRMatch && pr.user.login && pr.user &&
            pr.user.login.toLowerCase() == repo.openedByPRMatch.toLowerCase()) {
          return true;
        }
      }
      
      return false;
    });
  }
  
  /**
   * Clean up empty folders after syncing
   */
  public async cleanupEmptyFolders(): Promise<void> {
    try {
      for (const repo of this.settings.repositories) {
        const [owner, repoName] = repo.repository.split("/");
        if (!owner || !repoName) continue;
        
        const repoCleaned = repoName.replace(/\//g, "-");
        const ownerCleaned = owner.replace(/\//g, "-");
        const issueFolder = `${repo.issueFolder}/${ownerCleaned}/${repoCleaned}`;
        const pullRequestFolder = `${repo.pullRequestFolder}/${ownerCleaned}/${repoCleaned}`;
        
        await this.cleanupEmptyIssueFolder(repo, issueFolder, ownerCleaned);
        await this.cleanupEmptyPullRequestFolder(repo, pullRequestFolder, ownerCleaned);
      }
    } catch (error: unknown) {
      this.noticeManager.error("Error cleaning up empty folders", error);
    }
  }
  
  // ----- Private helper methods -----
  
  private async cleanupDeletedIssues(
    repo: RepositoryTracking, 
    ownerCleaned: string, 
    repoCleaned: string, 
    currentIssueNumbers: Set<string>
  ): Promise<void> {
    const repoFolder = this.app.vault.getAbstractFileByPath(
      `${repo.issueFolder}/${ownerCleaned}/${repoCleaned}`
    );
    
    if (repoFolder) {
      const files = this.app.vault
        .getFiles()
        .filter(
          (file) =>
            file.path.startsWith(
              `${repo.issueFolder}/${ownerCleaned}/${repoCleaned}/`
            ) && file.extension === "md"
        );
      
      for (const file of files) {
        const fileName = file.name
          .replace(".md", "")
          .replace("Issue - ", "");
        if (!currentIssueNumbers.has(fileName)) {
          // Check if file has allowDelete property
          const fileContent = await this.app.vault.read(file);
          const properties = extractProperties(fileContent);
          const allowDelete = properties.allowDelete
            ? properties.allowDelete.toLowerCase().replace('"', '') === "true"
            : repo.allowDeleteIssue;
          
          if (allowDelete) {
            await this.app.fileManager.trashFile(file);
            this.noticeManager.info(
              `Deleted issue ${fileName} as it no longer exists in ${repo.repository}`
            );
          }
        }
      }
    }
  }
  
  private async cleanupDeletedPullRequests(
    repo: RepositoryTracking, 
    ownerCleaned: string, 
    repoCleaned: string, 
    currentPRNumbers: Set<string>
  ): Promise<void> {
    const repoFolder = this.app.vault.getAbstractFileByPath(
      `${repo.pullRequestFolder}/${ownerCleaned}/${repoCleaned}`
    );
    
    if (repoFolder) {
      const files = this.app.vault
        .getFiles()
        .filter(
          (file) =>
            file.path.startsWith(
              `${repo.pullRequestFolder}/${ownerCleaned}/${repoCleaned}/`
            ) && file.extension === "md"
        );
      
      for (const file of files) {
        const fileName = file.name
          .replace(".md", "")
          .replace("Pull Request - ", "");
        if (!currentPRNumbers.has(fileName)) {
          // Check if file has allowDelete property
          const fileContent = await this.app.vault.read(file);
          const properties = extractProperties(fileContent);
          const allowDelete = properties.allowDelete
            ? properties.allowDelete.toLowerCase().replace('"', '') === "true"
            : repo.allowDeletePullRequest;
          
          if (allowDelete) {
            await this.app.fileManager.trashFile(file);
            this.noticeManager.info(
              `Deleted pull request ${fileName} as it no longer exists in ${repo.repository}`
            );
          }
        }
      }
    }
  }
  
  private async createOrUpdateIssueFile(
    repo: RepositoryTracking, 
    ownerCleaned: string, 
    repoCleaned: string, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    issue: any
  ): Promise<void> {
    const fileName = `Issue - ${issue.number}.md`;
    
    // Create folders if they don't exist
    await this.ensureFolderExists(repo.issueFolder);
    await this.ensureFolderExists(`${repo.issueFolder}/${ownerCleaned}`);
    await this.ensureFolderExists(`${repo.issueFolder}/${ownerCleaned}/${repoCleaned}`);
    
    // Create or update the file
    const file = this.app.vault.getAbstractFileByPath(
      `${repo.issueFolder}/${ownerCleaned}/${repoCleaned}/${fileName}`
    );
    
    // Get comments for this issue
    const [owner, repoName] = repo.repository.split("/");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments = await this.gitHubClient.fetchIssueComments(owner, repoName, issue.number);
    
    let content = this.createIssueContent(issue, repo, comments);
    
    if (file) {
      if (file instanceof TFile) {
        const fileContent = await this.app.vault.read(file);
        const properties = extractProperties(fileContent);
        properties.assignees = issue.assignees?.map((a: { login: string }) => a.login) || [];

        const updateModeText = properties.updateMode;
        
        if (!updateModeText) {
          this.noticeManager.warning(`No valid update mode found for issue ${issue.number}. Using repository setting.`);
        }
        
        const updateMode = updateModeText 
          ? updateModeText.toLowerCase().replace('"', '') 
          : repo.issueUpdateMode;
        
        if (updateMode === "update") {
          content = `${mapToProperties(properties)}\n\n# ${escapeBody(issue.title, this.settings.escapeMode)}\n${issue.body ? escapeBody(issue.body, this.settings.escapeMode) : "No description found"}\n`;
          
          // Add comments section
          if (comments.length > 0) {
            content += this.formatComments(comments, this.settings.escapeMode);
          }
          
          await this.app.vault.modify(file, content);
          this.noticeManager.debug(`Updated issue ${issue.number}`);
        } else if (updateMode === "append") {
          content = `---\n### New status: "${issue.state}"\n\n# ${escapeBody(issue.title, this.settings.escapeMode)}\n${issue.body ? escapeBody(issue.body, this.settings.escapeMode) : "No description found"}\n`;
          
          // Add comments section
          if (comments.length > 0) {
            content += this.formatComments(comments, this.settings.escapeMode);
          }
          
          // Append new content after existing content
          const newContent = fileContent + "\n\n" + content;
          await this.app.vault.modify(file, newContent);
          this.noticeManager.debug(`Appended content to issue ${issue.number}`);
        } else {
          this.noticeManager.debug(`Skipped update for issue ${issue.number} (mode: ${updateMode})`);
        }
      }
    } else {
      await this.app.vault.create(
        `${repo.issueFolder}/${ownerCleaned}/${repoCleaned}/${fileName}`,
        content
      );
      this.noticeManager.debug(`Created issue file for ${issue.number}`);
    }
  }
  
  private async createOrUpdatePullRequestFile(
    repo: RepositoryTracking, 
    ownerCleaned: string, 
    repoCleaned: string, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pr: any
  ): Promise<void> {
    const fileName = `Pull Request - ${pr.number}.md`;
    
    // Create folders if they don't exist
    await this.ensureFolderExists(repo.pullRequestFolder);
    await this.ensureFolderExists(`${repo.pullRequestFolder}/${ownerCleaned}`);
    await this.ensureFolderExists(`${repo.pullRequestFolder}/${ownerCleaned}/${repoCleaned}`);
    
    // Create or update the file
    const file = this.app.vault.getAbstractFileByPath(
      `${repo.pullRequestFolder}/${ownerCleaned}/${repoCleaned}/${fileName}`
    );
    
    // Get comments for this PR
    const [owner, repoName] = repo.repository.split("/");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments = await this.gitHubClient.fetchPullRequestComments(owner, repoName, pr.number);
    
    let content = this.createPullRequestContent(pr, repo, comments);
    
    if (file) {
      if (file instanceof TFile) {
        const fileContent = await this.app.vault.read(file);
        const properties = extractProperties(fileContent);
        properties.assignees = pr.assignees?.map((a: { login: string }) => a.login) || [];
        properties.requested_reviewers = pr.requested_reviewers?.map((r: { login: string }) => r.login) || [];

        const updateModeText = properties.updateMode;
        
        if (!updateModeText) {
          this.noticeManager.warning(`No valid update mode found for PR ${pr.number}. Using repository setting.`);
        }
        
        const updateMode = updateModeText 
          ? updateModeText.toLowerCase().replace('"', '') 
          : repo.pullRequestUpdateMode;
        
        if (updateMode === "update") {
          content = `${mapToProperties(properties)}\n\n# ${escapeBody(pr.title, this.settings.escapeMode)}\n${pr.body ? escapeBody(pr.body, this.settings.escapeMode) : "No description found"}\n`;
          
          // Add comments section
          if (comments.length > 0) {
            content += this.formatComments(comments, this.settings.escapeMode);
          }
          
          await this.app.vault.modify(file, content);
          this.noticeManager.debug(`Updated PR ${pr.number}`);
        } else if (updateMode === "append") {
          content = `---\n### New status: "${pr.state}"\n\n# ${escapeBody(pr.title, this.settings.escapeMode)}\n${pr.body ? escapeBody(pr.body, this.settings.escapeMode) : "No description found"}\n`;
          
          // Add comments section
          if (comments.length > 0) {
            content += this.formatComments(comments, this.settings.escapeMode);
          }
          
          // Append new content after existing content
          const newContent = fileContent + "\n\n" + content;
          await this.app.vault.modify(file, newContent);
          this.noticeManager.debug(`Appended content to PR ${pr.number}`);
        } else {
          this.noticeManager.debug(`Skipped update for PR ${pr.number} (mode: ${updateMode})`);
        }
      }
    } else {
      await this.app.vault.create(
        `${repo.pullRequestFolder}/${ownerCleaned}/${repoCleaned}/${fileName}`,
        content
      );
      this.noticeManager.debug(`Created PR file for ${pr.number}`);
    }
  }
  
  private async ensureFolderExists(path: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(path);
    if (!folder) {
      await this.app.vault.createFolder(path);
      this.noticeManager.debug(`Created folder: ${path}`);
    }
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createIssueContent(issue: any, repo: RepositoryTracking, comments: any[]): string {
    return `---
title: "${escapeBody(issue.title, this.settings.escapeMode)}"
status: "${issue.state}"
created: "${this.settings.dateFormat !== ""
      ? format(new Date(issue.created_at), this.settings.dateFormat)
      : new Date(issue.created_at).toLocaleString()
    }"
url: "${issue.html_url}"
opened_by: "${issue.user?.login}"
assignees: [${(issue.assignees?.map(
      (assignee: { login: string }) => '"' + assignee.login + '"'
    ) || []).join(", ")}]
updateMode: "${repo.issueUpdateMode}"
allowDelete: ${repo.allowDeleteIssue ? true : false}
---

# ${escapeBody(issue.title, this.settings.escapeMode)}
${issue.body ? escapeBody(issue.body, this.settings.escapeMode) : "No description found"}

${this.formatComments(comments, this.settings.escapeMode)}
`;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createPullRequestContent(pr: any, repo: RepositoryTracking, comments: any[]): string {
    return `---
title: "${escapeBody(pr.title, this.settings.escapeMode)}"
status: "${pr.state}"
created: "${this.settings.dateFormat !== ""
      ? format(new Date(pr.created_at), this.settings.dateFormat)
      : new Date(pr.created_at).toLocaleString()
    }"
url: "${pr.html_url}"
opened_by: "${pr.user?.login}"
assignees: [${(pr.assignees?.map(
      (assignee: { login: string }) => '"' + assignee.login + '"'
    ) || []).join(", ")}]
requested_reviewers: [${(pr.requested_reviewers?.map(
      (reviewer: { login: string }) => '"' + reviewer.login + '"'
    ) || []).join(", ")}]
updateMode: "${repo.pullRequestUpdateMode}"
allowDelete: ${repo.allowDeletePullRequest ? true : false}
---

# ${escapeBody(pr.title, this.settings.escapeMode)}
${pr.body ? escapeBody(pr.body, this.settings.escapeMode) : "No description found"}

${this.formatComments(comments, this.settings.escapeMode)}
`;
  }
  
  private async cleanupEmptyIssueFolder(repo: RepositoryTracking, issueFolder: string, ownerCleaned: string): Promise<void> {
    const issueFolderContent = this.app.vault.getAbstractFileByPath(issueFolder);
    
    if (issueFolderContent instanceof TFolder) {
      const files = issueFolderContent.children;
      
      if (!repo.trackIssues) {
        for (const file of files) {
          if (file instanceof TFile) {
            // Read the file properties
            const fileContent = await this.app.vault.read(file);
            const properties = extractProperties(fileContent);
            const allowDelete = properties.allowDelete
              ? properties.allowDelete.toLowerCase().replace('"', '') === "true"
              : false;
              
            if (allowDelete) {
              await this.app.fileManager.trashFile(file);
              this.noticeManager.debug(`Deleted file ${file.name} from untracked repo`);
              files.splice(files.indexOf(file), 1);
            }
          }
        }
      }
      
      if (files.length === 0) {
        this.noticeManager.info(`Deleting empty folder: ${issueFolder}`);
        const folder = this.app.vault.getAbstractFileByPath(issueFolder);
        if (folder instanceof TFolder && folder.children.length === 0) {
          await this.app.vault.delete(folder, true);
        }
      }
      
      const issueOwnerFolder = this.app.vault.getAbstractFileByPath(
        `${repo.issueFolder}/${ownerCleaned}`
      );
      
      if (issueOwnerFolder instanceof TFolder) {
        const files = issueOwnerFolder.children;
        if (files.length === 0) {
          this.noticeManager.info(`Deleting empty folder: ${issueOwnerFolder.path}`);
          await this.app.vault.delete(issueOwnerFolder, true);
        }
      }
    }
  }
  
  private async cleanupEmptyPullRequestFolder(repo: RepositoryTracking, pullRequestFolder: string, ownerCleaned: string): Promise<void> {
    const pullRequestFolderContent = this.app.vault.getAbstractFileByPath(pullRequestFolder);
    
    if (pullRequestFolderContent instanceof TFolder) {
      const files = pullRequestFolderContent.children;
      
      if (!repo.trackPullRequest) {
        for (const file of files) {
          if (file instanceof TFile) {
            // Read the file properties
            const fileContent = await this.app.vault.read(file);
            const properties = extractProperties(fileContent);
            const allowDelete = properties.allowDelete
              ? properties.allowDelete.toLowerCase().replace('"', '') === "true"
              : false;
              
            if (allowDelete) {
              await this.app.fileManager.trashFile(file);
              this.noticeManager.debug(`Deleted file ${file.name} from untracked repo`);
              files.splice(files.indexOf(file), 1);
            }
          }
        }
      }
      
      if (files.length === 0) {
        this.noticeManager.info(`Deleting empty folder: ${pullRequestFolder}`);
        const folder = this.app.vault.getAbstractFileByPath(pullRequestFolder);
        if (folder instanceof TFolder && folder.children.length === 0) {
          await this.app.vault.delete(folder, true);
        }
      }
      
      const pullRequestOwnerFolder = this.app.vault.getAbstractFileByPath(
        `${repo.pullRequestFolder}/${ownerCleaned}`
      );
      
      if (pullRequestOwnerFolder instanceof TFolder) {
        const files = pullRequestOwnerFolder.children;
        if (files.length === 0) {
          this.noticeManager.info(`Deleting empty folder: ${pullRequestOwnerFolder.path}`);
          await this.app.vault.delete(pullRequestOwnerFolder, true);
        }
      }
    }
  }
  
  /**
   * Format comments section for issues and pull requests
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatComments(comments: any[], escapeMode: "disabled" | "normal" | "strict" | "veryStrict"): string {
    if (!comments || comments.length === 0) {
      return '';
    }
    
    // Sort comments by created date
    comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    let commentSection = '\n## Comments\n\n';
    
    comments.forEach(comment => {
      const createdAt = this.settings.dateFormat !== "" 
        ? format(new Date(comment.created_at), this.settings.dateFormat)
        : new Date(comment.created_at).toLocaleString();
      
      const username = comment.user?.login || 'Unknown User';
      
      if (comment.is_review_comment) {
        // This is a PR line comment
        commentSection += `### ${username} commented on line ${comment.line || 'N/A'} of file \`${comment.path || 'unknown'}\` (${createdAt}):\n\n`;
      } else {
        // This is a regular issue/PR comment
        commentSection += `### ${username} commented (${createdAt}):\n\n`;
      }
      
      // Add the comment body
      commentSection += `${escapeBody(comment.body || 'No content', escapeMode)}\n\n---\n\n`;
    });
    
    return commentSection;
  }
} 