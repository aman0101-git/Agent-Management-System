import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";

const AdminDashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      <AdminNavbar/>
      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Action Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "User Management",
              desc: "Create and manage agents and admins.",
              action: "Create Agent",
              link: "/admin/create-user",
              base: "from-teal-500 to-cyan-500",
              hover: "hover:from-teal-600 hover:to-cyan-600",
            },
            {
              title: "Create Campaign & Agent Allocation",
              desc: "Assign agents to campaigns.",
              action: "Allocate Agents",
              link: "/admin/campaign-agents",
              base: "from-emerald-500 to-teal-500",
              hover: "hover:from-emerald-600 hover:to-teal-600",
            },
            {
              title: "Data Allocation",
              desc: "Upload monthly data and assign accounts.",
              action: "Upload Monthly Data",
              link: "/admin/upload-data",
              base: "from-indigo-500 to-violet-500",
              hover: "hover:from-indigo-600 hover:to-violet-600",
            },            
            {
              title: "Campaign Management",
              desc: "Activate or deactivate campaigns.",
              action: "Manage Campaigns",
              link: "/admin/campaigns",
              base: "from-blue-500 to-indigo-500",
              hover: "hover:from-blue-600 hover:to-indigo-600",
            },
            {
              title: "Monitoring & Analysis",
              desc: "Track agent performance and activity.",
              action: "Open Monitoring",
              link: "/admin/monitoring-analytics",
              base: "from-amber-500 to-orange-500",
              hover: "hover:from-amber-600 hover:to-orange-600",
            },
            {
              title: "File Exports",
              desc: "Export MySQL data to Excel files.",
              action: "Go to File Exports",
              link: "/admin/file-exports",
              base: "from-pink-500 to-rose-500",
              hover: "hover:from-pink-600 hover:to-rose-600",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {item.desc}
              </p>

              <Link to={item.link}>
                <Button
                  className={`mt-5 w-full bg-gradient-to-r ${item.base} ${item.hover} text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all`}
                >
                  {item.action}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
