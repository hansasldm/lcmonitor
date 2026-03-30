import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import companyLogo from "@/assets/company-logo.png";
import { Lock, Mail } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center"
        style={{
          background: "linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(220 60% 20%) 50%, hsl(160 50% 30%) 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="mb-8 flex justify-center">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-5 border border-white/10">
              <img src={companyLogo} alt="LC Monitor" className="h-20 w-auto object-contain brightness-0 invert" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight mb-3">
            LC Monitor
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Enterprise-grade employee time tracking, attendance monitoring, and workforce analytics platform.
          </p>
          <div className="mt-10 flex items-center justify-center gap-8 text-white/40 text-xs">
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-white/80 mb-0.5">24/7</div>
              Monitoring
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-white/80 mb-0.5">Real-time</div>
              Tracking
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-white/80 mb-0.5">Secure</div>
              Platform
            </div>
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="rounded-xl bg-muted/50 p-3 border border-border">
              <img src={companyLogo} alt="LC Monitor" className="h-16 w-auto object-contain" />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Sign in to your LC Monitor account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/8 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-11 pl-10 bg-muted/30 border-border/60 focus:bg-card transition-colors"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 pl-10 bg-muted/30 border-border/60 focus:bg-card transition-colors"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-semibold text-sm shadow-premium hover:shadow-premium-lg transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground/60 mt-8">
            Protected by enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;