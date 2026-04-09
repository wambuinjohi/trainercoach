// ============================================================================
// USER TYPES
// ============================================================================

export type UserType = 'client' | 'trainer' | 'admin'

/**
 * AccountStatus tracks the approval lifecycle for trainer accounts
 *
 * State Transitions:
 * registered → profile_incomplete (required after signup)
 * profile_incomplete → pending_approval (once profile is minimally complete)
 * pending_approval → approved (admin approves after document review) | rejected (admin rejects)
 * approved → suspended (admin suspension for violations)
 * suspended → approved (admin can reinstate)
 *
 * Client accounts are automatically 'approved' upon signup
 */
export type AccountStatus = 'registered' | 'profile_incomplete' | 'pending_approval' | 'approved' | 'suspended'

/**
 * TrainerApprovalPhase provides fine-grained sub-state during approval process
 * Used to guide trainer through required steps
 *
 * profile_setup: Trainer has registered, setting up profile
 * documents_pending: Profile done, waiting for trainer to upload documents
 * documents_reviewing: Documents uploaded, admin is reviewing
 * awaiting_approval: Documents approved, awaiting final admin approval
 * approved: Trainer fully approved and active
 */
export type TrainerApprovalPhase = 'profile_setup' | 'documents_pending' | 'documents_reviewing' | 'awaiting_approval' | 'approved'

export type RegistrationPath = 'direct' | 'sponsored'

export interface User {
  id: string
  email: string
  user_type: UserType
  created_at?: string
  updated_at?: string
}

export interface UserProfile {
  user_id: string
  user_type: UserType
  full_name?: string
  phone_number?: string
  email?: string
  profile_image?: string
  bio?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
  location_label?: string
  location_lat?: number
  location_lng?: number
  is_approved?: boolean
}

export interface TrainerProfile extends UserProfile {
  disciplines?: string[] // Discipline IDs (DEPRECATED - use categories instead)
  certifications?: string[] // DEPRECATED - use document uploads instead
  hourly_rate?: number
  service_radius?: number // in km, default 5
  area_of_residence?: string
  mpesa_number?: string
  rating?: number
  total_reviews?: number
  availability?: Record<string, any> // JSON: day -> time slots
  account_status?: AccountStatus
  is_verified?: boolean
  sponsor_trainer_id?: string | null // Trainer ID if sponsored by another trainer
  registration_path?: RegistrationPath // 'direct' or 'sponsored'
  path_locked?: boolean // Prevents changing path after documents submitted

  // Document upload fields
  id_document_url?: string
  id_document_status?: 'pending' | 'verified' | 'rejected'
  id_number?: string

  discipline_certificate_url?: string
  discipline_certificate_status?: 'pending' | 'verified' | 'rejected'

  good_conduct_url?: string
  good_conduct_status?: 'pending' | 'grace_period' | 'verified' | 'rejected'
  good_conduct_grace_period_start?: string // ISO timestamp
  good_conduct_grace_period_end?: string // ISO timestamp (calculated 30 days from start)

  sponsorship_reference_url?: string
  payout_details?: string | Record<string, any>

  // New document and sponsorship fields
  documents?: VerificationDocument[]
  sponsorship?: {
    sponsor_trainer_id?: string | null
    sponsor_name?: string
    reference_document_url?: string
    status?: 'pending' | 'approved' | 'rejected'
  }
  grace_period?: {
    start_date?: string // ISO timestamp
    end_date?: string // ISO timestamp
    reason?: string
    status?: 'active' | 'expired'
  }
}

export interface ClientProfile extends UserProfile {
  saved_location_lat?: number
  saved_location_lng?: number
  saved_location_label?: string
  location_permission_granted?: boolean
}

// ============================================================================
// DISCIPLINE TYPES
// ============================================================================

export type DisciplineStatus = 'approved' | 'pending_approval' | 'rejected'

export interface Category {
  id: string
  name: string
  icon?: string
  description?: string
  status?: 'active' | 'pending_approval' | 'rejected'
  created_by?: string
  reviewed_by?: string
  rejection_reason?: string
  reviewed_at?: string
  created_at?: string
  updated_at?: string
}

export interface Discipline {
  id: string
  name: string
  category_id?: string
  icon?: string
  description?: string
  status?: DisciplineStatus
  submitted_by?: string
  reviewed_by?: string
  admin_notes?: string
  submitted_at?: string
  reviewed_at?: string
  created_at?: string
  updated_at?: string
}

export interface DisciplineRecommendation {
  id: string
  trainer_id: string
  discipline_name: string
  description?: string
  status: DisciplineStatus
  created_at?: string
  reviewed_at?: string
  reviewed_by?: string
}

