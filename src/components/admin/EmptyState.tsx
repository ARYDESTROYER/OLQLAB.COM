"use client";

type EmptyStateProps = {
    icon?: string;
    title: string;
    description?: string;
    colSpan?: number;
};

export default function EmptyState({
    icon = "📭",
    title,
    description,
    colSpan = 5,
}: EmptyStateProps) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-8 py-14 text-center">
                <div className="text-3xl">{icon}</div>
                <p className="mt-2 text-sm font-medium text-slate-600">{title}</p>
                {description && (
                    <p className="mt-1 text-xs text-slate-400">{description}</p>
                )}
            </td>
        </tr>
    );
}
