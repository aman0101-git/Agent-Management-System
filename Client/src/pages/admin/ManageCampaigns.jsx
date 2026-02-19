import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import RechurnModal from "@/components/RechurnModal";
import axios from "axios";
import { fetchCampaignDistributionSummary } from "@/api/campaignApi";
import AdminNavbar from "../../components/AdminNavbar";
import { 
  Megaphone, 
  Target, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Users, 
  Database, 
  CheckCircle2, 
  XCircle,
  Play,
  Pause,
  Edit2,
  Save,
  X
} from "lucide-react";

const ManageCampaigns = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [summaryData, setSummaryData] = useState({});
  const [rechurnModalOpen, setRechurnModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  
  // Campaign Target States
  const [targetAmount, setTargetAmount] = useState({});
  const [settingTarget, setSettingTarget] = useState({});
  const [editingCampaign, setEditingCampaign] = useState(null);

  // Agent Target States
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

      await fetchCampaigns();
      setEditingCampaign(null);
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

      const month = new Date().toISOString().slice(0, 7);

      await axios.post(
        `http://localhost:5000/api/admin/agent-targets`,
        { agentId, month, targetAmount: amount },
        { headers }
      );

      setAgentTargets((prev) => ({ ...prev, [agentId]: amount }));
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      <AdminNavbar />
      
      <main className="mx-auto max-w-5xl px-4 py-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-indigo-600" />
            Campaign Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor status, set financial targets, and manage data distribution.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {campaigns.map((c) => {
            const isActive = c.status === "ACTIVE";
            const summary = summaryData[c.id];
            const status = getDistributionStatus(summary);
            const isExpanded = expandedId === c.id;

            // Status Colors
            const statusBadgeVariant = status === "DONE" ? "success" : status === "PARTIAL" ? "warning" : "secondary";
            const statusClasses = 
              status === "DONE" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" :
              status === "PARTIAL" ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
              "bg-sky-100 text-sky-700 hover:bg-sky-200";

            return (
              <Card 
                key={c.id} 
                className={`transition-all duration-200 border-slate-200 shadow-sm hover:shadow-md ${isExpanded ? 'ring-1 ring-indigo-500 border-indigo-200' : ''}`}
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left: Campaign Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {c.campaign_name}
                        </h3>
                        <Badge 
                          variant={isActive ? "default" : "secondary"}
                          className={`${isActive ? "bg-emerald-200 hover:bg-emerald-300" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
                        >
                          {c.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant={isActive ? "outline" : "default"}
                        className={isActive 
                          ? "border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" 
                          : "bg-teal-600 text-white hover:bg-teal-700"
                        }
                        onClick={() => toggleCampaign(c.id, c.status)}
                      >
                        {isActive ? (
                          <> <Pause className="mr-2 h-4 w-4" /> Deactivate </>
                        ) : (
                          <> <Play className="mr-2 h-4 w-4" /> Activate </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedId(null);
                          } else {
                            loadSummary(c.id);
                            setExpandedId(c.id);
                          }
                        }}
                        className={`text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 ${isExpanded ? 'bg-indigo-50 text-indigo-700' : ''}`}
                      >
                        {isExpanded ? "Hide Details" : "View Summary"}
                        {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && summary && (
                  <div className="bg-slate-50/80 border-t border-slate-200 animate-in slide-in-from-top-2 duration-300">
                    <div className="p-6">
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Database className="h-3 w-3" /> Total Data
                          </span>
                          <span className="text-2xl font-bold text-slate-900 mt-1">{summary.totalRecords}</span>
                        </div>
                        
                        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-3 opacity-10">
                            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                          </div>
                          <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Distributed</span>
                          <span className="text-2xl font-bold text-emerald-700 mt-1">{summary.assignedRecords}</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex flex-col relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-3 opacity-10">
                            <XCircle className="h-12 w-12 text-rose-500" />
                          </div>
                          <span className="text-xs font-medium text-rose-600 uppercase tracking-wider">Unassigned</span>
                          <span className="text-2xl font-bold text-rose-700 mt-1">{summary.unassignedRecords}</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex flex-col">
                          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                            <Users className="h-3 w-3" /> Active Agents
                          </span>
                          <span className="text-2xl font-bold text-indigo-700 mt-1">{summary.agents?.length || 0}</span>
                        </div>
                      </div>

                      {/* Rechurn Action */}
                      <div className="flex justify-end mb-6">
                        <Button 
                          onClick={() => handleRechurnClick(c.id)}
                          className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Rechurn Unassigned Data
                        </Button>
                      </div>

                      {/* Agents List */}
                      {summary.agents && summary.agents.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h4 className="text-sm font-semibold text-slate-700">Agent Performance & Targets</h4>
                          </div>
                          
                          <div className="divide-y divide-slate-100">
                            {summary.agents.map((agent) => (
                              <div key={agent.agent_id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                
                                {/* Agent Info */}
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100 text-sm">
                                    {agent.firstName?.[0]}{agent.lastName?.[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{agent.firstName} {agent.lastName}</p>
                                    <p className="text-xs text-slate-500 font-mono">ID: {agent.agent_id}</p>
                                  </div>
                                </div>

                                {/* Allocation & Target */}
                                <div className="flex items-center gap-6 md:gap-10">
                                  <div className="text-right">
                                    <p className="text-xs text-slate-500 mb-0.5">Allocated</p>
                                    <p className="text-lg font-bold text-indigo-600">{agent.allocated_count}</p>
                                  </div>

                                  <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
                                    <div className="text-right">
                                      <p className="text-xs text-slate-500 mb-0.5">Monthly Target</p>
                                      {editingAgent === agent.agent_id ? (
                                        <div className="flex items-center gap-2">
                                          <Input 
                                            type="number"
                                            className="h-8 w-24 px-2 text-sm"
                                            value={agentTargets[agent.agent_id] ?? ""}
                                            onChange={(e) => setAgentTargets(prev => ({ ...prev, [agent.agent_id]: e.target.value }))}
                                            autoFocus
                                          />
                                          <Button 
                                            size="icon" 
                                            className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700"
                                            disabled={settingAgentTarget[agent.agent_id]}
                                            onClick={() => handleSetAgentTarget(agent.agent_id)}
                                          >
                                            <CheckCircle2 className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-8 w-8 text-slate-400"
                                            onClick={() => setEditingAgent(null)}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-end gap-2 group cursor-pointer" onClick={() => setEditingAgent(agent.agent_id)}>
                                          <p className="text-lg font-bold text-slate-800">
                                            ₹{(agentTargets[agent.agent_id] ?? 0).toLocaleString("en-IN")}
                                          </p>
                                          <Edit2 className="h-3 w-3 text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </main>

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