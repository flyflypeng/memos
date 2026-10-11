import clsx from "clsx";
import { useState } from "react";

const MAX_ROWS = 8;
const MAX_COLS = 8;

interface Props {
  /** `rows` includes the header row. */
  onPick: (rows: number, cols: number) => void;
}

/** Hover a grid to choose the table size; the first grid row is the header row. */
const TablePicker = ({ onPick }: Props) => {
  const [size, setSize] = useState({ rows: 3, cols: 3 });

  return (
    <div className="flex flex-col items-center gap-1" onMouseLeave={() => setSize({ rows: 3, cols: 3 })}>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1rem)` }}>
        {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, i) => {
          const rows = Math.floor(i / MAX_COLS) + 1;
          const cols = (i % MAX_COLS) + 1;
          const active = rows <= size.rows && cols <= size.cols;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${cols} × ${rows}`}
              className={clsx(
                "w-4 h-4 rounded-sm border",
                active ? "bg-teal-100 border-teal-500 dark:bg-teal-900 dark:border-teal-400" : "border-gray-300 dark:border-zinc-600",
              )}
              onMouseEnter={() => setSize({ rows, cols })}
              onFocus={() => setSize({ rows, cols })}
              onClick={() => onPick(rows, cols)}
            />
          );
        })}
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {size.cols} × {size.rows}
      </span>
    </div>
  );
};

export default TablePicker;
