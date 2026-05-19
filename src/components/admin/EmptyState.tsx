"use client";

type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  colSpan?: number;
};

export default function EmptyState({
  title,
  description,
  colSpan = 5,
}: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-14 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
          Empty
        </p>
        <p className="font-display mt-3 text-lg tracking-tight text-[#101114]">
          {title}
        </p>
        {description && (
          <p className="mt-2 text-xs text-[#101114]/55">{description}</p>
        )}
      </td>
    </tr>
  );
}
