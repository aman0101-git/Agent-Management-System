import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";

const CampaignAgents = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [error, setError] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [assignedAgents, setAssignedAgents] = useState([]);

  useEffect(() => {
    const headersLocal = { Authorization: `Bearer ${token}` };
    axios
      .get("http://localhost:5000/api/campaigns", { headers: headersLocal })
      .then((res) => setCampaigns(res.data))
      .catch(() => setError("Failed to load campaigns"));
  }, [token]);

  useEffect(() => {
    const headersLocal = { Authorization: `Bearer ${token}` };
    axios
      .get("http://localhost:5000/api/users?role=AGENT&isActive=true", { headers: headersLocal })
      .then((res) => setAgents(res.data))
      .catch(() => setError("Failed to load agents"));
  }, [token]);

  const loadAssignedAgents = async (campaignId) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/campaigns/${campaignId}/agents`,
        { headers }
      );
      setAssignedAgents(res.data);
    } catch {
      setError("Failed to load assigned agents");
    }
  };

  const assignAgent = async (agentId) => {
    try {
      await axios.post(
        `http://localhost:5000/api/campaigns/${selectedCampaign}/agents`,
        { agentId },
        { headers }
      );
      loadAssignedAgents(selectedCampaign);
    } catch {
      setError("Failed to assign agent");
    }
  };

  const removeAgent = async (agentId) => {
    try {
      await axios.delete(
        `http://localhost:5000/api/campaigns/${selectedCampaign}/agents/${agentId}`,
        { headers }
      );
      loadAssignedAgents(selectedCampaign);
    } catch {
      setError("Failed to remove agent");
    }
  };

  const isAgentAssigned = (agentId) =>
    assignedAgents.some((a) => a.id === agentId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">
          Campaign Agent Allocation
        </h2>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Campaign selector */}
        <select
          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 transition"
          value={selectedCampaign}
          onChange={(e) => {
            setSelectedCampaign(e.target.value);
            loadAssignedAgents(e.target.value);
          }}
        >
          <option value="">Select Campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.campaign_name}
            </option>
          ))}
        </select>

        {selectedCampaign && (
          <>
            {/* Assigned Agents */}
            <h3 className="mt-8 mb-3 font-medium text-slate-800">
              Assigned Agents
            </h3>

            {assignedAgents.length === 0 && (
              <p className="text-sm text-slate-500 mb-4">
                No agents assigned yet
              </p>
            )}

            {assignedAgents.map((a) => (
              <div
                key={a.id}
                className="mb-2 flex items-center justify-between rounded-lg border bg-white px-3 py-2 shadow-sm hover:shadow-md transition"
              >
                <span className="font-medium text-slate-700">
                  {a.firstName} {a.lastName}
                </span>
                <Button
                  size="sm"
                  className="bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800"
                  onClick={() => removeAgent(a.id)}
                >
                  Remove
                </Button>
              </div>
            ))}

            {/* All Agents */}
            <h3 className="mt-8 mb-3 font-medium text-slate-800">
              All Agents
            </h3>

            {agents.map((a) => {
              const assigned = isAgentAssigned(a.id);

              return (
                <div
                  key={a.id}
                  className="mb-2 flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2"
                >
                  <span className="text-slate-700">
                    {a.firstName} {a.lastName}
                  </span>

                  {assigned ? (
                    <Button size="sm" disabled variant="outline">
                      Added
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800"
                      onClick={() => assignAgent(a.id)}
                    >
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default CampaignAgents;
