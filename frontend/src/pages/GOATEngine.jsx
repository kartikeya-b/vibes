import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, SlidersHorizontal, Info, ChevronRight, RotateCcw, Play } from 'lucide-react';
import { getGoatLeaderboard } from '../lib/api';
import { ChartFrame, DataTable, PositionBadge, DriverTag } from '../components/F1Components';
import { formatNumber } from '../lib/utils';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const PRESETS = {
  balanced: { wins: 25, podiums: 15, poles: 10, points: 15, avg_finish: 10, positions_gained: 5, championships: 20 },
  pure_speed: { wins: 35, podiums: 10, poles: 25, points: 5, avg_finish: 5, positions_gained: 0, championships: 20 },
  consistency: { wins: 15, podiums: 25, poles: 5, points: 25, avg_finish: 20, positions_gained: 5, championships: 5 },
  racecraft: { wins: 20, podiums: 15, poles: 5, points: 10, avg_finish: 15, positions_gained: 25, championships: 10 },
};

const WEIGHT_LABELS = {
  wins: 'Wins',
  podiums: 'Podiums',
  poles: 'Pole Positions',
  points: 'Career Points',
  avg_finish: 'Avg Finish Position',
  positions_gained: 'Positions Gained',
  championships: 'Championships'
};

const WEIGHT_COLORS = {
  wins: '#FF1E1E',
  podiums: '#00F0FF',
  poles: '#C084FC',
  points: '#FFF200',
  avg_finish: '#10B981',
  positions_gained: '#FF8700',
  championships: '#3B82F6'
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-surface-200/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-white font-semibold mb-2">{data.name}</p>
      <p className="text-slate-400 text-sm">Contribution: <span className="font-mono text-white">{data.value.toFixed(1)}</span></p>
    </div>
  );
};

