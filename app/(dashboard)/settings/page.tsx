"use client";

import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Trash2, LogOut, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Profile Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);

  // Security Form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // Load current user
    const currentUser = pb.authStore.model;
    if (currentUser) {
      setUser(currentUser);
      setName(currentUser.name || "");
      setEmail(currentUser.email || "");
    }
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = { name };
      // Note: Changing email usually requires re-verification in PB, handled by requestEmailChange
      // But we can try to update it directly if allowed.
      if (email !== user.email) {
          await pb.collection("users").requestEmailChange(email);
          alert("Eine Verifizierungs-E-Mail wurde an die neue Adresse gesendet.");
      }
      
      const updatedUser = await pb.collection("users").update(user.id, data);
      setUser(updatedUser);
      alert("Profil erfolgreich aktualisiert!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Profil konnte nicht aktualisiert werden.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (newPassword !== confirmPassword) {
        alert("Passwoerter stimmen nicht ueberein");
        setLoading(false);
        return;
    }

    try {
      await pb.collection("users").update(user.id, {
        oldPassword: oldPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });
      alert("Passwort erfolgreich geaendert!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      alert("Passwort konnte nicht geaendert werden. Bitte altes Passwort pruefen.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "Moechtest du dein Konto wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden."
    );
    if (!confirmed) return;
    
    // Double confirmation
    const doubleConfirmed = prompt(
      "Gib 'DELETE' ein, um das Loeschen zu bestaetigen."
    );
    if (doubleConfirmed !== "DELETE") return;

    try {
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      router.push("/login");
    } catch (error) {
       console.error("Error deleting account:", error);
       alert("Konto konnte nicht geloescht werden.");
    }
  };

  const handle2FA = () => {
      alert(
        "Um 2FA zu aktivieren, kontaktiere bitte einen Administrator oder richte eine externe Authenticator-App ein (erweitertes Setup)."
      );
  };

  if (!user) {
     return <div className="p-8">Einstellungen werden geladen...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Kontoeinstellungen</h1>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Sicherheit</TabsTrigger>
          <TabsTrigger value="danger">Gefahrenbereich</TabsTrigger>
        </TabsList>
        
        {/* PROFILE TAB */}
        <TabsContent value="profile">
          <Card className="doodle-card mt-4">
            <CardHeader>
              <CardTitle>Profilinformationen</CardTitle>
              <CardDescription>Aktualisiere hier deine persoenlichen Daten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="font-bold">Vollstaendiger Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="font-bold">E-Mail</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  E-Mail-Aenderung erfordert eine Verifizierung.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateProfile} disabled={loading} className="font-bold">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Aenderungen speichern
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* SECURITY TAB */}
        <TabsContent value="security">
          <Card className="doodle-card mt-4">
            <CardHeader>
              <CardTitle>Sicherheitseinstellungen</CardTitle>
              <CardDescription>
                Verwalte dein Passwort und deine Authentifizierungsmethoden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-lg border-2 border-dashed border-gray-300 p-4">
                 <h3 className="font-bold flex items-center gap-2">
                   <Shield className="h-4 w-4" /> Passwort aktualisieren
                 </h3>
                 <div className="grid gap-2">
                    <label className="text-sm font-medium">Aktuelles Passwort</label>
                    <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                 </div>
                 <div className="grid gap-2">
                    <label className="text-sm font-medium">Neues Passwort</label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                 </div>
                 <div className="grid gap-2">
                    <label className="text-sm font-medium">Neues Passwort bestaetigen</label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                 </div>
                 <Button onClick={handleChangePassword} disabled={loading} size="sm">
                   Passwort aktualisieren
                 </Button>
              </div>

              <div className="space-y-4 rounded-lg border-2 border-black p-4 bg-muted/20">
                  <h3 className="font-bold">Zwei-Faktor-Authentifizierung</h3>
                  <p className="text-sm">Sichere dein Konto mit 2FA.</p>
                  <Button variant="outline" onClick={handle2FA}>2FA einrichten</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DANGER ZONE TAB */}
        <TabsContent value="danger">
           <Card className="doodle-card mt-4 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Gefahrenbereich</CardTitle>
              <CardDescription>Unumkehrbare Aktionen fuer dein Konto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
                  <h4 className="font-bold text-destructive">Konto loeschen</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Nach dem Loeschen gibt es kein Zurueck. Bitte sei sicher.
                  </p>
                  <Button variant="destructive" onClick={handleDeleteAccount} className="w-full sm:w-auto font-bold">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Konto dauerhaft loeschen
                  </Button>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
