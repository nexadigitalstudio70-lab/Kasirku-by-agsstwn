# Security Specification for Kasirku by Agsstwn

## 1. Data Invariants
- Users can read and update their own user profile document (`/users/{userId}`).
- Staff and owners can read and manage branches, tables, categories, menus, inventory, customers, reservations, and orders for their assigned store.
- Any authenticated user in the store can create or manage orders, updating inventory deductions atomically.
- Terminal state protection: Orders that are marked `completed` or `cancelled` cannot be altered except by authorized managers/owners.
- All documents must enforce string length constraints, valid ID structures, and non-empty mandatory fields.

## 2. Dirty Dozen Payloads (Rejection Matrix)
1. **Unauthenticated Read on Users**: Attempting to read `/users/user123` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on User Profile**: Authenticated as `userA` attempting to write to `/users/userB` -> `PERMISSION_DENIED`.
3. **Ghost Field Injection**: Attempting to set an arbitrary ghost field `evilRootAccess: true` in user document -> `PERMISSION_DENIED`.
4. **ID Poisoning**: Attempting to use a 10KB junk-character string as document ID -> `PERMISSION_DENIED`.
5. **Unauthorized Menu Deletion**: Unauthenticated client attempting to delete `/menus/item123` -> `PERMISSION_DENIED`.
6. **Order Terminal Mutate**: Attempting to mutate total on an order whose status is already `completed` -> `PERMISSION_DENIED`.
7. **Negative Price Attack**: Attempting to create a menu item with `price < 0` -> `PERMISSION_DENIED`.
8. **Oversized String Payload**: Attempting to write a 2MB payload into a table's name -> `PERMISSION_DENIED`.
9. **Branch Impersonation**: Attempting to set another user's `ownerId` as owner of a branch -> `PERMISSION_DENIED`.
10. **Tampering with Audit Logs**: Attempting to mutate or delete existing `inventory_transactions` records -> `PERMISSION_DENIED`.
11. **Negative Inventory Stock**: Setting `currentStock < 0` without valid inventory transaction -> `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: Running unbounded cross-tenant collection group queries without branch isolation -> `PERMISSION_DENIED`.
