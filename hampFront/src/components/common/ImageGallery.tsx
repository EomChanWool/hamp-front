import { type ChangeEvent, type KeyboardEvent } from 'react';
import Remix from '@components/common/Remix';
import FileDropZone from '@components/common/FileDropZone';
import type { GalleryImage } from '@/hooks/useImageGallery';
import '@components/common/ImageGallery.css';

interface ImageGalleryProps {
  images: GalleryImage[];
  /** 현재 큰 미리보기에 표시 중인 인덱스 */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onFilesSelected: (files: FileList | File[]) => void;
  /** 썸네일의 삭제 버튼 클릭 시 호출. useImageGallery().removeAt을 그대로 연결하면 됨 */
  onRemove: (key: string) => void;
  /** false면 읽기 전용 화면: 삭제 버튼 / 이미지 추가 버튼이 숨겨짐 (상세 조회 모드 등) */
  editable?: boolean;
  /** 섹션 제목 (기본: "이미지") */
  title?: string;
  /** 허용 확장자 (빈 상태 드롭존의 안내 문구 및 input accept에 반영) */
  allowedExtensions?: string[];
}

const DEFAULT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

const ImageGallery = ({
  images,
  activeIndex,
  onActiveIndexChange,
  onFilesSelected,
  onRemove,
  editable = true,
  title = '이미지',
  allowedExtensions = DEFAULT_EXTENSIONS,
}: ImageGalleryProps) => {
  const accept = allowedExtensions.map((ext) => `.${ext}`).join(',');

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onFilesSelected(filesArray);
    }
    e.target.value = ''; // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화
  };

  const goPrev = () => onActiveIndexChange(Math.max(0, activeIndex - 1));
  const goNext = () => onActiveIndexChange(Math.min(images.length - 1, activeIndex + 1));

  const handlePreviewKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    }
  };

  const handleThumbKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActiveIndexChange(index);
    }
  };

  return (
    <div className="image-gallery">
      <div className="image-gallery__header">
        <span className="image-gallery__title">{title}</span>
        <span className="image-gallery__count">{images.length}장</span>
      </div>

      {/* 이미지가 없을 때: FileDropZone 표시 */}
      {images.length === 0 ? (
        <FileDropZone
          mainText="이미지 파일을 마우스로 끌어다 놓으세요."
          subText={`지원 형식: ${allowedExtensions.join(', ').toUpperCase()} (다중 선택 가능)`}
          buttonText="이미지 선택"
          accept={accept}
          allowedExtensions={allowedExtensions}
          showFileList={false}
          onFilesChange={onFilesSelected}
        />
      ) : (
        /* 이미지가 있을 때: 미리보기 캐러셀 + 썸네일 표시 */
        <>
          <div
            className="image-gallery__preview"
            tabIndex={0}
            role="group"
            aria-label={`${title} 미리보기, 좌우 화살표 키로 이동 가능`}
            onKeyDown={handlePreviewKeyDown}
          >
            <img
              src={images[activeIndex]?.url ?? images[0]?.url}
              alt={images[activeIndex]?.name ?? ''}
              className="image-gallery__preview-img"
            />
            <span className="image-gallery__preview-index" aria-live="polite">
              {activeIndex + 1} / {images.length}
            </span>
            <span className="image-gallery__preview-name">
              <Remix iconName="file-line" iconSize={0.9} />
              {images[activeIndex]?.name ?? ''}
            </span>
          </div>

          <div className="image-gallery__thumbnails">
            {images.map((img, index) => (
              <div
                key={img.key}
                role="button"
                tabIndex={0}
                className={`image-gallery__thumb${index === activeIndex ? ' image-gallery__thumb--active' : ''}`}
                onClick={() => onActiveIndexChange(index)}
                onKeyDown={(e) => handleThumbKeyDown(e, index)}
                aria-label={`${index + 1}번째 이미지 보기: ${img.name}`}
                aria-current={index === activeIndex}
              >
                <img src={img.url} alt="" />
                {editable && (
                  <button
                    type="button"
                    className="image-gallery__thumb-remove"
                    aria-label={`${img.name} 삭제`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(img.key);
                    }}
                  >
                    <Remix iconName="close-line" iconSize={0.8} />
                  </button>
                )}
              </div>
            ))}
            
            {editable && (
              <label
                className="image-gallery__thumb image-gallery__thumb--add"
                aria-label="이미지 추가"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // 라벨 키보드 접근성 시뮬레이션
                    const input = e.currentTarget.querySelector('input');
                    input?.click();
                  }
                }}
              >
                <Remix iconName="add-line" iconSize={1.4} />
                <input
                  type="file"
                  multiple
                  accept={accept}
                  style={{ display: 'none' }}
                  onChange={handleInputChange}
                />
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageGallery;