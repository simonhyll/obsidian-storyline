Feature: Changelog generation

  As a developer maintaining StoryLine,
  I want changelog entries to be generated from commit messages,
  so that release notes are always up to date.

  Scenario: Preview shows changes without modifying files
    Given conventional commit messages
    When I run changelog preview
    Then the output shows grouped changes
    And no files are modified

  Scenario: Feature commits are grouped under Features
    Given a commit message "feat(timeline): add date navigation"
    When I generate the changelog
    Then the entry appears under Features

  Scenario: Fix commits are grouped under Bug Fixes
    Given a commit message "fix(events): preserve canonical ownership"
    When I generate the changelog
    Then the entry appears under Bug Fixes

  Scenario: Breaking changes are highlighted
    Given a commit message "feat!: remove legacy format"
    When I generate the changelog
    Then the entry is marked as a breaking change

  Scenario: Non-conforming commits are handled gracefully
    Given a commit message "random commit message"
    When I generate the changelog
    Then the entry appears under Other Changes

  Scenario: Duplicate prevention on repeated generation
    Given I have prepared changelog for version "1.0.0"
    When I prepare changelog for version "1.0.0" again
    Then a changelog error is shown
    And no changes are made

  Scenario: Existing tag protection
    Given a git tag "1.0.0" exists
    When I try to prepare changelog for version "1.0.0"
    Then a changelog error is shown
    And the tag is not moved
