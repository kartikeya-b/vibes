import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Trophy, Flag, Target, AlertCircle, Map, Search, X } from 'lucide-react';
import { getDrivers, getHeadToHead } from '../lib/api';
import { ChartFrame, EmptyState } from '../components/F1Components';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';

// Searchable Driver Select with proper UX
const DriverSelect = ({ value, onValueChange, drivers, otherDriverId, accentColor, placeholder, testId }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredDrivers = useMemo(() => {
    if (!searchQuery) return drivers.slice(0, 100);
    const query = searchQuery.toLowerCase();
    return drivers.filter(d => {
      const fullName = `${d.forename} ${d.surname}`.toLowerCase();
      const code = d.code?.toLowerCase() || '';
      return fullName.includes(query) || code.includes(query);
    }).slice(0, 100);
  }, [drivers, searchQuery]);
  
  const selectedDriver = drivers.find(d => d.driverId === value);
  
  const getDisplayText = (driver) => {
    if (!driver) return placeholder;
    return `${driver.code ? driver.code + ' - ' : ''}${driver.forename} ${driver.surname}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between bg-surface-200 border-white/10 h-12 text-left font-normal ${accentColor === 'cyan' ? 'border-l-4 border-l-racing-cyan' : 'border-r-4 border-r-racing-red'}`}
          data-testid={testId}
        >
          <span className={selectedDriver ? 'text-white' : 'text-slate-400'}>
            {selectedDriver ? getDisplayText(selectedDriver) : placeholder}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-surface-200 border-white/10" align="start">
        <Command className="bg-transparent">
          <CommandInput 
            placeholder="Type to search drivers..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="bg-transparent border-white/10"
          />
          <CommandList className="max-h-72">
            <CommandEmpty>No drivers found.</CommandEmpty>
            <CommandGroup>
              {filteredDrivers.map((driver) => {
                const isDisabled = driver.driverId === otherDriverId;
                return (
                  <CommandItem
                    key={driver.driverId}
                    value={`${driver.forename} ${driver.surname} ${driver.code || ''}`}
                    onSelect={() => {
                      if (!isDisabled) {
                        onValueChange(driver.driverId);
                        setOpen(false);
                        setSearchQuery('');
                      }
                    }}
                    disabled={isDisabled}
                    className={`cursor-pointer ${isDisabled ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {driver.code && (
                        <span className={`font-mono text-sm ${accentColor === 'cyan' ? 'text-racing-cyan' : 'text-racing-red'}`}>
                          {driver.code}
                        </span>
                      )}
                      <span>{driver.forename} {driver.surname}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const RivalryExplorer = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [drivers, setDrivers] = useState([]);
  const [driver1Id, setDriver1Id] = useState(searchParams.get('d1') ? parseInt(searchParams.get('d1')) : null);
  const [driver2Id, setDriver2Id] = useState(searchParams.get('d2') ? parseInt(searchParams.get('d2')) : null);
  const [sameTeamOnly, setSameTeamOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [h2hData, setH2hData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all drivers once
  useEffect(() => {
    getDrivers({ limit: 1000 }).then(setDrivers).catch(console.error);
  }, []);

  // Fetch H2H data
  useEffect(() => {
    if (!driver1Id || !driver2Id) {
      setH2hData(null);
      return;
    }
    
    const fetchH2H = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getHeadToHead(driver1Id, driver2Id, { same_team_only: sameTeamOnly });
        setH2hData(data);
        
        // Update URL
        setSearchParams({ d1: driver1Id.toString(), d2: driver2Id.toString() }, { replace: true });
      } catch (err) {
        console.error('Failed to fetch H2H:', err);
        setError('Failed to load comparison data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchH2H();
  }, [driver1Id, driver2Id, sameTeamOnly, setSearchParams]);

  const getH2HBarWidth = (key, driverRef) => {
    if (!h2hData) return '50%';
    const d1Val = h2hData[key][h2hData.driver1.driverRef] || 0;
    const d2Val = h2hData[key][h2hData.driver2.driverRef] || 0;
    const total = d1Val + d2Val;
    if (total === 0) return '50%';
    const val = h2hData[key][driverRef] || 0;
    return `${(val / total) * 100}%`;
  };

  const StatRow = ({ label, statKey, icon: Icon }) => {
    if (!h2hData) return null;
    const d1Val = h2hData[statKey][h2hData.driver1.driverRef] || 0;
    const d2Val = h2hData[statKey][h2hData.driver2.driverRef] || 0;
    const d1Wins = d1Val > d2Val;
    const d2Wins = d2Val > d1Val;
    
    return (
      <div className="py-4 border-b border-white/5 last:border-0">
        <div className="flex items-center justify-between mb-3">
          <span className={`font-mono text-2xl font-bold ${d1Wins ? 'text-racing-cyan' : 'text-white'}`}>
            {typeof d1Val === 'number' && d1Val % 1 !== 0 ? d1Val.toFixed(1) : d1Val}
          </span>
          <div className="flex items-center gap-2 text-slate-500">
            {Icon && <Icon className="w-4 h-4" />}
            <span className="text-sm uppercase tracking-wide">{label}</span>
          </div>
          <span className={`font-mono text-2xl font-bold ${d2Wins ? 'text-racing-red' : 'text-white'}`}>
            {typeof d2Val === 'number' && d2Val % 1 !== 0 ? d2Val.toFixed(1) : d2Val}
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-surface-300">
          <div 
            className="bg-racing-cyan transition-all duration-500"
            style={{ width: getH2HBarWidth(statKey, h2hData.driver1.driverRef) }}
          />
          <div 
            className="bg-racing-red transition-all duration-500"
            style={{ width: getH2HBarWidth(statKey, h2hData.driver2.driverRef) }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-void" data-testid="rivalry-explorer">
      {/* Driver Selection */}
      <div className="bg-surface-100 border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-slate-500 mb-4">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wide">Select Drivers to Compare</span>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {/* Driver 1 */}
            <div className="flex-1">
              <Label className="data-label mb-2 block">Driver 1</Label>
              <DriverSelect
                value={driver1Id}
                onValueChange={setDriver1Id}
                drivers={drivers}
                otherDriverId={driver2Id}
                accentColor="cyan"
                placeholder="Select First Driver"
                testId="driver1-select"
              />
            </div>
            
            <div className="hidden md:flex items-center justify-center w-12">
              <span className="text-2xl text-slate-600">VS</span>
            </div>
            
            {/* Driver 2 */}
            <div className="flex-1">
              <Label className="data-label mb-2 block">Driver 2</Label>
              <DriverSelect
                value={driver2Id}
                onValueChange={setDriver2Id}
                drivers={drivers}
                otherDriverId={driver1Id}
                accentColor="red"
                placeholder="Select Second Driver"
                testId="driver2-select"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Switch 
                id="same-team" 
                checked={sameTeamOnly} 
                onCheckedChange={setSameTeamOnly}
                data-testid="same-team-toggle"
              />
              <Label htmlFor="same-team" className="text-sm text-slate-400">
                Teammate battles only (same constructor)
              </Label>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {!driver1Id || !driver2Id ? (
          <EmptyState 
            icon={Users}
            title="Select Two Drivers"
            description="Choose two drivers from the dropdowns above to see their head-to-head statistics"
          />
        ) : loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full bg-surface-300" />
            <Skeleton className="h-64 w-full bg-surface-300" />
          </div>
        ) : error ? (
          <div className="bg-surface-100 border border-red-500/30 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : h2hData ? (
          <>
            {/* Header Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-100 border border-white/10 rounded-lg overflow-hidden mb-8"
            >
              <div className="grid md:grid-cols-3">
                {/* Driver 1 */}
                <div className="p-6 bg-gradient-to-r from-racing-cyan/10 to-transparent border-b md:border-b-0 md:border-r border-white/10">
                  <span className="data-label">Driver 1</span>
                  <h2 className="font-heading text-2xl md:text-3xl font-bold uppercase text-white mt-2">
                    {h2hData.driver1.forename}
                    <br />
                    <span className="text-racing-cyan">{h2hData.driver1.surname}</span>
                  </h2>
                  <span className="text-slate-500 text-sm">{h2hData.driver1.nationality}</span>
                </div>
                
                {/* VS Center */}
                <div className="p-6 flex flex-col items-center justify-center bg-surface-200">
                  <span className="text-4xl font-heading font-black text-slate-600">VS</span>
                  <span className="text-slate-500 text-sm mt-2">
                    {h2hData.common_races} common races
                  </span>
                  {sameTeamOnly && (
                    <span className="text-xs text-racing-purple mt-1">
                      (Same team only)
                    </span>
                  )}
                </div>
                
                {/* Driver 2 */}
                <div className="p-6 bg-gradient-to-l from-racing-red/10 to-transparent text-right">
                  <span className="data-label">Driver 2</span>
                  <h2 className="font-heading text-2xl md:text-3xl font-bold uppercase text-white mt-2">
                    {h2hData.driver2.forename}
                    <br />
                    <span className="text-racing-red">{h2hData.driver2.surname}</span>
                  </h2>
                  <span className="text-slate-500 text-sm">{h2hData.driver2.nationality}</span>
                </div>
              </div>
            </motion.div>

            {/* Tabs for Overview and Circuit Breakdown */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-surface-100 border border-white/10 p-1">
                <TabsTrigger 
                  value="overview" 
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  data-testid="tab-overview"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="circuits"
                  className="data-[state=active]:bg-white data-[state=active]:text-black"
                  data-testid="tab-circuits"
                >
                  <Map className="w-4 h-4 mr-2" />
                  Circuit Breakdown
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Stats Comparison */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <ChartFrame title="Head-to-Head Statistics" loading={false}>
                    <div className="divide-y divide-white/5">
                      <StatRow label="Qualifying" statKey="quali_h2h" icon={Target} />
                      <StatRow label="Race Finish" statKey="race_h2h" icon={Flag} />
                      <StatRow label="Points" statKey="points_h2h" icon={Trophy} />
                      <StatRow label="Wins" statKey="wins_h2h" icon={Trophy} />
                      <StatRow label="Podiums" statKey="podiums_h2h" icon={Trophy} />
                    </div>
                  </ChartFrame>
                </motion.div>

                {/* Summary Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid md:grid-cols-2 gap-6"
                >
                  <div className="bg-surface-100 border border-white/10 rounded-lg p-6">
                    <h3 className="font-heading text-lg font-semibold uppercase text-white mb-4 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-racing-cyan" />
                      {h2hData.driver1.forename} {h2hData.driver1.surname}
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="data-label block mb-1">Quali Wins</span>
                        <span className="text-2xl font-mono font-bold text-white">
                          {h2hData.quali_h2h[h2hData.driver1.driverRef]}
                        </span>
                      </div>
                      <div>
                        <span className="data-label block mb-1">Race Wins</span>
                        <span className="text-2xl font-mono font-bold text-white">
                          {h2hData.race_h2h[h2hData.driver1.driverRef]}
                        </span>
                      </div>
                      <div>
                        <span className="data-label block mb-1">Points</span>
                        <span className="text-2xl font-mono font-bold text-racing-yellow">
                          {h2hData.points_h2h[h2hData.driver1.driverRef]?.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-surface-100 border border-white/10 rounded-lg p-6">
                    <h3 className="font-heading text-lg font-semibold uppercase text-white mb-4 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-racing-red" />
                      {h2hData.driver2.forename} {h2hData.driver2.surname}
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="data-label block mb-1">Quali Wins</span>
                        <span className="text-2xl font-mono font-bold text-white">
                          {h2hData.quali_h2h[h2hData.driver2.driverRef]}
                        </span>
                      </div>
                      <div>
                        <span className="data-label block mb-1">Race Wins</span>
                        <span className="text-2xl font-mono font-bold text-white">
                          {h2hData.race_h2h[h2hData.driver2.driverRef]}
                        </span>
                      </div>
                      <div>
                        <span className="data-label block mb-1">Points</span>
                        <span className="text-2xl font-mono font-bold text-racing-yellow">
                          {h2hData.points_h2h[h2hData.driver2.driverRef]?.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="circuits" className="space-y-6">
                {/* Circuit Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ChartFrame 
                    title="Circuit-by-Circuit Breakdown" 
                    loading={false}
                    actions={
                      <span className="text-sm text-slate-500">
                        {h2hData.circuit_breakdown?.length || 0} circuits
                      </span>
                    }
                  >
                    {h2hData.circuit_breakdown && h2hData.circuit_breakdown.length > 0 ? (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {h2hData.circuit_breakdown.map((circuit, i) => {
                          const d1QualiWin = circuit.d1_quali_wins > circuit.d2_quali_wins;
                          const d2QualiWin = circuit.d2_quali_wins > circuit.d1_quali_wins;
                          const d1RaceWin = circuit.d1_race_wins > circuit.d2_race_wins;
                          const d2RaceWin = circuit.d2_race_wins > circuit.d1_race_wins;
                          
                          return (
                            <Link 
                              key={i} 
                              to={`/story?type=circuit&id=${circuit.circuitId}`}
                              className="block bg-surface-200 rounded-lg p-4 hover:bg-surface-300 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <span className="text-white font-semibold">{circuit.name}</span>
                                  <span className="text-slate-500 text-sm ml-2">{circuit.country}</span>
                                </div>
                                <span className="text-slate-500 text-sm">{circuit.races} races</span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 text-center">
                                {/* Qualifying H2H */}
                                <div>
                                  <span className="data-label block mb-1">Qualifying</span>
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={`font-mono font-bold ${d1QualiWin ? 'text-racing-cyan' : 'text-white'}`}>
                                      {circuit.d1_quali_wins}
                                    </span>
                                    <span className="text-slate-600">-</span>
                                    <span className={`font-mono font-bold ${d2QualiWin ? 'text-racing-red' : 'text-white'}`}>
                                      {circuit.d2_quali_wins}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Race H2H */}
                                <div>
                                  <span className="data-label block mb-1">Race</span>
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={`font-mono font-bold ${d1RaceWin ? 'text-racing-cyan' : 'text-white'}`}>
                                      {circuit.d1_race_wins}
                                    </span>
                                    <span className="text-slate-600">-</span>
                                    <span className={`font-mono font-bold ${d2RaceWin ? 'text-racing-red' : 'text-white'}`}>
                                      {circuit.d2_race_wins}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Race Wins */}
                                <div>
                                  <span className="data-label block mb-1">Victories</span>
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={`font-mono font-bold ${circuit.d1_wins > 0 ? 'text-racing-yellow' : 'text-slate-600'}`}>
                                      {circuit.d1_wins}
                                    </span>
                                    <span className="text-slate-600">-</span>
                                    <span className={`font-mono font-bold ${circuit.d2_wins > 0 ? 'text-racing-yellow' : 'text-slate-600'}`}>
                                      {circuit.d2_wins}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Mini progress bar */}
                              <div className="mt-3 flex h-1 rounded-full overflow-hidden bg-surface-300">
                                <div 
                                  className="bg-racing-cyan transition-all duration-300"
                                  style={{ width: `${circuit.races > 0 ? (circuit.d1_race_wins / circuit.races) * 100 : 50}%` }}
                                />
                                <div 
                                  className="bg-racing-red transition-all duration-300"
                                  style={{ width: `${circuit.races > 0 ? (circuit.d2_race_wins / circuit.races) * 100 : 50}%` }}
                                />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No circuit data available
                      </div>
                    )}
                  </ChartFrame>
                </motion.div>
              </TabsContent>
            </Tabs>

            {/* Share Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-center"
            >
              <Button 
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="bg-white text-black hover:bg-slate-200"
                data-testid="share-rivalry"
              >
                Copy Share Link
              </Button>
            </motion.div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default RivalryExplorer;
