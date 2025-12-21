import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CreateUser = () => {
  const { token } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    role: "AGENT",
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await axios.post(
        "http://localhost:5000/api/auth/register",
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess("User created successfully");
      setForm({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        role: "AGENT",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create user");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-2xl border bg-white p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-slate-900">
            Create User
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Add a new agent or admin to the system
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              name="firstName"
              placeholder="First name"
              value={form.firstName}
              onChange={handleChange}
              required
            />

            <Input
              name="lastName"
              placeholder="Last name"
              value={form.lastName}
              onChange={handleChange}
              required
            />

            <Input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              required
            />

            <Input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 transition"
              >
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {success}
              </div>
            )}

            <Button className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow hover:shadow-lg active:scale-[0.98] transition-all">
              Create User
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateUser;
