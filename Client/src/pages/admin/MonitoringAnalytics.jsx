import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchMonitoringAnalytics,
  fetchMonitoringAgents,
  fetchMonitoringCampaigns,
} from "@/api/adminApi";
import { Button } from "@/components/ui/button";

const MonitoringAnalytics = () => {
  const { token } = useAuth();

  // ISSUE #5 FIX: Use arrays for multi-select instead of single values
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

  // Initialize dates to current calendar month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date) => date.toISOString().split("T")[0];

    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));
  }, []);

  // Handle date filter presets
  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    const today = new Date();
    const formatDate = (date) => date.toISOString().split("T")[0];
    let start, end;

    switch (filter) {
      case "today":
        start = formatDate(today);
        end = formatDate(today);
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = formatDate(yesterday);
        end = formatDate(yesterday);
        break;
      case "thisWeek":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        start = formatDate(weekStart);
        end = formatDate(today);
        break;
      case "thisMonth":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        start = formatDate(monthStart);
        end = formatDate(monthEnd);
        break;
      case "custom":
        return; // Don't change dates in custom mode
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
  };

  // Fetch agents and campaigns on mount
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

  // Load analytics on mount with default calendar month
  useEffect(() => {
    if (startDate && endDate && token) {
      loadAnalytics();
    }
  }, [startDate, endDate, token]);

  // ISSUE #5 FIX: Build campaign and agent filter strings
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

  // ISSUE #5 FIX: Toggle campaign checkbox
  const toggleCampaign = (campaignId) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(campaignId)
        ? prev.filter((id) => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  // ISSUE #5 FIX: Toggle agent checkbox
  const toggleAgent = (agentId) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  // ISSUE #5 FIX: Select all campaigns
  const selectAllCampaigns = () => {
    if (selectedCampaignIds.length === campaigns.length) {
      setSelectedCampaignIds([]);
    } else {
      setSelectedCampaignIds(campaigns.map((c) => c.id));
    }
  };

  // ISSUE #5 FIX: Select all agents
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

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
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

          {/* DATE PRESET BUTTONS */}
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

          {/* Date Inputs */}
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

          {/* ISSUE #5 FIX: Campaign Multi-Select with Checkboxes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700">
                Campaigns
              </label>
              <button
                onClick={selectAllCampaigns}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedCampaignIds.length === campaigns.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                  <span className="text-sm text-slate-700">
                    {c.campaign_name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ISSUE #5 FIX: Agent Multi-Select with Checkboxes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-700">
                Agents
              </label>
              <button
                onClick={selectAllAgents}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedAgentIds.length === agents.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                  <span className="text-sm text-slate-700">{a.username}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <div className="flex gap-2">
            <Button
              onClick={loadAnalytics}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
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
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Total disposition submissions
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
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
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Customers with promise
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
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
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
                blue: "bg-blue-50 border-blue-200 text-blue-700",
                green: "bg-green-50 border-green-200 text-green-700",
                purple: "bg-purple-50 border-purple-200 text-purple-700",
                orange: "bg-orange-50 border-orange-200 text-orange-700",
              };

              return (
                <div
                  key={key}
                  className={`border-2 rounded-lg p-4 ${colorClasses[color]}`}
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
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
              <p className="text-sm font-medium text-green-700 mb-2">
                Total Collected Customers
              </p>
              <p className="text-5xl font-bold text-green-900">
                {summary.total_collected_count || 0}
              </p>
              <p className="text-xs text-green-700 mt-2">
                Successfully resolved cases
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

          {/* Comparison Section */}
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

            {/* Collection Rate */}
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
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-2">
                  Customers Collected (This Month)
                </p>
                <p className="text-4xl font-bold text-blue-900">
                  {monthlySummary.total_collected_count || 0}
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

            {/* Monthly Achievement */}
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
    </div>
  );
};

export default MonitoringAnalytics;
