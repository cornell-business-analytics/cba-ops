import { Badge } from "@/components/ui/badge";
import type { CandidateStatus } from "@cba/types";

const config: Record<CandidateStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" | "outline" }> = {
  applied:      { label: "Applied",      variant: "secondary" },
  coffee_chat:  { label: "Coffee Chat",  variant: "info" },
  interviewing: { label: "Interviewing", variant: "warning" },
  offer:        { label: "Offer",        variant: "default" },
  accepted:     { label: "Accepted",     variant: "success" },
  rejected:     { label: "Rejected",     variant: "destructive" },
  withdrawn:    { label: "Withdrawn",    variant: "outline" },
};

export function StatusBadge({ status }: { status: CandidateStatus }) {
  const { label, variant } = config[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}
