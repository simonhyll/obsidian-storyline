Feature: Project creation and management

  As an author creating new projects in StoryLine,
  I want to create books, series, and universes correctly,
  so that my story hierarchy is properly organized.

  Scenario: Creating a new book with a valid title
    Given I enter a book title "My Novel"
    When I create the book
    Then the book is created with a valid UUID
    And the book folder structure is created
    And the book becomes the active project

  Scenario: Creating a book with an empty title fails
    Given I enter an empty book title
    When I try to create the book
    Then an error is shown
    And no files are created

  Scenario: Creating a book with a new series
    Given I enter a book title "My Novel"
    And I select to create a new series "My Series"
    When I create the book
    Then the book is created in the new series
    And the series is created with a valid UUID

  Scenario: Creating a book in an existing series
    Given an existing series "Existing Series"
    And I enter a book title "My Novel"
    And I select series "Existing Series"
    When I create the book
    Then the book is created in "Existing Series"

  Scenario: Creating a new series
    Given I enter a series name "My Series"
    When I create the series
    Then the series is created with a valid UUID

  Scenario: Creating a new universe
    Given I enter a universe name "My Universe"
    When I create the universe
    Then the universe is created with a valid UUID

  Scenario: Cancelling project creation
    Given I have opened the project creation dialog
    When I cancel
    Then no files are created
    And the dialog closes

  Scenario: Double-click create only creates once
    Given I enter a book title "My Novel"
    When I click create twice rapidly
    Then exactly one book is created

  Scenario: Async dropdown race condition is handled
    Given I change the universe selection quickly
    When the async results arrive out of order
    Then only the latest result updates the dropdown
