import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flag, Clock, Users, TrendingUp, TrendingDown, AlertCircle, ChevronDown } from 'lucide-react';
import { getRaces, getRaceDetails, getRaceResults, getRaceLapTimes, getRacePitStops, getRaceMovers } from '../lib/api';
import { ChartFrame, DataTable, PositionBadge, DriverTag, EmptyState } from '../components/F1Components';
import { getDriverColor, formatNumber } from '../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-surface-200/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-2">Lap {label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-mono text-xs text-white">P{entry.value}</span>
          <span className="text-slate-500 text-xs">{entry.name}</span>
        </div>
      ))}
    </div>
  );
};

const RaceDeepDive = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raceIdParam = searchParams.get('raceId');
  
  const [races, setRaces] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearRaces, setYearRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(raceIdParam ? parseInt(raceIdParam) : null);
  
  const [raceDetails, setRaceDetails] = useState(null);
  const [results, setResults] = useState([]);
  const [lapTimes, setLapTimes] = useState([]);
  const [pitStops, setPitStops] = useState([]);
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedDrivers, setHighlightedDrivers] = useState([]);

  // Fetch all races for picker
  useEffect(() => {
    getRaces({ limit: 2000 }).then(data => {
      setRaces(data);
      // Extract unique years
      const years = [...new Set(data.map(r => r.year))].sort((a, b) => b - a);
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0]);
      }
    }).catch(console.error);
  }, []);

  // Filter races by year
  useEffect(() => {
    if (selectedYear && races.length > 0) {
      const filtered = races.filter(r => r.year === selectedYear).sort((a, b) => a.round - b.round);
      setYearRaces(filtered);
      // Select first race of year if none selected
      if (!selectedRaceId && filtered.length > 0) {
        setSelectedRaceId(filtered[0].raceId);
      }
    }
  }, [selectedYear, races]);

  // Fetch race data
  useEffect(() => {
    if (!selectedRaceId) return;
    
    const fetchRaceData = async () => {
      setLoading(true);
      try {
        const [details, resultsData, moversData] = await Promise.all([
          getRaceDetails(selectedRaceId),
          getRaceResults(selectedRaceId),
          getRaceMovers(selectedRaceId)
        ]);
        
        setRaceDetails(details);
        setResults(resultsData);
        setMovers(moversData);
        
        // Fetch lap times (may not exist for older races)
        try {
          const lapData = await getRaceLapTimes(selectedRaceId);
          setLapTimes(lapData);
          // Auto-highlight top 5 finishers
          const topDriverIds = resultsData.slice(0, 5).map(r => r.driverId);
          setHighlightedDrivers(topDriverIds);
        } catch {
          setLapTimes([]);
        }
        
        // Fetch pit stops
        try {
          const pitData = await getRacePitStops(selectedRaceId);
          setPitStops(pitData);
        } catch {
          setPitStops([]);
        }
        
        // Update URL
        setSearchParams({ raceId: selectedRaceId.toString() }, { replace: true });
      } catch (err) {
        console.error('Failed to fetch race data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRaceData();
  }, [selectedRaceId, setSearchParams]);

  // Prepare position chart data
  const positionChartData = useMemo(() => {
    if (!lapTimes.length) return [];
    
    // Find max laps
    const maxLap = Math.max(...lapTimes.flatMap(d => d.laps.map(l => l.lap)));
    
    // Build data points
    const dataPoints = [];
    for (let lap = 1; lap <= maxLap; lap++) {
      const point = { lap };
      lapTimes.forEach(driver => {
        const lapData = driver.laps.find(l => l.lap === lap);
        if (lapData) {
          point[driver.code || driver.driverRef] = lapData.position;
        }
      });
      dataPoints.push(point);
    }
    
    return dataPoints;
  }, [lapTimes]);

  const toggleDriverHighlight = (driverId) => {
    setHighlightedDrivers(prev => 
      prev.includes(driverId) 
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const resultColumns = [
    { 
      key: 'position', 
      label: 'Pos', 
      width: '60px',
      render: (val) => <PositionBadge position={val} size="sm" />
    },
    { 
      key: 'driver', 
      label: 'Driver',
      render: (_, row) => <DriverTag driver={row} />
    },
    { 
      key: 'constructorName', 
      label: 'Team',
      render: (val) => <span className="text-slate-400">{val}</span>
    },
    { key: 'grid', label: 'Grid', mono: true },
    { 
      key: 'change', 
      label: '+/-',
      render: (_, row) => {
        if (!row.position || !row.grid) return '-';
        const change = row.grid - row.position;
        return (
          <span className={`font-mono ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {change > 0 ? '+' : ''}{change}
          </span>
        );
      }
    },
    { key: 'laps', label: 'Laps', mono: true },
    { 
      key: 'time', 
      label: 'Time/Status',
      render: (val, row) => (
        <span className="font-mono text-sm">
          {val || row.status || '-'}
        </span>
      )
    },
    { 
      key: 'points', 
      label: 'Pts', 
      mono: true,
      render: (val) => val > 0 ? <span className="text-racing-yellow">{val}</span> : '-'
    },
  ];

  const years = [...new Set(races.map(r => r.year))].sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-void" data-testid="race-deep-dive">
      {/* Race Selector */}
      <div className="bg-surface-100 border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Flag className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Select Race</span>
          </div>
          
          <Select value={selectedYear?.toString() || ""} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32 bg-surface-200 border-white/10" data-testid="race-year-select">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="bg-surface-200 border-white/10 max-h-60">
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedRaceId?.toString() || ""} onValueChange={(v) => setSelectedRaceId(parseInt(v))}>
            <SelectTrigger className="w-64 bg-surface-200 border-white/10" data-testid="race-select">
              <SelectValue placeholder="Select Race" />
            </SelectTrigger>
            <SelectContent className="bg-surface-200 border-white/10 max-h-60">
              {yearRaces.map(r => (
                <SelectItem key={r.raceId} value={r.raceId.toString()}>
                  R{r.round}: {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {!selectedRaceId ? (
          <EmptyState 
            icon={Flag}
            title="Select a Race"
            description="Choose a season and race from the selector above to view detailed analysis"
          />
        ) : loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full bg-surface-300" />
            <Skeleton className="h-96 w-full bg-surface-300" />
          </div>
        ) : (
          <>
            {/* Race Header */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-100 border border-white/10 rounded-lg p-6 mb-8 relative overflow-hidden"
            >
              <div className="corner-accent-red" />
              
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <span className="data-label">{raceDetails?.year} Round {raceDetails?.round}</span>
                  <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mt-1">
                    {raceDetails?.name}
                  </h1>
                  <p className="text-slate-400 mt-2">
                    {raceDetails?.circuit?.name} · {raceDetails?.circuit?.location}, {raceDetails?.circuit?.country}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    {new Date(raceDetails?.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {raceDetails?.winner && (
                    <div className="text-center p-3 bg-surface-200 rounded-lg">
                      <span className="data-label block mb-1">Winner</span>
                      <span className="text-white font-semibold">
                        {raceDetails.winner.driver?.forename} {raceDetails.winner.driver?.surname}
                      </span>
                    </div>
                  )}
                  {raceDetails?.poleSitter && (
                    <div className="text-center p-3 bg-surface-200 rounded-lg">
                      <span className="data-label block mb-1">Pole</span>
                      <span className="text-white font-semibold">
                        {raceDetails.poleSitter.forename} {raceDetails.poleSitter.surname}
                      </span>
                    </div>
                  )}
                  {raceDetails?.fastestLap && (
                    <div className="text-center p-3 bg-surface-200 rounded-lg">
                      <span className="data-label block mb-1">Fastest Lap</span>
                      <span className="text-racing-purple font-mono">
                        {raceDetails.fastestLap.time}
                      </span>
                    </div>
                  )}
                  <div className="text-center p-3 bg-surface-200 rounded-lg">
                    <span className="data-label block mb-1">DNFs</span>
                    <span className="text-racing-red font-mono font-bold">
                      {raceDetails?.dnfCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Position Chart */}
            {positionChartData.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <ChartFrame 
                  title="Position by Lap" 
                  loading={false}
                  actions={
                    <div className="flex flex-wrap gap-1">
                      {lapTimes.slice(0, 10).map((driver, i) => (
                        <Badge
                          key={driver.driverId}
                          variant={highlightedDrivers.includes(driver.driverId) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            highlightedDrivers.includes(driver.driverId) 
                              ? 'bg-white text-black' 
                              : 'hover:bg-white/10'
                          }`}
                          onClick={() => toggleDriverHighlight(driver.driverId)}
                        >
                          {driver.code || driver.driverRef}
                        </Badge>
                      ))}
                    </div>
                  }
                >
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={positionChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252932" />
                        <XAxis 
                          dataKey="lap" 
                          tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          axisLine={{ stroke: '#252932' }}
                          label={{ value: 'Lap', position: 'bottom', fill: '#64748B', fontSize: 12 }}
                        />
                        <YAxis 
                          reversed
                          domain={[1, 20]}
                          tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          axisLine={{ stroke: '#252932' }}
                          label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 12 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {lapTimes.map((driver, i) => {
                          const isHighlighted = highlightedDrivers.includes(driver.driverId);
                          return (
                            <Line
                              key={driver.driverId}
                              type="monotone"
                              dataKey={driver.code || driver.driverRef}
                              stroke={getDriverColor(i)}
                              strokeWidth={isHighlighted ? 2 : 1}
                              strokeOpacity={highlightedDrivers.length === 0 || isHighlighted ? 1 : 0.2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>
              </motion.div>
            ) : (
              <div className="bg-surface-100 border border-white/10 rounded-lg p-8 mb-6 text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Lap Data Not Available</h3>
                <p className="text-slate-500">Detailed lap times were not recorded for races before 1996</p>
              </div>
            )}

            {/* Key Movers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid md:grid-cols-2 gap-6 my-6"
            >
              <ChartFrame title="Biggest Gainers" loading={false}>
                <div className="space-y-2">
                  {movers.filter(m => m.positionsGained > 0).slice(0, 5).map((mover, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-200 rounded">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-white">{mover.forename} {mover.surname}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-500 text-sm">
                          P{mover.grid} → P{mover.position}
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          +{mover.positionsGained}
                        </span>
                      </div>
                    </div>
                  ))}
                  {movers.filter(m => m.positionsGained > 0).length === 0 && (
                    <p className="text-slate-500 text-center py-4">No significant position gains</p>
                  )}
                </div>
              </ChartFrame>

              <ChartFrame title="Biggest Losers" loading={false}>
                <div className="space-y-2">
                  {movers.filter(m => m.positionsGained < 0).slice(-5).reverse().map((mover, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-200 rounded">
                      <div className="flex items-center gap-3">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-white">{mover.forename} {mover.surname}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-500 text-sm">
                          P{mover.grid} → P{mover.position}
                        </span>
                        <span className="font-mono text-red-400 font-bold">
                          {mover.positionsGained}
                        </span>
                      </div>
                    </div>
                  ))}
                  {movers.filter(m => m.positionsGained < 0).length === 0 && (
                    <p className="text-slate-500 text-center py-4">No significant position drops</p>
                  )}
                </div>
              </ChartFrame>
            </motion.div>

            {/* Pit Stops */}
            {pitStops.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ChartFrame title="Pit Stop Timeline" loading={false}>
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px] p-4">
                      {/* Group by driver */}
                      {Object.entries(
                        pitStops.reduce((acc, ps) => {
                          if (!acc[ps.driverId]) {
                            acc[ps.driverId] = { ...ps, stops: [] };
                          }
                          acc[ps.driverId].stops.push(ps);
                          return acc;
                        }, {})
                      ).slice(0, 10).map(([driverId, data], i) => (
                        <div key={driverId} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
                          <span className="w-16 font-mono text-xs text-racing-cyan">{data.code || data.driverRef}</span>
                          <div className="flex-1 relative h-8 bg-surface-200 rounded">
                            {/* Lap markers */}
                            <div className="absolute inset-0 flex justify-between px-2 items-center">
                              {[...Array(10)].map((_, j) => (
                                <span key={j} className="text-[10px] text-slate-600">{(j + 1) * 10}</span>
                              ))}
                            </div>
                            {/* Pit stops */}
                            {data.stops.map((stop, j) => {
                              const maxLap = Math.max(...pitStops.map(p => p.lap)) || 60;
                              const left = (stop.lap / maxLap) * 100;
                              return (
                                <div
                                  key={j}
                                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-racing-yellow rounded-full cursor-pointer hover:scale-150 transition-transform"
                                  style={{ left: `${left}%` }}
                                  title={`Lap ${stop.lap}: ${stop.duration}s`}
                                />
                              );
                            })}
                          </div>
                          <span className="w-20 text-right text-slate-500 text-xs">
                            {data.stops.length} stop{data.stops.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartFrame>
              </motion.div>
            )}

            {/* Full Results */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6"
            >
              <ChartFrame title="Race Classification" loading={false}>
                <DataTable 
                  columns={resultColumns}
                  data={results}
                  emptyMessage="No results available"
                />
              </ChartFrame>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default RaceDeepDive;
