# Comprehensive Testing Checklist

## Database Migrations
- [ ] Run `php scripts/migrate_category_approval_workflow.php` - Creates/updates category approval workflow fields
  - Columns: `approval_status`, `created_by`, `reviewed_by`, `rejection_reason`, `reviewed_at`
- [ ] Run `php scripts/migrate_discipline_submission_tracking.php` - Creates disciplines table with submission tracking
  - Columns: `status`, `submitted_by`, `reviewed_by`, `admin_notes`, `submitted_at`, `reviewed_at`
- [ ] Verify migrations create proper foreign keys and indexes

## Type Definitions
- [ ] Category type includes: status, created_by, reviewed_by, rejection_reason, reviewed_at
- [ ] Discipline type includes: status, submitted_by, reviewed_by, admin_notes, submitted_at, reviewed_at
- [ ] Type exports are accessible in api-service.ts and components

## Location Utilities (location-utils.ts)
- [ ] Haversine distance calculation is accurate
- [ ] Coordinate validation works correctly
- [ ] `parseLocationString()` correctly parses "latitude,longitude" format
- [ ] `isValidCoordinates()` validates lat/lng ranges (-90 to 90, -180 to 180)
- [ ] `filterTrainersByServiceRadius()` correctly filters trainers
- [ ] `sortTrainersByDistance()` sorts trainers by distance (closest first)
- [ ] `getDefaultServiceRadius()` returns default radius (10 km)

## Trainer Profile Updates
- [ ] Trainer profile edit form shows "auto-calculated service_radius" field
- [ ] Service radius has manual override input
- [ ] UI shows calculated value (e.g., "💡 Auto-calculated: 10 km")
- [ ] UI shows override message when user enters custom value
- [ ] Trainer profile save includes service_radius (auto-calculated or manual)
- [ ] Service radius is persisted to database correctly
- [ ] Location/coordinates are saved with profile

## Category Approval Workflow (Admin UI)
- [ ] AdminCategoryManager displays status filter (active, pending_approval, rejected, archived)
- [ ] Categories can be filtered by status
- [ ] "Pending Approval" categories show approval/rejection buttons
- [ ] Admin can approve categories
- [ ] Admin can reject categories with rejection reason
- [ ] Approval sets status to "active" and records reviewed_by and reviewed_at
- [ ] Rejection sets status to "rejected" and stores rejection_reason
- [ ] Status badges display correctly (green for active, yellow for pending, red for rejected)
- [ ] Rejection reason is displayed when category is rejected

## Discipline Requests Workflow
- [ ] AdminDisciplineRequests component loads pending requests
- [ ] Requests can be filtered by status (pending, approved, rejected)
- [ ] Search works for trainer name and discipline name
- [ ] Pending requests show "Approve" and "Reject" buttons
- [ ] Admin can approve discipline requests
- [ ] Admin can reject with admin_notes
- [ ] admin_notes are displayed for rejected requests
- [ ] Rejection reason is properly stored and displayed
- [ ] Request status updates correctly after action

## Booking/Explorer Page
- [ ] Explore page loads available trainers
- [ ] User location is requested (via geolocation)
- [ ] Trainers are enriched with distance calculation
- [ ] Trainers are sorted by distance (closest first)
- [ ] Distance is displayed on trainer cards (e.g., "2.5 km")
- [ ] Nearest trainer is marked with badge
- [ ] User can filter trainers by distance radius
- [ ] User can filter trainers by category
- [ ] Trainers within user's radius preference are shown
- [ ] Distance calculation respects trainer's service_radius

## API Service Functions
- [ ] `getAdminCategories()` fetches categories with filtering
- [ ] `approveCategory()` sends approval request to backend
- [ ] `rejectCategory()` sends rejection with reason to backend
- [ ] `getTrainersByCategory()` fetches trainers for a category
- [ ] `getTrainersByCategoryWithDistance()` filters by service_radius and sorts by distance

## Backend API Endpoints
- [ ] `admin_category_list` returns filtered categories
- [ ] `admin_category_approve` updates category status correctly
- [ ] `admin_category_reject` updates category with rejection reason
- [ ] `discipline_request_list` returns filtered requests
- [ ] `discipline_request_approve` approves request
- [ ] `discipline_request_reject` rejects with admin_notes

## Data Persistence
- [ ] Category approval data persists after page reload
- [ ] Trainer profile service_radius persists
- [ ] Discipline request status persists
- [ ] Admin notes are saved and retrieved correctly
- [ ] Rejection reasons are preserved
- [ ] Timestamps (reviewed_at, submitted_at) are recorded

## Integration Tests
- [ ] Trainer can edit profile with service radius
- [ ] Admin can approve category for use
- [ ] Approved categories appear in trainer's category list
- [ ] Trainers with service_radius are correctly filtered for clients
- [ ] Distance calculation affects trainer sorting in booking list
- [ ] Complete booking workflow with location-based trainer selection

## Edge Cases
- [ ] Invalid coordinates are handled gracefully
- [ ] Missing location data doesn't break distance calculation
- [ ] Zero service_radius is handled correctly
- [ ] Distance calculation works for antipodal points
- [ ] Empty trainer list is handled gracefully
- [ ] Concurrent admin actions don't cause conflicts

## Performance Checks
- [ ] Distance calculations don't cause noticeable UI lag
- [ ] Large trainer lists (100+) load and sort smoothly
- [ ] Distance filtering is performant
- [ ] Database migrations complete without timeouts

## User Experience
- [ ] Error messages are clear and helpful
- [ ] Loading states are shown during async operations
- [ ] Disabled buttons prevent double-submission
- [ ] Toast notifications confirm successful actions
- [ ] Form validation prevents invalid submissions

## Notes for QA/Testing
1. Test with real location data where possible
2. Verify all timestamps are recorded in UTC
3. Check that users without location permission still see trainers
4. Test approval workflow with different admin accounts
5. Verify rejection reasons are visible to relevant parties
6. Test category updates after approval/rejection
7. Verify service_radius affects matching and booking display
