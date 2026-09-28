"use client";

export type Unit = "lbs" | "kg";

/** Big number, big +/- buttons, simple unit switch. */
export function WeightInput({
  value,
  unit,
  onChange,
  onUnitChange,
  id = "weight",
}: {
  value: number | "";
  unit: Unit;
  onChange: (n: number | "") => void;
  onUnitChange: (u: Unit) => void;
  id?: string;
}) {
  const step = (d: number) => onChange(Math.max(1, Math.round(((value || 0) + d) * 10) / 10));
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Less"
        className="grid w-14 shrink-0 sm:w-16 place-items-center rounded-2xl bg-white text-3xl font-black ring-2 ring-sand-200 hover:ring-sea-400 active:scale-95"
      >
        −
      </button>
      <label htmlFor={id} className="sr-only">
        Weight
      </label>
      <input
        id={id}
        inputMode="decimal"
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
        className="min-h-20 w-full min-w-0 rounded-2xl bg-white px-4 text-center text-4xl font-black ring-2 ring-sand-200 focus:outline-none focus:ring-sea-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        placeholder="10"
      />
      <select
        value={unit}
        onChange={(e) => onUnitChange(e.target.value as Unit)}
        aria-label="Unit"
        className="w-20 shrink-0 rounded-2xl bg-white px-2 sm:w-24 text-center text-lg font-bold ring-2 ring-sand-200"
      >
        <option value="lbs">lbs</option>
        <option value="kg">kg</option>
      </select>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="More"
        className="grid w-14 shrink-0 sm:w-16 place-items-center rounded-2xl bg-white text-3xl font-black ring-2 ring-sand-200 hover:ring-sea-400 active:scale-95"
      >
        +
      </button>
    </div>
  );
}
