const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withNotificationListener(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.service = app.service || [];
    const serviceName = '.notifications.PayAlertNotificationListenerService';
    if (!app.service.some((service) => service.$['android:name'] === serviceName)) {
      app.service.push({ $: { 'android:name': serviceName, 'android:label': 'PayAlert', 'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE', 'android:exported': 'true' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }] }] });
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const source = path.join(mod.modRequest.projectRoot, 'modules', 'notification-listener', 'android');
    const destination = path.join(mod.modRequest.platformProjectRoot, 'notification-listener');
    fs.cpSync(source, destination, { recursive: true });
    const settingsPath = path.join(mod.modRequest.platformProjectRoot, 'settings.gradle');
    let settings = fs.readFileSync(settingsPath, 'utf8');
    if (!settings.includes("include ':notification-listener'")) {
      settings += "\ninclude ':notification-listener'\nproject(':notification-listener').projectDir = new File(rootProject.projectDir, 'notification-listener')\n";
      fs.writeFileSync(settingsPath, settings);
    }
    const appGradle = path.join(mod.modRequest.platformProjectRoot, 'app', 'build.gradle');
    let gradle = fs.readFileSync(appGradle, 'utf8');
    if (!gradle.includes("implementation project(':notification-listener')")) {
      gradle = gradle.replace(/dependencies\s*\{/, (match) => `${match}\n    implementation project(':notification-listener')`);
      fs.writeFileSync(appGradle, gradle);
    }
    return mod;
  }]);
};

