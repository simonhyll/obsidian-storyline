Feature: TimeSpan calculations and date precision

  As an author working with dates in StoryLine,
  I want dates to be parsed, compared and validated correctly,
  so that my timeline reflects the true chronological order of my story.

  Scenario Outline: Parsing a date string produces a valid TimeSpan
    Given I parse the date "<date>"
    Then the result is a valid TimeSpan
    And the precision is "<precision>"

    Examples:
      | date       | precision |
      | 2000-01-15 | day       |
      | 2000-06    | month     |
      | 2000       | year      |

  Scenario: Comparing two dates where the first is earlier
    Given I have a date "2000-01-15"
    And another date "2000-03-20"
    When I compare the dates
    Then the first date is before the second

  Scenario: Comparing two dates where the first is later
    Given I have a date "2000-03-20"
    And another date "2000-01-15"
    When I compare the dates
    Then the first date is after the second

  Scenario: Comparing two equal dates
    Given I have a date "2000-01-15"
    And another date "2000-01-15"
    When I compare the dates
    Then the dates are equal

  Scenario: Validating an invalid TimeSpan
    Given I create an invalid TimeSpan
    When I validate it
    Then a validation error is reported

  Scenario Outline: TimeSpan kind determines comparison behavior
    Given I have a TimeSpan of kind "<kind>"
    When I inspect its structure
    Then it has the expected properties for "<kind>"

    Examples:
      | kind     |
      | instant  |
      | range    |
      | fuzzy    |

  Scenario: Parsing an invalid date returns null
    Given I parse the date "not-a-date"
    Then the result is null
