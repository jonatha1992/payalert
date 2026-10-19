import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { NativeNotification } from './filter';

const module = NativeModules.PayAlertNotificationListener;
export const notificationListener = Platform.OS === 'android' && module ? module : null;
export const notificationEvents = notificationListener ? new NativeEventEmitter(notificationListener) : null;
export type { NativeNotification };
