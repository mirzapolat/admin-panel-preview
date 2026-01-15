"use client";

import { useEffect, useMemo, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EventRecord = {
  id: string;
  name: string;
  description: string;
  date: string;
  category: string;
  ambassadors: string[];
  created: string;
  updated: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
};

type EventFormState = {
  name: string;
  description: string;
  date: string;
  category: string;
  ambassadors: string[];
};

const defaultForm: EventFormState = {
  name: "",
  description: "",
  date: "",
  category: "",
  ambassadors: [],
};

const formatDateLabel = (value: string) => {
  if (!value) return "-";
  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("de-DE");
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: "-", time: "" };
  }
  return {
    date: date.toLocaleDateString("de-DE"),
    time: date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

const toDateKey = (value: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateKeyFromDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function EventsBoard() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [formData, setFormData] = useState<EventFormState>(defaultForm);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const membersById = useMemo(() => {
    return members.reduce<Record<string, Member>>((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, {});
  }, [members]);

  const selectedMembers = useMemo(() => {
    return formData.ambassadors
      .map((id) => membersById[id])
      .filter(Boolean);
  }, [formData.ambassadors, membersById]);

  const availableMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const candidates = members.filter(
      (member) => !formData.ambassadors.includes(member.id)
    );
    const filtered = query
      ? candidates.filter((member) =>
          `${member.name} ${member.email}`.toLowerCase().includes(query)
        )
      : candidates;
    return filtered.slice(0, 8);
  }, [memberSearch, members, formData.ambassadors]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, EventRecord[]>>((acc, event) => {
      const key = toDateKey(event.date);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [events]);

  const monthLabel = useMemo(() => {
    return calendarMonth.toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric",
    });
  }, [calendarMonth]);

  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );
    const startOffset = (startOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1 - startOffset
    );
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [calendarMonth]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("events").getFullList<EventRecord>({
        sort: "date",
      });
      setEvents(records);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const records = await pb.collection("members").getFullList<Member>({
        sort: "name",
      });
      setMembers(records);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchMembers();
  }, []);

  const openCreate = () => {
    setEditingEvent(null);
    setFormData(defaultForm);
    setMemberSearch("");
    setDialogOpen(true);
  };

  const openEdit = (event: EventRecord) => {
    setEditingEvent(event);
    setFormData({
      name: event.name ?? "",
      description: event.description ?? "",
      date: event.date ? event.date.slice(0, 10) : "",
      category: event.category ?? "",
      ambassadors: Array.isArray(event.ambassadors) ? event.ambassadors : [],
    });
    setMemberSearch("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Bitte einen Namen fuer das Event angeben.");
      return;
    }
    if (!formData.date) {
      alert("Bitte ein Datum fuer das Event angeben.");
      return;
    }
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: formData.date,
        category: formData.category.trim(),
        ambassadors: formData.ambassadors,
      };

      if (editingEvent) {
        await pb.collection("events").update(editingEvent.id, payload);
      } else {
        await pb.collection("events").create(payload);
      }
      setDialogOpen(false);
      setEditingEvent(null);
      setFormData(defaultForm);
      fetchEvents();
    } catch (error: any) {
      console.error("Error saving event:", error);
      alert(`Event konnte nicht gespeichert werden. Fehler: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    if (!confirm("Moechtest du dieses Event wirklich loeschen?")) return;
    try {
      await pb.collection("events").delete(editingEvent.id);
      setDialogOpen(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Verwalte Events, Kategorien und zustaendige Botschafter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Event erstellen
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <Pencil className="h-4 w-4" />
            Liste
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Kalender
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="rounded-md border bg-card overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Zustaendig</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Noch keine Events vorhanden.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => {
                    const ambassadors = event.ambassadors ?? [];
                    const names = ambassadors
                      .map((id) => membersById[id]?.name)
                      .filter(Boolean);
                    const displayNames =
                      names.length > 2
                        ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
                        : names.join(", ");
                    return (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openEdit(event)}
                      >
                        <TableCell>
                          <div className="font-medium">{event.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {event.description || "Keine Beschreibung"}
                          </div>
                        </TableCell>
                        <TableCell>{formatDateLabel(event.date)}</TableCell>
                        <TableCell>{event.category || "-"}</TableCell>
                        <TableCell>
                          {membersLoading ? (
                            <span className="text-xs text-muted-foreground">
                              Lade Botschafter...
                            </span>
                          ) : displayNames ? (
                            displayNames
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(eventClick) => {
                              eventClick.stopPropagation();
                              openEdit(event);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Bearbeiten</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="rounded-md border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-lg font-semibold capitalize">{monthLabel}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                        1
                      )
                    )
                  }
                  aria-label="Vorheriger Monat"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        1
                      )
                    )
                  }
                  aria-label="Naechster Monat"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-px rounded-md bg-border">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
                <div
                  key={day}
                  className="bg-muted/40 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const isCurrentMonth =
                  day.getMonth() === calendarMonth.getMonth();
                const key = toDateKeyFromDate(day);
                const dayEvents = eventsByDate[key] ?? [];
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[110px] bg-background p-2 text-xs",
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold">
                        {day.getDate()}
                      </span>
                      {dayEvents.length ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openEdit(event)}
                          className="w-full rounded-md border border-border bg-muted/60 px-2 py-1 text-left text-[11px] font-medium hover:bg-muted"
                        >
                          {event.name}
                        </button>
                      ))}
                      {dayEvents.length > 3 ? (
                        <div className="text-[10px] text-muted-foreground">
                          +{dayEvents.length - 3} weitere
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Event bearbeiten" : "Neues Event erstellen"}
            </DialogTitle>
            <DialogDescription>
              Alle Details inklusive Botschafter verwalten.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="event-name" className="text-sm font-medium">
                  Eventname
                </label>
                <Input
                  id="event-name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Campus Meetup Berlin"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="event-category" className="text-sm font-medium">
                  Kategorie
                </label>
                <Input
                  id="event-category"
                  value={formData.category}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                  placeholder="Workshop, Vortrag, Networking"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="event-date" className="text-sm font-medium">
                  Datum
                </label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.date}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Zustaendige Botschafter
                </label>
                <Popover
                  open={memberPopoverOpen}
                  onOpenChange={setMemberPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Input
                      placeholder="Botschafter suchen und hinzufuegen"
                      value={memberSearch}
                      onChange={(event) => {
                        setMemberSearch(event.target.value);
                        setMemberPopoverOpen(true);
                      }}
                      onFocus={() => setMemberPopoverOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && availableMembers.length) {
                          event.preventDefault();
                          addAmbassador(availableMembers[0].id);
                          setMemberSearch("");
                          setMemberPopoverOpen(true);
                        }
                      }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-2">
                    {membersLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Lade Botschafter...
                      </div>
                    ) : availableMembers.length ? (
                      <div className="grid gap-1">
                        {availableMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              addAmbassador(member.id);
                              setMemberSearch("");
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
                  {selectedMembers.length ? (
                    selectedMembers.map((member) => (
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
            </div>
            <div className="grid gap-2">
              <label htmlFor="event-description" className="text-sm font-medium">
                Beschreibung
              </label>
              <textarea
                id="event-description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Details, Ablauf, Ziele..."
                className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {editingEvent ? (
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  Erstellt: {formatTimestamp(editingEvent.created).date}{" "}
                  {formatTimestamp(editingEvent.created).time}
                </div>
                <div>
                  Zuletzt bearbeitet: {formatTimestamp(editingEvent.updated).date}{" "}
                  {formatTimestamp(editingEvent.updated).time}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            {editingEvent ? (
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Loeschen
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
