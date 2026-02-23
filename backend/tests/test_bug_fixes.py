"""
Tests for the 6 bug fixes in F1 Intelligence app
1) Filter dropdowns with search bars
2) Main chart reflects filter selections
3) Filters need GO button
4) Generate Facts for Drivers (already working), Constructors, and Circuits
5) Seasons tab runtime error fix
6) Rivalry search dropdown UX
"""

import pytest
import requests
import os

# Use public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://racing-intelligence.preview.emergentagent.com').rstrip('/')


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data or "message" in data
        print(f"API root response: {data}")


class TestGenerateFactsForDrivers:
    """Test facts generation for drivers - already working"""
    
    def test_generate_driver_facts(self):
        """Test facts generation for Hamilton (driverId=1)"""
        response = requests.get(f"{BASE_URL}/api/facts/generate", params={
            "entity_type": "driver",
            "entity_id": 1,
            "count": 5
        })
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        assert len(facts) > 0
        print(f"Generated {len(facts)} driver facts")
        for fact in facts:
            assert "text" in fact
            assert "type" in fact
            print(f"  - {fact['text'][:80]}...")


class TestGenerateFactsForConstructors:
    """Bug Fix #4: Test facts generation for constructors"""
    
    def test_generate_constructor_facts_ferrari(self):
        """Test facts generation for Ferrari (constructorId=6)"""
        response = requests.get(f"{BASE_URL}/api/facts/generate", params={
            "entity_type": "constructor",
            "entity_id": 6,
            "count": 5
        })
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        assert len(facts) > 0
        print(f"Generated {len(facts)} constructor facts for Ferrari")
        for fact in facts:
            assert "text" in fact
            assert "type" in fact
            print(f"  - {fact['text'][:80]}...")
        
        # Verify Ferrari-specific facts content
        fact_texts = " ".join([f["text"].lower() for f in facts])
        assert "ferrari" in fact_texts
    
    def test_generate_constructor_facts_mercedes(self):
        """Test facts generation for Mercedes (constructorId=131)"""
        response = requests.get(f"{BASE_URL}/api/facts/generate", params={
            "entity_type": "constructor",
            "entity_id": 131,
            "count": 5
        })
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        print(f"Generated {len(facts)} constructor facts for Mercedes")


class TestGenerateFactsForCircuits:
    """Bug Fix #4: Test facts generation for circuits"""
    
    def test_generate_circuit_facts_silverstone(self):
        """Test facts generation for Silverstone (circuitId=9)"""
        response = requests.get(f"{BASE_URL}/api/facts/generate", params={
            "entity_type": "circuit",
            "entity_id": 9,
            "count": 5
        })
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        assert len(facts) > 0
        print(f"Generated {len(facts)} circuit facts for Silverstone")
        for fact in facts:
            assert "text" in fact
            assert "type" in fact
            print(f"  - {fact['text'][:80]}...")
        
        # Verify Silverstone-specific facts content
        fact_texts = " ".join([f["text"].lower() for f in facts])
        assert "silverstone" in fact_texts
    
    def test_generate_circuit_facts_monaco(self):
        """Test facts generation for Monaco (circuitId=6)"""
        response = requests.get(f"{BASE_URL}/api/facts/generate", params={
            "entity_type": "circuit",
            "entity_id": 6,
            "count": 5
        })
        assert response.status_code == 200
        facts = response.json()
        assert isinstance(facts, list)
        print(f"Generated {len(facts)} circuit facts for Monaco")


class TestSeasonProfile:
    """Bug Fix #5: Test season profile to ensure no runtime errors"""
    
    def test_season_profile_2023(self):
        """Test 2023 season profile"""
        response = requests.get(f"{BASE_URL}/api/season/2023/profile")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "year" in data
        assert data["year"] == 2023
        assert "driver_standings" in data
        assert "constructor_standings" in data
        assert "total_races" in data
        
        print(f"2023 season: {data['total_races']} races")
        print(f"Driver standings: {len(data['driver_standings'])} drivers")
        print(f"Constructor standings: {len(data['constructor_standings'])} constructors")
        
        # Verify championship winner
        if data["driver_standings"]:
            winner = data["driver_standings"][0]
            print(f"2023 WDC: {winner.get('forename', '')} {winner.get('surname', '')}")
    
    def test_season_profile_2024(self):
        """Test 2024 season profile"""
        response = requests.get(f"{BASE_URL}/api/season/2024/profile")
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        print(f"2024 season: {data['total_races']} races")
    
    def test_season_profile_historic(self):
        """Test historic season profile (1950)"""
        response = requests.get(f"{BASE_URL}/api/season/1950/profile")
        assert response.status_code == 200
        data = response.json()
        assert "year" in data
        print(f"1950 season: {data['total_races']} races")


