import { useId } from "react";

export type EducationalTableData = {
  caption: string;
  columns: string[];
  rows: string[][];
};

export function EducationalTable({ data }: { data: EducationalTableData }) {
  const tableId = useId();
  return (
    <div className="min-w-0">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className={`caption-top px-3 py-2.5 text-left text-sm font-medium leading-6 text-slate-700 ${data.caption ? "" : "sr-only"}`}>
            {data.caption || `Table comparing ${data.columns.join(", ")}`}
          </caption>
          <thead className="sr-only bg-slate-50 sm:not-sr-only sm:table-header-group">
            <tr>{data.columns.map((column, index) => <th id={`${tableId}-column-${index}`} key={`${column}-${index}`} scope="col" className="break-words border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-800">{column}</th>)}</tr>
          </thead>
          <tbody className="block divide-y divide-slate-200 sm:table-row-group sm:divide-y-0">
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="block min-w-0 p-3 sm:table-row sm:p-0">
                {row.map((cell, cellIndex) => (
                  <td headers={`${tableId}-column-${cellIndex}`} key={cellIndex} className="grid min-w-0 grid-cols-[minmax(5rem,0.8fr)_minmax(0,2fr)] gap-3 py-1.5 align-top text-slate-700 sm:table-cell sm:border-b sm:border-slate-100 sm:px-3 sm:py-2.5">
                    <span aria-hidden="true" className="break-words font-semibold text-slate-600 sm:hidden">{data.columns[cellIndex]}</span>
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
