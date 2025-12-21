import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import AgentDashboard from "./pages/dashboard/AgentDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateUser from "./pages/admin/CreateUser";
import UploadData from "./pages/admin/UploadData";
import ManageCampaigns from "./pages/admin/ManageCampaigns";
import CampaignAgents from "./pages/admin/CampaignAgents";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin/create-user"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <CreateUser />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent/dashboard"
        element={
          <ProtectedRoute allowedRoles={["AGENT"]}>
            <AgentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/upload-data"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <UploadData />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/campaigns"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ManageCampaigns />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/campaign-agents"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <CampaignAgents />
          </ProtectedRoute>
        }
      />


    </Routes>
  );
}

export default App;
