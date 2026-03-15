import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Trophy, Flag, Users, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import { getOverviewStats, getDriverStats, getConstructorStats } from '../lib/api';
import { useFilters, FilterBar } from '../components/FilterBar';
import { KPICard, ChartFrame, DataTable, PositionBadge, DriverTag } from '../components/F1Components';
import { formatNumber } from '../lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-surface-200/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-white font-mono text-sm">{entry.value}</span>
          <span className="text-slate-500 text-xs">{entry.name}</span>
        </div>
      ))}
    </div>
  );
};

const AnalyticsStudio = () => {
  const { filters } = useFilters();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [driverStats, setDriverStats] = useState([]);
  const [constructorStats, setConstructorStats] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Create a stable dependency string from filters
  const filterDeps = useMemo(() => {
    return JSON.stringify({
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      season: filters.season,
      driverId: filters.driverId,
      constructorId: filters.constructorId
    });
  }, [filters.yearFrom, filters.yearTo, filters.season, filters.driverId, filters.constructorId]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filters.yearFrom) params.year_from = filters.yearFrom;
        if (filters.yearTo) params.year_to = filters.yearTo;
        if (filters.season) {
          params.year_from = filters.season;
          params.year_to = filters.season;
        }
        if (filters.driverId) params.driver_id = filters.driverId;
        if (filters.constructorId) params.constructor_id = filters.constructorId;

    const [overviewData, driversData, constructorsData] = await Promise.all([
  getOverviewStats(params).catch(() => null),
  getDriverStats({ ...params, limit: 20 }).catch(() => []),
  getConstructorStats({ ...params, limit: 15 }).catch(() => [])
]);

if (overviewData) setStats(overviewData);
setDriverStats(Array.isArray(driversData) ? driversData : driversData?.data || []);
setConstructorStats(Array.isArray(constructorsData) ? constructorsData : constructorsData?.data || []);
        setStats(overviewData);
        setDriverStats(Array.isArray(driversData) ? driversData : driversData.data || driversData.drivers || []);
        setConstructorStats(constructorsData);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filterDeps]); // eslint-disable-line react-hooks/exhaustive-deps

  const driverColumns = [
    { 
      key: 'position', 
      label: '#', 
      width: '60px',
      render: (_, __, index) => <PositionBadge position={index + 1} size="sm" />
    },
    { 
      key: 'driver', 
      label: 'Driver',
      render: (_, row) => <DriverTag driver={row} />
    },
    { key: 'wins', label: 'Wins', mono: true },
    { key: 'podiums', label: 'Podiums', mono: true },
    { key: 'poles', label: 'Poles', mono: true },
    { 
      key: 'total_points', 
      label: 'Points', 
      mono: true,
      render: (val) => formatNumber(val)
    },
    { key: 'races', label: 'Races', mono: true },
    { 
      key: 'championships', 
      label: 'WDC', 
      mono: true,
      render: (val) => val > 0 ? (
        <span className="text-racing-yellow font-bold">{val}</span>
      ) : '-'
    },
  ];

  const constructorColumns = [
    { 
      key: 'position', 
      label: '#', 
      width: '60px',
      render: (_, __, index) => <PositionBadge position={index + 1} size="sm" />
    },
    { 
      key: 'name', 
      label: 'Constructor',
      render: (val) => <span className="text-white font-medium">{val}</span>
    },
    { key: 'wins', label: 'Wins', mono: true },
    { key: 'podiums', label: 'Podiums', mono: true },
    { key: 'poles', label: 'Poles', mono: true },
    { 
      key: 'total_points', 
      label: 'Points', 
      mono: true,
      render: (val) => formatNumber(val)
    },
    { 
      key: 'championships', 
      label: 'WCC', 
      mono: true,
      render: (val) => val > 0 ? (
        <span className="text-racing-yellow font-bold">{val}</span>
      ) : '-'
    },
  ];

  // Prepare chart data
  const topDriversChartData = useMemo(() => {
    return driverStats.slice(0, 10).map(d => ({
      name: d.code || d.surname.substring(0, 3).toUpperCase(),
      wins: d.wins,
      podiums: d.podiums,
      poles: d.poles
    }));
  }, [driverStats]);

  return (
    <div className="min-h-screen bg-void" data-testid="analytics-studio">
      <FilterBar />
      
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-6 h-6 text-racing-cyan" />
            <h1 className="font-heading text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">
              Analytics Studio
            </h1>
          </div>
          <p className="text-slate-400">
            Explore F1 statistics across {stats?.total_drivers || '...'} drivers, {stats?.total_constructors || '...'} constructors, and {formatNumber(stats?.total_races) || '...'} race results
          </p>
        </motion.div>

        {/* KPI Row */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <KPICard 
            label="Race Entries" 
            value={formatNumber(stats?.total_races)} 
            icon={Flag}
            loading={loading}
            accentColor="cyan"
          />
          <KPICard 
            label="Total Wins" 
            value={formatNumber(stats?.total_wins)} 
            icon={Trophy}
            loading={loading}
            accentColor="yellow"
          />
          <KPICard 
            label="Podiums" 
            value={formatNumber(stats?.total_podiums)} 
            icon={TrendingUp}
            loading={loading}
            accentColor="purple"
          />
          <KPICard 
            label="DNF Rate" 
            value={`${stats?.dnf_rate || 0}%`} 
            icon={Zap}
            loading={loading}
            accentColor="red"
          />
        </motion.div>

        {/* Tabs */}
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
              value="drivers"
              className="data-[state=active]:bg-white data-[state=active]:text-black"
              data-testid="tab-drivers"
            >
              Drivers
            </TabsTrigger>
            <TabsTrigger 
              value="constructors"
              className="data-[state=active]:bg-white data-[state=active]:text-black"
              data-testid="tab-constructors"
            >
              Constructors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Top Drivers Chart */}
            <ChartFrame title="Top Drivers Performance" loading={loading}>
              <div className="h-80">
                {topDriversChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDriversChartData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#252932" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                        axisLine={{ stroke: '#252932' }}
                      />
                      <YAxis 
                        tick={{ fill: '#94A3B8', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                        axisLine={{ stroke: '#252932' }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
                      />
                      <Bar dataKey="wins" name="Wins" fill="#FF1E1E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="podiums" name="Podiums" fill="#00F0FF" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="poles" name="Poles" fill="#C084FC" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartFrame>

            {/* Quick Links */}
            <div className="grid md:grid-cols-3 gap-4">
              <Link to="/race" className="group">
                <div className="bg-surface-100 border border-white/10 rounded-lg p-6 hover:border-racing-cyan/50 transition-colors">
                  <Flag className="w-8 h-8 text-racing-cyan mb-3" />
                  <h3 className="font-heading text-xl font-semibold text-white mb-2">Race Deep Dive</h3>
                  <p className="text-slate-500 text-sm mb-4">Explore lap-by-lap race analysis and pit strategies</p>
                  <span className="text-racing-cyan text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Explore <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
              <Link to="/rivalry" className="group">
                <div className="bg-surface-100 border border-white/10 rounded-lg p-6 hover:border-racing-red/50 transition-colors">
                  <Users className="w-8 h-8 text-racing-red mb-3" />
                  <h3 className="font-heading text-xl font-semibold text-white mb-2">Rivalry Explorer</h3>
                  <p className="text-slate-500 text-sm mb-4">Head-to-head driver comparisons and battle stats</p>
                  <span className="text-racing-red text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Compare <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
              <Link to="/goat" className="group">
                <div className="bg-surface-100 border border-white/10 rounded-lg p-6 hover:border-racing-yellow/50 transition-colors">
                  <Trophy className="w-8 h-8 text-racing-yellow mb-3" />
                  <h3 className="font-heading text-xl font-semibold text-white mb-2">GOAT Engine</h3>
                  <p className="text-slate-500 text-sm mb-4">Build your own GOAT ranking with custom weights</p>
                  <span className="text-racing-yellow text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Configure <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="drivers">
            <ChartFrame title="Driver Statistics" loading={loading}>
              <DataTable 
                columns={driverColumns}
                data={driverStats}
                loading={loading}
                emptyMessage="No driver data available for selected filters"
              />
            </ChartFrame>
          </TabsContent>

          <TabsContent value="constructors">
            <ChartFrame title="Constructor Statistics" loading={loading}>
              <DataTable 
                columns={constructorColumns}
                data={constructorStats}
                loading={loading}
                emptyMessage="No constructor data available for selected filters"
              />
            </ChartFrame>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalyticsStudio;
