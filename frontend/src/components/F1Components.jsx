import { Skeleton } from "../components/ui/skeleton";

export const KPICard = ({ label, value, icon: Icon, trend, loading, accentColor = "cyan" }) => {
  const accentClasses = {
    cyan: "border-t-racing-cyan",
    red: "border-t-racing-red",
    yellow: "border-t-racing-yellow",
    purple: "border-t-racing-purple",
  };

  if (loading) {
    return (
      <div className="bg-surface-100 border border-white/10 rounded-lg p-5 border-t-2 border-t-transparent">
        <Skeleton className="h-4 w-20 mb-3 bg-surface-300" />
        <Skeleton className="h-10 w-24 bg-surface-300" />
      </div>
    );
  }

  return (
    <div 
      className={`bg-surface-100 border border-white/10 rounded-lg p-5 border-t-2 ${accentClasses[accentColor]} 
                  hover:border-white/20 transition-colors group`}
      data-testid={`kpi-${label?.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="data-label">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-mono font-bold text-white tracking-tight">{value}</span>
        {trend !== undefined && (
          <span className={`text-sm font-mono ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
};

export const StatCard = ({ label, value, subtitle, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col">
        <Skeleton className="h-3 w-16 mb-2 bg-surface-300" />
        <Skeleton className="h-8 w-20 bg-surface-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="data-label mb-1">{label}</span>
      <span className="text-2xl font-mono font-bold text-white">{value}</span>
      {subtitle && <span className="text-xs text-slate-500 mt-1">{subtitle}</span>}
    </div>
  );
};

export const ChartFrame = ({ title, children, actions, loading, className = "" }) => {
  return (
    <div className={`bg-surface-100 border border-white/10 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <h3 className="font-heading text-lg font-semibold uppercase tracking-wide text-white">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5 relative">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse-slow">
              <div className="w-16 h-16 border-2 border-racing-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : (
          <>
            <div className="scanlines absolute inset-0 pointer-events-none" />
            {children}
          </>
        )}
      </div>
    </div>
  );
};

export const DataTable = ({ columns, data, loading, emptyMessage = "No data available" }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-surface-300" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col, i) => (
              <th 
                key={i} 
                className="px-4 py-3 text-left data-label"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex} 
              className="border-b border-white/5 hover:bg-surface-200 transition-colors"
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  {col.render ? col.render(row[col.key], row, rowIndex) : (
                    <span className={col.mono ? "font-mono text-white" : "text-slate-300"}>
                      {row[col.key] ?? "-"}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const FilterChip = ({ label, active, onClick, count }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-wide transition-all
                ${active 
                  ? 'bg-white text-black' 
                  : 'bg-transparent border border-white/20 text-slate-400 hover:text-white hover:border-white/40'}`}
  >
    {label}
    {count !== undefined && (
      <span className={`ml-2 ${active ? 'text-slate-600' : 'text-slate-500'}`}>({count})</span>
    )}
  </button>
);

export const PositionBadge = ({ position, size = "md" }) => {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base"
  };

  const bgColor = position === 1 
    ? "bg-racing-yellow text-black" 
    : position === 2 
      ? "bg-slate-400 text-black" 
      : position === 3 
        ? "bg-amber-700 text-white"
        : "bg-surface-300 text-slate-300";

  return (
    <div className={`${sizeClasses[size]} ${bgColor} rounded-sm flex items-center justify-center font-mono font-bold`}>
      {position ?? "-"}
    </div>
  );
};

export const DriverTag = ({ driver, showCode = true, showFlag = false }) => (
  <div className="flex items-center gap-2">
    {showCode && driver.code && (
      <span className="font-mono text-xs text-racing-cyan">{driver.code}</span>
    )}
    <span className="text-white">
      {driver.forename} <span className="font-semibold">{driver.surname}</span>
    </span>
  </div>
);

export const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <Icon className="w-12 h-12 text-slate-600 mb-4" />}
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-slate-500 max-w-sm">{description}</p>
  </div>
);
