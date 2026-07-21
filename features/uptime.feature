Feature: Website uptime checking
  As a user of the web-insights server
  I want to check whether a website is reachable
  So that I know if it is up or down

  Scenario: A healthy website is reported as up
    Given a website that responds with status 200
    When I check its uptime
    Then the result should say the site is up
    And the status code should be 200

  Scenario: A failing website is reported as down
    Given a website that responds with status 500
    When I check its uptime
    Then the result should say the site is down