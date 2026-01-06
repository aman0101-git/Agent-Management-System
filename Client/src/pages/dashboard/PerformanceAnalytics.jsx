import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchAnalytics, fetchAgentTarget, updateAgentTarget } from "@/api/agentApi";
import { Button } from "@/components/ui/button";

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


  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch analytics
        const data = await fetchAnalytics(
          timeFilter,
          token,
          timeFilter === "custom" ? customFromDate : undefined,
          timeFilter === "custom" ? customToDate : undefined
        );
        setAnalytics(data);

        // Fetch agent target
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

  const formatCurrency = (amount) => {
    if (!amount) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getFilterLabel = () => {
    const labels = {
      today: "Today",
      yesterday: "Yesterday",
      thisWeek: "This Week",
      thisMonth: "This Month",
    };
    return labels[timeFilter] || "This Month";
  };

  if (loading || !analytics) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { overview, breakdown, summary, monthlySummary } = analytics;

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Performance Analytics
          </h1>
          <p className="text-slate-600">
            Track your collections and performance metrics
          </p>
        </div>

        {/* Agent Target Section */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-6 mb-8 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700 mb-2">Monthly Target</p>
              {editingTarget ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="Enter target amount"
                    className="w-40 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button
                    onClick={handleSaveTarget}
                    disabled={savingTarget}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    size="sm"
                  >
                    {savingTarget ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingTarget(false);
                      setTargetInput(agentTarget ? String(agentTarget) : "");
                    }}
                    className="bg-slate-300 hover:bg-slate-400 text-slate-900"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <p className="text-4xl font-bold text-purple-900">
                    {agentTarget
                      ? new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(agentTarget)
                      : "Not Set"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Time Period
          </p>
          <div className="flex gap-2 flex-wrap">
            {["today", "yesterday", "thisWeek", "thisMonth", "custom"].map((filter) => (
              <Button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timeFilter === filter
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {filter === "today"
                  ? "Today"
                  : filter === "yesterday"
                  ? "Yesterday"
                  : filter === "thisWeek"
                  ? "This Week"
                  : filter === "thisMonth"
                  ? "This Month"
                  : "Custom"}
              </Button>
            ))}
          </div>

          {/* Custom Date Range Inputs */}
          {timeFilter === "custom" && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  From Date
                </label>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  To Date
                </label>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
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
                  {overview.calls_attended}
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
                  {overview.ptp_count}
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
                  {formatCurrency(overview.total_ptp_amount)}
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
              {
                key: "PIF",
                label: "PIF (Paid in Full)",
                color: "blue",
              },
              {
                key: "SIF",
                label: "SIF (Settle in Full)",
                color: "green",
              },
              {
                key: "FCL",
                label: "FCL (Forclosure)",
                color: "purple",
              },
              {
                key: "PRT",
                label: "PRT (Part Payment)",
                color: "orange",
              },
            ].map(({ key, label, color }) => {
              const item = breakdown[key];
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
                        {item.customer_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs opacity-75">Amount Collected</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(item.total_amount)}
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
                {summary.total_collected_count}
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
                {formatCurrency(summary.total_collected_amount)}
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
                  {formatCurrency(overview.total_ptp_amount)}
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 font-medium">
                  Actually Collected
                </p>
                <p className="text-3xl font-bold text-green-900 mt-2">
                  {formatCurrency(summary.total_collected_amount)}
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
                          overview.total_ptp_amount > 0
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
                  {overview.total_ptp_amount > 0
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

        {/* SECTION D: Monthly Summary (Always Calendar Month, Independent of Filter) */}
        {monthlySummary && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Monthly Summary (Calendar Month)
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              This section always shows the current calendar month, independent of the selected time filter
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-2">
                  Customers Collected (This Month)
                </p>
                <p className="text-4xl font-bold text-blue-900">
                  {monthlySummary.total_collected_count}
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border border-emerald-200">
                <p className="text-sm font-medium text-emerald-700 mb-2">
                  Amount Collected (This Month)
                </p>
                <p className="text-4xl font-bold text-emerald-900">
                  {formatCurrency(monthlySummary.total_collected_amount)}
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
                          {formatCurrency(monthlySummary.expected_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-slate-700">Target:</span>
                        <span className="font-semibold">
                          {formatCurrency(monthlySummary.target_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-slate-700">Collected (Actual):</span>
                        <span className="font-semibold text-green-700">
                          {formatCurrency(monthlySummary.total_collected_amount)}
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

export default PerformanceAnalytics;
