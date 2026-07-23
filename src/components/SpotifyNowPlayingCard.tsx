import { useEffect, useState } from 'react';
import { ArrowUpRight, Radio } from 'lucide-react';
import type { SpotifyRequestState } from '../spotify/useSpotifyNowPlaying';

type SpotifyNowPlayingCardProps = SpotifyRequestState & {
  className?: string;
  interactive?: boolean;
};

const statusLabels = {
  playing: 'Listening now',
  paused: 'Paused',
  recent: 'Recently played',
  idle: 'Nothing played recently',
  unavailable: 'Listening status unavailable',
} as const;

export function SpotifyNowPlayingCard({
  className = '',
  data,
  error,
  interactive = true,
  loading,
}: SpotifyNowPlayingCardProps) {
  const item = data?.item;
  const status = data ? statusLabels[data.state] : error ? statusLabels.unavailable : 'Checking Spotify';
  const content = (
    <>
      <SpotifyArtwork artwork={item?.artwork} />
      <span className="spotify-copy">
        <span className="spotify-status">{loading ? 'Checking Spotify' : status}</span>
        {item ? (
          <>
            <span className="spotify-title" title={item.title}>{item.title}</span>
            <span className="spotify-creators" title={item.creators.join(', ')}>{item.creators.join(', ')}</span>
            {item.collection && <span className="spotify-collection" title={item.collection}>{item.collection}</span>}
          </>
        ) : (
          <span className="spotify-empty">{error ? 'Please try again shortly.' : 'No recent listening activity.'}</span>
        )}
        <span className="spotify-attribution" aria-label="Content from Spotify">
          <img src="/images/spotify-logo-white.svg" alt="Spotify" />
        </span>
      </span>
      {item && <ArrowUpRight className="popup-arrow" size={22} aria-hidden="true" />}
    </>
  );
  const classes = `spotify-card ${className}`.trim();

  if (item && interactive) {
    return (
      <a className={classes} href={item.spotifyUrl} target="_blank" rel="noreferrer" aria-label={`${status}: ${item.title}. Listen on Spotify`}>
        {content}
      </a>
    );
  }

  return <div className={classes} aria-label="Spotify listening status">{content}</div>;
}

function SpotifyArtwork({ artwork }: { artwork?: { url: string; width: number; height: number } }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [artwork?.url]);

  return (
    <span className="spotify-artwork-shell">
      {artwork && !failed ? (
        <img
          className="spotify-artwork"
          src={artwork.url}
          width={artwork.width}
          height={artwork.height}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <Radio className="spotify-artwork-placeholder" size={28} aria-hidden="true" />
      )}
    </span>
  );
}
