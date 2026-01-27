import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CreateUser = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    role: "AGENT",
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

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
      
      // ISSUE #1 FIX: Redirect to Admin Dashboard after successful user creation
      setTimeout(() => {
        navigate("/admin/dashboard");
      }, 1500);
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


            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 2.25 12c2.036 3.772 6.066 6.75 9.75 6.75 1.77 0 3.487-.47 4.97-1.277M21.75 12c-.512-.948-1.21-1.927-2.02-2.777m-2.32-2.197A9.716 9.716 0 0 0 12 5.25c-2.36 0-4.693.81-6.73 2.223m13.46 0A9.72 9.72 0 0 1 21.75 12c-2.036 3.772-6.066 6.75-9.75 6.75-1.77 0-3.487-.47-4.97-1.277m13.46-10.25L4.47 19.53" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12C3.285 7.943 7.318 4.5 12 4.5c4.682 0 8.715 3.443 9.75 7.5-1.035 4.057-5.068 7.5-9.75 7.5-4.682 0-8.715-3.443-9.75-7.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z" />
                  </svg>
                )}
              </button>
            </div>

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
