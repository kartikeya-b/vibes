import { Link, useLocation } from 'react-router-dom';
import { Activity, Flag, BookOpen, Users, Trophy, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { Button } from '../components/ui/button';

const NAV_ITEMS = [
  { path: '/', label: 'Analytics', icon: Activity },
  { path: '/race', label: 'Race Dive', icon: Flag },
  { path: '/story', label: 'Stories', icon: BookOpen },
  { path: '/rivalry', label: 'Rivalry', icon: Users },
  { path: '/goat', label: 'GOAT', icon: Trophy },
];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 bg-void/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group" data-testid="nav-logo">
            <div className="w-8 h-8 bg-racing-red rounded-sm flex items-center justify-center">
              <span className="font-heading font-black text-white text-lg italic">F1</span>
            </div>
            <span className="font-heading text-xl font-bold uppercase tracking-tight text-white hidden sm:block">
              Intelligence
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-bold uppercase tracking-wide transition-colors
                  ${isActive(path) 
                    ? 'bg-white text-black' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="mobile-menu-trigger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-surface-100 border-l border-white/10 w-64">
              <div className="flex flex-col gap-2 pt-8">
                {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-bold uppercase tracking-wide transition-colors
                      ${isActive(path) 
                        ? 'bg-white text-black' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
