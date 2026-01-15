import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderPlus } from "lucide-react";

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ressourcen</h1>
          <p className="text-sm text-muted-foreground">
            Ressourcen organisieren, verwalten und bereitstellen.
          </p>
        </div>
        <Button>
          <FolderPlus className="mr-2 h-4 w-4" />
          Ressource hinzufuegen
        </Button>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Keine Ressourcen vorhanden</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Lege deine ersten Ressourcen an, um Inhalte und Dateien zu verwalten.
        </CardContent>
      </Card>
    </div>
  );
}
