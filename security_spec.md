# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Default-Deny Safety Net**: All unmatched Firestore paths deny read and write operations.
2. **Verified Identity Enforcement**: All reads and writes require an authenticated user (`request.auth != null`) with `request.auth.token.email_verified == true`.
3. **PII Isolation**: `/users/{userId}` holds personal email addresses and is strictly readable/writable only by the owning user (`request.auth.uid == userId`) or a verified admin (`isAdmin()`). Self-assigned privilege escalation (`role != 'staff'`) is blocked on creation and updates.
4. **Master Gate & Atomicity on Tracking Events**:
   - A `TrackingEvent` in `/letters/{letterId}/trackingEvents/{eventId}` cannot exist without an existing parent `Letter` at `/letters/{letterId}` (verified via `get()` or `existsAfter()` during initial atomic creation batch).
   - Every `TrackingEvent` creation MUST occur atomically in the same `writeBatch` as the parent `Letter` creation or update (`getAfter(.../letters/$(letterId)).data.updatedAt == request.time`).
   - `TrackingEvent` records are immutable (`allow update, delete: if false;` except admin cleanup if explicitly needed, or strictly immutable audit log).
5. **Terminal State Locking**: Once a letter reaches `'Diarsipkan'`, non-admin collaborators cannot mutate its status or fields.
6. **Secure List Queries**: `allow list` on `/letters` and `trackingEvents` explicitly checks `resource.data.ownerId == request.auth.uid || request.auth.uid in resource.data.collaboratorUids || isBootstrapAdmin()`, with zero `get()` or `exists()` calls inside `allow list`.
7. **Strict Key & Size Boundaries**: Every `create` validates `hasAll` and `hasOnly`; every `update` validates `isValidLetter(incoming())` + `affectedKeys().hasOnly(...)`; every string enforces `.size()`, and `collaboratorUids` enforces `size() >= 1 && size() <= 20` with first-element type verification.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` attempting to `get` or `create` `/letters/ltr_1`.
2. **Unverified Email Spoof**: `request.auth.token.email == 'babelhendri@gmail.com'` with `email_verified: false` attempting admin read/write.
3. **Privilege Escalation on User Registration**: User creating `/users/{uid}` with `role: 'admin'` instead of `'staff'`.
4. **Cross-User PII Snooping**: User B attempting `get` on `/users/userA`.
5. **Identity Spoofing on Letter Create**: User A creating `/letters/ltr_1` with `ownerId: 'userB'`.
6. **Shadow / Ghost Field Injection**: User A creating `/letters/ltr_1` with an extra field `isApprovedByDirector: true`.
7. **ID Poisoning**: User A creating `/letters/!@#invalid_id_with_spaces_or_150_chars...` failing `isValidId()`.
8. **Denial-of-Wallet Oversized String**: User A creating a letter with `subject` of 5,000 characters (`> 240`).
9. **Unbounded Array Attack**: User A creating a letter with `collaboratorUids` containing 25 entries (`> 20`).
10. **Client-Spoofed Timestamp**: User A creating or updating a letter with `createdAt` or `updatedAt` set to a past date instead of `request.time`.
11. **Orphan / Non-Atomic Tracking Event**: User A creating `/letters/ltr_1/trackingEvents/evt_1` standalone without updating the parent letter's `updatedAt == request.time` in the same batch.
12. **Terminal State Mutation**: Non-admin collaborator attempting to update a letter whose existing `status == 'Diarsipkan'`.
