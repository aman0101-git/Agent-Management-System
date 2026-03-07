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
  Download
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

  // Drilldown Modal State
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState([]);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [selectedDisposition, setSelectedDisposition] = useState("");

  // NEW STATES FOR EXPORT
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
        start = new Date(today.setDate(diff));
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

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        if (token) {
          const [agentsData, campaignsData] = await Promise.all([
            fetchMonitoringAgents(token),
            fetchMonitoringCampaigns(token),
          ]);
          setAgents(agentsData || []);
          setCampaigns(campaignsData || []);
        }
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };

    loadFilterOptions();
  }, [token]);

  useEffect(() => {
    if (startDate && endDate && token) {
      loadAnalytics();
    }
  }, [startDate, endDate, token]);

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
    setDrilldownStartDate(activeStartDate); // Track exact date used
    setDrilldownEndDate(activeEndDate);     // Track exact date used
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
        drilldownStartDate, // Uses the exact date the modal was opened with
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

  if (!analytics && !error) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { overview = {}, breakdown = {}, summary = {}, monthlySummary = {} } = analytics || {};

  // Add this helper function to format dates
  const formatToDDMMYYYY = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen relative">
      <AdminNavbar/>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Admin Monitoring Analytics
          </h1>
          <p className="text-slate-600">
            Aggregated performance metrics across agents and campaigns
          </p>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <p className="text-sm font-semibold text-slate-900 mb-4">Filters</p>

          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => handleDateFilterChange("today")}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition ${
                dateFilter === "today"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleDateFilterChange("yesterday")}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition ${
                dateFilter === "yesterday"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => handleDateFilterChange("thisWeek")}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition ${
                dateFilter === "thisWeek"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => handleDateFilterChange("thisMonth")}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition ${
                dateFilter === "thisMonth"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateFilter("custom")}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition ${
                dateFilter === "custom"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Custom
            </button>
          </div>

          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 items-start mb-6">
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Campaigns</label>
                <button
                  onClick={selectAllCampaigns}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedCampaignIds.length === campaigns.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 flex flex-col gap-2">
                {campaigns.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.includes(c.id)}
                      onChange={() => toggleCampaign(c.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{c.campaign_name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Agents</label>
                <button
                  onClick={selectAllAgents}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedAgentIds.length === agents.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 flex flex-col gap-2">
                {agents.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgentIds.includes(a.id)}
                      onChange={() => toggleAgent(a.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{a.firstName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-end pb-2">
              <Button
                onClick={loadAnalytics}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {loading ? "Loading..." : "Apply Filters"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* SECTION A: Call & PTP Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  Calls Attended
                </p>
                <p className="text-4xl font-bold text-slate-900">
                  {overview.calls_attended || 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Total disposition submissions
            </p>
          </div>

          <div 
            onClick={() => handleDrilldownClick("PTP")}
            className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg hover:ring-2 ring-purple-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  PTP Customers
                </p>
                <p className="text-4xl font-bold text-slate-900">
                  {overview.ptp_count || 0}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-purple-500 mt-3 font-medium">
              Click to view details &rarr;
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  Total PTP Amount
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatCurrency(overview.total_ptp_amount || 0)}
                </p>
              </div>
              <div className="bg-amber-100 rounded-full p-3">
                <Banknote className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Expected to collect
            </p>
          </div>
        </div>

        {/* SECTION B: Collection Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Collection Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: "PIF", label: "PIF (Paid in Full)", color: "blue" },
              { key: "SIF", label: "SIF (Settle in Full)", color: "green" },
              { key: "FCL", label: "FCL (Forclosure)", color: "purple" },
              { key: "PRT", label: "PRT (Part Payment)", color: "orange" },
            ].map(({ key, label, color }) => {
              const item = breakdown[key] || {
                customer_count: 0,
                total_amount: 0,
              };
              const colorClasses = {
                blue: "bg-blue-50 border-blue-200 text-blue-700 hover:ring-blue-400",
                green: "bg-green-50 border-green-200 text-green-700 hover:ring-green-400",
                purple: "bg-purple-50 border-purple-200 text-purple-700 hover:ring-purple-400",
                orange: "bg-orange-50 border-orange-200 text-orange-700 hover:ring-orange-400",
              };

              return (
                <div
                  key={key}
                  onClick={() => handleDrilldownClick(key)}
                  className={`border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all ${colorClasses[color]}`}
                >
                  <p className="font-semibold text-sm mb-3">{label}</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs opacity-75">Customers</p>
                      <p className="text-2xl font-bold">
                        {item.customer_count || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs opacity-75">Amount Collected</p>
                      <p className="text-xl font-bold">
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Total Collection Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => handleDrilldownClick("TOTAL_COLLECTED")}
              className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200 cursor-pointer hover:shadow-lg hover:ring-2 ring-green-400 transition-all"
            >
              <p className="text-sm font-medium text-green-700 mb-2">
                Total Collected Customers
              </p>
              <p className="text-5xl font-bold text-green-900">
                {summary.total_collected_count || 0}
              </p>
              <p className="text-xs text-green-700 mt-2 font-medium">
                Click to view details &rarr;
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border border-emerald-200">
              <p className="text-sm font-medium text-emerald-700 mb-2">
                Total Collected Amount
              </p>
              <p className="text-4xl font-bold text-emerald-900">
                {formatCurrency(summary.total_collected_amount || 0)}
              </p>
              <p className="text-xs text-emerald-700 mt-2">
                Actual amount recovered
              </p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Expected vs Actual
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700 font-medium">
                  Expected to Collect (PTP)
                </p>
                <p className="text-3xl font-bold text-amber-900 mt-2">
                  {formatCurrency(overview.total_ptp_amount || 0)}
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-medium">
                  Actually Collected
                </p>
                <p className="text-3xl font-bold text-green-900 mt-2">
                  {formatCurrency(summary.total_collected_amount || 0)}
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-700 font-medium mb-3">
                Collection Achievement Rate
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all"
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
                    ></div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 min-w-fit">
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
            </div>
          </div>
        </div>

        {/* SECTION D: Monthly Summary */}
        {monthlySummary && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Monthly Summary (Calendar Month)
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              This section always shows the current calendar month, independent of the selected date range
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div 
                onClick={() => {
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
                  handleDrilldownClick("TOTAL_COLLECTED", firstDay, lastDay);
                }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200 cursor-pointer hover:shadow-lg hover:ring-2 ring-blue-400 transition-all"
              >
                <p className="text-sm font-medium text-blue-700 mb-2">
                  Customers Collected (This Month)
                </p>
                <p className="text-4xl font-bold text-blue-900">
                  {monthlySummary.total_collected_count || 0}
                </p>
                <p className="text-xs text-blue-700 mt-2 font-medium">
                  Click to view details &rarr;
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border border-emerald-200">
                <p className="text-sm font-medium text-emerald-700 mb-2">
                  Amount Collected (This Month)
                </p>
                <p className="text-4xl font-bold text-emerald-900">
                  {formatCurrency(monthlySummary.total_collected_amount || 0)}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                <p className="text-sm font-medium text-purple-700 mb-2">
                  Monthly Target
                </p>
                <p className="text-4xl font-bold text-purple-900">
                  {monthlySummary.target_amount
                    ? formatCurrency(monthlySummary.target_amount)
                    : "Not Set"}
                </p>
              </div>
            </div>

            {monthlySummary.target_amount && (
              <div className="mt-6 p-6 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-700 font-medium mb-4">
                  Monthly Achievement vs Target
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Achievement Rate</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="w-full bg-slate-200 rounded-full h-4">
                          <div
                            className="bg-blue-600 h-4 rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                monthlySummary.achievement_percent || 0,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 min-w-fit">
                        {monthlySummary.achievement_percent != null
                          ? monthlySummary.achievement_percent.toFixed(1)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 mb-2">Summary</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-700">Expected (PTP-RTP):</span>
                        <span className="font-semibold">
                          {formatCurrency(monthlySummary.expected_amount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-slate-700">Target:</span>
                        <span className="font-semibold">
                          {formatCurrency(monthlySummary.target_amount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-slate-700">Collected (Actual):</span>
                        <span className="font-semibold text-green-700">
                          {formatCurrency(monthlySummary.total_collected_amount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-slate-700">Achievement %:</span>
                        <span className="font-semibold text-blue-700">
                          {monthlySummary.achievement_percent != null
                            ? monthlySummary.achievement_percent.toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DRILLDOWN MODAL */}
      {isDrilldownOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">{drilldownTitle}</h3>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={handleExportCSV} 
                  disabled={drilldownLoading || isExporting || drilldownData.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 h-9 px-4 text-sm"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? "Exporting..." : "Export CSV"}
                </Button>
                <button 
                  onClick={() => setIsDrilldownOpen(false)}
                  className="text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-full p-1 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {drilldownLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-500">Fetching customer details...</p>
                </div>
              ) : drilldownData.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No customers found for this disposition in the selected range.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        {/* REARRANGED COLUMNS */}
                        <th className="px-4 py-3 whitespace-nowrap">Customer Name</th>
                        <th className="px-4 py-3 whitespace-nowrap">Loan Agreement No</th>
                        <th className="px-4 py-3 whitespace-nowrap">Contact No</th>
                        <th className="px-4 py-3 whitespace-nowrap">Agent Name</th>
                        <th className="px-4 py-3 whitespace-nowrap">Campaign</th>
                        <th className="px-4 py-3 whitespace-nowrap">Disposition</th>
                        <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                        {/* CONDITIONAL DATE HEADER */}
                        <th className="px-4 py-3 whitespace-nowrap">
                          {["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(selectedDisposition) 
                            ? "Payment Date" 
                            : "Follow Up Date & Time"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drilldownData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-800 font-medium">{row.customer_name || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{row.loan_agreement_no || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{row.customer_no || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{row.agent_name || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{row.campaign_name || "N/A"}</td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded text-xs font-semibold">
                              {row.latest_disposition}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-emerald-600">
                            {row.amount ? formatCurrency(row.amount) : "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {/* CONDITIONAL DATE RENDERING WITH DD/MM/YYYY FORMAT */}
                            {["PRT", "FCL", "SIF", "PIF", "TOTAL_COLLECTED"].includes(selectedDisposition) ? (
                              <span>
                                {row.payment_date 
                                  ? formatToDDMMYYYY(row.payment_date) 
                                  : "-"}
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span>
                                  {row.follow_up_date 
                                    ? formatToDDMMYYYY(row.follow_up_date) 
                                    : "-"}
                                </span>
                                <span className="text-xs text-slate-400">
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
          </div>
        </div>
      )}

    </div>
  );
};

export default MonitoringAnalytics;