Feature: Event management

  As an author managing events in StoryLine,
  I want to create, update and delete events correctly,
  so that my story's key moments are properly tracked.

  Scenario: Creating an event with a valid date
    Given I create an event named "The Battle" with date "2000-06-15"
    Then the event is created with a valid UUID
    And the event ownership is set correctly
    And the event file is persisted

  Scenario: Creating an event without a date
    Given I create an event named "Mystery Event" without a date
    Then the event is created with an uncertain date

  Scenario: Updating an event's date
    Given an existing event "The Battle" dated "2000-06-15"
    When I update the date to "2000-07-20"
    Then the event date is updated
    And the event file is re-persisted

  Scenario: Deleting an event
    Given an existing event "The Battle"
    When I delete the event
    Then the event file is removed
    And the event is no longer in the timeline

  Scenario: Event ownership belongs to universe
    Given I create a canonical event "Universe Event"
    Then the event owner is the universe
    And the event is visible across all books in the universe

  Scenario: Event ownership belongs to book
    Given I create a book-scoped event "Book Event"
    Then the event owner is the active book
    And the event is only visible in that book

  Scenario: Event manager loads existing events
    Given 3 existing event files
    When I load the events
    Then all 3 events are loaded correctly
