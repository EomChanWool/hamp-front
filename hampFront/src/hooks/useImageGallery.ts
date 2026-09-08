import { useCallback, useEffect, useRef, useState } from 'react';

export interface GalleryImage {
    /** 목록 렌더링/삭제 시 key로 사용. 기존: `existing-${attachmentId}`, 신규: `new-${uid}` */
    key: string;
    /** <img src>로 바로 쓸 수 있는 URL (기존은 페이지에서 넘겨준 URL, 신규는 내부에서 만든 blob URL) */
    url: string;
    /** 썸네일/파일명 표기용 */
    name: string;
    /** 서버에 이미 저장된 첨부파일인지 여부 */
    isExisting: boolean;
    /** isExisting === true 일 때만 존재 (삭제 API 호출 시 필요) */
    attachmentId?: number;
    /** isExisting === false 일 때만 존재 (업로드 API 호출 시 FormData에 필요) */
    file?: File;
}

export interface ExistingImageInput {
    attachmentId: number;
    /** 이미 blob URL 등으로 변환된, <img>에 바로 넣을 수 있는 URL */
    url: string;
    name: string;
}

export interface UseImageGalleryOptions {

    initialExisting?: ExistingImageInput[];
    /** 허용 확장자 (소문자, 점 없이). 기본값: 이미지 4종 */
    allowedExtensions?: string[];
    /** 파일 1개당 최대 용량(MB) */
    maxFileSizeMB?: number;
    /** 전체 최대 첨부 개수 (선택). 지정하면 초과분은 추가되지 않고 알림만 뜬다 */
    maxCount?: number;
    onRemoveExisting?: (attachmentId: number) => Promise<void>;
}

const EMPTY_ARRAY: ExistingImageInput[] = [];
let uid = 0;

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/**
 * 이미지 첨부 갤러리(기존 첨부 + 신규 선택 파일)의 상태와 조작 로직을 한 곳에서 관리하는 훅.
 */
