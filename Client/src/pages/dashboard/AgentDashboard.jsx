import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { fetchAgentCases } from "@/api/agentApi";
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
        setCases(res.data || []);
        setFilteredCases(res.data || []);
      } finally {
        setLoading(false);
      }
    };
    loadCases();
    // expose loader for child callbacks
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
            String(c.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
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
    return baseClass;
  };

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
            className="bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-md"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name, phone, or loan ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-400/40"
        />

        {loading && <p className="text-slate-500">Loading customers…</p>}

        {!loading && filteredCases.length === 0 && (
          <p className="text-slate-500">No accounts found.</p>
        )}

        {!loading && filteredCases.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-4 bg-slate-50 px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
              <div className="col-span-2">Name</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2">Loan ID</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Alloc. Date</div>
              <div className="col-span-2">Follow-up</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {/* Data Rows */}
            {filteredCases.map((caseItem) => (
              <div key={caseItem.case_id}>
                {/* Main Row */}
                <button
                  onClick={() => {
                    if (expandedRowId === caseItem.case_id) {
                      setExpandedRowId(null);
                    } else {
                      setExpandedRowId(caseItem.case_id);
                    }
                  }}
                  className="w-full grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition text-sm text-left group"
                >
                  <div className="col-span-2 font-medium text-slate-900 truncate">
                    {caseItem.customer_name || "-"}
                  </div>
                  <div className="col-span-2 text-slate-600 truncate">
                    {caseItem.phone || "-"}
                  </div>
                  <div className="col-span-2 text-slate-600 truncate">
                    {caseItem.loan_id || "-"}
                  </div>
                  <div className="col-span-1">
                    <span className={getStatusBadge(caseItem.status)}>
                      {caseItem.status || "-"}
                    </span>
                  </div>
                  <div className="col-span-1 text-slate-600 text-xs">
                    {formatDate(caseItem.allocation_date)}
                  </div>
                  <div className="col-span-2 text-xs text-slate-600">
                    {caseItem.follow_up_date
                      ? `${formatDate(caseItem.follow_up_date)} ${formatTime(caseItem.follow_up_time)}`
                      : "-"}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCaseId(caseItem.case_id);
                        setDrawerOpen(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-700 font-medium text-sm group-hover:opacity-100 opacity-0 transition"
                    >
                      View
                    </button>
                  </div>
                </button>

                {/* Expanded Row */}
                {expandedRowId === caseItem.id && (
                  <div className="col-span-full px-4 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Data Allocation Date
                        </p>
                        <p className="font-medium text-slate-900">
                          {formatDate(caseItem.allocation_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          First Call Date
                        </p>
                        <p className="font-medium text-slate-900">
                          {formatDate(caseItem.first_call_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Last Call Date
                        </p>
                        <p className="font-medium text-slate-900">
                          {formatDate(caseItem.last_call_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Follow-up Date
                        </p>
                        <p className="font-medium text-slate-900">
                          {formatDate(caseItem.follow_up_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Follow-up Time
                        </p>
                        <p className="font-medium text-slate-900">
                          {formatTime(caseItem.follow_up_time)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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
        onDispositionSubmitted={(nextAssigned) => {
          // Reload cases after disposition is submitted
          setExpandedRowId(null);
          // reload list
          if (typeof window.__reloadAgentCases === 'function') {
            window.__reloadAgentCases();
          }
          // if server assigned a next record, open it
          if (nextAssigned) {
            setDrawerOpen(false);
            setSelectedCaseId(null);
            setTimeout(() => {
              setSelectedCaseId(nextAssigned);
              setDrawerOpen(true);
            }, 250);
          } else {
            // close current drawer after submit
            setDrawerOpen(false);
            setSelectedCaseId(null);
          }
        }}
      />
    </div>
  );
};

export default AgentDashboard;
