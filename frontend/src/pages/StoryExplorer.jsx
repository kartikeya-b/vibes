import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, User, Building, Map, Trophy, Flag, Sparkles, Share2, ExternalLink } from 'lucide-react';
import { getDrivers, getConstructors, getCircuits, getDriverProfile, getCircuitProfile, generateFacts } from '../lib/api';
import { ChartFrame, StatCard, PositionBadge, EmptyState } from '../components/F1Components';
import { formatNumber } from '../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
    if (!entityId) return;
    
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
    return '';
  };

  const getEntityId = (entity) => {
    if (entityType === 'driver') return entity.driverId;
    if (entityType === 'constructor') return entity.constructorId;
    if (entityType === 'circuit') return entity.circuitId;
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
            <Tabs value={entityType} onValueChange={(v) => { setEntityType(v); setEntityId(null); }}>
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
              </TabsList>
            </Tabs>
            
            {/* Entity Search */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  placeholder={`Search ${entityType}s...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-surface-200 border-white/10"
                />
              </div>
              <Select value={entityId?.toString() || ""} onValueChange={(v) => setEntityId(parseInt(v))}>
                <SelectTrigger className="w-64 bg-surface-200 border-white/10" data-testid="entity-select">
                  <SelectValue placeholder={`Select ${entityType}`} />
                </SelectTrigger>
                <SelectContent className="bg-surface-200 border-white/10 max-h-80">
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
            description="Choose a driver, team, or circuit to explore their story and statistics"
          />
        ) : loading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full bg-surface-300" />
            <Skeleton className="h-96 w-full bg-surface-300" />
          </div>
        ) : profile ? (
          <>
            {/* Profile Header */}
            {entityType === 'driver' && profile.driver && (
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
            )}

            {entityType === 'circuit' && profile.circuit && (
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
            )}

            {/* Content Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Career Timeline (Driver) */}
              {entityType === 'driver' && profile.timeline && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <ChartFrame title="Career Timeline" loading={false}>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={profile.timeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#252932" />
                          <XAxis 
                            dataKey="_id" 
                            tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          />
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

              {/* Best Seasons / Most Wins at Circuit */}
              {entityType === 'driver' && profile.best_seasons && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <ChartFrame title="Best Seasons" loading={false}>
                    <div className="space-y-2">
                      {profile.best_seasons.map((season, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-200 rounded">
                          <span className="font-mono text-white">{season._id}</span>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-racing-yellow" />
                            <span className="font-mono text-racing-yellow font-bold">{season.wins} wins</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartFrame>
                </motion.div>
              )}

              {entityType === 'circuit' && profile.most_wins && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <ChartFrame title="Most Wins" loading={false}>
                    <div className="space-y-2">
                      {profile.most_wins.map((driver, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-200 rounded">
                          <div className="flex items-center gap-3">
                            <PositionBadge position={i + 1} size="sm" />
                            <span className="text-white">{driver.forename} {driver.surname}</span>
                          </div>
                          <span className="font-mono text-racing-yellow font-bold">{driver.wins}</span>
                        </div>
                      ))}
                    </div>
                  </ChartFrame>
                </motion.div>
              )}

              {/* Signature Circuits (Driver) */}
              {entityType === 'driver' && profile.signature_circuits && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <ChartFrame title="Signature Circuits" loading={false}>
                    <div className="space-y-2">
                      {profile.signature_circuits.map((circuit, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-200 rounded">
                          <div>
                            <span className="text-white">{circuit.name}</span>
                            <span className="text-slate-500 text-sm ml-2">{circuit.country}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Flag className="w-4 h-4 text-racing-red" />
                            <span className="font-mono text-racing-red font-bold">{circuit.wins} wins</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartFrame>
                </motion.div>
              )}

              {/* Race History (Circuit) */}
              {entityType === 'circuit' && profile.race_history && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-2"
                >
                  <ChartFrame title="Race History" loading={false}>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {profile.race_history.slice(0, 20).map((race, i) => (
                        <Link 
                          key={i} 
                          to={`/race?raceId=${race.raceId}`}
                          className="flex items-center justify-between p-3 bg-surface-200 rounded hover:bg-surface-300 transition-colors"
                        >
                          <div>
                            <span className="font-mono text-racing-cyan mr-2">{race.year}</span>
                            <span className="text-white">{race.name}</span>
                          </div>
                          {race.winner && (
                            <span className="text-slate-400 text-sm">
                              Winner: {race.winner.forename} {race.winner.surname}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </ChartFrame>
                </motion.div>
              )}
            </div>

            {/* Facts Section */}
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
          </>
        ) : null}
      </div>
    </div>
  );
};

export default StoryExplorer;
