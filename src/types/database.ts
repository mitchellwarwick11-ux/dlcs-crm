// Hand-written types matching the current Supabase schema.
// Run `npx supabase gen types typescript --linked > src/types/database.ts` to auto-generate.

export type JobType = 'survey' | 'sewer_water' | 'internal'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived'
export type QuoteStatus = 'draft' | 'issued' | 'accepted' | 'declined' | 'cancelled'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type TaskStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type UserRole = 'administration' | 'registered_surveyor' | 'office_surveyor' | 'field_surveyor' | 'drafting' | 'sewer_water_designer' | (string & {})
export type FieldScheduleStatus = 'must_happen' | 'asap' | 'scheduled' | 'completed' | 'cancelled'

// Convenience types for field schedule feature
export interface ScheduleEquipmentRow {
  id: string
  label: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface FieldScheduleEntryRow {
  id: string
  date: string
  project_id: string
  task_id: string | null
  office_surveyor_id: string | null
  hours: number | null
  time_of_day: 'am' | 'pm' | null
  status: FieldScheduleStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleEntryFull extends FieldScheduleEntryRow {
  projects: {
    id: string
    job_number: string
    site_address: string | null
    suburb: string | null
    clients: { name: string; company_name: string | null } | null
    job_manager: { id: string; full_name: string } | null
  } | null
  project_tasks: { id: string; title: string; due_date?: string | null } | null
  office_surveyor: { id: string; full_name: string } | null
  field_surveyors: { id: string; full_name: string }[]
  resources: { id: string; label: string }[]
}

export type Database = {
  public: {
    Tables: {
      staff_profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: UserRole
          default_hourly_rate: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['staff_profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['staff_profiles']['Insert']>
      }
      clients: {
        Row: {
          id: string
          name: string
          company_name: string | null
          email: string | null
          phone: string | null
          address_line1: string | null
          address_line2: string | null
          suburb: string | null
          state: string | null
          postcode: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
      }
      task_definitions: {
        Row: {
          id: string
          name: string
          applicable_job_type: JobType | null
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_definitions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['task_definitions']['Insert']>
      }
      projects: {
        Row: {
          id: string
          job_number: string
          year: number
          sequence: number
          job_type: JobType
          status: ProjectStatus
          client_id: string | null
          job_manager_id: string | null
          title: string
          description: string | null
          site_address: string | null
          suburb: string | null
          lot_number: string | null
          plan_number: string | null
          local_authority: string | null
          purchase_order_number: string | null
          is_billable: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      project_contacts: {
        Row: {
          id: string
          project_id: string
          name: string
          email: string | null
          phone: string | null
          role: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['project_contacts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['project_contacts']['Insert']>
      }
      project_staff_rates: {
        Row: {
          id: string
          project_id: string
          staff_id: string
          hourly_rate: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['project_staff_rates']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['project_staff_rates']['Insert']>
      }
      project_tasks: {
        Row: {
          id: string
          project_id: string
          task_definition_id: string | null
          title: string
          description: string | null
          status: TaskStatus
          fee_type: 'fixed' | 'hourly' | 'non_billable'
          quoted_amount: number | null
          claimed_amount: number
          due_date: string | null
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['project_tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['project_tasks']['Insert']>
      }
      task_assignments: {
        Row: {
          id: string
          task_id: string
          staff_id: string
          estimated_hours: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_assignments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['task_assignments']['Insert']>
      }
      time_entries: {
        Row: {
          id: string
          project_id: string
          task_id: string | null
          staff_id: string
          date: string
          hours: number
          description: string | null
          is_billable: boolean
          rate_at_time: number
          invoice_item_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['time_entries']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['time_entries']['Insert']>
      }
      quotes: {
        Row: {
          id: string
          project_id: string | null
          quote_number: string
          status: QuoteStatus
          subtotal: number
          gst_amount: number
          total: number
          notes: string | null
          valid_until: string | null
          sent_at: string | null
          approved_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          // New columns added in quotes_redesign migration
          client_id: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          site_address: string | null
          suburb: string | null
          lot_number: string | null
          plan_number: string | null
          job_type: string | null
          template_key: string | null
          selected_scope_items: string[] | null
          selected_note_items: string[] | null
        }
        Insert: Omit<Database['public']['Tables']['quotes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['quotes']['Insert']>
      }
      quote_number_sequences: {
        Row: { id: number; last_sequence: number }
        Insert: Database['public']['Tables']['quote_number_sequences']['Row']
        Update: Partial<Database['public']['Tables']['quote_number_sequences']['Row']>
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          task_id: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['quote_items']['Row'], 'id' | 'amount' | 'created_at'>
        Update: Partial<Database['public']['Tables']['quote_items']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          project_id: string
          quote_id: string | null
          invoice_number: string
          status: InvoiceStatus
          subtotal: number
          gst_amount: number
          total: number
          notes: string | null
          due_date: string | null
          sent_at: string | null
          paid_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          time_entry_id: string | null
          task_id: string | null
          prev_claimed_amount: number | null
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoice_items']['Row'], 'id' | 'amount' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>
      }
      documents: {
        Row: {
          id: string
          project_id: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          mime_type: string | null
          uploaded_by: string | null
          uploaded_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'uploaded_at'>
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
      role_rates: {
        Row: {
          id: string
          role_key: string
          label: string
          hourly_rate: number
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['role_rates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['role_rates']['Insert']>
      }
      company_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: Database['public']['Tables']['company_settings']['Row']
        Update: Partial<Database['public']['Tables']['company_settings']['Row']>
      }
      purchase_orders: {
        Row: {
          id: string
          project_id: string
          po_number: string
          issued_by: string | null
          issued_date: string | null
          amount: number | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      job_number_sequences: {
        Row: { year: number; last_sequence: number }
        Insert: Database['public']['Tables']['job_number_sequences']['Row']
        Update: Partial<Database['public']['Tables']['job_number_sequences']['Row']>
      }
      fee_proposal_templates: {
        Row: {
          id: string
          label: string
          scope_items: string[]
          please_note_items: string[]
          valid_until_days: number
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['fee_proposal_templates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['fee_proposal_templates']['Insert']>
      }
    }
    Functions: {
      generate_job_number: {
        Args: Record<string, never>
        Returns: string
      }
      generate_quote_number: {
        Args: Record<string, never>
        Returns: string
      }
    }
  }
}

// Convenience row types
export type RoleRate = Database['public']['Tables']['role_rates']['Row']
export type StaffProfile = Database['public']['Tables']['staff_profiles']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type TaskDefinition = Database['public']['Tables']['task_definitions']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectTask = Database['public']['Tables']['project_tasks']['Row']
export type TimeEntry = Database['public']['Tables']['time_entries']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']
export type QuoteItem = Database['public']['Tables']['quote_items']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']

// Extended types with joins
export type ProjectWithClient = Project & {
  clients: Pick<Client, 'id' | 'name' | 'company_name'> | null
}

export type FeeProposalTemplate = Database['public']['Tables']['fee_proposal_templates']['Row']

export type ProjectTaskWithDefinition = ProjectTask & {
  task_definitions: Pick<TaskDefinition, 'id' | 'name'> | null
}

// ─── Task Items (sub-units of work within a task) ────────────────────────
export interface TaskItem {
  id: string
  task_id: string
  title: string
  description: string | null
  status: TaskStatus
  due_date: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskItemAssignment {
  id: string
  item_id: string
  staff_id: string
  created_at: string
}
