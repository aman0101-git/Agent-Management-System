import { useState, useEffect, useMemo } from "react";
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

// Defined precise, non-overlapping POS buckets
const POS_RANGES = [
  { label: "0 - 10,000", min: 0, max: 9999 },
  { label: "10,000 - 30,000", min: 10000, max: 29999 },
  { label: "30,000 - 50,000", min: 30000, max: 49999 },
  { label: "50,000 - 1,00,000", min: 50000, max: 99999 },
  { label: "1,00,000 - 3,00,000", min: 100000, max: 299999 },
  { label: "3,00,000 - 5,00,000", min: 300000, max: 499999 },
  { label: "5,00,000+", min: 500000, max: Infinity },
];

const RechurnModal = ({ campaignId, isOpen, onClose, onSuccess }) => {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [rechurnData, setRechurnData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rechurning, setRechurning] = useState(false);

  /* 🔹 Multi-select filters */
  const [selectedDispositions, setSelectedDispositions] = useState([]);
  const [selectedBomBuckets, setSelectedBomBuckets] = useState([]);
  const [selectedPosRanges, setSelectedPosRanges] = useState([]); // New state for POS

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
        `http://192.168.1.14:5000/api/campaigns/${campaignId}/rechurn-data`,
        { headers }
      );
      setRechurnData(res.data.rechurnData || []);
    } catch {
      setError("Failed to load rechurn data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* Extract unique BOM Buckets dynamically from fetched data */
  const availableBomBuckets = useMemo(() => {
    const buckets = rechurnData.map((d) => d.bom_bucket).filter((b) => b != null);
    return [...new Set(buckets)].sort();
  }, [rechurnData]);

  /* Filtered data (multi-select combo) */
  const filteredRechurnData = useMemo(() => {
    return rechurnData.filter((d) => {
      // 1. Disposition Check
      const matchesDisposition =
        selectedDispositions.length === 0 || selectedDispositions.includes(d.disposition);
      
      // 2. BOM Bucket Check
      const matchesBucket =
        selectedBomBuckets.length === 0 || selectedBomBuckets.includes(d.bom_bucket);
      
      // 3. POS Range Check
      const matchesPos = selectedPosRanges.length === 0 || selectedPosRanges.some((rangeLabel) => {
        const range = POS_RANGES.find((r) => r.label === rangeLabel);
        // Assuming your backend sends the POS amount as `pos_amount`. Update if the key is different.
        const amount = Number(d.pos) || 0; 
        return range && amount >= range.min && amount <= range.max;
      });

      return matchesDisposition && matchesBucket && matchesPos;
    });
  }, [rechurnData, selectedDispositions, selectedBomBuckets, selectedPosRanges]);

  /* Reset selection when ANY filter changes */
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedDispositions, selectedBomBuckets, selectedPosRanges]);

  const toggleDispositionFilter = (value) => {
    setSelectedDispositions((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  const toggleBomBucketFilter = (value) => {
    setSelectedBomBuckets((prev) =>
      prev.includes(value) ? prev.filter((b) => b !== value) : [...prev, value]
    );
  };

  const togglePosRangeFilter = (value) => {
    setSelectedPosRanges((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRechurnData.length && filteredRechurnData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRechurnData.map((d) => d.case_id)));
    }
  };

  const toggleSelect = (caseId) => {
    const newSet = new Set(selectedIds);
    newSet.has(caseId) ? newSet.delete(caseId) : newSet.add(caseId);
    setSelectedIds(newSet);
  };

  const handleRechurn = async () => {
    if (selectedIds.size === 0) return;

    setRechurning(true);
    setError("");
    try {
      const res = await axios.post(
        `http://192.168.1.14:5000/api/campaigns/${campaignId}/rechurn`,
        { selectedIds: Array.from(selectedIds) },
        { headers }
      );

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Rechurn Campaign Data</h2>
            <p className="text-sm text-slate-500 mt-1">Filter and redistribute customer cases back to the agent pool.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="p-6 space-y-6">
            
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 flex items-center gap-3 text-rose-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Filters Section - Updated to grid-cols-3 */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Disposition Filter */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter by Disposition
                </p>
                <div className="flex flex-wrap gap-2">
                  {RECHURN_DISPOSITIONS.map((d) => {
                    const isSelected = selectedDispositions.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDispositionFilter(d)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          isSelected 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BOM Bucket Filter */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Filter by BOM Bucket
                </p>
                {availableBomBuckets.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No buckets available in current data.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableBomBuckets.map((bucket) => {
                      const isSelected = selectedBomBuckets.includes(bucket);
                      return (
                        <button
                          key={bucket}
                          onClick={() => toggleBomBucketFilter(bucket)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          Bucket {bucket}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* POS Amount Filter */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Filter by POS Amount
                </p>
                <div className="flex flex-wrap gap-2">
                  {POS_RANGES.map((range) => {
                    const isSelected = selectedPosRanges.includes(range.label);
                    return (
                      <button
                        key={range.label}
                        onClick={() => togglePosRangeFilter(range.label)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          isSelected 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {range.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Table Section */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              
              {/* Table Header Info */}
              <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  Showing <span className="font-bold text-slate-900">{filteredRechurnData.length}</span> matching records 
                  <span className="text-slate-400 font-normal ml-1">(Total: {rechurnData.length})</span>
                </p>
                {selectedIds.size > 0 && (
                  <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {selectedIds.size} Selected
                  </span>
                )}
              </div>

              {/* Actual Table */}
              <div className="overflow-x-auto relative">
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-medium">Loading data...</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-4 w-12">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={
                              filteredRechurnData.length > 0 &&
                              selectedIds.size === filteredRechurnData.length
                            }
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="px-5 py-4">Customer Name</th>
                        <th className="px-5 py-4">Phone Number</th>
                        <th className="px-5 py-4">Loan ID</th>
                        <th className="px-5 py-4">BOM Bucket</th>
                        <th className="px-5 py-4">POS Amount</th> {/* Added to match image */}
                        <th className="px-5 py-4">Last Agent</th>
                        <th className="px-5 py-4">Disposition</th>
                        <th className="px-5 py-4">Disposed On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRechurnData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-base font-medium text-slate-600">No records found</p>
                            <p className="text-sm mt-1">Try adjusting your filters above.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredRechurnData.map((r) => {
                          const isSelected = selectedIds.has(r.case_id);
                          return (
                            <tr 
                              key={r.case_id} 
                              className={`transition-colors hover:bg-slate-50 ${isSelected ? "bg-indigo-50/30" : ""}`}
                              onClick={() => toggleSelect(r.case_id)}
                            >
                              <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(r.case_id)}
                                />
                              </td>
                              <td className="px-5 py-3 font-medium text-slate-800">{r.customer_name}</td>
                              <td className="px-5 py-3 text-slate-600">{r.phone}</td>
                              <td className="px-5 py-3 text-slate-600 font-mono text-xs">{r.loan_id}</td>
                              <td className="px-5 py-3">
                                {r.bom_bucket ? (
                                  <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                                    Bucket {r.bom_bucket}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">N/A</span>
                                )}
                              </td>
                              <td className="px-5 py-3 font-medium text-slate-700">
                                {r.pos != null ? `₹${Number(r.pos).toLocaleString('en-IN')}` : <span className="text-slate-400 italic">N/A</span>}
                              </td>
                              <td className="px-5 py-3 text-slate-600">
                                {r.last_agent_first_name} {r.last_agent_last_name}
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                                  {r.disposition}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-500 text-xs">
                                {new Date(r.last_disposition_date).toLocaleDateString(undefined, {
                                  year: 'numeric', month: 'short', day: 'numeric'
                                })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-2xl">
          <Button
            onClick={onClose}
            variant="outline"
            className="text-slate-600 hover:bg-slate-50 border-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRechurn}
            disabled={selectedIds.size === 0 || rechurning}
            className={`min-w-[140px] ${
              selectedIds.size === 0 || rechurning
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200"
            }`}
          >
            {rechurning ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : (
              `Rechurn Selected (${selectedIds.size})`
            )}
          </Button>
        </div>

      </div>
    </div>
  );
};

export default RechurnModal;