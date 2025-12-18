// app/dashboard/hooks/useMobileDetect.js
'use client';

import { useState, useEffect } from 'react';

export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setScreenWidth(width);
      
      // Check user agent for mobile devices
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUserAgent = mobileRegex.test(userAgent);
      
      // Also check touch capability
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Mobile: less than 768px OR mobile user agent with touch
      const mobile = width < 768 || (isMobileUserAgent && hasTouchScreen && width < 1024);
      
      // Tablet: between 768px and 1024px
      const tablet = width >= 768 && width < 1024;
      
      setIsMobile(mobile);
      setIsTablet(tablet);
    };

    // Initial check
    checkDevice();

    // Listen for resize events
    window.addEventListener('resize', checkDevice);
    
    // Also listen for orientation change on mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(checkDevice, 100); // Small delay for orientation to settle
    });

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return { isMobile, isTablet, screenWidth };
}

export default useMobileDetect;