const GOATEngine = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Applied weights (what's currently shown in leaderboard)
  const [appliedWeights, setAppliedWeights] = useState(() => {
    const preset = searchParams.get('preset');
    if (preset && PRESETS[preset]) return PRESETS[preset];
    return PRESETS.balanced;
  });
  const [appliedMinRaces, setAppliedMinRaces] = useState(parseInt(searchParams.get('minRaces')) || 50);
  const [appliedNormalize, setAppliedNormalize] = useState(searchParams.get('normalize') === 'true');
  
  // Pending weights (what user is configuring)
  const [pendingWeights, setPendingWeights] = useState(appliedWeights);
  const [pendingMinRaces, setPendingMinRaces] = useState(appliedMinRaces);
  const [pendingNormalize, setPendingNormalize] = useState(appliedNormalize);
  
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);

  // Check if pending settings differ from applied settings
  const hasUnappliedChanges = useMemo(() => {
    const weightsChanged = JSON.stringify(pendingWeights) !== JSON.stringify(appliedWeights);
    const minRacesChanged = pendingMinRaces !== appliedMinRaces;
    const normalizeChanged = pendingNormalize !== appliedNormalize;
    return weightsChanged || minRacesChanged || normalizeChanged;
  }, [pendingWeights, appliedWeights, pendingMinRaces, appliedMinRaces, pendingNormalize, appliedNormalize]);

  // Convert weights to query string
  const weightsString = useMemo(() => {
    return Object.entries(appliedWeights).map(([k, v]) => `${k}:${v}`).join(',');
  }, [appliedWeights]);

  // Fetch leaderboard when applied settings change
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const data = await getGoatLeaderboard({
          weights: weightsString,
          min_races: appliedMinRaces,
          normalize_per_race: appliedNormalize,
          limit: 100
        });
        setLeaderboard(data);
        
        // Update URL
        setSearchParams({
          weights: weightsString,
          minRaces: appliedMinRaces.toString(),
          normalize: appliedNormalize.toString()
        }, { replace: true });
      } catch (err) {
        console.error('Failed to fetch GOAT leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, [weightsString, appliedMinRaces, appliedNormalize, setSearchParams]);

  // Apply pending changes
  const handleApplyChanges = useCallback(() => {
    setAppliedWeights(pendingWeights);
    setAppliedMinRaces(pendingMinRaces);
    setAppliedNormalize(pendingNormalize);
  }, [pendingWeights, pendingMinRaces, pendingNormalize]);

  const updateWeight = (key, value) => {
    setPendingWeights(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetKey) => {
    setPendingWeights(PRESETS[presetKey]);
  };

  const resetWeights = () => {
    setPendingWeights(PRESETS.balanced);
    setPendingMinRaces(50);
    setPendingNormalize(false);
  };

  const totalWeight = Object.values(pendingWeights).reduce((a, b) => a + b, 0);

  const columns = [
    { 
      key: 'rank', 
      label: '#', 
      width: '60px',
      render: (_, __, index) => <PositionBadge position={index + 1} size="sm" />
    },
    { 
      key: 'driver', 
      label: 'Driver',
      render: (_, row) => (
        <button 
          onClick={() => setSelectedDriver(row)}
          className="text-left hover:text-racing-cyan transition-colors"
        >
          <DriverTag driver={row} />
        </button>
      )
    },
    { 
      key: 'score', 
      label: 'GOAT Score', 
      render: (val) => (
        <span className="font-mono text-lg font-bold text-racing-yellow">{val.toFixed(1)}</span>
      )
    },
    { key: 'wins', label: 'Wins', mono: true, render: (_, row) => row.stats.wins },
    { key: 'podiums', label: 'Podiums', mono: true, render: (_, row) => row.stats.podiums },
    { key: 'poles', label: 'Poles', mono: true, render: (_, row) => row.stats.poles },
    { 
      key: 'championships', 
      label: 'WDC', 
      render: (_, row) => row.stats.championships > 0 ? (
        <span className="text-racing-yellow font-bold font-mono">{row.stats.championships}</span>
      ) : '-'
    },
    { 
      key: 'races', 
      label: 'Races', 
      mono: true,
      render: (_, row) => row.stats.races
    },
  ];

  // Prepare breakdown chart data for selected driver
  const breakdownData = selectedDriver ? Object.entries(selectedDriver.breakdown).map(([key, value]) => ({
    name: WEIGHT_LABELS[key],
    value,
    color: WEIGHT_COLORS[key]
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value) : [];

  return (
    <div className="min-h-screen bg-void" data-testid="goat-engine">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-racing-yellow" />
            <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">
              GOAT Engine
            </h1>
          </div>
          <p className="text-slate-400">
            Build your own Greatest of All Time ranking with customizable weights
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-surface-100 border border-white/10 rounded-lg p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-lg font-semibold uppercase text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-racing-cyan" />
                  Weight Configuration
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={resetWeights}
                  className="text-slate-400 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Presets */}
              <div className="mb-6">
                <span className="data-label block mb-3">Presets</span>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(PRESETS).map(preset => (
                    <Badge
                      key={preset}
                      variant="outline"
                      className="cursor-pointer hover:bg-white/10 capitalize"
                      onClick={() => applyPreset(preset)}
                      data-testid={`preset-${preset}`}
                    >
                      {preset.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Weight Sliders */}
              <div className="space-y-5">
                {Object.entries(pendingWeights).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-slate-300">{WEIGHT_LABELS[key]}</Label>
                      <span className="font-mono text-sm" style={{ color: WEIGHT_COLORS[key] }}>{value}</span>
                    </div>
                    <Slider
                      value={[value]}
                      onValueChange={([v]) => updateWeight(key, v)}
                      max={50}
                      step={5}
                      className="[&_[role=slider]]:bg-white"
                      data-testid={`slider-${key}`}
                    />
                  </div>
                ))}
              </div>

              {/* Total Weight */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">Total Weight</span>
                  <span className={`font-mono font-bold ${totalWeight === 100 ? 'text-emerald-400' : 'text-racing-yellow'}`}>
                    {totalWeight}%
                  </span>
                </div>
              </div>

              {/* Options */}
              <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
                <div>
                  <Label className="text-sm text-slate-300 mb-2 block">Minimum Races</Label>
                  <Input
                    type="number"
                    value={pendingMinRaces}
                    onChange={(e) => setPendingMinRaces(parseInt(e.target.value) || 0)}
                    min={0}
                    max={500}
                    className="bg-surface-200 border-white/10"
                    data-testid="min-races-input"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <Switch 
                    id="normalize" 
                    checked={pendingNormalize} 
                    onCheckedChange={setPendingNormalize}
                    data-testid="normalize-toggle"
                  />
                  <Label htmlFor="normalize" className="text-sm text-slate-400">
                    Normalize per race
                  </Label>
                </div>
              </div>

              {/* GO Button */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <Button 
                  onClick={handleApplyChanges}
                  disabled={!hasUnappliedChanges}
                  className={`w-full ${hasUnappliedChanges 
                    ? 'bg-racing-cyan text-black hover:bg-racing-cyan/80' 
                    : 'bg-surface-300 text-slate-500'}`}
                  data-testid="calculate-goat"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {hasUnappliedChanges ? 'Calculate Rankings' : 'Rankings Up to Date'}
                </Button>
                {hasUnappliedChanges && (
                  <p className="text-xs text-racing-yellow text-center mt-2">
                    Click to apply your weight changes
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <ChartFrame 
              title="GOAT Leaderboard" 
              loading={loading}
              actions={
                <span className="text-sm text-slate-500">
                  {leaderboard.length} drivers
                </span>
              }
            >
              <DataTable 
                columns={columns}
                data={leaderboard}
                loading={loading}
                emptyMessage="No drivers match the current criteria"
              />
            </ChartFrame>
          </motion.div>
        </div>

        {/* Driver Breakdown Sheet */}
        <Sheet open={!!selectedDriver} onOpenChange={(open) => !open && setSelectedDriver(null)}>
          <SheetContent className="bg-surface-100 border-l border-white/10 w-full sm:max-w-lg">
            {selectedDriver && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-white font-heading uppercase">
                    Why #{leaderboard.findIndex(d => d.driverId === selectedDriver.driverId) + 1}?
                  </SheetTitle>
                </SheetHeader>
                
                <div className="mt-6">
                  <div className="mb-6">
                    <h3 className="font-heading text-2xl font-bold text-white">
                      {selectedDriver.forename} {selectedDriver.surname}
                    </h3>
                    <span className="text-slate-500">{selectedDriver.nationality}</span>
                  </div>

                  <div className="bg-surface-200 rounded-lg p-4 mb-6">
                    <span className="data-label block mb-2">GOAT Score</span>
                    <span className="text-4xl font-mono font-bold text-racing-yellow">
                      {selectedDriver.score.toFixed(1)}
                    </span>
                  </div>

                  {/* Score Breakdown Chart */}
                  <div className="h-64 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdownData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#252932" />
                        <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          tick={{ fill: '#94A3B8', fontSize: 11 }}
                          width={100}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {breakdownData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Raw Stats */}
                  <div>
                    <span className="data-label block mb-3">Career Statistics</span>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedDriver.stats).map(([key, value]) => (
                        <div key={key} className="bg-surface-200 rounded p-3">
                          <span className="text-xs text-slate-500 uppercase">{key.replace('_', ' ')}</span>
                          <span className="block font-mono text-lg text-white">
                            {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value ?? '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link 
                    to={`/story?type=driver&id=${selectedDriver.driverId}`}
                    className="mt-6 w-full bg-white text-black hover:bg-slate-200 font-bold uppercase tracking-wide rounded-sm px-6 py-3 flex items-center justify-center gap-2"
                  >
                    View Full Profile <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default GOATEngine;
