export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-anthracite-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-anthracite-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
