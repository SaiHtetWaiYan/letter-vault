const toneMap = {
  green: 'badge badge-green',
  red: 'badge badge-red',
  amber: 'badge badge-amber',
  teal: 'badge badge-amber',
  stone: 'badge border border-[rgba(232,168,76,0.1)] bg-[rgba(9,12,20,0.6)] text-[var(--parchment-40)]',
};

export default function StatusBadge({ label, tone }) {
  return (
    <span className={toneMap[tone] || toneMap.stone}>
      {label}
    </span>
  );
}
