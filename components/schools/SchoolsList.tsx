"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  UserPlus,
  X,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  adress: string;
  email: string;
  phone: string;
  city: string;
  correspondant: string;
  ambassadors: string[];
  last_contacted: string;
  priority_score: number;
  active: boolean;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
};

type Ambassador = {
  id: string;
  name: string;
  email: string;
};

type SchoolFormState = {
  name: string;
  adress: string;
  email: string;
  phone: string;
  city: string;
  correspondant: string;
  ambassadors: string[];
  last_contacted: string;
  priority_score: string;
  active: boolean;
};

type SortField =
  | "name"
  | "adress"
  | "email"
  | "phone"
  | "city"
  | "correspondant"
  | "last_contacted"
  | "priority_score"
  | "active"
  | "created"
  | "updated";

type SortDirection = "asc" | "desc";

type FilterState = {
  active: "all" | "active" | "inactive";
  name: string;
  adress: string;
  email: string;
  phone: string;
  city: string;
  correspondant: string;
  lastContactedFrom: string;
  lastContactedTo: string;
  priorityMin: string;
  priorityMax: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
};

type BulkField =
  | "active"
  | "name"
  | "adress"
  | "email"
  | "phone"
  | "city"
  | "correspondant"
  | "last_contacted"
  | "priority_score";

type ImportMode = "create" | "upsert_email";

type ExportScope = "filtered" | "selected" | "all";

type ImportSummary = {
  created: number;
  updated: number;
  failed: number;
};

const defaultFilters: FilterState = {
  active: "all",
  name: "",
  adress: "",
  email: "",
  phone: "",
  city: "",
  correspondant: "",
  lastContactedFrom: "",
  lastContactedTo: "",
  priorityMin: "",
  priorityMax: "",
  createdFrom: "",
  createdTo: "",
  updatedFrom: "",
  updatedTo: "",
};

