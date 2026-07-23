import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NavNode } from '../data/navNodes';
import { trackEvent } from '../lib/telemetry';
import { useSpotifyNowPlaying } from '../spotify/useSpotifyNowPlaying';
import { SpotifyNowPlayingCard } from './SpotifyNowPlayingCard';

type NavOverlayProps = {
  activeId: NavNode['id'] | null;
  nodes: NavNode[];
};

export function NavOverlay({ activeId, nodes }: NavOverlayProps) {
  const activeNode = nodes.find((node) => node.id === activeId);
  const spotify = useSpotifyNowPlaying(activeNode?.kind === 'spotify');
  const [displayedNode, setDisplayedNode] = useState<NavNode | undefined>(activeNode);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (activeNode) {
      trackEvent('destination_popup_opened', {
        destination: activeNode.id,
        object: activeNode.objectLabel,
      });
    }
  }, [activeNode]);

  useEffect(() => {
    if (activeNode) {
      setIsVisible(false);
      setDisplayedNode(activeNode);
      let revealFrame = 0;
      const mountFrame = window.requestAnimationFrame(() => {
        revealFrame = window.requestAnimationFrame(() => setIsVisible(true));
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        window.cancelAnimationFrame(revealFrame);
      };
    }

    setIsVisible(false);
    const timeout = window.setTimeout(() => setDisplayedNode(undefined), 340);

    return () => window.clearTimeout(timeout);
  }, [activeNode]);

  if (!displayedNode) {
    return <div className="nav-overlay" aria-live="polite" />;
  }

  const label = displayedNode.navLabel ?? displayedNode.label;
  const popupClassName = `discovery-popup${displayedNode.kind === 'spotify' ? ' spotify-popup' : ''}${isVisible ? ' is-visible' : ''}`;

  if (displayedNode.kind === 'spotify') {
    return (
      <div className="nav-overlay" aria-live="polite">
        <SpotifyNowPlayingCard className={popupClassName} {...spotify} />
      </div>
    );
  }

  const Icon = displayedNode.Icon;
  const content = (
    <>
      <Icon className="popup-icon" size={26} aria-hidden="true" />
      <span className="popup-copy">
        <span className="popup-label">{label}</span>
        <span className="popup-description">{displayedNode.tagline}</span>
      </span>
      {displayedNode.external ? (
        <ArrowUpRight className="popup-arrow" size={22} aria-hidden="true" />
      ) : (
        <ArrowRight className="popup-arrow" size={22} aria-hidden="true" />
      )}
    </>
  );
  const handleOpen = () => trackEvent('route_opened_from_scene', { destination: displayedNode.id });

  return (
    <div className="nav-overlay" aria-live="polite">
      {displayedNode.external ? (
        <a
          className={popupClassName}
          href={displayedNode.path}
          target="_blank"
          rel="noreferrer"
          aria-label={`${label} destination`}
          aria-hidden={!isVisible}
          tabIndex={isVisible ? undefined : -1}
          onClick={handleOpen}
        >
          {content}
        </a>
      ) : (
        <Link
          className={popupClassName}
          to={displayedNode.path}
          aria-label={`${label} destination`}
          aria-hidden={!isVisible}
          tabIndex={isVisible ? undefined : -1}
          onClick={handleOpen}
        >
          {content}
        </Link>
      )}
    </div>
  );
}
