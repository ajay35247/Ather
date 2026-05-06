import { buildApp } from '@ather/service-kit';
import { buildAudioRoomsRouter, RoomStore, getJwtSecret } from './routes';
export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  store?: RoomStore;
}
export function makeApp(deps: AppDeps = {}) {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const store = deps.store ?? new RoomStore();
  const app = buildApp({
    service: 'audio-rooms',
    env,
    routers: [['/audio-rooms', buildAudioRoomsRouter(store, jwtSecret, env === 'test')]]
  });
  return { app, store };
}
