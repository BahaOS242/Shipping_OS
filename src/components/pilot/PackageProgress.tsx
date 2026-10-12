export const packageStatus: Record<string, string> = {
  expected: "On its way to our warehouse",
  received: "Received at warehouse",
  processing: "Preparing your package",
  ready: "Ready for shipping",
  in_transit: "On its way",
  arrived: "Arrived at destination",
  delivered: "Delivered",
  exception: "Team review needed",
};
export function PackageProgress({ status }: { status: string }) {
  const stage = {
    expected: -1,
    received: 0,
    processing: 0,
    ready: 1,
    in_transit: 2,
    arrived: 2,
    delivered: 3,
  }[status];
  if (stage === undefined) return null;
  return (
    <ol
      className="package-journey"
      aria-label={"Package journey: " + (packageStatus[status] ?? status)}
    >
      {["Warehouse", "Ready", "Shipping", "Delivered"].map((label, index) => (
        <li
          key={label}
          data-reached={index <= stage}
          aria-current={index === stage ? "step" : undefined}
        >
          <span aria-hidden="true" />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
