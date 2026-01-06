// Jurassic Park Error Component - "Ah ah ah, you didn't say the magic word!"
import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState } from 'react';

export default function JurassicParkError({ message, onDismiss }) {
  const { language } = useLanguage();
  const [shake, setShake] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Trigger shake animation
    setShake(true);
    const shakeTimeout = setTimeout(() => setShake(false), 500);

    // Auto-dismiss after 3 seconds
    const dismissTimeout = setTimeout(() => {
      setVisible(false);
      if (onDismiss) onDismiss();
    }, 3000);

    return () => {
      clearTimeout(shakeTimeout);
      clearTimeout(dismissTimeout);
    };
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 ${
        shake ? 'animate-shake' : ''
      }`}
      style={{
        animation: shake ? 'shake 0.5s' : 'none'
      }}
    >
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg shadow-2xl p-6 border-4 border-red-800">
        {/* Animated Finger */}
        <div className="text-center mb-3">
          <div className="inline-block animate-wag text-6xl">
            👆
          </div>
        </div>

        {/* Jurassic Park Message */}
        <div className="text-center mb-4">
          <div className="text-white text-xl font-bold mb-2">
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

        {/* Dismiss Button */}
        <button
          onClick={() => {
            setVisible(false);
            if (onDismiss) onDismiss();
          }}
          className="mt-4 w-full bg-white text-red-700 font-bold py-2 rounded-lg hover:bg-gray-100 transition"
        >
          {language === 'en' ? 'OK' : 'OK'}
        </button>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-50%) translateY(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(-50%) translateY(10px); }
        }

        @keyframes wag {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }

        .animate-wag {
          animation: wag 0.3s ease-in-out infinite;
        }

        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
}
