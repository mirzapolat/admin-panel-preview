"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, ShieldCheck, UserPlus } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "2fa" | "signup">("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Login/Signup Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Signup only Fields
  const [name, setName] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  
  // 2FA Fields
  const [code, setCode] = useState("");

  // Password Strength Regex
  // Minimum 8 chars, at least one letter, one number
  const strongPasswordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Update user metadata with name if needed
      if (data.user) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { name: data.user.user_metadata?.name || name }
        });
        if (updateError) console.error("Error updating user metadata:", updateError);
      }

      // Use window.location.href instead of router.push to ensure cookies are synced
      // and middleware can properly detect the session
      window.location.href = "/members/active";
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Ungueltige E-Mail oder Passwort.");
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
        setError("Passwoerter stimmen nicht ueberein.");
        return;
    }

    if (!strongPasswordRegex.test(password)) {
        setError(
          "Das Passwort muss mindestens 8 Zeichen lang sein und mindestens einen Buchstaben und eine Zahl enthalten."
        );
        return;
    }

    setLoading(true);

    try {
        // Create user with Supabase
        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: name,
              }
            }
        });

        if (signUpError) throw signUpError;

        // If email confirmation is required, show message
        if (data.user && !data.session) {
          setError("Bitte bestaetige deine E-Mail-Adresse, bevor du dich anmeldest.");
          setLoading(false);
          return;
        }

        // If auto-confirm is enabled, sign in automatically
        if (data.session) {
          // Use window.location.href instead of router.push to ensure cookies are synced
          window.location.href = "/members/active";
        }
    } catch (err: any) {
        console.error("Signup failed:", err);
        setError(
          err.message ||
            "Konto konnte nicht erstellt werden. E-Mail ist moeglicherweise bereits vergeben."
        );
    } finally {
        setLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... kept for reference but skipping direct 2FA flow for initial login to simplify unless specifically requested for all users
    // The previous implementation had 2FA hardcoded. Let's redirect directly for now as typical flows don't force 2FA unless configured.
  };

  return (
    <Card className="doodle-card w-full max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          {step === "signup" ? <UserPlus className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          <CardTitle className="text-3xl font-doodle">
          {step === "signup"
            ? "Konto erstellen"
            : step === "credentials"
              ? "Willkommen zurueck"
              : "Sicherheitspruefung"}
          </CardTitle>
        </div>
        <CardDescription>
          {step === "signup"
            ? "Gib deine Daten ein, um zu starten"
            : step === "credentials"
              ? "Gib deine Zugangsdaten ein, um dein Konto zu nutzen"
              : "Gib den Verifizierungscode ein, der an dein Geraet gesendet wurde"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <div className="rounded-md border-2 border-black bg-red-100 p-3 text-sm font-bold text-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {error}
          </div>
        )}
        
        {step === "credentials" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="email" className="font-bold">E-Mail</label>
              <Input
                id="email"
                type="text"
                placeholder="name@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="font-bold">Passwort</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full font-bold text-md" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Anmelden <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="text-center text-sm">
                Noch kein Konto?{" "}
                <button type="button" onClick={() => setStep("signup")} className="font-bold underline hover:text-primary">
                    Registrieren
                </button>
            </div>
          </form>
        )}

        {step === "signup" && (
             <form onSubmit={handleSignup} className="space-y-4">
             <div className="grid gap-2">
               <label htmlFor="name" className="font-bold">Vollstaendiger Name</label>
               <Input
                 id="name"
                 type="text"
                 placeholder="Max Mustermann"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 required
               />
             </div>
             <div className="grid gap-2">
               <label htmlFor="signup-email" className="font-bold">E-Mail</label>
               <Input
                 id="signup-email"
                 type="email"
                 placeholder="name@beispiel.de"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required
               />
             </div>
             <div className="grid gap-2">
               <label htmlFor="signup-password" className="font-bold">Passwort</label>
               <Input
                 id="signup-password"
                 type="password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
               />
               <p className="text-xs text-muted-foreground">
                 Min. 8 Zeichen, 1 Buchstabe, 1 Zahl.
               </p>
             </div>
             <div className="grid gap-2">
               <label htmlFor="passwordConfirm" className="font-bold">
                 Passwort bestaetigen
               </label>
               <Input
                 id="passwordConfirm"
                 type="password"
                 value={passwordConfirm}
                 onChange={(e) => setPasswordConfirm(e.target.value)}
                 required
               />
             </div>
             <Button className="w-full font-bold text-md" type="submit" disabled={loading}>
               {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
               Konto erstellen
             </Button>
             <div className="text-center text-sm">
                 Schon ein Konto?{" "}
                 <button type="button" onClick={() => setStep("credentials")} className="font-bold underline hover:text-primary">
                     Anmelden
                 </button>
             </div>
           </form>
        )}

        {step === "2fa" && (
           /* Keeping existing 2FA UI block if we needed it back, but logically we are not using it right now */
          <div className="text-center">2FA ist fuer diesen Ablauf nicht aktiv.</div>
        )}
      </CardContent>
    </Card>
  );
}
