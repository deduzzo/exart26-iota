import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

function Counter({ from = 0, to }) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, to, { duration: 1.5, ease: 'easeOut' });
    return controls.stop;
  }, [to]);

  return <motion.span>{rounded}</motion.span>;
}

export default function StatsCard({ icon: Icon, label, value, color = 'cyan' }) {
  const colorMap = {
    cyan: 'from-neon-cyan/20 to-neon-cyan/5 text-neon-cyan',
    purple: 'from-neon-purple/20 to-neon-purple/5 text-neon-purple',
    emerald: 'from-neon-emerald/20 to-neon-emerald/5 text-neon-emerald',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-500',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="glass-static rounded-2xl p-5 cursor-default"
    >
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${colorMap[color]} mb-3`}>
        <Icon size={22} />
      </div>
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {typeof value === 'number' ? <Counter to={value} /> : (value || '0')}
      </p>
    </motion.div>
  );
}
