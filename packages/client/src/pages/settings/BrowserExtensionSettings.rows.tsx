import {
  FilterDropdown,
  type FilterOption,
} from "../../components/FilterDropdown";
import { SettingsItem } from "./SettingsItem";

interface ChoiceRowProps<T extends string> {
  label: string;
  description?: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
}

/** One settings row choosing from a few options, in the app's dropdown. */
export function ChoiceRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: ChoiceRowProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <SettingsItem
      label={label}
      description={description}
      valueText={current?.label}
    >
      <FilterDropdown<T>
        label={label}
        triggerTitle={label}
        multiSelect={false}
        align="right"
        options={options}
        selected={[value]}
        onChange={(values) => {
          if (values[0]) onChange(values[0]);
        }}
      />
    </SettingsItem>
  );
}
