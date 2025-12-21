import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const Login = () => {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async ({ username, password }) => {
    const success = await login(username, password);
    if (success) {
      const savedUser = JSON.parse(localStorage.getItem("user"));
      navigate(
        savedUser.role === "ADMIN"
          ? "/admin/dashboard"
          : "/agent/dashboard"
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4">
      <Card className="w-full max-w-md border border-slate-200 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:shadow-[0_25px_55px_rgba(0,0,0,0.12)] transition-shadow duration-300">
        <CardHeader className="space-y-2">
          <CardTitle className="text-center text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </CardTitle>
          <p className="text-center text-sm text-slate-600">
            Sign in to continue to AMS
          </p>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <FormField
                control={form.control}
                name="username"
                rules={{ required: "Username is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">
                      Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="FC0001"
                        {...field}
                        className="bg-slate-50 border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-400/40"
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 font-medium" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                rules={{ required: "Password is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="bg-slate-50 border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40"
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 font-medium" />
                  </FormItem>
                )}
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:from-teal-700 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
