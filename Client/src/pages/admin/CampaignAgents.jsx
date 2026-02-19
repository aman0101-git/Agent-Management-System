import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  UserMinus,
  Briefcase,
  PlusCircle,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Megaphone
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";

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
  const [agentSearch, setAgentSearch] = useState(""); 
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
    navigate("/admin/dashboard");
  };

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
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setError("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.firstName.toLowerCase().includes(agentSearch.toLowerCase()) || 
    agent.lastName.toLowerCase().includes(agentSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex flex-col font-sans text-slate-900">
      <AdminNavbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: Campaign Selection & Creation */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-lg border-slate-200 h-full overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                  <Megaphone className="h-5 w-5 text-blue-600" />
                  Campaigns
                </CardTitle>
                <CardDescription className="text-blue-700/70">Select or create a campaign to manage.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                 {/* Create Campaign Toggle */}
                 {!showCreate ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700"
                    onClick={() => setShowCreate(true)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Campaign
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-indigo-900">New Campaign Name</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-500" onClick={() => setShowCreate(false)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                    <Input
                      placeholder="e.g. Personal Loans Q1"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      className="bg-slate-50 border-indigo-200 focus:ring-indigo-500"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end pt-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setShowCreate(false)}
                        className="text-slate-500"
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleCreateCampaign} 
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm"
                      >
                        {loading ? "Creating..." : "Save Campaign"}
                      </Button>
                    </div>
                  </div>
                )}

                <Separator className="bg-slate-100" />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Select Active Campaign</label>
                  <Select 
                    value={selectedCampaign} 
                    onValueChange={(val) => {
                      setSelectedCampaign(val);
                      loadAssignedAgents(val);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-300 focus:ring-2 focus:ring-emerald-500/20">
                      <SelectValue placeholder="Choose a campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.campaign_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {message && (
                  <Alert className="bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="font-medium">{message}</AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert className="bg-rose-50 text-rose-800 border-rose-200 shadow-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="border-t border-slate-100 bg-slate-50 p-6">
                 <Button 
                    className={`w-full text-white font-medium shadow-md transition-all ${
                      selectedCampaign 
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg" 
                      : "bg-slate-300 cursor-not-allowed"
                    }`}
                    onClick={handleSaveAndRedirect}
                    disabled={!selectedCampaign}
                 >
                    <Save className="mr-2 h-4 w-4" />
                    Finish & Return to Dashboard
                 </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Right Column: Agent Management */}
          <div className="lg:col-span-8 h-full">
            <Card className="h-full shadow-lg border-slate-200 flex flex-col overflow-hidden">
              <CardHeader className="bg-white border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Users className="h-5 w-5 text-indigo-600" />
                          </div>
                          Agent Allocation
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {selectedCampaign 
                                ? <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Editing: {campaigns.find(c => c.id.toString() === selectedCampaign)?.campaign_name}</span>
                                : "Select a campaign to begin managing agents."
                            }
                        </CardDescription>
                    </div>
                    {selectedCampaign && (
                         <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200 px-3 py-1 text-sm font-medium">
                            {assignedAgents.length} Agents Assigned
                         </Badge>
                    )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden relative">
                {!selectedCampaign ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                        <div className="bg-white p-6 rounded-full shadow-sm mb-4 border border-slate-100">
                            <Briefcase className="h-10 w-10 text-slate-300" />
                        </div>
                        <p className="text-lg font-semibold text-slate-600">No Campaign Selected</p>
                        <p className="text-sm text-slate-500 max-w-xs mt-2">Please select a campaign from the left panel to start assigning agents.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-slate-200">
                        
                        {/* Available Agents Section - TEAL THEME */}
                        <div className="flex flex-col h-full bg-slate-50/50">
                            <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                                <h3 className="text-sm font-bold text-teal-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <UserPlus className="h-4 w-4 text-teal-600" />
                                    Available Agents
                                </h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-teal-500" />
                                    <Input
                                        placeholder="Search available agents..."
                                        className="pl-9 h-9 bg-teal-50/30 border-teal-100 focus:bg-white focus:border-teal-400 focus:ring-teal-200 transition-all"
                                        value={agentSearch}
                                        onChange={(e) => setAgentSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2">
                                    {filteredAgents.filter(a => !isAgentAssigned(a.id)).length === 0 ? (
                                        <p className="text-sm text-center text-slate-400 py-10 italic">
                                            {agentSearch ? "No matching agents found." : "All active agents assigned."}
                                        </p>
                                    ) : (
                                        filteredAgents.map(agent => {
                                            if (isAgentAssigned(agent.id)) return null;
                                            return (
                                                <div 
                                                    key={agent.id} 
                                                    className="group flex items-center justify-between p-3 rounded-xl border border-white bg-white shadow-sm hover:border-teal-200 hover:shadow-md transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 text-xs font-bold border border-teal-100">
                                                            {agent.firstName[0]}{agent.lastName[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-slate-700 group-hover:text-teal-700">
                                                                {agent.firstName} {agent.lastName}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-mono">ID: {agent.id}</span>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-teal-500 rounded-full transition-all"
                                                        onClick={() => assignAgent(agent.id)}
                                                    >
                                                        <PlusCircle className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Assigned Agents Section - INDIGO THEME */}
                        <div className="flex flex-col h-full bg-white">
                            <div className="p-4 border-b border-indigo-100 bg-indigo-50/30 sticky top-0 z-10">
                                <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2 uppercase tracking-wide">
                                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                                    Assigned Team
                                </h3>
                                <p className="text-xs text-indigo-400 mt-1 font-medium">
                                    Agents active in this campaign.
                                </p>
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-2">
                                    {assignedAgents.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl m-2 bg-slate-50/50">
                                            <Users className="h-8 w-8 mb-2 opacity-20" />
                                            <p className="text-sm">No agents assigned yet.</p>
                                        </div>
                                    ) : (
                                        assignedAgents.map(agent => (
                                            <div 
                                                key={agent.id} 
                                                className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-indigo-600 text-xs font-bold border border-indigo-200 shadow-sm">
                                                        {agent.firstName[0]}{agent.lastName[0]}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-900">
                                                            {agent.firstName} {agent.lastName}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                            <span className="text-[10px] text-slate-500">Active</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                                                    onClick={() => removeAgent(agent.id)}
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
};

export default CampaignAgents;