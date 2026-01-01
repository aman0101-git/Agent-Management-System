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

        // If agent has no assigned cases, try to fetch/assign next queued case automatically
        if (!data.length) {
          try {
            const nextRes = await fetchNextCase(token);
            if (nextRes.status === 200 && nextRes.data && nextRes.data.caseId) {
              // Reload cases to include newly assigned case
              const r2 = await fetchAgentCases(token);
              const newData = r2.data || [];
              setCases(newData);
              setFilteredCases(newData);
              // open the newly assigned case in drawer
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
              <div className="col-span-1">Phone</div>
              <div className="col-span-2">Loan ID</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Alloc. Date</div>
              <div className="col-span-1">Inst. Amt</div>
              <div className="col-span-1">POS</div>
              <div className="col-span-1">Follow-up</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {/* Data Rows */}
            {filteredCases.map((caseItem) => (
              <div key={caseItem.case_id}>
                <button
                  onClick={() =>
                    setExpandedRowId(
                      expandedRowId === caseItem.case_id
                        ? null
                        : caseItem.case_id
                    )
                  }
                  className="w-full grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition text-sm text-left"
                >
                  <div className="col-span-2 font-medium truncate">
                    {caseItem.customer_name || "-"}
                  </div>

                  <div className="col-span-1 text-slate-600 truncate">
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

                  <div className="col-span-1 text-xs text-slate-600">
                    {formatDate(caseItem.allocation_date)}
                  </div>

                  {/* Inst. Amt (not provided by backend yet) */}
                  <div className="col-span-1 text-xs text-slate-600">
                    {caseItem.insl_amt || "-"}
                  </div>

                  {/* POS (not provided by backend yet) */}
                  <div className="col-span-1 text-xs text-slate-600">
                    {caseItem.pos || "-"}
                  </div>

                  <div className="col-span-1 text-xs text-slate-600">
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
                      className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                    >
                      View
                    </button>
                  </div>
                </button>

                {/* Expanded Row */}
                {expandedRowId === caseItem.case_id && (
                  <div className="px-4 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Data Allocation Date
                        </p>
                        <p className="font-medium">
                          {formatDate(caseItem.allocation_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          First Call Date
                        </p>
                        <p className="font-medium">
                          {formatDate(caseItem.first_call_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Last Call Date
                        </p>
                        <p className="font-medium">
                          {formatDate(caseItem.last_call_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Follow-up Date
                        </p>
                        <p className="font-medium">
                          {formatDate(caseItem.follow_up_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">
                          Follow-up Time
                        </p>
                        <p className="font-medium">
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
          setExpandedRowId(null);
          if (typeof window.__reloadAgentCases === "function") {
            window.__reloadAgentCases();
          }
          if (nextAssigned) {
            setDrawerOpen(false);
            setSelectedCaseId(null);
            setTimeout(() => {
              setSelectedCaseId(nextAssigned);
              setDrawerOpen(true);
            }, 250);
          } else {
            setDrawerOpen(false);
            setSelectedCaseId(null);
          }
        }}
      />
    </div>
  );
};

export default AgentDashboard;
