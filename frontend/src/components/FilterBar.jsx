import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSeasons, getDrivers, getConstructors } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { Label } from '../components/ui/label';
import { SlidersHorizontal, X, Search, RotateCcw, Play } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';

export const useFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Memoize the filters object to prevent unnecessary re-renders
  const filters = useMemo(() => {
    const getParam = (key) => {
      const value = searchParams.get(key);
      return value || null;
    };
    
    return {
      yearFrom: getParam('yearFrom'),
      yearTo: getParam('yearTo'),
      season: getParam('season'),
      driverId: getParam('driverId'),
      constructorId: getParam('constructorId'),
      circuitId: getParam('circuitId'),
      raceId: getParam('raceId'),
    };
  }, [searchParams]);
  
  const setFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === null || value === undefined || value === '' || value === 'all') {
        newParams.delete(key);
      } else {
        newParams.set(key, value.toString());
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);
  
  const setFilters = useCallback((newFilters) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '' || value === 'all') {
          newParams.delete(key);
        } else {
          newParams.set(key, value.toString());
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);
  
  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);
  
  return { filters, setFilter, setFilters, clearFilters };
};

// Searchable Select Component with proper dropdown behavior
const SearchableSelect = ({ 
  value, 
  onValueChange, 
  placeholder, 
  items, 
  displayKey, 
  valueKey,
  searchPlaceholder,
  testId 
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items.slice(0, 100);
    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      const display = typeof displayKey === 'function' ? displayKey(item) : item[displayKey];
      return display?.toLowerCase().includes(query);
    }).slice(0, 100);
  }, [items, searchQuery, displayKey]);
  
  const selectedItem = items.find(item => {
    const itemValue = typeof valueKey === 'function' ? valueKey(item) : item[valueKey];
    return itemValue?.toString() === value;
  });
  
  const getDisplayText = (item) => {
    if (!item) return placeholder;
    return typeof displayKey === 'function' ? displayKey(item) : item[displayKey];
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-surface-200 border-white/10 h-9 text-left font-normal"
          data-testid={testId}
        >
          <span className={selectedItem ? 'text-white' : 'text-slate-400'}>
            {selectedItem ? getDisplayText(selectedItem) : placeholder}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-surface-200 border-white/10" align="start">
        <Command className="bg-transparent">
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="bg-transparent border-white/10"
          />
          <CommandList className="max-h-60">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onValueChange('all');
                  setOpen(false);
                  setSearchQuery('');
                }}
                className="cursor-pointer"
              >
                All
              </CommandItem>
              {filteredItems.map((item, index) => {
                const itemValue = typeof valueKey === 'function' ? valueKey(item) : item[valueKey];
                return (
                  <CommandItem
                    key={itemValue || index}
                    value={getDisplayText(item)}
                    onSelect={() => {
                      onValueChange(itemValue?.toString());
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="cursor-pointer"
                  >
                    {getDisplayText(item)}
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

export const FilterBar = ({ showDriverFilter = true, showConstructorFilter = true, showYearRange = true }) => {
  const { filters, setFilters, clearFilters } = useFilters();
  const [seasons, setSeasons] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Pending filter state (before clicking GO)
  const [pendingFilters, setPendingFilters] = useState({
    season: filters.season || 'all',
    driverId: filters.driverId || 'all',
    constructorId: filters.constructorId || 'all',
    yearFrom: filters.yearFrom || 'all',
    yearTo: filters.yearTo || 'all'
  });
  
  // Track if filters have changed
  const filtersChanged = useMemo(() => {
    return (
      (pendingFilters.season || 'all') !== (filters.season || 'all') ||
      (pendingFilters.driverId || 'all') !== (filters.driverId || 'all') ||
      (pendingFilters.constructorId || 'all') !== (filters.constructorId || 'all')
    );
  }, [pendingFilters, filters]);
  
  useEffect(() => {
    getSeasons().then(setSeasons).catch(console.error);
  }, []);
  
  useEffect(() => {
    getDrivers({ limit: 1000 }).then(setDrivers).catch(console.error);
  }, []);
  
  useEffect(() => {
    getConstructors({ limit: 500 }).then(setConstructors).catch(console.error);
  }, []);
  
  // Sync pending filters when URL changes
  useEffect(() => {
    setPendingFilters({
      season: filters.season || 'all',
      driverId: filters.driverId || 'all',
      constructorId: filters.constructorId || 'all',
      yearFrom: filters.yearFrom || 'all',
      yearTo: filters.yearTo || 'all'
    });
  }, [filters]);
  
  const handleApplyFilters = () => {
    setFilters({
      season: pendingFilters.season === 'all' ? null : pendingFilters.season,
      driverId: pendingFilters.driverId === 'all' ? null : pendingFilters.driverId,
      constructorId: pendingFilters.constructorId === 'all' ? null : pendingFilters.constructorId,
      yearFrom: pendingFilters.yearFrom === 'all' ? null : pendingFilters.yearFrom,
      yearTo: pendingFilters.yearTo === 'all' ? null : pendingFilters.yearTo
    });
    setIsOpen(false);
  };
  
  const handleClearFilters = () => {
    setPendingFilters({
      season: 'all',
      driverId: 'all',
      constructorId: 'all',
      yearFrom: 'all',
      yearTo: 'all'
    });
    clearFilters();
  };
  
  const hasActiveFilters = filters.season || filters.driverId || filters.constructorId || filters.yearFrom || filters.yearTo;
  
  const FilterContent = () => (
    <div className="space-y-6">
      {showYearRange && (
        <div className="space-y-3">
          <Label className="data-label">Year Range</Label>
          <div className="flex items-center gap-3">
            <Select 
              value={pendingFilters.yearFrom} 
              onValueChange={(v) => setPendingFilters(prev => ({ ...prev, yearFrom: v }))}
            >
              <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-year-from">
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent className="bg-surface-200 border-white/10">
                <SelectItem value="all">All</SelectItem>
                {seasons.map(s => (
                  <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-slate-500">to</span>
            <Select 
              value={pendingFilters.yearTo} 
              onValueChange={(v) => setPendingFilters(prev => ({ ...prev, yearTo: v }))}
            >
              <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-year-to">
                <SelectValue placeholder="To" />
              </SelectTrigger>
              <SelectContent className="bg-surface-200 border-white/10">
                <SelectItem value="all">All</SelectItem>
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
          value={pendingFilters.season} 
          onValueChange={(v) => setPendingFilters(prev => ({ ...prev, season: v }))}
        >
          <SelectTrigger className="bg-surface-200 border-white/10" data-testid="filter-season">
            <SelectValue placeholder="All Seasons" />
          </SelectTrigger>
          <SelectContent className="bg-surface-200 border-white/10 max-h-60">
            <SelectItem value="all">All Seasons</SelectItem>
            {seasons.map(s => (
              <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {showDriverFilter && (
        <div className="space-y-3">
          <Label className="data-label">Driver</Label>
          <SearchableSelect
            value={pendingFilters.driverId}
            onValueChange={(v) => setPendingFilters(prev => ({ ...prev, driverId: v }))}
            placeholder="All Drivers"
            items={drivers}
            displayKey={(d) => `${d.code ? d.code + ' ' : ''}${d.forename} ${d.surname}`}
            valueKey="driverId"
            searchPlaceholder="Search drivers..."
            testId="filter-driver-search"
          />
        </div>
      )}
      
      {showConstructorFilter && (
        <div className="space-y-3">
          <Label className="data-label">Constructor</Label>
          <SearchableSelect
            value={pendingFilters.constructorId}
            onValueChange={(v) => setPendingFilters(prev => ({ ...prev, constructorId: v }))}
            placeholder="All Constructors"
            items={constructors}
            displayKey="name"
            valueKey="constructorId"
            searchPlaceholder="Search constructors..."
            testId="filter-constructor-search"
          />
        </div>
      )}
      
      <div className="flex gap-2 pt-2">
        <Button 
          onClick={handleApplyFilters}
          className="flex-1 bg-racing-cyan text-black hover:bg-racing-cyan/80"
          data-testid="apply-filters"
        >
          <Play className="w-4 h-4 mr-2" />
          Apply Filters
        </Button>
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            onClick={handleClearFilters}
            className="text-slate-400 hover:text-white"
            data-testid="clear-filters"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
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
          value={pendingFilters.season} 
          onValueChange={(v) => setPendingFilters(prev => ({ ...prev, season: v }))}
        >
          <SelectTrigger className="w-32 bg-surface-200 border-white/10 h-9" data-testid="desktop-filter-season">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent className="bg-surface-200 border-white/10">
            <SelectItem value="all">All Years</SelectItem>
            {seasons.map(s => (
              <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {showDriverFilter && (
          <SearchableSelect
            value={pendingFilters.driverId}
            onValueChange={(v) => setPendingFilters(prev => ({ ...prev, driverId: v }))}
            placeholder="All Drivers"
            items={drivers}
            displayKey={(d) => `${d.code ? d.code + ' ' : ''}${d.forename} ${d.surname}`}
            valueKey="driverId"
            searchPlaceholder="Search drivers..."
            testId="desktop-filter-driver"
          />
        )}
        
        {showConstructorFilter && (
          <SearchableSelect
            value={pendingFilters.constructorId}
            onValueChange={(v) => setPendingFilters(prev => ({ ...prev, constructorId: v }))}
            placeholder="All Constructors"
            items={constructors}
            displayKey="name"
            valueKey="constructorId"
            searchPlaceholder="Search constructors..."
            testId="desktop-filter-constructor"
          />
        )}
        
        <Button 
          onClick={handleApplyFilters}
          size="sm"
          className={`h-9 ${filtersChanged ? 'bg-racing-cyan text-black hover:bg-racing-cyan/80' : 'bg-surface-300 text-white hover:bg-surface-200'}`}
          data-testid="desktop-apply-filters"
        >
          <Play className="w-4 h-4 mr-1" />
          GO
        </Button>
        
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleClearFilters}
            className="text-slate-400 hover:text-white ml-auto h-9"
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
