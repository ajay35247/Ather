type Screen = {
  name: string;
  description: string;
  status: 'planned' | 'wireframe' | 'in-progress';
};

const PHASE_1_SCREENS: Screen[] = [
  { name: 'Splash / Onboarding', description: 'Account creation, persona pick, follow ≥5 creators.', status: 'planned' },
  { name: 'Home Feed', description: 'For-You / Following / Chronological toggle. Anti-addiction surfaces visible.', status: 'planned' },
  { name: 'Composer', description: 'Text, image, short video. AI caption suggestion (opt-in).', status: 'planned' },
  { name: 'Profile', description: 'Persona-aware profile view with personal/professional toggle.', status: 'planned' },
  { name: 'Conversations', description: 'List of E2EE chats, search, archived.', status: 'planned' },
  { name: 'Chat', description: 'Single thread: chat + voice + video + live in one stream.', status: 'planned' },
  { name: 'Notifications', description: 'AI-prioritized; daily budget configurable.', status: 'planned' },
  { name: 'Search', description: 'Users, posts, communities; semantic option (Phase 2).', status: 'planned' },
  { name: 'Settings', description: 'Privacy, blocks, devices, data export, screen-time dashboard.', status: 'planned' }
];

export default function HomePage() {
  return (
    <main>
      <span className="tag">Phase 0 · Foundations</span>
      <h1>Ather</h1>
      <p className="lead">
        Omni-Social Operating System — a buildable monorepo scaffold for the Core Loop MVP.
      </p>
      <p>
        See <a href="https://github.com/ajay35247/Ather/tree/main/docs">/docs</a> for the
        architecture, API design, database schema, security model, scaling plan, monetization
        strategy, and roadmap.
      </p>

      <h2 style={{ marginTop: '3rem' }}>Phase 1 screens</h2>
      <div className="grid">
        {PHASE_1_SCREENS.map((s) => (
          <div className="card" key={s.name}>
            <span className="tag">{s.status}</span>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
