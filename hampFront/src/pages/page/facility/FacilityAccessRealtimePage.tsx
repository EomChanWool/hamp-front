import { useMemo, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { mesScreens } from "@/data/mesScreens";
import { KpiGrid } from "@components/kpi/KpiGrid";
import { useRealtimePulse } from "@/hooks/useRealtimePulse";
import { CusTable, type CusColumnMeta } from "@components/table/CusTable";
import { CusPagination } from "@components/table/CusPagination";
import "./FaciliyAccess.css";
import { Panel } from "@components/card/Panel";

const DEF = mesScreens.facilityAccessRealtime;

type AccessType = "IN" | "OUT";
type AccessStatus = "OK" | "DENIED";

interface AccessLog {
  id: number;
  name: string;
  dept: string;
  time: string;
  type: AccessType;
  status: AccessStatus;
  img: string;
}

const ACCESS_DUMMY: AccessLog[] = [
  {
    id: 1,
    name: "홍길동",
    dept: "생산1팀",
    time: "2025.06.25 14:47:00",
    type: "IN",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&1",
  },
  {
    id: 2,
    name: "김철수",
    dept: "품질관리팀",
    time: "2025.06.25 14:32:15",
    type: "OUT",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&2",
  },
  {
    id: 3,
    name: "이영희",
    dept: "설비관리팀",
    time: "2025.06.25 14:21:08",
    type: "IN",
    status: "DENIED",
    img: "https://cataas.com/cat?width=80&height=80&3",
  },
  {
    id: 4,
    name: "박민준",
    dept: "물류팀",
    time: "2025.06.25 13:58:44",
    type: "IN",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&4",
  },
  {
    id: 5,
    name: "최수진",
    dept: "생산2팀",
    time: "2025.06.25 13:45:30",
    type: "OUT",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&5",
  },
  {
    id: 6,
    name: "정태호",
    dept: "시스템관리팀",
    time: "2025.06.25 13:30:22",
    type: "IN",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&6",
  },
  {
    id: 7,
    name: "윤서연",
    dept: "연구개발팀",
    time: "2025.06.25 13:10:00",
    type: "OUT",
    status: "DENIED",
    img: "https://cataas.com/cat?width=80&height=80&7",
  },
  {
    id: 8,
    name: "임재현",
    dept: "총무팀",
    time: "2025.06.25 12:55:30",
    type: "IN",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&8",
  },
  {
    id: 9,
    name: "한지수",
    dept: "생산3팀",
    time: "2025.06.25 12:40:15",
    type: "OUT",
    status: "OK",
    img: "https://cataas.com/cat?width=80&height=80&9",
  },
];

const PAGE_SIZE = 8; // 더미가 9건이라 페이지네이션 확인용. 실제는 10~15 권장

const columns: ColumnDef<AccessLog>[] = [
  {
    accessorKey: "name",
    header: "이름",
    cell: ({ row }) => (
      <div className="accessUser">
        <img className="accessAvatar" src={row.original.img} alt="" />
        <strong>{row.original.name}</strong>
      </div>
    ),
  },
  { accessorKey: "dept", header: "부서" },
  {
    accessorKey: "time",
    header: "출입시각",
    cell: ({ getValue }) => <span className="accessTime">{getValue<string>()}</span>,
  },
  {
    accessorKey: "type",
    header: "구분",
    enableSorting: false,
    cell: ({ getValue }) => {
      const isIn = getValue<AccessType>() === "IN";
      return <span className={`accessType ${isIn ? "in" : "out"}`}>{isIn ? "입실" : "퇴실"}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "상태",
    enableSorting: false,
    meta: { width: "120px" } satisfies CusColumnMeta,
    cell: ({ getValue }) => {
      const ok = getValue<AccessStatus>() === "OK";
      return <span className={`accessBadge ${ok ? "ok" : "denied"}`}>{ok ? "정상" : "미인가"}</span>;
    },
  },
];

export function FacilityAccessRealtimePage() {
  const { pulse } = useRealtimePulse(true);
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "time", desc: true }]);

  // manualSorting이라 데이터 정렬은 여기서 직접 처리
  const sorted = useMemo(() => {
    if (sorting.length === 0) return ACCESS_DUMMY;
    return [...ACCESS_DUMMY].sort((a, b) => {
      for (const { id, desc } of sorting) {
        const av = a[id as keyof AccessLog];
        const bv = b[id as keyof AccessLog];
        if (av === bv) continue;
        const cmp = String(av).localeCompare(String(bv), "ko");
        return desc ? -cmp : cmp;
      }
      return 0;
    });
  }, [sorting]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="screenStack">
      {DEF.kpis && <KpiGrid kpis={DEF.kpis} pulse={pulse} />}

      <Panel title="출입 기록">
        <CusTable<AccessLog>
          data={pageRows}
          columns={columns}
          sorting={sorting}
          onSortingChange={(next) => {
            setSorting(next);
            setPage(0);
          }}
          getRowId={(row) => String(row.id)}
          noDataMessage="출입 기록이 없습니다."
        />
        <CusPagination page={page} totalPages={totalPages} totalCount={sorted.length} onPageChange={setPage} />
      </Panel>
    </section>
  );
}
