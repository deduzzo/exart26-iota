import { motion } from 'framer-motion';

export default function LoadingSpinner({ size = 24, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ width: size, height: size }}
        className="border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full"
      />
    </div>
  );
}
