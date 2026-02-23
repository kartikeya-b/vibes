from fastapi import FastAPI, APIRouter, Query, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import pandas as pd
from datetime import datetime, timezone
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="F1 Intelligence API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ PYDANTIC MODELS ============
class DriverSummary(BaseModel):
    driverId: int
    driverRef: str
    forename: str
    surname: str
    nationality: str
    code: Optional[str] = None
    number: Optional[int] = None

class ConstructorSummary(BaseModel):
    constructorId: int
    constructorRef: str
    name: str
    nationality: str

class CircuitSummary(BaseModel):
    circuitId: int
    circuitRef: str
    name: str
    location: str
    country: str

class RaceSummary(BaseModel):
    raceId: int
    year: int
    round: int
    name: str
    date: str
    circuitId: int
    circuitName: Optional[str] = None

class SeasonSummary(BaseModel):
    year: int

class KPIStats(BaseModel):
    total_races: int
    total_wins: int
    total_podiums: int
    total_poles: int
    total_points: float
    dnf_rate: float
    total_drivers: int
    total_constructors: int

class DriverStats(BaseModel):
    driverId: int
    driverRef: str
    forename: str
    surname: str
    nationality: str
    code: Optional[str] = None
    wins: int = 0
    podiums: int = 0
    poles: int = 0
    fastest_laps: int = 0
    total_points: float = 0
    races: int = 0
    dnfs: int = 0
    avg_finish: Optional[float] = None
    avg_grid: Optional[float] = None
    positions_gained: Optional[float] = None
    championships: int = 0

class ConstructorStats(BaseModel):
    constructorId: int
    constructorRef: str
    name: str
    nationality: str
    wins: int = 0
    podiums: int = 0
    poles: int = 0
    total_points: float = 0
    races: int = 0
    championships: int = 0

class RaceResult(BaseModel):
    position: Optional[int] = None
    positionText: str
    driverId: int
    driverRef: str
    forename: str
    surname: str
    constructorId: int
    constructorName: str
    grid: int
    laps: int
    points: float
    status: str
    time: Optional[str] = None
    fastestLapTime: Optional[str] = None
    fastestLapRank: Optional[int] = None

class LapTime(BaseModel):
    lap: int
    driverId: int
    position: int
    time: str
    milliseconds: int

class PitStop(BaseModel):
    driverId: int
    stop: int
    lap: int
    time: str
    duration: str
    milliseconds: int

class HeadToHead(BaseModel):
    driver1: DriverSummary
    driver2: DriverSummary
    quali_h2h: Dict[str, int]
    race_h2h: Dict[str, int]
    points_h2h: Dict[str, float]
    wins_h2h: Dict[str, int]
    podiums_h2h: Dict[str, int]
    common_races: int

# ============ ERA DEFINITIONS ============
F1_ERAS = {
    "pioneer": {
        "name": "Pioneer Era",
        "years": (1950, 1957),
        "avg_races_per_season": 8,
        "points_for_win": 8,
        "description": "The dawn of F1 with front-engine cars"
    },
    "classic": {
        "name": "Classic Era", 
        "years": (1958, 1980),
        "avg_races_per_season": 13,
        "points_for_win": 9,
        "description": "Rear-engine revolution to ground effect"
    },
    "turbo": {
        "name": "Turbo Era",
        "years": (1981, 1993),
        "avg_races_per_season": 16,
        "points_for_win": 9,
        "description": "Turbocharged engines and electronic aids"
    },
    "modern": {
        "name": "Modern Era",
        "years": (1994, 2009),
        "avg_races_per_season": 17,
        "points_for_win": 10,
        "description": "Safety reforms and global expansion"
    },
    "hybrid": {
        "name": "Hybrid Era",
        "years": (2010, 2025),
        "avg_races_per_season": 21,
        "points_for_win": 25,
        "description": "High-downforce and hybrid power units"
    }
}

def get_driver_era(first_year: int, last_year: int) -> str:
    """Determine the primary era a driver competed in"""
    mid_career = (first_year + last_year) // 2
    for era_key, era in F1_ERAS.items():
        if era["years"][0] <= mid_career <= era["years"][1]:
            return era_key
    return "hybrid"  # Default for recent drivers

def get_era_normalization_factor(era_key: str) -> dict:
    """Get normalization factors to compare across eras"""
    era = F1_ERAS.get(era_key, F1_ERAS["hybrid"])
    hybrid = F1_ERAS["hybrid"]
    
    # Normalize relative to hybrid era (baseline)
    return {
        "races_factor": hybrid["avg_races_per_season"] / era["avg_races_per_season"],
        "points_factor": hybrid["points_for_win"] / era["points_for_win"],
        "era_name": era["name"],
        "era_key": era_key
    }

class GOATScore(BaseModel):
    driverId: int
    driverRef: str
    forename: str
    surname: str
    nationality: str
    score: float
    breakdown: Dict[str, float]
    stats: Dict[str, Any]

# ============ DATA IMPORT ============
DATA_DIR = ROOT_DIR.parent / "data"

async def import_csv_to_mongo():
    """Import all CSV files into MongoDB collections"""
    csv_files = {
        'circuits': 'circuits.csv',
        'constructors': 'constructors.csv', 
        'drivers': 'drivers.csv',
        'races': 'races.csv',
        'results': 'results.csv',
        'qualifying': 'qualifying.csv',
        'lap_times': 'lap_times.csv',
        'pit_stops': 'pit_stops.csv',
        'driver_standings': 'driver_standings.csv',
        'constructor_standings': 'constructor_standings.csv',
        'constructor_results': 'constructor_results.csv',
        'status': 'status.csv',
        'seasons': 'seasons.csv',
        'sprint_results': 'sprint_results.csv'
    }
    
    for collection_name, filename in csv_files.items():
        filepath = DATA_DIR / filename
        if not filepath.exists():
            logger.warning(f"File not found: {filepath}")
            continue
            
        # Check if collection already has data
        count = await db[collection_name].count_documents({})
        if count > 0:
            logger.info(f"Collection {collection_name} already has {count} documents, skipping import")
            continue
            
        logger.info(f"Importing {filename} into {collection_name}...")
        
        # Read CSV
        df = pd.read_csv(filepath, na_values=['\\N', 'NA', ''])
        
        # Convert to records and handle NaN
        records = df.where(pd.notnull(df), None).to_dict('records')
        
        # Convert numeric columns
        for record in records:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None
                elif isinstance(value, float) and value.is_integer():
                    record[key] = int(value)
        
        if records:
            # Insert in batches for large files
            batch_size = 10000
            for i in range(0, len(records), batch_size):
                batch = records[i:i+batch_size]
                await db[collection_name].insert_many(batch)
            logger.info(f"Imported {len(records)} records into {collection_name}")
    
    # Create indexes
    await create_indexes()
    logger.info("Data import complete!")

async def create_indexes():
    """Create indexes for better query performance"""
    await db.drivers.create_index("driverId", unique=True)
    await db.drivers.create_index("driverRef")
    await db.constructors.create_index("constructorId", unique=True)
    await db.constructors.create_index("constructorRef")
    await db.circuits.create_index("circuitId", unique=True)
    await db.races.create_index("raceId", unique=True)
    await db.races.create_index([("year", -1), ("round", 1)])
    await db.results.create_index("raceId")
    await db.results.create_index("driverId")
    await db.results.create_index("constructorId")
    await db.results.create_index([("raceId", 1), ("position", 1)])
    await db.qualifying.create_index("raceId")
    await db.qualifying.create_index("driverId")
    await db.lap_times.create_index([("raceId", 1), ("lap", 1)])
    await db.lap_times.create_index([("raceId", 1), ("driverId", 1)])
    await db.pit_stops.create_index([("raceId", 1), ("driverId", 1)])
    await db.driver_standings.create_index([("raceId", 1), ("driverId", 1)])
    await db.constructor_standings.create_index([("raceId", 1), ("constructorId", 1)])
    logger.info("Indexes created!")

