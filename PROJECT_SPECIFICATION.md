# Project Specification: FieldOps Nexus

## 1. Product Identity

### Recommended Application Name

**FieldOps Nexus**

FieldOps Nexus communicates three important ideas: field workforce visibility, operational coordination, and a central connected system. It works well for both the Android employee app and the admin panel.

### Logo Concept

Use a modern shield-map-pin mark:

- **Symbol:** A shield outline containing a map pin and three connected nodes.
- **Meaning:** Secure workforce tracking, location intelligence, and team coordination.
- **Primary colors:** Deep navy `#0B1F3A`, electric teal `#19B7A6`, signal amber `#F5A623`.
- **Style:** Flat, professional, minimal, suitable for app icon, admin sidebar, and document branding.

### Suggested Tagline

**Live workforce visibility. Smarter task coordination.**

## 2. Purpose

The purpose of this internal POC is to build a stylish, professional workforce management platform that helps the organization test real-time employee location sync, project-based assignment, AI-assisted task generation, asset declaration, and admin visibility before moving toward a larger production-grade deployment.

The POC will consist of:

- **Android mobile application** built in React Native.
- **Admin panel** built in React.
- **Backend API** built in Python FastAPI.
- **Database** using MongoDB.
- **AI API integration** for project-based task generation.

## 3. Source Context

The provided requirement document describes a larger workforce management system for police operations with three connected modules:

- **Live Wall / Force Tracking:** Real-time, map-based tracking with role-based marker colors and clustering.
- **Personnel Roster System:** AI-supported roster generation using personnel attributes and rules.
- **Arsenal / Inventory Management:** Equipment and asset assignment, custody, approval, and reconciliation.

For this internal POC, the system will adapt those concepts to a software development company environment, while keeping the architecture extensible for field-force, government, or enterprise workforce use cases later.

## 4. User Types

### Mobile App Users

Employees who register in the Android app using their company work email, name, and designation. The app captures device identity and location data, allows asset enlistment, receives generated tasks, and supports logout.

### Admin Users

Internal administrators who manage projects, view onboarded users, monitor online/offline status, inspect user locations on a map, approve assets, and trigger AI-based task generation.

## 5. Recommended Designations for Internal POC

Because the POC will be tested inside a software development company, the registration dropdown should use software-company roles instead of police ranks.

Recommended designation list:

- Software Engineer
- Senior Software Engineer
- Tech Lead
- QA Engineer
- Senior QA Engineer
- UI/UX Designer
- DevOps Engineer
- Backend Developer
- Frontend Developer
- Mobile App Developer
- Product Manager
- Project Manager
- Business Analyst
- Delivery Manager
- Sales / Account Manager
- HR / Operations
- Admin
- Leadership

For map visualization, each designation group can have a unique marker color. Similar roles may share a color family to keep the map readable.

## 6. POC Scope

### Included in POC

- Android user registration using work email, full name, and designation dropdown.
- Device ID capture at registration.
- Location permission and location capture.
- Location sync every 10 seconds while the user opens or actively uses the app.
- User logout.
- Admin login.
- Admin dashboard showing onboarded, online, and offline users.
- Online status based on location sync within the last 60 seconds.
- Last online timestamp for offline users.
- Project creation and user assignment to projects.
- AI API based task generation for selected project users.
- User task list in mobile app.
- Asset enlistment by users.
- Asset review and approval by admin.
- Stylish clustered map view with designation-based colors.

### Excluded from POC

- Full production-grade roster scheduling.
- Payroll, attendance, or HRMS integration.
- Background location tracking when the app is fully closed, unless separately approved.
- Enterprise SSO.
- Native iOS app.
- Advanced cybersecurity audit and penetration testing.
- Excel as a system of record. The POC will keep MongoDB as the system of record.

## 7. Mobile App Functional Requirements

### 7.1 Registration

Users will register using:

- Work email ID.
- Full name.
- Designation selected from dropdown.

During registration, the system will capture:

- Device ID.
- Initial location.
- Registration timestamp.
- App version.

Validation rules:

- Email must use an approved company domain.
- Name is required.
- Designation is required.
- Device ID must be unique or flagged for review if reused.

### 7.2 Location Sync

Every time the user opens the app, the mobile app will send the user's location to the backend every 10 seconds.

Each sync event will include:

- User ID.
- Device ID.
- Latitude.
- Longitude.
- Accuracy.
- Timestamp.
- App state.
- Battery level, if available.

The backend will update the user's latest known location and store location history for audit/testing.

