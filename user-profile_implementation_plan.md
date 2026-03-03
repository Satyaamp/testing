# Implementation Plan: Profile Picture Upload

## Proposed Changes

### Backend Updates
1. **[src/models/user.model.js](file:///d:/flutter/backend/src/models/user.model.js)**
   - Add `avatar: { type: String, default: null }` to the schema (Google Login already implies this field).

2. **`src/middleware/avatarUpload.middleware.js` [NEW]**
   - Create a disk-storage based multer middleware to save uploaded images to `../frontend/assets/avatars/`. File names will be timestamped to avoid cache issues/collisions.

3. **[src/controllers/auth.controller.js](file:///d:/flutter/backend/src/controllers/auth.controller.js) & [src/routes/auth.routes.js](file:///d:/flutter/backend/src/routes/auth.routes.js)**
   - Add `uploadAvatar` controller function to handle the DB update using the uploaded filename.
   - Add `POST /upload-avatar` route protected by JWT and the new multer middleware.

### Frontend Updates
1. **[frontend/profile.html](file:///d:/flutter/frontend/profile.html)**
   - Add a hidden file input for the avatar.
   - Modify the `.profile-avatar` div to make it clickable with a hover overlay (e.g., an edit icon).
   - Display the user's `avatar` if it exists, otherwise fallback to the SVG.

2. **[frontend/js/profile.js](file:///d:/flutter/frontend/js/profile.js)**
   - Add Javascript to trigger the hidden file input when `.profile-avatar` is clicked.
   - Listen for the `change` event, wrap the file in `FormData`, and POST it to `/api/auth/upload-avatar`.
   - Update the UI and save the new avatar URL to `localStorage`.

3. **[frontend/js/authGuard.js](file:///d:/flutter/frontend/js/authGuard.js)**
   - Add a small script that runs on every protected page (Dashboard, Monthly, Yearly, Profile, Analytics) to check `localStorage` for `avatar`. 
   - If an avatar exists, find the Navigation Profile buttons (via class `.nav-btn-profile[title="Your Profile"]`) and replace the default emojis/SVGs with an `<img>` tag containing the user's avatar.
   - (Optional) Fetch `/api/auth/me` asynchronously to ensure the avatar in `localStorage` is up-to-date with other devices.

## Verification Plan
### Automated Tests
- None existing. We will modify the Node.js backend directly.

### Manual Verification
1. Open [profile.html](file:///d:/flutter/frontend/profile.html) in the browser, click the profile picture placeholder, and upload an image.
2. Verify the image updates instantly on the profile page and displays a toast notification.
3. Verify the image uploads to `d:\flutter\frontend\assets\avatars`.
4. Navigate to [dashboard.html](file:///d:/flutter/frontend/dashboard.html), [monthly.html](file:///d:/flutter/frontend/monthly.html), and [yearly.html](file:///d:/flutter/frontend/yearly.html) and verify the navbar shows the uploaded profile picture instead of the default icon.