class TestDriversSearch:
    """Bug Fix #1 & #6: Test driver search functionality"""
    
    def test_drivers_search_hamilton(self):
        """Search for Hamilton should return Lewis Hamilton"""
        response = requests.get(f"{BASE_URL}/api/drivers", params={
            "search": "hamilton",
            "limit": 10
        })
        assert response.status_code == 200
        drivers = response.json()
        assert isinstance(drivers, list)
        
        # Should find Hamilton(s)
        assert len(drivers) > 0
        hamilton_names = [f"{d['forename']} {d['surname']}" for d in drivers]
        print(f"Hamilton search results: {hamilton_names}")
        
        # Lewis Hamilton should be in results
        lewis_found = any("Lewis" in d["forename"] for d in drivers)
        assert lewis_found, "Lewis Hamilton not found in search results"
    
    def test_drivers_search_verstappen(self):
        """Search for Verstappen should return Max Verstappen"""
        response = requests.get(f"{BASE_URL}/api/drivers", params={
            "search": "verstappen",
            "limit": 10
        })
        assert response.status_code == 200
        drivers = response.json()
        assert len(drivers) > 0
        
        # Max Verstappen should be in results
        max_found = any("Max" in d["forename"] for d in drivers)
        assert max_found, "Max Verstappen not found in search results"


class TestConstructorsSearch:
    """Bug Fix #1: Test constructor search functionality"""
    
    def test_constructors_search_ferrari(self):
        """Search for Ferrari should return Ferrari constructors"""
        response = requests.get(f"{BASE_URL}/api/constructors", params={
            "search": "ferrari",
            "limit": 10
        })
        assert response.status_code == 200
        constructors = response.json()
        assert isinstance(constructors, list)
        assert len(constructors) > 0
        
        constructor_names = [c["name"] for c in constructors]
        print(f"Ferrari search results: {constructor_names}")
        
        # Ferrari should be in results
        ferrari_found = any("Ferrari" in c["name"] for c in constructors)
        assert ferrari_found, "Ferrari not found in search results"
    
    def test_constructors_search_mercedes(self):
        """Search for Mercedes"""
        response = requests.get(f"{BASE_URL}/api/constructors", params={
            "search": "mercedes",
            "limit": 10
        })
        assert response.status_code == 200
        constructors = response.json()
        assert len(constructors) > 0


class TestFilteredStats:
    """Bug Fix #2 & #3: Test that filters affect stats"""
    
    def test_stats_overview_no_filter(self):
        """Get overview stats without filters"""
        response = requests.get(f"{BASE_URL}/api/stats/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_races" in data
        assert "total_wins" in data
        print(f"Total stats: {data['total_races']} races, {data['total_wins']} wins")
        
        return data
    
    def test_stats_overview_with_constructor_filter(self):
        """Get overview stats filtered by constructor (Ferrari=6)"""
        response = requests.get(f"{BASE_URL}/api/stats/overview", params={
            "constructor_id": 6
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "total_races" in data
        assert "total_wins" in data
        print(f"Ferrari stats: {data['total_races']} races, {data['total_wins']} wins")
        
        # Ferrari should have fewer races than total
        total_data = self.test_stats_overview_no_filter()
        assert data["total_races"] <= total_data["total_races"], "Filtered results should be less than total"


class TestRivalryComparison:
    """Bug Fix #6: Test rivalry/head-to-head comparison"""
    
    def test_rivalry_hamilton_vs_verstappen(self):
        """Test H2H between Hamilton (1) and Verstappen (830)"""
        response = requests.get(f"{BASE_URL}/api/rivalry/1/830")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "driver1" in data
        assert "driver2" in data
        assert "quali_h2h" in data
        assert "race_h2h" in data
        assert "common_races" in data
        
        print(f"Hamilton vs Verstappen: {data['common_races']} common races")
        print(f"  Qualifying H2H: {data['quali_h2h']}")
        print(f"  Race H2H: {data['race_h2h']}")
    
    def test_rivalry_with_circuit_breakdown(self):
        """Test H2H includes circuit breakdown"""
        response = requests.get(f"{BASE_URL}/api/rivalry/1/830")
        assert response.status_code == 200
        data = response.json()
        
        assert "circuit_breakdown" in data
        circuits = data["circuit_breakdown"]
        
        if circuits:
            print(f"Circuit breakdown available: {len(circuits)} circuits")
            # Verify circuit structure
            circuit = circuits[0]
            assert "name" in circuit
            assert "races" in circuit


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
