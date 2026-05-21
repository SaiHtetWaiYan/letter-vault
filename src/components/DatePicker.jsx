import { useEffect, useRef, useState } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function sameDay(a, b) {
  return a && b && a.toDateString() === b.toDateString();
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DatePicker({ value, onChange, min }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = parseDate(value);
  const minDate = min ? parseDate(min) : today;

  const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
  const [open, setOpen] = useState(false);
  const [pickingYear, setPickingYear] = useState(false);

  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setPickingYear(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day) {
    const d = new Date(viewYear, viewMonth, day);
    if (minDate && d < minDate) return;
    onChange(toIso(d));
    setOpen(false);
    setPickingYear(false);
  }

  function selectYear(year) {
    setViewYear(year);
    setPickingYear(false);
  }

  function clear() {
    onChange('');
    setOpen(false);
  }

  // Build calendar grid
  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
  );

  const cells = [];
  // Leading days from prev month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false });
  }
  // Current month
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, current: true });
  }
  // Trailing days
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, current: false });
  }

  // Year picker range
  const yearStart = viewYear - 6;
  const years = Array.from({ length: 16 }, (_, i) => yearStart + i);

  const displayValue = selected
    ? selected.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setPickingYear(false); }}
        className={`vault-input w-full pl-4 pr-10 py-3 text-sm text-left relative transition-all ${
          open ? 'border-[rgba(232,168,76,0.5)]' : ''
        }`}
      >
        <span className={displayValue ? 'text-[var(--parchment)]' : 'text-[var(--parchment-40)]'}>
          {displayValue || 'Select a date'}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
        >
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-xl border border-[rgba(232,168,76,0.18)] bg-[#101208] shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(232,168,76,0.1)]">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--parchment-40)] hover:text-[var(--amber)] hover:bg-[rgba(232,168,76,0.08)] transition-all"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => setPickingYear(p => !p)}
              className="flex items-center gap-1.5 text-sm font-serif text-[var(--parchment)] hover:text-[var(--amber)] transition-colors px-2 py-1 rounded-md hover:bg-[rgba(232,168,76,0.06)]"
            >
              {MONTHS[viewMonth]} {viewYear}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-50">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--parchment-40)] hover:text-[var(--amber)] hover:bg-[rgba(232,168,76,0.08)] transition-all"
            >
              ›
            </button>
          </div>

          {pickingYear ? (
            /* Year picker grid */
            <div className="p-3 grid grid-cols-4 gap-1">
              {years.map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => selectYear(yr)}
                  className={`py-1.5 rounded-md text-xs font-mono transition-all ${
                    yr === viewYear
                      ? 'bg-[var(--amber)] text-[#0d0d07] font-bold'
                      : yr < (minDate?.getFullYear() ?? 0)
                      ? 'text-[var(--parchment-40)] opacity-30 cursor-not-allowed'
                      : 'text-[var(--parchment-70)] hover:bg-[rgba(232,168,76,0.1)] hover:text-[var(--amber)]'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--parchment-40)] py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                {cells.map((cell, i) => {
                  const cellDate = cell.current
                    ? new Date(viewYear, viewMonth, cell.day)
                    : null;
                  const isSelected = cell.current && sameDay(cellDate, selected);
                  const isToday = cell.current && sameDay(cellDate, today);
                  const isDisabled = cell.current && minDate && cellDate < minDate;

                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!cell.current || isDisabled}
                      onClick={() => cell.current && !isDisabled && selectDay(cell.day)}
                      className={`
                        h-8 w-full rounded-lg text-xs transition-all
                        ${!cell.current
                          ? 'text-[var(--parchment-40)] opacity-20 cursor-default'
                          : isDisabled
                          ? 'text-[var(--parchment-40)] opacity-30 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[var(--amber)] text-[#0d0d07] font-bold shadow-[0_0_12px_rgba(232,168,76,0.35)]'
                          : isToday
                          ? 'text-[var(--amber)] font-semibold border border-[rgba(232,168,76,0.3)]'
                          : 'text-[var(--parchment-70)] hover:bg-[rgba(232,168,76,0.1)] hover:text-[var(--amber)]'
                        }
                      `}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[rgba(232,168,76,0.08)]">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-[var(--parchment-40)] hover:text-[var(--crimson-bright)] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              className="text-xs text-[var(--amber)] hover:text-[var(--parchment)] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
