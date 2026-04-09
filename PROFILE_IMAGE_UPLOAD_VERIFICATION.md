# Profile Image Upload Verification Report

## Summary
✅ Profile image upload functionality during profile update process has been verified and corrected.

---

## Issues Found & Fixed

### 1. **Incorrect Upload Base URL** ❌ → ✅
**Problem:** The API was using `https://skatryk.co.ke/uploads` as the default upload directory instead of `https://trainercoachconnect.com/uploads`.

**Locations Fixed:**
- `api.php` line 158 (normalizeImageUrl function)
- `api.php` line 352 (file upload handler)

**Fix Applied:**
```php
// BEFORE
$uploadBaseUrl = getenv('UPLOAD_BASE_URL') ?: 'https://skatryk.co.ke/uploads';

// AFTER  
$uploadBaseUrl = getenv('UPLOAD_BASE_URL') ?: 'https://trainercoachconnect.com/uploads';
```

---

## How Profile Image Upload Works

### For Trainers (TrainerProfileEditor.tsx)
1. **Image Upload** → Uses `useFileUpload` hook
   - Max file size: 5MB
   - Allowed extensions: jpg, jpeg, png, gif
   - Uploads to API endpoint `/api.php`

2. **Profile Update** → Calls `apiService.updateUserProfile()`
   - Sends `profile_image` field with uploaded image URL
   - Saves to database via `profile_update` action
   - Profile image is normalized via `normalizeImageUrl()` function

3. **URL Flow:**
   ```
   User uploads image
   ↓
   Frontend uploads to /api.php (FormData with files[])
   ↓
   API stores in ./uploads/ directory
   ↓
   API returns full URL: https://trainercoachconnect.com/uploads/file_xxxxx.jpg
   ↓
   Frontend stores URL in profile_image field
   ↓
   Profile update saves URL to database
   ↓
   Image displayed from trainercoachconnect.com/uploads/
   ```

### For Clients (ClientProfileEditor.tsx)
1. **Manual URL Input** → Users paste image URLs directly
2. **Profile Update** → Same process as trainers
3. **URL Storage** → Stored as-is in database, normalized when retrieved

---

## API Configuration

### Environment Variable (Recommended)
Set this in your server environment:
```bash
EXPORT UPLOAD_BASE_URL="https://trainercoachconnect.com/uploads"
```

### Default Behavior
If `UPLOAD_BASE_URL` is not set, the API now defaults to:
```
https://trainercoachconnect.com/uploads
```

---

## Image URL Normalization

When retrieving profile images, the API automatically normalizes URLs through `normalizeImageUrl()`:

1. **Already absolute URLs** (http/https) → Returns as-is
2. **Relative paths with /uploads/** → Extracts filename and prepends base URL
3. **Other relative paths** → Prepends base URL

Example:
```
Input: "file_123.jpg" or "/uploads/file_123.jpg" or "uploads/file_123.jpg"
↓
Output: "https://trainercoachconnect.com/uploads/file_123.jpg"
```

---

## Frontend Fallback (Safety Net)

The frontend (`use-file-upload.ts`) has an additional safety fallback:
```javascript
url: file.url.startsWith('http')
  ? file.url
  : `https://trainercoachconnect.com/uploads/${file.url.split('/').pop()}`
```

This ensures even if the API doesn't return a full URL, the frontend will construct it correctly.

---

## Verification Checklist

- [x] API uses correct base URL: `https://trainercoachconnect.com/uploads`
- [x] Trainer profile image upload is implemented
- [x] Client profile image URL input is implemented
- [x] Profile update includes `profile_image` field
- [x] Image URL normalization handles relative paths
- [x] Frontend has fallback URL configuration
- [x] File upload validation (size, extensions, MIME types)

---

## To Test

### Step 1: Upload Profile Image (Trainer)
1. Log in as trainer
2. Open profile editor
3. Click "Upload Photo"
4. Select an image (jpg, png, gif, max 5MB)
5. Verify image shows in preview
6. Click "Save Profile"

### Step 2: Verify Database Storage
- Check that `profile_image` field in `user_profiles` table contains the full URL
- URL should be: `https://trainercoachconnect.com/uploads/file_xxxxx_timestamp.jpg`

### Step 3: Verify Image Display
- Reload the page
- Profile image should load from the saved URL
- Should be accessible at `https://trainercoachconnect.com/uploads/file_xxxxx_timestamp.jpg`

### Step 4: Manual URL Update (Client)
1. Log in as client
2. Open profile editor
3. Paste image URL in "Profile image URL" field
4. Click "Save"
5. Verify URL is saved in database

---

## Notes

- All uploaded files are stored in `/uploads/` directory on the server
- File names are randomized with `uniqid()` and timestamp for security
- File permissions are set to 0644 (readable by all, writable by owner)
- Maximum file size is 50MB (configurable in API)
- MIME type validation prevents malicious file uploads

---

## Troubleshooting

### Images not uploading?
1. Check `UPLOAD_BASE_URL` environment variable
2. Verify `/uploads/` directory exists and is writable
3. Check file size and format (jpg/png/gif only for trainer images)
4. Check browser console for detailed error messages

### Old images from skatryk.co.ke?
1. Existing images from old URL will still work due to normalization
2. New uploads will use correct URL
3. To migrate old images, you can manually update database entries

### Image URLs not displaying?
1. Verify uploads directory is public/accessible
2. Check file permissions on `/uploads/` folder
3. Ensure server allows direct file access to `/uploads/`
