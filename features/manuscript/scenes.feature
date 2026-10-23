Feature: Scene management

  As an author writing scenes,
  I want to create and manage scenes correctly,
  so that my manuscript is properly organized.

  Scenario: Creating a scene in the active book
    Given an active book "My Novel"
    When I create a scene "Chapter One"
    Then the scene is created in the book's scene folder
    And the scene has a valid UUID
    And the scene belongs to "My Novel"

  Scenario: Scene cannot be created without an active book
    Given no active book is selected
    When I try to create a scene
    Then a scene error is shown
    And no scene is created

  Scenario: Scene metadata is preserved
    Given a scene "Chapter One" with date "2000-01-15"
    When I reload the scene
    Then the scene date is preserved
    And the scene UUID is preserved

  Scenario: Scene ordering is maintained
    Given 3 scenes in chronological order
    When I view the manuscript
    Then the scenes appear in the correct order

  Scenario: Entity UUID identity is stable
    Given a scene with UUID "550e8400-e29b-41d4-a716-446655440000"
    When I update the scene
    Then the UUID remains "550e8400-e29b-41d4-a716-446655440000"
