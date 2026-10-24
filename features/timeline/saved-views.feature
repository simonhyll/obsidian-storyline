Feature: Saved Timeline Views

  Saved Views let the author save, restore, rename, and delete Timeline
  configuration presets without modifying any Scene or Event data.

  Scenario: Save current Timeline configuration
    Given I have an active Book with scenes
    And the Timeline is configured with:
      | setting        | value         |
      |----------------|---------------|
      | order          | chronological |
      | swimlaneMode   | true          |
      | swimlaneGroupBy| character     |
      | zoomLevel      | 1.5           |
    When I save the current view as "My Chronological View"
    Then a saved view named "My Chronological View" exists
    And the saved view preserves the configuration:
      | setting        | value         |
      |----------------|---------------|
      | order          | chronological |
      | swimlaneMode   | true          |
      | swimlaneGroupBy| character     |
      | zoomLevel      | 1.5           |

  Scenario: Change Timeline and restore a saved view
    Given I have an active Book with scenes
    And a saved view named "Reading View" with configuration:
      | setting        | value   |
      |----------------|---------|
      | order          | reading |
      | swimlaneMode   | false   |
      | swimlaneGroupBy| pov     |
      | zoomLevel      | 1.0     |
    When I change the Timeline to chronological order with swimlanes
    And I restore the saved view "Reading View"
    Then the Timeline order is "reading"
    And swimlane mode is disabled
    And the swimlane group-by is "pov"
    And the zoom level is 1.0

  Scenario: Saved view does not modify Scene files
    Given I have an active Book with 3 scenes
    And I capture the original scene file contents
    And I create a saved view named "Test View"
    When I restore the saved view "Test View"
    Then all scene files remain byte-for-byte unchanged

  Scenario: Rename a saved view
    Given I create a saved view named "Old Name"
    When I rename the saved view to "New Name"
    Then a saved view named "New Name" exists
    And no saved view named "Old Name" exists
    And the renamed view preserves the original configuration

  Scenario: Delete a saved view
    Given I create a saved view named "To Delete"
    When I delete the saved view "To Delete"
    Then no saved view named "To Delete" exists

  Scenario: Saved view survives restart
    Given I create a saved view named "Persistent View"
    When I simulate a plugin restart
    Then the saved view "Persistent View" is still available
    And the restored view preserves the original configuration