# ============ API ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "F1 Intelligence API", "status": "online"}

@api_router.post("/import-data")
async def trigger_import():
    """Trigger data import from CSV files"""
    await import_csv_to_mongo()
    return {"message": "Data import completed"}

# ----- METADATA ROUTES -----
@api_router.get("/seasons", response_model=List[SeasonSummary])
async def get_seasons():
    """Get all F1 seasons"""
    races = await db.races.distinct("year")
    return [{"year": y} for y in sorted(races, reverse=True)]

@api_router.get("/drivers", response_model=List[DriverSummary])
async def get_drivers(
    season: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000)
):
    """Get drivers with optional filtering"""
    pipeline = []
    
    if season:
        # Get drivers who raced in this season
        race_ids = await db.races.distinct("raceId", {"year": season})
        driver_ids = await db.results.distinct("driverId", {"raceId": {"$in": race_ids}})
        pipeline.append({"$match": {"driverId": {"$in": driver_ids}}})
    
    if search:
        pipeline.append({
            "$match": {
                "$or": [
                    {"forename": {"$regex": search, "$options": "i"}},
                    {"surname": {"$regex": search, "$options": "i"}},
                    {"driverRef": {"$regex": search, "$options": "i"}},
                    {"code": {"$regex": search, "$options": "i"}}
                ]
            }
        })
    
    pipeline.extend([
        {"$project": {"_id": 0, "driverId": 1, "driverRef": 1, "forename": 1, "surname": 1, "nationality": 1, "code": 1, "number": 1}},
        {"$sort": {"surname": 1}},
        {"$limit": limit}
    ])
    
    drivers = await db.drivers.aggregate(pipeline).to_list(limit)
    return drivers