// ============================================================================
// BOOKING & SESSION TYPES
// ============================================================================

/**
 * BookingStatus represents the overall lifecycle state of a booking
 *
 * State Transitions:
 * pending → confirmed (trainer accepts) | cancelled (either party cancels)
 * confirmed → in_session (system auto-transitions or manual)
 * in_session → completed (trainer marks end)
 * completed → (terminal state)
 * cancelled, client_no_show → (terminal states)
 *
 * Actors:
 * - 'pending': waiting for trainer response (trainer can accept/decline)
 * - 'confirmed': ready for session (both parties have confirmed time)
 * - 'in_session': session is active or awaiting confirmation
 * - 'completed': session finished, both parties confirmed
 * - 'cancelled': cancelled by client or trainer before start
 * - 'client_no_show': trainer marked client didn't arrive
 */
export type BookingStatus = 'pending' | 'confirmed' | 'in_session' | 'completed' | 'cancelled' | 'client_no_show'

/**
 * BookingSessionPhase provides fine-grained sub-state during 'in_session' status
 *
 * waiting_start: Session time arrived, awaiting trainer confirmation to start
 * session_active: Trainer has confirmed start, session is underway
 * awaiting_completion: Trainer has marked end, awaiting client confirmation
 * completed: Both parties have confirmed session completion
 */
export type BookingSessionPhase = 'waiting_start' | 'session_active' | 'awaiting_completion' | 'completed'

export interface BookingSession {
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  duration_hours: number
}

export interface Booking {
  id: string
  client_id: string
  trainer_id: string
  discipline_id?: string
  category_id?: string
  session_date: string // ISO date
  session_time: string // HH:MM
  duration_hours: number
  total_sessions?: number
  status: BookingStatus
  session_phase?: BookingSessionPhase
  base_service_amount: number
  distance_fee?: number
  transport_fee?: number
  platform_fee?: number
  vat_amount?: number
  total_amount: number
  trainer_net_amount?: number
  notes?: string
  client_location_label?: string
  client_location_lat?: number
  client_location_lng?: number
  trainer_location_lat?: number
  trainer_location_lng?: number
  is_group_training?: boolean
  group_size?: number
  group_size_tier_name?: string
  pricing_model_used?: string

  // Multi-session support
  sessions?: BookingSession[] // Array of individual sessions for multi-session bookings

  // Confirmation tracking
  trainer_marked_start?: boolean // Trainer confirmed session start
  trainer_marked_end?: boolean // Trainer confirmed session end
  client_confirmed_completion?: boolean // Client confirmed session was completed

  // Rating & Review fields (Feature #19)
  rating_submitted?: boolean // Whether client submitted coach rating
  app_rating?: number // Client rating of the app (1-5)
  app_review?: string // Client review/recommendations about the app
  coach_rating?: number // Coach rating (1-5)
  coach_review?: string // Coach review text

  // Issue tracking
  reported_issue_count?: number // Number of issues/disputes raised for this booking

  created_at?: string
  updated_at?: string
  completed_at?: string
  started_at?: string
}

export type BookingRequestType = 'trainer_change' | 'reschedule' | 'transfer' | 'refund'
export type BookingRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export interface BookingRequest {
  id: string
  booking_id: string
  request_type: BookingRequestType
  requested_by: string // client_id
  target_trainer_id?: string // For trainer_change
  target_date?: string // For reschedule (YYYY-MM-DD)
  target_time?: string // For reschedule (HH:MM)
  target_user_id?: string // For transfer
  reason?: string
  status: BookingRequestStatus
  admin_notes?: string
  created_at?: string
  resolved_at?: string
  updated_at?: string
}

export interface SessionReminder {
  id: string
  booking_id: string
  reminder_count: number
  last_reminder_at?: string
  next_reminder_at?: string
}

// ============================================================================
// VERIFICATION DOCUMENT TYPES
// ============================================================================

export type DocumentType = 'national_id' | 'proof_of_residence' | 'certificate_of_good_conduct' | 'discipline_certificate' | 'sponsor_reference'
export type DocumentStatus = 'pending' | 'approved' | 'rejected'

export interface VerificationDocument {
  id: string
  trainer_id: string
  document_type: DocumentType
  file_url?: string
  file_path?: string
  status: DocumentStatus
  rejection_reason?: string
  id_number?: string // For national ID document
  uploaded_at?: string
  reviewed_at?: string
  reviewed_by?: string
  expires_at?: string
}

export interface TrainerVerification {
  trainer_id: string
  national_id?: VerificationDocument
  proof_of_residence?: VerificationDocument
  certificate_of_good_conduct?: VerificationDocument
  discipline_certificate?: VerificationDocument
  sponsor_reference?: VerificationDocument
  all_verified?: boolean
  verification_completed_at?: string
  verification_expires_at?: string
}

