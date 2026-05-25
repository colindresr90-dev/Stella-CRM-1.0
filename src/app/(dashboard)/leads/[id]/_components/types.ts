export type Lead = {
  id: string
  business_name: string
  contact_name: string
  phone: string | null
  email: string | null
  source: string | null
  status: string
  package: string | null
  sale_price: number | null
  deposit_amount: number | null
  pending_amount: number | null
  payment_status: string | null
  assigned_to: string
  created_by: string
  created_at: string
  creator?: { name: string } | null
  assigned_user?: { id: string, name: string } | null
  reminder_date: string | null
  reminder_note: string | null
  reminder_time: string | null
  closed_at: string | null
  industry: string | null
  notes: string | null
}

export type Sale = {
  id: string
  lead_id: string
  package: string
  custom_name: string | null
  custom_description: string | null
  total_amount: number
  deposit_amount: number
  pending_amount: number
  status: 'pendiente' | 'pagado'
  created_by: string
  created_at: string
  creator?: { name: string } | null
}

export type Note = {
  id: string
  lead_id: string
  content: string
  created_by: string
  created_at: string
}

export type Activity = {
  id: string
  lead_id: string
  type: string
  description: string
  created_at: string
  creator?: { name: string } | null
  profiles?: { name: string } | null
}

export type FileRecord = {
  id: string
  lead_id: string
  file_url: string
  file_name: string
  uploaded_by: string
  created_at: string
  uploader?: { name: string } | null
  profiles?: { name: string } | null
}

export type Meeting = {
  id: string
  lead_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  meet_link: string | null
  google_event_id: string | null
  created_by: string
  created_at: string
}

export type Reminder = {
  id: string
  lead_id: string
  date: string
  time: string | null
  note: string | null
  is_completed: boolean
  created_by: string
  created_at: string
}
