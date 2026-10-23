Feature: Universe and Series hierarchy

  As an author managing multiple stories,
  I want to organize books into series and universes,
  so that my related stories are properly connected.

  Scenario: Book belongs to a universe
    Given I create a book "My Novel" in universe "My Universe"
    Then the book universe ID matches "My Universe"

  Scenario: Book belongs to a series in a universe
    Given I create a series "My Series" in universe "My Universe"
    And I create a book "My Novel" in series "My Series"
    Then the book belongs to series "My Series"
    And the book universe ID matches "My Universe"

  Scenario: Series belongs to a universe
    Given I create a series "My Series" in universe "My Universe"
    Then the series universe ID matches "My Universe"

  Scenario: Books from different universes are isolated
    Given a book in universe "Alpha"
    And a book in universe "Beta"
    When I view the timeline for "Alpha"
    Then only scenes from universe "Alpha" are visible

  Scenario: Universe UUID is stable
    Given I create a universe "My Universe"
    When I reload the universe
    Then the universe UUID remains the same

  Scenario: Legacy settings are migrated correctly
    Given old project settings in the legacy format
    When I load the plugin
    Then the settings are migrated to the new format

  Scenario: Project restoration after restart
    Given an existing active book "My Novel"
    When I restart the plugin
    Then the active book is restored to "My Novel"