@api_router.get("/constructors", response_model=List[ConstructorSummary])
async def get_constructors(
    season: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get constructors with optional filtering"""
    pipeline = []
    
    if season:
        race_ids = await db.races.distinct("raceId", {"year": season})
        constructor_ids = await db.results.distinct("constructorId", {"raceId": {"$in": race_ids}})
        pipeline.append({"$match": {"constructorId": {"$in": constructor_ids}}})
    
    if search:
        pipeline.append({
            "$match": {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"constructorRef": {"$regex": search, "$options": "i"}}
                ]
            }
        })
    
    pipeline.extend([
        {"$project": {"_id": 0, "constructorId": 1, "constructorRef": 1, "name": 1, "nationality": 1}},
        {"$sort": {"name": 1}},
        {"$limit": limit}
    ])
    
    constructors = await db.constructors.aggregate(pipeline).to_list(limit)
    return constructors

@api_router.get("/circuits", response_model=List[CircuitSummary])
async def get_circuits(
    search: Optional[str] = None,
    limit: int = Query(default=100, le=200)
):
    """Get all circuits"""
    query = {}
    if search:
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"location": {"$regex": search, "$options": "i"}},
                {"country": {"$regex": search, "$options": "i"}}
            ]
        }
    
    circuits = await db.circuits.find(query, {"_id": 0, "circuitId": 1, "circuitRef": 1, "name": 1, "location": 1, "country": 1}).sort("name", 1).limit(limit).to_list(limit)
    return circuits

@api_router.get("/races", response_model=List[RaceSummary])
async def get_races(
    season: Optional[int] = None,
    circuit_id: Optional[int] = None,
    limit: int = Query(default=100, le=2000)
):
    """Get races with optional filtering"""
    pipeline = []
    match = {}
    
    if season:
        match["year"] = season
    if circuit_id:
        match["circuitId"] = circuit_id
    
    if match:
        pipeline.append({"$match": match})
    
    pipeline.extend([
        {"$lookup": {
            "from": "circuits",
            "localField": "circuitId",
            "foreignField": "circuitId",
            "as": "circuit"
        }},
        {"$unwind": {"path": "$circuit", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0, 
            "raceId": 1, 
            "year": 1, 
            "round": 1, 
            "name": 1, 
            "date": 1, 
            "circuitId": 1,
            "circuitName": "$circuit.name"
        }},
        {"$sort": {"year": -1, "round": -1}},
        {"$limit": limit}
    ])
    
    races = await db.races.aggregate(pipeline).to_list(limit)
    return races

# ----- ANALYTICS ROUTES -----
@api_router.get("/stats/overview", response_model=KPIStats)
async def get_overview_stats(
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    driver_id: Optional[int] = None,
    constructor_id: Optional[int] = None
):
    """Get overview KPI stats with optional filters"""
    # Build race filter
    race_match = {}
    if year_from or year_to:
        race_match["year"] = {}
        if year_from:
            race_match["year"]["$gte"] = year_from
        if year_to:
            race_match["year"]["$lte"] = year_to
    
    race_ids = None
    if race_match:
        race_ids = await db.races.distinct("raceId", race_match)
    
    # Build results filter
    result_match = {}
    if race_ids:
        result_match["raceId"] = {"$in": race_ids}
    if driver_id:
        result_match["driverId"] = driver_id
    if constructor_id:
        result_match["constructorId"] = constructor_id
    
    # Aggregation pipeline
    pipeline = []
    if result_match:
        pipeline.append({"$match": result_match})
    
    pipeline.append({
        "$group": {
            "_id": None,
            "total_races": {"$sum": 1},
            "total_wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "total_podiums": {"$sum": {"$cond": [{"$and": [{"$gte": ["$position", 1]}, {"$lte": ["$position", 3]}]}, 1, 0]}},
            "total_poles": {"$sum": {"$cond": [{"$eq": ["$grid", 1]}, 1, 0]}},
            "total_points": {"$sum": {"$ifNull": ["$points", 0]}},
            "dnfs": {"$sum": {"$cond": [{"$and": [{"$ne": ["$statusId", 1]}, {"$ne": ["$position", None]}]}, 1, 0]}},
            "drivers": {"$addToSet": "$driverId"},
            "constructors": {"$addToSet": "$constructorId"}
        }
    })
    
    results = await db.results.aggregate(pipeline).to_list(1)
    
    if not results:
        return KPIStats(
            total_races=0, total_wins=0, total_podiums=0, total_poles=0,
            total_points=0, dnf_rate=0, total_drivers=0, total_constructors=0
        )
    
    r = results[0]
    dnf_rate = (r["dnfs"] / r["total_races"] * 100) if r["total_races"] > 0 else 0
    
    return KPIStats(
        total_races=r["total_races"],
        total_wins=r["total_wins"],
        total_podiums=r["total_podiums"],
        total_poles=r["total_poles"],
        total_points=r["total_points"],
        dnf_rate=round(dnf_rate, 1),
        total_drivers=len(r["drivers"]),
        total_constructors=len(r["constructors"])
    )

@api_router.get("/stats/drivers", response_model=List[DriverStats])
async def get_driver_stats(
    driver_ids: Optional[str] = None,  # comma-separated
    driver_id: Optional[int] = None,  # single driver filter
    constructor_id: Optional[int] = None,  # filter by constructor
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    limit: int = Query(default=50, le=200)
):
    """Get detailed driver statistics"""
    # Build race filter
    race_match = {}
    if year_from or year_to:
        race_match["year"] = {}
        if year_from:
            race_match["year"]["$gte"] = year_from
        if year_to:
            race_match["year"]["$lte"] = year_to
    
    race_ids = None
    if race_match:
        race_ids = await db.races.distinct("raceId", race_match)
    
    # Build results filter
    result_match = {}
    if race_ids:
        result_match["raceId"] = {"$in": race_ids}
    if driver_ids:
        ids = [int(x) for x in driver_ids.split(",")]
        result_match["driverId"] = {"$in": ids}
    if driver_id:
        result_match["driverId"] = driver_id
    if constructor_id:
        result_match["constructorId"] = constructor_id
    
    pipeline = []
    if result_match:
        pipeline.append({"$match": result_match})
    
    pipeline.extend([
        {"$group": {
            "_id": "$driverId",
            "wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "podiums": {"$sum": {"$cond": [{"$and": [{"$gte": ["$position", 1]}, {"$lte": ["$position", 3]}]}, 1, 0]}},
            "poles": {"$sum": {"$cond": [{"$eq": ["$grid", 1]}, 1, 0]}},
            "total_points": {"$sum": {"$ifNull": ["$points", 0]}},
            "races": {"$sum": 1},
            "dnfs": {"$sum": {"$cond": [{"$ne": ["$statusId", 1]}, 1, 0]}},
            "avg_finish": {"$avg": {"$cond": [{"$gt": ["$position", 0]}, "$position", None]}},
            "avg_grid": {"$avg": {"$cond": [{"$gt": ["$grid", 0]}, "$grid", None]}},
            "positions_gained": {"$avg": {"$cond": [
                {"$and": [{"$gt": ["$grid", 0]}, {"$gt": ["$position", 0]}]},
                {"$subtract": ["$grid", "$position"]},
                None
            ]}},
            "fastest_laps": {"$sum": {"$cond": [{"$eq": ["$rank", 1]}, 1, 0]}}
        }},
        {"$lookup": {
            "from": "drivers",
            "localField": "_id",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$project": {
            "_id": 0,
            "driverId": "$_id",
            "driverRef": "$driver.driverRef",
            "forename": "$driver.forename",
            "surname": "$driver.surname",
            "nationality": "$driver.nationality",
            "code": "$driver.code",
            "wins": 1,
            "podiums": 1,
            "poles": 1,
            "fastest_laps": 1,
            "total_points": 1,
            "races": 1,
            "dnfs": 1,
            "avg_finish": {"$round": ["$avg_finish", 2]},
            "avg_grid": {"$round": ["$avg_grid", 2]},
            "positions_gained": {"$round": ["$positions_gained", 2]}
        }},
        {"$sort": {"wins": -1, "total_points": -1}},
        {"$limit": limit}
    ])
    
    # Get championship counts separately
    driver_stats = await db.results.aggregate(pipeline).to_list(limit)
    
    # Add championship counts
    for stat in driver_stats:
        # Count seasons where driver finished P1 in standings at last race of season
        champs = await get_driver_championships(stat["driverId"], year_from, year_to)
        stat["championships"] = champs
    
    return driver_stats

async def get_driver_championships(driver_id: int, year_from: Optional[int] = None, year_to: Optional[int] = None) -> int:
    """Count championships won by a driver"""
    # Get last race of each season
    pipeline = [
        {"$group": {
            "_id": "$year",
            "lastRaceId": {"$max": "$raceId"}
        }}
    ]
    
    if year_from or year_to:
        match = {"year": {}}
        if year_from:
            match["year"]["$gte"] = year_from
        if year_to:
            match["year"]["$lte"] = year_to
        pipeline.insert(0, {"$match": match})
    
    last_races = await db.races.aggregate(pipeline).to_list(100)
    last_race_ids = [r["lastRaceId"] for r in last_races]
    
    # Count P1 finishes in standings at end of season
    champs = await db.driver_standings.count_documents({
        "raceId": {"$in": last_race_ids},
        "driverId": driver_id,
        "position": 1
    })
    
    return champs

@api_router.get("/stats/constructors", response_model=List[ConstructorStats])
async def get_constructor_stats(
    constructor_ids: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    limit: int = Query(default=50, le=200)
):
    """Get detailed constructor statistics"""
    race_match = {}
    if year_from or year_to:
        race_match["year"] = {}
        if year_from:
            race_match["year"]["$gte"] = year_from
        if year_to:
            race_match["year"]["$lte"] = year_to
    
    race_ids = None
    if race_match:
        race_ids = await db.races.distinct("raceId", race_match)
    
    result_match = {}
    if race_ids:
        result_match["raceId"] = {"$in": race_ids}
    if constructor_ids:
        ids = [int(x) for x in constructor_ids.split(",")]
        result_match["constructorId"] = {"$in": ids}
    
    pipeline = []
    if result_match:
        pipeline.append({"$match": result_match})
    
    pipeline.extend([
        {"$group": {
            "_id": "$constructorId",
            "wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "podiums": {"$sum": {"$cond": [{"$and": [{"$gte": ["$position", 1]}, {"$lte": ["$position", 3]}]}, 1, 0]}},
            "poles": {"$sum": {"$cond": [{"$eq": ["$grid", 1]}, 1, 0]}},
            "total_points": {"$sum": {"$ifNull": ["$points", 0]}},
            "races": {"$sum": 1}
        }},
        {"$lookup": {
            "from": "constructors",
            "localField": "_id",
            "foreignField": "constructorId",
            "as": "constructor"
        }},
        {"$unwind": "$constructor"},
        {"$project": {
            "_id": 0,
            "constructorId": "$_id",
            "constructorRef": "$constructor.constructorRef",
            "name": "$constructor.name",
            "nationality": "$constructor.nationality",
            "wins": 1,
            "podiums": 1,
            "poles": 1,
            "total_points": 1,
            "races": 1
        }},
        {"$sort": {"wins": -1, "total_points": -1}},
        {"$limit": limit}
    ])
    
    constructor_stats = await db.results.aggregate(pipeline).to_list(limit)
    
    # Add championship counts
    for stat in constructor_stats:
        champs = await get_constructor_championships(stat["constructorId"], year_from, year_to)
        stat["championships"] = champs
    
    return constructor_stats

async def get_constructor_championships(constructor_id: int, year_from: Optional[int] = None, year_to: Optional[int] = None) -> int:
    """Count championships won by a constructor"""
    pipeline = [
        {"$group": {
            "_id": "$year",
            "lastRaceId": {"$max": "$raceId"}
        }}
    ]
    
    if year_from or year_to:
        match = {"year": {}}
        if year_from:
            match["year"]["$gte"] = year_from
        if year_to:
            match["year"]["$lte"] = year_to
        pipeline.insert(0, {"$match": match})
    
    last_races = await db.races.aggregate(pipeline).to_list(100)
    last_race_ids = [r["lastRaceId"] for r in last_races]
    
    champs = await db.constructor_standings.count_documents({
        "raceId": {"$in": last_race_ids},
        "constructorId": constructor_id,
        "position": 1
    })
    
    return champs

# ----- RACE DEEP DIVE ROUTES -----
@api_router.get("/race/{race_id}")
async def get_race_details(race_id: int):
    """Get detailed race information"""
    race = await db.races.find_one({"raceId": race_id}, {"_id": 0})
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    
    # Get circuit info
    circuit = await db.circuits.find_one({"circuitId": race["circuitId"]}, {"_id": 0})
    race["circuit"] = circuit
    
    # Get winner
    winner_result = await db.results.find_one({"raceId": race_id, "position": 1}, {"_id": 0})
    if winner_result:
        winner = await db.drivers.find_one({"driverId": winner_result["driverId"]}, {"_id": 0})
        winner_constructor = await db.constructors.find_one({"constructorId": winner_result["constructorId"]}, {"_id": 0})
        race["winner"] = {
            "driver": winner,
            "constructor": winner_constructor,
            "time": winner_result.get("time")
        }
    
    # Get pole sitter
    pole_result = await db.results.find_one({"raceId": race_id, "grid": 1}, {"_id": 0})
    if pole_result:
        pole_driver = await db.drivers.find_one({"driverId": pole_result["driverId"]}, {"_id": 0})
        race["poleSitter"] = pole_driver
    
    # Get fastest lap holder
    fastest_lap = await db.results.find_one({"raceId": race_id, "rank": 1}, {"_id": 0})
    if fastest_lap:
        fl_driver = await db.drivers.find_one({"driverId": fastest_lap["driverId"]}, {"_id": 0})
        race["fastestLap"] = {
            "driver": fl_driver,
            "time": fastest_lap.get("fastestLapTime"),
            "lap": fastest_lap.get("fastestLap")
        }
    
    # Count DNFs
    dnf_count = await db.results.count_documents({"raceId": race_id, "statusId": {"$ne": 1}})
    race["dnfCount"] = dnf_count
    
    return race

@api_router.get("/race/{race_id}/results", response_model=List[RaceResult])
async def get_race_results(race_id: int):
    """Get race results with driver and constructor info"""
    pipeline = [
        {"$match": {"raceId": race_id}},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$lookup": {
            "from": "constructors",
            "localField": "constructorId",
            "foreignField": "constructorId",
            "as": "constructor"
        }},
        {"$unwind": "$constructor"},
        {"$lookup": {
            "from": "status",
            "localField": "statusId",
            "foreignField": "statusId",
            "as": "statusInfo"
        }},
        {"$unwind": {"path": "$statusInfo", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "position": 1,
            "positionText": 1,
            "driverId": 1,
            "driverRef": "$driver.driverRef",
            "forename": "$driver.forename",
            "surname": "$driver.surname",
            "constructorId": 1,
            "constructorName": "$constructor.name",
            "grid": 1,
            "laps": 1,
            "points": 1,
            "status": "$statusInfo.status",
            "time": 1,
            "fastestLapTime": 1,
            "fastestLapRank": "$rank"
        }},
        {"$sort": {"positionOrder": 1}}
    ]
    
    results = await db.results.aggregate(pipeline).to_list(30)
    return results

@api_router.get("/race/{race_id}/lap-times")
async def get_race_lap_times(race_id: int, driver_ids: Optional[str] = None):
    """Get lap times for position chart"""
    match = {"raceId": race_id}
    if driver_ids:
        ids = [int(x) for x in driver_ids.split(",")]
        match["driverId"] = {"$in": ids}
    
    pipeline = [
        {"$match": match},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$project": {
            "_id": 0,
            "lap": 1,
            "driverId": 1,
            "driverRef": "$driver.driverRef",
            "code": "$driver.code",
            "position": 1,
            "time": 1,
            "milliseconds": 1
        }},
        {"$sort": {"lap": 1, "position": 1}}
    ]
    
    lap_times = await db.lap_times.aggregate(pipeline).to_list(10000)
    
    # Group by driver for easier charting
    drivers_data = {}
    for lt in lap_times:
        driver_id = lt["driverId"]
        if driver_id not in drivers_data:
            drivers_data[driver_id] = {
                "driverId": driver_id,
                "driverRef": lt["driverRef"],
                "code": lt.get("code"),
                "laps": []
            }
        drivers_data[driver_id]["laps"].append({
            "lap": lt["lap"],
            "position": lt["position"],
            "time": lt["time"],
            "milliseconds": lt["milliseconds"]
        })
    
    return list(drivers_data.values())

@api_router.get("/race/{race_id}/pit-stops")
async def get_race_pit_stops(race_id: int):
    """Get pit stop data for a race"""
    pipeline = [
        {"$match": {"raceId": race_id}},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$project": {
            "_id": 0,
            "driverId": 1,
            "driverRef": "$driver.driverRef",
            "code": "$driver.code",
            "stop": 1,
            "lap": 1,
            "time": 1,
            "duration": 1,
            "milliseconds": 1
        }},
        {"$sort": {"lap": 1, "time": 1}}
    ]
    
    pit_stops = await db.pit_stops.aggregate(pipeline).to_list(500)
    return pit_stops

@api_router.get("/race/{race_id}/movers")
async def get_race_movers(race_id: int):
    """Get biggest position gainers/losers"""
    pipeline = [
        {"$match": {"raceId": race_id, "position": {"$ne": None}, "grid": {"$gt": 0}}},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$lookup": {
            "from": "constructors",
            "localField": "constructorId",
            "foreignField": "constructorId",
            "as": "constructor"
        }},
        {"$unwind": "$constructor"},
        {"$project": {
            "_id": 0,
            "driverId": 1,
            "driverRef": "$driver.driverRef",
            "forename": "$driver.forename",
            "surname": "$driver.surname",
            "constructorName": "$constructor.name",
            "grid": 1,
            "position": 1,
            "positionsGained": {"$subtract": ["$grid", "$position"]}
        }},
        {"$sort": {"positionsGained": -1}}
    ]
    
    movers = await db.results.aggregate(pipeline).to_list(30)
    return movers

# ----- RIVALRY / HEAD-TO-HEAD ROUTES -----
@api_router.get("/rivalry/{driver1_id}/{driver2_id}")
async def get_head_to_head(
    driver1_id: int,
    driver2_id: int,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    same_team_only: bool = False
):
    """Get head-to-head comparison between two drivers"""
    # Get driver info
    driver1 = await db.drivers.find_one({"driverId": driver1_id}, {"_id": 0})
    driver2 = await db.drivers.find_one({"driverId": driver2_id}, {"_id": 0})
    
    if not driver1 or not driver2:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Build race filter
    race_match = {}
    if year_from or year_to:
        race_match["year"] = {}
        if year_from:
            race_match["year"]["$gte"] = year_from
        if year_to:
            race_match["year"]["$lte"] = year_to
    
    race_ids = None
    if race_match:
        race_ids = await db.races.distinct("raceId", race_match)
    
    # Find common races
    d1_match = {"driverId": driver1_id}
    d2_match = {"driverId": driver2_id}
    
    if race_ids:
        d1_match["raceId"] = {"$in": race_ids}
        d2_match["raceId"] = {"$in": race_ids}
    
    d1_races = await db.results.distinct("raceId", d1_match)
    d2_races = await db.results.distinct("raceId", d2_match)
    common_race_ids = list(set(d1_races) & set(d2_races))
    
    if same_team_only:
        # Filter to races where both were at same constructor
        same_team_races = []
        for race_id in common_race_ids:
            r1 = await db.results.find_one({"raceId": race_id, "driverId": driver1_id}, {"constructorId": 1})
            r2 = await db.results.find_one({"raceId": race_id, "driverId": driver2_id}, {"constructorId": 1})
            if r1 and r2 and r1["constructorId"] == r2["constructorId"]:
                same_team_races.append(race_id)
        common_race_ids = same_team_races
    
    # Initialize counters
    h2h = {
        "quali_d1": 0, "quali_d2": 0,
        "race_d1": 0, "race_d2": 0,
        "points_d1": 0, "points_d2": 0,
        "wins_d1": 0, "wins_d2": 0,
        "podiums_d1": 0, "podiums_d2": 0
    }
    
    # Compare in each race
    for race_id in common_race_ids:
        r1 = await db.results.find_one({"raceId": race_id, "driverId": driver1_id}, {"_id": 0})
        r2 = await db.results.find_one({"raceId": race_id, "driverId": driver2_id}, {"_id": 0})
        
        if not r1 or not r2:
            continue
        
        # Grid comparison (qualifying H2H)
        if r1.get("grid") and r2.get("grid") and r1["grid"] > 0 and r2["grid"] > 0:
            if r1["grid"] < r2["grid"]:
                h2h["quali_d1"] += 1
            elif r2["grid"] < r1["grid"]:
                h2h["quali_d2"] += 1
        
        # Race position comparison
        if r1.get("position") and r2.get("position"):
            if r1["position"] < r2["position"]:
                h2h["race_d1"] += 1
            elif r2["position"] < r1["position"]:
                h2h["race_d2"] += 1
        elif r1.get("position"):
            h2h["race_d1"] += 1
        elif r2.get("position"):
            h2h["race_d2"] += 1
        
        # Points
        h2h["points_d1"] += r1.get("points", 0) or 0
        h2h["points_d2"] += r2.get("points", 0) or 0
        
        # Wins and podiums
        if r1.get("position") == 1:
            h2h["wins_d1"] += 1
        if r2.get("position") == 1:
            h2h["wins_d2"] += 1
        if r1.get("position") and r1["position"] <= 3:
            h2h["podiums_d1"] += 1
        if r2.get("position") and r2["position"] <= 3:
            h2h["podiums_d2"] += 1
    
    # Circuit-by-circuit breakdown
    circuit_breakdown = []
    circuit_stats = {}
    
    for race_id in common_race_ids:
        race = await db.races.find_one({"raceId": race_id}, {"_id": 0, "circuitId": 1})
        if not race:
            continue
        circuit_id = race["circuitId"]
        
        if circuit_id not in circuit_stats:
            circuit = await db.circuits.find_one({"circuitId": circuit_id}, {"_id": 0, "name": 1, "country": 1})
            circuit_stats[circuit_id] = {
                "circuitId": circuit_id,
                "name": circuit["name"] if circuit else "Unknown",
                "country": circuit["country"] if circuit else "",
                "races": 0,
                "d1_quali_wins": 0,
                "d2_quali_wins": 0,
                "d1_race_wins": 0,
                "d2_race_wins": 0,
                "d1_wins": 0,
                "d2_wins": 0
            }
        
        r1 = await db.results.find_one({"raceId": race_id, "driverId": driver1_id}, {"_id": 0})
        r2 = await db.results.find_one({"raceId": race_id, "driverId": driver2_id}, {"_id": 0})
        
        if r1 and r2:
            circuit_stats[circuit_id]["races"] += 1
            
            # Qualifying
            if r1.get("grid") and r2.get("grid") and r1["grid"] > 0 and r2["grid"] > 0:
                if r1["grid"] < r2["grid"]:
                    circuit_stats[circuit_id]["d1_quali_wins"] += 1
                elif r2["grid"] < r1["grid"]:
                    circuit_stats[circuit_id]["d2_quali_wins"] += 1
            
            # Race position
            if r1.get("position") and r2.get("position"):
                if r1["position"] < r2["position"]:
                    circuit_stats[circuit_id]["d1_race_wins"] += 1
                elif r2["position"] < r1["position"]:
                    circuit_stats[circuit_id]["d2_race_wins"] += 1
            elif r1.get("position"):
                circuit_stats[circuit_id]["d1_race_wins"] += 1
            elif r2.get("position"):
                circuit_stats[circuit_id]["d2_race_wins"] += 1
            
            # Race wins
            if r1.get("position") == 1:
                circuit_stats[circuit_id]["d1_wins"] += 1
            if r2.get("position") == 1:
                circuit_stats[circuit_id]["d2_wins"] += 1
    
    circuit_breakdown = sorted(circuit_stats.values(), key=lambda x: x["races"], reverse=True)
    
    return {
        "driver1": driver1,
        "driver2": driver2,
        "quali_h2h": {driver1["driverRef"]: h2h["quali_d1"], driver2["driverRef"]: h2h["quali_d2"]},
        "race_h2h": {driver1["driverRef"]: h2h["race_d1"], driver2["driverRef"]: h2h["race_d2"]},
        "points_h2h": {driver1["driverRef"]: h2h["points_d1"], driver2["driverRef"]: h2h["points_d2"]},
        "wins_h2h": {driver1["driverRef"]: h2h["wins_d1"], driver2["driverRef"]: h2h["wins_d2"]},
        "podiums_h2h": {driver1["driverRef"]: h2h["podiums_d1"], driver2["driverRef"]: h2h["podiums_d2"]},
        "common_races": len(common_race_ids),
        "circuit_breakdown": circuit_breakdown
    }

# ----- GOAT ENGINE ROUTES -----
@api_router.get("/goat/leaderboard")
async def get_goat_leaderboard(
    weights: str = "wins:25,podiums:15,poles:15,points:15,avg_finish:10,positions_gained:5,championships:15",
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    min_races: int = 50,
    normalize_per_race: bool = False,
    limit: int = Query(default=50, le=200)
):
    """Get GOAT leaderboard with configurable weights"""
    # Parse weights
    weight_dict = {}
    for w in weights.split(","):
        parts = w.split(":")
        if len(parts) == 2:
            weight_dict[parts[0]] = float(parts[1])
    
    # Get driver stats
    driver_stats = await get_driver_stats(
        driver_ids=None,
        year_from=year_from,
        year_to=year_to,
        limit=1000
    )
    
    # Filter by min races - driver_stats returns list of DriverStats objects
    driver_stats = [d for d in driver_stats if d["races"] >= min_races]
    
    # Calculate scores
    scored_drivers = []
    for driver in driver_stats:
        d = driver.model_dump() if hasattr(driver, 'model_dump') else driver
        
        # Normalize if requested
        divisor = d["races"] if normalize_per_race and d["races"] > 0 else 1
        
        breakdown = {}
        score = 0
        
        # Wins
        if "wins" in weight_dict:
            val = d["wins"] / divisor
            contribution = val * weight_dict["wins"]
            breakdown["wins"] = contribution
            score += contribution
        
        # Podiums
        if "podiums" in weight_dict:
            val = d["podiums"] / divisor
            contribution = val * weight_dict["podiums"]
            breakdown["podiums"] = contribution
            score += contribution
        
        # Poles
        if "poles" in weight_dict:
            val = d["poles"] / divisor
            contribution = val * weight_dict["poles"]
            breakdown["poles"] = contribution
            score += contribution
        
        # Points
        if "points" in weight_dict:
            val = d["total_points"] / divisor / 10  # Scale down points
            contribution = val * weight_dict["points"]
            breakdown["points"] = contribution
            score += contribution
        
        # Avg finish (lower is better, so invert)
        if "avg_finish" in weight_dict and d.get("avg_finish"):
            val = 20 - d["avg_finish"]  # Invert: P1 finish = 19, P20 = 0
            contribution = max(0, val * weight_dict["avg_finish"])
            breakdown["avg_finish"] = contribution
            score += contribution
        
        # Positions gained
        if "positions_gained" in weight_dict and d.get("positions_gained"):
            val = d["positions_gained"]
            contribution = val * weight_dict["positions_gained"]
            breakdown["positions_gained"] = contribution
            score += contribution
        
        # Championships
        if "championships" in weight_dict:
            val = d["championships"]
            contribution = val * weight_dict["championships"] * 5  # Championships weighted heavily
            breakdown["championships"] = contribution
            score += contribution
        
        scored_drivers.append({
            "driverId": d["driverId"],
            "driverRef": d["driverRef"],
            "forename": d["forename"],
            "surname": d["surname"],
            "nationality": d["nationality"],
            "score": round(score, 2),
            "breakdown": {k: round(v, 2) for k, v in breakdown.items()},
            "stats": {
                "wins": d["wins"],
                "podiums": d["podiums"],
                "poles": d["poles"],
                "points": d["total_points"],
                "races": d["races"],
                "championships": d["championships"],
                "avg_finish": d.get("avg_finish"),
                "positions_gained": d.get("positions_gained")
            }
        })
    
    # Sort by score
    scored_drivers.sort(key=lambda x: x["score"], reverse=True)
    
    return scored_drivers[:limit]

# ----- STORY EXPLORER ROUTES -----
@api_router.get("/driver/{driver_id}/profile")
async def get_driver_profile(driver_id: int):
    """Get comprehensive driver profile for story explorer"""
    driver = await db.drivers.find_one({"driverId": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Career stats
    stats_list = await get_driver_stats(driver_ids=str(driver_id), limit=1)
    stats = stats_list[0] if stats_list else None
    
    # Best seasons (most wins)
    best_seasons_pipeline = [
        {"$match": {"driverId": driver_id, "position": 1}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$group": {
            "_id": "$race.year",
            "wins": {"$sum": 1}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": 5}
    ]
    best_seasons = await db.results.aggregate(best_seasons_pipeline).to_list(5)
    
    # Signature circuits (most wins)
    signature_circuits_pipeline = [
        {"$match": {"driverId": driver_id, "position": 1}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$lookup": {
            "from": "circuits",
            "localField": "race.circuitId",
            "foreignField": "circuitId",
            "as": "circuit"
        }},
        {"$unwind": "$circuit"},
        {"$group": {
            "_id": "$circuit.circuitId",
            "name": {"$first": "$circuit.name"},
            "country": {"$first": "$circuit.country"},
            "wins": {"$sum": 1}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": 5}
    ]
    signature_circuits = await db.results.aggregate(signature_circuits_pipeline).to_list(5)
    
    # Career timeline
    timeline_pipeline = [
        {"$match": {"driverId": driver_id}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$lookup": {
            "from": "constructors",
            "localField": "constructorId",
            "foreignField": "constructorId",
            "as": "constructor"
        }},
        {"$unwind": "$constructor"},
        {"$group": {
            "_id": "$race.year",
            "teams": {"$addToSet": "$constructor.name"},
            "wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "podiums": {"$sum": {"$cond": [{"$lte": ["$position", 3]}, 1, 0]}},
            "points": {"$sum": {"$ifNull": ["$points", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    timeline = await db.results.aggregate(timeline_pipeline).to_list(100)
    
    return {
        "driver": driver,
        "stats": stats.model_dump() if hasattr(stats, 'model_dump') else stats,
        "best_seasons": best_seasons,
        "signature_circuits": signature_circuits,
        "timeline": timeline
    }

@api_router.get("/circuit/{circuit_id}/profile")
async def get_circuit_profile(circuit_id: int):
    """Get circuit profile with records"""
    circuit = await db.circuits.find_one({"circuitId": circuit_id}, {"_id": 0})
    if not circuit:
        raise HTTPException(status_code=404, detail="Circuit not found")
    
    # Get race IDs at this circuit
    race_ids = await db.races.distinct("raceId", {"circuitId": circuit_id})
    
    # Most wins at circuit
    wins_pipeline = [
        {"$match": {"raceId": {"$in": race_ids}, "position": 1}},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$group": {
            "_id": "$driverId",
            "driverRef": {"$first": "$driver.driverRef"},
            "forename": {"$first": "$driver.forename"},
            "surname": {"$first": "$driver.surname"},
            "wins": {"$sum": 1}
        }},
        {"$project": {
            "_id": 0,
            "driverId": "$_id",
            "driverRef": 1,
            "forename": 1,
            "surname": 1,
            "wins": 1
        }},
        {"$sort": {"wins": -1}},
        {"$limit": 10}
    ]
    most_wins = await db.results.aggregate(wins_pipeline).to_list(10)
    
    # Race history at this circuit
    races_pipeline = [
        {"$match": {"circuitId": circuit_id}},
        {"$lookup": {
            "from": "results",
            "let": {"raceId": "$raceId"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [{"$eq": ["$raceId", "$$raceId"]}, {"$eq": ["$position", 1]}]}}},
                {"$lookup": {
                    "from": "drivers",
                    "localField": "driverId",
                    "foreignField": "driverId",
                    "as": "driver"
                }},
                {"$unwind": "$driver"},
                {"$project": {
                    "_id": 0,
                    "driverRef": "$driver.driverRef",
                    "forename": "$driver.forename",
                    "surname": "$driver.surname"
                }}
            ],
            "as": "winner"
        }},
        {"$unwind": {"path": "$winner", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "raceId": 1,
            "year": 1,
            "round": 1,
            "name": 1,
            "date": 1,
            "winner": 1
        }},
        {"$sort": {"year": -1}}
    ]
    race_history = await db.races.aggregate(races_pipeline).to_list(100)
    
    return {
        "circuit": circuit,
        "most_wins": most_wins,
        "race_history": race_history,
        "total_races": len(race_ids)
    }

@api_router.get("/constructor/{constructor_id}/profile")
async def get_constructor_profile(constructor_id: int):
    """Get comprehensive constructor profile for story explorer"""
    constructor = await db.constructors.find_one({"constructorId": constructor_id}, {"_id": 0})
    if not constructor:
        raise HTTPException(status_code=404, detail="Constructor not found")
    
    # Get constructor stats
    stats_pipeline = [
        {"$match": {"constructorId": constructor_id}},
        {"$group": {
            "_id": "$constructorId",
            "wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "podiums": {"$sum": {"$cond": [{"$and": [{"$gte": ["$position", 1]}, {"$lte": ["$position", 3]}]}, 1, 0]}},
            "poles": {"$sum": {"$cond": [{"$eq": ["$grid", 1]}, 1, 0]}},
            "total_points": {"$sum": {"$ifNull": ["$points", 0]}},
            "races": {"$sum": 1}
        }}
    ]
    stats_result = await db.results.aggregate(stats_pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {"wins": 0, "podiums": 0, "poles": 0, "total_points": 0, "races": 0}
    
    # Count championships
    championships = await get_constructor_championships(constructor_id, None, None)
    stats["championships"] = championships
    
    # Best seasons (most wins)
    best_seasons_pipeline = [
        {"$match": {"constructorId": constructor_id, "position": 1}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$group": {
            "_id": "$race.year",
            "wins": {"$sum": 1}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": 5}
    ]
    best_seasons = await db.results.aggregate(best_seasons_pipeline).to_list(5)
    
    # Driver roster history
    driver_history_pipeline = [
        {"$match": {"constructorId": constructor_id}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$group": {
            "_id": {
                "driverId": "$driverId",
                "year": "$race.year"
            },
            "driverRef": {"$first": "$driver.driverRef"},
            "forename": {"$first": "$driver.forename"},
            "surname": {"$first": "$driver.surname"},
            "wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "podiums": {"$sum": {"$cond": [{"$lte": ["$position", 3]}, 1, 0]}},
            "points": {"$sum": "$points"}
        }},
        {"$sort": {"_id.year": -1, "points": -1}},
        {"$group": {
            "_id": "$_id.year",
            "drivers": {"$push": {
                "driverId": "$_id.driverId",
                "driverRef": "$driverRef",
                "forename": "$forename",
                "surname": "$surname",
                "wins": "$wins",
                "podiums": "$podiums",
                "points": "$points"
            }}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 20}
    ]
    driver_history = await db.results.aggregate(driver_history_pipeline).to_list(20)
    
    # Top drivers for this constructor (by wins)
    top_drivers_pipeline = [
        {"$match": {"constructorId": constructor_id, "position": 1}},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$group": {
            "_id": "$driverId",
            "driverRef": {"$first": "$driver.driverRef"},
            "forename": {"$first": "$driver.forename"},
            "surname": {"$first": "$driver.surname"},
            "wins": {"$sum": 1}
        }},
        {"$project": {"_id": 0, "driverId": "$_id", "driverRef": 1, "forename": 1, "surname": 1, "wins": 1}},
        {"$sort": {"wins": -1}},
        {"$limit": 10}
    ]
    top_drivers = await db.results.aggregate(top_drivers_pipeline).to_list(10)
    
    # Timeline by year
    timeline_pipeline = [
        {"$match": {"constructorId": constructor_id}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$group": {
            "_id": "$race.year",
            "wins": {"$sum": {"$cond": [{"$eq": ["$position", 1]}, 1, 0]}},
            "podiums": {"$sum": {"$cond": [{"$lte": ["$position", 3]}, 1, 0]}},
            "points": {"$sum": {"$ifNull": ["$points", 0]}},
            "races": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    timeline = await db.results.aggregate(timeline_pipeline).to_list(100)
    
    return {
        "constructor": constructor,
        "stats": stats,
        "best_seasons": best_seasons,
        "driver_history": driver_history,
        "top_drivers": top_drivers,
        "timeline": timeline
    }

@api_router.get("/season/{year}/profile")
async def get_season_profile(year: int):
    """Get season profile with championship standings and key stats"""
    # Get all races in the season
    races = await db.races.find({"year": year}, {"_id": 0}).sort("round", 1).to_list(50)
    if not races:
        raise HTTPException(status_code=404, detail="Season not found")
    
    race_ids = [r["raceId"] for r in races]
    last_race_id = max(race_ids)
    
    # Get final driver standings
    driver_standings_pipeline = [
        {"$match": {"raceId": last_race_id}},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$lookup": {
            "from": "constructors",
            "let": {"driverId": "$driverId"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$raceId", last_race_id]}}},
                {"$lookup": {
                    "from": "results",
                    "pipeline": [
                        {"$match": {"raceId": last_race_id}},
                        {"$project": {"_id": 0, "driverId": 1, "constructorId": 1}}
                    ],
                    "as": "results"
                }}
            ],
            "as": "teamInfo"
        }},
        {"$project": {
            "_id": 0,
            "position": 1,
            "points": 1,
            "wins": 1,
            "driverId": 1,
            "driverRef": "$driver.driverRef",
            "forename": "$driver.forename",
            "surname": "$driver.surname",
            "nationality": "$driver.nationality"
        }},
        {"$sort": {"position": 1}},
        {"$limit": 20}
    ]
    driver_standings = await db.driver_standings.aggregate(driver_standings_pipeline).to_list(20)
    
    # Get final constructor standings
    constructor_standings_pipeline = [
        {"$match": {"raceId": last_race_id}},
        {"$lookup": {
            "from": "constructors",
            "localField": "constructorId",
            "foreignField": "constructorId",
            "as": "constructor"
        }},
        {"$unwind": "$constructor"},
        {"$project": {
            "_id": 0,
            "position": 1,
            "points": 1,
            "wins": 1,
            "constructorId": 1,
            "name": "$constructor.name",
            "nationality": "$constructor.nationality"
        }},
        {"$sort": {"position": 1}},
        {"$limit": 15}
    ]
    constructor_standings = await db.constructor_standings.aggregate(constructor_standings_pipeline).to_list(15)
    
    # Season statistics
    season_stats_pipeline = [
        {"$match": {"raceId": {"$in": race_ids}}},
        {"$group": {
            "_id": None,
            "total_entries": {"$sum": 1},
            "total_points": {"$sum": {"$ifNull": ["$points", 0]}},
            "dnfs": {"$sum": {"$cond": [{"$ne": ["$statusId", 1]}, 1, 0]}},
            "unique_winners": {"$addToSet": {"$cond": [{"$eq": ["$position", 1]}, "$driverId", None]}},
            "unique_pole_sitters": {"$addToSet": {"$cond": [{"$eq": ["$grid", 1]}, "$driverId", None]}}
        }}
    ]
    season_stats_result = await db.results.aggregate(season_stats_pipeline).to_list(1)
    season_stats = season_stats_result[0] if season_stats_result else {}
    
    # Count unique winners (filter out None)
    unique_winners = [w for w in season_stats.get("unique_winners", []) if w is not None]
    unique_pole_sitters = [p for p in season_stats.get("unique_pole_sitters", []) if p is not None]
    
    # Race winners for the season
    race_winners_pipeline = [
        {"$match": {"raceId": {"$in": race_ids}, "position": 1}},
        {"$lookup": {
            "from": "races",
            "localField": "raceId",
            "foreignField": "raceId",
            "as": "race"
        }},
        {"$unwind": "$race"},
        {"$lookup": {
            "from": "drivers",
            "localField": "driverId",
            "foreignField": "driverId",
            "as": "driver"
        }},
        {"$unwind": "$driver"},
        {"$lookup": {
            "from": "constructors",
            "localField": "constructorId",
            "foreignField": "constructorId",
            "as": "constructor"
        }},
        {"$unwind": "$constructor"},
        {"$project": {
            "_id": 0,
            "raceId": 1,
            "round": "$race.round",
            "raceName": "$race.name",
            "driverId": 1,
            "driverRef": "$driver.driverRef",
            "forename": "$driver.forename",
            "surname": "$driver.surname",
            "constructorName": "$constructor.name"
        }},
        {"$sort": {"round": 1}}
    ]
    race_winners = await db.results.aggregate(race_winners_pipeline).to_list(50)
    
    # Championship battle - points progression
    championship_progression = []
    for race in races[:]:
        standings_at_race = await db.driver_standings.find(
            {"raceId": race["raceId"]},
            {"_id": 0, "driverId": 1, "points": 1, "position": 1}
        ).sort("position", 1).limit(5).to_list(5)
        
        if standings_at_race:
            championship_progression.append({
                "round": race["round"],
                "raceName": race["name"],
                "standings": standings_at_race
            })
    
    return {
        "year": year,
        "total_races": len(races),
        "races": races,
        "driver_standings": driver_standings,
        "constructor_standings": constructor_standings,
        "stats": {
            "total_entries": season_stats.get("total_entries", 0),
            "unique_winners": len(unique_winners),
            "unique_pole_sitters": len(unique_pole_sitters),
            "dnf_count": season_stats.get("dnfs", 0)
        },
        "race_winners": race_winners,
        "championship_progression": championship_progression[:10]  # Limit to first 10 races for performance
    }

@api_router.get("/facts/generate")
async def generate_facts(
    entity_type: str = Query(..., enum=["driver", "constructor", "circuit"]),
    entity_id: int = Query(...),
    count: int = Query(default=10, le=20)
):
    """Generate interesting facts about an entity"""
    facts = []
    
    if entity_type == "driver":
        driver = await db.drivers.find_one({"driverId": entity_id}, {"_id": 0})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        name = f"{driver['forename']} {driver['surname']}"
        
        # Fact: First win
        first_win = await db.results.find_one(
            {"driverId": entity_id, "position": 1},
            {"_id": 0, "raceId": 1}
        )
        if first_win:
            race = await db.races.find_one({"raceId": first_win["raceId"]}, {"_id": 0, "name": 1, "year": 1})
            if race:
                facts.append({
                    "text": f"{name} took their maiden victory at the {race['year']} {race['name']}",
                    "type": "career_milestone"
                })
        
        # Fact: Win percentage at specific circuits
        circuit_wins = await db.results.aggregate([
            {"$match": {"driverId": entity_id, "position": 1}},
            {"$lookup": {"from": "races", "localField": "raceId", "foreignField": "raceId", "as": "race"}},
            {"$unwind": "$race"},
            {"$group": {"_id": "$race.circuitId", "wins": {"$sum": 1}}}
        ]).to_list(100)
        
        for cw in circuit_wins[:3]:
            total_at_circuit = await db.results.aggregate([
                {"$match": {"driverId": entity_id}},
                {"$lookup": {"from": "races", "localField": "raceId", "foreignField": "raceId", "as": "race"}},
                {"$unwind": "$race"},
                {"$match": {"race.circuitId": cw["_id"]}},
                {"$count": "total"}
            ]).to_list(1)
            
            if total_at_circuit and total_at_circuit[0]["total"] >= 3:
                circuit = await db.circuits.find_one({"circuitId": cw["_id"]}, {"_id": 0, "name": 1})
                win_pct = (cw["wins"] / total_at_circuit[0]["total"]) * 100
                if win_pct >= 40:
                    facts.append({
                        "text": f"{name} won {cw['wins']} of {total_at_circuit[0]['total']} races at {circuit['name']} ({win_pct:.0f}% win rate)",
                        "type": "circuit_dominance"
                    })
        
        # Fact: Consecutive wins
        wins = await db.results.find({"driverId": entity_id, "position": 1}).sort("raceId", 1).to_list(500)
        if len(wins) >= 2:
            max_streak = 1
            current_streak = 1
            for i in range(1, len(wins)):
                if wins[i]["raceId"] - wins[i-1]["raceId"] <= 3:  # Approximate consecutive
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    current_streak = 1
            if max_streak >= 3:
                facts.append({
                    "text": f"{name} achieved a streak of {max_streak} consecutive race wins",
                    "type": "winning_streak"
                })
        
        # Fact: Points in a season
        season_points = await db.results.aggregate([
            {"$match": {"driverId": entity_id}},
            {"$lookup": {"from": "races", "localField": "raceId", "foreignField": "raceId", "as": "race"}},
            {"$unwind": "$race"},
            {"$group": {"_id": "$race.year", "points": {"$sum": "$points"}}},
            {"$sort": {"points": -1}},
            {"$limit": 1}
        ]).to_list(1)
        
        if season_points:
            facts.append({
                "text": f"{name}'s best season was {season_points[0]['_id']} with {season_points[0]['points']:.0f} points",
                "type": "season_record"
            })
        
        # Fact: Podium percentage
        total_races = await db.results.count_documents({"driverId": entity_id})
        total_podiums = await db.results.count_documents({"driverId": entity_id, "position": {"$lte": 3}})
        if total_races >= 20:
            podium_pct = (total_podiums / total_races) * 100
            facts.append({
                "text": f"{name} achieved a podium finish in {total_podiums} of {total_races} races ({podium_pct:.1f}%)",
                "type": "career_stat"
            })
    
    elif entity_type == "constructor":
        constructor = await db.constructors.find_one({"constructorId": entity_id}, {"_id": 0})
        if not constructor:
            raise HTTPException(status_code=404, detail="Constructor not found")
        
        name = constructor['name']
        
        # Fact: Total wins
        total_wins = await db.results.count_documents({"constructorId": entity_id, "position": 1})
        if total_wins > 0:
            facts.append({
                "text": f"{name} has won {total_wins} Grand Prix races in Formula 1 history",
                "type": "career_stat"
            })
        
        # Fact: First win
        first_win = await db.results.find_one(
            {"constructorId": entity_id, "position": 1},
            {"_id": 0, "raceId": 1, "driverId": 1}
        )
        if first_win:
            race = await db.races.find_one({"raceId": first_win["raceId"]}, {"_id": 0, "name": 1, "year": 1})
            driver = await db.drivers.find_one({"driverId": first_win["driverId"]}, {"_id": 0, "forename": 1, "surname": 1})
            if race and driver:
                facts.append({
                    "text": f"{name}'s first F1 victory came at the {race['year']} {race['name']} with {driver['forename']} {driver['surname']}",
                    "type": "career_milestone"
                })
        
        # Fact: Most successful driver
        top_driver = await db.results.aggregate([
            {"$match": {"constructorId": entity_id, "position": 1}},
            {"$group": {"_id": "$driverId", "wins": {"$sum": 1}}},
            {"$sort": {"wins": -1}},
            {"$limit": 1}
        ]).to_list(1)
        if top_driver:
            driver = await db.drivers.find_one({"driverId": top_driver[0]["_id"]}, {"_id": 0, "forename": 1, "surname": 1})
            if driver:
                facts.append({
                    "text": f"{driver['forename']} {driver['surname']} is {name}'s most successful driver with {top_driver[0]['wins']} victories",
                    "type": "driver_record"
                })
        
        # Fact: Best season
        best_season = await db.results.aggregate([
            {"$match": {"constructorId": entity_id, "position": 1}},
            {"$lookup": {"from": "races", "localField": "raceId", "foreignField": "raceId", "as": "race"}},
            {"$unwind": "$race"},
            {"$group": {"_id": "$race.year", "wins": {"$sum": 1}}},
            {"$sort": {"wins": -1}},
            {"$limit": 1}
        ]).to_list(1)
        if best_season and best_season[0]["wins"] > 0:
            facts.append({
                "text": f"{name}'s most dominant season was {best_season[0]['_id']} with {best_season[0]['wins']} race wins",
                "type": "season_record"
            })
        
        # Fact: Total podiums
        total_podiums = await db.results.count_documents({"constructorId": entity_id, "position": {"$lte": 3}})
        if total_podiums > 0:
            facts.append({
                "text": f"{name} has achieved {total_podiums} podium finishes in F1",
                "type": "career_stat"
            })
        
        # Fact: Active years
        years = await db.results.aggregate([
            {"$match": {"constructorId": entity_id}},
            {"$lookup": {"from": "races", "localField": "raceId", "foreignField": "raceId", "as": "race"}},
            {"$unwind": "$race"},
            {"$group": {"_id": None, "first": {"$min": "$race.year"}, "last": {"$max": "$race.year"}}}
        ]).to_list(1)
        if years:
            facts.append({
                "text": f"{name} competed in F1 from {years[0]['first']} to {years[0]['last']}",
                "type": "history"
            })
    
    elif entity_type == "circuit":
        circuit = await db.circuits.find_one({"circuitId": entity_id}, {"_id": 0})
        if not circuit:
            raise HTTPException(status_code=404, detail="Circuit not found")
        
        name = circuit['name']
        
        # Fact: Total races held
        total_races = await db.races.count_documents({"circuitId": entity_id})
        if total_races > 0:
            facts.append({
                "text": f"{name} has hosted {total_races} Formula 1 Grand Prix events",
                "type": "history"
            })
        
        # Fact: First race
        first_race = await db.races.find_one({"circuitId": entity_id}, {"_id": 0, "name": 1, "year": 1}, sort=[("year", 1)])
        if first_race:
            facts.append({
                "text": f"The first F1 race at {name} was the {first_race['year']} {first_race['name']}",
                "type": "history"
            })
        
        # Fact: Most wins at circuit
        race_ids = await db.races.distinct("raceId", {"circuitId": entity_id})
        if race_ids:
            top_winner = await db.results.aggregate([
                {"$match": {"raceId": {"$in": race_ids}, "position": 1}},
                {"$group": {"_id": "$driverId", "wins": {"$sum": 1}}},
                {"$sort": {"wins": -1}},
                {"$limit": 1}
            ]).to_list(1)
            if top_winner:
                driver = await db.drivers.find_one({"driverId": top_winner[0]["_id"]}, {"_id": 0, "forename": 1, "surname": 1})
                if driver:
                    facts.append({
                        "text": f"{driver['forename']} {driver['surname']} holds the record for most wins at {name} with {top_winner[0]['wins']} victories",
                        "type": "driver_record"
                    })
        
        # Fact: Most wins by constructor
        if race_ids:
            top_constructor = await db.results.aggregate([
                {"$match": {"raceId": {"$in": race_ids}, "position": 1}},
                {"$group": {"_id": "$constructorId", "wins": {"$sum": 1}}},
                {"$sort": {"wins": -1}},
                {"$limit": 1}
            ]).to_list(1)
            if top_constructor:
                constructor = await db.constructors.find_one({"constructorId": top_constructor[0]["_id"]}, {"_id": 0, "name": 1})
                if constructor:
                    facts.append({
                        "text": f"{constructor['name']} is the most successful constructor at {name} with {top_constructor[0]['wins']} wins",
                        "type": "constructor_record"
                    })
        
        # Fact: Circuit location
        if circuit.get('location') and circuit.get('country'):
            facts.append({
                "text": f"{name} is located in {circuit['location']}, {circuit['country']}",
                "type": "info"
            })
    
    return facts[:count]

# Include router and configure CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Import data on startup"""
    logger.info("Starting F1 Intelligence API...")
    await import_csv_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
