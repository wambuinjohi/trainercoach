// ============================================================================
// USER TYPES
// ============================================================================

export type UserType = 'client' | 'trainer' | 'admin'
export type AccountStatus = 'registered' | 'profile_incomplete' | 'pending_approval' | 'approved' | 'suspended'
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

export type BookingStatus = 'pending' | 'confirmed' | 'in_session' | 'completed' | 'cancelled' | 'client_no_show'
export type BookingSessionPhase = 'waiting_start' | 'session_active' | 'awaiting_completion' | 'completed'

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
  created_at?: string
  updated_at?: string
  completed_at?: string
  started_at?: string
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

export type NotificationType = 'booking' | 'payment' | 'session' | 'document' | 'approval' | 'system'
export type NotificationAction =
  | 'view_booking'
  | 'confirm_payment'
  | 'start_session'
  | 'complete_session'
  | 'upload_documents'
  | 'review_application'
  | 'review_trainer'
  | 'review_app'
  | 'confirm_next_session'
  | 'report_issue'

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
