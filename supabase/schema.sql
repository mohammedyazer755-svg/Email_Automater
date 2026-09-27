-- ==============================================================================
-- Smart Email Automation Platform — PostgreSQL Schema for Supabase
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. SENDER IDENTITIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sender_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  is_default BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sender_identities_user_id ON sender_identities(user_id);

-- ------------------------------------------------------------------------------
-- 2. IMPORTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size_bytes INT DEFAULT 0,
  total_rows INT DEFAULT 0,
  total_emails_detected INT DEFAULT 0,
  duplicates_removed INT DEFAULT 0,
  invalid_entries INT DEFAULT 0,
  blank_entries INT DEFAULT 0,
  unique_recipients INT DEFAULT 0,
  email_columns JSONB DEFAULT '[]'::jsonb, -- [{sheet, column, confidence, sampleEmails}]
  status TEXT DEFAULT 'completed', -- 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imports_user_id ON imports(user_id);
CREATE INDEX IF NOT EXISTS idx_imports_created_at ON imports(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. CONTACTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  source_import_id UUID REFERENCES imports(id) ON DELETE SET NULL,
  source_sheet TEXT,
  source_row INT,
  source_column TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'unsubscribed', 'bounced', 'invalid'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_source_import_id ON contacts(source_import_id);

-- ------------------------------------------------------------------------------
-- 4. CONTACT GROUPS & MEMBERSHIP
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_groups_user_id ON contact_groups(user_id);

CREATE TABLE IF NOT EXISTS contact_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_group_members_group_id ON contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact_id ON contact_group_members(contact_id);

-- ------------------------------------------------------------------------------
-- 5. TEMPLATES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  category TEXT DEFAULT 'general', -- 'confirmation', 'reminder', 'announcement', 'update', 'certificate', 'general'
  is_starter BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

-- ------------------------------------------------------------------------------
-- 6. CAMPAIGNS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_name TEXT NOT NULL,
  reply_to TEXT,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'paused', 'failed'
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{filename, url, sizeBytes, mimeType}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. EMAIL QUEUE & DELIVERY LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'queued', -- 'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced'
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  attempted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_id ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_email ON email_queue(recipient_email);

-- ------------------------------------------------------------------------------
-- 8. AUTOMATION WORKFLOWS (Phase 7)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'contact_imported', 'manual', 'scheduled'
  trigger_config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_type TEXT NOT NULL, -- 'send_email', 'wait', 'condition'
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'exited'
  next_action_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- TRIGGERS FOR UPDATED_AT
-- ------------------------------------------------------------------------------
CREATE TRIGGER trigger_update_sender_identities_updated_at
  BEFORE UPDATE ON sender_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE sender_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_enrollments ENABLE ROW LEVEL SECURITY;

-- sender_identities policies
CREATE POLICY "Users can view own sender identities" ON sender_identities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sender identities" ON sender_identities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sender identities" ON sender_identities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sender identities" ON sender_identities FOR DELETE USING (auth.uid() = user_id);

-- imports policies
CREATE POLICY "Users can view own imports" ON imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own imports" ON imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own imports" ON imports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own imports" ON imports FOR DELETE USING (auth.uid() = user_id);

-- contacts policies
CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE USING (auth.uid() = user_id);

-- contact_groups policies
CREATE POLICY "Users can view own contact groups" ON contact_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own contact groups" ON contact_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contact groups" ON contact_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contact groups" ON contact_groups FOR DELETE USING (auth.uid() = user_id);

-- contact_group_members policies
CREATE POLICY "Users can view own contact group members" ON contact_group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM contact_groups WHERE contact_groups.id = contact_group_members.group_id AND contact_groups.user_id = auth.uid())
);
CREATE POLICY "Users can create own contact group members" ON contact_group_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM contact_groups WHERE contact_groups.id = contact_group_members.group_id AND contact_groups.user_id = auth.uid())
);
CREATE POLICY "Users can delete own contact group members" ON contact_group_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM contact_groups WHERE contact_groups.id = contact_group_members.group_id AND contact_groups.user_id = auth.uid())
);

-- templates policies
CREATE POLICY "Users can view own or starter templates" ON templates FOR SELECT USING (auth.uid() = user_id OR is_starter = true);
CREATE POLICY "Users can create own templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id);

-- campaigns policies
CREATE POLICY "Users can view own campaigns" ON campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);

-- email_queue policies
CREATE POLICY "Users can view own email queue entries" ON email_queue FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = email_queue.campaign_id AND campaigns.user_id = auth.uid())
);
CREATE POLICY "Users can insert own email queue entries" ON email_queue FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = email_queue.campaign_id AND campaigns.user_id = auth.uid())
);
CREATE POLICY "Users can update own email queue entries" ON email_queue FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = email_queue.campaign_id AND campaigns.user_id = auth.uid())
);

-- automations policies
CREATE POLICY "Users can view own automations" ON automations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own automations" ON automations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automations" ON automations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automations" ON automations FOR DELETE USING (auth.uid() = user_id);

-- automation_steps policies
CREATE POLICY "Users can view own automation steps" ON automation_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
);
CREATE POLICY "Users can manage own automation steps" ON automation_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
);

-- automation_enrollments policies
CREATE POLICY "Users can view own automation enrollments" ON automation_enrollments FOR SELECT USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_enrollments.automation_id AND automations.user_id = auth.uid())
);
CREATE POLICY "Users can manage own automation enrollments" ON automation_enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_enrollments.automation_id AND automations.user_id = auth.uid())
);
