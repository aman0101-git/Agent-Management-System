import { useAuth } from "@/context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Megaphone, 
  BarChart3,
  Database,
  FileSpreadsheet,
  LogOut,
  ShieldCheck
} from "lucide-react";

const AdminNavbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Users", href: "/admin/create-user", icon: Users },
    { name: "Allocation", href: "/admin/campaign-agents", icon: Megaphone },
    { name: "Data", href: "/admin/upload-data", icon: Database },
    { name: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
    { name: "Monitoring", href: "/admin/monitoring-analytics", icon: BarChart3 },
    { name: "Exports", href: "/admin/file-exports", icon: FileSpreadsheet }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        
        {/* LEFT: Branding & Welcome */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Admin
            </p>
          </div>
        </div>

        {/* CENTER: Navigation Pills */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-full border border-slate-200/60 shadow-inner">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-2 h-8 px-4 rounded-full text-xs font-medium transition-all duration-300 ${
                  isActive(item.href) 
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <item.icon className={`h-3.5 w-3.5 ${isActive(item.href) ? "text-indigo-500" : "text-slate-400"}`} />
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

export default AdminNavbar;