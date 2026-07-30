import { INDIAN_STATES } from "@/content/indian-states";

// A shared <select> so every form's state field renders the same list of
// real Indian states/UTs instead of free text — caller supplies the
// className/style so it can match whichever form (light or dark variant)
// it's dropped into. Supports both uncontrolled forms (defaultValue, read
// via FormData on submit) and controlled ones (value + onChange).
export function StateSelect({
  id = "state",
  name = "state",
  className,
  style,
  required,
  defaultValue,
  value,
  onChange,
}: {
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const controlledProps = onChange ? { value: value ?? "", onChange } : { defaultValue: defaultValue ?? "" };
  return (
    <select id={id} name={name} required={required} className={className} style={style} {...controlledProps}>
      <option value="" disabled>
        Select state
      </option>
      {INDIAN_STATES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
