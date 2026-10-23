Feature: Event and Scene creation safety

  As an author creating events and scenes in StoryLine,
  I want to ensure files are created correctly and safely,
  so that my manuscript data remains consistent.

  Scenario: Canonical Event persistence
    Given the author has a Universe with an Events folder
    When they create a canonical Event named "The Great Battle" with date "2000-06-15"
    Then exactly one Event file is persisted
    And its UUID, TimeSpan and ownership are correct

  Scenario: Scene creation safety
    Given the author is viewing multiple Books
    When they create a new Scene named "New Scene"
    Then the correct owning Book must be explicitly established
    And no Scene is accidentally written into another Book

  Scenario: Cancellation
    Given an Event or Scene creation dialog is open
    When the author cancels
    Then no files are created or modified
