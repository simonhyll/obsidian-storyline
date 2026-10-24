Feature: Timeline filtering

  As an author viewing the timeline,
  I want to filter scenes and events by type, tags, and time range,
  so that I can focus on the relevant parts of my story.

  Scenario: Filter to show only scenes
    Given I have an active Book with 3 scenes and 2 events
    When I filter the timeline to show only scenes
    Then only scenes are visible in the timeline
    And no events are visible in the timeline

  Scenario: Filter to show only events
    Given I have an active Book with 3 scenes and 2 events
    When I filter the timeline to show only events
    Then only events are visible in the timeline
    And no scenes are visible in the timeline

  Scenario: Filter by tag
    Given I have scenes with tags "action" and "dialogue"
    And I have events with tag "action"
    When I filter the timeline by tag "action"
    Then only items with tag "action" are visible
    And items without tag "action" are excluded

  Scenario: Filter by time range
    Given I have scenes with various dates
    When I filter the timeline by time range "2024-06-01" to "2024-08-31"
    Then only scenes within the time range are visible
    And scenes outside the time range are excluded

  Scenario: Combine entity type and tag filters
    Given I have scenes and events with various tags
    When I filter to show only scenes with tag "climax"
    Then only scenes with tag "climax" are visible
    And events are not visible
    And scenes without tag "climax" are excluded

  Scenario: Clear all filters
    Given I have an active Book with scenes and events
    And active filters on the timeline
    When I clear all filters
    Then all scenes and events are visible again
    And no filters are active

  Scenario: Event ownership visibility respects book context
    Given I have timeline books in the same universe
    And a universe-owned event
    And a book-owned event for the first book only
    When I view the timeline for the first book
    Then the universe-owned event is visible
    And the book-owned event is visible
    When I view the timeline for the second book
    Then the universe-owned event is visible
    And the book-owned event for the first book is not visible

  Scenario: Canonical events are deduplicated
    Given I have 2 books referencing the same event
    When I view the filtered multi-book timeline
    Then the shared event appears only once

  Scenario: Save and restore filter configuration via Saved View
    Given I have an active Book with scenes and events
    And I have applied filters to the timeline
    When I save the filter view as "Filtered View"
    And I change the filters
    And I restore the filter view "Filtered View"
    Then the original filters are restored
    And the timeline shows the filtered results

  Scenario: Filtered timeline does not modify Scene files
    Given I have a Book with 3 scenes for filtering
    And I capture scene contents for filter test
    When I apply filters to the timeline
    Then scene files remain unchanged after filtering

  Scenario: Empty filter result shows helpful message
    Given I have scenes with tag "action" only
    When I filter by tag "nonexistent"
    Then a message explains no items match the filters
    And a clear filters option is available
