import { Fragment } from "react";
import type { FrontmatterField } from "@/lib/frontmatter";

export function FrontmatterDisclosure({ fields }: { fields: FrontmatterField[] }) {
  if (fields.length === 0) return null;

  const [first, ...rest] = fields;
  const remaining = rest.length;

  return (
    <details className="frontmatter">
      <summary className="frontmatter__summary">
        <svg
          className="frontmatter__chev"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 2.5l3.5 3.5L4 9.5" />
        </svg>
        <span className="frontmatter__label">Frontmatter</span>
        <span className="frontmatter__preview">
          <span className="frontmatter__preview-key">{first.key}:</span>{" "}
          {first.value}
        </span>
        {remaining > 0 && (
          <span className="frontmatter__count">
            +{remaining} field{remaining === 1 ? "" : "s"}
          </span>
        )}
      </summary>
      <div className="frontmatter__body">
        <dl className="frontmatter__dl">
          {fields.map((field, index) => (
            <Fragment key={`${field.key}-${index}`}>
              <dt className="frontmatter__dt">{field.key}</dt>
              <dd className="frontmatter__dd">{field.value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </details>
  );
}
