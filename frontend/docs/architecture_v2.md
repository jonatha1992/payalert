# PayAlert V2 Architecture

## Overview
PayAlert V2 introduces multi-store support, role-based access (Owners vs Employees), and a Progressive Web App (PWA) terminal for real-time notifications.

## Database Schema Enhancements

### 1. `users` Table
- **`role`**: Enum (`owner`, `employee`, `admin`).
- **`assigned_store_id`** (UUID): Foreign key to `stores`.
    - **Owner**: Can see all stores (`assigned_store_id` is usually NULL or ignored).
    - **Employee**: MUST have `assigned_store_id`. Can only see data for this store.
- **`business_id`**: Links user to the tenant (Business).

### 2. `payment_tokens` Table
- **`store_id`** (UUID): Foreign key to `stores`.
- **`provider`**: `mercadopago`, `uala`.
- **`access_token`**: Encrypted/Protected token.
- **Logic**: Tokens are now linked to specific stores. A business can have different MP accounts for different branches.

### 3. `transactions` Table
- **`store_id`**: Links transaction to a store.
- **`type`**: `income` (payments) or `expense`.
- **`status`**: `completed`, `pending`, `failed`.

## Security & Access Control (RLS)

- **Owners**: Can view/edit all resources (`stores`, `users`, `tokens`) with their `business_id`.
- **Employees**:
    - Can READ `stores` (only their own).
    - Can READ `transactions` (only their own store).
    - Can READ `coworkers` (users in same store, via `get_my_assigned_store_id()` function).
- **Infinite Recursion Fix**: Implemented `SECURITY DEFINER` function `get_my_assigned_store_id()` to safely resolve store ID within RLS policies without recursive checks on `users` table.

## Frontend Architecture

### 1. Authentication (`AuthProvider`)
- Handles Session and Profile fetching.
- **Critical Error Safety**: If Profile fetch fails due to RLS/Schema issues, automatically logs out to prevent infinite loops.

### 2. Dashboard (`/dashboard`)
- **Role-Based Sidebar**:
    - **Owners**: Full menu (Dashboard, Stores, Integrations, Employees, Expenses).
    - **Employees**: Limited menu (Terminal).

### 3. Employee Terminal (`/dashboard/terminal`)
- **Real-Time Feed**: Subscribes to `INSERT` events on `transactions` table for the `assigned_store_id`.
- **Audio Alerts**: Plays `public/sounds/notification.mp3` on new transaction.
- **PWA**: Installable as a native-like app on Android/iOS via `manifest.json`.

## PWA Configuration
- **Manifest**: `public/manifest.json`.
- **Service Worker**: Managed by `next-pwa`.
- **Icons**: References `/icon-192x192.png` and `/icon-512x512.png` (User must provide these).

## Future Modules
- **Push Notifications**: Requires VAPID key generation and Service Worker "push" event listener (Phase 3).