// ============================================================================
// PAYMENT & PAYOUT TYPES
// ============================================================================

export type PaymentMethod = 'mpesa' | 'wallet' | 'bank_transfer' | 'mock'

/**
 * PaymentStatus tracks payment and payout state
 *
 * Booking Payment Flow:
 * pending → completed (M-Pesa/wallet payment succeeds) | failed (payment declined/timeout)
 * completed → (terminal, unless refunded)
 * completed → refunded (admin issues refund)
 *
 * Payout Flow (for trainer earnings):
 * pending → completed (M-Pesa/bank transfer processed)
 * completed → (terminal, unless rolled back)
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface Payment {
  id: string
  booking_id: string
  client_id: string
  trainer_id: string
  amount: number
  base_service_amount: number
  distance_fee?: number
  transport_fee?: number
  platform_fee?: number
  vat_amount?: number
  trainer_net_amount?: number
  payment_method: PaymentMethod
  status: PaymentStatus
  reference?: string
  mpesa_checkout_request_id?: string
  mpesa_merchant_request_id?: string
  notes?: string
  created_at?: string
  completed_at?: string
}

export interface PayoutRequest {
  id: string
  trainer_id: string
  amount: number
  mpesa_number?: string
  status: PaymentStatus
  reference?: string
  requested_at?: string
  processed_at?: string
}

export interface SponsorCommission {
  id: string
  sponsor_trainer_id: string
  sponsored_trainer_id: string
  booking_id: string
  payment_id: string
  commission_amount: number // 10% of trainer earnings
  status: PaymentStatus
  created_at?: string
  paid_at?: string
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType = 'booking' | 'payment' | 'session' | 'document' | 'approval' | 'chat' | 'review' | 'dispute' | 'system'

/**
 * NotificationAction defines what action a notification is prompting the user to take
 *
 * Booking Actions:
 * - 'booking_created': New booking requested (for trainer)
 * - 'booking_confirmed': Trainer accepted booking (for client)
 * - 'booking_declined': Trainer declined booking (for client)
 * - 'view_booking': General action to view booking details
 *
 * Payment Actions:
 * - 'payment_initiated': Payment process started (for client)
 * - 'payment_completed': Payment successful (for trainer, admin)
 * - 'payment_failed': Payment failed (for client)
 *
 * Session Actions:
 * - 'start_session': Trainer should confirm session start
 * - 'session_started': Trainer confirmed start (for client)
 * - 'complete_session': Trainer should confirm session end
 * - 'awaiting_completion': Client should confirm session was completed
 * - 'session_completed': Session finished (for both parties)
 *
 * Review Actions:
 * - 'review_requested': Client should review trainer (for client)
 * - 'review_submitted': Trainer received review (for trainer)
 * - 'review_trainer': Legacy action to review trainer
 *
 * Document/Approval Actions:
 * - 'upload_documents': Trainer should upload verification docs (for trainer)
 * - 'review_application': Admin should review trainer application (for admin)
 * - 'document_approved': Document approved (for trainer)
 * - 'document_rejected': Document rejected (for trainer)
 * - 'trainer_approved': Trainer fully approved (for trainer)
 *
 * Chat/Issue Actions:
 * - 'new_message': New message received (for recipient)
 * - 'report_issue': User should report an issue
 * - 'issue_reported': Issue was reported (for admin)
 * - 'dispute_resolved': Dispute closed (for both parties)
 *
 * Other:
 * - 'confirm_next_session': Client should confirm they want next booking
 * - 'review_app': Client should review the app
 * - 'system_announcement': System notification
 */
export type NotificationAction =
  | 'view_booking'
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'start_session'
  | 'session_started'
  | 'complete_session'
  | 'awaiting_completion'
  | 'session_completed'
  | 'review_requested'
  | 'review_submitted'
  | 'review_trainer'
  | 'review_app'
  | 'upload_documents'
  | 'review_application'
  | 'document_approved'
  | 'document_rejected'
  | 'trainer_approved'
  | 'new_message'
  | 'report_issue'
  | 'issue_reported'
  | 'dispute_resolved'
  | 'confirm_next_session'
  | 'system_announcement'

export interface Notification {
  id: string
  user_id: string
  booking_id?: string
  title: string
  body: string
  type: NotificationType
  action_type?: NotificationAction
  action_data?: Record<string, any>
  read: boolean
  created_at?: string
  read_at?: string
}

// ============================================================================
// DISPUTE & ISSUE TYPES
// ============================================================================

export type DisputeStatus = 'pending' | 'investigating' | 'resolved' | 'closed'
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'closed'
export type DisputeResolution = 'refund' | 'no_action' | 'warning' | 'suspension' | 'reversal'

