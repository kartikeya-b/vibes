import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  timeout: 30000,
});

// Metadata endpoints
export const getSeasons = () => api.get('/seasons').then(r => r.data);
export const getDrivers = (params) => api.get('/drivers', { params }).then(r => r.data);
export const getConstructors = (params) => api.get('/constructors', { params }).then(r => r.data);
export const getCircuits = (params) => api.get('/circuits', { params }).then(r => r.data);
export const getRaces = (params) => api.get('/races', { params }).then(r => r.data);

// Analytics endpoints
export const getOverviewStats = (params) => api.get('/stats/overview', { params }).then(r => r.data);
export const getDriverStats = (params) => api.get('/stats/drivers', { params }).then(r => r.data);
export const getConstructorStats = (params) => api.get('/stats/constructors', { params }).then(r => r.data);

// Race Deep Dive endpoints
export const getRaceDetails = (raceId) => api.get(`/race/${raceId}`).then(r => r.data);
export const getRaceResults = (raceId) => api.get(`/race/${raceId}/results`).then(r => r.data);
export const getRaceLapTimes = (raceId, params) => api.get(`/race/${raceId}/lap-times`, { params }).then(r => r.data);
export const getRacePitStops = (raceId) => api.get(`/race/${raceId}/pit-stops`).then(r => r.data);
export const getRaceMovers = (raceId) => api.get(`/race/${raceId}/movers`).then(r => r.data);

// Rivalry endpoints
export const getHeadToHead = (driver1Id, driver2Id, params) => 
  api.get(`/rivalry/${driver1Id}/${driver2Id}`, { params }).then(r => r.data);

// GOAT Engine endpoints
export const getGoatLeaderboard = (params) => api.get('/goat/leaderboard', { params }).then(r => r.data);

// Story Explorer endpoints
export const getDriverProfile = (driverId) => api.get(`/driver/${driverId}/profile`).then(r => r.data);
export const getCircuitProfile = (circuitId) => api.get(`/circuit/${circuitId}/profile`).then(r => r.data);
export const getConstructorProfile = (constructorId) => api.get(`/constructor/${constructorId}/profile`).then(r => r.data);
export const getSeasonProfile = (year) => api.get(`/season/${year}/profile`).then(r => r.data);
export const generateFacts = (params) => api.get('/facts/generate', { params }).then(r => r.data);

// Import data
export const importData = () => api.post('/import-data').then(r => r.data);

export default api;
