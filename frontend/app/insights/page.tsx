"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  Loader2,
  CheckSquare,
  ClipboardList,
  Phone,
  Gift,
  XCircle,
  Bell,
  Share2,
  Download,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAnalyticsOverview, type AnalyticsOverview } from "@/lib/api";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const STAGE_ORDER = ["Applied", "Screening", "Interview", "Offer", "Rejected"];
const STAGE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  Applied: {
    label: "Applications",
    color: "#8b5cf6",
    icon: <CheckSquare className="h-4 w-4" />,
  },
  Screening: {
    label: "Screening",
    color: "#0ea5e9",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  Interview: {
    label: "Interview",
    color: "#10b981",
    icon: <Phone className="h-4 w-4" />,
  },
  Offer: {
    label: "Offer / Hired",
    color: "#f59e0b",
    icon: <Gift className="h-4 w-4" />,
  },
  Rejected: {
    label: "Rejected",
    color: "#ef4444",
    icon: <XCircle className="h-4 w-4" />,
  },
};

function stageLabel(stage: string): string {
  return STAGE_CONFIG[stage]?.label ?? stage;
}

export default function InsightsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalyticsOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = data?.total ?? 0;
  const byStage = data?.by_stage ?? {};
  const orderedStages = STAGE_ORDER.filter((s) => (byStage[s] ?? 0) > 0);
  const pieData = orderedStages.map((stage) => ({
    name: stageLabel(stage),
    value: byStage[stage] ?? 0,
    color: STAGE_CONFIG[stage]?.color ?? "#94a3b8",
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="font-semibold text-primary">
            RecruitOS
          </Link>
          <nav className="flex gap-4">
            <Link
              href="/calibrate"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Calibrate
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/pipeline"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pipeline
            </Link>
            <Link
              href="/insights"
              className="text-sm font-medium text-primary underline"
            >
              Insights
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </button>
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Download">
              <Download className="h-4 w-4" />
            </button>
            <button type="button" className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label="Report">
              <FileText className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Overview – Hires</h1>
        </div>

        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">At a Glance</h2>
          <p className="mb-4 text-xs text-muted-foreground">All requisitions · current snapshot</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {STAGE_ORDER.map((stage) => {
              const count = byStage[stage] ?? 0;
              const cfg = STAGE_CONFIG[stage];
              return (
                <Card key={stage} className="border-border/80">
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold tabular-nums text-foreground">{count.toLocaleString()}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{cfg?.label ?? stage}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Pipeline distribution</h2>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No candidates yet</p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, ""]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Hiring trends</h2>
              </CardHeader>
              <CardContent>
                {total === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No candidates yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Stage</th>
                          <th className="pb-2 pr-4 font-medium text-right">Candidates</th>
                          <th className="pb-2 font-medium text-right">% of total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedStages.map((stage) => {
                          const n = byStage[stage] ?? 0;
                          const pct = total > 0 ? (100 * n) / total : 0;
                          return (
                            <tr key={stage} className="border-b last:border-0">
                              <td className="py-3 pr-4">{stageLabel(stage)}</td>
                              <td className="py-3 pr-4 text-right font-medium tabular-nums">{n.toLocaleString()}</td>
                              <td className="py-3 text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {data?.by_requisition && data.by_requisition.length > 0 && (
          <section className="mt-8">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">By requisition</h2>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Requisition</th>
                        <th className="pb-2 pr-4 font-medium">Role</th>
                        {STAGE_ORDER.map((s) => (
                          <th key={s} className="pb-2 pr-4 font-medium text-right">
                            {stageLabel(s)}
                          </th>
                        ))}
                        <th className="pb-2 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_requisition.map((req) => (
                        <tr key={req.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{req.requisition_name}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{req.role}</td>
                          {STAGE_ORDER.map((s) => (
                            <td key={s} className="py-3 pr-4 text-right tabular-nums">
                              {req.by_stage[s] ?? 0}
                            </td>
                          ))}
                          <td className="py-3 text-right font-medium tabular-nums">{req.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
