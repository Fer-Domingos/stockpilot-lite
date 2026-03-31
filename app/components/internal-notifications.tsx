import { InAppNotificationRecord, markInAppNotificationRead } from '@/app/actions';
import { AppRole } from '@/lib/demo-data';

export function InternalNotifications({ notifications, role }: { notifications: InAppNotificationRecord[]; role: AppRole }) {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h3>PO Alert Notifications</h3>
          <p className="muted">In-app notifications when tracked PO alerts are marked as done.</p>
        </div>
      </div>
      {notifications.length === 0 ? (
        <p className="muted">No notifications yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Time</th>
              <th>PO</th>
              <th>Message</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td>{notification.isRead ? 'Read' : 'Unread'}</td>
                <td>{new Date(notification.createdAt).toLocaleString()}</td>
                <td>{notification.poNumber}</td>
                <td>
                  {notification.message}
                  <div className="muted">{notification.title}</div>
                </td>
                <td>
                  {notification.isRead ? (
                    <span className="muted">—</span>
                  ) : (
                    <form className="inline-form" action={markInAppNotificationRead}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <input type="hidden" name="role" value={role} />
                      <button className="secondary-button" type="submit">
                        Mark Read
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
