/**.
 * 백단에서 페이징 없이 전체 목록을 한번에 내려주는 API에서
 * 프론트단이 직접 페이지네이션을 구현할 때 사용하는 함수
 *
 * 백단이 페이징을 적용해서 한 페이지 분량만 내려주는 방식으로 바뀌면 해당 함수는 불필요
 * 응답이 단순배열이 아니라 { content, totalElements, ... } 같은 래퍼 객체로 바뀌고
 * 이미 한 페이지만 온 데이터를 해당 함수로 또 자르면 page가 0보다 커지는 순간 slice 범위가 어긋나서 빈 배열이 나오기 때문!
 * 그 경우엔 currentPage를 API 쿼리 파라미터로 넘겨 페이지 이동마다 재요청하고
 * totalPages도 이 함수 대신 응답의 totalPages/totalElements를 그대로 쓸것(모르겠으면 전지윤 주임에게 물어보기...)
 *
 * @param data - 페이징할 전체 데이터 배열
 * @param page - 현재 페이지 번호 (0부터 시작)
 * @param pageSize - 한 페이지에 보여줄 개수 (디폴트 10, 다르게 쓸 때만 지정!)
 * @returns totalPages(전체 페이지 수)와 pagedData(현재 페이지에 해당하는 데이터)
 */
export const paginate = <T,>(data: T[], page: number, pageSize = 10) => ({
    totalPages: Math.ceil(data.length / pageSize),
    pagedData: data.slice(page * pageSize, (page + 1) * pageSize)
});