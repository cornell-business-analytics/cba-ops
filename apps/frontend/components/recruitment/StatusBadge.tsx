import { Badge } from "@/components/ui/badge";
import type { CandidateStatus } from "@cba/types";

const config: Record<CandidateStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "info" | "destructive" | "outline" }> = {
  applied:      { label: "Applied",      variant: "secondary" },
  round_1:      { label: "Round 1",      variant: "info" },
  round_2:      { label: "Round 2",      variant: "warning" },
  round_3:      { label: "Round 3",      variant: "default" },
  offer:        { label: "Offer",        variant: "success" },
  accepted:     { label: "Accepted",     variant: "success" },
  coffee_chat:  { label: "Coffee Chat",  variant: "info" },
  interviewing: { label: "Interviewing", variant: "warning" },
  rejected:     { label: "Rejected",     variant: "destructive" },
  withdrawn:    { label: "Withdrawn",    variant: "outline" },
};

export function StatusBadge({ status }: { status: CandidateStatus }) {
  const { label, variant } = config[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}
