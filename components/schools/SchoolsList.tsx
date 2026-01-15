"use client";

import { useEffect, useRef, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type School = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  active: boolean;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  identification: number;
};

type SortField =
  | "identification"
  | "name"
  | "email"
  | "phone"
  | "city"
  | "active"
  | "created"
  | "updated";

type SortDirection = "asc" | "desc";

type FilterState = {
  active: "all" | "active" | "inactive";
  name: string;
  email: string;
  phone: string;
  city: string;
  identificationMin: string;
  identificationMax: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
};

type BulkField = "active" | "name" | "email" | "phone" | "city";

type ImportMode = "create" | "upsert_email" | "upsert_identification";

type ExportScope = "filtered" | "selected" | "all";

type ImportSummary = {
  created: number;
  updated: number;
  failed: number;
};

const defaultFilters: FilterState = {
  active: "all",
  name: "",
  email: "",
  phone: "",
  city: "",
  identificationMin: "",
  identificationMax: "",
  createdFrom: "",
  createdTo: "",
  updatedFrom: "",
  updatedTo: "",
};

const exportFields = [
  "id",
  "identification",
  "name",
  "email",
  "phone",
  "city",
  "active",
  "created",
  "updated",
] as const;

const escapeFilterValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');

const toDateStart = (value: string) => `${value} 00:00:00`;
const toDateEnd = (value: string) => `${value} 23:59:59`;

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "inactive"].includes(normalized)) return false;
  }
  return false;
};

const isNotFoundError = (error: any) =>
  error?.status === 404 || error?.data?.code === 404;

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: "-", time: "" };
  }
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
};

const csvEscape = (value: unknown) => {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/\"|,|\n/.test(stringValue)) {
    return `"${stringValue.replace(/\"/g, '""')}"`;
  }
  return stringValue;
};

const buildCsv = (
  rows: Array<Record<string, unknown>>,
  fields: readonly string[]
) => {
  const header = fields.join(",");
  const body = rows
    .map((row) => fields.map((field) => csvEscape(row[field])).join(","))
    .join("\n");
  return [header, body].filter(Boolean).join("\n");
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      pushCell();
      pushRow();
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      pushCell();
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
};

const mapCsvRowsToRecords = (rows: string[][]) => {
  if (rows.length === 0) return [] as Record<string, string>[];

  const headerMap: Record<string, string> = {
    id: "id",
    identification: "identification",
    memberid: "identification",
    name: "name",
    email: "email",
    phone: "phone",
    city: "city",
    active: "active",
    isactive: "active",
  };

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/[\s_-]/g, "")
  );
  const normalizedHeaders = headers.map((header) => headerMap[header] ?? header);

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    normalizedHeaders.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
};

