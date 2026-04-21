import { supabase } from './supabaseClient';

export type NotificationType = 'assignment' | 'update' | 'reminder' | 'sale' | 'payment' | 'meeting' | 'role';

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  related_id?: string;
}

/**
 * Creates a notification in the database.
 * If type is 'reminder', it checks if a similar notification was already created today to avoid spam.
 */
export async function createNotification({
  user_id,
  title,
  message,
  type,
  related_id
}: CreateNotificationParams) {
  try {
    // Basic anti-spam for reminders
    if (type === 'reminder' && related_id) {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user_id)
        .eq('type', 'reminder')
        .eq('related_id', related_id)
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        return { success: true, duplicated: true };
      }
    }

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        title,
        message,
        type,
        related_id
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error via API creating notification:', result.error);
      throw new Error(result.error || 'Failed to create notification via API');
    }

    return { success: true, data: result.data };
  } catch (error: any) {
    console.error('Error creating notification:', error?.message || error);
    return { success: false, error: error?.message || error };
  }
}
