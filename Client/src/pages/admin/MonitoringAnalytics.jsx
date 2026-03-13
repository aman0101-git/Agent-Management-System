import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchMonitoringAnalytics,
  fetchMonitoringAgents,
  fetchMonitoringCampaigns,
  fetchMonitoringDrilldown,
  fetchMonitoringDrilldownExport,
} from "@/api/adminApi";
import { 
  Phone, 
  Users, 
  Banknote, 
  Loader2,
  X,
  Download,
  CalendarDays,
  Activity,
  ArrowRight,
  PieChart,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  IndianRupee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminNavbar from "../../components/AdminNavbar";

const MonitoringAnalytics = () => {
  const { token } = useAuth();

  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateFilter, setDateFilter] = useState("thisMonth");

  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // FIX: Added initialization state to prevent premature fetching
  const [isInitialized, setIsInitialized] = useState(false);

  // Drilldown Modal State
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState([]);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [selectedDisposition, setSelectedDisposition] = useState("");

  // EXPORT STATES
  const [isExporting, setIsExporting] = useState(false);
  const [drilldownStartDate, setDrilldownStartDate] = useState("");
  const [drilldownEndDate, setDrilldownEndDate] = useState("");

  // Initialize dates to current calendar month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date) => date.toISOString().split("T")[0];

    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));
  }, []);

  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    const today = new Date();
    let start, end;
    switch (filter) {
      case "today":
        start = end = today;
        break;
      case "yesterday":
        start = new Date(today);
        start.setDate(today.getDate() - 1);
        end = new Date(start);
        break;
      case "thisWeek": {
        const day = today.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
        start = new Date(new Date(today).setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      }
      case "thisMonth":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "custom":
        return;
      default:
        return;
    }
    const formatDate = (date) => date.toISOString().split("T")[0];
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  // FIX: Fetch Options, auto-select them, then flag as initialized
  useEffect(() => {
    const loadFilterOptions = async () => {
      if (!token) return;
      try {
        const [agentsData, campaignsData] = await Promise.all([
          fetchMonitoringAgents(token),
          fetchMonitoringCampaigns(token),
        ]);
        
        const fetchedAgents = agentsData || [];
        const fetchedCampaigns = campaignsData || [];
        
        setAgents(fetchedAgents);
        setCampaigns(fetchedCampaigns);
        
        // Auto-select all by default to populate arrays immediately
        setSelectedAgentIds(fetchedAgents.map((a) => a.id));
        setSelectedCampaignIds(fetchedCampaigns.map((c) => c.id));
      } catch (err) {
        console.error("Failed to load filter options:", err);
      } finally {
        setIsInitialized(true);
      }
    };

    loadFilterOptions();
  }, [token]);

  // FIX: Only load analytics when dates exist AND initialization is complete
  useEffect(() => {
    if (isInitialized && startDate && endDate && token) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, startDate, endDate, token]);

  const getCampaignFilterParam = () => {
    if (selectedCampaignIds.length === 0) return "ALL";
    return selectedCampaignIds.join(",");
  };

  const getAgentFilterParam = () => {
    if (selectedAgentIds.length === 0) return "ALL";
    return selectedAgentIds.join(",");
  };

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMonitoringAnalytics(
        getCampaignFilterParam(),
        getAgentFilterParam(),
        startDate,
        endDate,
        token
      );
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError(err.response?.data?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleDrilldownClick = async (disposition, overrideStartDate = null, overrideEndDate = null) => {
    const activeStartDate = overrideStartDate || startDate;
    const activeEndDate = overrideEndDate || endDate;

    setIsDrilldownOpen(true);
    setDrilldownTitle(disposition === "TOTAL_COLLECTED" ? "Total Collected Customers List" : `${disposition} Customers List`);
    setSelectedDisposition(disposition);
    setDrilldownStartDate(activeStartDate);
    setDrilldownEndDate(activeEndDate);
    setDrilldownLoading(true);
    setDrilldownData([]);

    try {
      const data = await fetchMonitoringDrilldown(
        disposition,
        getCampaignFilterParam(),
        getAgentFilterParam(),
        activeStartDate,
        activeEndDate,
        token
      );
      setDrilldownData(data || []);
    } catch (err) {
      console.error("Failed to fetch drilldown data:", err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await fetchMonitoringDrilldownExport(
        selectedDisposition,
        getCampaignFilterParam(),
        getAgentFilterParam(),
        drilldownStartDate,
        drilldownEndDate,
        token
      );
      
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedDisposition}_Customers.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleCampaign = (campaignId) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(campaignId)
        ? prev.filter((id) => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const toggleAgent = (agentId) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const selectAllCampaigns = () => {
    if (selectedCampaignIds.length === campaigns.length) {
      setSelectedCampaignIds([]);
    } else {
      setSelectedCampaignIds(campaigns.map((c) => c.id));
    }
  };

  const selectAllAgents = () => {
    if (selectedAgentIds.length === agents.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(agents.map((a) => a.id));
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatToDDMMYYYY = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  if (!analytics && !error) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/50 min-h-screen flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { overview = {}, breakdown = {}, summary = {}, monthlySummary = {} } = analytics || {};

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/50 min-h-screen relative font-sans text-slate-800">
      <AdminNavbar />
      
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm shadow-indigo-100/50">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight mb-1">
              Admin Monitoring Analytics
            </h1>
            <p className="text-sm md:text-base text-slate-500">
              Aggregated performance metrics across agents and campaigns
            </p>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full opacity-60 blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10">
            <p className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" /> Analytics Filters
            </p>

            {/* Date Filters */}
            <div className="mb-6 flex gap-2 flex-wrap">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "thisWeek", label: "This Week" },
                { id: "thisMonth", label: "This Month" },
                { id: "custom", label: "Custom Range" }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => filter.id === "custom" ? setDateFilter("custom") : handleDateFilterChange(filter.id)}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                    dateFilter === filter.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-600 ring-offset-2"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Custom Date Picker */}
            {dateFilter === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 p-5 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* Multi-Select Filters */}
            <div className="flex flex-col md:flex-row gap-6 items-start mb-2">
              <div className="flex-1 w-full min-w-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-700">Campaigns</label>
                  <button
                    onClick={selectAllCampaigns}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition-colors"
                  >
                    {selectedCampaignIds.length === campaigns.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex flex-col gap-2 shadow-inner custom-scrollbar">
                  {campaigns.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-white rounded-md transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.includes(c.id)}
                        onChange={() => toggleCampaign(c.id)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700">{c.campaign_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-w-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-700">Agents</label>
                  <button
                    onClick={selectAllAgents}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition-colors"
                  >
                    {selectedAgentIds.length === agents.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex flex-col gap-2 shadow-inner custom-scrollbar">
                  {agents.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 cursor-pointer p-1.5 hover:bg-white rounded-md transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgentIds.includes(a.id)}
                        onChange={() => toggleAgent(a.id)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700">{a.firstName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-end self-stretch md:self-auto pt-6 md:pt-8 md:pb-2">
                <Button
                  onClick={loadAnalytics}
                  disabled={loading}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-6 md:py-2 rounded-xl shadow-md shadow-blue-200 transition-all"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : null}
                  {loading ? "Loading..." : "Apply Filters"}
                </Button>
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* SECTION A: Call & PTP Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <Phone className="w-6 h-6" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">
                {overview.calls_attended || 0}
              </p>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Calls Attended
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Total disposition submissions
              </p>
            </div>
          </div>

          <div 
            onClick={() => handleDrilldownClick("PTP")}
            className="group bg-white rounded-2xl shadow-sm border border-slate-100 p-6 cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-amber-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-100 opacity-0"></div>
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-bold text-slate-800">
                {overview.ptp_count || 0}
              </p>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                PTP Customers
              </p>
              <p className="text-xs text-amber-600 mt-1 font-bold tracking-wide">
                Click to view details &rarr;
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                <Banknote className="w-6 h-6" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 tracking-tight">
                {formatCurrency(overview.total_ptp_amount || 0)}
              </p>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Total PTP Amount
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Expected to collect
              </p>
            </div>
          </div>
        </div>

        {/* SECTION B: Collection Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <PieChart className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-slate-800">Collection Breakdown</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: "PIF", label: "Paid in Full (PIF)", theme: "blue" },
              { key: "SIF", label: "Settle in Full (SIF)", theme: "emerald" },
              { key: "FCL", label: "Forclosure (FCL)", theme: "violet" },
              { key: "PRT", label: "Part Payment (PRT)", theme: "orange" },
            ].map(({ key, label, theme }) => {
              const item = breakdown[key] || {
                customer_count: 0,
                total_amount: 0,
              };
              const themeStyles = {
                blue: "bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:shadow-blue-100 text-blue-700",
                emerald: "bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100 text-emerald-700",
                violet: "bg-violet-50/50 border-violet-100 hover:border-violet-300 hover:shadow-violet-100 text-violet-700",
                orange: "bg-orange-50/50 border-orange-100 hover:border-orange-300 hover:shadow-orange-100 text-orange-700",
              };

              return (
                <div
                  key={key}
                  onClick={() => handleDrilldownClick(key)}
                  className={`group border rounded-xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${themeStyles[theme]} relative overflow-hidden`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <p className="font-bold text-sm text-slate-800">{label}</p>
                    <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ${themeStyles[theme].split(' ').pop()}`} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Customers</p>
                      <p className="text-2xl font-bold text-slate-800">
                        {item.customer_count || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Collected</p>
                      <p className="text-lg font-bold text-slate-800 tracking-tight">
                        {formatCurrency(item.total_amount || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION C: Total Collection Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-800">Total Collection Summary</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div 
              onClick={() => handleDrilldownClick("TOTAL_COLLECTED")}
              className="group bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-6 md:p-8 cursor-pointer hover:shadow-lg hover:shadow-emerald-200 transition-all duration-300 relative overflow-hidden text-white"
            >
              <div className="absolute top-0 right-0 p-6 opacity-20">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <p className="text-emerald-50 font-semibold mb-2 uppercase tracking-wider text-sm">
                  Total Collected Customers
                </p>
                <div className="flex items-end gap-4">
                  <p className="text-5xl md:text-6xl font-bold">
                    {summary.total_collected_count || 0}
                  </p>
                  <div className="mb-2 flex items-center gap-1 text-emerald-50 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm tracking-wide">
                    View list <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-md shadow-blue-200/50">
              <div className="absolute top-0 right-0 p-6 opacity-20">
                <IndianRupee className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <p className="text-blue-100 font-semibold mb-2 uppercase tracking-wider text-sm">
                  Total Collected Amount
                </p>
                <p className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
                  {formatCurrency(summary.total_collected_amount || 0)}
                </p>
                <p className="text-sm text-blue-200 font-medium">
                  Actual amount recovered in period
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Expected vs Actual
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div className="p-5 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm text-amber-700 font-bold mb-1">
                    Expected to Collect (PTP)
                  </p>
                  <p className="text-2xl font-bold text-amber-900 tracking-tight">
                    {formatCurrency(overview.total_ptp_amount || 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm text-emerald-700 font-bold mb-1">
                    Actually Collected
                  </p>
                  <p className="text-2xl font-bold text-emerald-900 tracking-tight">
                    {formatCurrency(summary.total_collected_amount || 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/80 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-end mb-3">
                <p className="text-sm font-bold text-slate-700">
                  Collection Achievement Rate
                </p>
                <p className="text-3xl font-bold text-slate-800">
                  {overview.total_ptp_amount && overview.total_ptp_amount > 0
                    ? Math.round(
                        (summary.total_collected_amount /
                          overview.total_ptp_amount) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out relative"
                  style={{
                    width: `${
                      overview.total_ptp_amount && overview.total_ptp_amount > 0
                        ? Math.min(
                            (summary.total_collected_amount /
                              overview.total_ptp_amount) *
                              100,
                            100
                          )
                        : 0
                    }%`,
                  }}
                >
                  <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION D: Monthly Summary */}
        {monthlySummary && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-900 p-6 md:p-8 mt-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-gradient-to-br from-indigo-100/50 to-purple-50/50 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-bold text-slate-800 mb-1">
                  Monthly Summary
                </h2>
                <p className="text-sm text-slate-500">
                  Calendar month overview, independent of the selected date range
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div 
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
                    handleDrilldownClick("TOTAL_COLLECTED", firstDay, lastDay);
                  }}
                  className="group bg-blue-50/60 border border-blue-100 rounded-xl p-6 cursor-pointer hover:bg-blue-100/50 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50 transition-all"
                >
                  <p className="text-sm font-bold text-blue-700 mb-2 uppercase tracking-wider">
                    Customers (This Month)
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-4xl font-bold text-blue-900">
                      {monthlySummary.total_collected_count || 0}
                    </p>
                    <ArrowRight className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all font-bold" />
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-6 hover:shadow-md hover:shadow-emerald-100/50 hover:bg-emerald-100/50 hover:border-emerald-200 transition-all">
                  <p className="text-sm font-bold text-emerald-700 mb-2 uppercase tracking-wider">
                    Collected (This Month)
                  </p>
                  <p className="text-4xl font-bold text-emerald-900 tracking-tight">
                    {formatCurrency(monthlySummary.total_collected_amount || 0)}
                  </p>
                </div>

                <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-6 hover:shadow-md hover:shadow-violet-100/50 hover:bg-violet-100/50 hover:border-violet-200 transition-all">
                  <p className="text-sm font-bold text-violet-700 mb-2 uppercase tracking-wider">
                    Monthly Target
                  </p>
                  <p className="text-4xl font-bold text-violet-900 tracking-tight">
                    {monthlySummary.target_amount
                      ? formatCurrency(monthlySummary.target_amount)
                      : "Not Set"}
                  </p>
                </div>
              </div>

              {monthlySummary.target_amount && (
                <div className="p-6 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl border border-indigo-100/60">
                  <p className="text-sm font-bold text-indigo-900/70 mb-6 uppercase tracking-wider">
                    Achievement vs Target
                  </p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <p className="text-sm text-slate-600 font-bold">Achievement Rate</p>
                        <p className="text-4xl font-bold text-indigo-600">
                          {monthlySummary.achievement_percent != null
                            ? monthlySummary.achievement_percent.toFixed(1)
                            : 0}
                          %
                        </p>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-4 overflow-hidden border border-slate-200">
                        <div
                          className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 h-full rounded-full transition-all duration-1000 relative"
                          style={{
                            width: `${Math.min(
                              monthlySummary.achievement_percent || 0,
                              100
                            )}%`,
                          }}
                        >
                          <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm shadow-slate-200/50">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold">Expected (PTP-RTP)</span>
                          <span className="font-bold text-slate-800">
                            {formatCurrency(monthlySummary.expected_amount || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                          <span className="text-slate-500 font-bold">Target</span>
                          <span className="font-bold text-slate-800">
                            {formatCurrency(monthlySummary.target_amount || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                          <span className="text-slate-500 font-bold">Collected (Actual)</span>
                          <span className="font-bold text-emerald-600">
                            {formatCurrency(monthlySummary.total_collected_amount || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DRILLDOWN MODAL */}
      {isDrilldownOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{drilldownTitle}</h3>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={handleExportCSV} 
                  disabled={drilldownLoading || isExporting || drilldownData.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 h-9 px-4 text-sm rounded-lg shadow-sm transition-colors"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? "Exporting..." : "Export CSV"}
                </Button>
                <button 
                  onClick={() => setIsDrilldownOpen(false)}
                  className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-0 overflow-y-auto flex-1 bg-slate-50/50">
              {drilldownLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Fetching customer details...</p>
                </div>
              ) : drilldownData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-bold text-slate-600">No customers found</p>
                  <p className="text-sm mt-1">No data available for this disposition in the selected range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Customer Name</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Loan Agreement No</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Contact No</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Agent Name</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Campaign</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Disposition</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Amount</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">
                          {["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(selectedDisposition) 
                            ? "Payment Date" 
                            : "Follow Up Date & Time"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {drilldownData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-4 text-slate-800 font-medium">{row.customer_name || "-"}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{row.loan_agreement_no || "-"}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{row.customer_no || "-"}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{row.agent_name || "-"}</td>
                          <td className="px-6 py-4 text-slate-500">{row.campaign_name || "N/A"}</td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200">
                              {row.latest_disposition}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-600">
                            {row.amount ? formatCurrency(row.amount) : "-"}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(selectedDisposition) ? (
                              <span className="font-medium text-slate-800">
                                {row.payment_date 
                                  ? formatToDDMMYYYY(row.payment_date) 
                                  : "-"}
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">
                                  {row.follow_up_date 
                                    ? formatToDDMMYYYY(row.follow_up_date) 
                                    : "-"}
                                </span>
                                <span className="text-xs text-slate-500 font-medium mt-0.5">
                                  {row.follow_up_time || ""}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            {drilldownData.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-right">
                <p className="text-sm font-medium text-slate-500">
                  Showing <span className="font-bold text-slate-800">{drilldownData.length}</span> records
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default MonitoringAnalytics;