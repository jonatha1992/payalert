import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { NativeNotification } from './filter';

type ListenerModule = { isEnabled(): Promise<boolean>; openSettings(): Promise<void>; drainQueue(): Promise<NativeNotification[]> };
const module = NativeModules.PayAlertNotificationListener as ListenerModule | undefined;
export const notificationListener = Platform.OS === 'android' && module ? module : null;
export const notificationEvents = notificationListener ? new NativeEventEmitter(module as never) : null;
export async function drainNativeQueue(): Promise<NativeNotification[]> { return notificationListener ? notificationListener.drainQueue() : []; }
export type { NativeNotification };