/**
 * DisputeAction tracks audit trail for disputes and issues
 * Records every status change, note, and action with timestamp and actor attribution
 */
export interface DisputeAction {
  id: string
  dispute_id: string
  action_type: 'created' | 'status_changed' | 'note_added' | 'closed' | 'resolution_issued'
  actor_id: string
  actor_role: 'admin' | 'trainer' | 'client' | 'system'
  timestamp: string // ISO timestamp
  old_value?: string | Record<string, any>
  new_value?: string | Record<string, any>
  details?: Record<string, any> // e.g., { old_status, new_status, reason, amount }
  created_at?: string
}

/**
 * Dispute represents a reported issue or complaint between client and trainer
 * Can be created by either party and requires admin resolution
 */
export interface Dispute {
  id: string
  booking_id: string
  client_id: string
  trainer_id: string
  reporter_id: string // Who filed the dispute
  status: DisputeStatus
  resolution?: DisputeResolution
  issue_description: string
  admin_notes?: string
  closure_reason?: string
  closure_evidence?: string
  refund_amount?: number
  affected_parties?: ('client' | 'trainer')[]
  action_history?: DisputeAction[]
  created_at?: string
  updated_at?: string
  resolved_at?: string
  closed_at?: string
  closed_by?: string
}

/**
 * Issue represents a problem reported by a user (trainer or client)
 * Less formal than a dispute, used for general complaints
 */
export interface Issue {
  id: string
  user_id: string
  user_type: 'client' | 'trainer'
  booking_id?: string
  booking_reference?: string // If not a direct booking record
  status: IssueStatus
  title: string
  description: string
  category?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  admin_notes?: string
  closure_notes?: string
  action_history?: DisputeAction[]
  created_at?: string
  updated_at?: string
  resolved_at?: string
  closed_at?: string
  closed_by?: string
}

// ============================================================================
// REVIEW & RATING TYPES
// ============================================================================

export interface Review {
  id: string
  client_id: string
  trainer_id: string
  booking_id: string
  rating: number // 1-5
  comment?: string
  created_at?: string
  updated_at?: string
}

export interface TrainerRating {
  id: string
  booking_id: string
  trainer_id: string
  client_rating: number // 1-5 (trainer's rating of the client)
  app_rating: number // 1-5 (trainer's rating of the app)
  review?: string // Review and recommendations
  created_at?: string
  updated_at?: string
}

export type ComplaintCategory = 'no_show' | 'late_start' | 'quality' | 'technical' | 'unprofessional' | 'other'
export type ComplaintStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed'

export interface SessionComplaint {
  id: string
  booking_id: string
  filed_by_trainer?: boolean
  filed_by_client?: boolean
  category: ComplaintCategory
  description: string
  attachment_url?: string
  status: ComplaintStatus
  created_at?: string
  updated_at?: string
}

// ============================================================================
// PRICING TYPES
// ============================================================================

export interface DistancePricingConfig {
  base_service_radius_km: number // Default 5
  price_increment_per_km: number
  additional_distance_unit_km: number // Per 3km, add base rate
}

export interface GroupPricingTier {
  name: string
  min_size: number
  max_size?: number
  pricing_model: 'fixed' | 'per_person'
  rate_override?: number
}

export interface TrainerGroupPricing {
  trainer_id: string
  category_id: string
  tiers: GroupPricingTier[]
  pricing_model: 'fixed' | 'per_person'
}

// ============================================================================
// MESSAGE & CHAT TYPES
// ============================================================================

export interface ChatMessage {
  id: string
  trainer_id: string
  client_id: string
  sender_id: string
  recipient_id: string
  content: string
  message_type?: 'text' | 'image' | 'file'
  file_url?: string
  read: boolean
  created_at?: string
  read_at?: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  status: 'success' | 'error'
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

export interface ApiErrorResponse {
  status: 'error'
  message: string
  code?: string
  errors?: Record<string, string[]>
}

// ============================================================================
// LOCATION TYPES
// ============================================================================

export interface Location {
  label: string
  latitude: number
  longitude: number
}

export interface DistanceResult {
  distance_km: number
  distance_m: number
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface SystemSettings {
  default_service_radius_km: number
  default_timezone: string
  price_increment_per_km: number
  additional_distance_unit_km: number
  sponsor_commission_percentage: number
  good_conduct_certificate_upload_minutes: number // 30 minutes
  session_reminder_interval_minutes: number // 3 minutes
  session_reminder_max_count: number // 3 times
}

export interface UserSettings {
  user_id: string
  timezone: string
  language?: string
  notification_preferences?: Record<string, boolean>
  privacy_settings?: Record<string, any>
}
