import { useRef, useState, type DragEvent } from 'react';
import Remix from '@components/common/Remix';
import CustomButton from '@/components/button/CustomButton';
import '@components/common/FileDropZone.css';

export interface AttachedFile {
    file: File;
    id: number;
}

interface FileDropZoneProps {
    label?: string;
    isRequired?: boolean;
    accept?: string;
    mainText?: string;
    subText?: string;
    buttonText?: string;
    iconName?: string;
    /** 파일 선택 및 검증 완료 시 호출 (새 파일 배열 전달) */
    onFilesChange?: (files: File[]) => void;
    /** false이면 내부 파일 목록을 숨김. 부모가 파일 목록을 직접 관리할 때 사용 */
    showFileList?: boolean;
    className?: string;
    /** 이미지 전용 화면 등에서는 allowedExtensions={['jpg','jpeg','png','gif']} */
    allowedExtensions?: string[];
}

export const EXT_META: Record<string, { icon: string; color: string }> = {
    pdf: { icon: 'file-pdf-2-line', color: '#e03131' },
    csv: { icon: 'file-excel-2-line', color: '#2f9e44' },
    xlsx: { icon: 'file-excel-2-line', color: '#2f9e44' },
    xls: { icon: 'file-excel-2-line', color: '#2f9e44' },
    doc: { icon: 'file-word-2-line', color: '#1971c2' },
    docx: { icon: 'file-word-2-line', color: '#1971c2' },
    ppt: { icon: 'file-ppt-2-line', color: '#e8590c' },
    pptx: { icon: 'file-ppt-2-line', color: '#e8590c' },
    zip: { icon: 'file-zip-line', color: '#495057' },
    png: { icon: 'file-image-line', color: '#7048e8' },
    jpg: { icon: 'file-image-line', color: '#7048e8' },
    jpeg: { icon: 'file-image-line', color: '#7048e8' },
    gif: { icon: 'file-image-line', color: '#7048e8' },
    hwp: { icon: 'file-text-line', color: '#0052cc' },
    hwpx: { icon: 'file-text-line', color: '#0052cc' },
    txt: { icon: 'file-text-line', color: '#555555' },
};

// 기본 허용 확장자 목록 (소문자). allowedExtensions prop을 넘기지 않았을 때의 기본값으로 쓰인다.
const DEFAULT_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'txt'];
const MAX_FILE_SIZE_MB = 20;

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// 신규 첨부 파일에 붙일 고유 id 카운터 (컴포넌트 인스턴스 간 공유되는 모듈 스코프 변수)
let uid = 0;

const FileDropZone = ({
    label,
    isRequired = false,
    accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.jpg,.jpeg,.png,.gif,.zip,.txt',
    mainText = '파일을 마우스로 끌어다 놓으세요.',
    subText = '지원 형식: PDF, Word, Excel, PPT, HWP, 이미지, ZIP, TXT (최대 20MB)',
    buttonText = '파일 선택',
    iconName = 'upload-2-line',
    onFilesChange,
    showFileList = true,
    className = '',
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
}: FileDropZoneProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

    // ── 파일 검증 및 추가 로직 ──
    // 드래그앤드롭, 파일 선택 input 두 경로 모두 이 함수를 통해서만 파일을 추가한다.
    const handleFiles = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        const incomingArray = Array.from(fileList);
        const validFiles: AttachedFile[] = [];

        for (const file of incomingArray) {
            const ext = getExt(file.name);

            // 1. 확장자 검증 (allowedExtensions prop 기준. 기본값은 문서/이미지/압축 등 전체)
            if (!allowedExtensions.includes(ext)) {
                alert(`허용되지 않는 파일 형식입니다. (${file.name})\n- 허용 확장자: ${allowedExtensions.join(', ')}`);
                continue;
            }

            // 2. 용량 검증 (20MB)
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                alert(`파일 용량은 최대 ${MAX_FILE_SIZE_MB}MB를 초과할 수 없습니다. (${file.name})`);
                continue;
            }

            validFiles.push({ file, id: uid++ });
        }

        if (validFiles.length > 0) {
            const updated = [...attachedFiles, ...validFiles];
            setAttachedFiles(updated);

            // 부모 컴포넌트에 순수 File 객체 배열만 전달 (지금까지 누적된 전체 목록)
            onFilesChange?.(updated.map(item => item.file));
        }

        // 같은 파일을 연속으로 다시 선택해도 change 이벤트가 발생하도록 값 초기화
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── 파일 개별 삭제 ──
    const handleRemove = (id: number) => {
        const updated = attachedFiles.filter(f => f.id !== id);
        setAttachedFiles(updated);
        onFilesChange?.(updated.map(item => item.file));
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        // 드롭존 내부의 자식 엘리먼트로 마우스가 이동한 경우까지 dragLeave로 처리되지 않도록 방지
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    return (
        <div className={`file-drop-zone-wrapper ${className}`}>
            {label && (
                <div className="cus-input-label-row">
                    <span className="cus-input-label">{label}</span>
                    {isRequired && (
                        <span className="cus-input-required">
                            <Remix iconName="asterisk" iconSize={0.5} color="#e40000" />
                        </span>
                    )}
                </div>
            )}
            <div
                className={`file-drop-zone${isDragging ? ' file-drop-zone--dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="file-drop-zone__icon">
                    <Remix iconName={iconName} iconSize={2.3} />
                </div>
                <span className="file-drop-zone__main-text">{mainText}</span>
                <span className="file-drop-zone__sub-text">{subText}</span>
                <CustomButton
                    prefixType="ghost"
                    iconPosition="text"
                    onClick={() => {
                        fileInputRef.current?.click();
                    }}
                >
                    {buttonText}
                </CustomButton>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>

            {/* showFileList=false인 경우(예: ImageGallery 빈 상태) 이 목록은 렌더링하지 않는다.
                이때도 onFilesChange는 그대로 호출되므로, 부모가 파일 목록을 직접 그려주면 된다. */}
            {showFileList && attachedFiles.length > 0 && (
                <ul className="file-drop-zone__list">
                    {attachedFiles.map(({ file, id }) => {
                        const ext = getExt(file.name);
                        const meta = EXT_META[ext] ?? { icon: 'file-line', color: '#888' };
                        return (
                            <li key={id} className="file-drop-zone__item">
                                <span className="file-drop-zone__item-badge" style={{ backgroundColor: meta.color }}>
                                    {ext || '기타'}
                                </span>
                                <div className="file-drop-zone__item-info">
                                    <span className="file-drop-zone__item-name">{file.name}</span>
                                    <span className="file-drop-zone__item-meta">
                                        {formatBytes(file.size)}
                                        <span className="file-drop-zone__item-dot" />
                                        {ext.toUpperCase()}
                                        <span className="file-drop-zone__item-dot" />
                                        <span style={{ color: '#2f9e44' }}>업로드 대기</span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="file-drop-zone__item-remove"
                                    onClick={() => handleRemove(id)}
                                    title="삭제"
                                >
                                    <Remix iconName="close-line" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default FileDropZone;