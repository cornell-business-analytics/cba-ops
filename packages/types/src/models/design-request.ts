export type DesignRequestStatus =
  | "pending"
  | "rejected"
  | "approved"
  | "dispatch_failed"
  | "agent_running"
  | "agent_failed"
  | "pr_open"
  | "merge_failed"
  | "merged"
  | "discarded";

export interface DesignRequest {
  id: string;
  requested_by_id: string | null;
  description: string;
  attachment_url: string | null;
  target_path: string | null;
  status: DesignRequestStatus;

  reviewed_by_id: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;

  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;

  dispatched_at: string | null;
  agent_completed_at: string | null;
  agent_error: string | null;

  preview_url: string | null;

  confirmed_by_id: string | null;
  confirmed_at: string | null;
  merged_at: string | null;
  discarded_at: string | null;

  created_at: string | null;
}

export interface DesignRequestStatusCheck {
  /**
   * "missing_checks" means a required CI check never reported at all — the
   * change is unverified rather than still running, and must not be merged.
   */
  ci_status: "success" | "failure" | "pending" | "missing_checks" | null;
  preview_url: string | null;
  mergeable: boolean | null;
  pr_url: string | null;
}
