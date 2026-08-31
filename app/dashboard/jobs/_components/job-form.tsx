type JobFormValues = {
  id?: number;
  job_number?: string | null;
  customer?: string | null;
  description?: string | null;
  category?: string | null;
  active?: boolean;
};

type JobFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  values?: JobFormValues;
};

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10";

export function JobForm({ action, submitLabel, values = {} }: JobFormProps) {
  return (
    <form action={action} className="space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div>
        <label htmlFor="job_number" className="text-sm font-medium">
          Job number
        </label>
        <input
          id="job_number"
          name="job_number"
          required
          defaultValue={values.job_number ?? ""}
          placeholder="267 or Job 267"
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Entering only a number will automatically save it as “Job 267”.
        </p>
      </div>

      <div>
        <label htmlFor="customer" className="text-sm font-medium">
          Customer
        </label>
        <input
          id="customer"
          name="customer"
          defaultValue={values.customer ?? ""}
          placeholder="Optional"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={values.description ?? ""}
          placeholder="Brief description of the work"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={values.category ?? "direct"}
            className={fieldClass}
          >
            <option value="direct">Direct</option>
            <option value="indirect">Indirect</option>
          </select>
        </div>

        {values.id ? (
          <div>
            <label htmlFor="active" className="text-sm font-medium">
              Status
            </label>
            <select
              id="active"
              name="active"
              defaultValue={values.active === false ? "false" : "true"}
              className={fieldClass}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-border pt-5">
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
