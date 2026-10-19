const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

module.exports = function withNotificationListener(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.service = app.service || [];
    app.service.push({ $: { 'android:name': '.notifications.PayAlertNotificationListenerService', 'android:label': 'PayAlert', 'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE', 'android:exported': 'true' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }] }] });
    return mod;
  });
  return withMainApplication(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents;
    return mod;
  });
};
