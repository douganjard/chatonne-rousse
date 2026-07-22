import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { navNodes } from '../data/navNodes';
import { trackPageView } from '../lib/telemetry';

export function SiteLayout() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location.pathname]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-cluster">
          <NavLink to="/" className="brand" aria-label="Home">
            Doug Anjard
          </NavLink>
          <div className="menu-shell" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              className="menu-toggle"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
              aria-controls="primary-navigation"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <Menu className="menu-icon menu-icon-open" size={22} aria-hidden="true" />
              <X className="menu-icon menu-icon-close" size={22} aria-hidden="true" />
            </button>
            <nav
              id="primary-navigation"
              className={`top-nav${isMenuOpen ? ' is-open' : ''}`}
              aria-label="Primary navigation"
              aria-hidden={!isMenuOpen}
            >
              {navNodes.map((node) =>
                node.external ? (
                  <a
                    key={node.id}
                    href={node.path}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={isMenuOpen ? undefined : -1}
                  >
                    <node.Icon size={17} aria-hidden="true" />
                    <span>{node.navLabel ?? node.label}</span>
                  </a>
                ) : (
                  <NavLink key={node.id} to={node.path} tabIndex={isMenuOpen ? undefined : -1}>
                    <node.Icon size={17} aria-hidden="true" />
                    <span>{node.navLabel ?? node.label}</span>
                  </NavLink>
                ),
              )}
            </nav>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
