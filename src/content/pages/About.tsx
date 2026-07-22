import { PageShell } from './PageShell';

export function About() {
  return (
    <PageShell eyebrow="About" title="Doug Anjard">
      <p className="profile-role">Software Engineer</p>
      <p>{'\u{1F44B}'}</p>
      <p>Current public profile and contact links:</p>
      <ul className="content-link-list" aria-label="Doug Anjard profile links">
        <li>
          <a href="mailto:doug.anjard@gmail.com">Email</a>
        </li>
        <li>
          <a href="https://github.com/douganjard" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </li>
        <li>
          <a href="https://www.linkedin.com/in/douganjard" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </li>
        <li>
          <a href="https://www.facebook.com/douganjard" target="_blank" rel="noreferrer">
            Facebook
          </a>
        </li>
        <li>
          <a href="https://www.instagram.com/douganjard/" target="_blank" rel="noreferrer">
            Instagram
          </a>
        </li>
        <li>
          <a href="https://twitter.com/SmoreOfNothing" target="_blank" rel="noreferrer">
            Twitter
          </a>
        </li>
      </ul>
    </PageShell>
  );
}
