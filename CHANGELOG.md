# Changelog

All notable changes to the GitHub Tracker plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-27

### Added

-   Filter tracked issues and pull requests by label, per repository
-   Manually track individual issues and pull requests by repository and number

### Security

-   Updated all dependencies; `npm audit` reports no known vulnerabilities

## [1.1.2] - 2025-12-09

### Fixed

-   Updated dependencies

## [1.1.0] - 2025-03-21

### Fixed

-   Fixed issue where filtering by assignee, reviewer, and opened by was not working correctly

## [1.0.0] - 2025-03-19

### Added

-   Initial release of GitHub Tracker plugin
-   Track GitHub issues and pull requests in Obsidian notes
-   Configurable repository tracking with filtering options
-   Automatically sync on startup
-   Customizable content security options
-   CSS styling with variables for easier customization
-   Ribbon icon and command palette integration

### Security

-   Multiple content escaping modes for handling GitHub content
-   Warning dialog when using less secure options
