import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  distributeCampaignData,
  fetchCampaignDistributionSummary,
} from "@/api/campaignApi";

const ManageCampaigns = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [summaryData, setSummaryData] = useState({});

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/campaigns/all",
        { headers }
      );
      setCampaigns(res.data);
    } catch {
      setError("Failed to load campaigns");
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const toggleCampaign = async (id, status) => {
    try {
      await axios.patch(
        `http://localhost:5000/api/campaigns/${id}/${
          status === "ACTIVE" ? "deactivate" : "activate"
        }`,
        {},
        { headers }
      );
      fetchCampaigns();
    } catch {
      setError("Failed to update campaign");
    }
  };

  const handleDistribute = async (campaignId) => {
    try {
      const res = await distributeCampaignData(campaignId, token);
      alert(
        `Distributed ${res.data.distributed} records to ${res.data.agents} agents`
      );
      loadSummary(campaignId);
    } catch (err) {
      alert(err.response?.data?.message || "Distribution failed");
    }
  };

  const loadSummary = async (campaignId) => {
    try {
      const res = await fetchCampaignDistributionSummary(campaignId, token);
      setSummaryData((prev) => ({
        ...prev,
        [campaignId]: res.data,
      }));
    } catch {
      setError("Failed to load distribution summary");
    }
  };

  const getDistributionStatus = (summary) => {
    if (!summary) return "READY";
    if (summary.unassignedRecords === 0) return "DONE";
    if (summary.assignedRecords > 0) return "PARTIAL";
    return "READY";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-100">
        <h2 className="mb-6 text-xl font-semibold text-slate-900">
          Manage Campaigns
        </h2>

        {campaigns.map((c) => {
          const isActive = c.status === "ACTIVE";
          const summary = summaryData[c.id];
          const status = getDistributionStatus(summary);

          const statusColor =
            status === "DONE"
              ? "bg-emerald-50 text-emerald-600"
              : status === "PARTIAL"
              ? "bg-amber-50 text-amber-600"
              : "bg-sky-50 text-sky-600";

          return (
            <div
              key={c.id}
              className="mb-4 rounded-xl border border-slate-200 bg-white transition hover:shadow-md"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {c.campaign_name}
                  </p>

                  <div className="mt-2 flex gap-2">
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {c.status}
                    </span>

                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${statusColor}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className={
                      isActive
                        ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                        : "bg-teal-100 text-teal-700 hover:bg-teal-200"
                    }
                    onClick={() => toggleCampaign(c.id, c.status)}
                  >
                    {isActive ? "Deactivate" : "Activate"}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleDistribute(c.id)}
                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  >
                    Distribute Data
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      if (expandedId === c.id) {
                        setExpandedId(null);
                      } else {
                        loadSummary(c.id);
                        setExpandedId(c.id);
                      }
                    }}
                    className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    {expandedId === c.id ? "Hide" : "View"} Summary
                  </Button>
                </div>
              </div>

              {expandedId === c.id && summary && (
                <div className="border-t bg-slate-50 px-4 py-4">
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-sm text-slate-600">
                        Total Data Uploaded
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        {summary.totalRecords}
                      </p>
                    </div>

                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-sm text-slate-600">
                        Total Agents Assigned
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        {summary.agents?.length || 0}
                      </p>
                    </div>

                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-sm text-slate-600">
                        Total Data Distributed
                      </p>
                      <p className="text-2xl font-bold text-emerald-500">
                        {summary.assignedRecords}
                      </p>
                    </div>

                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-sm text-slate-600">
                        Total Data Unassigned
                      </p>
                      <p className="text-2xl font-bold text-rose-500">
                        {summary.unassignedRecords}
                      </p>
                    </div>
                  </div>

                  {summary.agents && summary.agents.length > 0 && (
                    <div className="overflow-hidden rounded-lg border bg-white">
                      <div className="border-b bg-slate-100 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">
                          Per-Agent Allocation
                        </p>
                      </div>

                      <div className="divide-y">
                        {summary.agents.map((agent) => (
                          <div
                            key={agent.agent_id}
                            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {agent.firstName} {agent.lastName}
                              </p>
                              <p className="text-xs text-slate-500">
                                ID: {agent.agent_id}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-lg font-bold text-indigo-500">
                                {agent.allocated_count}
                              </p>
                              <p className="text-xs text-slate-500">
                                records allocated
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCampaigns;