### 7.3 User Tasks

Users will see tasks generated by the AI API after admin assigns them to a project and generates tasks.

Task details should include:

- Task title.
- Task description.
- Project name.
- Priority.
- Status.
- Due date, if generated.

Suggested task statuses:

- Pending
- In Progress
- Blocked
- Completed

### 7.4 Asset Enlistment

Users can enlist assets they have or use for work.

Asset fields:

- Asset name.
- Asset type.
- Serial number or asset ID.
- Description.
- Photo upload, optional for POC.
- Submitted date.

Asset approval status:

- Pending
- Approved
- Rejected

### 7.5 Logout

The mobile app must provide a clear logout option. On logout:

- Auth token is removed from the device.
- Location sync stops.
- User status becomes offline after the 60 second online threshold passes.

## 8. Admin Panel Functional Requirements

### 8.1 Dashboard

The admin dashboard will show:

- Total onboarded users.
- Online users.
- Offline users.
- Pending asset approvals.
- Active projects.
- Recent location sync activity.

Online definition:

- A user is online if their last location sync was received within the last 60 seconds.

Offline definition:

- A user is offline if no location sync was received in the last 60 seconds.

For offline users, show:

- Last online time.
- Last known location.
- Last sync timestamp.

### 8.2 User Management

Admin can view:

- User name.
- Work email.
- Designation.
- Device ID.
- Online/offline status.
- Last online time.
- Assigned project.
- Asset count.

### 8.3 Project Management

Admin can:

- Create projects.
- Edit project details.
- Add users to projects.
- Remove users from projects.
- View project members.
- Trigger AI task generation for project members.

Project fields:

- Project name.
- Project description.
- Start date.
- Target end date.
- Project priority.
- Assigned users.

### 8.4 AI Task Generation

Admin will add users to a project and trigger task generation using an AI API.

AI input may include:

- Project name.
- Project description.
- Project goals.
- User names.
- User designations.
- Available team composition.

AI output should include:

- Task title.
- Task description.
- Assigned user.
- Priority.
- Suggested due date.
- Dependencies, optional.

The generated task list should be stored in MongoDB and shown in both admin panel and mobile app.

### 8.5 Map View

Admin can see users' locations on a stylish map using clustering.

Map requirements:

- Cluster nearby users.
- Use different colors for different designations.
- Show online/offline state visually.
- Open marker detail on click.
- Show user name, designation, last sync time, and assigned project.
- Filter by designation.
- Filter by online/offline status.
- Filter by project.

Recommended map style:

- Dark professional base map for command-center feel.
- Colored markers by designation.
- Cluster bubbles with count and dominant designation color.

### 8.6 Asset Approval

Admin can view user-submitted assets and approve or reject them.

Admin asset view should show:

- User name.
- Designation.
- Asset name.
- Asset type.
- Serial number or asset ID.
- Submitted date.
- Approval status.

Admin actions:

- Approve asset.
- Reject asset.
- Add admin note.

## 9. Technical Architecture

### Frontend

Mobile app:

- React Native.
- Android-first POC.
- Location permission handling.
- Device ID capture.
- Secure token storage.
- Background interval while app is open.

Admin panel:

- React.
- Responsive admin UI.
- Map clustering.
- Dashboard cards.
- Tables for users, projects, tasks, and assets.

### Backend

Backend framework:

- Python FastAPI.

Core backend responsibilities:

- Authentication and authorization.
- User registration.
- Device ID storage.
- Location ingestion.
- Online/offline calculation.
- Project management.
- AI task generation orchestration.
- Asset approval workflow.
- Admin APIs.

### Database

Database:

- MongoDB.

Recommended collections:

- `users`
- `devices`
- `locations`
- `projects`
- `tasks`
- `assets`
- `admins`
- `audit_logs`

### AI Integration

The system will use an external AI API to generate tasks based on project context and team composition.

The backend should:

- Build a structured prompt.
- Send project and user context to the AI API.
- Validate and normalize the AI response.
- Store generated tasks in MongoDB.
- Allow admin review before final assignment, recommended.

## 10. Suggested API Endpoints

### Auth and Registration

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Location

- `POST /api/locations/sync`
- `GET /api/admin/locations/latest`
- `GET /api/admin/locations/history/{user_id}`

### Users

- `GET /api/admin/users`
- `GET /api/admin/users/{user_id}`
- `PATCH /api/admin/users/{user_id}`

### Projects

