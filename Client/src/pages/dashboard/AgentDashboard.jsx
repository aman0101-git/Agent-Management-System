import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { fetchAgentLoans } from "@/api/agentApi";

const AgentDashboard = () => {
  const { user, token, logout } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLoans = async () => {
      try {
        const res = await fetchAgentLoans(token);
        setLoans(res.data || []);
      } catch (err) {
        console.error("Failed to fetch agent loans", err);
      } finally {
        setLoading(false);
      }
    };

    loadLoans();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Agent Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Daily collection & calling workspace
            </p>
          </div>

          <Button
            variant="destructive"
            onClick={logout}
            className="bg-rose-600 text-white shadow-md hover:bg-rose-700"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border bg-white shadow">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">
              Welcome, {user.firstName}
            </h2>
            <p className="text-sm text-slate-500">
              Allocated Accounts
            </p>
          </div>

          {/* Content */}
          <div className="p-4 overflow-x-auto">
            {loading && (
              <p className="text-sm text-slate-500">Loading data...</p>
            )}

            {!loading && loans.length === 0 && (
              <p className="text-sm text-slate-500">
                No accounts allocated yet.
              </p>
            )}

            {!loading && loans.length > 0 && (
              <table className="w-full text-sm border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 border">Customer</th>
                    <th className="p-2 border">Mobile</th>
                    <th className="p-2 border">Loan ID</th>
                    <th className="p-2 border">Outstanding</th>
                    <th className="p-2 border">DPD</th>
                    <th className="p-2 border">State</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50">
                      <td className="p-2 border">{loan.cust_name}</td>
                      <td className="p-2 border">{loan.mobileno}</td>
                      <td className="p-2 border">{loan.appl_id}</td>
                      <td className="p-2 border">{loan.amt_outst}</td>
                      <td className="p-2 border">{loan.dpd}</td>
                      <td className="p-2 border">{loan.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AgentDashboard;
