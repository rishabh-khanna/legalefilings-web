import { CITIES_BY_STATE, OTHER_CITY } from "@/content/indian-cities";

// Cascades off a selected state — disabled with a placeholder until a state
// is chosen, then lists that state's major cities plus "Other" as a
// fallback (the city list isn't exhaustive down to every town).
export function CitySelect({
  state,
  id = "city",
  name = "city",
  className,
  style,
  required,
  defaultValue,
  value,
  onChange,
}: {
  state: string;
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const cities = CITIES_BY_STATE[state] ?? [];
  const disabled = !state;
  const controlledProps = onChange ? { value: value ?? "", onChange } : { defaultValue: defaultValue ?? "" };

  return (
    <select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      className={`${className ?? ""} ${disabled ? "opacity-60" : ""}`}
      style={style}
      {...controlledProps}
    >
      <option value="" disabled>
        {disabled ? "Select state first" : "Select city"}
      </option>
      {cities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      {!disabled && <option value={OTHER_CITY}>{OTHER_CITY}</option>}
    </select>
  );
}
