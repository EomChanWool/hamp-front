import { useRef, type MouseEvent, type ReactNode } from 'react';
import Remix from '@/components/common/Remix';
import '@/components/button/CustomButton.css';

const iconLocationKey = { // 아이콘 위치
    front: 'front', // 아이콘이 버튼 앞에 위치함
    back: 'back', // 아이콘이 버튼 뒤에 위치함
    icon: 'icon', // 아이콘만 존재
    text: 'text', // 버튼 레이블만 존재
} as const;

type IconLocationType = keyof typeof iconLocationKey;

const prefixKey = { // 버튼 시인성 레벨
    high: 'high', // 위험 요소 있음
    warn: 'warn', // 주의 필요
    low: 'low', // 주의도 낮음
    ghost: 'ghost', // 투명
    hidden: 'hidden', // 숨김 처리
    green: 'green',
    grayGhost: 'grayGhost',
    primary: 'primary',
    info: 'info',
    roundGhostInfo: 'roundGhostInfo',
    secondary: 'secondary',
    softPrimary: 'softPrimary',
    softHigh: 'softHigh',
    softSecondary: 'softSecondary',
    transparent : 'transparent',
    none: 'none'
} as const;

type PrefixType = keyof typeof prefixKey;

const CustomButton = ({ children, iconPosition = 'front', iconName = 'user-fill', iconSize = 1, iconColor, prefixType, buttonRef, className = '', disabled = false, title, onClick }: {
    children: ReactNode; // 버튼 Label
    iconPosition?: IconLocationType; // 아이콘 위치 및 버튼의 종류
    iconName? : string; // 버튼에 사용할 Remix Icon 이름
    iconSize? : number; // 아이콘 크기
    iconColor?: string; // 아이콘 색상
    prefixType?: PrefixType; // 버튼의 시인성 레벨
    buttonRef?: React.RefObject<HTMLButtonElement | null>; // 상위 컴포넌트에서 필요한 경우 ref로 지정할 element
    className?: string;
    disabled?: boolean; // 버튼 비활성화 여부
    title?: string; // hover 시 표시할 네이티브 툴팁
    onClick?: (e?: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => void;
}) => {
    const clickLockRef = useRef(false);
    const handleOnClick = async (e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
        e.stopPropagation();

        if (disabled || clickLockRef.current) return;

        clickLockRef.current = true;

        try {
            await onClick?.(e);
        } finally {
            setTimeout(() => {
                clickLockRef.current = false;
            }, 800);
        }
    };

    return (
        <button 
            type="button" 
            className={`custom-btn ${iconPosition} ${prefixType ? prefixType : ''} ${className}`} 
            ref={buttonRef} 
            onClick={(e) => handleOnClick(e)} 
            disabled={disabled} 
            title={title}
        >
            <div className="custom-btn__icon-container">
                <Remix iconName={iconName} iconSize={iconSize} color={iconColor} />
            </div>

            <div className="custom-btn__label-container">
                <span>{children ? children : '버튼'}</span>
            </div>
        </button>
    );
};

export default CustomButton;