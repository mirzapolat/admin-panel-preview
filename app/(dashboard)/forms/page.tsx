import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus } from "lucide-react";

export default function FormsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Formulare</h1>
          <p className="text-sm text-muted-foreground">
            Formulare erstellen, bearbeiten und verwalten.
          </p>
        </div>
        <Button>
          <FilePlus className="mr-2 h-4 w-4" />
          Formular erstellen
        </Button>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Keine Formulare vorhanden</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Erstelle dein erstes Formular, um Daten zu erfassen und zu verwalten.
        </CardContent>
      </Card>
    </div>
  );
}
