import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { fetchAgentCases, fetchNextCase } from "@/api/agentApi";
import CustomerDetailDrawer from "@/components/CustomerDetailDrawer";

const AgentDashboard = () => {
  const { user, token, logout } = useAuth();

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);

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

  /* =====================================================
     FOLLOW-UP ROW COLOR LOGIC
     ===================================================== */
  const getFollowUpRowColor = (caseItem) => {
    if (caseItem.status !== "FOLLOW_UP" || !caseItem.follow_up_date) {
      return "";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const followUpDate = new Date(caseItem.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    if (followUpDate < today) {
      return "bg-red-50 hover:bg-red-100";
    }

    if (followUpDate.getTime() === today.getTime()) {
      return "bg-yellow-50 hover:bg-yellow-100";
    }

    return "";
  };

  /* =====================================================
     FOLLOW-UP PRIORITY SORTING (ADDED)
     ===================================================== */
  const getFollowUpPriority = (caseItem) => {
    if (caseItem.status !== "FOLLOW_UP" || !caseItem.follow_up_date) {
      return 3; // non-follow-up
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const followUpDate = new Date(caseItem.follow_up_date);
    followUpDate.setHours(0, 0, 0, 0);

    if (followUpDate < today) return 0; // red
    if (followUpDate.getTime() === today.getTime()) return 1; // yellow
    return 2; // future
  };

  /* =====================================================
     SORTED CASES (ADDED)
     ===================================================== */
  const sortedCases = [...filteredCases].sort((a, b) => {
    const pA = getFollowUpPriority(a);
    const pB = getFollowUpPriority(b);

    if (pA !== pB) return pA - pB;

    if (a.status === "FOLLOW_UP" && b.status === "FOLLOW_UP") {
      const dateA = new Date(
        `${a.follow_up_date} ${a.follow_up_time || "00:00"}`
      );
      const dateB = new Date(
        `${b.follow_up_date} ${b.follow_up_time || "00:00"}`
      );
      return dateA - dateB;
    }

    return 0;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Agent Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              {filteredCases.length} allocated accounts
            </p>
          </div>

          <Button
            onClick={logout}
            className="bg-rose-600 text-white hover:bg-rose-700 shadow-md"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <input
          type="text"
          placeholder="Search by name, phone, or loan ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
        />

        {!loading && sortedCases.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-4 bg-slate-50 px-4 py-3 border-b border-slate-200 text-sm font-semibold">
              <div className="col-span-2">Name</div>
              <div className="col-span-1">Phone</div>
              <div className="col-span-2">Loan ID</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Alloc. Date</div>
              <div className="col-span-1">Inst. Amt</div>
              <div className="col-span-1">POS</div>
              <div className="col-span-1">Follow-up</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {sortedCases.map((caseItem) => (
              <div key={caseItem.case_id}>
                <button
                  className={`w-full grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 text-sm text-left transition
                    ${getFollowUpRowColor(caseItem)}`}
                >
                  <div className="col-span-2 font-medium truncate">
                    {caseItem.customer_name || "-"}
                  </div>
                  <div className="col-span-1">{caseItem.phone || "-"}</div>
                  <div className="col-span-2">{caseItem.loan_id || "-"}</div>
                  <div className="col-span-1">
                    <span className={getStatusBadge(caseItem.status)}>
                      {caseItem.status}
                    </span>
                  </div>
                  <div className="col-span-1 text-xs">
                    {formatDate(caseItem.allocation_date)}
                  </div>
                  <div className="col-span-1 text-xs">
                    {caseItem.insl_amt || "-"}
                  </div>
                  <div className="col-span-1 text-xs">
                    {caseItem.pos || "-"}
                  </div>
                  <div className="col-span-1 text-xs">
                    {caseItem.follow_up_date
                      ? `${formatDate(
                          caseItem.follow_up_date
                        )} ${formatTime(caseItem.follow_up_time)}`
                      : "-"}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseId(caseItem.case_id);
                        setDrawerOpen(true);
                      }}
                      className="text-indigo-600 font-medium"
                    >
                      View
                    </button>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <CustomerDetailDrawer
        caseId={selectedCaseId}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedCaseId(null);
        }}
        onDispositionSubmitted={() => {
          if (typeof window.__reloadAgentCases === "function") {
            window.__reloadAgentCases();
          }
          setDrawerOpen(false);
          setSelectedCaseId(null);
        }}
      />
    </div>
  );
};

export default AgentDashboard;
