Feature: Timeline multi-book chronology

  As an author working on multiple books in the same universe,
  I want to see scenes and events from all books arranged chronologically,
  so that I can verify the timeline consistency across my work.

  Scenario: Multi-book chronology
    Given 2 Books belong to the same Universe
    And their Scenes have different dates
    And a canonical Universe Event exists between those dates
    When the author selects both Books in Timeline
    Then the Scenes and Event appear chronologically
    And the active Book is not changed

  Scenario: Universe isolation
    Given Books belong to different Universes
    When the author opens the multi-book selector
    Then only compatible Books are selectable
    And canonical Events from unrelated Universes are excluded