export function SchoolsList() {
  const [members, setMembers] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<School | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [filtersDraft, setFiltersDraft] = useState<FilterState>(defaultFilters);
  const [sortBy, setSortBy] = useState<SortField>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkField>("active");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkActiveValue, setBulkActiveValue] = useState<"true" | "false">(
    "true"
  );
  const [bulkWorking, setBulkWorking] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("create");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>("filtered");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exporting, setExporting] = useState(false);

  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const activeFilterCount = [
    filters.active !== "all",
    Boolean(filters.name),
    Boolean(filters.email),
    Boolean(filters.phone),
    Boolean(filters.city),
    Boolean(filters.identificationMin),
    Boolean(filters.identificationMax),
    Boolean(filters.createdFrom),
    Boolean(filters.createdTo),
    Boolean(filters.updatedFrom),
    Boolean(filters.updatedTo),
  ].filter(Boolean).length;

  const buildFilterString = (state: FilterState, query: string) => {
    const filterParts: string[] = [];

    if (query.trim()) {
      const escapedQuery = escapeFilterValue(query.trim());
      filterParts.push(
        `(name ~ "${escapedQuery}" || email ~ "${escapedQuery}" || phone ~ "${escapedQuery}" || city ~ "${escapedQuery}")`
      );
    }

    if (state.active !== "all") {
      filterParts.push(`active = ${state.active === "active"}`);
    }

    if (state.name.trim()) {
      filterParts.push(`name ~ "${escapeFilterValue(state.name.trim())}"`);
    }

    if (state.email.trim()) {
      filterParts.push(`email ~ "${escapeFilterValue(state.email.trim())}"`);
    }

    if (state.phone.trim()) {
      filterParts.push(`phone ~ "${escapeFilterValue(state.phone.trim())}"`);
    }

    if (state.city.trim()) {
      filterParts.push(`city ~ "${escapeFilterValue(state.city.trim())}"`);
    }

    const minId = Number(state.identificationMin);
    if (!Number.isNaN(minId) && state.identificationMin.trim() !== "") {
      filterParts.push(`identification >= ${minId}`);
    }

    const maxId = Number(state.identificationMax);
    if (!Number.isNaN(maxId) && state.identificationMax.trim() !== "") {
      filterParts.push(`identification <= ${maxId}`);
    }

    if (state.createdFrom) {
      filterParts.push(`created >= "${toDateStart(state.createdFrom)}"`);
    }

    if (state.createdTo) {
      filterParts.push(`created <= "${toDateEnd(state.createdTo)}"`);
    }

    if (state.updatedFrom) {
      filterParts.push(`updated >= "${toDateStart(state.updatedFrom)}"`);
    }

    if (state.updatedTo) {
      filterParts.push(`updated <= "${toDateEnd(state.updatedTo)}"`);
    }

    return filterParts.join(" && ");
  };

  const buildSortString = () =>
    sortDirection === "desc" ? `-${sortBy}` : sortBy;

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const filterString = buildFilterString(filters, searchQuery);
      const sortString = buildSortString();
      const records = await pb.collection("schools").getList<School>(1, 50, {
        sort: sortString,
        filter: filterString,
      });
      setMembers(records.items);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, filters, sortBy, sortDirection]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const isIndeterminate =
      selectedIds.length > 0 && selectedIds.length < members.length;
    selectAllRef.current.indeterminate = isIndeterminate;
  }, [selectedIds, members.length]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      city: "",
      active: true,
    });
    setEditingMember(null);
  };

  const handleSave = async () => {
    try {
      if (editingMember) {
        await pb.collection("schools").update(editingMember.id, formData);
      } else {
        let nextId = 1;
        try {
          const lastMemberResult = await pb
            .collection("schools")
            .getList(1, 1, {
              sort: "-identification",
            });
          if (lastMemberResult.items.length > 0) {
            nextId = (lastMemberResult.items[0].identification || 0) + 1;
          }
        } catch (error) {
          console.warn("Could not fetch last ID, defaulting to 1", error);
        }

        await pb.collection("schools").create({
          ...formData,
          identification: nextId,
        });
      }
      setIsAddOpen(false);
      setEditingMember(null);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      console.error("Error saving member:", error);
      alert(`Schule konnte nicht gespeichert werden. Fehler: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Moechtest du diese Schule wirklich loeschen?")) return;
    try {
      await pb.collection("schools").delete(id);
      fetchMembers();
    } catch (error) {
      console.error("Error deleting member:", error);
    }
  };

  const handleToggleActive = async (member: School) => {
    try {
      await pb
        .collection("schools")
        .update(member.id, { active: !member.active });
      fetchMembers();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const openEdit = (member: School) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      city: member.city,
      active: member.active,
    });
    setIsAddOpen(true);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(members.map((member) => member.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    setBulkWorking(true);
    const payload: Partial<School> =
      bulkField === "active"
        ? { active: bulkActiveValue === "true" }
        : ({ [bulkField]: bulkValue } as Partial<School>);

    try {
      for (const id of selectedIds) {
        await pb.collection("schools").update(id, payload);
      }
      setIsBulkEditOpen(false);
      setBulkValue("");
      fetchMembers();
    } catch (error) {
      console.error("Error bulk updating members:", error);
    } finally {
      setBulkWorking(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Moechtest du ${selectedIds.length} ausgewaehlte Schulen loeschen?`
      )
    )
      return;
    setBulkWorking(true);
    try {
      for (const id of selectedIds) {
        await pb.collection("schools").delete(id);
      }
      fetchMembers();
    } catch (error) {
      console.error("Error bulk deleting members:", error);
    } finally {
      setBulkWorking(false);
    }
  };

  const handleApplyFilters = () => {
    setFilters(filtersDraft);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setFiltersDraft(defaultFilters);
  };

  const handleSortChange = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const normalizeImportRecord = (record: Record<string, unknown>) => {
    const payload: Partial<School> = {};

    const name = normalizeText(record.name);
    if (name) payload.name = name;

    const email = normalizeText(record.email);
    if (email) payload.email = email;

    const phone = normalizeText(record.phone);
    if (phone) payload.phone = phone;

    const city = normalizeText(record.city);
    if (city) payload.city = city;

    if (record.active !== undefined && record.active !== "") {
      payload.active = parseBoolean(record.active);
    }

    if (record.identification !== undefined && record.identification !== "") {
      const parsedId = Number(record.identification);
      if (!Number.isNaN(parsedId)) {
        payload.identification = parsedId;
      }
    }

    return payload;
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportError("Bitte waehle eine Datei zum Importieren aus.");
      return;
    }

    setImportError(null);
    setImportSummary(null);
    setImporting(true);

    try {
      const content = await importFile.text();
      let records: Record<string, unknown>[] = [];

      if (importFile.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON-Import muss ein Array von Datensaetzen sein.");
        }
        records = parsed as Record<string, unknown>[];
      } else {
        const rows = parseCsvRows(content);
        records = mapCsvRowsToRecords(rows);
      }

      const summary: ImportSummary = { created: 0, updated: 0, failed: 0 };

      for (const record of records) {
        const payload = normalizeImportRecord(record);

        try {
          if (importMode === "create") {
            await pb.collection("schools").create({
              ...payload,
              active: payload.active ?? true,
            });
            summary.created += 1;
            continue;
          }

          if (importMode === "upsert_email") {
            const email = normalizeText(record.email);
            if (!email) {
              summary.failed += 1;
              continue;
            }
            try {
              const existing = await pb
                .collection("schools")
                .getFirstListItem(`email = "${escapeFilterValue(email)}"`);
              await pb.collection("schools").update(existing.id, payload);
              summary.updated += 1;
            } catch (error: any) {
              if (isNotFoundError(error)) {
                await pb.collection("schools").create({
                  ...payload,
                  email,
                  active: payload.active ?? true,
                });
                summary.created += 1;
              } else {
                summary.failed += 1;
              }
            }
            continue;
          }

          if (importMode === "upsert_identification") {
            const rawId = record.identification;
            const parsedId = Number(rawId);
            if (Number.isNaN(parsedId)) {
              summary.failed += 1;
              continue;
            }
            try {
              const existing = await pb
                .collection("schools")
                .getFirstListItem(`identification = ${parsedId}`);
              await pb.collection("schools").update(existing.id, payload);
              summary.updated += 1;
            } catch (error: any) {
              if (isNotFoundError(error)) {
                await pb.collection("schools").create({
                  ...payload,
                  identification: parsedId,
                  active: payload.active ?? true,
                });
                summary.created += 1;
              } else {
                summary.failed += 1;
              }
            }
            continue;
          }
        } catch (error) {
          console.error("Error importing member:", error);
          summary.failed += 1;
        }
      }

      setImportSummary(summary);
      fetchMembers();
    } catch (error: any) {
      console.error("Import failed:", error);
      setImportError(error.message || "Import fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let exportMembers: School[] = [];
      if (exportScope === "selected") {
        exportMembers = members.filter((member) =>
          selectedIds.includes(member.id)
        );
      } else if (exportScope === "filtered") {
        exportMembers = await pb.collection("schools").getFullList<School>({
          filter: buildFilterString(filters, searchQuery),
          sort: buildSortString(),
        });
      } else {
        exportMembers = await pb.collection("schools").getFullList<School>({
          sort: buildSortString(),
        });
      }

      const rows = exportMembers.map((member) => ({
        id: member.id,
        identification: member.identification,
        name: member.name,
        email: member.email,
        phone: member.phone,
        city: member.city,
        active: member.active,
        created: member.created,
        updated: member.updated,
      }));

      const filename = `schulen-${exportScope}-${new Date()
        .toISOString()
        .slice(0, 10)}.${exportFormat}`;

      const data =
        exportFormat === "json"
          ? JSON.stringify(rows, null, 2)
          : buildCsv(rows, exportFields);

      const blob = new Blob([data], {
        type: exportFormat === "json" ? "application/json" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setIsExportOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Schulen</h1>
          <div className="flex w-full flex-nowrap items-center gap-1 py-1 sm:w-auto sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              size="sm"
              className="h-9 px-2 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
              <Upload className="mr-1 h-4 w-4 sm:mr-2" />
              Importieren
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(true)}
              size="sm"
              className="h-9 px-2 text-xs sm:h-10 sm:px-4 sm:text-sm"
            >
              <Download className="mr-1 h-4 w-4 sm:mr-2" />
              Exportieren
            </Button>
            <Dialog
              open={isAddOpen}
              onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-9 px-2 text-xs sm:h-10 sm:px-4 sm:text-sm"
                >
                  <Plus className="mr-1 h-4 w-4 sm:mr-2" />
                  <span className="sm:hidden">Neu</span>
                  <span className="hidden sm:inline">Schule hinzufuegen</span>
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingMember
                    ? "Schule bearbeiten"
                    : "Neue Schule hinzufuegen"}
                </DialogTitle>
                <DialogDescription>
                  {editingMember
                    ? "Schuldaten unten aktualisieren."
                    : "Details ausfuellen, um eine neue Schule zur Datenbank hinzuzufuegen."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {editingMember ? (
                  <div className="grid gap-2">
                    <label
                      htmlFor="identification"
                      className="text-sm font-medium"
                    >
                      Schul-ID
                    </label>
                    <Input
                      id="identification"
                      value={String(editingMember.identification)}
                      disabled
                    />
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Max Mustermann"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    E-Mail
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="name@beispiel.de"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="phone" className="text-sm font-medium">
                      Telefon
                    </label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="030 1234567"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="city" className="text-sm font-medium">
                      Stadt
                    </label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="Berlin"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="active" className="text-sm font-medium">
                    Aktiv-Status
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSave}>
                  {editingMember
                    ? "Aenderungen speichern"
                    : "Schule erstellen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog
        open={isImportOpen}
        onOpenChange={(open) => {
          setIsImportOpen(open);
          if (!open) {
            setImportFile(null);
            setImportSummary(null);
            setImportError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schulen importieren</DialogTitle>
            <DialogDescription>
              CSV- oder JSON-Datei mit Schul-Attributen hochladen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="import-file" className="text-sm font-medium">
                Datei
              </label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setImportFile(file);
                  setImportSummary(null);
                  setImportError(null);
                }}
              />
              <span className="text-xs text-muted-foreground">
                Unterstuetzte Felder: name, email, phone, city, active,
                identification.
              </span>
            </div>
            <div className="grid gap-2">
              <label htmlFor="import-mode" className="text-sm font-medium">
                Importmodus
              </label>
              <Select
                value={importMode}
                onValueChange={(value) =>
                  setImportMode(value as ImportMode)
                }
              >
                <SelectTrigger id="import-mode">
                  <SelectValue placeholder="Modus waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Neue Eintraege erstellen</SelectItem>
                  <SelectItem value="upsert_email">
                    Upsert nach E-Mail
                  </SelectItem>
                  <SelectItem value="upsert_identification">
                    Upsert nach ID
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {importSummary ? (
              <div className="text-sm text-muted-foreground">
                Erstellt: {importSummary.created} • Aktualisiert:{" "}
                {importSummary.updated} • Fehlgeschlagen: {importSummary.failed}
              </div>
            ) : null}
            {importError ? (
              <div className="text-sm text-destructive">{importError}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(false)}
            >
              Abbrechen
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importiere..." : "Importieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schulen exportieren</DialogTitle>
            <DialogDescription>
              Ausgewaehlte, gefilterte oder alle Schulen exportieren.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="export-scope" className="text-sm font-medium">
                Umfang
              </label>
              <Select
                value={exportScope}
                onValueChange={(value) =>
                  setExportScope(value as ExportScope)
                }
              >
                <SelectTrigger id="export-scope">
                  <SelectValue placeholder="Umfang waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filtered">Aktuelle Filter</SelectItem>
                  <SelectItem value="selected" disabled={!selectedIds.length}>
                    Ausgewaehlt ({selectedIds.length})
                  </SelectItem>
                  <SelectItem value="all">Alle Schulen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="export-format" className="text-sm font-medium">
                Format
              </label>
              <Select
                value={exportFormat}
                onValueChange={(value) =>
                  setExportFormat(value as "csv" | "json")
                }
              >
                <SelectTrigger id="export-format">
                  <SelectValue placeholder="Format waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || (exportScope === "selected" && !selectedIds.length)}
            >
              {exporting ? "Exportiere..." : "Exportieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-nowrap items-center gap-1 py-1 md:w-auto md:gap-2">
          <Select
            value={filters.active}
            onValueChange={(value) => {
              setFilters((prev) => ({
                ...prev,
                active: value as FilterState["active"],
              }));
              setFiltersDraft((prev) => ({
                ...prev,
                active: value as FilterState["active"],
              }));
            }}
          >
            <SelectTrigger className="h-9 w-[110px] px-2 text-xs sm:h-10 sm:w-[140px] sm:px-3 sm:text-sm">
              <div className="flex items-center gap-1 sm:gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortField)}
          >
            <SelectTrigger className="h-9 w-[140px] px-2 text-xs sm:h-10 sm:w-[180px] sm:px-3 sm:text-sm">
              <div className="flex items-center gap-1 sm:gap-2">
                <ArrowUpDown className="h-4 w-4" />
                <SelectValue placeholder="Sortieren nach" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="identification">Schul-ID</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">E-Mail</SelectItem>
              <SelectItem value="phone">Telefon</SelectItem>
              <SelectItem value="city">Stadt</SelectItem>
              <SelectItem value="active">Status</SelectItem>
              <SelectItem value="created">Erstellt</SelectItem>
              <SelectItem value="updated">Zuletzt bearbeitet</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            aria-label="Sortierrichtung wechseln"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            {sortDirection === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <Sheet
            onOpenChange={(open) => {
              if (open) {
                setFiltersDraft(filters);
              }
            }}
          >
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2 text-xs sm:h-10 sm:px-4 sm:text-sm"
                aria-label="Erweiterte Filter"
              >
                <Filter className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  Erweiterte Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Erweiterte Filter</SheetTitle>
                <SheetDescription>
                  Filtere Schulen nach jedem Attribut.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="filter-name" className="text-sm font-medium">
                    Name enthaelt
                  </label>
                  <Input
                    id="filter-name"
                    value={filtersDraft.name}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="filter-email" className="text-sm font-medium">
                    E-Mail enthaelt
                  </label>
                  <Input
                    id="filter-email"
                    value={filtersDraft.email}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="filter-phone" className="text-sm font-medium">
                    Telefon enthaelt
                  </label>
                  <Input
                    id="filter-phone"
                    value={filtersDraft.phone}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="filter-city" className="text-sm font-medium">
                    Stadt enthaelt
                  </label>
                  <Input
                    id="filter-city"
                    value={filtersDraft.city}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        city: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="filter-active" className="text-sm font-medium">
                    Aktiv-Status
                  </label>
                  <Select
                    value={filtersDraft.active}
                    onValueChange={(value) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        active: value as FilterState["active"],
                      }))
                    }
                  >
                    <SelectTrigger id="filter-active">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="inactive">Inaktiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label
                      htmlFor="filter-id-min"
                      className="text-sm font-medium"
                    >
                      ID min
                    </label>
                    <Input
                      id="filter-id-min"
                      type="number"
                      value={filtersDraft.identificationMin}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          identificationMin: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <label
                      htmlFor="filter-id-max"
                      className="text-sm font-medium"
                    >
                      ID max
                    </label>
                    <Input
                      id="filter-id-max"
                      type="number"
                      value={filtersDraft.identificationMax}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          identificationMax: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Erstellt Zeitraum</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      value={filtersDraft.createdFrom}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          createdFrom: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      value={filtersDraft.createdTo}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          createdTo: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Aktualisiert Zeitraum</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      value={filtersDraft.updatedFrom}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          updatedFrom: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      value={filtersDraft.updatedTo}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          updatedTo: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={handleResetFilters}>
                  Filter zuruecksetzen
                </Button>
                <SheetClose asChild>
                  <Button onClick={handleApplyFilters}>Filter anwenden</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche Name, E-Mail, Telefon, Stadt..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {selectedIds.length} ausgewaehlt
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setIsBulkEditOpen(true)}>
              Massenbearbeitung
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkWorking}
            >
              Ausgewaehlte loeschen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds([])}
            >
              Auswahl aufheben
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Massenbearbeitung</DialogTitle>
            <DialogDescription>
              Ein Attribut fuer alle ausgewaehlten Schulen aktualisieren.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="bulk-field" className="text-sm font-medium">
                Attribut
              </label>
              <Select
                value={bulkField}
                onValueChange={(value) => setBulkField(value as BulkField)}
              >
                <SelectTrigger id="bulk-field">
                  <SelectValue placeholder="Attribut waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv-Status</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="email">E-Mail</SelectItem>
                  <SelectItem value="phone">Telefon</SelectItem>
                  <SelectItem value="city">Stadt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkField === "active" ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={bulkActiveValue}
                  onValueChange={(value) =>
                    setBulkActiveValue(value as "true" | "false")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Aktiv</SelectItem>
                    <SelectItem value="false">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2">
                <label htmlFor="bulk-value" className="text-sm font-medium">
                  Neuer Wert
                </label>
                <Input
                  id="bulk-value"
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkEditOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={bulkWorking || selectedIds.length === 0}
            >
              {bulkWorking ? "Aktualisiere..." : "Anwenden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={
                    members.length > 0 && selectedIds.length === members.length
                  }
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  aria-label="Alle Schulen auswaehlen"
                />
              </TableHead>
              <TableHead className="w-[90px]">
                <button
                  type="button"
                  onClick={() => handleSortChange("identification")}
                  className="flex items-center gap-1"
                >
                  ID
                  {sortBy === "identification" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("name")}
                  className="flex items-center gap-1"
                >
                  Name
                  {sortBy === "name" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("email")}
                  className="flex items-center gap-1"
                >
                  E-Mail
                  {sortBy === "email" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("phone")}
                  className="flex items-center gap-1"
                >
                  Telefon
                  {sortBy === "phone" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("city")}
                  className="flex items-center gap-1"
                >
                  Stadt
                  {sortBy === "city" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("active")}
                  className="flex items-center gap-1"
                >
                  Status
                  {sortBy === "active" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("created")}
                  className="flex items-center gap-1"
                >
                  Erstellt
                  {sortBy === "created" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("updated")}
                  className="flex items-center gap-1"
                >
                  Zuletzt bearbeitet
                  {sortBy === "updated" ? (
                    sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  Keine Schulen gefunden, die deinen Kriterien entsprechen.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const created = formatTimestamp(member.created);
                const updated = formatTimestamp(member.updated);

                return (
                  <TableRow key={member.id}>
                    <TableCell className="w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        aria-label={`Schule ${member.name} auswaehlen`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground w-[90px]">
                      #{member.identification}
                    </TableCell>
                    <TableCell className="font-medium">
                      {member.name}
                    </TableCell>
                    <TableCell className="text-sm">{member.email}</TableCell>
                    <TableCell className="text-sm">{member.phone}</TableCell>
                    <TableCell className="text-sm">{member.city}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(member)}
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                          member.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        )}
                      >
                        {member.active ? "Aktiv" : "Inaktiv"}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div>{created.date}</div>
                      <div className="text-[10px] opacity-70">
                        {created.time}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div>{updated.date}</div>
                      <div className="text-[10px] opacity-70">
                        {updated.time}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Loeschen</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