export function useImageGallery({
    initialExisting = EMPTY_ARRAY,
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'],
    maxFileSizeMB = 20,
    maxCount,
    onRemoveExisting,
}: UseImageGalleryOptions = {}) {
    // 기존 첨부는 GalleryImage 형태로 변환해 초기값으로 세팅
    const toGalleryImage = (item: ExistingImageInput): GalleryImage => ({
        key: `existing-${item.attachmentId}`,
        url: item.url,
        name: item.name,
        isExisting: true,
        attachmentId: item.attachmentId,
    });

    const [existingImages, setExistingImages] = useState<GalleryImage[]>(() =>
        initialExisting.map(toGalleryImage)
    );

    // 신규로 선택된 파일 (아직 서버에 업로드되지 않음)
    const [newImages, setNewImages] = useState<GalleryImage[]>([]);

    // 큰 미리보기 캐러셀에서 현재 보고 있는 인덱스 (existingImages + newImages를 이어붙인 기준)
    const [activeIndex, setActiveIndex] = useState(0);

    // 페이지에서 나중에 상세 재조회 등으로 initialExisting 참조가 바뀌면 동기화한다.
    const prevInitialRef = useRef(initialExisting);
    useEffect(() => {
        if (prevInitialRef.current !== initialExisting) {
            prevInitialRef.current = initialExisting;
            setExistingImages(initialExisting.map(toGalleryImage));
        }
    }, [initialExisting]);

    const newImagesRef = useRef<GalleryImage[]>(newImages);
    useEffect(() => {
        newImagesRef.current = newImages;
    }, [newImages]);

    useEffect(() => {
        return () => {
            newImagesRef.current.forEach((img) => URL.revokeObjectURL(img.url));
        };
    }, []);

    const images = [...existingImages, ...newImages];

    // 기존 existingImages도 ref로 관리하여 최신 상태 보장
    const existingImagesRef = useRef(existingImages);
    useEffect(() => {
        existingImagesRef.current = existingImages;
    }, [existingImages]);

    /** 파일 검증(확장자/용량/최대개수) 후 통과한 파일만 신규 목록에 추가한다 */
    const addFiles = useCallback(
        (incoming: FileList | File[]) => {
            setNewImages((prevNew) => {
                // existingImages.length는 외부 변수 대신 클로저 내에서 최신 상태를 참조하거나 
                // 기존existingImages 상태 배열의 길이를 직접 안전하게 가져옵니다.
                const currentTotalCount = existingImagesRef.current.length + prevNew.length;
                const validNew: GalleryImage[] = [];

                Array.from(incoming).forEach((file) => {
                    const ext = getExt(file.name);

                    if (!allowedExtensions.includes(ext)) {
                        alert(
                            `이미지 파일만 업로드 가능합니다. (${file.name})\n- 허용 확장자: ${allowedExtensions
                                .join(', ')
                                .toUpperCase()}`
                        );
                        return;
                    }

                    if (file.size > maxFileSizeMB * 1024 * 1024) {
                        alert(`파일 용량은 최대 ${maxFileSizeMB}MB를 초과할 수 없습니다. (${file.name})`);
                        return;
                    }

                    if (maxCount && currentTotalCount + validNew.length >= maxCount) {
                        alert(`이미지는 최대 ${maxCount}장까지 첨부할 수 있습니다.`);
                        return;
                    }

                    validNew.push({
                        key: `new-${uid++}`,
                        url: URL.createObjectURL(file),
                        name: file.name,
                        isExisting: false,
                        file,
                    });
                });

                if (validNew.length === 0) return prevNew;
                return [...prevNew, ...validNew];
            });
        },
        [allowedExtensions, maxFileSizeMB, maxCount]
    );

    /**
     * key로 이미지 한 장을 삭제한다.
     * - 기존 첨부: onRemoveExisting이 있으면 서버 삭제가 성공해야 목록에서도 제거된다.
     * - 신규 파일: blob URL을 해제하고 로컬 목록에서만 제거한다 (아직 서버에 없으므로).
     */
    const removeAt = useCallback(
        async (key: string) => {
            const target = images.find((img) => img.key === key);
            if (!target) return;

            if (target.isExisting) {
                if (target.attachmentId == null) return;
                if (onRemoveExisting) {
                    try {
                        await onRemoveExisting(target.attachmentId);
                    } catch {
                        // 서버 삭제 실패(또는 사용자 취소) 시 화면 목록은 건드리지 않는다.
                        // 에러 알림(alert 등)은 onRemoveExisting을 넘긴 호출부에서 처리하도록 위임한다.
                        return;
                    }
                }
                setExistingImages((prev) => prev.filter((img) => img.key !== key));
            } else {
                URL.revokeObjectURL(target.url);
                setNewImages((prev) => prev.filter((img) => img.key !== key));
            }

            // 삭제 후 활성 인덱스가 목록 범위를 벗어나지 않도록 보정
            setActiveIndex((prev) => Math.max(0, Math.min(prev, images.length - 2)));
        },
        [images, onRemoveExisting]
    );

    /** 신규로 선택했던 파일만 전부 초기화 (등록/수정 취소, 저장 성공 후 등에서 사용) */
    const resetNew = useCallback(() => {
        newImages.forEach((img) => URL.revokeObjectURL(img.url));
        setNewImages([]);
        setActiveIndex(0);
    }, [newImages]);

    return {
        /** 기존 첨부 + 신규 파일을 합친 전체 목록 (ImageGallery 렌더링에 그대로 넘기면 됨) */
        images,
        /** 신규로 선택된 File 객체만 뽑아낸 배열 (저장 시 업로드 API 호출용) */
        newFiles: newImages.map((img) => img.file!).filter(Boolean),
        activeIndex,
        setActiveIndex,
        addFiles,
        removeAt,
        resetNew,
        isEmpty: images.length === 0,
    };
}
