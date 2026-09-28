import { fmtUsd } from "@/domain/rates";
export const Money = ({ n, className = "" }: { n: number; className?: string }) => <span className={`tabular-nums ${className}`}>{fmtUsd(n)}</span>;
