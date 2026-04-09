# TrainerCoachConnect - Complete App Flow Documentation

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Client User Flow](#client-user-flow)
3. [Trainer User Flow](#trainer-user-flow)
4. [Admin User Flow](#admin-user-flow)
5. [Cross-Cutting Concerns](#cross-cutting-concerns)
6. [Key Integration Points](#key-integration-points)

---

## System Architecture Overview

### Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Routing**: React Router v6
- **Auth**: Context-based authentication with localStorage persistence
- **UI**: shadcn/ui components with Tailwind CSS
- **API**: PHP action-based backend (`api.php`)
- **Payments**: M-Pesa integration
- **Charts**: Recharts for analytics
- **Notifications**: Sonner toast notifications

### User Types
1. **Client** - People seeking fitness/training services
2. **Trainer** - Professionals offering training services
3. **Admin** - Platform administrators managing operations

### Authentication Flow
```
Login/Signup → AuthContext (JWT token) → localStorage persistence
                    ↓
         Role-based routing in App.tsx
                    ↓
        Client/Trainer/Admin Dashboard
```

---

## CLIENT USER FLOW

### 1. Signup & Onboarding

**Route**: `/signup` → `/signup-client-step2` (if applicable)

**Components**:
- `AuthForm.tsx` - Initial authentication
- `ClientProfileEditor.tsx` - Profile setup
- `LocationSelector.tsx` - Location preference

**Process**:
```
1. User creates account via AuthForm
2. Email/password validation through API
3. User type set to 'client'
4. localStorage flag: client_signup_step2 = 'true'
5. Redirected to step 2 onboarding
6. Profile information collected (name, bio, preferences)
7. Location enabled for trainer discovery
```

**Key APIs**:
- `authentication_user_create` - Account creation
- `profile_update` - Profile setup

---

### 2. Home & Trainer Discovery

**Route**: `/client` (redirected from `/` if authenticated)

**Component**: `ClientDashboard.tsx`

**State Management**:
```tsx
- trainers: Trainer[] (filtered list)
- bookings: Booking[] (user's bookings)
- activeTab: 'home' | 'explore' | 'schedule'
- selectedTrainer: Trainer | null
- userLocation: { lat: number; lng: number }
- locationName: string
- searchQuery: string
```

**Discovery Features**:

### 2a. Location Setup (Geolocation)
```
GPS/Location Required → Reverse Geocode Address
    ↓
Profile Auto-Update with Location
    ↓
Enable Trainer Search within Service Radius
```

**Implementation**:
- `useGeolocation()` hook - Request GPS permission
- `reverseGeocode()` - Convert coordinates to address
- Auto-save to client profile via `profile_update`

### 2b. Trainer Filtering & Search
**Filter Criteria**:
- Distance (within service radius)
- Category/Discipline
- Rating (star rating)
- Hourly rate (price range)
- Search text (name, bio, discipline)
- Availability status

**APIs**:
- `get_trainers` - Fetch trainers with filters
- `getTrainerCategories()` - Trainer specializations
- `enrichTrainersWithDistance()` - Calculate distance

**Sorting**:
```
By relevance → Distance → Rating → Price
```

---

### 3. Trainer Details & Booking

**Component**: `TrainerDetails.tsx` (modal)

**Information Displayed**:
- Profile image, name, rating
- Disciplines/specializations
- Hourly rate
- Bio and reviews
- Service area
- Availability calendar
- Reviews from other clients

**Booking Modal**: `BookingModal.tsx`

**Booking Form Data**:
```tsx
{
  trainer_id: string
  session_date: string (ISO date)
  session_time: string (HH:MM)
  duration_hours: number
  location_preference: string ('trainer_location' | 'client_location' | 'online')
  notes?: string
}
```

**Booking Status Progression**:
```
pending 
  ↓ (trainer accepts)
confirmed
  ↓ (trainer marks start)
in_session (session_phase: 'session_active')
  ↓ (trainer marks end)
in_session (session_phase: 'awaiting_completion')
  ↓ (client confirms completion)
completed
  ↓ (if client rates)
completed (review_submitted: true)
```

---

### 4. Payment Flow

**Route**: Payment modal within booking

**Components**: `PaymentMethods.tsx`

**Payment Methods**:
1. **M-Pesa**
   - Phone number entry
   - STK Push flow
   - Payment confirmation
   - Automatic payment verification

2. **Mock Payment** (for testing)
   - Direct completion

**APIs**:
- `booking_create` - Initial booking creation
- `payment_create` - Payment record creation
- `booking_update` - Update status to 'confirmed' after payment

**Payment States**:
```
pending (initial)
  ↓
processing (M-Pesa STK initiated)
  ↓
completed (verified)
  ↓ or
failed (error handling)
```

**Important**: Trainer is notified once payment is confirmed via notification

---

### 5. Session Management

**Session Lifecycle**:

### 5a. Pre-Session
```
Booking Confirmed 
  ↓ (time approaches)
ClientDashboard polls for pending session start
  ↓
SessionStartConfirmModal appears
  ↓
Client confirms session start
  ↓
booking.status = 'in_session'
booking.session_phase = 'session_active'
```

**Component**: `SessionStartConfirmModal.tsx`

### 5b. During Session
- Trainer and client can exchange messages via in-app chat
- Session timer/duration tracking
- Real-time communication

**Component**: `TrainerChat.tsx`

### 5c. Post-Session
```
Trainer marks session end
  ↓ (notifies client)
booking.session_phase = 'awaiting_completion'
  ↓
SessionEndConfirmModal appears on client
  ↓
Client confirms session completion
  ↓
booking.status = 'completed'
```

**Component**: `SessionEndConfirmModal.tsx`

---

### 6. Reviews & Feedback

**Trigger**: After session completion, if no review submitted

**Component**: `ReviewModal.tsx`

**Review Data**:
```tsx
{
  booking_id: string
  rating: 1-5 (stars)
  comment: string (optional)
  submitted_at: ISO timestamp
}
```

**Auto-Detection**:
```tsx
// In ClientDashboard useEffect
const completedWithoutReview = bookings.find(b => 
  b.status === 'completed' && !reviewByBooking[b.id]
)
if (completedWithoutReview) {
  setReviewBooking(completedWithoutReview)
}
```

**APIs**:
- `review_create` - Submit review

---

### 7. Booking Management

**Component**: `ClientDashboard.tsx` - Bookings Tab

**Booking Status Categories**:
1. **Pending** - Awaiting trainer confirmation
2. **Confirmed** - Trainer accepted, payment made
3. **In Session** - Active session (session_phase: 'session_active')
4. **Awaiting Completion** - Trainer ended, client confirming (session_phase: 'awaiting_completion')
5. **Completed** - Session finished and confirmed
6. **Cancelled** - Booking was cancelled

**Actions per Status**:

| Status | Available Actions |
|--------|------------------|
| Pending | Cancel, Chat |
| Confirmed | Start Session, Reschedule, Cancel, Chat |
| In Session | Chat, End Session (wait for trainer) |
| Awaiting Completion | Confirm Completion, Chat |
| Completed | View/Submit Review, Next Session, Chat |
| Cancelled | None |

**Components**:
- `RescheduleBookingModal.tsx` - Change date/time
- `CancelBookingModal.tsx` - Cancel with confirmation
- `NextSessionModal.tsx` - Quick rebooking

**APIs**:
- `booking_update` - Status changes
- `booking_delete` - Cancellations
- `chat_send` - Messages

---

### 8. Notifications & Announcements

**Notification Center**: `NotificationsCenter.tsx` (modal)

**Notification Types**:
- Booking updates (accepted/declined)
- Payment confirmations
- Session reminders
- Session start/end requests
- System announcements
- Messages from trainers

**Announcement Banner**: `AnnouncementBanner.tsx`

**Announcements Display**:
```
Top of dashboard
  ↓
Unread announcements shown in blue banner
  ↓
Carousel through multiple announcements
  ↓
Mark as read on dismiss
```

**APIs**:
- `notifications_get` - Fetch user notifications
- `notifications_mark_read` - Mark as read
- `announcements_get` - Fetch announcements

---

### 9. Issue Reporting

**Component**: `ReportIssue.tsx`

**When to Report**:
- Trainer didn't show up
- Behavior concerns
- Quality issues
- Payment disputes

**Report Data**:
```tsx
{
  booking_id: string
  issue_type: string
  description: string
  attachments?: File[]
  created_at: ISO timestamp
}
```

**APIs**:
- `issue_create` - Submit issue report
- `issue_attach_file` - Add evidence

---

### 10. Profile Management

**Component**: `ClientProfileEditor.tsx`

**Editable Fields**:
- Display name
- Bio/About
- Profile photo
- Location
- Fitness goals
- Preferred training style
- Emergency contact (optional)

**APIs**:
- `profile_update` - Update profile fields
- `file_upload` - Profile photo

---

## TRAINER USER FLOW

### 1. Signup & Onboarding

**Route**: `/signup` → `/signup-step2` (mandatory)

**Components**:
- `TrainerSignupWithProfileModal.tsx` - Initial info
- `TrainerDocumentsView.tsx` - Document upload

**Step 1 - Basic Info**:
```tsx
{
  email: string
  password: string
  full_name: string
  phone: string
}
```

**Step 2 - Profile & Documents**:
```
Account Status Progression:
registered 
  ↓ (upload profile info)
profile_incomplete
  ↓ (documents requested)
pending_approval
  ↓ (admin reviews)
approved ✓
  or
suspended ✗
```

**Required Profile Fields** (for `profile_incomplete` → `pending_approval`):
- Full name
- Hourly rate
- Bio/description
- Profile photo
- Service categories (at least 1)
- Service area (coordinates + radius)
- Payout details (M-Pesa, bank, etc.)

**Required Documents**:
- ID verification
- Professional certification (if applicable)
- Photo/headshot
- Any discipline-specific requirements

**APIs**:
- `authentication_user_create` - Account creation
- `profile_update` - Profile information
- `file_upload` - Document uploads
- `verification_document_create` - Document submission

---

### 2. Trainer Dashboard - Home Tab

**Route**: `/trainer`

**Component**: `TrainerDashboard.tsx`

**State Management**:
```tsx
- activeTab: 'home' | 'bookings' | 'profile' | 'disputes'
- profile: TrainerProfile
- bookings: Booking[]
- wallet: WalletInfo
- reviews: Review[]
- notifications: Notification[]
- accountStatus: AccountStatus
```

**Account Status Display**:
```
┌─────────────────────────────────────────┐
│ Status Card                              │
├─────────────────────────────────────────┤
│ Current: Approved / Pending / Suspended │
│ Next Steps: Complete Profile / Upload   │
│ Documents / Get Approved                 │
└─────────────────────────────────────────┘
```

**Dashboard Sections**:
1. **Stats Cards**
   - Total earnings
   - Active bookings
   - Completion rate
   - Average rating

2. **Quick Actions**
   - Edit profile
   - Manage availability
   - Configure services
   - View payouts

3. **Recent Bookings Widget**
   - Pending confirmations
   - Upcoming sessions
   - Quick action buttons

---

### 3. Booking Management - Accept/Reject

**Booking Status Lifecycle**:
```
pending (client created)
  ↓ (trainer action required)
├─→ confirmed (trainer accepted)
│     ↓
│   in_session (trainer started)
│     ↓
│   awaiting_completion (trainer ended)
│     ↓
│   completed (client confirmed)
│
└─→ cancelled (trainer declined)
```

**Accept Booking Flow**:
```tsx
await apiService.updateBooking(id, { 
  status: 'confirmed', 
  session_phase: 'waiting_start' 
})
```

**Reject Booking**:
```tsx
await apiService.updateBooking(id, { 
  status: 'cancelled',
  cancellation_reason: 'trainer_declined'
})
```

**APIs**:
- `booking_update` - Accept/reject
- `notification_insert` - Notify client

---

### 4. Session Management - Start/End

### 4a. Start Session
**Conditions**:
- Booking status: `confirmed`
- Trainer clicks "Start Session"

**Update**:
```tsx
await apiService.updateBooking(id, {
  status: 'in_session',
  session_phase: 'session_active',
  trainer_marked_start: true,
  started_at: new Date().toISOString(),
})
```

### 4b. End Session
**Conditions**:
- Booking status: `in_session`
- Session active (session_phase: 'session_active')

**Update**:
```tsx
await apiService.updateBooking(id, {
  status: 'in_session',
  session_phase: 'awaiting_completion',
  trainer_marked_end: true,
  ended_at: new Date().toISOString(),
})
```

**Then**:
- Client notified to confirm completion
- Client sees `SessionEndConfirmModal`
- Once client confirms, booking moves to `completed`

---

### 5. Profile Management

**Component**: `ProfileEditorModal.tsx`

**Editable Fields**:
- Full name
- Professional bio
- Profile photo
- Hourly rate
- Years of experience
- Specializations

**APIs**:
- `profile_update` - Update information
- `file_upload` - New profile photo

---

### 6. Availability Management

**Component**: `AvailabilityEditor.tsx`

**Configuration**:
- Days of week (Mon-Sun)
- Time slots (start - end time)
- Recurring or one-time
- Blackout dates
- Buffer time between sessions

**Data Structure**:
```tsx
{
  day_of_week: 0-6 (Sunday = 0)
  start_time: 'HH:MM'
  end_time: 'HH:MM'
  is_recurring: boolean
  timezone: string
}
```

**APIs**:
- `availability_create` - Add time slot
- `availability_delete` - Remove slot
- `availability_update` - Edit slot

---

### 7. Services & Pricing

**Component**: `ServicesManager.tsx`

**Service Definition**:
```tsx
{
  id: string
  trainer_id: string
  category_id: string (discipline)
  service_name: string
  description: string
  hourly_rate: number
  duration_presets: number[] ([0.5, 1, 1.5, 2])
  customizable_duration: boolean
}
```

**Management Operations**:
- Add new service
- Edit pricing & description
- Delete service
- Mark service as unavailable

**APIs**:
- `service_create`
- `service_update`
- `service_delete`

---

### 8. Service Area Configuration

**Component**: `ServiceAreaEditor.tsx`

**Configuration**:
```tsx
{
  trainer_id: string
  center_lat: number
  center_lng: number
  radius_km: number
  service_types: ('trainer_location' | 'client_location' | 'online')[]
}
```

**Setup**:
1. Set home base location (map)
2. Define service radius (km)
3. Select service delivery types

**APIs**:
- `service_area_update` - Save configuration

---

### 9. Wallet & Payouts

**Component**: `Payouts.tsx`, `TrainerTopUp.tsx`

**Wallet Features**:
- Current balance
- Pending earnings (from completed bookings)
- Withdrawal history
- Payout method management

**Payout Methods**:
- M-Pesa
- Bank transfer
- Mobile money

**Payout Flow**:
```
Earnings (from sessions)
  ↓ (client pays via M-Pesa)
Payment verified
  ↓
Earnings credited to wallet
  ↓
Trainer initiates withdrawal
  ↓
Amount transferred to payout method
```

**Top-Up Option**:
- Add funds via M-Pesa or other methods
- Use for promotions or client incentives

**APIs**:
- `wallet_get` - Fetch balance
- `payout_create` - Initiate withdrawal
- `payout_method_update` - Save payout details

---

### 10. Performance & Analytics

**Visible Metrics**:
- Total sessions completed
- Completion rate (%)
- Average rating
- Total earnings (month/all-time)
- Booking trend

**Analytics Tab** (if available):
- Revenue chart
- Booking volume chart
- Rating distribution
- Client feedback trends

**APIs**:
- `getTrainerProfile()` - Stats
- `getReviews()` - Ratings
- Analytics endpoints

---

### 11. Disputes & Issues

**Component**: `TrainerDisputes.tsx`, `TrainerReportIssue.tsx`

**Dispute Statuses**:
- Open
- Under investigation
- Resolved
- Closed

**Trainer Can**:
- View disputes related to their bookings
- Provide responses/evidence
- Track resolution status

**Report Issues**:
- Client no-show
- Payment disputes
- Behavioral concerns

**APIs**:
- `dispute_get` - Fetch disputes
- `dispute_update` - Add response
- `issue_create` - Report issue

---

### 12. Communication - Trainer Chat

**Component**: `TrainerChat.tsx`

**Chat Features**:
- 1-on-1 messaging with clients
- Linked to bookings
- Message history
- Real-time notifications

**APIs**:
- `chat_get` - Fetch messages
- `chat_send` - Send message
- `chat_mark_read` - Mark as read

---

### 13. Notifications

**Notification Types for Trainers**:
- New booking requests
- Booking cancellations
- Payment confirmations
- Client messages
- Session reminders
- System announcements
- Review notifications

**Component**: `NotificationsCenter.tsx`

**Polling**: Every 10 seconds to fetch new notifications

---

### 14. Profile Promotion

**Component**: `PromoteProfileModal.tsx` (if available)

**Promotion Features**:
- Featured listing
- Priority search ranking
- Special badge
- Promotional period

**Cost**: Credits or paid via M-Pesa

---

## ADMIN USER FLOW

### 1. Admin Dashboard Overview

**Route**: `/admin/overview`

**Component**: `OverviewPage.tsx`

**Key Metrics Cards**:
```
┌─────────────┬──────────────┬──────────────┬─────────────┐
│ Total Users │ Active Trainers │ Total Bookings │ Revenue |
│    2,450    │      150       │    12,340      │ Ksh 5.2M |
└─────────────┴──────────────┴──────────────┴─────────────┘
```

**Alert Cards** (priority items):
1. **Pending Documents** - Trainer verification docs awaiting review
2. **Pending Approvals** - New trainer applications
3. **Active Disputes** - Issues requiring admin attention

**Charts**:
- Revenue & Bookings (bar chart) - 30d/90d/12m view
- Recent Activity (timeline)
- Announcement Preview (recent broadcasts)

**Quick Navigation**:
- View all pending documents
- Review trainer applications
- Handle disputes
- Manage announcements

**APIs**:
- `getDashboardOverview()` - Overall metrics
- `getActivityFeed()` - Recent actions
- `getAnalyticsTimeSeries()` - Chart data
- `listVerificationDocuments()` - Pending docs
- localStorage for announcement history

---

### 2. User Management

**Route**: `/admin/users`

**Component**: `UsersPage.tsx`

**User List Display**:
- User ID
- Name
- Email
- User type (Client/Trainer/Admin)
- Status (Active/Suspended)
- Join date

**Search & Filter**:
- By name/email
- By user type
- By status
- By join date range

**Actions**:
- Suspend/reactivate user
- View detailed profile
- View booking history
- Send direct message

**APIs**:
- `get_users` - Fetch all users
- `user_update` - Suspend/activate
- `user_get_profile` - Details

---

### 3. Trainer Approvals

**Route**: `/admin/approvals`

**Component**: `ApprovalsPage.tsx`

**Approval Workflow**:
```
Pending Trainers (not yet is_approved)
        ↓
Admin reviews profile & docs
        ↓
├─→ Approve
│     ↓
│   Trainer account activated
│   Trainer notified
│   Can now accept bookings
│
└─→ Reject
      ↓
    Trainer account suspended
    Trainer notified with reason
    Can reapply after fixing issues
```

**Trainer Profile Review**:
- Complete profile check
- Photo and bio quality
- Service area coverage
- Payout details
- Document verification (separate tab)

**Approval Decision**:
```
✓ Approve - Account is fully ready
✗ Reject - Issues prevent approval
```

**APIs**:
- `getUsers()` - List trainers
- `approveTrainer()` - Approve
- `rejectTrainer()` - Reject with reason
- `notifyTrainerApproved()` - Notification

---

### 4. Document Verification

**Route**: `/admin/document-review`

**Component**: `DocumentReviewPage.tsx`

**Document Types**:
- ID/National ID
- Professional certificate
- Insurance/License
- Police clearance
- Other (discipline-specific)

**Document Status Tabs**:
1. **Pending** (needs review)
2. **Approved** (verified)
3. **Rejected** (issues found)

**Review Process**:
```
Trainer uploads document
        ↓
Document in 'Pending' queue
        ↓
Admin reviews document (preview)
        ↓
├─→ Approve
│     ↓
│   Status: Approved
│   Trainer notified
│
└─→ Reject
      ↓
    Requires reason
    Status: Rejected
    Trainer can reupload
```

**Document Preview**:
- Image zoom/pan
- Full size view
- Document metadata
- Upload timestamp

**Rejection Workflow**:
```tsx
{
  document_id: string
  rejection_reason: string (required)
  feedback?: string (optional)
}
```

**Count Display**:
```
Pending: 12 | Approved: 245 | Rejected: 8
```

**APIs**:
- `listVerificationDocuments()` - Fetch by status
- `verifyDocument('approved')` - Approve
- `verifyDocument('rejected', reason)` - Reject with reason

---

### 5. Disputes & Issues Management

**Route**: `/admin/disputes`

**Component**: `DisputesPage.tsx`

**Issue Types**:
- Booking-related disputes
- Payment issues
- Quality complaints
- Behavioral reports
- Safety concerns

**Dispute Statuses**:
```
Open/Pending
    ↓ (admin investigates)
Investigating
    ↓ (admin decides)
Resolved
    ↓ (closed case)
Closed
```

**Dispute Details Display**:
- Reporter name
- Trainer name
- Booking reference
- Issue description
- Attachment/evidence
- Current status
- Timeline

**Admin Actions**:
1. **Change Status** - Move through workflow
2. **Add Comments** - Internal notes
3. **Request Info** - Ask for clarification
4. **Resolve** - Final decision
   - Refund client
   - Suspend trainer
   - Both parties agreement

**Resolution Options**:
- Full refund to client
- Partial refund
- Trainer warned
- Trainer suspended
- Case dismissed

**Search & Filter**:
- By status
- By date range
- By trainer/client
- By keyword

**APIs**:
- `getIssuesWithPagination()` - Fetch disputes
- `updateIssueStatus()` - Change status
- `getUsers()` - Resolve names

---

### 6. Issues/Complaints Queue

**Route**: `/admin/issues`

**Component**: `IssuesPage.tsx`

**Similar to Disputes**: Handles open issues reported by users

**Features**:
- Create issue from unresolved disputes
- Track resolution timeline
- Assign to admins
- Add follow-up actions

---

### 7. Analytics & Reporting

**Route**: `/admin/analytics`

**Component**: `AnalyticsPage.tsx`

**Metrics Dashboard**:
```
Total Users:    2,450
- Clients:      2,200
- Trainers:       250

Bookings:       12,340
Sessions Completed: 11,200
Completion Rate:    90.8%

Revenue:        Ksh 5,234,000
Average Session: Ksh 424
Monthly Avg:    Ksh 436,166
```

**Charts**:

### 6a. Revenue Trends
```
Line/Bar chart showing:
- Daily/Monthly revenue
- Number of bookings
- Average order value (AOV)
- Trend direction
Time range: 30d / 90d / 12m
```

### 6b. User Composition
```
Pie chart:
- % Clients
- % Trainers
- % Admins
Growth trends
```

### 6c. Booking Trends
```
Bar chart:
- Bookings per time period
- Completion vs cancellation rate
- Revenue by category/discipline
```

**Export Functionality**:
```
Export CSV with:
- Selected metrics
- Selected date range
- Formatted for analysis
```

**APIs**:
- `getAnalyticsTimeSeries()` - Revenue/bookings data
- `getUserMetrics()` - User breakdown
- CSV generation (client-side)

---

### 8. SMS Manager

**Route**: `/admin/sms-manager`

**Component**: `AdminSMSManager.tsx`

**SMS Templates**:
- Registration confirmation
- Booking confirmation
- Payment received
- Session reminders
- Session completed
- Review request

**Features**:
- Template management
- Test send to admin
- Delivery confirmation
- Message history
- Opt-out management

**APIs**:
- `sms_template_get`
- `sms_template_update`
- `sms_send_test`
- `sms_history_get`

---

### 9. Announcements Manager

**Route**: `/admin/announcements`

**Component**: `AnnouncementBroadcastManager.tsx`

**Announcement Features**:
```
Compose Form:
├─ Title (required)
├─ Message (required)
├─ Target Audience (radio button)
│   ├─ All Users
│   ├─ Clients Only
│   ├─ Trainers Only
│   └─ Admins Only
└─ Preview Mode
```

**Broadcast Process**:
```
1. Compose message
2. Choose recipients
3. Preview announcement
4. Send (batched)
5. Track in history
```

**Broadcasting**:
- Fetches all users of target type
- Creates notifications via `notification_insert`
- Batches 100 notifications per request (for performance)
- Persists to localStorage history

**History Tracking**:
```
Recent Broadcasts:
├─ Title: "System Maintenance"
│  Recipients: 2,450 users
│  Sent: Jan 15, 2024 10:30 AM
│  Status: Sent ✓
│
├─ Title: "New Features Available"
│  Recipients: 250 trainers
│  Sent: Jan 10, 2024 2:15 PM
│  Status: Sent ✓
```

**APIs**:
- `profiles_get_by_type` - Get target recipients
- `notifications_insert` - Send notifications
- localStorage for history

---

### 10. Categories Management

**Route**: `/admin/categories`

**Component**: `AdminCategoryManager.tsx`

**Category Operations**:
- Add new discipline category
- Edit category name/description
- Disable/archive category
- View category stats

**Category Info**:
- Name (e.g., "Personal Training", "Yoga")
- Description
- Icon/image
- Active/inactive status
- Usage count (how many trainers)

**APIs**:
- `category_get` - Fetch all
- `category_create` - Add new
- `category_update` - Edit
- `category_delete` - Archive

---

### 11. Bookings Management

**Route**: `/admin/bookings`

**Component**: `BookingsPage.tsx`

**Overview**:
- List all bookings across platform
- Filter by status
- View client/trainer details
- Monitor session flow

**Booking Filters**:
- Status (pending, confirmed, in_session, completed, cancelled)
- Date range
- Trainer name
- Client name
- Revenue range

**Admin Actions**:
- View booking details
- Modify booking if needed (emergency only)
- Refund client
- Suspend bookings for problematic trainer

**APIs**:
- `getBookings()` - All bookings
- `booking_update` - Modify (limited)
- `refund_create` - Issue refund

---

### 12. Payment Management & Payouts

**Route**: `/admin/payouts`

**Component**: `AdminPayoutManager.tsx`

**Payout Management**:
- View pending payouts
- Process payouts
- Track payout history
- Verify M-Pesa confirmations

**Payout Statuses**:
- Pending (awaiting processing)
- In Transit (sent)
- Completed
- Failed

**Dispute Management**:
- Reverse payout if needed
- Investigate failed payments
- Handle M-Pesa issues

**APIs**:
- `payout_get` - Fetch pending
- `payout_process` - Send to M-Pesa
- `payout_verify` - Confirm receipt
- `payment_dispute_get` - Issues

---

### 13. Waiting List Management

**Route**: `/admin/waitlist`

**Component**: `WaitingListManager.tsx`

**Features**:
- View users on waitlist
- Send acceptance invitations
- Track conversion rate
- Filter by category/interest

**Waitlist Functions**:
- Accept/reject applicants
- Send welcome emails
- Track signups from waitlist

**APIs**:
- `waitlist_get` - Fetch entries
- `waitlist_update` - Accept/reject
- `email_send` - Send invitations

---

### 14. M-Pesa Settings

**Route**: `/admin/mpesa`

**Component**: `AdminMpesaManager.tsx`

**Configuration**:
- API credentials
- Webhook endpoints
- Payment confirmation settings
- Test mode toggle

**M-Pesa Integration Points**:
- STK Push initiation
- Confirmation callbacks
- Error handling
- Transaction logging

**APIs**:
- `setting_get` - Fetch config
- `setting_update` - Save credentials

---

### 15. Platform Settings

**Route**: `/admin/settings`

**Component**: `SettingsPage.tsx`

**Configuration Areas**:
1. **Currency & Localization**
   - Currency (KES, USD, etc.)
   - Timezone
   - Date format

2. **Fees & Commission**
   - Platform commission %
   - Transaction fees
   - Payout fees

3. **Feature Flags**
   - Enable/disable features
   - Beta features

4. **Email Configuration**
   - SMTP settings
   - Email templates
   - Notification settings

5. **SMS Configuration**
   - SMS provider
   - API key
   - Template management

6. **Content Management**
   - FAQs
   - Terms and conditions
   - Privacy policy
   - Help documentation

**APIs**:
- `setting_get` - Fetch all settings
- `setting_update` - Save changes
- `email_template_get/update`
- `sms_template_get/update`

---

## CROSS-CUTTING CONCERNS

### 1. Authentication & Authorization

**Context**: `AuthContext.tsx`

**Auth State**:
```tsx
{
  user: User | null
  userType: 'client' | 'trainer' | 'admin' | null
  loading: boolean
  signOut: () => Promise<void>
}
```

**Protected Routes**:
- `/client` - Clients only
- `/trainer` - Trainers only
- `/admin/*` - Admins only

**Session Persistence**:
```
JWT token → localStorage
  ↓
Auto-login on page refresh
  ↓
Invalid token → Redirect to /signin
```

**Onboarding Flags** (localStorage):
- `trainer_signup_step2` - Trainer step 2 pending
- `client_signup_step2` - Client step 2 pending

---

### 2. Notification System

**Service**: `notification-service.ts`

**Notification Types**:
```
- booking: Booking-related
- payment: Payment events
- session: Session state changes
- review: Review requests/submissions
- document: Document verification
- approval: Trainer approval
- chat: Messages
- dispute: Issue/dispute events
- system: System announcements
```

**Notification Creation**:
```tsx
createNotification({
  userId: string
  title: string
  body: string
  type: NotificationType
  actionType?: NotificationAction
  bookingId?: string
})
```

**Bulk Notifications**:
```tsx
createNotifications(notifications: NotificationPayload[])
// Automatically batches to 100 per request
```

**Display**:
- Toast notifications (for immediate actions)
- Notification Center (persistent list)
- Announcement Banner (platform-wide)
- Bell icon with unread count

---

### 3. In-App Chat

**Components**:
- `TrainerChat.tsx` - Trainer side
- `ClientChatModal.tsx` - Client side

**Features**:
- Real-time messaging
- Message history
- Typing indicators
- Read receipts
- File attachments (optional)

**Chat Linked to**:
- Specific bookings
- Trainer-client relationship

**APIs**:
- `chat_get` - Fetch messages
- `chat_send` - Send message
- `chat_mark_read` - Mark read

---

### 4. Location & Geolocation

**Hook**: `useGeolocation()` (custom)

**Process**:
```
1. Request GPS permission
2. Get user coordinates
3. Reverse geocode to address
4. Auto-save to profile
5. Use for distance calculations
```

**Utilities**:
- `reverseGeocode()` - Convert coords to address
- `enrichTrainersWithDistance()` - Calculate distance for each trainer
- `filterTrainersByServiceRadius()` - Filter by distance

---

### 5. Payment Processing

**Service**: `payment-service.ts`

**M-Pesa Flow**:
```
1. User selects M-Pesa as payment method
2. Enter phone number
3. STK Push sent to phone
4. User enters M-Pesa PIN on phone
5. Automatic confirmation via callback
6. Payment verified
7. Booking confirmed
8. Notifications sent
```

**Payment States**:
- Pending (awaiting user action)
- Processing (STK sent)
- Completed (verified)
- Failed (error)

**Error Handling**:
- User cancels STK
- Network timeout
- Insufficient balance
- Invalid phone number

**APIs**:
- `payment_create` - Initiate payment
- `payment_verify` - Check status
- `payment_callback` - Webhook from M-Pesa

---

### 6. File Upload & Storage

**Service**: `file-upload` utility

**Types**:
- Profile photos
- Documents (ID, cert)
- Chat attachments
- Booking evidence

**Process**:
```
1. Select file
2. Validate (type, size)
3. Upload to server
4. Get file URL
5. Store reference in database
```

**APIs**:
- `file_upload` - Upload file
- `file_get_url` - Retrieve file
- `file_delete` - Remove file

---

### 7. Search & Filtering

**Location-Based Search**:
```
User location + Filters → Trainers
          ↓
    Sort by relevance
```

**Filter Criteria**:
- Distance (km radius)
- Category (discipline)
- Price range (hourly rate)
- Rating (star rating)
- Availability (calendar)
- Search text (name, bio)

**Search History**: `useSearchHistory()` hook

---

### 8. Error Handling & Validation

**API Errors**:
- Network errors → Toast notification
- Authentication errors → Redirect to signin
- Validation errors → Form field errors
- Server errors (5xx) → Generic error toast

**Form Validation**:
- Email format
- Password strength
- Required fields
- Phone number format
- Date/time validity

**Business Logic Validation**:
- Booking date not in past
- Trainer availability check
- Sufficient wallet balance
- Document not already uploaded

---

### 9. Analytics & Event Tracking

**Services**:
- `analytics-service.ts`
- `getActivityFeed()` - Recent actions
- `getAnalyticsTimeSeries()` - Revenue trends
- `getUserMetrics()` - User stats

**Events Tracked**:
- User signups
- Bookings created
- Payments completed
- Sessions started/ended
- Reviews submitted
- Issues reported
- Approvals processed

---

### 10. Theme & Styling

**Theme System**: `next-themes`

**Color Modes**:
- Light mode
- Dark mode
- System preference

**Component Library**: `shadcn/ui`

**Styling**:
- Tailwind CSS classes
- CSS variables for theming
- Responsive design
- Dark mode support

**Toggle**: `ThemeToggleAdmin.tsx` (for admin users)

---

## KEY INTEGRATION POINTS

### 1. Notification Flow Integration

```
User Action
    ↓
API Call (booking_create, payment_verified, etc.)
    ↓
Server processes action
    ↓
Notification service triggered
    ↓
Create notification(s) via notification_insert
    ↓
Client/Admin/Trainer receives notification
    ↓
Toast + Notification Center + Badge update
```

### 2. Booking Lifecycle Integration

```
Client Books
    ↓ (trainer accepts)
Trainer Confirms
    ↓ (payment made)
Client Pays
    ↓ (session time arrives)
Trainer Starts Session
    ↓ (session ends)
Trainer Marks Complete
    ↓ (client confirms)
Client Confirms
    ↓ (client rates)
Client Reviews
    ↓
Complete
```

**All transitions send notifications and update dashboards in real-time**

### 3. Trainer Approval Integration

```
Trainer Signs Up
    ↓
Documents uploaded
    ↓
Admin reviews documents (DocumentReviewPage)
    ↓ (all approved)
Admin approves trainer (ApprovalsPage)
    ↓
Trainer status: approved
Trainer notified
Trainer can accept bookings
Trainer appears in search
```

### 4. Analytics Integration

```
User Actions (bookings, payments, reviews)
    ↓
Data recorded in database
    ↓
Analytics service aggregates data
    ↓
Admin views on AnalyticsPage
    ↓
Charts and metrics update
    ↓
CSV export available
```

### 5. Search Integration

```
Client enters location
    ↓
Trainers fetched with filters
    ↓
Distance calculated
    ↓
Results ranked by relevance
    ↓
Display with availability & ratings
    ↓
Client selects trainer
    ↓
Booking form opens
```

### 6. Chat Integration

```
Booking confirmed
    ↓
Chat becomes available
    ↓
Trainer/Client messages
    ↓
Real-time message display
    ↓
Notifications on new message
    ↓
Message history persisted
```

---

## SUMMARY

This application facilitates a **marketplace for fitness/training services** with three key stakeholders:

1. **Clients** - Discover, book, pay for, and review training sessions
2. **Trainers** - Set up profile, manage availability, accept bookings, and earn
3. **Admins** - Oversee operations, verify trainers, resolve disputes, and analyze performance

**Core Value Proposition**:
- Clients get access to vetted, local trainers
- Trainers get client bookings and payment processing
- Admins maintain platform quality and handle issues

**Key Technical Achievement**:
- Role-based UI with context-driven routing
- Real-time notifications and state updates
- Payment integration (M-Pesa)
- Location-based matching
- Comprehensive admin oversight

---

## Useful File References

| Feature | Key Files |
|---------|-----------|
| Client Flow | `ClientDashboard.tsx`, `BookingModal.tsx`, `ReviewModal.tsx` |
| Trainer Flow | `TrainerDashboard.tsx`, `ProfileEditorModal.tsx`, `AvailabilityEditor.tsx` |
| Admin Flow | `OverviewPage.tsx`, `ApprovalsPage.tsx`, `DisputesPage.tsx`, `AnalyticsPage.tsx` |
| Auth | `AuthContext.tsx`, `AuthForm.tsx` |
| Notifications | `notification-service.ts`, `NotificationsCenter.tsx`, `AnnouncementBanner.tsx` |
| Routing | `App.tsx`, `AdminLayout.tsx` |
| API | `api-service.ts`, `api.ts` |
| Payments | `payment-service.ts` |
| Analytics | `analytics-service.ts` |
| Search/Location | `distance-utils.ts`, `location-utils.ts`, `location.ts` |

