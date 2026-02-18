import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Save, 
  X,
  Database,
  Megaphone
} from "lucide-react";
import axios from "axios";
import AdminNavbar from "../../components/AdminNavbar";

const UploadData = () => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [file, setFile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/campaigns",
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

  const handleEditSave = async (id) => {
    if (!editName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    try {
      await axios.patch(
        `http://localhost:5000/api/campaigns/${id}`,
        { campaign_name: editName },
        { headers }
      );
      setEditId(null);
      setEditName("");
      fetchCampaigns();
      setMessage("Campaign updated");
    } catch {
      setError("Update failed");
    }
  };

  const handleUpload = async () => {
    if (!file || !campaignId) {
      setError("Select campaign and file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("campaign_id", campaignId);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:5000/api/data/ingest",
        formData,
        { headers }
      );
      const rowsUploaded = res.data.rowsUploaded || 0;
      const successMsg = rowsUploaded > 0 
        ? `${rowsUploaded} rows uploaded successfully`
        : res.data.message || "Upload completed";
      setMessage(successMsg);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900">
      <AdminNavbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-600" />
            Data Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View active campaigns and ingest new loan data.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Left Column: Active Campaigns List */}
          <Card className="shadow-md border-slate-200 h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Megaphone className="h-5 w-5 text-indigo-500" />
                Active Campaigns
              </CardTitle>
              <CardDescription>Manage names of existing campaigns.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
                {campaigns.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8 italic">No active campaigns found.</p>
                ) : (
                  campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="group flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 hover:border-indigo-100 hover:shadow-sm transition-all"
                    >
                      {editId === c.id ? (
                        <div className="flex flex-1 items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-sm flex-1"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => handleEditSave(c.id)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-rose-500"
                            onClick={() => setEditId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900">
                            {c.campaign_name}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity"
                            onClick={() => {
                              setEditId(c.id);
                              setEditName(c.campaign_name);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Upload Form */}
          <Card className="shadow-md border-slate-200 h-fit">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <UploadCloud className="h-5 w-5 text-teal-600" />
                Ingest Data
              </CardTitle>
              <CardDescription>Upload CSV/XLSX files to a campaign.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Campaign Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Select Target Campaign</label>
                <Select 
                  value={campaignId} 
                  onValueChange={setCampaignId}
                >
                  <SelectTrigger className="w-full bg-white border-slate-300 focus:ring-2 focus:ring-teal-500/20">
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

              {/* File Drop Zone */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data File</label>
                <label 
                  className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition-all cursor-pointer ${
                    file 
                      ? "border-teal-400 bg-teal-50/30" 
                      : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400"
                  }`}
                >
                  <div className={`p-3 rounded-full mb-3 transition-colors ${file ? "bg-teal-100 text-teal-600" : "bg-slate-200 text-slate-500 group-hover:bg-white group-hover:text-indigo-500 group-hover:shadow-sm"}`}>
                    {file ? <FileText className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
                  </div>
                  
                  <span className="text-sm font-medium text-slate-700 text-center">
                    {file ? file.name : "Click to select file"}
                  </span>
                  
                  {!file && (
                    <span className="mt-1 text-xs text-slate-400">
                      Supports .csv and .xlsx
                    </span>
                  )}

                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Feedback Messages */}
              {message && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 animate-in fade-in slide-in-from-top-1">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {message}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleUpload}
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md transition-all h-11"
              >
                {loading ? "Processing..." : "Upload Data File"}
              </Button>

            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default UploadData;