export interface ApiError { error: string }
export interface Movement { id: string; type: 'income' | 'expense'; amount: number; description: string; category: string; store_id: string; created_at: string; status: string; provider: string; currency: string; connection_id: string; stores: { name: string } | null }
// GET /api/reports/movements returns transactions and pagination.
export interface MovementsResponse { transactions: Movement[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
export interface ExpectedPayment { id: string; amount: number; reference: string | null; status: string; createdAt: string; expiresAt: string }
// GET /api/expected-payments returns { expectedPayments }.
export interface ExpectedPaymentsResponse { expectedPayments: ExpectedPayment[] }
// GET /api/notification-preferences returns { preferences }.
export interface NotificationPreferences { pushEnabled: boolean; soundEnabled: boolean; emailEnabled: boolean }
export interface NotificationPreferencesResponse { preferences: NotificationPreferences }
// POST/DELETE /api/push/devices return { success: true }.
export interface PushDeviceResponse { success: boolean }
// GET /api/integrations returns { connections }.
export interface IntegrationsResponse { connections: Array<{ id: string; provider: string; status: string; label: string | null }> }
