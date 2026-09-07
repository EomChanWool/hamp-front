// https://remixicon.com/

const Remix = ({ iconName, iconSize = 1, color = "currentColor" }:
     { iconName?: string; iconSize?: number, color?: string }) => {
    if (!iconName) return null;
    return (
        <i
            className={`ri-${iconName}`}
            style={{ fontSize: `${iconSize}rem`, color: color}}
        />
    );
};

export default Remix;