const exportFields = [
  "id",
  "name",
  "adress",
  "email",
  "phone",
  "city",
  "correspondant",
  "ambassadors",
  "last_contacted",
  "priority_score",
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
  error?.code === "PGRST116" || error?.status === 404;

const formatDateLabel = (value: string) => {
  if (!value) return "-";
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE");
};

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
    name: "name",
    email: "email",
    phone: "phone",
    city: "city",
    address: "adress",
    adresse: "adress",
    adress: "adress",
    correspondant: "correspondant",
    correspondent: "correspondant",
    contact: "correspondant",
    contactperson: "correspondant",
    contact_person: "correspondant",
    ambassador: "ambassadors",
    ambassadors: "ambassadors",
    botschafter: "ambassadors",
    lastcontacted: "last_contacted",
    lastcontacteddate: "last_contacted",
    lastcontact: "last_contacted",
    last_contacted: "last_contacted",
    priority: "priority_score",
    priorityscore: "priority_score",
    priority_score: "priority_score",
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

  const [ambassadorOptions, setAmbassadorOptions] = useState<Ambassador[]>([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(true);
  const [ambassadorSearch, setAmbassadorSearch] = useState("");
  const [ambassadorPopoverOpen, setAmbassadorPopoverOpen] = useState(false);

  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const activeFilterCount = [
    filters.active !== "all",
    Boolean(filters.name),
    Boolean(filters.adress),
    Boolean(filters.email),
    Boolean(filters.phone),
    Boolean(filters.city),
    Boolean(filters.correspondant),
    Boolean(filters.lastContactedFrom),
    Boolean(filters.lastContactedTo),
    Boolean(filters.priorityMin),
    Boolean(filters.priorityMax),
    Boolean(filters.createdFrom),
    Boolean(filters.createdTo),
    Boolean(filters.updatedFrom),
    Boolean(filters.updatedTo),
  ].filter(Boolean).length;

  const fetchMembers = async () => {
    setLoading(true);
    try {
      let query = supabase.from("schools").select("*");

      // Apply search query
      if (searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%,city.ilike.%${searchQuery.trim()}%,adress.ilike.%${searchQuery.trim()}%,correspondant.ilike.%${searchQuery.trim()}%`
        );
      }

      // Apply filters
      if (filters.active !== "all") {
        query = query.eq("active", filters.active === "active");
      }

      if (filters.name.trim()) {
        query = query.ilike("name", `%${filters.name.trim()}%`);
      }

      if (filters.adress.trim()) {
        query = query.ilike("adress", `%${filters.adress.trim()}%`);
      }

      if (filters.email.trim()) {
        query = query.ilike("email", `%${filters.email.trim()}%`);
      }

      if (filters.phone.trim()) {
        query = query.ilike("phone", `%${filters.phone.trim()}%`);
      }

      if (filters.city.trim()) {
        query = query.ilike("city", `%${filters.city.trim()}%`);
      }

      if (filters.correspondant.trim()) {
        query = query.ilike("correspondant", `%${filters.correspondant.trim()}%`);
      }

      const minPriority = Number(filters.priorityMin);
      if (!Number.isNaN(minPriority) && filters.priorityMin.trim() !== "") {
        query = query.gte("priority_score", minPriority);
      }

      const maxPriority = Number(filters.priorityMax);
      if (!Number.isNaN(maxPriority) && filters.priorityMax.trim() !== "") {
        query = query.lte("priority_score", maxPriority);
      }

      if (filters.lastContactedFrom) {
        query = query.gte("last_contacted", toDateStart(filters.lastContactedFrom));
      }

      if (filters.lastContactedTo) {
        query = query.lte("last_contacted", toDateEnd(filters.lastContactedTo));
      }

      if (filters.createdFrom) {
        query = query.gte("created", toDateStart(filters.createdFrom));
      }

      if (filters.createdTo) {
        query = query.lte("created", toDateEnd(filters.createdTo));
      }

      if (filters.updatedFrom) {
        query = query.gte("updated", toDateStart(filters.updatedFrom));
      }

      if (filters.updatedTo) {
        query = query.lte("updated", toDateEnd(filters.updatedTo));
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortDirection === "asc" });

      // Apply pagination
      query = query.range(0, 49);

      const { data, error } = await query;

      if (error) throw error;
      setMembers((data as School[]) || []);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching schools:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAmbassadors = async () => {
    setAmbassadorsLoading(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      setAmbassadorOptions((data as Ambassador[]) || []);
    } catch (error) {
      console.error("Error fetching ambassadors:", error);
    } finally {
      setAmbassadorsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, filters, sortBy, sortDirection]);

  useEffect(() => {
    fetchAmbassadors();
  }, []);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const isIndeterminate =
      selectedIds.length > 0 && selectedIds.length < members.length;
    selectAllRef.current.indeterminate = isIndeterminate;
  }, [selectedIds, members.length]);

  const [formData, setFormData] = useState<SchoolFormState>({
    name: "",
    adress: "",
    email: "",
    phone: "",
    city: "",
    correspondant: "",
    ambassadors: [],
    last_contacted: "",
    priority_score: "",
    active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      adress: "",
      email: "",
      phone: "",
      city: "",
      correspondant: "",
      ambassadors: [],
      last_contacted: "",
      priority_score: "",
      active: true,
    });
    setAmbassadorSearch("");
    setAmbassadorPopoverOpen(false);
    setEditingMember(null);
  };

  const ambassadorsById = useMemo(() => {
    return ambassadorOptions.reduce<Record<string, Ambassador>>((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, {});
  }, [ambassadorOptions]);

  const selectedAmbassadors = useMemo(() => {
    return formData.ambassadors
      .map((id) => ambassadorsById[id])
      .filter(Boolean);
  }, [ambassadorsById, formData.ambassadors]);

  const availableAmbassadors = useMemo(() => {
    const query = ambassadorSearch.trim().toLowerCase();
    const candidates = ambassadorOptions.filter(
      (member) => !formData.ambassadors.includes(member.id)
    );
    const filtered = query
      ? candidates.filter((member) =>
          `${member.name} ${member.email}`.toLowerCase().includes(query)
        )
      : candidates;
    return filtered.slice(0, 8);
  }, [ambassadorOptions, ambassadorSearch, formData.ambassadors]);

  const handleSave = async () => {
    try {
      const priorityValue = formData.priority_score.trim();
      const parsedPriority = Number(priorityValue);
      const payload: Partial<School> = {
        name: formData.name.trim(),
        adress: formData.adress.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        correspondant: formData.correspondant.trim(),
        ambassadors: formData.ambassadors,
        last_contacted: formData.last_contacted,
        priority_score: Number.isNaN(parsedPriority) ? 0 : parsedPriority,
        active: formData.active,
      };

      if (editingMember) {
        const { error } = await supabase
          .from("schools")
          .update(payload)
          .eq("id", editingMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schools").insert(payload);
        if (error) throw error;
      }
      setIsAddOpen(false);
      setEditingMember(null);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      console.error("Error saving school:", error);
      alert(`Schule konnte nicht gespeichert werden. Fehler: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Moechtest du diese Schule wirklich loeschen?")) return;
    try {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      console.error("Error deleting school:", error);
    }
  };

  const handleToggleActive = async (member: School) => {
    try {
      const { error } = await supabase
        .from("schools")
        .update({ active: !member.active })
        .eq("id", member.id);
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const openEdit = (member: School) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      adress: member.adress || "",
      email: member.email,
      phone: member.phone,
      city: member.city,
      correspondant: member.correspondant || "",
      ambassadors: Array.isArray(member.ambassadors) ? member.ambassadors : [],
      last_contacted: member.last_contacted
        ? member.last_contacted.slice(0, 10)
        : "",
      priority_score:
        member.priority_score !== undefined && member.priority_score !== null
          ? String(member.priority_score)
          : "",
      active: member.active,
    });
    setAmbassadorSearch("");
    setAmbassadorPopoverOpen(false);
    setIsAddOpen(true);
  };

  const addAmbassador = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      ambassadors: prev.ambassadors.includes(id)
        ? prev.ambassadors
        : [...prev.ambassadors, id],
    }));
  };

  const removeAmbassador = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      ambassadors: prev.ambassadors.filter((item) => item !== id),
    }));
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
    let payload: Partial<School> = {};
    if (bulkField === "active") {
      payload = { active: bulkActiveValue === "true" };
    } else if (bulkField === "priority_score") {
      const parsedPriority = Number(bulkValue);
      payload = {
        priority_score: Number.isNaN(parsedPriority) ? 0 : parsedPriority,
      };
    } else if (bulkField === "last_contacted") {
      payload = { last_contacted: bulkValue };
    } else {
      payload = { [bulkField]: bulkValue } as Partial<School>;
    }

    try {
      const { error } = await supabase
        .from("schools")
        .update(payload)
        .in("id", selectedIds);
      if (error) throw error;
      setIsBulkEditOpen(false);
      setBulkValue("");
      fetchMembers();
    } catch (error) {
      console.error("Error bulk updating schools:", error);
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
      const { error } = await supabase
        .from("schools")
        .delete()
        .in("id", selectedIds);
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      console.error("Error bulk deleting schools:", error);
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

    const adress = normalizeText(
      record.adress ?? (record as Record<string, unknown>).address
    );
    if (adress) payload.adress = adress;

    const email = normalizeText(record.email);
    if (email) payload.email = email;

    const phone = normalizeText(record.phone);
    if (phone) payload.phone = phone;

    const city = normalizeText(record.city);
    if (city) payload.city = city;

    const correspondant = normalizeText(
      record.correspondant ??
        (record as Record<string, unknown>).correspondent ??
        (record as Record<string, unknown>).contact_person ??
        (record as Record<string, unknown>).contactPerson
    );
    if (correspondant) payload.correspondant = correspondant;

    const ambassadorsValue =
      record.ambassadors ?? (record as Record<string, unknown>).ambassador;
    if (Array.isArray(ambassadorsValue)) {
      payload.ambassadors = ambassadorsValue.map((value) => String(value));
    } else if (typeof ambassadorsValue === "string") {
      const parsed = ambassadorsValue
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (parsed.length) payload.ambassadors = parsed;
    }

    const lastContacted = normalizeText(
      record.last_contacted ?? (record as Record<string, unknown>).lastContacted
    );
    if (lastContacted) payload.last_contacted = lastContacted;

    const rawPriority =
      record.priority_score ?? (record as Record<string, unknown>).priorityScore;
    if (rawPriority !== undefined && rawPriority !== "") {
      const parsedPriority = Number(rawPriority);
      if (!Number.isNaN(parsedPriority)) {
        payload.priority_score = parsedPriority;
      }
    }

    if (record.active !== undefined && record.active !== "") {
      payload.active = parseBoolean(record.active);
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
            const { error } = await supabase.from("schools").insert({
              ...payload,
              active: payload.active ?? true,
            });
            if (error) throw error;
            summary.created += 1;
            continue;
          }

          if (importMode === "upsert_email") {
            const email = normalizeText(record.email);
            if (!email) {
              summary.failed += 1;
              continue;
            }
            const { data: existingData, error: fetchError } = await supabase
              .from("schools")
              .select("id")
              .eq("email", email)
              .limit(1)
              .single();
            
            if (fetchError && fetchError.code !== "PGRST116") {
              summary.failed += 1;
              continue;
            }

            if (existingData) {
              const { error } = await supabase
                .from("schools")
                .update(payload)
                .eq("id", existingData.id);
              if (error) {
                summary.failed += 1;
              } else {
                summary.updated += 1;
              }
            } else {
              const { error } = await supabase.from("schools").insert({
                ...payload,
                email,
                active: payload.active ?? true,
              });
              if (error) {
                summary.failed += 1;
              } else {
                summary.created += 1;
              }
            }
            continue;
          }

        } catch (error) {
          console.error("Error importing school:", error);
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
      } else {
        let query = supabase.from("schools").select("*");

        // Apply filters for filtered scope
        if (exportScope === "filtered") {
          if (searchQuery.trim()) {
            query = query.or(
              `name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%,city.ilike.%${searchQuery.trim()}%,adress.ilike.%${searchQuery.trim()}%,correspondant.ilike.%${searchQuery.trim()}%`
            );
          }

          if (filters.active !== "all") {
            query = query.eq("active", filters.active === "active");
          }

          if (filters.name.trim()) {
            query = query.ilike("name", `%${filters.name.trim()}%`);
          }

          if (filters.adress.trim()) {
            query = query.ilike("adress", `%${filters.adress.trim()}%`);
          }

          if (filters.email.trim()) {
            query = query.ilike("email", `%${filters.email.trim()}%`);
          }

          if (filters.phone.trim()) {
            query = query.ilike("phone", `%${filters.phone.trim()}%`);
          }

          if (filters.city.trim()) {
            query = query.ilike("city", `%${filters.city.trim()}%`);
          }

          if (filters.correspondant.trim()) {
            query = query.ilike("correspondant", `%${filters.correspondant.trim()}%`);
          }

          const minPriority = Number(filters.priorityMin);
          if (!Number.isNaN(minPriority) && filters.priorityMin.trim() !== "") {
            query = query.gte("priority_score", minPriority);
          }

          const maxPriority = Number(filters.priorityMax);
          if (!Number.isNaN(maxPriority) && filters.priorityMax.trim() !== "") {
            query = query.lte("priority_score", maxPriority);
          }

          if (filters.lastContactedFrom) {
            query = query.gte("last_contacted", toDateStart(filters.lastContactedFrom));
          }

          if (filters.lastContactedTo) {
            query = query.lte("last_contacted", toDateEnd(filters.lastContactedTo));
          }

          if (filters.createdFrom) {
            query = query.gte("created", toDateStart(filters.createdFrom));
          }

          if (filters.createdTo) {
            query = query.lte("created", toDateEnd(filters.createdTo));
          }

          if (filters.updatedFrom) {
            query = query.gte("updated", toDateStart(filters.updatedFrom));
          }

          if (filters.updatedTo) {
            query = query.lte("updated", toDateEnd(filters.updatedTo));
          }
        }

        // Apply sorting
        query = query.order(sortBy, { ascending: sortDirection === "asc" });

        const { data, error } = await query;
        if (error) throw error;
        exportMembers = (data as School[]) || [];
      }

      const rows = exportMembers.map((member) => ({
        id: member.id,
        name: member.name,
        adress: member.adress,
        email: member.email,
        phone: member.phone,
        city: member.city,
        correspondant: member.correspondant,
        ambassadors: member.ambassadors,
        last_contacted: member.last_contacted,
        priority_score: member.priority_score,
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
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Goethe-Gymnasium"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="adress" className="text-sm font-medium">
                    Adresse
                  </label>
                  <Input
                    id="adress"
                    value={formData.adress}
                    onChange={(e) =>
                      setFormData({ ...formData, adress: e.target.value })
                    }
                    placeholder="Musterstrasse 12"
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
                <div className="grid gap-2">
                  <label htmlFor="correspondant" className="text-sm font-medium">
                    Kontaktperson
                  </label>
                  <Input
                    id="correspondant"
                    value={formData.correspondant}
                    onChange={(e) =>
                      setFormData({ ...formData, correspondant: e.target.value })
                    }
                    placeholder="Anna Beispiel"
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
                    placeholder="schule@beispiel.de"
                  />
                </div>
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
                  <label htmlFor="last_contacted" className="text-sm font-medium">
                    Letzter Kontakt
                  </label>
                  <Input
                    id="last_contacted"
                    type="date"
                    value={formData.last_contacted}
                    onChange={(e) =>
                      setFormData({ ...formData, last_contacted: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="priority_score" className="text-sm font-medium">
                    Prioritaet
                  </label>
                  <Input
                    id="priority_score"
                    type="number"
                    value={formData.priority_score}
                    onChange={(e) =>
                      setFormData({ ...formData, priority_score: e.target.value })
                    }
                    placeholder="1"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium">
                    Zustaendige Botschafter
                  </label>
                  <Popover
                    open={ambassadorPopoverOpen}
                    onOpenChange={setAmbassadorPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Input
                        placeholder="Botschafter suchen und hinzufuegen"
                        value={ambassadorSearch}
                        onChange={(event) => {
                          setAmbassadorSearch(event.target.value);
                          setAmbassadorPopoverOpen(true);
                        }}
                        onFocus={() => setAmbassadorPopoverOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && availableAmbassadors.length) {
                            event.preventDefault();
                            addAmbassador(availableAmbassadors[0].id);
                            setAmbassadorSearch("");
                            setAmbassadorPopoverOpen(true);
                          }
                        }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-2">
                      {ambassadorsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Lade Botschafter...
                        </div>
                      ) : availableAmbassadors.length ? (
                        <div className="grid gap-1">
                          {availableAmbassadors.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                addAmbassador(member.id);
                                setAmbassadorSearch("");
                              }}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                            >
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {member.email}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Keine Botschafter gefunden.
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <div className="flex flex-wrap gap-2">
                    {selectedAmbassadors.length ? (
                      selectedAmbassadors.map((member) => (
                        <span
                          key={member.id}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                        >
                          {member.name}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-muted"
                            onClick={() => removeAmbassador(member.id)}
                            aria-label={`Botschafter ${member.name} entfernen`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Noch keine Botschafter zugewiesen.
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
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
                Unterstuetzte Felder: name, adress, email, phone, city,
                correspondant, ambassadors, last_contacted, priority_score,
                active.
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
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="adress">Adresse</SelectItem>
              <SelectItem value="city">Stadt</SelectItem>
              <SelectItem value="correspondant">Kontaktperson</SelectItem>
              <SelectItem value="email">E-Mail</SelectItem>
              <SelectItem value="phone">Telefon</SelectItem>
              <SelectItem value="priority_score">Prioritaet</SelectItem>
              <SelectItem value="last_contacted">Letzter Kontakt</SelectItem>
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
                  <label htmlFor="filter-adress" className="text-sm font-medium">
                    Adresse enthaelt
                  </label>
                  <Input
                    id="filter-adress"
                    value={filtersDraft.adress}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        adress: event.target.value,
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
                  <label
                    htmlFor="filter-correspondant"
                    className="text-sm font-medium"
                  >
                    Kontaktperson enthaelt
                  </label>
                  <Input
                    id="filter-correspondant"
                    value={filtersDraft.correspondant}
                    onChange={(event) =>
                      setFiltersDraft((prev) => ({
                        ...prev,
                        correspondant: event.target.value,
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
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Letzter Kontakt Zeitraum
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      value={filtersDraft.lastContactedFrom}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          lastContactedFrom: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      value={filtersDraft.lastContactedTo}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          lastContactedTo: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Prioritaet Bereich</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filtersDraft.priorityMin}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          priorityMin: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filtersDraft.priorityMax}
                      onChange={(event) =>
                        setFiltersDraft((prev) => ({
                          ...prev,
                          priorityMax: event.target.value,
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
            placeholder="Suche Name, Adresse, Kontaktperson, E-Mail, Telefon, Stadt..."
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
                  <SelectItem value="adress">Adresse</SelectItem>
                  <SelectItem value="city">Stadt</SelectItem>
                  <SelectItem value="correspondant">Kontaktperson</SelectItem>
                  <SelectItem value="email">E-Mail</SelectItem>
                  <SelectItem value="phone">Telefon</SelectItem>
                  <SelectItem value="last_contacted">Letzter Kontakt</SelectItem>
                  <SelectItem value="priority_score">Prioritaet</SelectItem>
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
                  {bulkField === "last_contacted"
                    ? "Datum"
                    : bulkField === "priority_score"
                      ? "Prioritaet"
                      : "Neuer Wert"}
                </label>
                <Input
                  id="bulk-value"
                  type={
                    bulkField === "priority_score"
                      ? "number"
                      : bulkField === "last_contacted"
                        ? "date"
                        : "text"
                  }
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
        <Table className="min-w-[1400px]">
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
                  onClick={() => handleSortChange("adress")}
                  className="flex items-center gap-1"
                >
                  Adresse
                  {sortBy === "adress" ? (
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
                  onClick={() => handleSortChange("correspondant")}
                  className="flex items-center gap-1"
                >
                  Kontaktperson
                  {sortBy === "correspondant" ? (
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
              <TableHead>Botschafter</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => handleSortChange("last_contacted")}
                  className="flex items-center gap-1"
                >
                  Letzter Kontakt
                  {sortBy === "last_contacted" ? (
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
                  onClick={() => handleSortChange("priority_score")}
                  className="flex items-center gap-1"
                >
                  Prioritaet
                  {sortBy === "priority_score" ? (
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
                <TableCell colSpan={14} className="h-24 text-center">
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-24 text-center">
                  Keine Schulen gefunden, die deinen Kriterien entsprechen.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const created = formatTimestamp(member.created);
                const updated = formatTimestamp(member.updated);
                const ambassadorIds = Array.isArray(member.ambassadors)
                  ? member.ambassadors
                  : [];
                const ambassadorNames = ambassadorIds
                  .map((id) => ambassadorsById[id]?.name)
                  .filter(Boolean);
                const ambassadorLabel =
                  ambassadorNames.length > 2
                    ? `${ambassadorNames.slice(0, 2).join(", ")} +${
                        ambassadorNames.length - 2
                      }`
                    : ambassadorNames.join(", ");

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
                    <TableCell className="font-medium">
                      {member.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.adress || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{member.city}</TableCell>
                    <TableCell className="text-sm">
                      {member.correspondant || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{member.email}</TableCell>
                    <TableCell className="text-sm">{member.phone}</TableCell>
                    <TableCell className="text-sm">
                      {ambassadorsLoading ? (
                        <span className="text-xs text-muted-foreground">
                          Lade...
                        </span>
                      ) : ambassadorLabel ? (
                        ambassadorLabel
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateLabel(member.last_contacted)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.priority_score ?? "-"}
                    </TableCell>
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
