import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchAgentCases, fetchNextCase } from "@/api/agentApi";
import CustomerDetailDrawer from "@/components/CustomerDetailDrawer";
import AgentNavbar from "@/components/AgentNavbar"; // Import the new navbar

const AgentDashboard = () => {
  const [fetchingNext, setFetchingNext] = useState(false);
  const { token } = useAuth(); // Removed user & logout since Navbar handles them

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const loadCases = async () => {
      try {
        const res = await fetchAgentCases(token);
        const data = res.data || [];
        setCases(data);
        setFilteredCases(data);

        if (!data.length) {
          try {
            const nextRes = await fetchNextCase(token);
            if (nextRes.status === 200 && nextRes.data?.caseId) {
              const r2 = await fetchAgentCases(token);
              const newData = r2.data || [];
              setCases(newData);
              setFilteredCases(newData);
              setSelectedCaseId(nextRes.data.caseId);
              setDrawerOpen(true);
            }
          } catch (e) {
            console.debug("No next case allocated or error", e);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadCases();
    window.__reloadAgentCases = loadCases;
  }, [token]);

  useEffect(() => {
    if (!search) {
      setFilteredCases(cases);
    } else {
      setFilteredCases(
        cases.filter(
          (c) =>
            String(c.phone || "").includes(search) ||
            String(c.customer_name || "")
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            String(c.loan_id || "").includes(search)
        )
      );
    }
  }, [search, cases]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "-";
    return timeStr.substring(0, 5);
  };

  const getStatusBadge = (status) => {
    const baseClass = "px-2 py-1 rounded-full text-xs font-medium";
    if (status === "NEW") {
      return `${baseClass} bg-blue-100 text-blue-700`;
    } else if (status === "DONE") {
      return `${baseClass} bg-green-100 text-green-700`;
    }
    return `${baseClass} bg-slate-100 text-slate-700`;
  };

  const getFollowUpRowColor = (caseItem) => {
    if (caseItem.status !== "FOLLOW_UP" || !caseItem.follow_up_date) {
      return "";
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUpDate = new Date(caseItem.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    if (followUpDate < today) return "bg-red-50 hover:bg-red-100";
    if (followUpDate.getTime() === today.getTime()) return "bg-amber-50 hover:bg-amber-100";
    return "";
  };

  const getFollowUpPriority = (caseItem) => {
    if (caseItem.status !== "FOLLOW_UP" || !caseItem.follow_up_date) return 3;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUpDate = new Date(caseItem.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    if (followUpDate < today) return 0;
    if (followUpDate.getTime() === today.getTime()) return 1;
    return 2;
  };

  const sortedCases = [...filteredCases].sort((a, b) => {
    const pA = getFollowUpPriority(a);
    const pB = getFollowUpPriority(b);
    if (pA !== pB) return pA - pB;
    if (a.status === "FOLLOW_UP" && b.status === "FOLLOW_UP") {
      const dateA = new Date(`${a.follow_up_date} ${a.follow_up_time || "00:00"}`);
      const dateB = new Date(`${b.follow_up_date} ${b.follow_up_time || "00:00"}`);
      return dateA - dateB;
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-50/50">
      
      {/* 1. New Agent Navbar */}
      <AgentNavbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        
        {/* Search & Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by name, phone, or loan ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pl-10 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-md hover:bg-blue-700 transition disabled:opacity-70 flex items-center justify-center gap-2"
            disabled={fetchingNext}
            onClick={async () => {
              setFetchingNext(true);
              try {
                const nextRes = await fetchNextCase(token);
                if (nextRes.status === 200 && nextRes.data?.caseId) {
                  if (typeof window.__reloadAgentCases === "function") {
                    await window.__reloadAgentCases();
                  }
                  setSelectedCaseId(nextRes.data.caseId);
                  setDrawerOpen(true);
                } else if (nextRes.status === 204) {
                  alert("No new customers available.");
                } else {
                  alert("Could not fetch next customer.");
                }
              } catch (e) {
                alert("Error fetching next customer.");
              } finally {
                setFetchingNext(false);
              }
            }}
          >
            {fetchingNext ? (
              <>Loading...</>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Get Next Customer
              </>
            )}
          </button>
        </div>

        {/* Table Container */}
        {!loading && sortedCases.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 bg-slate-50/80 px-6 py-3 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <div className="col-span-2">Customer Name</div>
                  <div className="col-span-2">Loan ID</div>
                  <div className="col-span-1">Phone</div>
                  <div className="col-span-1 text-center">Status</div>
                  <div className="col-span-1 text-right">Inst. Amt</div>
                  <div className="col-span-1 text-right">POS</div>
                  <div className="col-span-1 text-center">Bucket</div>
                  <div className="col-span-2">Follow-up</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-slate-100">
                  {sortedCases.map((caseItem) => (
                    <div 
                      key={caseItem.case_id}
                      onClick={() => {
                        setSelectedCaseId(caseItem.case_id);
                        setDrawerOpen(true);
                      }}
                      className={`grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm hover:bg-slate-50 cursor-pointer transition-colors ${getFollowUpRowColor(caseItem)}`}
                    >
                      <div className="col-span-2 font-medium text-slate-900 truncate">
                        {caseItem.customer_name || "-"}
                      </div>
                      <div className="col-span-2 text-slate-600 font-mono text-xs">
                        {caseItem.loan_id || "-"}
                      </div>
                      <div className="col-span-1 text-slate-600">
                        {caseItem.phone || "-"}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className={getStatusBadge(caseItem.status)}>
                          {caseItem.status}
                        </span>
                      </div>
                      <div className="col-span-1 text-right font-medium text-slate-700">
                        {caseItem.insl_amt || "-"}
                      </div>
                      <div className="col-span-1 text-right text-slate-600">
                        {caseItem.pos || "-"}
                      </div>
                      <div className="col-span-1 text-center text-slate-600">
                        {caseItem.bom_bucket || "-"}
                      </div>
                      <div className="col-span-2 text-xs text-slate-600">
                        {caseItem.follow_up_date ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">
                              {formatDate(caseItem.follow_up_date)}
                            </span>
                            <span>{formatTime(caseItem.follow_up_time)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                      <div className="col-span-1 text-right">
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase tracking-wide">
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">No allocations found.</p>
              <button 
                onClick={async () => {
                  setFetchingNext(true);
                  // ... logic to fetch next case
                  setFetchingNext(false);
                }}
                className="mt-4 text-blue-600 text-sm font-medium hover:underline"
              >
                Request new customer
              </button>
            </div>
          )
        )}
      </main>

      <CustomerDetailDrawer
        caseId={selectedCaseId}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedCaseId(null);
        }}
        onDispositionSubmitted={async (res) => {
          if (typeof window.__reloadAgentCases === "function") {
            await window.__reloadAgentCases();
          }
          if (res && (res.allocateNext || res.allocateNextOnStatusChange)) {
            try {
              const nextRes = await fetchNextCase(token);
              if (nextRes.status === 200 && nextRes.data?.caseId) {
                if (typeof window.__reloadAgentCases === "function") {
                  await window.__reloadAgentCases();
                }
                setSelectedCaseId(nextRes.data.caseId);
                setDrawerOpen(true);
                return;
              }
            } catch {}
          }
          setDrawerOpen(false);
          setSelectedCaseId(null);
        }}
      />
    </div>
  );
};

export default AgentDashboard;