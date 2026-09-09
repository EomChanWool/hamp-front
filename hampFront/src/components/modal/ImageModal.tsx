import { useState, useEffect, type KeyboardEvent } from 'react';
import Remix from '@components/common/Remix';
import type { GalleryImage } from '@/hooks/useImageGallery';
import '@components/modal/ImageModal.css';

interface ImageModalProps {
  images: GalleryImage[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageModal({ images, initialIndex, onClose }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 줌 및 패닝(이동) 상태 관리
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentImage = images[currentIndex] || images[0];

  // 이미지 변경 또는 이동 시 줌 및 위치 초기화
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    resetZoom();
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    resetZoom();
    setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
  };

  // 마우스 휠로 줌인/줌아웃
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.15;
    let newScale = e.deltaY < 0 ? scale * (1 + zoomIntensity) : scale * (1 - zoomIntensity);

    // 최소 1배, 최대 5배 제한
    newScale = Math.max(1, Math.min(newScale, 5));

    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
    setScale(newScale);
  };

  // 드래그 시작 (확대된 상태에서만 이동 가능)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  // 드래그 중 이동
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  // 드래그 종료
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 더블 클릭 시 줌 리셋 또는 확대
  const handleDoubleClick = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  // 키보드 이벤트 (ESC로 닫기, 좌우 방향키로 이미지 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (scale === 1 && currentIndex > 0) handlePrev();
      } else if (e.key === 'ArrowRight') {
        if (scale === 1 && currentIndex < images.length - 1) handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown as any);
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [images.length, currentIndex, scale]);

  if (!currentImage) return null;

  return (
    <div className="image-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      {/* 상단바 (닫기 버튼, 줌 컨트롤러 및 카운트) */}
      <div className="image-modal__header" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="image-modal__counter">
            {currentIndex + 1} / {images.length}
          </span>
          {/* 줌 제어 버튼 추가 그룹 */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(s + 0.5, 5))}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
              title="확대"
            >
              +
            </button>
            <button
              type="button"
              onClick={resetZoom}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}
              title="1:1 비율로 초기화"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(s - 0.5, 1))}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
              title="축소"
            >
              -
            </button>
          </div>
        </div>

        <button type="button" className="image-modal__close-btn" onClick={onClose} aria-label="닫기">
          <Remix iconName="close-line" iconSize={1.5} />
        </button>
      </div>

      {/* 이전 이미지 버튼 */}
      {currentIndex > 0 && (
        <button type="button" className="image-modal__nav-btn image-modal__nav-btn--prev" onClick={handlePrev} aria-label="이전 이미지">
          <Remix iconName="arrow-left-s-line" iconSize={2} />
        </button>
      )}

      {/* 중앙 메인 이미지 (마우스 휠, 드래그, 더블클릭 인터랙션 적용) */}
      <div
        className="image-modal__content"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', overflow: 'hidden' }}
      >
        <img
          src={currentImage.url}
          alt={currentImage.name}
          className="image-modal__img"
          onDoubleClick={handleDoubleClick}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            userSelect: 'none',
          }}
          draggable={false}
        />
        <div className="image-modal__name" style={{ pointerEvents: 'none' }}>
          <Remix iconName="file-line" iconSize={1} />
          {currentImage.name} {scale > 1 && `(${Math.round(scale * 100)}%)`}
        </div>
      </div>

      {/* 다음 이미지 버튼 */}
      {currentIndex < images.length - 1 && (
        <button type="button" className="image-modal__nav-btn image-modal__nav-btn--next" onClick={handleNext} aria-label="다음 이미지">
          <Remix iconName="arrow-right-s-line" iconSize={2} />
        </button>
      )}
    </div>
  );
}