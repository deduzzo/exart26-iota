import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

function Counter({ from = 0, to }) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (v) => Math.round(v));
  const prevValue = useRef(to);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const controls = animate(count, to, { duration: 0.8, ease: 'easeOut' });

    // Rileva se il valore e cambiato (non il primo render)
    if (prevValue.current !== to && prevValue.current !== 0) {
      setChanged(true);
      const timer = setTimeout(() => setChanged(false), 1200);
      prevValue.current = to;
      return () => { controls.stop(); clearTimeout(timer); };
    }
    prevValue.current = to;
    return controls.stop;
  }, [to]);

  return (
    <motion.span
      animate={changed ? {
        scale: [1, 1.3, 1],
        textShadow: ['0 0 0px transparent', '0 0 20px currentColor', '0 0 0px transparent'],
      } : {}}
      transition={{ duration: 0.6 }}
    >
      {rounded}
    </motion.span>
  );
}

export default function StatsCard({ icon: Icon, label, value, color = 'cyan' }) {
  const colorMap = {
    cyan: 'from-neon-cyan/20 to-neon-cyan/5 text-neon-cyan',
    purple: 'from-neon-purple/20 to-neon-purple/5 text-neon-purple',
    emerald: 'from-neon-emerald/20 to-neon-emerald/5 text-neon-emerald',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-500',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-400',
    red: 'from-red-500/20 to-red-500/5 text-red-400',
  };

  const prevValue = useRef(value);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (prevValue.current !== value && prevValue.current !== 0) {
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 1500);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
    prevValue.current = value;
  }, [value]);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      animate={highlight ? {
        borderColor: ['rgba(255,255,255,0.05)', 'rgba(0,229,255,0.4)', 'rgba(255,255,255,0.05)'],
      } : {}}
      transition={{ duration: 1 }}
      className={`glass-static rounded-2xl p-5 cursor-default border border-transparent ${highlight ? 'ring-1 ring-neon-cyan/30' : ''}`}
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
