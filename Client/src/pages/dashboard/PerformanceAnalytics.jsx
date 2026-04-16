import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  fetchAnalytics, 
  fetchAgentTarget, 
  updateAgentTarget,
  fetchAgentDrilldown
} from "@/api/agentApi";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  CalendarDays, 
  PhoneCall, 
  Users, 
  IndianRupee, 
  PieChart, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  Loader2, 
  ArrowRight,
  Activity,
  BarChart3,
  Wallet
} from "lucide-react";
import AgentNavbar from "../../components/AgentNavbar";

const PerformanceAnalytics = () => {
  const { token } = useAuth();

  const [timeFilter, setTimeFilter] = useState("thisMonth");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentTarget, setAgentTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  // --- Drilldown Modal State ---
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState([]);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [selectedDisposition, setSelectedDisposition] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchAnalytics(
          timeFilter,
          token,
          timeFilter === "custom" ? customFromDate : undefined,
          timeFilter === "custom" ? customToDate : undefined
        );
        setAnalytics(data);

        const target = await fetchAgentTarget(token);
        setAgentTarget(target?.target_amount || null);
        setTargetInput(target?.target_amount ? String(target.target_amount) : "");
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [timeFilter, token, customFromDate, customToDate]);

  const handleSaveTarget = async () => {
    const amount = Number(targetInput);
    if (!amount || amount <= 0) {
      alert("Please enter a valid target amount");
      return;
    }

    setSavingTarget(true);
    try {
      await updateAgentTarget(amount, token);
      setAgentTarget(amount);
      setEditingTarget(false);
    } catch (error) {
      console.error("Failed to save target:", error);
      alert("Failed to save target");
    } finally {
      setSavingTarget(false);
    }
  };

  const handleDrilldownClick = async (disposition, forceMonthly = false) => {
    setIsDrilldownOpen(true);
    setDrilldownTitle(disposition === "TOTAL_COLLECTED" ? "Total Collected Customers" : `${disposition} Customers`);
    setSelectedDisposition(disposition);
    setDrilldownLoading(true);
    setDrilldownData([]);

    // If the box is explicitly for the monthly section, force 'thisMonth'
    const appliedTimeFilter = forceMonthly ? "thisMonth" : timeFilter;

    try {
      const data = await fetchAgentDrilldown(
        disposition,
        appliedTimeFilter,
        token,
        appliedTimeFilter === "custom" ? customFromDate : undefined,
        appliedTimeFilter === "custom" ? customToDate : undefined
      );
      setDrilldownData(data || []);
    } catch (error) {
      console.error("Failed to fetch drilldown data:", error);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading || !analytics) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { overview, breakdown, summary, monthlySummary } = analytics;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/50 min-h-screen relative font-sans text-slate-800">
      <AgentNavbar />
      
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm shadow-indigo-100/50">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Performance Analytics</h1>
            <p className="text-sm md:text-base text-slate-500 mt-1">Track your collections, targets, and daily metrics</p>
          </div>
        </div>

        {/* Agent Target Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-40 h-40 bg-gradient-to-br from-violet-100 to-fuchsia-50 rounded-full opacity-60 blur-2xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-violet-100 p-3 rounded-xl text-violet-600">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Monthly Target</p>
                {editingTarget ? (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder="Enter target amount"
                      className="w-48 px-4 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white transition-all shadow-sm"
                    />
                    <Button onClick={handleSaveTarget} disabled={savingTarget} className="bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200">
                      {savingTarget ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {savingTarget ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setEditingTarget(false); setTargetInput(agentTarget ? String(agentTarget) : ""); }} className="text-slate-500 hover:bg-slate-100">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl md:text-4xl font-bold text-violet-950 tracking-tight">
                      {agentTarget ? formatCurrency(agentTarget) : "Not Set"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-slate-700">Time Period</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "thisWeek", label: "This Week" },
              { id: "thisMonth", label: "This Month" },
              { id: "custom", label: "Custom Range" }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTimeFilter(filter.id)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  timeFilter === filter.id 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-600 ring-offset-2" 
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {timeFilter === "custom" && (
            <div className="mt-5 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col md:flex-row gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2 block">From Date</label>
                <input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2 block">To Date</label>
                <input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm" />
              </div>
            </div>
          )}
        </div>

        {/* SECTION A: Call & PTP Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {/* Calls Attended */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <PhoneCall className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{overview.calls_attended}</p>
              <p className="text-sm font-medium text-slate-500 mt-1">Calls Attended</p>
              <p className="text-xs text-slate-400 mt-1">Total disposition submissions</p>
            </div>
          </div>

          {/* CLICKABLE PTP CARD */}
          <div 
            onClick={() => handleDrilldownClick("PTP")}
            className="group bg-white rounded-2xl shadow-sm border border-slate-100 p-6 cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-amber-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-full pointer-events-none transition-opacity group-hover:opacity-100 opacity-0"></div>
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                <Users className="w-5 h-5" />
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-bold text-slate-800">{overview.ptp_count}</p>
              <p className="text-sm font-medium text-slate-500 mt-1">PTP Customers</p>
              <p className="text-xs text-amber-600 font-medium mt-1">Click to view details</p>
            </div>
          </div>

          {/* Total PTP Amount */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 tracking-tight">{formatCurrency(overview.total_ptp_amount)}</p>
              <p className="text-sm font-medium text-slate-500 mt-1">Total PTP Amount</p>
              <p className="text-xs text-slate-400 mt-1">Expected to collect</p>
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
              const item = breakdown[key];
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
                    <p className="font-semibold text-sm text-slate-800">{label}</p>
                    <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ${themeStyles[theme].split(' ').pop()}`} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Customers</p>
                      <p className="text-2xl font-bold text-slate-800">{item.customer_count}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Collected</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(item.total_amount)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION C: Total Collection Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
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
                <p className="text-emerald-50 font-medium mb-2 uppercase tracking-wider text-sm">Total Collected Customers</p>
                <div className="flex items-end gap-4">
                  <p className="text-5xl md:text-6xl font-bold">{summary.total_collected_count}</p>
                  <div className="mb-2 flex items-center gap-1 text-emerald-50 text-sm font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">
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
                <p className="text-blue-100 font-medium mb-2 uppercase tracking-wider text-sm">Total Collected Amount</p>
                <p className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">{formatCurrency(summary.total_collected_amount)}</p>
                <p className="text-sm text-blue-200">Actual amount recovered in period</p>
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
                  <p className="text-sm text-amber-700 font-semibold mb-1">Expected (PTP)</p>
                  <p className="text-2xl font-bold text-amber-900">{formatCurrency(overview.total_ptp_amount)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm text-emerald-700 font-semibold mb-1">Actually Collected</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.total_collected_amount)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/80 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-end mb-3">
                <p className="text-sm font-semibold text-slate-700">Collection Achievement Rate</p>
                <p className="text-3xl font-bold text-slate-800">
                  {overview.total_ptp_amount > 0 ? Math.round((summary.total_collected_amount / overview.total_ptp_amount) * 100) : 0}%
                </p>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out relative"
                  style={{
                    width: `${overview.total_ptp_amount > 0 ? Math.min((summary.total_collected_amount / overview.total_ptp_amount) * 100, 100) : 0}%`,
                  }}
                >
                  <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION D: Monthly Summary (Now Light & Colorful) */}
        {monthlySummary && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-900 p-6 md:p-8 mt-8 relative overflow-hidden">
            {/* Soft decorative background blob */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-gradient-to-br from-indigo-100/50 to-purple-50/50 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-bold text-slate-800 mb-1">Monthly Summary</h2>
                <p className="text-sm text-slate-500">Calendar month overview, independent of the selected time filter</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div 
                  onClick={() => handleDrilldownClick("TOTAL_COLLECTED", true)}
                  className="group bg-blue-50/60 border border-blue-100 rounded-xl p-6 cursor-pointer hover:bg-blue-100/50 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50 transition-all"
                >
                  <p className="text-sm font-semibold text-blue-700 mb-2 uppercase tracking-wider">Customers</p>
                  <div className="flex items-center justify-between">
                    <p className="text-4xl font-bold text-blue-900">{monthlySummary.total_collected_count}</p>
                    <ArrowRight className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-6 hover:shadow-md hover:shadow-emerald-100/50 hover:bg-emerald-100/50 hover:border-emerald-200 transition-all">
                  <p className="text-sm font-semibold text-emerald-700 mb-2 uppercase tracking-wider">Collected</p>
                  <p className="text-4xl font-bold text-emerald-900">{formatCurrency(monthlySummary.total_collected_amount)}</p>
                </div>

                <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-6 hover:shadow-md hover:shadow-violet-100/50 hover:bg-violet-100/50 hover:border-violet-200 transition-all">
                  <p className="text-sm font-semibold text-violet-700 mb-2 uppercase tracking-wider">Monthly Target</p>
                  <p className="text-4xl font-bold text-violet-900">
                    {monthlySummary.target_amount ? formatCurrency(monthlySummary.target_amount) : "Not Set"}
                  </p>
                </div>
              </div>

              {monthlySummary.target_amount && (
                <div className="p-6 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl border border-indigo-100/60">
                  <p className="text-sm font-bold text-indigo-900/70 mb-6 uppercase tracking-wider">Achievement vs Target</p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <p className="text-sm text-slate-600 font-medium">Achievement Rate</p>
                        <p className="text-4xl font-bold text-indigo-600">
                          {monthlySummary.achievement_percent != null ? monthlySummary.achievement_percent.toFixed(1) : 0}%
                        </p>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-4 overflow-hidden border border-slate-200">
                        <div
                          className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 h-full rounded-full transition-all duration-1000 relative"
                          style={{ width: `${Math.min(monthlySummary.achievement_percent || 0, 100)}%` }}
                        >
                          <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm shadow-slate-200/50">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Expected (PTP-RTP)</span>
                          <span className="font-bold text-slate-800">{formatCurrency(monthlySummary.expected_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                          <span className="text-slate-500 font-medium">Target</span>
                          <span className="font-bold text-slate-800">{formatCurrency(monthlySummary.target_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                          <span className="text-slate-500 font-medium">Collected (Actual)</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(monthlySummary.total_collected_amount)}</span>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{drilldownTitle}</h3>
              </div>
              <button 
                onClick={() => setIsDrilldownOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
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
                  <p className="font-medium text-slate-600">No customers found</p>
                  <p className="text-sm mt-1">No data available for this disposition in the selected timeframe.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Customer Name</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Contact No</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-xs">Campaign Name</th>
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
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{row.contact_no || "-"}</td>
                          <td className="px-6 py-4 text-slate-500">{row.campaign_name || "N/A"}</td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">
                              {row.latest_disposition}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-emerald-600">
                            {row.amount ? formatCurrency(row.amount) : "-"}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(selectedDisposition) ? (
                              <span className="font-medium">
                                {row.payment_date 
                                  ? new Date(row.payment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
                                  : "-"}
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-700">
                                  {row.follow_up_date 
                                    ? new Date(row.follow_up_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
                                    : "-"}
                                </span>
                                <span className="text-xs text-slate-400 font-medium mt-0.5">
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

export default PerformanceAnalytics;