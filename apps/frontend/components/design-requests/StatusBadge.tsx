import {
  Clock,
  ThumbsDown,
  ThumbsUp,
  Loader2,
  AlertTriangle,
  GitPullRequest,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DesignRequestStatus } from "@cba/types";

const STATUS_CONFIG: Record<
  DesignRequestStatus,
  { label: string; icon: typeof Clock; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }
> = {
  pending: { label: "Pending review", icon: Clock, variant: "warning" },
  approved: { label: "Approved", icon: ThumbsUp, variant: "info" },
  rejected: { label: "Rejected", icon: ThumbsDown, variant: "destructive" },
  dispatch_failed: { label: "Dispatch failed", icon: AlertTriangle, variant: "destructive" },
  agent_running: { label: "Agent running…", icon: Loader2, variant: "info" },
  agent_failed: { label: "Agent failed", icon: AlertTriangle, variant: "destructive" },
  pr_open: { label: "PR open", icon: GitPullRequest, variant: "info" },
  merge_failed: { label: "Merge failed", icon: AlertTriangle, variant: "destructive" },
  merged: { label: "Merged", icon: CheckCircle2, variant: "success" },
  discarded: { label: "Discarded", icon: XCircle, variant: "outline" },
};

export function StatusBadge({ status }: { status: DesignRequestStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="whitespace-nowrap">
      <Icon className={`mr-1 h-3 w-3 ${status === "agent_running" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}
