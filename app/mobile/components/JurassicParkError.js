// Jurassic Park Error Component - "Ah ah ah, you didn't say the magic word!" WITH ORIGINAL SOUND 🦖🔊
// Now with LEGOMAN + FACE animation!
import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

export default function JurassicParkError({ message, onDismiss }) {
  const { language } = useLanguage();
  const [shake, setShake] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Trigger shake animation
    setShake(true);
    const shakeTimeout = setTimeout(() => setShake(false), 500);

    // 🔊 PLAY ORIGINAL JURASSIC PARK SOUND IN LOOP
    if (audioRef.current) {
      audioRef.current.loop = true; // Loop until dismissed
      audioRef.current.volume = 0.7; // 70% volume
      audioRef.current.play().catch(err => {
        console.error('Could not play Jurassic Park sound:', err);
        // Fallback to vibration if audio fails
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([200, 100, 200, 100, 200]);
        }
      });
    }

    return () => {
      clearTimeout(shakeTimeout);
      // Stop audio when component unmounts
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const handleDismiss = () => {
    // Stop audio before dismissing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (onDismiss) onDismiss();
  };

  return (
    <>
      {/* Hidden Audio Element - Original Jurassic Park Sound */}
      <audio ref={audioRef} src="/jurassic-park-sound.mp3" preload="auto" />

      {/* Backdrop overlay to prevent interaction */}
      <div className="fixed inset-0 bg-black bg-opacity-70 z-40 backdrop-blur-sm" />
      
      <div
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 max-w-md w-full mx-4 ${
          shake ? 'animate-shake' : ''
        }`}
        style={{
          animation: shake ? 'shake 0.5s' : 'none'
        }}
      >
        <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg shadow-2xl p-6 border-4 border-red-800">
          {/* LEGOMAN WITH ANIMATED FACE */}
          <div className="text-center mb-3 relative">
            <div className="inline-block relative" style={{ width: '180px', height: '220px' }}>
              {/* Legoman Body - Static */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                <Image 
                  src="/legoman.png" 
                  alt="Legoman" 
                  width={180} 
                  height={220}
                  className="block"
                />
              </div>
              
              {/* Face - Animated Shaking Head */}
              <div 
                className="absolute animate-head-shake"
                style={{
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '65px',
                  height: '65px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  zIndex: 10
                }}
              >
                <Image 
                  src="/face.png" 
                  alt="Face" 
                  width={65} 
                  height={65}
                  className="block object-cover"
                  style={{ 
                    objectFit: 'cover',
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Jurassic Park Message */}
          <div className="text-center mb-4">
            <div className="text-white text-xl font-bold mb-2 animate-pulse">
              Ah ah ah...
            </div>
            <div className="text-white text-lg font-semibold italic">
              {language === 'en' 
                ? "You didn't say the magic word!" 
                : "¡No dijiste la palabra mágica!"}
            </div>
          </div>

          {/* Actual Error Message */}
          <div className="bg-white bg-opacity-20 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-white text-center font-semibold">
              {message}
            </div>
          </div>

          {/* OK Button - REQUIRED to dismiss */}
          <button
            onClick={handleDismiss}
            className="mt-4 w-full bg-white text-red-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition transform active:scale-95 text-lg shadow-lg"
          >
            {language === 'en' ? '✓ OK' : '✓ OK'}
          </button>
        </div>

        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translate(-50%, -50%) translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translate(-50%, -50%) translateX(-10px); }
            20%, 40%, 60%, 80% { transform: translate(-50%, -50%) translateX(10px); }
          }

          @keyframes head-shake {
            0%, 100% { transform: translateX(-50%) rotate(-8deg); }
            50% { transform: translateX(-50%) rotate(8deg); }
          }

          .animate-head-shake {
            animation: head-shake 0.4s ease-in-out infinite;
            transform-origin: center bottom;
          }

          .animate-shake {
            animation: shake 0.5s;
          }
        `}</style>
      </div>
    </>
  );
}
