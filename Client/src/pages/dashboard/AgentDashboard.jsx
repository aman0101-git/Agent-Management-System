import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { fetchAgentLoans } from "@/api/agentApi";
import CustomerDetailDrawer from "@/components/CustomerDetailDrawer";

const AgentDashboard = () => {
  const { user, token, logout } = useAuth();

  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const loadLoans = async () => {
      try {
        const res = await fetchAgentLoans(token);
        setLoans(res.data || []);
        setFilteredLoans(res.data || []);
      } finally {
        setLoading(false);
      }
    };
    loadLoans();
  }, [token]);

  useEffect(() => {
    if (!search) setFilteredLoans(loans);
    else {
      setFilteredLoans(
        loans.filter((l) =>
          String(l.mobileno || "").includes(search)
        )
      );
    }
  }, [search, loans]);

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
              {filteredLoans.length} allocated accounts
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
          placeholder="Search by mobile number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-8 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-400/40"
        />

        {loading && (
          <p className="text-slate-500">Loading customers…</p>
        )}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredLoans.map((loan) => (
              <button
                key={loan.id}
                onClick={() => {
                  setSelectedCustomerId(loan.id);
                  setDrawerOpen(true);
                }}
                className="group rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none"
              >
                <p className="font-semibold text-slate-900 truncate">
                  {loan.cust_name}
                </p>
                <p className="text-sm text-slate-500">
                  {loan.mobileno}
                </p>

                <div className="mt-4 space-y-1 text-sm">
                  <p>
                    <span className="text-slate-500">POS:</span>{" "}
                    ₹{loan.pos || 0}
                  </p>
                  <p>
                    <span className="text-slate-500">Branch:</span>{" "}
                    {loan.branch_name || "-"}
                  </p>
                </div>

                <div className="mt-4 text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                  View details →
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <CustomerDetailDrawer
        customerId={selectedCustomerId}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedCustomerId(null);
        }}
      />
    </div>
  );
};

export default AgentDashboard;
