import { Link } from 'react-router-dom';
import { PageShell } from './PageShell';

export function NotFound() {
  return (
    <PageShell eyebrow="404" title="This marker is not on the map">
      <p>The page you were looking for does not exist yet.</p>
      <Link className="text-link" to="/">
        Return home
      </Link>
    </PageShell>
  );
}
