// « Signalés » while its rows come: rows of the same height as ReportedRow (title, issues, source and time), in Hodi's
// skeleton colours, so nothing jumps when they show. Nothing moves while waiting, as Hodi's own skeletons.
const WIDTHS = [
  [62, 40, 34],
  [48, 52, 28],
  [56, 36, 30]
]

const Bar = ({ width, height }: { width: number | string; height: number }) => (
  <span className="diagnostic-skeleton-bar" style={{ width, height }} />
)

const ReportedSkeleton = () => (
  <ul className="diagnostic-list" aria-hidden="true">
    {WIDTHS.map(([title, issues, source]) => (
      <li key={title}>
        <div className="diagnostic-row">
          <span className="diagnostic-skeleton-line diagnostic-row-title">
            <Bar width={`${title}%`} height={12} />
          </span>
          <span className="diagnostic-skeleton-line diagnostic-row-issues">
            <Bar width={`${issues}%`} height={10} />
          </span>
          <span className="diagnostic-row-meta">
            <Bar width={18} height={18} />
            <Bar width={`${source}%`} height={10} />
          </span>
        </div>
      </li>
    ))}
  </ul>
)

export default ReportedSkeleton
