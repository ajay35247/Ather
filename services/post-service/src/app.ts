import { buildApp } from '@ather/service-kit';
import { buildPostRouter, PostStore, getJwtSecret } from './routes';
import { buildCommentsRouter, CommentStore } from './comments';
import { buildReelsRouter, ReelStore } from './reels';
import { buildStoriesRouter, StoryStore } from './stories';

export interface AppDeps {
  env?: 'development' | 'test' | 'production';
  jwtSecret?: string;
  postStore?: PostStore;
  commentStore?: CommentStore;
  reelStore?: ReelStore;
  storyStore?: StoryStore;
}

export interface AppHandle {
  app: ReturnType<typeof buildApp>;
  postStore: PostStore;
  commentStore: CommentStore;
  reelStore: ReelStore;
  storyStore: StoryStore;
}

/**
 * post-service consolidates the previously-separate post, comments, reels,
 * and stories services into a single Express app. Each domain still owns its
 * own router mounted at the historical URL prefix so existing clients keep
 * working unchanged.
 */
export function makeApp(deps: AppDeps = {}): AppHandle {
  const env = deps.env ?? (process.env.NODE_ENV as AppDeps['env']) ?? 'development';
  const jwtSecret = deps.jwtSecret ?? getJwtSecret();
  const postStore = deps.postStore ?? new PostStore();
  const commentStore = deps.commentStore ?? new CommentStore();
  const reelStore = deps.reelStore ?? new ReelStore();
  const storyStore = deps.storyStore ?? new StoryStore();

  const isTest = env === 'test';
  const app = buildApp({
    service: 'post-service',
    env,
    routers: [
      ['/posts', buildPostRouter(postStore, jwtSecret, isTest)],
      ['/comments', buildCommentsRouter(commentStore, jwtSecret, isTest)],
      ['/reels', buildReelsRouter(reelStore, jwtSecret, isTest)],
      ['/stories', buildStoriesRouter(storyStore, jwtSecret, isTest)]
    ]
  });

  return { app, postStore, commentStore, reelStore, storyStore };
}
