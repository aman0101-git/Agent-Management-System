import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { searchCustomers } from "@/api/agentApi";
import { Button } from "@/components/ui/button";
import CustomerDetailDrawer from "@/components/CustomerDetailDrawer";

const CustomerSearch = () => {
  const { token } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    try {
      const data = await searchCustomers(searchInput, token);
      setResults(data.data || []);
      setHasSearched(true);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Customer Search
          </h1>
          <p className="text-slate-600">
            Search any customer by Loan ID, Name, or Phone Number
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter Loan ID, Customer Name, or Phone Number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        {hasSearched && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-600">
                <p className="text-lg font-medium">
                  No customers found matching "{searchInput}"
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <p className="text-sm font-medium text-slate-700">
                    Found {results.length} customer(s)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Loan ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Customer Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Outstanding
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                          Loan Status
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {results.map((customer) => (
                        <tr key={customer.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {customer.loan_agreement_no}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {customer.cust_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {customer.mobileno}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {formatCurrency(customer.amt_outst)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {customer.loan_status || "ACTIVE"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Button
                              onClick={() => {
                                setSelectedCaseId(customer.id);
                                setDrawerOpen(true);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-sm font-medium"
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!hasSearched && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-slate-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className="text-slate-600 text-lg">
              Start searching to find customers
            </p>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer */}
      {selectedCaseId && (
        <CustomerDetailDrawer
          isOpen={drawerOpen}
          caseId={selectedCaseId}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedCaseId(null);
          }}
        />
      )}
    </div>
  );
};

export default CustomerSearch;
