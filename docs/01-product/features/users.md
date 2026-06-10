# Feature: User Management

Feature for managing users in the system, available to **Lead and Admin** (plan-098).

---

## Access

- **Lead and Admin** can access user management (`authStore.canManageUsers`, route `minRole: "lead"`); tester / read_only / no_access are redirected.
- **Lead is capped at Lead**: a Lead cannot assign the Admin role (it is hidden in the role picker), nor edit/delete an Admin (those actions are hidden and the backend returns 403). Only an Admin can manage Admins.
- There is **no public self-registration** — accounts exist only because a Lead or Admin created them (api plan 049 removed `POST /auth/register`).
- Routes: `/users` (list), `/users/:id` (detail/edit)

---

## Capabilities

### User List (`/users`)
- Paginated DataTable of all users
- Search by username, email, or full name
- Filter by role
- Click a row to navigate to user detail

### Create User
- Dialog form with username, email, full name, role, active toggle — **no password field** (invite-only).
- Username and email are required. The account is created without a usable password and the backend emails the user a welcome invite link to set their own (see `014-password-reset.md` and api-testoria plan 048/049). Helper text under the form states this.
- Default role: `tester`. The **Admin** option is hidden in the role picker unless the current user is an Admin.

### Bulk Create
- CSV-format text input: `username,email,full_name,role` — **no password column** (each user is emailed an invite link).
- `username` and `email` are required per row; `full_name`/`role` optional (backend defaults apply).
- Maximum 100 users per operation
- Missing `full_name` or `role` triggers a client-side warning toast but does not block submission (backend defaults apply)
- **Full success**: dialog closes, textarea clears, success toast, users list refetched
- **Partial success**: dialog stays open, inline error panel shows failed rows, created users appear in the list immediately (refetched), textarea preserved for correction and resubmit
- **Full failure**: dialog stays open, error toast, inline error panel, no list refetch
- Inline error panel (scrollable, max 120px) lists each failed row as `Row N (email): <detail>`, where `detail` is the backend's specific message (e.g. `Email 'x@y.com' is already taken`). Panel colors are theme-aware (`--danger-color` + `color-mix` tint) so they read in both light and dark mode.

### Edit User (`/users/:id`)
- Edit email, full name, role, active status. The **Edit** button is hidden when a Lead views an Admin (only an Admin can edit an Admin).
- Password can be changed on edit (optional — leave blank to keep current). Whitespace-only input is treated as blank and skipped. (Edit-mode password set is retained; creation is invite-only.)
- A password change is sent as `password` on the `UserUpdate` payload and the success toast reads "User updated and password changed successfully"; a plain profile edit reads "User updated successfully"
- Username is read-only after creation

### Delete User
- Confirmation dialog before deletion
- The delete action is hidden on Admin rows for non-admins (only an Admin can delete an Admin)
- Returns 409 error if user has `lead` role — UI shows specific constraint message

### Export
- CSV and Excel export buttons in the header
- Downloads all users as a file

---

## Architecture

| Layer | File |
|-------|------|
| Types | `src/types/user.ts` |
| API | `src/api/users.ts` |
| Store | `src/stores/users.ts` |
| List View | `src/views/users/UserListView.vue` |
| Detail View | `src/views/users/UserDetailView.vue` |
| Form Component | `src/components/users/UserForm.vue` |

---

## Backend endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users` | List with search/filter/pagination |
| POST | `/users` | Create single user |
| POST | `/users/bulk` | Bulk create (max 100) |
| GET | `/users/export` | Export CSV/Excel |
| GET | `/users/:id` | Get user details |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
