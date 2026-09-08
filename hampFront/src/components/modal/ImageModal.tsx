import { useState, useEffect, type KeyboardEvent } from 'react';
import Remix from '@components/common/Remix';
import type { GalleryImage } from '@/hooks/useImageGallery';
import '@components/common/ImageModal.css';

interface ImageModalProps {
  images: GalleryImage[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageModal({ images, initialIndex, onClose }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentImage = images[currentIndex] || images[0];

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
  };

  // 키보드 이벤트 (ESC로 닫기, 좌우 방향키로 이미지 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent ) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown as any);
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [images.length]);

  if (!currentImage) return null;

  return (
    <div className="image-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      {/* 상단바 (닫기 버튼 및 카운트) */}
      <div className="image-modal__header" onClick={(e) => e.stopPropagation()}>
        <span className="image-modal__counter">
          {currentIndex + 1} / {images.length}
        </span>
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

      {/* 중앙 메인 이미지 */}
      <div className="image-modal__content" onClick={(e) => e.stopPropagation()}>
        <img src={currentImage.url} alt={currentImage.name} className="image-modal__img" />
        <div className="image-modal__name">
          <Remix iconName="file-line" iconSize={1} />
          {currentImage.name}
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