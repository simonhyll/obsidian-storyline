Feature: Import and export

  As an author managing my story data,
  I want to import and export my manuscript,
  so that I can backup and migrate my work.

  Scenario: Exporting scenes to markdown
    Given 3 scenes in the active book
    When I export the scenes
    Then all scenes are exported as markdown files

  Scenario: Export range selection
    Given 5 scenes in the timeline
    When I select a date range for export
    Then only scenes within the range are exported

  Scenario: Import from Scrivener is available on desktop
    Given I am on a desktop platform
    When I open the import menu
    Then Scrivener import is available

  Scenario: Import from Scrivener is hidden on mobile
    Given I am on a mobile platform
    When I open the import menu
    Then Scrivener import is not available
