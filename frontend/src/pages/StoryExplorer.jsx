import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, User, Building, Map, Calendar, Trophy, Flag, Sparkles, ExternalLink } from 'lucide-react';
import { getDrivers, getConstructors, getCircuits, getSeasons, getDriverProfile, getCircuitProfile, getConstructorProfile, getSeasonProfile, generateFacts } from '../lib/api';
import { ChartFrame, PositionBadge, EmptyState } from '../components/F1Components';
import { formatNumber } from '../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Search } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-surface-200/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-mono text-sm text-white">{entry.value}</span>
          <span className="text-slate-500 text-xs">{entry.name}</span>
        </div>
      ))}
    </div>
  );
};

const FactCard = ({ fact, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className="bg-surface-100 border border-white/10 rounded-lg p-4 hover:border-racing-cyan/30 transition-colors group"
  >
    <div className="flex items-start gap-3">
      <Sparkles className="w-5 h-5 text-racing-yellow flex-shrink-0 mt-1" />
      <div>
        <p className="text-white text-sm leading-relaxed">{fact.text}</p>
        <span className="text-xs text-slate-600 mt-2 block capitalize">{fact.type?.replace('_', ' ')}</span>
      </div>
    </div>
  </motion.div>
);

const StoryExplorer = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [entityType, setEntityType] = useState(searchParams.get('type') || 'driver');
  const [entityId, setEntityId] = useState(searchParams.get('id') ? parseInt(searchParams.get('id')) : null);
  const [search, setSearch] = useState('');
  
  const [entities, setEntities] = useState([]);
  const [profile, setProfile] = useState(null);
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [factsLoading, setFactsLoading] = useState(false);

  // Fetch entities based on type
  useEffect(() => {
    const fetchEntities = async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      
      try {
        let data;
        switch (entityType) {
          case 'driver':
            data = await getDrivers(params);
            break;
          case 'constructor':
            data = await getConstructors(params);
            break;
          case 'circuit':
            data = await getCircuits(params);
            break;
          case 'season':
            data = await getSeasons();
            break;
          default:
            data = [];
        }
        setEntities(data);
      } catch (err) {
        console.error('Failed to fetch entities:', err);
      }
    };
    
    fetchEntities();
  }, [entityType, search]);

  // Fetch profile when entity selected
  useEffect(() => {
    if (!entityId) {
      setProfile(null);
      setFacts([]);
      return;
    }
    
    const fetchProfile = async () => {
      setLoading(true);
      try {
        let data;
        switch (entityType) {
          case 'driver':
            data = await getDriverProfile(entityId);
            break;
          case 'circuit':
            data = await getCircuitProfile(entityId);
            break;
          case 'constructor':
            data = await getConstructorProfile(entityId);
            break;
          case 'season':
            data = await getSeasonProfile(entityId);
            break;
          default:
            data = null;
        }
        setProfile(data);
        
        // Update URL
        setSearchParams({ type: entityType, id: entityId.toString() }, { replace: true });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [entityType, entityId, setSearchParams]);

  // Generate facts
  const handleGenerateFacts = async () => {
    if (!entityId || entityType === 'season') return;
    
    setFactsLoading(true);
    try {
      const data = await generateFacts({
        entity_type: entityType,
        entity_id: entityId,
        count: 10
      });
      setFacts(data);
    } catch (err) {
      console.error('Failed to generate facts:', err);
    } finally {
      setFactsLoading(false);
    }
  };

  const getEntityName = (entity) => {
    if (!entity) return '';
    if (entityType === 'driver') return `${entity.forename} ${entity.surname}`;
    if (entityType === 'constructor') return entity.name;
    if (entityType === 'circuit') return entity.name;
    if (entityType === 'season') return entity.year.toString();
    return '';
  };

  const getEntityId = (entity) => {
    if (entityType === 'driver') return entity.driverId;
    if (entityType === 'constructor') return entity.constructorId;
    if (entityType === 'circuit') return entity.circuitId;
    if (entityType === 'season') return entity.year;
    return null;
  };

  return (
    <div className="min-h-screen bg-void" data-testid="story-explorer">
      {/* Entity Selector */}
      <div className="bg-surface-100 border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-slate-500 mb-4">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Story Explorer</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {/* Entity Type */}
            <Tabs value={entityType} onValueChange={(v) => { setEntityType(v); setEntityId(null); setProfile(null); }}>
              <TabsList className="bg-surface-200 border border-white/10">
                <TabsTrigger 
                  value="driver" 
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  data-testid="tab-driver"
                >
                  <User className="w-4 h-4 mr-2" />
                  Drivers
                </TabsTrigger>
                <TabsTrigger 
                  value="constructor"
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  data-testid="tab-constructor"
                >
                  <Building className="w-4 h-4 mr-2" />
                  Teams
                </TabsTrigger>
                <TabsTrigger 
                  value="circuit"
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  data-testid="tab-circuit"
                >
                  <Map className="w-4 h-4 mr-2" />
                  Circuits
                </TabsTrigger>
                <TabsTrigger 
                  value="season"
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  data-testid="tab-season"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Seasons
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Entity Search */}
            <div className="flex-1 flex gap-2">
              {entityType !== 'season' && (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    placeholder={`Search ${entityType}s...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-surface-200 border-white/10"
                  />
                </div>
              )}
              <Select value={entityId?.toString() || "none"} onValueChange={(v) => v !== "none" && setEntityId(parseInt(v))}>
                <SelectTrigger className="w-64 bg-surface-200 border-white/10" data-testid="entity-select">
                  <SelectValue placeholder={`Select ${entityType}`} />
                </SelectTrigger>
                <SelectContent className="bg-surface-200 border-white/10 max-h-80">
                  <SelectItem value="none" disabled>Select {entityType}</SelectItem>
                  {entities.map(entity => (
                    <SelectItem key={getEntityId(entity)} value={getEntityId(entity)?.toString()}>
                      {getEntityName(entity)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {!entityId ? (
          <EmptyState 
            icon={BookOpen}
            title="Select an Entity"
            description="Choose a driver, team, circuit, or season to explore their story and statistics"
          />
        ) : loading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full bg-surface-300" />
            <Skeleton className="h-96 w-full bg-surface-300" />
          </div>
        ) : profile ? (
          <>
            {/* DRIVER PROFILE */}
            {entityType === 'driver' && profile.driver && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-100 border border-white/10 rounded-lg p-6 mb-8 relative overflow-hidden"
                >
                  <div className="corner-accent-cyan" />
                  
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div>
                      <span className="data-label">{profile.driver.nationality}</span>
                      <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mt-2">
                        {profile.driver.forename}
                        <br />
                        <span className="text-racing-cyan">{profile.driver.surname}</span>
                      </h1>
                      {profile.driver.code && (
                        <span className="font-mono text-2xl text-slate-500 mt-2 block">{profile.driver.code}</span>
                      )}
                    </div>
                    
                    {profile.stats && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Wins</span>
                          <span className="text-3xl font-mono font-bold text-racing-red">{profile.stats.wins}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Podiums</span>
                          <span className="text-3xl font-mono font-bold text-racing-cyan">{profile.stats.podiums}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Poles</span>
                          <span className="text-3xl font-mono font-bold text-racing-purple">{profile.stats.poles}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Championships</span>
                          <span className="text-3xl font-mono font-bold text-racing-yellow">{profile.stats.championships}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Link 
                      to={`/rivalry?d1=${entityId}`}
                      className="text-sm text-racing-cyan hover:underline flex items-center gap-1"
                    >
                      Compare with another driver <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link 
                      to={`/goat`}
                      className="text-sm text-racing-yellow hover:underline flex items-center gap-1"
                    >
                      View GOAT ranking <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {profile.timeline && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <ChartFrame title="Career Timeline" loading={false}>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={profile.timeline}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#252932" />
                              <XAxis dataKey="_id" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                              <YAxis tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Line type="monotone" dataKey="wins" name="Wins" stroke="#FF1E1E" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="podiums" name="Podiums" stroke="#00F0FF" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.best_seasons && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <ChartFrame title="Best Seasons" loading={false}>
                        <div className="space-y-2">
                          {profile.best_seasons.map((season, i) => (
                            <Link key={i} to={`/story?type=season&id=${season._id}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <span className="font-mono text-white">{season._id}</span>
                              <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-racing-yellow" />
                                <span className="font-mono text-racing-yellow font-bold">{season.wins} wins</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.signature_circuits && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
                      <ChartFrame title="Signature Circuits" loading={false}>
                        <div className="grid md:grid-cols-2 gap-2">
                          {profile.signature_circuits.map((circuit, i) => (
                            <Link key={i} to={`/story?type=circuit&id=${circuit._id}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <div>
                                <span className="text-white">{circuit.name}</span>
                                <span className="text-slate-500 text-sm ml-2">{circuit.country}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Flag className="w-4 h-4 text-racing-red" />
                                <span className="font-mono text-racing-red font-bold">{circuit.wins} wins</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}
                </div>
              </>
            )}

            {/* CONSTRUCTOR PROFILE */}
            {entityType === 'constructor' && profile.constructor && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-100 border border-white/10 rounded-lg p-6 mb-8 relative overflow-hidden"
                >
                  <div className="corner-accent-red" />
                  
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div>
                      <span className="data-label">{profile.constructor.nationality}</span>
                      <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mt-2">
                        <span className="text-racing-red">{profile.constructor.name}</span>
                      </h1>
                    </div>
                    
                    {profile.stats && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Wins</span>
                          <span className="text-3xl font-mono font-bold text-racing-red">{profile.stats.wins}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Podiums</span>
                          <span className="text-3xl font-mono font-bold text-racing-cyan">{profile.stats.podiums}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Poles</span>
                          <span className="text-3xl font-mono font-bold text-racing-purple">{profile.stats.poles}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">Points</span>
                          <span className="text-2xl font-mono font-bold text-white">{formatNumber(profile.stats.total_points)}</span>
                        </div>
                        <div className="bg-surface-200 rounded-lg p-4 text-center">
                          <span className="data-label block mb-1">WCC</span>
                          <span className="text-3xl font-mono font-bold text-racing-yellow">{profile.stats.championships}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {profile.timeline && profile.timeline.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <ChartFrame title="Performance Timeline" loading={false}>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={profile.timeline}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#252932" />
                              <XAxis dataKey="_id" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                              <YAxis tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Line type="monotone" dataKey="wins" name="Wins" stroke="#FF1E1E" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="podiums" name="Podiums" stroke="#00F0FF" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.top_drivers && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <ChartFrame title="Top Drivers" loading={false}>
                        <div className="space-y-2">
                          {profile.top_drivers.map((driver, i) => (
                            <Link key={i} to={`/story?type=driver&id=${driver.driverId}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <div className="flex items-center gap-3">
                                <PositionBadge position={i + 1} size="sm" />
                                <span className="text-white">{driver.forename} {driver.surname}</span>
                              </div>
                              <span className="font-mono text-racing-yellow font-bold">{driver.wins} wins</span>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.best_seasons && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <ChartFrame title="Best Seasons" loading={false}>
                        <div className="space-y-2">
                          {profile.best_seasons.map((season, i) => (
                            <Link key={i} to={`/story?type=season&id=${season._id}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <span className="font-mono text-white">{season._id}</span>
                              <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-racing-yellow" />
                                <span className="font-mono text-racing-yellow font-bold">{season.wins} wins</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.driver_history && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                      <ChartFrame title="Driver Roster by Year" loading={false}>
                        <div className="max-h-80 overflow-y-auto space-y-3">
                          {profile.driver_history.map((year, i) => (
                            <div key={i} className="bg-surface-200 rounded p-3">
                              <span className="font-mono text-racing-cyan font-bold">{year._id}</span>
                              <div className="mt-2 space-y-1">
                                {year.drivers.map((driver, j) => (
                                  <Link key={j} to={`/story?type=driver&id=${driver.driverId}`} className="flex items-center justify-between text-sm hover:text-racing-cyan transition-colors">
                                    <span className="text-white">{driver.forename} {driver.surname}</span>
                                    <span className="text-slate-500">{driver.wins}W {driver.podiums}P {driver.points?.toFixed(0)}pts</span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}
                </div>
              </>
            )}

            {/* CIRCUIT PROFILE */}
            {entityType === 'circuit' && profile.circuit && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-100 border border-white/10 rounded-lg p-6 mb-8 relative overflow-hidden"
                >
                  <div className="corner-accent-red" />
                  
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div>
                      <span className="data-label">{profile.circuit.country}</span>
                      <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mt-2">
                        {profile.circuit.name}
                      </h1>
                      <span className="text-slate-500 mt-2 block">{profile.circuit.location}</span>
                    </div>
                    
                    <div className="bg-surface-200 rounded-lg p-4 text-center">
                      <span className="data-label block mb-1">Total Races</span>
                      <span className="text-3xl font-mono font-bold text-white">{profile.total_races}</span>
                    </div>
                  </div>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {profile.most_wins && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <ChartFrame title="Most Wins" loading={false}>
                        <div className="space-y-2">
                          {profile.most_wins.map((driver, i) => (
                            <Link key={i} to={`/story?type=driver&id=${driver.driverId}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <div className="flex items-center gap-3">
                                <PositionBadge position={i + 1} size="sm" />
                                <span className="text-white">{driver.forename} {driver.surname}</span>
                              </div>
                              <span className="font-mono text-racing-yellow font-bold">{driver.wins}</span>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.race_history && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <ChartFrame title="Race History" loading={false}>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {profile.race_history.slice(0, 20).map((race, i) => (
                            <Link key={i} to={`/race?raceId=${race.raceId}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <div>
                                <span className="font-mono text-racing-cyan mr-2">{race.year}</span>
                                <span className="text-white">{race.name}</span>
                              </div>
                              {race.winner && (
                                <span className="text-slate-400 text-sm">
                                  {race.winner.forename} {race.winner.surname}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}
                </div>
              </>
            )}

            {/* SEASON PROFILE */}
            {entityType === 'season' && profile.year && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-100 border border-white/10 rounded-lg p-6 mb-8 relative overflow-hidden"
                >
                  <div className="corner-accent-yellow" />
                  
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div>
                      <span className="data-label">Formula 1 Season</span>
                      <h1 className="font-heading text-5xl md:text-6xl font-bold uppercase tracking-tight text-racing-yellow mt-2">
                        {profile.year}
                      </h1>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-surface-200 rounded-lg p-4 text-center">
                        <span className="data-label block mb-1">Races</span>
                        <span className="text-2xl font-mono font-bold text-white">{profile.total_races}</span>
                      </div>
                      <div className="bg-surface-200 rounded-lg p-4 text-center">
                        <span className="data-label block mb-1">Winners</span>
                        <span className="text-2xl font-mono font-bold text-racing-red">{profile.stats?.unique_winners || 0}</span>
                      </div>
                      <div className="bg-surface-200 rounded-lg p-4 text-center">
                        <span className="data-label block mb-1">Pole Sitters</span>
                        <span className="text-2xl font-mono font-bold text-racing-purple">{profile.stats?.unique_pole_sitters || 0}</span>
                      </div>
                      <div className="bg-surface-200 rounded-lg p-4 text-center">
                        <span className="data-label block mb-1">DNFs</span>
                        <span className="text-2xl font-mono font-bold text-slate-400">{profile.stats?.dnf_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {profile.driver_standings && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <ChartFrame title="Driver Championship" loading={false}>
                        <div className="space-y-2">
                          {profile.driver_standings.map((driver, i) => (
                            <Link key={i} to={`/story?type=driver&id=${driver.driverId}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <div className="flex items-center gap-3">
                                <PositionBadge position={driver.position} size="sm" />
                                <span className="text-white">{driver.forename} {driver.surname}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-500 text-sm">{driver.wins}W</span>
                                <span className="font-mono text-racing-yellow font-bold">{driver.points} pts</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.constructor_standings && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <ChartFrame title="Constructor Championship" loading={false}>
                        <div className="space-y-2">
                          {profile.constructor_standings.map((team, i) => (
                            <Link key={i} to={`/story?type=constructor&id=${team.constructorId}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                              <div className="flex items-center gap-3">
                                <PositionBadge position={team.position} size="sm" />
                                <span className="text-white">{team.name}</span>
                              </div>
                              <span className="font-mono text-racing-yellow font-bold">{team.points} pts</span>
                            </Link>
                          ))}
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}

                  {profile.race_winners && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
                      <ChartFrame title="Race Winners" loading={false}>
                        <div className="max-h-80 overflow-y-auto">
                          <div className="grid md:grid-cols-2 gap-2">
                            {profile.race_winners.map((race, i) => (
                              <Link key={i} to={`/race?raceId=${race.raceId}`} className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors">
                                <div>
                                  <span className="font-mono text-racing-cyan mr-2">R{race.round}</span>
                                  <span className="text-white text-sm">{race.raceName}</span>
                                </div>
                                <span className="text-slate-400 text-sm">{race.forename} {race.surname}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </ChartFrame>
                    </motion.div>
                  )}
                </div>
              </>
            )}

            {/* Facts Section (not for seasons) */}
            {entityType !== 'season' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-xl font-semibold uppercase text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-racing-yellow" />
                    Interesting Facts
                  </h2>
                  <Button 
                    onClick={handleGenerateFacts}
                    disabled={factsLoading}
                    className="bg-white text-black hover:bg-slate-200"
                    data-testid="generate-facts"
                  >
                    {factsLoading ? 'Generating...' : 'Generate Facts'}
                  </Button>
                </div>
                
                {facts.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {facts.map((fact, i) => (
                      <FactCard key={i} fact={fact} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-100 border border-white/10 rounded-lg p-8 text-center">
                    <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500">Click "Generate Facts" to discover interesting statistics</p>
                  </div>
                )}
              </motion.div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default StoryExplorer;
