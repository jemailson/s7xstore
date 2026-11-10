import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageSelector({ variant = 'default' }) {
  const { language, setLanguage, t, supportedLanguages } = useLanguage();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220 });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const currentLang = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(230, window.innerWidth - 24);

    let left = rect.right - dropdownWidth;

    if (left < 12) {
      left = Math.max(12, rect.left);
    }

    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 195;
    let top = rect.bottom + 8;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      top = Math.max(12, rect.top - dropdownHeight - 8);
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(dropdownWidth)
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleClickOutside(event) {
      const isButton = buttonRef.current && buttonRef.current.contains(event.target);
      const isDropdown = dropdownRef.current && dropdownRef.current.contains(event.target);
      if (!isButton && !isDropdown) {
        setOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, updatePosition]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: variant === 'compact' ? '6px 10px' : '8px 14px',
          background: open ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: open ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          color: '#e5e7eb',
          cursor: 'pointer',
          fontSize: '0.88rem',
          fontWeight: '600',
          transition: 'all 0.2s',
          outline: 'none',
          backdropFilter: 'blur(10px)',
          userSelect: 'none',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        onMouseLeave={e => {
          if (!open) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        aria-label={t('site_language')}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{currentLang.flag}</span>
        <span style={{ display: variant === 'compact' ? 'none' : 'inline' }}>
          {currentLang.code.toUpperCase()}
        </span>
        <ChevronDown
          size={14}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            opacity: 0.7
          }}
        />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            background: '#121624',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '14px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            zIndex: 99999,
            animation: 'fadeIn 0.15s ease-out',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              padding: '6px 10px 8px 10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={13} style={{ color: 'var(--text-muted, #9ca3af)' }} />
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                color: 'var(--text-muted, #9ca3af)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            >
              {t('site_language')}
            </span>
          </div>

          {supportedLanguages.map(item => {
            const isSelected = item.code === language;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLanguage(item.code);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 12px',
                  minHeight: '44px',
                  borderRadius: '9px',
                  border: 'none',
                  background: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  color: isSelected ? '#fff' : '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  fontWeight: isSelected ? '700' : '500',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  userSelect: 'none',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.15rem' }}>{item.flag}</span>
                  <span>{item.label}</span>
                </div>
                {isSelected && (
                  <Check size={16} style={{ color: 'var(--primary, #ef4444)' }} />
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
