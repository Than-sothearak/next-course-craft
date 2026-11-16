export type EducationalTableData = {
  caption: string;
  columns: string[];
  rows: string[][];
};

export function EducationalTable({ data }: { data: EducationalTableData }) {
  return (
    <div className="min-w-0 space-y-2">
      {data.caption && <p className="text-sm font-medium leading-6 text-slate-700">{data.caption}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="hidden bg-slate-50 sm:table-header-group">
            <tr>{data.columns.map((column, index) => <th key={`${column}-${index}`} scope="col" className="break-words border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-800">{column}</th>)}</tr>
          </thead>
          <tbody className="block divide-y divide-slate-200 sm:table-row-group sm:divide-y-0">
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="block min-w-0 p-3 sm:table-row sm:p-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="grid min-w-0 grid-cols-[minmax(5rem,0.8fr)_minmax(0,2fr)] gap-3 py-1.5 align-top text-slate-700 sm:table-cell sm:border-b sm:border-slate-100 sm:px-3 sm:py-2.5">
                    <span className="break-words font-semibold text-slate-600 sm:hidden">{data.columns[cellIndex]}</span>
                    <span className="min-w-0 break-words">{cell}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
