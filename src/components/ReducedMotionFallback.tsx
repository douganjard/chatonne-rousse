import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { navNodes } from '../data/navNodes';
import { trackEvent } from '../lib/telemetry';

type ReducedMotionFallbackProps = {
  reason?: 'reduced_motion' | 'scene_loading';
};

export function ReducedMotionFallback({ reason }: ReducedMotionFallbackProps) {
  useEffect(() => {
    if (reason === 'reduced_motion') {
      trackEvent('reduced_motion_fallback');
    }
  }, [reason]);

  return (
    <section className="fallback-scene" aria-label="Site destinations">
      {navNodes.map((node) => {
        const Icon = node.Icon;

        return node.external ? (
          <a key={node.id} href={node.path} className="fallback-node" target="_blank" rel="noreferrer">
            <Icon size={20} aria-hidden="true" />
            <span>{node.label}</span>
          </a>
        ) : (
          <Link key={node.id} to={node.path} className="fallback-node">
            <Icon size={20} aria-hidden="true" />
            <span>{node.label}</span>
          </Link>
        );
      })}
    </section>
  );
}
