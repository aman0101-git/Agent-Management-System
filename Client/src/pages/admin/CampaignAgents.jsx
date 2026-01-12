import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const CampaignAgents = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [error, setError] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [assignedAgents, setAssignedAgents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/campaigns", { headers });
      setCampaigns(res.data);
    } catch {
      setError("Failed to load campaigns");
    }
  };

  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line
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

  const handleSaveAndRedirect = () => {
    if (!selectedCampaign) {
      setError("Please select a campaign before saving");
      return;
    }

    // Data is already saved via assign/remove APIs
    navigate("/admin/dashboard");
  };

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      setError("Campaign name required");
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        "http://localhost:5000/api/campaigns",
        { campaign_name: newCampaignName },
        { headers }
      );
      setNewCampaignName("");
      setShowCreate(false);
      fetchCampaigns();
      setMessage("Campaign created successfully");
    } catch {
      setError("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6">

      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-xl">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* CREATE CAMPAIGN - moved from UploadData */}
      <div className="mb-6">
        {!showCreate ? (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-green-200 text-black-700 hover:bg-green-300"
          >
            Create Campaign
          </Button>
        ) : (
          <div className="flex gap-2">
            <input
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="Campaign name"
              className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400/40"
            />
            <Button
              onClick={handleCreateCampaign}
              className="bg-blue-400 text-white hover:bg-blue-500 active:bg-blue-600"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        )}
        {message && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}
      </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            Campaign Agent Allocation
          </h2>

          <Button
            className="bg-blue-400 text-white hover:bg-blue-500 active:bg-blue-600"
            onClick={handleSaveAndRedirect}
          >
            Save
          </Button>
        </div>

        {/* Active Campaigns - fixed height, scrollable */}
        <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          <select
            className="w-full bg-transparent px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 transition outline-none"
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
        </div>

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
