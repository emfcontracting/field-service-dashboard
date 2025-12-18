// app/dashboard/hooks/useMobileDetect.js
'use client';

import { useState, useEffect } from 'react';

export function useMobileDetect() {
  // Start with false to avoid hydration mismatch
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [screenWidth, setScreenWidth] = useState(1024); // Default to desktop
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark that we're on the client
    setIsClient(true);
    
    const checkDevice = () => {
      if (typeof window === 'undefined') return;
      
      const width = window.innerWidth;
      setScreenWidth(width);
      
      // Simple width-based detection (most reliable)
      // Mobile: under 768px
      // Tablet: 768px to 1023px
      // Desktop: 1024px and above
      
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    // Initial check
    checkDevice();

    // Listen for resize events
    window.addEventListener('resize', checkDevice);
    
    // Also listen for orientation change on mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(checkDevice, 150);
    });

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return { isMobile, isTablet, screenWidth, isClient };
}

export default useMobileDetect;
