import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileSpreadsheet, Calendar, Download, AlertCircle } from "lucide-react";
import { fetchMonitoringAgents, fetchMonitoringCampaigns } from "@/api/adminApi";

const FileExports = () => {
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  /* Filter Options State */
  const [agentsList, setAgentsList] = useState([]);
  const [campaignsList, setCampaignsList] = useState([]);
  
  /* Selected Filters State */
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);

  /* Fetch Agents and Campaigns on Mount */
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        if (token) {
          const [agentsData, campaignsData] = await Promise.all([
            fetchMonitoringAgents(token),
            fetchMonitoringCampaigns(token),
          ]);
          setAgentsList(agentsData || []);
          setCampaignsList(campaignsData || []);
        }
      } catch (error) {
        console.error("Failed to load filter options", error);
      }
    };

    fetchFilters();
  }, [token]);

  /* ===============================
     FILTER TOGGLE HANDLERS
     =============================== */
  const toggleAgent = (id) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((agentId) => agentId !== id) : [...prev, id]
    );
  };

  const toggleCampaign = (id) => {
    setSelectedCampaigns((prev) =>
      prev.includes(id) ? prev.filter((campId) => campId !== id) : [...prev, id]
    );
  };

  const selectAllAgents = () => {
    if (selectedAgents.length === agentsList.length) setSelectedAgents([]);
    else setSelectedAgents(agentsList.map(a => a.id));
  };

  const selectAllCampaigns = () => {
    if (selectedCampaigns.length === campaignsList.length) setSelectedCampaigns([]);
    else setSelectedCampaigns(campaignsList.map(c => c.id));
  };

  /* ===============================
     MASTER EXPORT HANDLER
     =============================== */
  const handleMasterExport = async () => {
    setLoading(true);
    setError("");
    try {
      // Build Query String
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);
      if (selectedAgents.length > 0) params.append("agents", selectedAgents.join(","));
      if (selectedCampaigns.length > 0) params.append("campaigns", selectedCampaigns.join(","));

      const res = await fetch(`http://localhost:5000/api/admin/exports/master?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to generate the master report.");
      }

      const blob = await res.blob();
      const fileName =
        res.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "Filtered_Master_Report.xlsx";

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.message || "Failed to export data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AdminNavbar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            System Data Export
          </h1>
          <p className="mt-2 text-slate-500">
            Download the comprehensive master report containing all customer records, constraints, and dynamic call histories.
          </p>
        </div>

        <Card className="border-slate-200 shadow-lg max-w-2xl mx-auto transition-all">
          <CardHeader className="pb-4 items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">Master Customer Report</CardTitle>
            <CardDescription className="text-base mt-2">
              Every row represents a unique customer. The columns will dynamically expand to show every disposition attempt made by agents, along with PTP/PRT verification flags.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            
            {/* Filters Section */}
            <div className="mb-6 space-y-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              
              {/* Date Range Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> From Date
                  </label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> To Date
                  </label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Multi-Select Filters */}
              <div className="grid grid-cols-2 gap-4">
                {/* Agents */}
                <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Filter Agents</label>
                    <button onClick={selectAllAgents} className="text-[10px] text-indigo-600 font-medium hover:underline">
                      {selectedAgents.length === agentsList.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                    {agentsList.map(a => (
                      <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:bg-slate-100 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={selectedAgents.includes(a.id)}
                          onChange={() => toggleAgent(a.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        {a.firstName || a.username}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Campaigns */}
                <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Filter Campaigns</label>
                    <button onClick={selectAllCampaigns} className="text-[10px] text-indigo-600 font-medium hover:underline">
                      {selectedCampaigns.length === campaignsList.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                    {campaignsList.map(c => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:bg-slate-100 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={selectedCampaigns.includes(c.id)}
                          onChange={() => toggleCampaign(c.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        {c.campaign_name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 flex items-center justify-center gap-2 rounded-md bg-rose-50 p-4 text-sm font-medium text-rose-600 border border-rose-100">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}
            
            <Button
              onClick={handleMasterExport}
              disabled={loading}
              className="w-full h-14 text-lg font-medium bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all rounded-xl"
            >
              {loading ? (
                <>
                  <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Generating Master File...
                </>
              ) : (
                <>
                  <Download className="mr-3 h-5 w-5" />
                  Download Filtered Data
                </>
              )}
            </Button>
            
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FileExports;