- `POST /api/admin/projects`
- `GET /api/admin/projects`
- `GET /api/admin/projects/{project_id}`
- `PATCH /api/admin/projects/{project_id}`
- `POST /api/admin/projects/{project_id}/members`
- `DELETE /api/admin/projects/{project_id}/members/{user_id}`

### Tasks

- `POST /api/admin/projects/{project_id}/generate-tasks`
- `GET /api/admin/tasks`
- `GET /api/mobile/tasks`
- `PATCH /api/mobile/tasks/{task_id}/status`

### Assets

- `POST /api/mobile/assets`
- `GET /api/mobile/assets`
- `GET /api/admin/assets`
- `PATCH /api/admin/assets/{asset_id}/approve`
- `PATCH /api/admin/assets/{asset_id}/reject`

## 11. Data Model Summary

### User

- `_id`
- `name`
- `email`
- `designation`
- `device_id`
- `status`
- `last_location`
- `last_sync_at`
- `assigned_project_ids`
- `created_at`

### Location

- `_id`
- `user_id`
- `device_id`
- `latitude`
- `longitude`
- `accuracy`
- `timestamp`
- `created_at`

### Project

- `_id`
- `name`
- `description`
- `priority`
- `start_date`
- `target_end_date`
- `member_user_ids`
- `created_by`
- `created_at`

### Task

- `_id`
- `project_id`
- `assigned_user_id`
- `title`
- `description`
- `priority`
- `status`
- `due_date`
- `generated_by_ai`
- `created_at`

### Asset

- `_id`
- `user_id`
- `asset_name`
- `asset_type`
- `serial_number`
- `description`
- `status`
- `admin_note`
- `created_at`
- `reviewed_at`

## 12. Security and Privacy Requirements

Location tracking creates sensitive operational data. Even for an internal POC, the following controls are recommended:

- HTTPS only.
- JWT or secure token-based authentication.
- Role-based access control for admin APIs.
- Store only required location data.
- Encrypt secrets and API keys using environment variables.
- Log admin actions in audit logs.
- Restrict admin panel access to approved internal users.
- Display clear user consent for location collection.
- Stop sync immediately after logout.
- Do not expose raw location data to non-admin users.

## 13. UI and Design Direction

### Mobile App

Style direction:

- Clean, professional, modern.
- Navy and teal primary palette.
- Simple onboarding.
- Clear permission screens.
- Task cards with priority indicators.
- Asset submission form with status badges.

Main screens:

- Login / Register.
- Permission request.
- Home dashboard.
- My Tasks.
- My Assets.
- Profile / Logout.

### Admin Panel

Style direction:

- Command-center inspired but not overly dark.
- Dense, readable operational dashboard.
- Stylish map view as a primary admin feature.
- Role colors and online status indicators.
- Tables optimized for scanning.

Main screens:

- Login.
- Dashboard.
- Map.
- Users.
- Projects.
- Tasks.
- Assets.
- Settings.

## 14. POC Success Criteria

The POC will be considered successful if:

- Users can register from the Android app.
- Device ID and location are captured successfully.
- Location sync works every 10 seconds while the app is open.
- Admin can see online users based on the last 60 seconds of sync.
- Admin can see offline users and last online time.
- Admin can view users on a clustered, color-coded map.
- Admin can create a project and add users.
- AI API can generate tasks for project users.
- Users can view assigned tasks.
- Users can enlist assets.
- Admin can approve or reject assets.
- The overall product experience feels professional and suitable for internal demos.

## 15. Open Decisions

- Final company email domain list for registration.
- Exact AI API provider and model.
- Map provider: Google Maps, Mapbox, or an indigenous/local map provider.
- Whether location history should be retained fully or only for a limited time.
- Whether admin must review AI-generated tasks before assignment.
- Whether photo upload is required for assets in the POC.
- Whether background location tracking is required beyond active app usage.

## 16. Recommended Build Phases

### Phase 1: Foundation

- Backend project setup.
- MongoDB schema design.
- Admin and mobile authentication.
- User registration with designation dropdown.

### Phase 2: Location and Dashboard

- Device ID capture.
- Location sync every 10 seconds while app is open.
- Online/offline calculation.
- Admin dashboard.

### Phase 3: Map and Projects

- Clustered map view.
- Designation-based marker colors.
- Project creation and user assignment.

### Phase 4: AI Tasks and Assets

- AI task generation.
- Mobile task list.
- Asset enlistment.
- Admin asset approval.

### Phase 5: Polish and Internal Testing

- UI refinement.
- Error handling.
- Audit logging.
- Internal POC testing.
- Demo preparation.
