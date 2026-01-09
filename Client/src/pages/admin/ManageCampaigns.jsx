import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import RechurnModal from "@/components/RechurnModal";
import axios from "axios";
import { fetchCampaignDistributionSummary } from "@/api/campaignApi";

const ManageCampaigns = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [summaryData, setSummaryData] = useState({});
  const [rechurnModalOpen, setRechurnModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [targetAmount, setTargetAmount] = useState({});
  const [settingTarget, setSettingTarget] = useState({});
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [agentTargetAmount, setAgentTargetAmount] = useState({});
  const [settingAgentTarget, setSettingAgentTarget] = useState({});
  const [agentTargets, setAgentTargets] = useState({});
  const [editingAgent, setEditingAgent] = useState(null);

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
    let mounted = true;
    const headersLocal = { Authorization: `Bearer ${token}` };

    (async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/campaigns/all",
          { headers: headersLocal }
        );
        if (!mounted) return;
        setCampaigns(res.data);
      } catch {
        if (!mounted) return;
        setError("Failed to load campaigns");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    const loadAgentTargets = async () => {
      try {
        const month = new Date().toISOString().slice(0, 7);

        const res = await axios.get(
          `http://localhost:5000/api/admin/agent-targets?month=${month}`,
          { headers }
        );

        const map = {};
        res.data.targets.forEach((row) => {
          map[row.agent_id] = row.target_amount;
        });

        setAgentTargets(map);
      } catch (err) {
        console.error("Failed to load agent targets", err);
      }
    };

    // ISSUE #4 FIX: Load targets whenever campaigns change to ensure fresh data
    if (token && campaigns.length > 0) {
      loadAgentTargets();
    }
  }, [token, campaigns]);

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

  const handleRechurnClick = (campaignId) => {
    setSelectedCampaignId(campaignId);
    setRechurnModalOpen(true);
  };

  const handleRechurnSuccess = () => {
    // Refresh campaigns and summary data
    fetchCampaigns();
    if (selectedCampaignId && expandedId === selectedCampaignId) {
      loadSummary(selectedCampaignId);
    }
  };

  const handleSetTarget = async (campaignId) => {
    try {
      const amount = Number(targetAmount[campaignId]);

      if (!amount || amount <= 0) {
        setError("Please enter a valid target amount");
        return;
      }

      setSettingTarget((prev) => ({ ...prev, [campaignId]: true }));

      await axios.post(
        `http://localhost:5000/api/campaigns/${campaignId}/set-target`,
        { target_amount: amount },
        { headers }
      );

      // ✅ Keep editing mode active
      // ✅ Keep the value in the input so admin can see what was set

      // Refresh campaigns so c.target_amount updates
      await fetchCampaigns();

      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to set campaign target");
    } finally {
      setSettingTarget((prev) => ({ ...prev, [campaignId]: false }));
    }
  };

  const handleSetAgentTarget = async (agentId) => {
    try {
      const amount = Number(agentTargets[agentId]);

      if (!amount || amount <= 0) {
        setError("Please enter a valid target amount for agent");
        return;
      }

      setSettingAgentTarget((prev) => ({ ...prev, [agentId]: true }));

      const month = new Date().toISOString().slice(0, 7); // YYYY-MM


      await axios.post(
        `http://localhost:5000/api/admin/agent-targets`,
        { agentId, month, targetAmount: amount },
        { headers }
      );

      // update local state so view mode shows saved target
      setAgentTargets((prev) => ({ ...prev, [agentId]: amount }));

      // exit edit mode for this agent
      setEditingAgent(null);

      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to set agent target");
    } finally {
      setSettingAgentTarget((prev) => ({ ...prev, [agentId]: false }));
    }
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

                    {c.target_amount && (
                      <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-600">
                        Target: ₹{c.target_amount.toLocaleString()}
                      </span>
                    )}
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

                  {/* Distribution now happens automatically on data ingest */}

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

                  <div className="mb-4 flex justify-between items-end gap-4">
                    

                    <Button
                      onClick={() => handleRechurnClick(c.id)}
                      className="bg-orange-100 text-orange-700 hover:bg-orange-200"
                    >
                      RECHURN
                    </Button>
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

                            <div className="text-right flex flex-col items-end gap-2">
                              <div>
                                <p className="text-lg font-bold text-indigo-500">
                                  {agent.allocated_count}
                                </p>
                                <p className="text-xs text-slate-500">
                                  records allocated
                                </p>
                              </div>

                            {editingAgent !== agent.agent_id ? (
                              <div className="flex items-center gap-3 bg-purple-50 px-4 py-3 rounded-lg">
                                <div>
                                  <p className="text-xs text-slate-600">Monthly Target</p>
                                  <p className="text-2xl font-bold text-purple-700">
                                    ₹{(agentTargets[agent.agent_id] ?? 0).toLocaleString("en-IN")}
                                  </p>
                                </div>

                                <Button
                                  size="sm"
                                  className="bg-purple-600 text-white hover:bg-purple-700"
                                  onClick={() => setEditingAgent(agent.agent_id)}
                                >
                                  Edit Target
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={agentTargets[agent.agent_id] ?? ""}
                                  onChange={(e) =>
                                    setAgentTargets((prev) => ({
                                      ...prev,
                                      [agent.agent_id]: e.target.value,
                                    }))
                                  }
                                  className="w-36 rounded-lg border border-purple-200 px-2 py-1 text-sm"
                                />

                                <Button
                                  onClick={() => handleSetAgentTarget(agent.agent_id)}
                                  disabled={settingAgentTarget[agent.agent_id]}
                                  className="bg-purple-600 text-white hover:bg-purple-700"
                                  size="sm"
                                >
                                  {settingAgentTarget[agent.agent_id] ? "Setting..." : "Set Target"}
                                </Button>
                              </div>
                            )}

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

      <RechurnModal
        campaignId={selectedCampaignId}
        isOpen={rechurnModalOpen}
        onClose={() => setRechurnModalOpen(false)}
        onSuccess={handleRechurnSuccess}
      />
    </div>
  );
};

export default ManageCampaigns;