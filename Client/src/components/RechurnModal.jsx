import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";

/* ===============================
   Disposition Options
   =============================== */
const RECHURN_DISPOSITIONS = [
  "RTP",
  "TPC",
  "LNB",
  "VOI",
  "RNR",
  "SOW",
  "OOS",
  "WRN",
];

const RechurnModal = ({ campaignId, isOpen, onClose, onSuccess }) => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [rechurnData, setRechurnData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rechurning, setRechurning] = useState(false);

  /* 🔹 Multi-select disposition filter */
  const [selectedDispositions, setSelectedDispositions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadRechurnData();
    }
  }, [isOpen]);

  const loadRechurnData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        `http://localhost:5000/api/campaigns/${campaignId}/rechurn-data`,
        { headers }
      );
      setRechurnData(res.data.rechurnData || []);
    } catch {
      setError("Failed to load rechurn data");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     Filtered data (multi-select)
     =============================== */
  const filteredRechurnData =
    selectedDispositions.length === 0
      ? rechurnData
      : rechurnData.filter((d) =>
          selectedDispositions.includes(d.disposition)
        );

  /* Reset selection when filter changes */
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDispositions]);

  const toggleDispositionFilter = (value) => {
    setSelectedDispositions((prev) =>
      prev.includes(value)
        ? prev.filter((d) => d !== value)
        : [...prev, value]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRechurnData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(filteredRechurnData.map((d) => d.case_id))
      );
    }
  };

  const toggleSelect = (caseId) => {
    const newSet = new Set(selectedIds);
    newSet.has(caseId) ? newSet.delete(caseId) : newSet.add(caseId);
    setSelectedIds(newSet);
  };

  const handleRechurn = async () => {
    if (selectedIds.size === 0) {
      setError("Please select at least one record to rechurn");
      return;
    }

    setRechurning(true);
    setError("");
    try {
      const res = await axios.post(
        `http://localhost:5000/api/campaigns/${campaignId}/rechurn`,
        { selectedIds: Array.from(selectedIds) },
        { headers }
      );

      alert(res.data.message || "Data rechurned successfully");
      loadRechurnData();
      setSelectedIds(new Set());
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to rechurn data");
    } finally {
      setRechurning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[90vh] w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            Rechurn Data
          </h2>
          <button onClick={onClose} className="text-2xl text-slate-400">
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded bg-rose-50 px-4 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}

        {loading && (
          <p className="mb-4 text-sm text-slate-500">Loading…</p>
        )}

        {/* ===============================
           Multi-select Disposition Filter
           =============================== */}
        <div className="mb-4 rounded-lg border bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Filter by Disposition
          </p>
          <div className="flex flex-wrap gap-3">
            {RECHURN_DISPOSITIONS.map((d) => (
              <label
                key={d}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedDispositions.includes(d)}
                  onChange={() => toggleDispositionFilter(d)}
                  className="h-4 w-4"
                />
                {d}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Showing {filteredRechurnData.length} of {rechurnData.length}
          </p>
        </div>

        {/* ===============================
           Table (always visible)
           =============================== */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={
                      filteredRechurnData.length > 0 &&
                      selectedIds.size === filteredRechurnData.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Loan ID</th>
                <th className="px-4 py-2 text-left">Agent</th>
                <th className="px-4 py-2 text-left">Disposition</th>
                <th className="px-4 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredRechurnData.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No records match the selected disposition(s)
                  </td>
                </tr>
              ) : (
                filteredRechurnData.map((r) => (
                  <tr key={r.case_id} className="border-t">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.case_id)}
                        onChange={() => toggleSelect(r.case_id)}
                      />
                    </td>
                    <td className="px-4 py-2">{r.customer_name}</td>
                    <td className="px-4 py-2">{r.phone}</td>
                    <td className="px-4 py-2">{r.loan_id}</td>
                    <td className="px-4 py-2">
                      {r.last_agent_first_name} {r.last_agent_last_name}
                    </td>
                    <td className="px-4 py-2">{r.disposition}</td>
                    <td className="px-4 py-2 text-xs">
                      {new Date(r.last_disposition_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            onClick={onClose}
            className="bg-slate-200 text-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRechurn}
            disabled={selectedIds.size === 0 || rechurning}
            className={
              selectedIds.size === 0 || rechurning
                ? "bg-slate-300 text-slate-600"
                : "bg-indigo-600 text-white"
            }
          >
            {rechurning ? "Rechurning..." : "Rechurn Selected"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RechurnModal;
