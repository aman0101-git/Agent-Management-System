import { useAuth } from "@/context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Search, 
  BarChart3, 
  LogOut,
  Headset
} from "lucide-react";

const AgentNavbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: "My Allocations", href: "/agent/dashboard", icon: LayoutDashboard },
    { name: "Customer Search", href: "/agent/search", icon: Search },
    { name: "Performance", href: "/agent/analytics", icon: BarChart3 },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        
        {/* LEFT: Branding & Welcome */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 shadow-md">
            <Headset className="h-5 w-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Agent Portal
            </p>
          </div>
        </div>

        {/* CENTER: Navigation Pills */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-inner">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-2 h-8 px-4 rounded-full text-xs font-medium transition-all duration-300 ${
                  isActive(item.href) 
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <item.icon className={`h-3.5 w-3.5 ${isActive(item.href) ? "text-blue-500" : "text-slate-400"}`} />
                {item.name}
              </Button>
            </Link>
          ))}
        </div>

        {/* RIGHT: Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors gap-2"
        >
          <span className="hidden sm:inline text-xs font-medium">Sign Out</span>
          <LogOut className="h-4 w-4" />
        </Button>

      </div>
    </nav>
  );
};

export default AgentNavbar;