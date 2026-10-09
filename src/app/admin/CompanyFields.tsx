import { inputClass } from "@/components/styles";
import { INDUSTRIES, SIZE_RANGES } from "@/lib/companies";
import { NIGERIAN_STATES, stateLabel } from "@/lib/nigeria";

type Values = Partial<Record<"name" | "industry" | "state" | "city" | "website" | "size_range" | "description", string | null>>;

// Company detail inputs shared by "approve request" and "edit company".
export function CompanyFields({ values, idPrefix }: { values: Values; idPrefix: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  const label = "flex flex-col gap-1 text-sm font-medium";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className={label} htmlFor={id("name")}>
        Name
        <input id={id("name")} name="name" required defaultValue={values.name ?? ""} className={inputClass} />
      </label>
      <label className={label} htmlFor={id("industry")}>
        Industry
        <select id={id("industry")} name="industry" defaultValue={values.industry ?? ""} className={inputClass}>
          <option value="" disabled>
            Choose
          </option>
          {INDUSTRIES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </label>
      <label className={label} htmlFor={id("state")}>
        State
        <select id={id("state")} name="state" defaultValue={values.state ?? ""} className={inputClass}>
          <option value="">—</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {stateLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label className={label} htmlFor={id("city")}>
        City
        <input id={id("city")} name="city" defaultValue={values.city ?? ""} className={inputClass} />
      </label>
      <label className={label} htmlFor={id("website")}>
        Website
        <input id={id("website")} name="website" defaultValue={values.website ?? ""} placeholder="https://" className={inputClass} />
      </label>
      <label className={label} htmlFor={id("size_range")}>
        Size
        <select id={id("size_range")} name="size_range" defaultValue={values.size_range ?? ""} className={inputClass}>
          <option value="">—</option>
          {SIZE_RANGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2`} htmlFor={id("description")}>
        Description
        <textarea id={id("description")} name="description" rows={3} maxLength={2000} defaultValue={values.description ?? ""} className={`${inputClass} py-2`} />
      </label>
    </div>
  );
}
