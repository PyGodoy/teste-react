import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationToastProps {
  message: string;
  onClose: () => void;
  onClick?: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ message, onClose, onClick }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleAnimationComplete = () => {
    if (!isVisible) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed z-50 top-4 inset-x-0 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onAnimationComplete={handleAnimationComplete}
        >
          <div
            className="w-[90%] max-w-[400px] bg-white rounded-lg shadow-lg cursor-pointer hover:shadow-xl"
            onClick={onClick}
            role="alert"
            aria-live="polite"
          >
            <div className="p-4 flex items-center gap-3">
              <div className="flex-shrink-0">
                <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-medium text-gray-900 break-words">
                  {message}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                }}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1"
                aria-label="Fechar notificação"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationToast;