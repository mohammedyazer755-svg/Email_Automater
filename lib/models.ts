export interface Group {
  id: string;
  name: string;
  color: string;
}
export interface Contact {
  id: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
  source_import_id: string | null;
  imports?: { filename: string };
  contact_group_members?: { group_id: string; contact_groups: Group }[];
}
export interface Import {
  id: string;
  filename: string;
  created_at: string;
  total_rows: number;
  total_emails_detected: number;
  duplicates_removed: number;
  invalid_entries: number;
  blank_entries: number;
  unique_recipients: number;
  status: string;
  email_columns: { sheet: string; column: string; confidence: number }[];
}
export interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  body_html: string;
  body_text: string;
  updated_at: string;
}
export interface Attachment {
  filename: string;
  path: string;
  size: number;
  mime: string;
}
export interface Campaign {
  id: string;
  name: string;
  subject: string;
  from_name: string;
  reply_to: string;
  body_html: string;
  body_text: string;
  sender_id: string | null;
  attachments: Attachment[];
  status: string;
  created_at: string;
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  bounced_count: number;
  stats?: Record<string, number>;
}
export interface Sender {
  id: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  verified: boolean;
  is_default: boolean;
}
export interface Delivery {
  id: string;
  recipient_email: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
  campaigns?: { name: string };
}
export interface Step {
  step_type: 'send_email' | 'wait' | 'condition';
  config: {
    template_id?: string;
    subject_override?: string;
    duration_hours?: number;
    status?: string;
    operator?: string;
  };
}
export interface Automation {
  automation_steps?: { count: number }[];
  automation_enrollments?: { count: number }[];
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: { group_id?: string; schedule_cron?: string; timezone?: string };
  sender_id: string;
  status: string;
  created_at: string;
  steps: Step[];
}
export interface Enrollment {
  id: string;
  contacts: { email: string };
  step_index: number;
  status: string;
  next_action_at: string;
  error_message: string | null;
}
export interface List<T> {
  items: T[];
  count: number;
}
