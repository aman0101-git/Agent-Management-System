import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";

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

  
  // Edit campaign
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

  // Upload file
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
      // ISSUE #3 FIX: Display rows uploaded from backend response
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-xl">
        <h2 className="mb-6 text-xl font-semibold text-slate-900">
          Campaign Management & Upload
        </h2>

        

        {/* CAMPAIGN LIST */}
        <div className="mb-8">
          <h3 className="mb-3 font-medium text-slate-800">
            Active Campaigns
          </h3>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="mb-2 flex items-center justify-between rounded-lg border bg-white px-3 py-2 shadow-sm"
              >
                {editId === c.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <Button
                      size="sm"
                      className="bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700"
                      onClick={() => handleEditSave(c.id)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-slate-700">
                      {c.campaign_name}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* UPLOAD SECTION */}
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400/40"
        >
          <option value="">Select Campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.campaign_name}
            </option>
          ))}
        </select>

        {/* FILE INPUT */}
        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 px-4 py-6 text-center transition hover:bg-teal-100">
          <span className="text-sm font-medium text-teal-700">
            Click to choose file
          </span>
          <span className="mt-1 text-xs text-slate-500">
            CSV or XLSX only
          </span>

          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="hidden"
          />
        </label>

        {file && (
          <p className="mb-4 text-sm text-slate-600">
            Selected file:{" "}
            <span className="font-medium">{file.name}</span>
          </p>
        )}

        <Button
          onClick={handleUpload}
          disabled={loading}
          className="bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-md"
        >
          {loading ? "Processing..." : "Upload File"}
        </Button>

        {/* FEEDBACK */}
        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadData;
