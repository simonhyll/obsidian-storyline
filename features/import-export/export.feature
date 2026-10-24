Feature: Import and export

  As an author managing my story data,
  I want to import and export my manuscript,
  so that I can backup and migrate my work.

  Scenario: Export manuscript as combined markdown
    Given 3 scenes in the active book
    When I export the manuscript as markdown
    Then a single combined markdown file is created
    And the file contains all scene bodies in order

  Scenario: Export range selection by sequence
    Given 5 scenes with distinct sequence numbers
    When I export scenes 2 through 4 only
    Then only the selected scenes are included in the export

  Scenario: Scrivener import is available on desktop
    Given the Scrivener importer is checked for availability
    When running on a desktop platform
    Then Scrivener import is available

  Scenario: Scrivener import is hidden on mobile
    Given the Scrivener importer is checked for availability
    When running on a mobile platform
    Then Scrivener import is not available
