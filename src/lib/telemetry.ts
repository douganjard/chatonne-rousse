import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { onCLS, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

type TelemetryValue = boolean | number | string | undefined;
type TelemetryParams = Record<string, TelemetryValue>;

type TelemetryEvent =
  | 'cat_collision_blocked'
  | 'destination_popup_opened'
  | 'reduced_motion_fallback'
  | 'route_opened_from_scene'
  | 'scene_loaded'
  | 'web_vital'
  | 'webgl_failed';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.appId,
  firebaseConfig.authDomain,
  firebaseConfig.measurementId,
  firebaseConfig.projectId,
];

let app: FirebaseApp | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;
let vitalsStarted = false;

function telemetryEnabled() {
  return import.meta.env.PROD && import.meta.env.VITE_ANALYTICS_DISABLED !== 'true' && requiredConfig.every(Boolean);
}

function getApp() {
  app ??= initializeApp(firebaseConfig);
  return app;
}

function getAnalyticsInstance() {
  if (!telemetryEnabled()) return Promise.resolve(null);

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(getApp()) : null))
    .catch(() => null);

  return analyticsPromise;
}

function compactParams(params: TelemetryParams) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

export function trackEvent(name: TelemetryEvent, params: TelemetryParams = {}) {
  void getAnalyticsInstance().then((analytics) => {
    if (!analytics) return;
    logEvent(analytics, name, compactParams(params));
  });
}

export function trackPageView(path: string, title: string) {
  void getAnalyticsInstance().then((analytics) => {
    if (!analytics) return;
    logEvent(analytics, 'page_view', {
      page_location: window.location.href,
      page_path: path,
      page_title: title,
    });
  });
}

export function startWebVitalsTracking() {
  if (vitalsStarted) return;
  vitalsStarted = true;

  const report = (metric: Metric) => {
    trackEvent('web_vital', {
      metric_delta: metric.delta,
      metric_id: metric.id,
      metric_name: metric.name,
      metric_rating: metric.rating,
      metric_value: metric.value,
    });
  };

  onCLS(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}
