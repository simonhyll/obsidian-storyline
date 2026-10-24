Feature: Timeline navigation and filtering

  As an author viewing the timeline,
  I want to navigate through scenes and events correctly,
  so that I can understand the flow of my story.

  Scenario: Navigating to the first item
    Given the timeline contains 3 scenes
    When I navigate to the first item
    Then the first scene is selected

  Scenario: Navigating to the last item
    Given the timeline contains 3 scenes
    When I navigate to the last item
    Then the last scene is selected

  Scenario: Navigating forward from current item
    Given the timeline contains 3 scenes
    And I am viewing the first scene
    When I navigate forward
    Then the second scene is selected

  Scenario: Navigating backward from current item
    Given the timeline contains 3 scenes
    And I am viewing the third scene
    When I navigate backward
    Then the second scene is selected

  Scenario: Navigating forward at the end wraps or stops
    Given the timeline contains 3 scenes
    And I am viewing the last scene
    When I navigate forward
    Then no new scene is selected

  Scenario: Filtering scenes by book
    Given 2 books in the same universe
    And scenes from both books
    When I filter to show only the first book
    Then only scenes from the first book are visible

  Scenario: Multi-book timeline shows all scenes chronologically
    Given 2 books in the same universe
    And scenes with different dates from both books
    When I view the multi-book timeline
    Then all scenes appear in chronological order

  Scenario: Empty timeline has no items
    Given an empty timeline
    When I request the items
    Then no items are returned
