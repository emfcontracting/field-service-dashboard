// Jurassic Park Error Component - "Ah ah ah, you didn't say the magic word!" WITH SOUND 🦖🔊
import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState } from 'react';

export default function JurassicParkError({ message, onDismiss }) {
  const { language } = useLanguage();
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Trigger shake animation
    setShake(true);
    const shakeTimeout = setTimeout(() => setShake(false), 500);

    // 🔊 PLAY SOUND EFFECT
    playJurassicParkSound();

    return () => {
      clearTimeout(shakeTimeout);
    };
  }, []);

  // 🔊 Sound Effect Generator using Web Audio API
  function playJurassicParkSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create three "Ah" sounds in sequence
      const playAhSound = (startTime, frequency) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Waveform for voice-like sound
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
        
        // Volume envelope (fade in/out for more natural sound)
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + startTime + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + startTime + 0.3);
        
        oscillator.start(audioContext.currentTime + startTime);
        oscillator.stop(audioContext.currentTime + startTime + 0.3);
      };
      
      // Play three "Ah" sounds with slight variation in pitch
      playAhSound(0, 350);    // First "Ah"
      playAhSound(0.35, 380); // Second "Ah" 
      playAhSound(0.7, 400);  // Third "Ah"
      
      // Add a subtle warning beep at the end
      const beepOscillator = audioContext.createOscillator();
      const beepGain = audioContext.createGain();
      
      beepOscillator.connect(beepGain);
      beepGain.connect(audioContext.destination);
      
      beepOscillator.type = 'sine';
      beepOscillator.frequency.setValueAtTime(800, audioContext.currentTime + 1.1);
      
      beepGain.gain.setValueAtTime(0, audioContext.currentTime + 1.1);
      beepGain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 1.15);
      beepGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.3);
      
      beepOscillator.start(audioContext.currentTime + 1.1);
      beepOscillator.stop(audioContext.currentTime + 1.3);
      
    } catch (error) {
      console.error('Could not play Jurassic Park sound:', error);
      // Fallback to system beep if Web Audio API fails
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }
  }

  return (
    <>
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
          {/* Animated Finger */}
          <div className="text-center mb-3">
            <div className="inline-block animate-wag text-6xl">
              👆
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
            onClick={() => {
              if (onDismiss) onDismiss();
            }}
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
    </>
  );
}
