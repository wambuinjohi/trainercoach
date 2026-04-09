# Testing Checklist - Trainer Profile Enhancement (Phases 4-6)

## Phase 4: TrainerProfileEditor Styling and Layout ✅

### Visual Layout Tests
- [ ] Open `/trainer` and navigate to profile editor
- [ ] Verify form displays in organized Card sections:
  - [ ] Basic Information (name, profile image)
  - [ ] About You (bio)
  - [ ] Service Location & Radius (map)
  - [ ] Rates & Payout (hourly rate, service radius, M-Pesa)
  - [ ] Service Categories
  - [ ] Registration Path
  - [ ] Sponsorship
  - [ ] Verification Documents
  - [ ] Availability

### Responsive Design Tests
**Mobile (< 640px)**
- [ ] All form fields stack vertically
- [ ] Buttons are full width and readable
- [ ] Images and preview are centered and appropriately sized
- [ ] Category list scrolls smoothly
- [ ] No horizontal overflow

**Tablet (640px - 1024px)**
- [ ] Two-column layouts work for rate fields
- [ ] Form has good spacing
- [ ] Buttons are properly positioned

**Desktop (> 1024px)**
- [ ] Multi-column layouts render correctly
- [ ] Form has comfortable spacing
- [ ] All elements are easily readable

### Form Functionality Tests
- [ ] Name field updates correctly
- [ ] Profile image upload works
- [ ] Profile image preview displays
- [ ] Image URL input works
- [ ] Bio textarea accepts text
- [ ] Location selector works and saves coordinates
- [ ] Hourly rate accepts numbers
- [ ] Service radius shows auto-calculated value
- [ ] M-Pesa number field accepts input
- [ ] Categories can be selected/deselected
- [ ] Category pricing inputs appear when category selected
- [ ] Registration path radio buttons work
- [ ] Sponsorship selector works
- [ ] Availability selector works

---

## Phase 5a: AuthContext Signup Data Storage ✅

### Data Storage Tests
- [ ] Sign up as trainer with form data
- [ ] Verify `signup_data` is stored in localStorage
- [ ] Check localStorage contains:
  - [ ] `full_name`
  - [ ] `phone_number`
  - [ ] `location_label`
  - [ ] `location_lat`
  - [ ] `location_lng`
  - [ ] `registration_path`
  - [ ] `sponsor_trainer_id` (if applicable)

### Context Tests
- [ ] `useAuth()` hook returns `signupData` after signup
- [ ] `clearSignupData()` function removes signup data
- [ ] On page refresh, `signupData` is restored from localStorage
- [ ] Sign out clears all signup data

---

## Phase 5b: Profile Setup Modal on Signup ✅

### Signup Flow Tests
**Client Signup Path**
- [ ] Navigate to `/signup`
- [ ] Click "Sign Up" tab
- [ ] Select "Client - Looking for trainers"
- [ ] Fill in form (name, email, phone, location, PIN)
- [ ] Click "Create Account"
- [ ] Should redirect directly to client dashboard (NO modal)

**Trainer Signup Path**
- [ ] Navigate to `/signup`
- [ ] Click "Sign Up" tab
- [ ] Select "Trainer - Offering services"
- [ ] Fill in form (name, email, phone, location, PIN)
- [ ] Click "Create Account"
- [ ] **Modal should appear** with "Complete Your Profile"
- [ ] Modal shows TrainerProfileEditor inside
- [ ] Can close modal or save profile to continue

### Modal Functionality Tests
- [ ] Modal has correct title: "Complete Your Profile"
- [ ] Modal has description text
- [ ] Modal displays full TrainerProfileEditor
- [ ] Can scroll through form if content exceeds viewport
- [ ] Cancel button closes modal and redirects to trainer dashboard
- [ ] Save button saves profile and redirects to trainer dashboard
- [ ] `trainer_signup_new` flag is cleared after modal closes
- [ ] `signup_data` is cleared after successful profile save

### Edge Cases
- [ ] If trainer closes browser during modal, flag/data should persist
- [ ] Refreshing page while modal open should restore modal state
- [ ] Multiple signup attempts only trigger modal once

---

## Phase 6: Profile-Related API Functions ✅

### Function Availability Tests
- [ ] `getProfileCompletion()` function exists in api-service.ts
- [ ] `getTrainerStats()` function exists in api-service.ts
- [ ] `getTrainerProfileSummary()` function exists in api-service.ts
- [ ] `updateTrainerProfileStatus()` function exists in api-service.ts
- [ ] `getTrainersWithProfileStatus()` function exists in api-service.ts

### Function Call Tests
- [ ] Can import and call `getProfileCompletion(userId)`
- [ ] Can import and call `getTrainerStats(userId)`
- [ ] Can import and call `getTrainerProfileSummary(userId)`
- [ ] Functions handle errors gracefully
- [ ] Functions return expected data structures

---

## Complete End-to-End Flow Test

### Scenario 1: New Trainer Complete Signup + Profile
1. [ ] Navigate to `/signup`
2. [ ] Complete trainer signup form
3. [ ] Modal appears automatically
4. [ ] Fill in profile information
5. [ ] Click Save
6. [ ] Redirects to `/trainer` dashboard
7. [ ] Check localStorage has both auth data and signup data
8. [ ] Profile data is saved to API

### Scenario 2: Existing Trainer Login + Edit Profile
1. [ ] Sign in with existing trainer account
2. [ ] Navigate to profile editor
3. [ ] Modify some fields
4. [ ] Save changes
5. [ ] Verify changes are persisted
6. [ ] Refresh page and verify changes remain

### Scenario 3: Responsive Design Across Devices
1. [ ] Test on mobile device (< 640px)
   - [ ] All forms are readable
   - [ ] No horizontal scroll
   - [ ] Touch targets are large enough
   - [ ] Modal scrolls properly

2. [ ] Test on tablet (640-1024px)
   - [ ] Two-column layouts work
   - [ ] Form has good spacing
   - [ ] Modal is readable

3. [ ] Test on desktop (> 1024px)
   - [ ] All layouts render properly
   - [ ] Form has comfortable spacing
   - [ ] Modal doesn't take up too much space

---

## Known Issues & Fixes Applied

### Issue 1: Profile Image Display
**Status:** ✅ Fixed
- Image upload and preview now properly handled
- Fallback to localStorage cache if API fails

### Issue 2: Category Data Structure Handling
**Status:** ✅ Fixed
- Handles multiple API response formats
- Supports both `category_id` and `cat_id` fields

### Issue 3: Area Coordinates Parsing
**Status:** ✅ Fixed
- Properly parses both string and object coordinate data
- Converts to/from JSON as needed

---

## Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Performance Tests

- [ ] Profile page loads in < 2 seconds
- [ ] Category list scrolls smoothly (60 fps)
- [ ] Image upload progress updates smoothly
- [ ] No memory leaks after multiple form submissions
- [ ] No duplicate API requests on component mount

---

## Accessibility Tests

- [ ] Form labels are properly associated with inputs
- [ ] Error messages are clear and helpful
- [ ] Tab navigation works correctly
- [ ] Color contrast is sufficient
- [ ] Modal is keyboard accessible
- [ ] Can escape modal with Escape key

---

## Sign-Off

- [ ] All critical tests passed
- [ ] No console errors or warnings
- [ ] No broken UI elements
- [ ] Responsive design verified across devices
- [ ] Complete flow tested end-to-end

**Tested by:** [Name]
**Date:** [Date]
**Environment:** [Dev/Staging/Prod]
