import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { searchCustomers } from "@/api/agentApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CustomerDetailDrawer from "@/components/CustomerDetailDrawer";
import AgentNavbar from "../../components/AgentNavbar";
import { 
  Search, 
  User, 
  Phone, 
  CreditCard, 
  FileText, 
  ChevronRight, 
  Loader2 
} from "lucide-react";

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

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900">
      <AgentNavbar />
      
      <main className="mx-auto max-w-5xl px-4 py-12">
        
        {/* Header & Search Hero */}
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Find Any Customer
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Instantly locate customer records by Loan ID, full name, or registered phone number.
          </p>
        </div>

        {/* Search Bar Container */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="relative flex items-center shadow-lg rounded-full bg-white ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:shadow-xl transition-all p-2">
            <div className="pl-4 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <input
              type="text"
              placeholder="Search by Loan ID, Name, or Phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none text-lg px-4 py-3 focus:outline-none placeholder:text-slate-400 text-slate-900"
              autoFocus
            />
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-full px-8 py-6 h-auto text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md hover:shadow-lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        <div className="max-w-4xl mx-auto">
          {hasSearched && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {results.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50">
                  <div className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                      <Search className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No customers found</h3>
                    <p className="text-slate-500 mt-1">
                      We couldn't find anything matching "{searchInput}". Try a different keyword.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                      Search Results ({results.length})
                    </h2>
                  </div>
                  
                  {results.map((customer) => (
                    <Card 
                      key={customer.id}
                      className="group overflow-hidden border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                      onClick={() => {
                        setSelectedCaseId(customer.id);
                        setDrawerOpen(true);
                      }}
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row items-stretch">
                          
                          {/* Left Status Stripe */}
                          <div className={`w-full sm:w-2 ${
                            customer.loan_status === "CLOSED" ? "bg-emerald-500" : "bg-indigo-500"
                          }`} />

                          <div className="flex-1 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            
                            {/* Main Info */}
                            <div className="flex items-start gap-4">
                              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg shrink-0">
                                {customer.cust_name?.charAt(0) || <User className="h-6 w-6" />}
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {customer.cust_name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="h-3.5 w-3.5" />
                                    {customer.loan_agreement_no}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5" />
                                    {customer.mobileno}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Stats & Action */}
                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase font-medium">POS Amount</p>
                                <p className="text-lg font-bold text-slate-900">
                                  {formatCurrency(customer.pos)}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <Badge variant={customer.loan_status === "CLOSED" ? "success" : "secondary"} className="hidden sm:inline-flex">
                                  {customer.loan_status || "ACTIVE"}
                                </Badge>
                                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                  <ChevronRight className="h-5 w-5" />
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State / Initial View */}
          {!hasSearched && (
            <div className="text-center py-20 opacity-50">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
                <FileText className="h-10 w-10 text-slate-300" />
              </div>
              <p className="text-slate-400">Enter a search term above to begin.</p>
            </div>
          )}
        </div>

      </main>

      {/* Detail Drawer */}
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