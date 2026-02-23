import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSeasons, getDrivers, getConstructors, getCircuits, getRaces } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { SlidersHorizontal, X, Search, RotateCcw } from 'lucide-react';

export const useFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const getParam = (key, defaultValue) => {
    const value = searchParams.get(key);
    if (value === null) return defaultValue;
    if (defaultValue === null) return value;
    if (typeof defaultValue === 'number') return parseInt(value) || defaultValue;
    if (typeof defaultValue === 'boolean') return value === 'true';
    return value;
  };
  
  const filters = {
    yearFrom: getParam('yearFrom', null),
    yearTo: getParam('yearTo', null),
    season: getParam('season', null),
    driverId: getParam('driverId', null),
    constructorId: getParam('constructorId', null),
    circuitId: getParam('circuitId', null),
    raceId: getParam('raceId', null),
  };
  
  const setFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === null || value === undefined || value === '') {
      newParams.delete(key);
    } else {
      newParams.set(key, value.toString());
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  const setFilters = useCallback((newFilters) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value.toString());
      }
    });
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  
  return { filters, setFilter, setFilters, clearFilters };
};

export const FilterBar = ({ showDriverFilter = true, showConstructorFilter = true, showYearRange = true }) => {
  const { filters, setFilter, clearFilters } = useFilters();
  const [seasons, setSeasons] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [constructorSearch, setConstructorSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    getSeasons().then(setSeasons).catch(console.error);
  }, []);
  
  useEffect(() => {
    const params = { limit: 50 };
    if (driverSearch) params.search = driverSearch;
    if (filters.season) params.season = filters.season;
    getDrivers(params).then(setDrivers).catch(console.error);
  }, [driverSearch, filters.season]);
  
  useEffect(() => {
    const params = { limit: 50 };
    if (constructorSearch) params.search = constructorSearch;
    if (filters.season) params.season = filters.season;
    getConstructors(params).then(setConstructors).catch(console.error);
  }, [constructorSearch, filters.season]);
  
  const hasActiveFilters = Object.values(filters).some(v => v !== null);
  
  const FilterContent = () => (
    <div className="space-y-6">
      {showYearRange && (
        <div className="space-y-3">
          <Label className="data-label">Year Range</Label>
          <div className="flex items-center gap-3">
            <Select 
              value={filters.yearFrom?.toString() || ""} 
              onValueChange={(v) => setFilter('yearFrom', v || null)}
            >
              <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-year-from">
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent className="bg-surface-200 border-white/10">
                <SelectItem value="">All</SelectItem>
                {seasons.map(s => (
                  <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-slate-500">to</span>
            <Select 
              value={filters.yearTo?.toString() || ""} 
              onValueChange={(v) => setFilter('yearTo', v || null)}
            >
              <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-year-to">
                <SelectValue placeholder="To" />
              </SelectTrigger>
              <SelectContent className="bg-surface-200 border-white/10">
                <SelectItem value="">All</SelectItem>
                {seasons.map(s => (
                  <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        <Label className="data-label">Season</Label>
        <Select 
          value={filters.season?.toString() || ""} 
          onValueChange={(v) => setFilter('season', v || null)}
        >
          <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-season">
            <SelectValue placeholder="All Seasons" />
          </SelectTrigger>
          <SelectContent className="bg-surface-200 border-white/10 max-h-60">
            <SelectItem value="">All Seasons</SelectItem>
            {seasons.map(s => (
              <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {showDriverFilter && (
        <div className="space-y-3">
          <Label className="data-label">Driver</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Search drivers..."
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              className="pl-10 bg-surface-200 border-white/10"
            />
          </div>
          <Select 
            value={filters.driverId?.toString() || ""} 
            onValueChange={(v) => setFilter('driverId', v || null)}
          >
            <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-driver">
              <SelectValue placeholder="Select Driver" />
            </SelectTrigger>
            <SelectContent className="bg-surface-200 border-white/10 max-h-60">
              <SelectItem value="">All Drivers</SelectItem>
              {drivers.map(d => (
                <SelectItem key={d.driverId} value={d.driverId.toString()}>
                  {d.code && <span className="font-mono text-racing-cyan mr-2">{d.code}</span>}
                  {d.forename} {d.surname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {showConstructorFilter && (
        <div className="space-y-3">
          <Label className="data-label">Constructor</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Search constructors..."
              value={constructorSearch}
              onChange={(e) => setConstructorSearch(e.target.value)}
              className="pl-10 bg-surface-200 border-white/10"
            />
          </div>
          <Select 
            value={filters.constructorId?.toString() || ""} 
            onValueChange={(v) => setFilter('constructorId', v || null)}
          >
            <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-constructor">
              <SelectValue placeholder="Select Constructor" />
            </SelectTrigger>
            <SelectContent className="bg-surface-200 border-white/10 max-h-60">
              <SelectItem value="">All Constructors</SelectItem>
              {constructors.map(c => (
                <SelectItem key={c.constructorId} value={c.constructorId.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {hasActiveFilters && (
        <Button 
          variant="ghost" 
          onClick={clearFilters}
          className="w-full text-slate-400 hover:text-white"
          data-testid="clear-filters"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
  
  return (
    <>
      {/* Desktop Filter Bar */}
      <div className="hidden lg:flex items-center gap-4 p-4 bg-surface-100 border-b border-white/10">
        <div className="flex items-center gap-2 text-slate-500">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm font-medium uppercase tracking-wide">Filters</span>
        </div>
        
        <Select 
          value={filters.season?.toString() || ""} 
          onValueChange={(v) => setFilter('season', v || null)}
        >
          <SelectTrigger className="w-32 bg-surface-200 border-white/10 h-9" data-testid="desktop-filter-season">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent className="bg-surface-200 border-white/10">
            <SelectItem value="">All Years</SelectItem>
            {seasons.map(s => (
              <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {showDriverFilter && (
          <Select 
            value={filters.driverId?.toString() || ""} 
            onValueChange={(v) => setFilter('driverId', v || null)}
          >
            <SelectTrigger className="w-48 bg-surface-200 border-white/10 h-9" data-testid="desktop-filter-driver">
              <SelectValue placeholder="Driver" />
            </SelectTrigger>
            <SelectContent className="bg-surface-200 border-white/10 max-h-60">
              <SelectItem value="">All Drivers</SelectItem>
              {drivers.map(d => (
                <SelectItem key={d.driverId} value={d.driverId.toString()}>
                  {d.forename} {d.surname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {showConstructorFilter && (
          <Select 
            value={filters.constructorId?.toString() || ""} 
            onValueChange={(v) => setFilter('constructorId', v || null)}
          >
            <SelectTrigger className="w-48 bg-surface-200 border-white/10 h-9" data-testid="desktop-filter-constructor">
              <SelectValue placeholder="Constructor" />
            </SelectTrigger>
            <SelectContent className="bg-surface-200 border-white/10 max-h-60">
              <SelectItem value="">All Constructors</SelectItem>
              {constructors.map(c => (
                <SelectItem key={c.constructorId} value={c.constructorId.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={clearFilters}
            className="text-slate-400 hover:text-white ml-auto"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      {/* Mobile Filter Sheet */}
      <div className="lg:hidden p-4 bg-surface-100 border-b border-white/10">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full border-white/20" data-testid="mobile-filter-trigger">
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 px-2 py-0.5 bg-racing-cyan text-black text-xs rounded">
                  Active
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-surface-100 border-t border-white/10 h-[80vh]">
            <div className="pt-4 pb-8 overflow-y-auto h-full">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default FilterBar;
