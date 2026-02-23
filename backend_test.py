#!/usr/bin/env python3

import requests
import sys
import json
from typing import Dict, Any, List
from datetime import datetime

class F1IntelligenceAPITester:
    def __init__(self, base_url: str = "https://racing-intelligence.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
                 params: Dict = None, data: Dict = None, validate_response: callable = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            response_data = None
            
            if success:
                try:
                    response_data = response.json()
                    if validate_response:
                        validation_result = validate_response(response_data)
                        if validation_result is not True:
                            success = False
                            print(f"   ❌ Validation failed: {validation_result}")
                        else:
                            print(f"   ✅ Passed")
                except json.JSONDecodeError as e:
                    success = False
                    print(f"   ❌ Failed - Invalid JSON response: {e}")
                except Exception as e:
                    success = False
                    print(f"   ❌ Failed - Validation error: {e}")
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}...")

            if success:
                self.tests_passed += 1
            else:
                self.failed_tests.append({
                    'name': name,
                    'url': url,
                    'expected_status': expected_status,
                    'actual_status': response.status_code,
                    'response_text': response.text[:500] if hasattr(response, 'text') else 'No response'
                })

            return success, response_data

        except requests.exceptions.Timeout:
            print(f"   ❌ Failed - Request timeout (30s)")
            self.failed_tests.append({'name': name, 'url': url, 'error': 'Timeout'})
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Failed - Connection error")
            self.failed_tests.append({'name': name, 'url': url, 'error': 'Connection error'})
            return False, {}
        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            self.failed_tests.append({'name': name, 'url': url, 'error': str(e)})
            return False, {}

    def validate_kpi_stats(self, data: Dict) -> bool:
        """Validate KPI stats structure"""
        required_fields = ['total_races', 'total_wins', 'total_podiums', 'total_poles', 
                          'total_points', 'dnf_rate', 'total_drivers', 'total_constructors']
        for field in required_fields:
            if field not in data:
                return f"Missing field: {field}"
            if not isinstance(data[field], (int, float)):
                return f"Invalid type for {field}: {type(data[field])}"
        return True

    def validate_driver_stats(self, data: List) -> bool:
        """Validate driver stats structure"""
        if not isinstance(data, list):
            return f"Expected list, got {type(data)}"
        if len(data) == 0:
            return "Empty driver stats list"
        
        required_fields = ['driverId', 'driverRef', 'forename', 'surname', 'wins', 'podiums', 'total_points']
        sample = data[0]
        for field in required_fields:
            if field not in sample:
                return f"Missing field in driver stats: {field}"
        return True

    def validate_goat_leaderboard(self, data: List) -> bool:
        """Validate GOAT leaderboard structure"""
        if not isinstance(data, list):
            return f"Expected list, got {type(data)}"
        if len(data) == 0:
            return "Empty GOAT leaderboard"
            
        required_fields = ['driverId', 'score', 'breakdown', 'stats']
        sample = data[0]
        for field in required_fields:
            if field not in sample:
                return f"Missing field in GOAT leaderboard: {field}"
        
        # Check breakdown structure
        if not isinstance(sample['breakdown'], dict):
            return "breakdown should be a dict"
        if not isinstance(sample['stats'], dict):
            return "stats should be a dict"
            
        return True

    def validate_head_to_head(self, data: Dict) -> bool:
        """Validate head-to-head structure"""
        required_fields = ['driver1', 'driver2', 'quali_h2h', 'race_h2h', 'points_h2h', 'common_races']
        for field in required_fields:
            if field not in data:
                return f"Missing field in H2H: {field}"
        
        if not isinstance(data['common_races'], int):
            return "common_races should be an integer"
        if data['common_races'] <= 0:
            return "common_races should be positive"
            
        return True

    def validate_race_results(self, data: List) -> bool:
        """Validate race results structure"""
        if not isinstance(data, list):
            return f"Expected list, got {type(data)}"
        if len(data) == 0:
            return "Empty race results"
            
        required_fields = ['driverId', 'forename', 'surname', 'constructorName', 'grid']
        sample = data[0]
        for field in required_fields:
            if field not in sample:
                return f"Missing field in race results: {field}"
        return True

    def validate_driver_profile(self, data: Dict) -> bool:
        """Validate driver profile structure"""
        required_fields = ['driver', 'stats']
        for field in required_fields:
            if field not in data:
                return f"Missing field in driver profile: {field}"
        
        if not isinstance(data['driver'], dict):
            return "driver should be a dict"
        if not isinstance(data['stats'], dict):
            return "stats should be a dict"
            
        return True

    def validate_constructor_profile(self, data: Dict) -> bool:
        """Validate constructor profile structure"""
        required_fields = ['constructor', 'stats', 'timeline', 'top_drivers']
        for field in required_fields:
            if field not in data:
                return f"Missing field in constructor profile: {field}"
        
        if not isinstance(data['constructor'], dict):
            return "constructor should be a dict"
        if not isinstance(data['stats'], dict):
            return "stats should be a dict"
        if not isinstance(data['top_drivers'], list):
            return "top_drivers should be a list"
            
        # Check constructor name
        constructor = data['constructor']
        if 'name' not in constructor:
            return "Missing 'name' in constructor"
        
        # Check stats structure
        stats = data['stats']
        required_stat_fields = ['wins', 'podiums', 'poles', 'total_points', 'races', 'championships']
        for field in required_stat_fields:
            if field not in stats:
                return f"Missing stat field: {field}"
                
        return True

    def validate_season_profile(self, data: Dict) -> bool:
        """Validate season profile structure"""
        required_fields = ['year', 'driver_standings', 'constructor_standings', 'race_winners']
        for field in required_fields:
            if field not in data:
                return f"Missing field in season profile: {field}"
        
        # Check year
        if not isinstance(data['year'], int):
            return "year should be an integer"
        
        # Check driver standings
        driver_standings = data['driver_standings']
        if not isinstance(driver_standings, list):
            return "driver_standings should be a list"
        if len(driver_standings) == 0:
            return "driver_standings should not be empty"
            
        # Check first driver standing structure
        first_driver = driver_standings[0]
        required_driver_fields = ['position', 'points', 'driverId', 'forename', 'surname']
        for field in required_driver_fields:
            if field not in first_driver:
                return f"Missing driver standing field: {field}"
        
        # Check constructor standings
        constructor_standings = data['constructor_standings']
        if not isinstance(constructor_standings, list):
            return "constructor_standings should be a list"
            
        return True

    def validate_rivalry_circuit_breakdown(self, data: Dict) -> bool:
        """Validate rivalry circuit breakdown structure"""
        required_fields = ['driver1', 'driver2', 'circuit_breakdown', 'common_races']
        for field in required_fields:
            if field not in data:
                return f"Missing field in rivalry: {field}"
        
        # Check basic H2H structure first
        h2h_result = self.validate_head_to_head(data)
        if h2h_result is not True:
            return h2h_result
        
        # Check circuit breakdown
        circuit_breakdown = data['circuit_breakdown']
        if not isinstance(circuit_breakdown, list):
            return "circuit_breakdown should be a list"
        if len(circuit_breakdown) == 0:
            return "circuit_breakdown should not be empty"
            
        # Check first circuit structure
        first_circuit = circuit_breakdown[0]
        required_circuit_fields = ['circuitId', 'name', 'country', 'races', 'd1_quali_wins', 'd2_quali_wins', 'd1_race_wins', 'd2_race_wins', 'd1_wins', 'd2_wins']
        for field in required_circuit_fields:
            if field not in first_circuit:
                return f"Missing circuit breakdown field: {field}"
        
        # Check that races > 0
        if first_circuit['races'] <= 0:
            return "Circuit races should be positive"
            
        return True

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting F1 Intelligence API Tests")
        print(f"   Base URL: {self.base_url}")
        print("=" * 60)

        # Basic health check
        self.run_test("API Health Check", "GET", "/api/")

        # Metadata endpoints
        print("\n📋 TESTING METADATA ENDPOINTS")
        print("-" * 40)
        
        self.run_test("Get Seasons", "GET", "/api/seasons")
        self.run_test("Get Drivers", "GET", "/api/drivers", params={"limit": 10})
        self.run_test("Get Constructors", "GET", "/api/constructors", params={"limit": 10})
        self.run_test("Get Circuits", "GET", "/api/circuits", params={"limit": 10})
        self.run_test("Get Races", "GET", "/api/races", params={"limit": 10})

        # Analytics endpoints
        print("\n📊 TESTING ANALYTICS ENDPOINTS")
        print("-" * 40)
        
        self.run_test(
            "Overview Stats", "GET", "/api/stats/overview", 
            validate_response=self.validate_kpi_stats
        )
        self.run_test(
            "Driver Stats", "GET", "/api/stats/drivers", 
            params={"limit": 20}, validate_response=self.validate_driver_stats
        )
        self.run_test("Constructor Stats", "GET", "/api/stats/constructors", params={"limit": 15})

        # GOAT Engine
        print("\n🏆 TESTING GOAT ENGINE")
        print("-" * 40)
        
        self.run_test(
            "GOAT Leaderboard", "GET", "/api/goat/leaderboard",
            params={"limit": 50}, validate_response=self.validate_goat_leaderboard
        )

        # Head-to-head testing (Hamilton vs Verstappen)
        print("\n⚔️ TESTING HEAD-TO-HEAD")
        print("-" * 40)
        
        self.run_test(
            "Hamilton vs Verstappen H2H", "GET", "/api/rivalry/1/830",
            validate_response=self.validate_head_to_head
        )

        # Race deep dive - Test with a recent race
        print("\n🏁 TESTING RACE DEEP DIVE")
        print("-" * 40)
        
        # Get a race ID first
        success, races_data = self.run_test("Get Recent Races", "GET", "/api/races", params={"limit": 1})
        if success and races_data and len(races_data) > 0:
            race_id = races_data[0]['raceId']
            print(f"   Using race ID: {race_id}")
            
            self.run_test(f"Race Details ({race_id})", "GET", f"/api/race/{race_id}")
            self.run_test(
                f"Race Results ({race_id})", "GET", f"/api/race/{race_id}/results",
                validate_response=self.validate_race_results
            )
            self.run_test(f"Race Lap Times ({race_id})", "GET", f"/api/race/{race_id}/lap-times")
            self.run_test(f"Race Pit Stops ({race_id})", "GET", f"/api/race/{race_id}/pit-stops")
            self.run_test(f"Race Movers ({race_id})", "GET", f"/api/race/{race_id}/movers")

        # Story Explorer
        print("\n📖 TESTING STORY EXPLORER")
        print("-" * 40)
        
        # Test Hamilton profile (driver ID 1)
        self.run_test(
            "Hamilton Driver Profile", "GET", "/api/driver/1/profile",
            validate_response=self.validate_driver_profile
        )
        
        # Test circuit profile (Monaco - circuit ID 6)
        self.run_test("Monaco Circuit Profile", "GET", "/api/circuit/6/profile")
        
        # Test facts generation
        self.run_test(
            "Generate Driver Facts", "GET", "/api/facts/generate",
            params={"entity_type": "driver", "entity_id": 1, "count": 5}
        )

        # NEW FEATURES TESTING
        print("\n🆕 TESTING NEW FEATURES")
        print("-" * 40)
        
        # Test Constructor Profile (Mercedes - ID 131)
        self.run_test(
            "Constructor Profile - Mercedes", "GET", "/api/constructor/131/profile",
            validate_response=self.validate_constructor_profile
        )
        
        # Test Season Profile (2023 season)
        self.run_test(
            "Season Profile - 2023", "GET", "/api/season/2023/profile", 
            validate_response=self.validate_season_profile
        )
        
        # Test Rivalry Circuit Breakdown (Hamilton vs Verstappen)
        self.run_test(
            "Rivalry Circuit Breakdown", "GET", "/api/rivalry/1/830",
            validate_response=self.validate_rivalry_circuit_breakdown
        )

        # Print final results
        print("\n" + "=" * 60)
        print("🏁 TEST RESULTS SUMMARY")
        print("=" * 60)
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {len(self.failed_tests)}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            print("-" * 40)
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test['name']}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
                else:
                    print(f"      Expected: {test['expected_status']}, Got: {test['actual_status']}")
                if 'response_text' in test and test['response_text']:
                    print(f"      Response: {test['response_text'][:100]}...")
                print()
        
        return len(self.failed_tests) == 0

def main():
    """Main test runner"""
    tester = F1IntelligenceAPITester()
    
    try:
        all_passed = tester.run_all_tests()
        
        if all_passed:
            print("✅ ALL TESTS PASSED! API is working correctly.")
            return 0
        else:
            print(f"❌ {len(tester.failed_tests)} TESTS FAILED. See details above.")
            return 1
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())